-- Migration: block privilege escalation on profiles.role
-- Run this in your Supabase SQL editor.
--
-- Root cause: app/staff/page.tsx only checks "isSelf"/"canGrantAdmin" in
-- React state before calling supabase.from("profiles").update({role:...}) or
-- .insert({..., role: "Admin"}); lib/api/settings.ts's updateProfileFull/
-- createProfile (Settings > Users) have no client-side guard at all. Since
-- this app's auth is custom (no Supabase Auth, auth.uid() is always NULL)
-- and profiles has RLS disabled entirely (multitenant_security.sql Step 6),
-- nothing server-side stops any authenticated browser session from calling
-- the same update/insert directly via devtools/the anon key and setting
-- role='Admin' on its own profile row, or creating a brand new Admin
-- account outright. Any Cashier can silently grant themselves Admin today.
--
-- Fix: role changes to/creation of 'Admin' rows must go through a
-- SECURITY DEFINER RPC (grant_admin_role) that takes the acting user's id
-- as a plain function ARGUMENT, not a session variable - deliberately
-- avoiding the set_config()-based pattern used elsewhere in this project
-- (set_tenant_context, current_tenant_id) because that pattern is already
-- documented (fix_rls_pooling.sql) to fail unpredictably under Supabase's
-- PgBouncer pooling: the RPC call and the subsequent query can land on two
-- different pooled connections, silently dropping the session variable.
-- Passing actor_id as an argument makes this correct regardless of pooling,
-- since everything happens inside one function call on one connection.
--
-- A companion trigger blocks role='Admin' from ever being written by a
-- plain UPDATE/INSERT that bypasses the RPC (e.g. a raw devtools call) -
-- only the RPC's SECURITY DEFINER context is allowed through, via a
-- transaction-local flag the RPC sets right before writing.
--
-- Not a full replacement for enabling RLS on profiles (a separate, larger
-- change) but closes this specific escalation path immediately without
-- touching login/signup, which depend on profiles being reachable without
-- a tenant context set yet.

-- ── Step 1: the only sanctioned way to grant/create an Admin row ────────────

CREATE OR REPLACE FUNCTION grant_admin_role(
  p_target_id   UUID,   -- profile being promoted (must already exist - use for UPDATEs)
  p_actor_id    UUID    -- the profile making this request, verified below
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_role   TEXT;
  v_actor_status TEXT;
  v_target_tenant UUID;
BEGIN
  IF p_actor_id = p_target_id THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  SELECT tenant_id INTO v_target_tenant FROM profiles WHERE id = p_target_id;
  IF v_target_tenant IS NULL THEN
    RAISE EXCEPTION 'Target profile not found';
  END IF;

  SELECT role, status INTO v_actor_role, v_actor_status
  FROM profiles WHERE id = p_actor_id AND tenant_id = v_target_tenant;

  IF v_actor_role IS DISTINCT FROM 'Admin' OR v_actor_status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Only an active Admin in the same tenant may grant the Admin role';
  END IF;

  -- Signals the trigger below (same transaction, so set_config's
  -- transaction-scoped `true` is reliable here - no pooling gap, since the
  -- UPDATE happens in the very next statement of this same function call).
  PERFORM set_config('app.admin_grant_authorized', 'true', true);
  UPDATE profiles SET role = 'Admin' WHERE id = p_target_id;
END;
$$;

-- Same idea for brand-new profiles created directly with role='Admin'
-- (app/staff/page.tsx AddStaffDialog, lib/api/settings.ts createProfile).
CREATE OR REPLACE FUNCTION create_admin_profile(
  p_actor_id   UUID,
  p_id         UUID,
  p_tenant_id  UUID,
  p_name       TEXT,
  p_email      TEXT,
  p_phone      TEXT,
  p_password   TEXT,
  p_status     TEXT,
  p_permissions JSONB
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_role   TEXT;
  v_actor_status TEXT;
  v_row          profiles;
BEGIN
  SELECT role, status INTO v_actor_role, v_actor_status
  FROM profiles WHERE id = p_actor_id AND tenant_id = p_tenant_id;

  IF v_actor_role IS DISTINCT FROM 'Admin' OR v_actor_status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Only an active Admin in the same tenant may grant the Admin role';
  END IF;

  PERFORM set_config('app.admin_grant_authorized', 'true', true);
  INSERT INTO profiles (id, tenant_id, name, email, phone, role, password, status, permissions)
  VALUES (p_id, p_tenant_id, p_name, p_email, p_phone, 'Admin', p_password, p_status, p_permissions)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ── Step 2: trigger that blocks role='Admin' unless the RPC authorized it ───
-- Covers both the UPDATE path (role raised to Admin on an existing row) and
-- the INSERT path (a new row created with role='Admin' directly), closing
-- both escalation routes found in the app.

CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_role TEXT;
  v_authorized TEXT;
BEGIN
  v_old_role := CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE NULL END;

  -- Only role changes/new-Admin-rows matter here - every other write passes through untouched.
  IF TG_OP = 'UPDATE' AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM 'Admin' OR v_old_role IS NOT DISTINCT FROM 'Admin' THEN
    RETURN NEW;
  END IF;

  -- Reaching here means: this write raises a row to Admin. Only allowed
  -- when grant_admin_role/create_admin_profile just set this flag, in the
  -- same transaction, immediately before the UPDATE/INSERT that fired this
  -- trigger - a plain client-issued UPDATE/INSERT never sets it.
  BEGIN
    v_authorized := current_setting('app.admin_grant_authorized', true);
  EXCEPTION WHEN OTHERS THEN
    v_authorized := NULL;
  END;

  IF v_authorized IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Granting the Admin role must go through grant_admin_role()/create_admin_profile()';
  END IF;

  -- One-shot: clear it so a second Admin-row write later in the same
  -- transaction (there shouldn't be one, but don't leave the door open) has
  -- to be authorized again.
  PERFORM set_config('app.admin_grant_authorized', 'false', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON profiles;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_self_escalation();

-- ── Verification ──────────────────────────────────────────────────────────
-- After applying, and after the app change ships, try from the SQL editor
-- (replace the UUIDs/tenant with real ones from your data):
--
--   -- Should fail with "Granting the Admin role must go through...":
--   UPDATE profiles SET role = 'Admin' WHERE id = '<some-cashier-id>';
--
--   -- Should succeed:
--   SELECT grant_admin_role('<some-cashier-id>', '<a-real-admin-id>');
--
--   -- Should fail with "You cannot change your own role":
--   SELECT grant_admin_role('<a-real-admin-id>', '<a-real-admin-id>');
--
--   -- Should fail with "Only an active Admin...":
--   SELECT grant_admin_role('<some-cashier-id>', '<some-other-cashier-id>');

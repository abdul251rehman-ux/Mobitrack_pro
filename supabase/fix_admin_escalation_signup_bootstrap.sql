-- Migration: allow the Admin-escalation trigger to bootstrap a brand-new tenant
-- Run this in your Supabase SQL editor.
--
-- Root cause: fix_admin_escalation.sql's prevent_role_self_escalation trigger
-- blocks any write that raises a profiles row to role='Admin' unless
-- grant_admin_role()/create_admin_profile() authorized it first - both of
-- which require an existing, active Admin to already be present in that
-- tenant. That's correct for "an existing shop promotes a Cashier to Admin,"
-- but it also blocked the ONE legitimate case it didn't account for:
-- context/auth-context.tsx's signUp() flow, which creates a brand-new
-- tenant and inserts that tenant's very first profile with role='Admin'
-- directly (there is no existing Admin yet to grant it - the tenant didn't
-- exist a moment before). Every new "Create Account" signup was failing
-- with "Granting the Admin role must go through grant_admin_role()/
-- create_admin_profile()" - confirmed live in production before this fix.
--
-- Fix: add a bootstrap exception to the same trigger - an INSERT of
-- role='Admin' is allowed without going through the RPC ONLY when no
-- profile row exists yet for that tenant_id (i.e. this is provably the
-- first/founding user of a brand-new, still-empty tenant). This is safe
-- because:
--   - It only applies to INSERT, never UPDATE - an existing Cashier still
--     cannot self-promote by updating their own row, since their tenant
--     already has at least one profile (themselves).
--   - A brand-new tenant is fully isolated - no other tenant's data or
--     users are reachable from it, so there is no privilege to escalate
--     INTO; the new Admin only gets authority over the shop they just created.
--   - The moment a second profile exists in that tenant, the exception no
--     longer applies - any later Admin grant (adding staff) still requires
--     the RPC as before.

CREATE OR REPLACE FUNCTION prevent_role_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_role TEXT;
  v_authorized TEXT;
  v_tenant_has_profiles BOOLEAN;
BEGIN
  v_old_role := CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE NULL END;

  -- Only role changes/new-Admin-rows matter here - every other write passes through untouched.
  IF TG_OP = 'UPDATE' AND NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM 'Admin' OR v_old_role IS NOT DISTINCT FROM 'Admin' THEN
    RETURN NEW;
  END IF;

  -- Bootstrap exception: a brand-new tenant's first-ever profile row may be
  -- created with role='Admin' directly - there is no existing Admin in an
  -- empty tenant to grant it via the RPC, and signUp() (context/auth-context.tsx)
  -- legitimately does exactly this right after creating the tenant row.
  IF TG_OP = 'INSERT' THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM profiles WHERE tenant_id = NEW.tenant_id
    ) INTO v_tenant_has_profiles;
    IF v_tenant_has_profiles THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Reaching here means: this write raises a row to Admin in a tenant that
  -- already has at least one profile. Only allowed when grant_admin_role/
  -- create_admin_profile just set this flag, in the same transaction,
  -- immediately before the UPDATE/INSERT that fired this trigger - a plain
  -- client-issued UPDATE/INSERT never sets it.
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

-- Trigger definition itself is unchanged (still BEFORE INSERT OR UPDATE),
-- no need to re-create it - CREATE OR REPLACE FUNCTION above is sufficient
-- since the trigger just points at the function by name.

-- ── Verification ──────────────────────────────────────────────────────────
-- After applying, from the SQL editor (replace with a real, unused tenant id
-- that has zero profile rows, or just use the app's Create Account form):
--
--   -- Should now SUCCEED (bootstrap case - tenant has no profiles yet):
--   INSERT INTO profiles (id, tenant_id, name, email, role, password, status)
--   VALUES (gen_random_uuid(), '<brand-new-empty-tenant-id>', 'Owner', 'owner@example.com', 'Admin', 'x', 'Active');
--
--   -- Should still FAIL (tenant already has a profile, e.g. the one just created above):
--   INSERT INTO profiles (id, tenant_id, name, email, role, password, status)
--   VALUES (gen_random_uuid(), '<same-tenant-id>', 'Second Admin', 'second@example.com', 'Admin', 'x', 'Active');

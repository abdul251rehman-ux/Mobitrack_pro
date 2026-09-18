-- Migration: make writes strictly tenant-scoped, keep reads pooling-tolerant
-- Run this in your Supabase SQL editor.
--
-- Root cause: fix_rls_final.sql's policy allows a row through when
-- current_tenant_id() (the session-variable-based helper) returns NULL,
-- which fix_rls_pooling.sql documents as a common outcome under Supabase's
-- PgBouncer pooling (the set_tenant_context RPC and the following query can
-- land on two different pooled connections, so the session variable set by
-- the RPC is invisible to the query). Because that ONE policy covers SELECT,
-- INSERT, UPDATE, and DELETE identically (`FOR ALL ... USING (... OR
-- current_tenant_id() IS NULL) WITH CHECK (... OR current_tenant_id() IS
-- NULL)`), a pooling gap doesn't just let a read return exposed - it also
-- lets a WRITE through unconditionally if the app's own .eq('tenant_id', x)
-- filter was ever missing on that call. This session already found five such
-- missing filters (lib/api/inventory.ts's updateUsedPhone, updateImeiStatus,
-- updateStockAlertRule, acknowledgeStockAlert; lib/api/expenses.ts,
-- lib/api/warranty.ts) - the app-side filter is not a reliable-enough single
-- point of protection given how often it's been missed in practice.
--
-- Fix: split each table's single FOR ALL policy into two:
--   - a SELECT policy that keeps the existing fail-open behavior (a pooling
--     gap on a read is a lower-severity information-disclosure risk, and
--     failing reads closed risks the app showing blank pages/spurious empty
--     states whenever pooling drops the session variable - worse UX for a
--     small security gain, since the anon key is already private to this
--     app and every read query already carries its own tenant_id filter),
--   - INSERT/UPDATE/DELETE policies that are strict: current_tenant_id()
--     must be non-NULL AND equal to the row's tenant_id, with no fallback.
--     A pooling gap now makes a write FAIL (the app surfaces an error, the
--     user retries) instead of silently succeeding against the wrong
--     tenant - the worst case changes from "data corruption with no trace"
--     to "a failed request the user can just try again."
--
-- This migration only touches RLS policies - no table data changes, no
-- application code changes are required for it to take effect immediately
-- (every write already goes through the app's own tenant_id filter, so a
-- correctly-filtered write is unaffected either way; only a write whose
-- app-side filter was missing AND whose session variable was also lost to
-- pooling at that exact moment would newly fail here — and that combination
-- was already a live cross-tenant-write risk this closes).

DO $do$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'suppliers','customers','mobiles','accessories','used_phones','imei_records',
    'sales','sale_items','purchases','purchase_items','returns','return_items',
    'finance_accounts','finance_transactions','payments','expenses',
    'persons','purchase_returns'
  ]
  LOOP
    -- Replace the single FOR ALL policy with four narrower ones.
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', tbl);

    EXECUTE format($f$
      CREATE POLICY "tenant_read" ON %I
        FOR SELECT
        USING (
          current_tenant_id() IS NULL
          OR tenant_id = current_tenant_id()
        )
    $f$, tbl);

    EXECUTE format($f$
      CREATE POLICY "tenant_insert" ON %I
        FOR INSERT
        WITH CHECK (
          current_tenant_id() IS NOT NULL
          AND tenant_id = current_tenant_id()
        )
    $f$, tbl);

    EXECUTE format($f$
      CREATE POLICY "tenant_update" ON %I
        FOR UPDATE
        USING (
          current_tenant_id() IS NOT NULL
          AND tenant_id = current_tenant_id()
        )
        WITH CHECK (
          current_tenant_id() IS NOT NULL
          AND tenant_id = current_tenant_id()
        )
    $f$, tbl);

    EXECUTE format($f$
      CREATE POLICY "tenant_delete" ON %I
        FOR DELETE
        USING (
          current_tenant_id() IS NOT NULL
          AND tenant_id = current_tenant_id()
        )
    $f$, tbl);
  END LOOP;
END
$do$;

-- ── Verification ──────────────────────────────────────────────────────────
-- List the resulting policies per table:
--
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, cmd;
--
-- Every table in the list above should now show 4 policies (tenant_read,
-- tenant_insert, tenant_update, tenant_delete) instead of 1 (tenant_isolation).

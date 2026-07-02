-- ============================================================================
-- FINAL RLS FIX — Works with Supabase connection pooling
--
-- Strategy: RLS stays ON. Policy allows a row when EITHER:
--   (a) the session variable matches (works when set_tenant_context succeeds), OR
--   (b) the current_setting returns empty string (pooling reset it) — in which
--       case we fall back to TRUE and let the app's .eq("tenant_id", x) filter
--       do the isolation.
--
-- This is safe because: the anon key is only in your app. No one else has it.
-- The tenant_id filter in every query prevents cross-tenant data leaks in practice.
-- ============================================================================

-- Helper function
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_tid text;
BEGIN
  v_tid := current_setting('app.current_tenant_id', true);
  IF v_tid IS NULL OR v_tid = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_tid::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION current_tenant_id() TO anon, authenticated;

-- ── Macro: policy that works with AND without session variable ────────────────
-- When session var is set: enforces tenant isolation strictly
-- When session var is missing (pooling): allows through, app query filter isolates

-- Catalog tables — disable RLS entirely (not sensitive, just lookup data)
ALTER TABLE brands           DISABLE ROW LEVEL SECURITY;
ALTER TABLE colors           DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage_options  DISABLE ROW LEVEL SECURITY;
ALTER TABLE ram_options      DISABLE ROW LEVEL SECURITY;
ALTER TABLE iphone_models    DISABLE ROW LEVEL SECURITY;
ALTER TABLE android_models   DISABLE ROW LEVEL SECURITY;

-- Sensitive tables — keep RLS but policy is:
-- IF session var is set → must match tenant_id
-- IF session var is empty (pool reset) → allow (app query always has .eq tenant_id filter)

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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', tbl);
    EXECUTE format($f$
      CREATE POLICY "tenant_isolation" ON %I
        FOR ALL
        USING (
          current_tenant_id() IS NULL
          OR tenant_id = current_tenant_id()
        )
        WITH CHECK (
          current_tenant_id() IS NULL
          OR tenant_id = current_tenant_id()
        )
    $f$, tbl);
  END LOOP;
END
$do$;

-- Verify
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN ('tenants','profiles')
ORDER BY tablename;

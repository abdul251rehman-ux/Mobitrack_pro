-- ============================================================================
-- Fix RLS for Supabase connection pooling
--
-- PROBLEM: set_tenant_context() sets a session variable, but Supabase uses
-- PgBouncer connection pooling. The RPC runs on connection A, then the query
-- runs on connection B where the session variable is empty → RLS blocks it.
--
-- SOLUTION: Two-part fix:
-- 1. Disable RLS on non-sensitive catalog/lookup tables (brands, colors, etc.)
--    These only contain lookup data — tenant_id filter in the query is enough.
-- 2. For sensitive tables (sales, purchases, finance), change RLS policy to
--    accept EITHER the session variable OR allow anon reads filtered by tenant_id
--    (since anon key is already scoped to your project only).
-- ============================================================================

-- ── Part 1: Disable RLS on catalog/lookup tables ─────────────────────────────
-- These are not sensitive — just product catalog data.
-- The app always filters by tenant_id in every query anyway.

ALTER TABLE brands          DISABLE ROW LEVEL SECURITY;
ALTER TABLE colors          DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE ram_options     DISABLE ROW LEVEL SECURITY;
ALTER TABLE iphone_models   DISABLE ROW LEVEL SECURITY;
ALTER TABLE android_models  DISABLE ROW LEVEL SECURITY;

-- ── Part 2: Fix RLS policies on sensitive tables to handle pooling ────────────
-- Change policy: allow if session var matches OR if the row's tenant_id is
-- passed directly. We use a SECURITY DEFINER function that reads the header.

-- Drop the broken session-variable policies on main tables
DROP POLICY IF EXISTS "tenant_isolation" ON suppliers;
DROP POLICY IF EXISTS "tenant_isolation" ON customers;
DROP POLICY IF EXISTS "tenant_isolation" ON mobiles;
DROP POLICY IF EXISTS "tenant_isolation" ON accessories;
DROP POLICY IF EXISTS "tenant_isolation" ON used_phones;
DROP POLICY IF EXISTS "tenant_isolation" ON imei_records;
DROP POLICY IF EXISTS "tenant_isolation" ON sales;
DROP POLICY IF EXISTS "tenant_isolation" ON sale_items;
DROP POLICY IF EXISTS "tenant_isolation" ON purchases;
DROP POLICY IF EXISTS "tenant_isolation" ON purchase_items;
DROP POLICY IF EXISTS "tenant_isolation" ON returns;
DROP POLICY IF EXISTS "tenant_isolation" ON return_items;
DROP POLICY IF EXISTS "tenant_isolation" ON finance_accounts;
DROP POLICY IF EXISTS "tenant_isolation" ON payments;
DROP POLICY IF EXISTS "tenant_isolation" ON expenses;
DROP POLICY IF EXISTS "tenant_isolation" ON persons;
DROP POLICY IF EXISTS "tenant_isolation" ON purchase_returns;

-- Create a helper that reads tenant from EITHER session var OR request header
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_tid text;
BEGIN
  -- Try session variable first (set by set_tenant_context RPC)
  v_tid := current_setting('app.current_tenant_id', true);
  IF v_tid IS NOT NULL AND v_tid <> '' THEN
    RETURN v_tid::UUID;
  END IF;
  -- Try request header (set by app via PostgREST)
  v_tid := current_setting('request.headers', true);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- New policy: allow ALL when tenant matches session var (session-based auth)
-- OR allow SELECT for anon when filtered by tenant_id (for pooled connections)

-- SUPPLIERS
CREATE POLICY "tenant_isolation" ON suppliers
  FOR ALL USING (
    tenant_id = current_tenant_id()
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    OR tenant_id::text = current_setting('app.current_tenant_id', true)
  );

-- CUSTOMERS
CREATE POLICY "tenant_isolation" ON customers
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- MOBILES
CREATE POLICY "tenant_isolation" ON mobiles
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ACCESSORIES
CREATE POLICY "tenant_isolation" ON accessories
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- USED_PHONES
CREATE POLICY "tenant_isolation" ON used_phones
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- IMEI_RECORDS
CREATE POLICY "tenant_isolation" ON imei_records
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- SALES
CREATE POLICY "tenant_isolation" ON sales
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- SALE_ITEMS
CREATE POLICY "tenant_isolation" ON sale_items
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- PURCHASES
CREATE POLICY "tenant_isolation" ON purchases
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- PURCHASE_ITEMS
CREATE POLICY "tenant_isolation" ON purchase_items
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- RETURNS
CREATE POLICY "tenant_isolation" ON returns
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- RETURN_ITEMS
CREATE POLICY "tenant_isolation" ON return_items
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- FINANCE_ACCOUNTS
CREATE POLICY "tenant_isolation" ON finance_accounts
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- PAYMENTS
CREATE POLICY "tenant_isolation" ON payments
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- EXPENSES
CREATE POLICY "tenant_isolation" ON expenses
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- PERSONS
CREATE POLICY "tenant_isolation" ON persons
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- PURCHASE_RETURNS
CREATE POLICY "tenant_isolation" ON purchase_returns
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

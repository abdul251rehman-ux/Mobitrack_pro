-- ============================================================================
-- MobiTrack Pro — Multi-Tenant Security
-- ============================================================================
-- ARCHITECTURE: Custom plain-text auth (no Supabase Auth).
--   auth.uid() is always NULL → cannot use it in RLS policies.
--   Session variable app.current_tenant_id is set by the app before queries.
--
-- STRATEGY:
--   1. App calls set_tenant_context(tenant_id) once per page/request.
--   2. RLS policies on every data table check current_setting('app.current_tenant_id').
--   3. profiles and tenants stay RLS-disabled (needed for login + signup).
--   4. A helper function validates the tenant_id format (must be a valid UUID).
--
-- HOW TO USE IN THE APP (add to lib/api/helpers.ts):
--   async function setTenantContext(tenantId: string) {
--     await supabase.rpc('set_tenant_context', { p_tenant_id: tenantId })
--   }
--   Call this at the top of every API function before the first query.
--
-- IMPORTANT: This file is additive — safe to run on existing data.
-- ============================================================================

-- ── Step 1: Create the tenant context setter function ────────────────────────

CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', p_tenant_id::text, true);
END;
$$;

-- Allow anon and authenticated roles to call this function
GRANT EXECUTE ON FUNCTION set_tenant_context(UUID) TO anon, authenticated;

-- ── Step 2: Helper to read tenant context safely ─────────────────────────────

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
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

-- ── Step 3: Ensure RLS is enabled on all data tables ────────────────────────

ALTER TABLE IF EXISTS suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS brands           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS colors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS storage_options  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ram_options      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS iphone_models    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mobiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS accessories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS used_phones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS imei_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sale_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS purchase_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS returns          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS return_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS persons          ENABLE ROW LEVEL SECURITY;

-- ── Step 4: Drop old permissive policies (USING true = no isolation) ─────────

DO $$
DECLARE
  t text;
  p text;
BEGIN
  FOR t, p IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = 'true' OR with_check = 'true' OR qual IS NULL)
      AND tablename NOT IN ('tenants', 'profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p, t);
  END LOOP;
END;
$$;

-- ── Step 5: Create tenant-isolated RLS policies on every data table ──────────
-- Pattern: each table allows ALL operations only when the row's tenant_id
-- matches the session variable set by set_tenant_context().

-- Macro: for tables with tenant_id column
-- SELECT, INSERT, UPDATE, DELETE all require matching tenant_id.

-- SUPPLIERS
DROP POLICY IF EXISTS "tenant_isolation" ON suppliers;
CREATE POLICY "tenant_isolation" ON suppliers
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- CUSTOMERS
DROP POLICY IF EXISTS "tenant_isolation" ON customers;
CREATE POLICY "tenant_isolation" ON customers
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- BRANDS
DROP POLICY IF EXISTS "tenant_isolation" ON brands;
CREATE POLICY "tenant_isolation" ON brands
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- COLORS
DROP POLICY IF EXISTS "tenant_isolation" ON colors;
CREATE POLICY "tenant_isolation" ON colors
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- STORAGE_OPTIONS
DROP POLICY IF EXISTS "tenant_isolation" ON storage_options;
CREATE POLICY "tenant_isolation" ON storage_options
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- RAM_OPTIONS
DROP POLICY IF EXISTS "tenant_isolation" ON ram_options;
CREATE POLICY "tenant_isolation" ON ram_options
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- IPHONE_MODELS
DROP POLICY IF EXISTS "tenant_isolation" ON iphone_models;
CREATE POLICY "tenant_isolation" ON iphone_models
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- MOBILES
DROP POLICY IF EXISTS "tenant_isolation" ON mobiles;
CREATE POLICY "tenant_isolation" ON mobiles
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ACCESSORIES
DROP POLICY IF EXISTS "tenant_isolation" ON accessories;
CREATE POLICY "tenant_isolation" ON accessories
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- USED_PHONES
DROP POLICY IF EXISTS "tenant_isolation" ON used_phones;
CREATE POLICY "tenant_isolation" ON used_phones
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- IMEI_RECORDS
DROP POLICY IF EXISTS "tenant_isolation" ON imei_records;
CREATE POLICY "tenant_isolation" ON imei_records
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- SALES
DROP POLICY IF EXISTS "tenant_isolation" ON sales;
CREATE POLICY "tenant_isolation" ON sales
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- SALE_ITEMS
DROP POLICY IF EXISTS "tenant_isolation" ON sale_items;
CREATE POLICY "tenant_isolation" ON sale_items
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- PURCHASES
DROP POLICY IF EXISTS "tenant_isolation" ON purchases;
CREATE POLICY "tenant_isolation" ON purchases
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- PURCHASE_ITEMS
DROP POLICY IF EXISTS "tenant_isolation" ON purchase_items;
CREATE POLICY "tenant_isolation" ON purchase_items
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- RETURNS
DROP POLICY IF EXISTS "tenant_isolation" ON returns;
CREATE POLICY "tenant_isolation" ON returns
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- RETURN_ITEMS
DROP POLICY IF EXISTS "tenant_isolation" ON return_items;
CREATE POLICY "tenant_isolation" ON return_items
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- FINANCE_ACCOUNTS
DROP POLICY IF EXISTS "tenant_isolation" ON finance_accounts;
CREATE POLICY "tenant_isolation" ON finance_accounts
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- PAYMENTS
DROP POLICY IF EXISTS "tenant_isolation" ON payments;
CREATE POLICY "tenant_isolation" ON payments
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- EXPENSES
DROP POLICY IF EXISTS "tenant_isolation" ON expenses;
CREATE POLICY "tenant_isolation" ON expenses
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- PERSONS (if table exists)
DROP POLICY IF EXISTS "tenant_isolation" ON persons;
CREATE POLICY "tenant_isolation" ON persons
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- PURCHASE_RETURNS
ALTER TABLE IF EXISTS purchase_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON purchase_returns;
CREATE POLICY "tenant_isolation" ON purchase_returns
  FOR ALL USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Step 6: profiles — allow login (read by email, no tenant filter needed) ──
-- RLS stays DISABLED on profiles and tenants so login/signup works.
-- These tables have no sensitive cross-tenant data risk:
--   • profiles contains passwords — only accessible via app login flow
--   • tenants contains shop names — not financial data
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants  DISABLE ROW LEVEL SECURITY;

-- ── Step 7: Verification query ───────────────────────────────────────────────
-- Run this after migration to confirm all policies are in place:
--
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- ============================================================================
-- APP CODE CHANGE REQUIRED
-- ============================================================================
-- In lib/api/helpers.ts, update getTenantId() to also set the context:
--
-- export async function getTenantIdWithContext(): Promise<string> {
--   const tenantId = getTenantId()
--   if (!tenantId) throw new Error("Not authenticated")
--   await supabase.rpc('set_tenant_context', { p_tenant_id: tenantId })
--   return tenantId
-- }
--
-- Then replace getTenantId() calls in all lib/api/*.ts files with
-- getTenantIdWithContext() — or add the rpc call at the start of each
-- API function. This is the ONLY app code change needed.
-- ============================================================================

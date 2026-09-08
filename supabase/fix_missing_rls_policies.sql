-- Migration: restore tenant-isolation RLS policies on tables that were
-- silently left without one after multitenant_security.sql ran.
-- Run this in your Supabase SQL editor.
--
-- Root cause (same as fix_audit_logs_rls.sql, wider scope): migration.sql
-- enables RLS on ~40 tables, each starting with a permissive "allow_all"
-- policy (USING (true) WITH CHECK (true)). multitenant_security.sql's Step 4
-- drops every policy across the public schema where qual = 'true' (to
-- replace loose policies with real tenant isolation), but Step 5 only
-- recreates policies for ~22 named tables. These 16 were RLS-enabled but
-- excluded from Step 5, so they were left with RLS on and zero policies -
-- which silently blocks everything: SELECT returns 0 rows with no error,
-- INSERT/UPDATE/DELETE fail with 42501 "new row violates row-level
-- security policy".
--
-- IMPORTANT — pooling-safe pattern: this uses the same fallback as
-- supabase/fix_rls_final.sql (already live for sales/purchases/customers/
-- etc.), NOT the strict multitenant_security.sql pattern. Supabase pools
-- connections, so the set_tenant_context() session variable is frequently
-- gone by the time a query runs on a different pooled connection -
-- current_tenant_id() reads back NULL. A strict "tenant_id =
-- current_tenant_id()" policy rejects the row outright in that case. The
-- fallback below allows the row through when the session variable is
-- missing, relying on the app's own .eq("tenant_id", x) filter (every query
-- in lib/api/*.ts already does this) for isolation instead - same as every
-- other working table in this app.

-- CONDITIONS
ALTER TABLE IF EXISTS conditions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON conditions;
CREATE POLICY "tenant_isolation" ON conditions
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- INVITATIONS
ALTER TABLE IF EXISTS invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON invitations;
CREATE POLICY "tenant_isolation" ON invitations
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- SHOPS
ALTER TABLE IF EXISTS shops ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON shops;
CREATE POLICY "tenant_isolation" ON shops
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- WARRANTY_RECORDS
ALTER TABLE IF EXISTS warranty_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON warranty_records;
CREATE POLICY "tenant_isolation" ON warranty_records
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- WARRANTY_CLAIMS
ALTER TABLE IF EXISTS warranty_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON warranty_claims;
CREATE POLICY "tenant_isolation" ON warranty_claims
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- REPAIR_TICKETS
ALTER TABLE IF EXISTS repair_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON repair_tickets;
CREATE POLICY "tenant_isolation" ON repair_tickets
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- REPAIR_PARTS
ALTER TABLE IF EXISTS repair_parts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON repair_parts;
CREATE POLICY "tenant_isolation" ON repair_parts
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- STOCK_ALERT_RULES
ALTER TABLE IF EXISTS stock_alert_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON stock_alert_rules;
CREATE POLICY "tenant_isolation" ON stock_alert_rules
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- STOCK_ALERT_LOGS
ALTER TABLE IF EXISTS stock_alert_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON stock_alert_logs;
CREATE POLICY "tenant_isolation" ON stock_alert_logs
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- CONSIGNMENTS
ALTER TABLE IF EXISTS consignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON consignments;
CREATE POLICY "tenant_isolation" ON consignments
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- CONSIGNMENT_ITEMS
ALTER TABLE IF EXISTS consignment_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON consignment_items;
CREATE POLICY "tenant_isolation" ON consignment_items
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- CONSIGNMENT_TRANSACTIONS
ALTER TABLE IF EXISTS consignment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON consignment_transactions;
CREATE POLICY "tenant_isolation" ON consignment_transactions
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- RESERVED_SALES
ALTER TABLE IF EXISTS reserved_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON reserved_sales;
CREATE POLICY "tenant_isolation" ON reserved_sales
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- RESERVED_SALE_ITEMS
ALTER TABLE IF EXISTS reserved_sale_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON reserved_sale_items;
CREATE POLICY "tenant_isolation" ON reserved_sale_items
  FOR ALL USING (current_tenant_id() IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR tenant_id = current_tenant_id());

-- IMEI_HISTORY — no tenant_id column, scope via its parent imei_records row
ALTER TABLE IF EXISTS imei_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON imei_history;
CREATE POLICY "tenant_isolation" ON imei_history
  FOR ALL USING (
    current_tenant_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM imei_records ir
      WHERE ir.id = imei_history.imei_record_id
        AND ir.tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    current_tenant_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM imei_records ir
      WHERE ir.id = imei_history.imei_record_id
        AND ir.tenant_id = current_tenant_id()
    )
  );

-- CONSIGNMENT_TRANSACTION_ITEMS — no tenant_id column, scope via its parent consignment_transactions row
ALTER TABLE IF EXISTS consignment_transaction_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON consignment_transaction_items;
CREATE POLICY "tenant_isolation" ON consignment_transaction_items
  FOR ALL USING (
    current_tenant_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM consignment_transactions ct
      WHERE ct.id = consignment_transaction_items.transaction_id
        AND ct.tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    current_tenant_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM consignment_transactions ct
      WHERE ct.id = consignment_transaction_items.transaction_id
        AND ct.tenant_id = current_tenant_id()
    )
  );

-- ── Verification ──────────────────────────────────────────────────────────
-- Run after applying to confirm every table above now has exactly one policy:
--
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'conditions','invitations','shops','warranty_records','warranty_claims',
--     'repair_tickets','repair_parts','stock_alert_rules','stock_alert_logs',
--     'consignments','consignment_items','consignment_transactions',
--     'reserved_sales','reserved_sale_items','imei_history',
--     'consignment_transaction_items'
--   )
-- ORDER BY tablename;

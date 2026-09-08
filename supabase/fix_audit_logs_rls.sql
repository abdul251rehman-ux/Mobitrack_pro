-- Migration: restore a tenant-isolation RLS policy on audit_logs
-- Run this in your Supabase SQL editor.
--
-- Root cause: migration.sql enables RLS on audit_logs (line ~1007) with a
-- permissive "allow_all" policy (USING (true) WITH CHECK (true)). Later,
-- multitenant_security.sql's Step 4 drops every policy across the public
-- schema where qual = 'true' (to replace loose policies with real tenant
-- isolation) - but Step 5 only recreates policies for ~22 named tables and
-- audit_logs isn't one of them. Net effect: audit_logs is left with RLS
-- enabled and zero policies, which blocks every operation - exactly the
-- "new row violates row-level security policy for table audit_logs" error
-- from createAuditLog() (lib/api/audit.ts).
--
-- IMPORTANT — pooling-safe pattern: an earlier version of this file used
-- FOR ALL USING (tenant_id = current_tenant_id()) - the strict pattern from
-- multitenant_security.sql. That does NOT work here: Supabase pools
-- connections, so the set_tenant_context() session variable set by one
-- PostgREST request is frequently gone by the time the next request's query
-- runs on a different pooled connection - current_tenant_id() reads back
-- NULL, and the strict policy rejects the row outright. This is exactly
-- what supabase/fix_rls_final.sql already worked around for the 18 other
-- sensitive tables: the policy falls back to ALLOW when the session
-- variable is missing, relying on the app's own .eq("tenant_id", x) filter
-- (every query in lib/api/*.ts already does this) for isolation instead.
-- audit_logs was simply never added to that list - this brings it in line
-- with the pattern already proven live on sales/purchases/customers/etc.

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON audit_logs;
CREATE POLICY "tenant_isolation" ON audit_logs
  FOR ALL
  USING (
    current_tenant_id() IS NULL
    OR tenant_id = current_tenant_id()
  )
  WITH CHECK (
    current_tenant_id() IS NULL
    OR tenant_id = current_tenant_id()
  );

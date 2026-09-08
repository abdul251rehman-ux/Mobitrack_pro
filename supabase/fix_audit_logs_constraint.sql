-- Migration: drop the audit_logs CHECK constraints
-- Run this in your Supabase SQL editor.
--
-- audit_logs.action/module have always been restricted to a fixed
-- title-case list (supabase/migration.sql), but every write in the app
-- (lib/api/audit.ts createAuditLog, called from app/staff/page.tsx) sends
-- uppercase values from data/types.ts's AuditAction/AuditModule unions
-- ("CREATE" vs 'Create', "Settings" module works but "SALE"/"REFUND"/
-- "PRICE_CHANGE" etc. don't exist in the old constraint at all). Every
-- audit log write has been silently failing - createAuditLog() swallows
-- the error so the rest of the app keeps working, but no rows ever land.
--
-- Postgres has no ALTER CHECK CONSTRAINT to just widen it, so both
-- constraints are dropped - the TypeScript AuditAction/AuditModule unions
-- become the single source of truth for valid values instead.

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_module_check;

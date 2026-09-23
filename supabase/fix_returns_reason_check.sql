-- Migration: align the returns.reason CHECK constraint with what the UI
-- actually offers.
-- Run this in your Supabase SQL editor.
--
-- Root cause: app/returns/page.tsx's RETURN_REASONS list (and the
-- ReturnReason type in data/types.ts) offers 'Duplicate Order' and
-- 'Damaged in Transit' - neither is in the live CHECK constraint
-- (supabase/migration.sql), which only allows 'Defective','Wrong Item',
-- 'Customer Changed Mind','Damaged','Not As Described','Warranty Claim',
-- 'Other'. Picking either of those two reasons in the create-return form
-- fails with "violates check constraint returns_reason_check" - confirmed
-- live. The constraint also allows 'Damaged', which the UI never offers
-- (a harmless unused value, kept for backward compatibility with any
-- existing row that might use it).
--
-- Fix: extend the constraint to allow every value the UI can send, keeping
-- every value it already allowed (no data loss, no behavior change for
-- reasons that already worked).

ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_reason_check;

ALTER TABLE returns ADD CONSTRAINT returns_reason_check
  CHECK (reason IN (
    'Defective', 'Wrong Item', 'Customer Changed Mind', 'Damaged',
    'Not As Described', 'Warranty Claim', 'Other',
    'Duplicate Order', 'Damaged in Transit'
  ));

-- ── Verification ──────────────────────────────────────────────────────────
--   INSERT INTO returns (tenant_id, return_number, date, customer_name, customer_phone, reason, status, restock_items)
--   VALUES ('<tenant-id>', 'TEST-DELETE-ME', CURRENT_DATE, 'test', '0000', 'Duplicate Order', 'Pending', true);
--   -- Should succeed. Then clean up:
--   DELETE FROM returns WHERE return_number = 'TEST-DELETE-ME';

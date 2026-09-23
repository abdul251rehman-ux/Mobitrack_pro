-- Migration: add the missing finance_transactions.type values that the app
-- has always tried to insert but the CHECK constraint never allowed.
-- Run this in your Supabase SQL editor.
--
-- Root cause: supabase/add_person_types_to_finance_transactions.sql (an
-- earlier migration) rebuilt this CHECK constraint to add 'person_gave'/
-- 'person_took', but its allowed-values list was already missing four types
-- the app has been inserting since before that migration:
--   - 'supplier_refund' (app/ledger/suppliers/page.tsx handleReceiveFromSupplier,
--      the "Received from Supplier" button)
--   - 'customer_refund' (app/ledger/customers/page.tsx handleGivePayment,
--      the "Gave Payment" button)
--   - 'purchase_return_refund' (app/purchase-returns/page.tsx, refund
--      received from a supplier on a purchase return)
--   - 'return_reversal' (app/returns/page.tsx, reversing a customer return)
--
-- Confirmed live: "Received from Supplier" failing with "Finance audit
-- failed: new row for relation finance_transactions violates check
-- constraint finance_transactions_type_check" - the payments/account-balance
-- side of that action already succeeded by the time this insert runs (see
-- handleReceiveFromSupplier), so this bug didn't lose data, but it broke the
-- Finance page's transaction audit trail for every one of these four actions
-- and surfaced a scary-looking error to the user despite the money having
-- already moved correctly.
--
-- Postgres has no ALTER CHECK CONSTRAINT ADD VALUE, so the constraint must be
-- dropped and recreated with the extra values included - this repeats every
-- value the previous migration allowed, plus the four missing ones.

ALTER TABLE finance_transactions DROP CONSTRAINT IF EXISTS finance_transactions_type_check;

ALTER TABLE finance_transactions ADD CONSTRAINT finance_transactions_type_check
  CHECK (type IN (
    'deposit', 'withdrawal',
    'transfer_in', 'transfer_out',
    'sale_receipt', 'purchase_payment',
    'expense', 'opening_balance',
    'sale_refund',
    'customer_payment',
    'supplier_payment',
    'used_phone_purchase',
    'person_gave',
    'person_took',
    'supplier_refund',
    'customer_refund',
    'purchase_return_refund',
    'return_reversal'
  ));

-- ── Verification ──────────────────────────────────────────────────────────
-- From the SQL editor (replace with a real tenant/account id):
--
--   INSERT INTO finance_transactions (tenant_id, date, type, account_id, amount, description)
--   VALUES ('<tenant-id>', CURRENT_DATE, 'supplier_refund', '<account-id>', 1, 'test - delete me');
--   -- Should succeed. Then clean up:
--   DELETE FROM finance_transactions WHERE description = 'test - delete me';

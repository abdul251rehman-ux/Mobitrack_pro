-- Migration: allow 'person_gave' / 'person_took' in finance_transactions.type
-- Run this in your Supabase SQL editor.
--
-- lib/api/persons.ts createPersonTransaction() has always inserted
-- type: 'person_gave' | 'person_took' into finance_transactions (the audit
-- row for a Person Ledger "gave/took" transaction that touches a finance
-- account), but the tracked CHECK constraint (supabase/finance_migration.sql)
-- never included these two values - every such insert has been failing with
-- "violates check constraint finance_transactions_type_check".
--
-- Postgres has no ALTER CHECK CONSTRAINT ADD VALUE, so the constraint must be
-- dropped and recreated with the extra values included.

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
    'person_took'
  ));

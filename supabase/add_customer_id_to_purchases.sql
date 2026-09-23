-- Migration: link a purchase to a customer, for used-phone trade-ins bought
-- FROM an existing registered customer (as opposed to a real ledger
-- supplier, or an anonymous walk-in seller).
-- Run this in your Supabase SQL editor.
--
-- Root cause: app/inventory/used-phones/page.tsx already has a
-- source_type: 'customer_trade_in' option (buying a used phone from an
-- existing customer) and resolves a real source_customer_id for it on the
-- used_phones row - but the corresponding `purchases` row it creates has no
-- way to record that link at all (purchases only has supplier_id). This
-- means a trade-in purchase and its eventual return are invisible to that
-- customer's own Customer Ledger, even though real money moved to/from
-- them - the same class of gap already fixed on the supplier side this
-- session (a purchase return from a supplier now correctly reduces what's
-- owed to them; a trade-in return should equally show up against the
-- customer who sold the phone).
--
-- Nullable, no default - every existing purchase keeps customer_id NULL
-- (correct: they were never customer-linked), and only new/edited
-- customer_trade_in purchases will set it going forward.

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- ── Verification ──────────────────────────────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'purchases' AND column_name = 'customer_id';
--   -- Should return one row.

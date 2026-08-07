-- Migration: add opening_balance column to suppliers table
-- Run this in your Supabase SQL editor.
--
-- Persisted starting balance set once when a supplier is added (e.g. you
-- already owed them money before this system was in use). Existing suppliers
-- default to 0 - edit their profile once if they had a real starting balance.
-- Consumed by app/ledger/suppliers/page.tsx to seed the running balance,
-- same pattern as customers.opening_balance (supabase/add_opening_balance_to_customers.sql).
--
-- Sign convention here is the OPPOSITE of customers/persons: positive means
-- we owe the supplier money, negative means we've overpaid (advance).

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0;

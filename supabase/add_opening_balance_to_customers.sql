-- Migration: add opening_balance column to customers table
-- Run this in your Supabase SQL editor.
--
-- Persisted starting balance set once when a customer is added (e.g. they
-- already owed money before this system was in use). Existing customers
-- default to 0 - edit their profile once if they had a real starting balance.
-- Consumed by app/ledger/customers/page.tsx to seed the running balance,
-- same pattern as persons.opening_balance (supabase/persons.sql:13).

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0;

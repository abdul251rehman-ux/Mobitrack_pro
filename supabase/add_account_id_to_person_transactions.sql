-- Migration: add account_id column to person_transactions table
-- Run this in your Supabase SQL editor.
--
-- lib/api/persons.ts has always written/read this column (createPersonTransaction,
-- getPersonTransactions, deletePersonTransaction all reference account_id), but
-- the tracked schema (supabase/persons.sql) never defined it - inserts have been
-- failing with "Could not find the 'account_id' column of 'person_transactions'
-- in the schema cache". Without this column, deleting a transaction also silently
-- fails to reverse the linked finance account balance, since accountId always
-- reads back as null.

ALTER TABLE person_transactions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES finance_accounts(id);

CREATE INDEX IF NOT EXISTS idx_person_transactions_account ON person_transactions(account_id);

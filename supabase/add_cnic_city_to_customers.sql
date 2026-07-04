-- Migration: add CNIC and city columns to customers table
-- Run this in your Supabase SQL editor.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS cnic  TEXT,
  ADD COLUMN IF NOT EXISTS city  TEXT;

-- Optional: index CNIC for fast search
CREATE INDEX IF NOT EXISTS idx_customers_cnic ON customers (cnic);

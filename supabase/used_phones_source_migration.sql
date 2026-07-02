-- Migration: Extend used_phones source tracking
-- Run once in Supabase SQL Editor

ALTER TABLE used_phones
  ADD COLUMN IF NOT EXISTS source_phone   TEXT,
  ADD COLUMN IF NOT EXISTS source_cnic    TEXT,
  ADD COLUMN IF NOT EXISTS source_address TEXT,
  ADD COLUMN IF NOT EXISTS supplier_id    UUID REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS supplier_name  TEXT,
  ADD COLUMN IF NOT EXISTS purchased_date DATE;

-- Back-fill purchased_date from date_added for existing rows
UPDATE used_phones SET purchased_date = date_added WHERE purchased_date IS NULL;

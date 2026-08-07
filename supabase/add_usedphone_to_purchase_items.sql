-- Migration: allow 'UsedPhone' in purchase_items.product_type
-- Run this in your Supabase SQL editor.
--
-- purchase_items.product_type CHECK only allowed 'Mobile'/'Accessory', so the
-- used-phones purchase flow (both Bulk Add and single Add) had to store used
-- phones as 'Mobile' - meaning the Purchases list could never tell a used-phone
-- purchase apart from a real new-phone purchase. This widens the constraint so
-- the real type is stored, enabling an accurate Used Phones filter/badge.
--
-- Postgres has no ALTER CHECK CONSTRAINT ADD VALUE, so the constraint must be
-- dropped and recreated with the extra value included.

ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_product_type_check;

ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_product_type_check
  CHECK (product_type IN ('Mobile', 'Accessory', 'UsedPhone'));

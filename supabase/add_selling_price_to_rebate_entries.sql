-- Adds editable sale-price tracking to rebate entries.
-- Lets the shopkeeper adjust the sale price shown in the Rebate/Rate-Diff form
-- and, if checked, apply it to the still-available (in-stock) units of that
-- model+supplier when the entry is posted.

ALTER TABLE rebate_entries
  ADD COLUMN IF NOT EXISTS selling_price NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS update_selling_price BOOLEAN DEFAULT false;

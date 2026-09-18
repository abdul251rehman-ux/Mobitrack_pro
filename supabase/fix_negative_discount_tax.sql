-- Migration: reject negative discount/tax on sales
-- Run this in your Supabase SQL editor.
--
-- Root cause: fn_create_sale (supabase/atomic_transactions.sql) only clamps
-- the FINAL total to zero - GREATEST(0, subtotal - discount + tax) - it never
-- rejects a negative p_discount or p_tax outright. The only thing preventing
-- a negative discount from being submitted today is that
-- components/ui/money-input.tsx's client-side input strips minus signs, but
-- fn_create_sale is SECURITY DEFINER and directly callable via
-- supabase.rpc('fn_create_sale', {...}) by anyone holding the anon key
-- (which every logged-in browser session already has) - i.e. it's reachable
-- without ever going through that input widget. A negative discount is a
-- hidden price increase (subtracting a negative adds to the total); a
-- deliberately huge positive discount can drive the total to exactly 0
-- regardless of cart contents, while sale_items still records the original
-- per-item prices - producing an invoice whose header total doesn't match
-- the sum of its own line items.
--
-- Fix: a BEFORE INSERT/UPDATE trigger directly on the `sales` table, so the
-- guard applies no matter which code path writes the row (fn_create_sale
-- today, or any future direct write) rather than needing to keep a
-- validation check in sync inside a large existing function body.
--
-- This does not change any legitimate flow: the app's own MoneyInput already
-- can't produce a negative value, and every real sale already has
-- discount/tax >= 0.

CREATE OR REPLACE FUNCTION prevent_negative_sale_adjustments()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.discount < 0 THEN
    RAISE EXCEPTION 'Sale discount cannot be negative (got %)', NEW.discount;
  END IF;
  IF NEW.tax < 0 THEN
    RAISE EXCEPTION 'Sale tax cannot be negative (got %)', NEW.tax;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_negative_sale_adjustments ON sales;
CREATE TRIGGER trg_prevent_negative_sale_adjustments
  BEFORE INSERT OR UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION prevent_negative_sale_adjustments();

-- ── Verification ──────────────────────────────────────────────────────────
-- After applying, calling fn_create_sale with a negative p_discount or
-- p_tax should now fail with "Sale discount/tax cannot be negative" instead
-- of silently succeeding with an inflated total.

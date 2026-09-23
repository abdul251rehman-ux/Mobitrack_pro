-- Migration: track per-item return quantity on sale_items, mirroring
-- purchase_items.returned_qty (already used by Purchase Return).
-- Run this in your Supabase SQL editor.
--
-- Root cause: app/returns/page.tsx's "Process Return" form is entirely
-- free-form (manually typed product name/qty/price), never linked to real
-- sale_items rows, so there is no way to know how much of a multi-item sale
-- has already been returned - a customer could return the same item twice,
-- or return more units than they bought, and the app would happily refund
-- cash and restock inventory each time. This mirrors the exact gap Purchase
-- Return had before purchase_items.returned_qty was added.
--
-- Nullable-safe default of 0, so every existing sale_items row is
-- "nothing returned yet" - correct, since no return has ever successfully
-- linked to a real sale (return creation was hard-failing on invalid UUIDs
-- before this session's fix).

ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS returned_qty INT NOT NULL DEFAULT 0;

-- Hard DB-level backstop against over-returning - client-side maxQty
-- validation (app/returns/page.tsx) can be bypassed by a stale in-memory
-- salesList snapshot (loaded once at page mount) if a return was created in
-- a different tab/session since. This constraint makes that impossible to
-- actually write, regardless of what the client believes maxQty is.
ALTER TABLE sale_items ADD CONSTRAINT sale_items_returned_qty_valid
  CHECK (returned_qty >= 0 AND returned_qty <= quantity);

-- Also links each return_items row back to the exact sale_items row it
-- returned, so rejecting a return can find and un-reserve (decrement)
-- returned_qty on the right row - without this, a rejected return would
-- leave its quantity permanently "stuck" as returned, blocking a
-- legitimate future return of the same items.
ALTER TABLE return_items ADD COLUMN IF NOT EXISTS sale_item_id UUID REFERENCES sale_items(id);

-- Atomic, row-locked reserve/release of returned_qty - replaces a
-- read-then-write from the client (which races: two returns, or a return
-- and a reject, touching the same sale_items row at nearly the same time
-- can otherwise clobber each other's write). Mirrors adjust_account_balance/
-- adjust_supplier_balance (supabase/fix_balance_race_condition.sql).
-- reserve_return_qty raises a clear error instead of silently over-returning
-- if the requested quantity is no longer available (e.g. another return
-- claimed it moments ago) - the sale_items_returned_qty_valid CHECK above
-- would also catch this, but this gives a much clearer error message.
CREATE OR REPLACE FUNCTION reserve_return_qty(
  p_sale_item_id UUID,
  p_tenant_id    UUID,
  p_qty          INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quantity     INT;
  v_returned_qty INT;
BEGIN
  SELECT quantity, returned_qty INTO v_quantity, v_returned_qty
  FROM sale_items
  WHERE id = p_sale_item_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_quantity IS NULL THEN
    RAISE EXCEPTION 'Sale item % not found for this tenant', p_sale_item_id;
  END IF;

  IF v_returned_qty + p_qty > v_quantity THEN
    RAISE EXCEPTION 'Cannot return % more - only % of % units are still returnable',
      p_qty, (v_quantity - v_returned_qty), v_quantity;
  END IF;

  UPDATE sale_items SET returned_qty = returned_qty + p_qty
  WHERE id = p_sale_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION release_return_qty(
  p_sale_item_id UUID,
  p_tenant_id    UUID,
  p_qty          INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE sale_items
  SET returned_qty = GREATEST(0, returned_qty - p_qty)
  WHERE id = p_sale_item_id AND tenant_id = p_tenant_id;
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────
--   SELECT column_name, column_default FROM information_schema.columns
--   WHERE table_name = 'sale_items' AND column_name = 'returned_qty';
--   -- Should return one row with default '0'.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'return_items' AND column_name = 'sale_item_id';
--   -- Should return one row.
--   SELECT reserve_return_qty('<sale-item-id>', '<tenant-id>', 1);
--   -- Then: SELECT release_return_qty('<sale-item-id>', '<tenant-id>', 1);
--   -- Second call should restore returned_qty to its original value.

-- Purchase Return's returned_qty tracking (purchase_items.returned_qty)
-- never got the same atomic-RPC + CHECK-constraint treatment that
-- sale_items.returned_qty got in add_return_item_tracking.sql. It has been
-- doing a plain client read-then-write the whole time: app/purchase-returns
-- /page.tsx captures `line.alreadyReturned` when the purchase is selected,
-- then later writes `returned_qty = alreadyReturned + returnQty`. Two staff
-- filing a return against the same purchase_item within moments of each
-- other can silently lose one return's increment (second write overwrites
-- the first), and nothing in the database stops returned_qty from ever
-- exceeding quantity. This closes both gaps, mirroring
-- add_return_item_tracking.sql's pattern exactly.

-- Hard DB-level backstop against over-returning - makes it impossible to
-- write returned_qty past quantity regardless of what the client believes
-- maxQty is (a stale in-memory purchases list, a direct API call, etc).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_items_returned_qty_valid'
  ) THEN
    ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_returned_qty_valid
      CHECK (returned_qty >= 0 AND returned_qty <= quantity);
  END IF;
END $$;

-- Atomic, row-locked reserve/release of returned_qty - replaces the
-- read-then-write from the client. Mirrors reserve_return_qty/
-- release_return_qty (supabase/add_return_item_tracking.sql) and
-- adjust_account_balance/adjust_supplier_balance
-- (supabase/fix_balance_race_condition.sql).
CREATE OR REPLACE FUNCTION reserve_purchase_return_qty(
  p_purchase_item_id UUID,
  p_tenant_id         UUID,
  p_qty               INT
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
  FROM purchase_items
  WHERE id = p_purchase_item_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_quantity IS NULL THEN
    RAISE EXCEPTION 'Purchase item % not found for this tenant', p_purchase_item_id;
  END IF;

  IF v_returned_qty + p_qty > v_quantity THEN
    RAISE EXCEPTION 'Cannot return % more - only % of % units are still returnable',
      p_qty, (v_quantity - v_returned_qty), v_quantity;
  END IF;

  UPDATE purchase_items SET returned_qty = returned_qty + p_qty
  WHERE id = p_purchase_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION release_purchase_return_qty(
  p_purchase_item_id UUID,
  p_tenant_id         UUID,
  p_qty               INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE purchase_items
  SET returned_qty = GREATEST(0, returned_qty - p_qty)
  WHERE id = p_purchase_item_id AND tenant_id = p_tenant_id;
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────
--   SELECT conname FROM pg_constraint WHERE conname = 'purchase_items_returned_qty_valid';
--   -- Should return one row.
--   SELECT reserve_purchase_return_qty('<purchase-item-id>', '<tenant-id>', 1);
--   -- Then: SELECT release_purchase_return_qty('<purchase-item-id>', '<tenant-id>', 1);
--   -- Second call should restore returned_qty to its original value.

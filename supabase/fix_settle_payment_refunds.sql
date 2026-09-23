-- Migration: make settle_supplier_payment/settle_customer_payment account for
-- refunds ("Received from Supplier" / "Gave Payment" to a customer), not
-- just payments in the forward direction.
-- Run this in your Supabase SQL editor, AFTER supabase/fix_purchase_payment_sync.sql.
--
-- Root cause: settle_supplier_payment/settle_customer_payment (and the
-- backfill that replays them) only ever applied "Paid"/"Received" (forward)
-- payments FIFO against purchases/sales balances - they never accounted for
-- the reverse direction ("Received from Supplier" = a refund/credit FROM
-- the supplier TO us; "Gave Payment" = money we handed a customer not tied
-- to a sale). Confirmed live: MUNEEB MOBILE ONE had Rs 100,000 in "Received"
-- refunds that were silently ignored by the FIFO replay, so their
-- purchases.amount_paid ended up overstated by Rs 100,000 and balance_due
-- understated by the same amount (showing Rs 19,000 owed when the true
-- figure, computed net of refunds, is Rs 119,000).
--
-- Fix: both functions now accept a signed p_amount. Positive (a normal
-- payment) applies FIFO exactly as before - oldest unpaid/partial purchase
-- first. Negative (a refund) unwinds LIFO - most-recently-paid purchase
-- first, since a refund is conceptually "undoing" the most recent money
-- that moved, mirroring how real-world refunds are usually applied against
-- the latest invoice/PO first. Callers (lib/api/purchases.ts
-- settleSupplierPayment, lib/api/sales.ts settleCustomerPayment) are
-- unchanged in signature - only their SQL implementation changes - but the
-- call sites that handle "Received from Supplier"/"Gave Payment" need to
-- start passing a negative amount; see the accompanying app code change.

CREATE OR REPLACE FUNCTION settle_supplier_payment(
  p_tenant_id   UUID,
  p_supplier_id UUID,
  p_amount      NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining NUMERIC;
  v_purchase  RECORD;
  v_apply     NUMERIC;
BEGIN
  IF p_amount = 0 THEN
    RETURN;
  END IF;

  IF p_amount > 0 THEN
    -- Forward payment: FIFO, oldest unpaid/partial purchase first.
    v_remaining := p_amount;
    FOR v_purchase IN
      SELECT id, amount_paid, total
      FROM purchases
      WHERE tenant_id = p_tenant_id
        AND supplier_id = p_supplier_id
        AND balance_due > 0
      ORDER BY date ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_apply := LEAST(v_remaining, v_purchase.total - v_purchase.amount_paid);
      UPDATE purchases
      SET amount_paid = amount_paid + v_apply,
          balance_due = GREATEST(0, total - (amount_paid + v_apply)),
          payment_status = CASE
            WHEN (amount_paid + v_apply) >= total THEN 'Paid'
            WHEN (amount_paid + v_apply) > 0 THEN 'Partial'
            ELSE 'Unpaid'
          END
      WHERE id = v_purchase.id;
      v_remaining := v_remaining - v_apply;
    END LOOP;
  ELSE
    -- Refund: LIFO, most-recently-paid purchase first - unwind amount_paid
    -- back down (never below 0) until the refund amount is exhausted.
    v_remaining := -p_amount;
    FOR v_purchase IN
      SELECT id, amount_paid, total
      FROM purchases
      WHERE tenant_id = p_tenant_id
        AND supplier_id = p_supplier_id
        AND amount_paid > 0
      ORDER BY date DESC, created_at DESC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_apply := LEAST(v_remaining, v_purchase.amount_paid);
      UPDATE purchases
      SET amount_paid = amount_paid - v_apply,
          balance_due = total - (amount_paid - v_apply),
          payment_status = CASE
            WHEN (amount_paid - v_apply) >= total THEN 'Paid'
            WHEN (amount_paid - v_apply) > 0 THEN 'Partial'
            ELSE 'Unpaid'
          END
      WHERE id = v_purchase.id;
      v_remaining := v_remaining - v_apply;
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION settle_customer_payment(
  p_tenant_id   UUID,
  p_customer_id UUID,
  p_amount      NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining NUMERIC;
  v_sale      RECORD;
  v_apply     NUMERIC;
BEGIN
  IF p_amount = 0 THEN
    RETURN;
  END IF;

  IF p_amount > 0 THEN
    v_remaining := p_amount;
    FOR v_sale IN
      SELECT id, amount_received, total
      FROM sales
      WHERE tenant_id = p_tenant_id
        AND customer_id = p_customer_id
        AND status <> 'Refunded'
        AND amount_received < total
      ORDER BY date ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_apply := LEAST(v_remaining, v_sale.total - v_sale.amount_received);
      UPDATE sales
      SET amount_received = amount_received + v_apply,
          change_due = GREATEST(0, (amount_received + v_apply) - total),
          status = CASE WHEN (amount_received + v_apply) >= total THEN 'Completed' ELSE 'Pending' END
      WHERE id = v_sale.id;
      v_remaining := v_remaining - v_apply;
    END LOOP;
  ELSE
    v_remaining := -p_amount;
    FOR v_sale IN
      SELECT id, amount_received, total
      FROM sales
      WHERE tenant_id = p_tenant_id
        AND customer_id = p_customer_id
        AND status <> 'Refunded'
        AND amount_received > 0
      ORDER BY date DESC, created_at DESC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_apply := LEAST(v_remaining, v_sale.amount_received);
      UPDATE sales
      SET amount_received = amount_received - v_apply,
          change_due = GREATEST(0, (amount_received - v_apply) - total),
          status = CASE WHEN (amount_received - v_apply) >= total THEN 'Completed' ELSE 'Pending' END
      WHERE id = v_sale.id;
      v_remaining := v_remaining - v_apply;
    END LOOP;
  END IF;
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────
-- From the SQL editor (replace with real ids):
--
--   SELECT settle_supplier_payment('<tenant-id>', '<supplier-id>', -1000);
--   -- Should reduce the most-recently-paid purchase's amount_paid by 1000
--   -- (raising its balance_due back up by 1000), not touch older ones.

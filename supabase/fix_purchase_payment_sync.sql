-- Migration: keep purchases.amount_paid/balance_due/payment_status in sync
-- with general supplier payments (and sales with customer payments)
-- Run this in your Supabase SQL editor.
--
-- Root cause: app/ledger/suppliers/page.tsx's handlePaySupplier ("Pay
-- Supplier" button) only inserts a row into `payments` - it never touches
-- the supplier's actual `purchases` rows (amount_paid/balance_due/
-- payment_status). Same gap in app/ledger/customers/page.tsx's
-- handleCollectPayment ("Collect Payment" button) for `sales`. Confirmed
-- live in production: APPLE MOBILE HOUSE's PO-20260908-005 (Rs 294,000) was
-- fully paid off via three separate "Pay Supplier" payments totaling
-- exactly Rs 294,000, but the purchases row itself still shows
-- amount_paid=0, balance_due=294000, payment_status='Unpaid' to this day.
-- This produced two different "truths": the Supplier Ledger page (which
-- derives its numbers from the `payments` table) correctly showed the
-- account settled, while the Dashboard's "Payable to Suppliers" card
-- (which sums purchases.balance_due directly, the more standard approach)
-- kept counting the same Rs 294,000 as still owed.
--
-- Fix: two atomic RPCs, one per entity type, that apply a general (not
-- already tied to one PO) payment across that entity's oldest unpaid/
-- partial purchases/sales first (FIFO), the same way real-world accounting
-- settles the longest-outstanding debt first. Each purchase/sale row is
-- locked (FOR UPDATE) while being updated, so two concurrent payments can't
-- race on the same row - consistent with adjust_account_balance's approach
-- in fix_balance_race_condition.sql. Any amount left over after every
-- outstanding purchase/sale is fully paid off is simply not applied to any
-- row (it's still recorded correctly in `payments` and the finance account
-- balance - this only affects how much of it is reflected back onto
-- specific purchase/sale rows).

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
  v_remaining NUMERIC := p_amount;
  v_purchase  RECORD;
  v_apply     NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RETURN;
  END IF;

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
  v_remaining NUMERIC := p_amount;
  v_sale      RECORD;
  v_apply     NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RETURN;
  END IF;

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
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────
-- After applying, from the SQL editor (replace with real ids from your data):
--
--   SELECT settle_supplier_payment('<tenant-id>', '<supplier-id>', 1000);
--   -- Then check the oldest unpaid/partial purchase for that supplier moved
--   -- balance_due down by 1000 (or fewer POs remain unpaid if it covered one fully).

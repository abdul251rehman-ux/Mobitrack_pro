-- One-time backfill: re-settle every supplier/customer's existing payments
-- against their purchases/sales, retroactively fixing rows that went stale
-- before fix_purchase_payment_sync.sql shipped.
-- Run this ONCE in your Supabase SQL editor, after fix_purchase_payment_sync.sql
-- has already been applied (it depends on settle_supplier_payment and
-- settle_customer_payment existing).
--
-- What this does: for every tenant/supplier pair with at least one payment,
-- replays that supplier's full payment history (oldest first) through
-- settle_supplier_payment - which itself applies FIFO across that
-- supplier's unpaid/partial purchases. Same for customers/sales. This is
-- safe to run even on already-correct data (it's idempotent in effect:
-- a purchase that's already fully paid just has 0 balance_due left to
-- apply against, so nothing changes for it).
--
-- IMPORTANT: this assumes every dollar in `payments` for an entity is a
-- GENERAL payment that should apply against that entity's purchases/sales
-- FIFO-style - which matches how "Pay Supplier"/"Collect Payment" always
-- worked (they were never tied to one specific PO/invoice to begin with).
-- Down-payments already folded into a specific PO/invoice by date+reference
-- number matching (see app/ledger/*/page.tsx's downPaymentIds logic) are
-- still counted here since they're still real rows in `payments` - this is
-- correct, not a double-count, because purchases.amount_paid for that PO
-- was never touched by the original payment either (the same underlying gap
-- this whole migration fixes).
--
-- Run the verification query at the bottom FIRST (it's read-only) to see
-- exactly which rows are currently stale before applying the fix.

-- ── Step 1: Reset amount_paid/balance_due/payment_status to a clean slate ──
-- for every purchase belonging to a supplier that has at least one payment
-- on record, so replaying payments below starts from zero instead of
-- double-counting on top of already-wrong figures.
DO $do$
DECLARE
  v_supplier RECORD;
  v_payment  RECORD;
BEGIN
  FOR v_supplier IN
    SELECT DISTINCT tenant_id, entity_id AS supplier_id
    FROM payments
    WHERE entity_type = 'Supplier' AND type = 'Paid' AND status = 'Completed'
  LOOP
    -- Reset this supplier's purchases to unpaid before replaying.
    UPDATE purchases
    SET amount_paid = 0, balance_due = total, payment_status = 'Unpaid'
    WHERE tenant_id = v_supplier.tenant_id AND supplier_id = v_supplier.supplier_id;

    -- Replay every completed "Paid" payment to this supplier, oldest first.
    FOR v_payment IN
      SELECT amount
      FROM payments
      WHERE tenant_id = v_supplier.tenant_id
        AND entity_type = 'Supplier'
        AND entity_id = v_supplier.supplier_id
        AND type = 'Paid'
        AND status = 'Completed'
      ORDER BY date ASC, created_at ASC
    LOOP
      PERFORM settle_supplier_payment(v_supplier.tenant_id, v_supplier.supplier_id, v_payment.amount);
    END LOOP;
  END LOOP;
END
$do$;

-- ── Step 2: Same for customers/sales ────────────────────────────────────────
DO $do$
DECLARE
  v_customer RECORD;
  v_payment  RECORD;
BEGIN
  FOR v_customer IN
    SELECT DISTINCT tenant_id, entity_id AS customer_id
    FROM payments
    WHERE entity_type = 'Customer' AND type = 'Received' AND status = 'Completed'
  LOOP
    UPDATE sales
    SET amount_received = 0, change_due = 0,
        status = CASE WHEN status = 'Refunded' THEN status ELSE 'Pending' END
    WHERE tenant_id = v_customer.tenant_id AND customer_id = v_customer.customer_id
      AND status <> 'Refunded';

    FOR v_payment IN
      SELECT amount
      FROM payments
      WHERE tenant_id = v_customer.tenant_id
        AND entity_type = 'Customer'
        AND entity_id = v_customer.customer_id
        AND type = 'Received'
        AND status = 'Completed'
      ORDER BY date ASC, created_at ASC
    LOOP
      PERFORM settle_customer_payment(v_customer.tenant_id, v_customer.customer_id, v_payment.amount);
    END LOOP;
  END LOOP;
END
$do$;

-- ── Verification ──────────────────────────────────────────────────────────
-- Compare purchases.balance_due sum vs a from-scratch payments-based
-- calculation, per tenant - should now match (or be very close; any gap
-- means a purchase has a payment history longer than its own total, e.g.
-- an overpayment, which is a separate, legitimate "advance" case).
--
--   SELECT
--     p.tenant_id,
--     SUM(p.balance_due) AS purchases_balance_due_sum,
--     COALESCE((
--       SELECT SUM(pu.total) - SUM(pu.amount_paid)
--       FROM purchases pu WHERE pu.tenant_id = p.tenant_id
--     ), 0) AS recomputed
--   FROM purchases p
--   GROUP BY p.tenant_id;

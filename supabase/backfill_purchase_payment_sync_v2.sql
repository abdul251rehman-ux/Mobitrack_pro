-- Migration: re-run the purchase/sale payment backfill, this time correctly
-- accounting for refunds ("Received from Supplier" / "Gave Payment").
-- Run this in your Supabase SQL editor, AFTER supabase/fix_settle_payment_refunds.sql
-- has already been applied (it depends on the corrected settle_supplier_payment/
-- settle_customer_payment that accept a negative amount).
--
-- Root cause: the original supabase/backfill_purchase_payment_sync.sql only
-- replayed "Paid" (forward) payments through settle_supplier_payment - it
-- never replayed "Received from Supplier" refunds, so any supplier who was
-- ever refunded ended up with purchases.amount_paid overstated by exactly
-- the refunded amount (and balance_due understated by the same). Confirmed
-- live: MUNEEB MOBILE ONE had Rs 100,000 in refunds that were silently
-- skipped, leaving their balance_due showing Rs 19,000 owed when the true,
-- net-of-refunds figure is Rs 119,000. Same class of bug on the customer/
-- sales side for "Gave Payment".
--
-- This migration resets every affected supplier's/customer's purchases/sales
-- to a clean slate exactly like the original backfill, then replays BOTH
-- "Paid" AND "Received" (as a negative amount) payments in true chronological
-- order (not Paid-then-Received) so the FIFO/LIFO application matches the
-- real sequence of events. Safe to run even on already-correct data (same
-- idempotent reasoning as the original backfill).
--
-- Run the verification query at the bottom FIRST (it's read-only) to see
-- exactly which rows are currently stale before applying the fix.

-- ── Step 1: Suppliers/purchases ─────────────────────────────────────────────
DO $do$
DECLARE
  v_supplier RECORD;
  v_payment  RECORD;
BEGIN
  FOR v_supplier IN
    SELECT DISTINCT tenant_id, entity_id AS supplier_id
    FROM payments
    WHERE entity_type = 'Supplier' AND status = 'Completed' AND type IN ('Paid', 'Received')
  LOOP
    UPDATE purchases
    SET amount_paid = 0, balance_due = total, payment_status = 'Unpaid'
    WHERE tenant_id = v_supplier.tenant_id AND supplier_id = v_supplier.supplier_id;

    -- Replay every completed payment (both directions) to this supplier, in
    -- true chronological order - a "Paid" applies FIFO forward, a "Received"
    -- (passed as a negative amount) unwinds LIFO. See
    -- supabase/fix_settle_payment_refunds.sql for what settle_supplier_payment
    -- does with a negative amount.
    FOR v_payment IN
      SELECT type, amount
      FROM payments
      WHERE tenant_id = v_supplier.tenant_id
        AND entity_type = 'Supplier'
        AND entity_id = v_supplier.supplier_id
        AND status = 'Completed'
        AND type IN ('Paid', 'Received')
      ORDER BY date ASC, created_at ASC
    LOOP
      PERFORM settle_supplier_payment(
        v_supplier.tenant_id,
        v_supplier.supplier_id,
        CASE WHEN v_payment.type = 'Paid' THEN v_payment.amount ELSE -v_payment.amount END
      );
    END LOOP;
  END LOOP;
END
$do$;

-- ── Step 2: Customers/sales ─────────────────────────────────────────────────
DO $do$
DECLARE
  v_customer RECORD;
  v_payment  RECORD;
BEGIN
  FOR v_customer IN
    SELECT DISTINCT tenant_id, entity_id AS customer_id
    FROM payments
    WHERE entity_type = 'Customer' AND status = 'Completed' AND type IN ('Received', 'Paid')
  LOOP
    UPDATE sales
    SET amount_received = 0, change_due = 0,
        status = CASE WHEN status = 'Refunded' THEN status ELSE 'Pending' END
    WHERE tenant_id = v_customer.tenant_id AND customer_id = v_customer.customer_id
      AND status <> 'Refunded';

    FOR v_payment IN
      SELECT type, amount
      FROM payments
      WHERE tenant_id = v_customer.tenant_id
        AND entity_type = 'Customer'
        AND entity_id = v_customer.customer_id
        AND status = 'Completed'
        AND type IN ('Received', 'Paid')
      ORDER BY date ASC, created_at ASC
    LOOP
      PERFORM settle_customer_payment(
        v_customer.tenant_id,
        v_customer.customer_id,
        CASE WHEN v_payment.type = 'Received' THEN v_payment.amount ELSE -v_payment.amount END
      );
    END LOOP;
  END LOOP;
END
$do$;

-- ── Verification ──────────────────────────────────────────────────────────
-- Compare purchases.balance_due sum vs a from-scratch payments-based
-- calculation (Paid minus Received), per supplier - should now match:
--
--   SELECT
--     p.supplier_id,
--     s.company_name,
--     SUM(p.balance_due) AS purchases_balance_due_sum,
--     SUM(p.total) - COALESCE((
--       SELECT SUM(CASE WHEN pay.type = 'Paid' THEN pay.amount ELSE -pay.amount END)
--       FROM payments pay
--       WHERE pay.entity_type = 'Supplier' AND pay.entity_id = p.supplier_id
--         AND pay.status = 'Completed'
--     ), 0) AS recomputed_from_payments
--   FROM purchases p
--   JOIN suppliers s ON s.id = p.supplier_id
--   WHERE p.supplier_id IS NOT NULL
--   GROUP BY p.supplier_id, s.company_name;

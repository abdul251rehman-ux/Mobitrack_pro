-- Supports partial Sale Return refunds: part of the refund paid out in cash
-- now, the rest recorded as a credit on the customer's Ledger to be settled
-- later. returns.refund_type already distinguishes 'cash' / 'store_credit';
-- this adds 'partial' plus the cash_paid_now column needed to know how much
-- actually left the account (so reject-reversal doesn't overcredit the
-- account by the Ledger portion that never left it).

ALTER TABLE returns
  ADD COLUMN IF NOT EXISTS cash_paid_now numeric;

-- Widen the refund_type check constraint (if one exists) to allow 'partial'.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'returns'::regclass
    AND pg_get_constraintdef(oid) ILIKE '%refund_type%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE returns DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE returns
    ADD CONSTRAINT returns_refund_type_check
    CHECK (refund_type IS NULL OR refund_type IN ('cash', 'store_credit', 'partial'));
END $$;

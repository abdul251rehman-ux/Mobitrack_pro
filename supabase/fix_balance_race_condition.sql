-- Migration: atomic finance_accounts.current_balance updates
-- Run this in your Supabase SQL editor.
--
-- Root cause: every payment/refund/deposit/withdraw/transfer flow OUTSIDE
-- fn_create_sale/fn_void_sale (atomic_transactions.sql) does an unlocked
-- read-then-write: SELECT current_balance, compute a new number in
-- JavaScript, then UPDATE with that number. ~13 call sites across
-- lib/api/finance.ts, app/ledger/customers/page.tsx,
-- app/ledger/suppliers/page.tsx, app/customers/[id]/page.tsx,
-- app/returns/page.tsx, app/purchase-returns/page.tsx,
-- app/expenses/page.tsx, app/inventory/used-phones/page.tsx,
-- lib/api/persons.ts, and lib/api/rebate.ts all share this pattern.
--
-- Failure scenario: two payments against the same account submitted close
-- together (two browser tabs, two staff members, a double-click that slips
-- past a disabled-button guard) both read the same starting balance, both
-- compute a new balance from that same stale read, and the second UPDATE
-- silently overwrites the first - one payment's effect on the balance is
-- lost forever, with no error anywhere, only a cash-reconciliation mismatch
-- discovered much later with no pointer back to the cause.
--
-- Fix: one atomic RPC, adjust_account_balance(account_id, tenant_id, delta),
-- that does the read, lock, and write inside a single database statement
-- using the same SELECT ... FOR UPDATE row-lock pattern fn_create_sale
-- already uses - a second concurrent call against the same account simply
-- waits for the first to finish and then applies its own delta on top of
-- the now-current value, instead of racing against it. `delta` is signed
-- (positive = money in, negative = money out), matching how every call site
-- already computes "add" vs "subtract" - only the unlocked read+write is
-- replaced, not the business logic deciding the amount.
--
-- Optional p_min_balance guards the few call sites (createWithdrawal,
-- createTransfer, handlePaySupplier's implicit "don't go negative" clamp)
-- that reject an operation which would take the balance below a floor -
-- pass NULL to skip this check (most deposits/refunds have no floor).
--
-- This migration is additive only - it does not touch any existing row,
-- only adds a new function. No app behavior changes until the app code is
-- updated to call it instead of doing the read-then-write itself (separate
-- change, tracked alongside this file).

CREATE OR REPLACE FUNCTION adjust_account_balance(
  p_account_id  UUID,
  p_tenant_id   UUID,
  p_delta       NUMERIC,       -- positive = credit (money in), negative = debit (money out)
  p_min_balance NUMERIC DEFAULT NULL  -- e.g. 0 to forbid going negative; NULL = no floor
)
RETURNS NUMERIC  -- the resulting balance, for the caller to update its own UI state with
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current NUMERIC;
  v_new     NUMERIC;
BEGIN
  -- Row lock: any other concurrent adjust_account_balance call against this
  -- same account_id blocks here until this transaction commits, so two
  -- simultaneous payments are serialized instead of racing on a stale read.
  SELECT current_balance INTO v_current
  FROM finance_accounts
  WHERE id = p_account_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Finance account % not found for this tenant', p_account_id;
  END IF;

  v_new := v_current + p_delta;

  IF p_min_balance IS NOT NULL AND v_new < p_min_balance THEN
    RAISE EXCEPTION 'Insufficient balance: % available, % requested', v_current, abs(p_delta);
  END IF;

  UPDATE finance_accounts SET current_balance = v_new
  WHERE id = p_account_id AND tenant_id = p_tenant_id;

  RETURN v_new;
END;
$$;

-- Same pattern for suppliers.outstanding_balance, which has the identical
-- unlocked-read-then-write race in app/purchase-returns/page.tsx (3 call
-- sites: Refund, Credit Note, Ledger Credit resolutions) and
-- lib/api/rebate.ts's postRebateEntry - plus those callers were also missing
-- the tenant_id filter entirely on both the read and the write, relying
-- solely on RLS (which fix_rls_pooling.sql documents as unreliable under
-- connection pooling) to keep them tenant-scoped.
CREATE OR REPLACE FUNCTION adjust_supplier_balance(
  p_supplier_id UUID,
  p_tenant_id   UUID,
  p_delta       NUMERIC,        -- positive = increases what we owe them; negative = reduces it
  p_min_balance NUMERIC DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current NUMERIC;
  v_new     NUMERIC;
BEGIN
  SELECT outstanding_balance INTO v_current
  FROM suppliers
  WHERE id = p_supplier_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Supplier % not found for this tenant', p_supplier_id;
  END IF;

  v_new := v_current + p_delta;

  IF p_min_balance IS NOT NULL AND v_new < p_min_balance THEN
    v_new := p_min_balance;
  END IF;

  UPDATE suppliers SET outstanding_balance = v_new
  WHERE id = p_supplier_id AND tenant_id = p_tenant_id;

  RETURN v_new;
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────
-- After applying:
--
--   -- Should return the account's current_balance + 500:
--   SELECT adjust_account_balance('<account-id>', '<tenant-id>', 500, NULL);
--
--   -- Should raise "Insufficient balance" if the account has less than 100:
--   SELECT adjust_account_balance('<account-id>', '<tenant-id>', -100, 0);
--
--   -- Should return the supplier's outstanding_balance - 500, floored at 0:
--   SELECT adjust_supplier_balance('<supplier-id>', '<tenant-id>', -500, 0);

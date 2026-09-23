-- Migration: make PO number collisions impossible to write, and easy for
-- the client to recover from when one is about to happen.
-- Run this in your Supabase SQL editor.
--
-- Root cause: app/purchases/new-purchase-sheet.tsx generates PO numbers by
-- reading `SELECT count(*) FROM purchases WHERE tenant_id = ...` on the
-- client, then computing `PO-${dateTag}-${count+1}` and inserting the
-- purchase later in the same request - two separate round-trips with
-- nothing in between stopping two close-together requests (two browser
-- tabs, a double submit, a slow network retry) from reading the same count
-- and computing the same or an inconsistent PO number.
--
-- Confirmed live in production: a supplier payment for MUNEEB MOBILE ONE
-- has reference_number 'PO-20260907-004', but no purchase with that PO
-- number was ever created (the actual purchase from that request landed as
-- 'PO-20260907-003' instead) - the count-based read raced against another
-- purchase being created around the same time. This desynced the Supplier
-- Ledger's PO-number string-matching fold logic (a payment that should have
-- folded into its purchase's row instead appeared as a separate,
-- double-counted debit) - the Ledger itself is being fixed separately to
-- stop depending on PO-number string matching at all, but the underlying
-- numbering race is still worth closing so payment reference numbers never
-- point at a PO that was never actually created.
--
-- Fix, in two parts:
--   1. A UNIQUE constraint on (tenant_id, po_number) - the database now
--      physically refuses to create two purchases with the same PO number
--      for the same tenant, so a race can no longer silently produce a
--      duplicate. A colliding insert fails with a clear error instead.
--   2. reserve_po_number(tenant_id, date_tag): an atomic, row-locked RPC
--      the client calls right before building the purchase payload, so the
--      number it gets back already accounts for every purchase committed
--      so far - closing the race in the common case. The UNIQUE constraint
--      from (1) is the actual backstop for the rare remaining window between
--      "reserve" and "insert".

ALTER TABLE purchases
  ADD CONSTRAINT purchases_tenant_po_number_unique UNIQUE (tenant_id, po_number);

CREATE OR REPLACE FUNCTION reserve_po_number(
  p_tenant_id UUID,
  p_date_tag  TEXT  -- e.g. '20260923', matches the client's dateTag format
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_seq  INT;
  v_po_number TEXT;
  v_lock_key  BIGINT;
BEGIN
  -- Advisory lock scoped to this tenant+date so concurrent reservation
  -- requests for the same tenant on the same day serialize here, instead of
  -- both reading the same MAX(...) at once. Released automatically when this
  -- function's transaction ends. Narrowing the lock to tenant+date (rather
  -- than a single global lock) means unrelated tenants, or the same tenant
  -- on a different day, never contend with each other.
  v_lock_key := hashtextextended(p_tenant_id::TEXT || ':' || p_date_tag, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX((split_part(po_number, '-', 3))::INT), 0) + 1
  INTO v_next_seq
  FROM purchases
  WHERE tenant_id = p_tenant_id
    AND po_number LIKE 'PO-' || p_date_tag || '-%';

  v_po_number := 'PO-' || p_date_tag || '-' || lpad(v_next_seq::TEXT, 3, '0');
  RETURN v_po_number;
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────
-- From the SQL editor (replace with a real tenant id):
--
--   SELECT reserve_po_number('<tenant-id>', '20260923');
--   -- Should return the next unused PO-20260923-NNN for that tenant.
--
-- The UNIQUE constraint: try inserting two purchases with the same
-- (tenant_id, po_number) - the second insert should fail with a
-- "duplicate key value violates unique constraint" error instead of
-- silently succeeding.

-- Migration: make return_number generation race-safe, same class of fix as
-- supabase/fix_po_number_race.sql for purchases.po_number.
-- Run this in your Supabase SQL editor.
--
-- Root cause: app/returns/page.tsx generates return numbers by reading
-- `SELECT count(*) FROM returns WHERE tenant_id = ...` on the client, then
-- computing `RET-${dateTag}-${count+1}` and inserting later in the same
-- request - two separate round-trips with nothing stopping two
-- close-together return creations from reading the same count and
-- computing the same number.
--
-- Fix, in two parts, mirroring fix_po_number_race.sql:
--   1. A UNIQUE constraint on (tenant_id, return_number) - the database
--      physically refuses a duplicate, so a race can no longer silently
--      produce one.
--   2. reserve_return_number(tenant_id, date_tag): an atomic, row-locked
--      RPC the client calls right before building the return payload.

ALTER TABLE returns
  ADD CONSTRAINT returns_tenant_return_number_unique UNIQUE (tenant_id, return_number);

CREATE OR REPLACE FUNCTION reserve_return_number(
  p_tenant_id UUID,
  p_date_tag  TEXT  -- e.g. '20260923'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next_seq  INT;
  v_return_number TEXT;
  v_lock_key  BIGINT;
BEGIN
  v_lock_key := hashtextextended(p_tenant_id::TEXT || ':return:' || p_date_tag, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX((split_part(return_number, '-', 3))::INT), 0) + 1
  INTO v_next_seq
  FROM returns
  WHERE tenant_id = p_tenant_id
    AND return_number LIKE 'RET-' || p_date_tag || '-%';

  v_return_number := 'RET-' || p_date_tag || '-' || lpad(v_next_seq::TEXT, 4, '0');
  RETURN v_return_number;
END;
$$;

-- ── Verification ──────────────────────────────────────────────────────────
--   SELECT reserve_return_number('<tenant-id>', '20260923');
--   -- Should return the next unused RET-20260923-NNNN for that tenant.

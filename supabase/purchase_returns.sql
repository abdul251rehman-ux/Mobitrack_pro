-- ─── Purchase Returns (Supplier Returns) ────────────────────────────────────
-- Run this once in your Supabase SQL Editor
-- If table already exists, run only the ALTER TABLE at the bottom.

CREATE TABLE IF NOT EXISTS purchase_returns (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL,
  return_number  TEXT        NOT NULL,
  date           DATE        NOT NULL,
  purchase_id    UUID,
  po_number      TEXT        NOT NULL,
  supplier_id    UUID        NOT NULL,
  supplier_name  TEXT        NOT NULL,
  items          JSONB       NOT NULL DEFAULT '[]',
  total_amount   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  resolution     TEXT        NOT NULL
                             CHECK (resolution IN ('Refund', 'Replacement', 'Credit Note', 'Ledger Credit')),
  refund_method  TEXT,
  account_id     UUID,
  status         TEXT        NOT NULL DEFAULT 'Completed'
                             CHECK (status IN ('Pending', 'Approved', 'Completed', 'Rejected')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ── If the table already exists, run this to update the constraint ────────────
-- (Safe to run even if the table was just created above)
ALTER TABLE purchase_returns
  DROP CONSTRAINT IF EXISTS purchase_returns_resolution_check;

ALTER TABLE purchase_returns
  ADD CONSTRAINT purchase_returns_resolution_check
  CHECK (resolution IN ('Refund', 'Replacement', 'Credit Note', 'Ledger Credit'));

-- ── Also update status default to Completed (Pakistani market — immediate) ────
ALTER TABLE purchase_returns
  ALTER COLUMN status SET DEFAULT 'Completed';

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS purchase_returns_tenant_idx   ON purchase_returns (tenant_id);
CREATE INDEX IF NOT EXISTS purchase_returns_supplier_idx ON purchase_returns (tenant_id, supplier_id);
CREATE INDEX IF NOT EXISTS purchase_returns_purchase_idx ON purchase_returns (purchase_id);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_purchase_returns_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchase_returns_updated_at ON purchase_returns;
CREATE TRIGGER purchase_returns_updated_at
  BEFORE UPDATE ON purchase_returns
  FOR EACH ROW EXECUTE FUNCTION update_purchase_returns_updated_at();

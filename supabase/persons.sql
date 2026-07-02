-- ============================================================
-- PERSONS TABLE
-- For informal money transactions with people who are
-- neither customers nor suppliers (dealers, friends, partners)
-- ============================================================

CREATE TABLE IF NOT EXISTS persons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  phone               TEXT,
  notes               TEXT,
  opening_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- positive = person owes us money (they took from us)
  -- negative = we owe them money (we took from them)
  status              TEXT NOT NULL DEFAULT 'Active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "persons_tenant_isolation" ON persons
  USING (tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1
  ));

-- Trigger: bump updated_at on change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS persons_updated_at ON persons;
CREATE TRIGGER persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Person transactions: "gave" (we gave them money) or "took" (they gave us money)
CREATE TABLE IF NOT EXISTS person_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  person_id       UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  type            TEXT NOT NULL CHECK (type IN ('gave', 'took')),
  -- gave: we gave money to them → debit (they owe us more)
  -- took: they gave money to us  → credit (we owe them / balance reduces)
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  method          TEXT NOT NULL DEFAULT 'Cash',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE person_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "person_transactions_tenant_isolation" ON person_transactions
  USING (tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid() LIMIT 1
  ));

-- Index for fast person lookup
CREATE INDEX IF NOT EXISTS idx_persons_tenant ON persons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_person_transactions_person ON person_transactions(person_id);
CREATE INDEX IF NOT EXISTS idx_person_transactions_tenant ON person_transactions(tenant_id);

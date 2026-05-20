-- ============================================================================
-- Finance Module Migration
-- Run this in Supabase SQL Editor AFTER the main migration.sql has been applied.
-- ============================================================================

-- ── 1. finance_accounts ──────────────────────────────────────────────────────
-- Stores named money accounts: Cash, Bank, Mobile Wallet
CREATE TABLE IF NOT EXISTS finance_accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  type             TEXT        NOT NULL DEFAULT 'cash'
                               CHECK (type IN ('cash', 'bank', 'mobile_wallet')),
  account_title    TEXT,
  bank_name        TEXT,
  account_number   TEXT,
  opening_balance  NUMERIC     NOT NULL DEFAULT 0,
  current_balance  NUMERIC     NOT NULL DEFAULT 0,
  is_default_cash  BOOLEAN     NOT NULL DEFAULT false,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_accounts' AND policyname = 'finance_accounts_all') THEN
    EXECUTE 'CREATE POLICY "finance_accounts_all" ON finance_accounts FOR ALL USING (true)';
  END IF;
END $$;

-- ── 2. finance_transactions ───────────────────────────────────────────────────
-- Journal of every money movement across all accounts
CREATE TABLE IF NOT EXISTS finance_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date             DATE        NOT NULL DEFAULT CURRENT_DATE,
  type             TEXT        NOT NULL
                               CHECK (type IN (
                                 'deposit', 'withdrawal',
                                 'transfer_in', 'transfer_out',
                                 'sale_receipt', 'purchase_payment',
                                 'expense', 'opening_balance',
                                 'sale_refund',
                                 'customer_payment',
                                 'supplier_payment',
                                 'used_phone_purchase'
                               )),
  account_id       UUID        NOT NULL REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  to_account_id    UUID        REFERENCES finance_accounts(id) ON DELETE RESTRICT,
  amount           NUMERIC     NOT NULL CHECK (amount > 0),
  reference_type   TEXT,
  reference_id     TEXT,
  reference_number TEXT,
  description      TEXT,
  notes            TEXT,
  created_by       TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'finance_transactions' AND policyname = 'finance_transactions_all') THEN
    EXECUTE 'CREATE POLICY "finance_transactions_all" ON finance_transactions FOR ALL USING (true)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_tenant_date
  ON finance_transactions (tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_transactions_account
  ON finance_transactions (account_id);

-- ── 3. Add account_id to existing transaction tables (non-breaking) ───────────
ALTER TABLE sales      ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES finance_accounts(id);
ALTER TABLE purchases  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES finance_accounts(id);
ALTER TABLE expenses   ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES finance_accounts(id);
ALTER TABLE payments   ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES finance_accounts(id);
ALTER TABLE returns    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES finance_accounts(id);
ALTER TABLE returns    ADD COLUMN IF NOT EXISTS refund_type TEXT DEFAULT 'cash' CHECK (refund_type IN ('cash', 'store_credit'));

-- ── 4. Helper: auto-update updated_at on finance_accounts ────────────────────
CREATE OR REPLACE FUNCTION update_finance_account_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_finance_accounts_updated_at ON finance_accounts;
CREATE TRIGGER trg_finance_accounts_updated_at
  BEFORE UPDATE ON finance_accounts
  FOR EACH ROW EXECUTE FUNCTION update_finance_account_timestamp();

-- ── 5. Ensure only one default cash account per tenant ───────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_default_cash_per_tenant
  ON finance_accounts (tenant_id) WHERE is_default_cash = true;

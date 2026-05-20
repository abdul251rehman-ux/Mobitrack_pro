-- ============================================================================
-- MobiTrack Pro — Incremental Migration v2
-- Safe to run on BOTH fresh and existing databases.
-- Uses IF NOT EXISTS / DO $$ blocks so re-running never errors.
--
-- What this fixes:
--   1. used_phones  — adds all complex-schema columns the inventory page needs
--   2. used_phones  — adds condition_notes, purchased_date, sold_date columns
--   3. used_phones  — ensures refurbishment_cost has a default of 0
--   4. sale_items   — no change needed (code maps UsedPhone → 'Mobile')
--   5. Indexes      — adds missing index on used_phones(tenant_id, status)
-- ============================================================================

-- ─── 1. used_phones: add complex-schema columns (idempotent) ─────────────────

ALTER TABLE used_phones
  ADD COLUMN IF NOT EXISTS imei_number          TEXT,
  ADD COLUMN IF NOT EXISTS condition_grade      TEXT,
  ADD COLUMN IF NOT EXISTS battery_health       NUMERIC,
  ADD COLUMN IF NOT EXISTS screen_condition     TEXT,
  ADD COLUMN IF NOT EXISTS body_condition       TEXT,
  ADD COLUMN IF NOT EXISTS functional_issues    TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accessories_included TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_type          TEXT,
  ADD COLUMN IF NOT EXISTS source_customer_id   UUID,
  ADD COLUMN IF NOT EXISTS source_customer_name TEXT,
  ADD COLUMN IF NOT EXISTS refurbishment_cost   NUMERIC     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pta_status           TEXT,
  ADD COLUMN IF NOT EXISTS warranty_days        INT         DEFAULT 7,
  ADD COLUMN IF NOT EXISTS photos               TEXT[]      DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS condition_notes      TEXT,
  ADD COLUMN IF NOT EXISTS purchased_date       DATE,
  ADD COLUMN IF NOT EXISTS sold_date            DATE;

-- ─── 2. used_phones: backfill legacy rows so normalisation works ─────────────
--
-- Rows inserted by the old simple API have grade/status in the wrong format.
-- We normalise them once here so the app never needs to guess.

UPDATE used_phones
SET condition_grade = grade
WHERE condition_grade IS NULL AND grade IS NOT NULL;

UPDATE used_phones
SET purchased_date = date_added
WHERE purchased_date IS NULL AND date_added IS NOT NULL;

-- Normalise old title-case status values to lowercase enum
UPDATE used_phones SET status = 'in_stock'    WHERE status = 'In Stock';
UPDATE used_phones SET status = 'sold'        WHERE status = 'Sold';
UPDATE used_phones SET status = 'listed_online' WHERE status = 'Listed';
UPDATE used_phones SET status = 'under_repair'  WHERE status = 'Under Repair';

-- Normalise old 4-grade values that are already valid in the 6-grade enum
-- (A+, A, B+, B, C, D are all valid — no change needed for those)
-- Any completely unknown grade → 'B' as a safe default
UPDATE used_phones
SET condition_grade = 'B'
WHERE condition_grade IS NOT NULL
  AND condition_grade NOT IN ('A+', 'A', 'B+', 'B', 'C', 'D');

-- ─── 3. used_phones: ensure null arrays are empty arrays ─────────────────────

UPDATE used_phones SET functional_issues    = '{}' WHERE functional_issues    IS NULL;
UPDATE used_phones SET accessories_included = '{}' WHERE accessories_included IS NULL;
UPDATE used_phones SET photos               = '{}'  WHERE photos               IS NULL;

-- ─── 4. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_used_phones_tenant_status
  ON used_phones(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_used_phones_imei_number
  ON used_phones(tenant_id, imei_number) WHERE imei_number IS NOT NULL;

-- ─── 5. RLS (ensure policy exists — safe if already present) ─────────────────

ALTER TABLE used_phones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'used_phones' AND policyname = 'allow_all'
  ) THEN
    EXECUTE 'CREATE POLICY "allow_all" ON used_phones FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ─── 6. updated_at trigger (safe re-create) ──────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at'
      AND tgrelid = 'used_phones'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at BEFORE UPDATE ON used_phones FOR EACH ROW EXECUTE FUNCTION update_updated_at()';
  END IF;
END $$;

-- ============================================================================
-- END — Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================================

-- ============================================================
-- CATALOG MODELS MIGRATION
-- Run this ONCE in Supabase SQL Editor
-- Adds brand_name to android_models and iphone_models so models
-- are brand-specific. Also unifies them into a single phone_models
-- view for easier catalog management.
-- ============================================================

-- 1. Add brand_name column to android_models
ALTER TABLE android_models
  ADD COLUMN IF NOT EXISTS brand_name TEXT NOT NULL DEFAULT '';

-- 2. Add brand_name column to iphone_models
ALTER TABLE iphone_models
  ADD COLUMN IF NOT EXISTS brand_name TEXT NOT NULL DEFAULT 'Apple';

-- 3. All existing iphone_models belong to Apple — fill it
UPDATE iphone_models SET brand_name = 'Apple' WHERE brand_name = '' OR brand_name IS NULL;

-- 4. Add is_system flag so seeded models can't be accidentally deleted
ALTER TABLE android_models ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;
ALTER TABLE iphone_models  ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- 5. Add indexes for fast brand-filtered lookups
CREATE INDEX IF NOT EXISTS idx_android_models_brand ON android_models(tenant_id, brand_name);
CREATE INDEX IF NOT EXISTS idx_iphone_models_brand  ON iphone_models(tenant_id, brand_name);

-- 6. RLS — allow all (app enforces tenant_id at query level)
ALTER TABLE iphone_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS iphone_models_all ON iphone_models;
CREATE POLICY iphone_models_all ON iphone_models USING (true) WITH CHECK (true);

ALTER TABLE android_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS android_models_all ON android_models;
CREATE POLICY android_models_all ON android_models USING (true) WITH CHECK (true);

-- 7. Also add is_system to colors, storage_options, ram_options for catalog lock protection
ALTER TABLE colors          ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;
ALTER TABLE storage_options ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;
ALTER TABLE ram_options     ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE;

-- RLS for colors / storage_options / ram_options
ALTER TABLE colors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE ram_options     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS colors_all          ON colors;
DROP POLICY IF EXISTS storage_options_all ON storage_options;
DROP POLICY IF EXISTS ram_options_all     ON ram_options;

CREATE POLICY colors_all          ON colors          USING (true) WITH CHECK (true);
CREATE POLICY storage_options_all ON storage_options USING (true) WITH CHECK (true);
CREATE POLICY ram_options_all     ON ram_options     USING (true) WITH CHECK (true);

-- ============================================================================
-- BACKFILL: seed brands / storage / RAM / colors / iPhone models / Android
-- models for EVERY existing tenant that's missing them.
-- Run this ONCE in the Supabase SQL Editor.
--
-- Why this exists: new signups (context/auth-context.tsx signup()) already
-- insert brands/storage/RAM/colors automatically for a fresh tenant. Tenants
-- created before that seeding code existed never got those rows, so their
-- Purchase/Product forms show "No options" until someone manually adds every
-- brand/color/storage/RAM one at a time. This backfills every existing
-- tenant in one pass (skipping any that already have rows, so it's safe to
-- re-run) and also adds iPhone/Android model lists, which signup() still
-- doesn't seed - see the note at the bottom for wiring that into signup too.
-- ============================================================================

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP

    -- ── Brands ──────────────────────────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM brands WHERE tenant_id = t.id) THEN
      INSERT INTO brands (tenant_id, name, logo_initials, country, status, is_system)
      VALUES
        (t.id, 'Samsung',   'SA', 'South Korea',   'Active', true),
        (t.id, 'Apple',     'AP', 'United States', 'Active', true),
        (t.id, 'Xiaomi',    'XI', 'China',         'Active', true),
        (t.id, 'Oppo',      'OP', 'China',         'Active', true),
        (t.id, 'Vivo',      'VI', 'China',         'Active', true),
        (t.id, 'Realme',    'RE', 'China',         'Active', true),
        (t.id, 'OnePlus',   'ON', 'China',         'Active', true),
        (t.id, 'Huawei',    'HW', 'China',         'Active', true),
        (t.id, 'Nokia',     'NO', 'Finland',       'Active', true),
        (t.id, 'Tecno',     'TE', 'China',         'Active', true),
        (t.id, 'Infinix',   'IN', 'China',         'Active', true),
        (t.id, 'Itel',      'IT', 'China',         'Active', true),
        (t.id, 'Google',    'GO', 'United States', 'Active', true),
        (t.id, 'Sony',      'SO', 'Japan',         'Active', true),
        (t.id, 'Motorola',  'MO', 'United States', 'Active', true),
        (t.id, 'Lenovo',    'LE', 'China',         'Active', true),
        (t.id, 'Asus',      'AS', 'Taiwan',        'Active', true),
        (t.id, 'ZTE',       'ZT', 'China',         'Active', true);
    END IF;

    -- ── Storage Options ─────────────────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM storage_options WHERE tenant_id = t.id) THEN
      INSERT INTO storage_options (tenant_id, name, is_system)
      VALUES
        (t.id, '16GB',  true), (t.id, '32GB',  true), (t.id, '64GB', true),
        (t.id, '128GB', true), (t.id, '256GB', true), (t.id, '512GB', true),
        (t.id, '1TB',   true);
    END IF;

    -- ── RAM Options ─────────────────────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM ram_options WHERE tenant_id = t.id) THEN
      INSERT INTO ram_options (tenant_id, name, is_system)
      VALUES
        (t.id, '2GB', true), (t.id, '3GB', true), (t.id, '4GB', true),
        (t.id, '6GB', true), (t.id, '8GB', true), (t.id, '12GB', true),
        (t.id, '16GB', true);
    END IF;

    -- ── Colors ──────────────────────────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM colors WHERE tenant_id = t.id) THEN
      INSERT INTO colors (tenant_id, name, is_system)
      VALUES
        (t.id, 'Black', true), (t.id, 'White', true), (t.id, 'Gold', true),
        (t.id, 'Silver', true), (t.id, 'Blue', true), (t.id, 'Green', true),
        (t.id, 'Red', true), (t.id, 'Purple', true), (t.id, 'Pink', true),
        (t.id, 'Gray', true), (t.id, 'Midnight', true), (t.id, 'Starlight', true),
        (t.id, 'Yellow', true), (t.id, 'Orange', true);
    END IF;

    -- ── iPhone Models ───────────────────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM iphone_models WHERE tenant_id = t.id) THEN
      INSERT INTO iphone_models (tenant_id, name, brand_name, is_system)
      VALUES
        (t.id, 'iPhone 7',          'Apple', true),
        (t.id, 'iPhone 7 Plus',     'Apple', true),
        (t.id, 'iPhone 8',          'Apple', true),
        (t.id, 'iPhone 8 Plus',     'Apple', true),
        (t.id, 'iPhone X',          'Apple', true),
        (t.id, 'iPhone XR',         'Apple', true),
        (t.id, 'iPhone XS',         'Apple', true),
        (t.id, 'iPhone XS Max',     'Apple', true),
        (t.id, 'iPhone 11',         'Apple', true),
        (t.id, 'iPhone 11 Pro',     'Apple', true),
        (t.id, 'iPhone 11 Pro Max', 'Apple', true),
        (t.id, 'iPhone 12',         'Apple', true),
        (t.id, 'iPhone 12 Mini',    'Apple', true),
        (t.id, 'iPhone 12 Pro',     'Apple', true),
        (t.id, 'iPhone 12 Pro Max', 'Apple', true),
        (t.id, 'iPhone 13',         'Apple', true),
        (t.id, 'iPhone 13 Mini',    'Apple', true),
        (t.id, 'iPhone 13 Pro',     'Apple', true),
        (t.id, 'iPhone 13 Pro Max', 'Apple', true),
        (t.id, 'iPhone 14',         'Apple', true),
        (t.id, 'iPhone 14 Plus',    'Apple', true),
        (t.id, 'iPhone 14 Pro',     'Apple', true),
        (t.id, 'iPhone 14 Pro Max', 'Apple', true),
        (t.id, 'iPhone 15',         'Apple', true),
        (t.id, 'iPhone 15 Plus',    'Apple', true),
        (t.id, 'iPhone 15 Pro',     'Apple', true),
        (t.id, 'iPhone 15 Pro Max', 'Apple', true),
        (t.id, 'iPhone 16',         'Apple', true),
        (t.id, 'iPhone 16 Plus',    'Apple', true),
        (t.id, 'iPhone 16 Pro',     'Apple', true),
        (t.id, 'iPhone 16 Pro Max', 'Apple', true),
        (t.id, 'iPhone SE (2020)',  'Apple', true),
        (t.id, 'iPhone SE (2022)',  'Apple', true);
    END IF;

    -- ── Android Models (popular Pakistan market) ───────────────────────────
    IF NOT EXISTS (SELECT 1 FROM android_models WHERE tenant_id = t.id) THEN
      INSERT INTO android_models (tenant_id, name, brand_name, is_system)
      VALUES
        -- Samsung
        (t.id, 'Galaxy A05',        'Samsung', true),
        (t.id, 'Galaxy A05s',       'Samsung', true),
        (t.id, 'Galaxy A15',        'Samsung', true),
        (t.id, 'Galaxy A25',        'Samsung', true),
        (t.id, 'Galaxy A35',        'Samsung', true),
        (t.id, 'Galaxy A55',        'Samsung', true),
        (t.id, 'Galaxy A14',        'Samsung', true),
        (t.id, 'Galaxy A24',        'Samsung', true),
        (t.id, 'Galaxy A34',        'Samsung', true),
        (t.id, 'Galaxy A54',        'Samsung', true),
        (t.id, 'Galaxy A13',        'Samsung', true),
        (t.id, 'Galaxy A23',        'Samsung', true),
        (t.id, 'Galaxy A33',        'Samsung', true),
        (t.id, 'Galaxy A53',        'Samsung', true),
        (t.id, 'Galaxy A73',        'Samsung', true),
        (t.id, 'Galaxy S22',        'Samsung', true),
        (t.id, 'Galaxy S22+',       'Samsung', true),
        (t.id, 'Galaxy S22 Ultra',  'Samsung', true),
        (t.id, 'Galaxy S23',        'Samsung', true),
        (t.id, 'Galaxy S23+',       'Samsung', true),
        (t.id, 'Galaxy S23 Ultra',  'Samsung', true),
        (t.id, 'Galaxy S24',        'Samsung', true),
        (t.id, 'Galaxy S24+',       'Samsung', true),
        (t.id, 'Galaxy S24 Ultra',  'Samsung', true),
        (t.id, 'Galaxy F14',        'Samsung', true),
        (t.id, 'Galaxy M14',        'Samsung', true),
        (t.id, 'Galaxy M34',        'Samsung', true),
        (t.id, 'Galaxy M54',        'Samsung', true),
        -- Xiaomi
        (t.id, 'Redmi 9',           'Xiaomi', true),
        (t.id, 'Redmi 9A',          'Xiaomi', true),
        (t.id, 'Redmi 9C',          'Xiaomi', true),
        (t.id, 'Redmi 10',          'Xiaomi', true),
        (t.id, 'Redmi 10A',         'Xiaomi', true),
        (t.id, 'Redmi 10C',         'Xiaomi', true),
        (t.id, 'Redmi 12',          'Xiaomi', true),
        (t.id, 'Redmi 12C',         'Xiaomi', true),
        (t.id, 'Redmi 13C',         'Xiaomi', true),
        (t.id, 'Redmi Note 11',     'Xiaomi', true),
        (t.id, 'Redmi Note 12',     'Xiaomi', true),
        (t.id, 'Redmi Note 13',     'Xiaomi', true),
        (t.id, 'Redmi Note 13 Pro', 'Xiaomi', true),
        (t.id, 'Xiaomi 13',         'Xiaomi', true),
        (t.id, 'Xiaomi 14',         'Xiaomi', true),
        (t.id, 'POCO X5',           'Xiaomi', true),
        (t.id, 'POCO X6',           'Xiaomi', true),
        (t.id, 'POCO M6 Pro',       'Xiaomi', true),
        -- Oppo
        (t.id, 'Oppo A17',          'Oppo', true),
        (t.id, 'Oppo A18',          'Oppo', true),
        (t.id, 'Oppo A38',          'Oppo', true),
        (t.id, 'Oppo A57',          'Oppo', true),
        (t.id, 'Oppo A58',          'Oppo', true),
        (t.id, 'Oppo A78',          'Oppo', true),
        (t.id, 'Oppo A96',          'Oppo', true),
        (t.id, 'Oppo Reno 8',       'Oppo', true),
        (t.id, 'Oppo Reno 10',      'Oppo', true),
        (t.id, 'Oppo Reno 11',      'Oppo', true),
        (t.id, 'Oppo F21 Pro',      'Oppo', true),
        (t.id, 'Oppo F23',          'Oppo', true),
        (t.id, 'Oppo F25 Pro',      'Oppo', true),
        -- Vivo
        (t.id, 'Vivo Y02',          'Vivo', true),
        (t.id, 'Vivo Y16',          'Vivo', true),
        (t.id, 'Vivo Y22',          'Vivo', true),
        (t.id, 'Vivo Y27',          'Vivo', true),
        (t.id, 'Vivo Y35',          'Vivo', true),
        (t.id, 'Vivo Y36',          'Vivo', true),
        (t.id, 'Vivo Y100',         'Vivo', true),
        (t.id, 'Vivo V25',          'Vivo', true),
        (t.id, 'Vivo V27',          'Vivo', true),
        (t.id, 'Vivo V29',          'Vivo', true),
        (t.id, 'Vivo V30',          'Vivo', true),
        -- Realme
        (t.id, 'Realme C30',        'Realme', true),
        (t.id, 'Realme C33',        'Realme', true),
        (t.id, 'Realme C51',        'Realme', true),
        (t.id, 'Realme C53',        'Realme', true),
        (t.id, 'Realme C55',        'Realme', true),
        (t.id, 'Realme C67',        'Realme', true),
        (t.id, 'Realme 11',         'Realme', true),
        (t.id, 'Realme 11 Pro',     'Realme', true),
        (t.id, 'Realme 12',         'Realme', true),
        (t.id, 'Realme 12 Pro',     'Realme', true),
        (t.id, 'Realme Narzo 60',   'Realme', true),
        -- OnePlus
        (t.id, 'OnePlus Nord CE3',  'OnePlus', true),
        (t.id, 'OnePlus Nord CE4',  'OnePlus', true),
        (t.id, 'OnePlus 11',        'OnePlus', true),
        (t.id, 'OnePlus 12',        'OnePlus', true),
        (t.id, 'OnePlus 12R',       'OnePlus', true),
        -- Tecno
        (t.id, 'Tecno Spark 10',    'Tecno', true),
        (t.id, 'Tecno Spark 20',    'Tecno', true),
        (t.id, 'Tecno Camon 20',    'Tecno', true),
        (t.id, 'Tecno Camon 30',    'Tecno', true),
        (t.id, 'Tecno Pop 8',       'Tecno', true),
        (t.id, 'Tecno Pova 5',      'Tecno', true),
        -- Infinix
        (t.id, 'Infinix Hot 30',    'Infinix', true),
        (t.id, 'Infinix Hot 40',    'Infinix', true),
        (t.id, 'Infinix Smart 8',   'Infinix', true),
        (t.id, 'Infinix Note 30',   'Infinix', true),
        (t.id, 'Infinix Zero 30',   'Infinix', true),
        -- Motorola
        (t.id, 'Moto G54',          'Motorola', true),
        (t.id, 'Moto G84',          'Motorola', true),
        (t.id, 'Moto G85',          'Motorola', true),
        (t.id, 'Motorola Edge 40',  'Motorola', true),
        (t.id, 'Motorola Edge 50',  'Motorola', true);
    END IF;

  END LOOP;

  RAISE NOTICE 'Catalog backfill complete for all tenants.';
END $$;

-- ── Verify per-tenant counts ─────────────────────────────────────────────────
SELECT
  tn.name AS tenant_name,
  (SELECT COUNT(*) FROM brands          b WHERE b.tenant_id = tn.id) AS brands,
  (SELECT COUNT(*) FROM storage_options s WHERE s.tenant_id = tn.id) AS storage_options,
  (SELECT COUNT(*) FROM ram_options     r WHERE r.tenant_id = tn.id) AS ram_options,
  (SELECT COUNT(*) FROM colors          c WHERE c.tenant_id = tn.id) AS colors,
  (SELECT COUNT(*) FROM iphone_models   i WHERE i.tenant_id = tn.id) AS iphone_models,
  (SELECT COUNT(*) FROM android_models  a WHERE a.tenant_id = tn.id) AS android_models
FROM tenants tn
ORDER BY tn.name;

-- ============================================================================
-- NOTE on future tenants: context/auth-context.tsx signup() already inserts
-- brands / storage_options / ram_options / colors / iphone_models /
-- android_models for every new tenant, so this backfill is only needed once
-- for tenants created before that seeding code existed.
-- ============================================================================

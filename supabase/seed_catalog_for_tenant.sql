-- ============================================================================
-- Seed catalog data for existing tenant: Rehman Mobile
-- Run this ONCE in Supabase SQL Editor → https://supabase.com/dashboard
-- ============================================================================

DO $$
DECLARE
  tid UUID := '79811ff0-d67e-4bf1-b7de-b776ae33e93a';
BEGIN

-- ── Brands ──────────────────────────────────────────────────────────────────
INSERT INTO brands (tenant_id, name, logo_initials, country, status, is_system)
VALUES
  (tid, 'Samsung',   'SA', 'South Korea',   'Active', true),
  (tid, 'Apple',     'AP', 'United States', 'Active', true),
  (tid, 'Xiaomi',    'XI', 'China',         'Active', true),
  (tid, 'Oppo',      'OP', 'China',         'Active', true),
  (tid, 'Vivo',      'VI', 'China',         'Active', true),
  (tid, 'Realme',    'RE', 'China',         'Active', true),
  (tid, 'OnePlus',   'ON', 'China',         'Active', true),
  (tid, 'Huawei',    'HW', 'China',         'Active', true),
  (tid, 'Nokia',     'NO', 'Finland',       'Active', true),
  (tid, 'Tecno',     'TE', 'China',         'Active', true),
  (tid, 'Infinix',   'IN', 'China',         'Active', true),
  (tid, 'Itel',      'IT', 'China',         'Active', true),
  (tid, 'Google',    'GO', 'United States', 'Active', true),
  (tid, 'Sony',      'SO', 'Japan',         'Active', true),
  (tid, 'Motorola',  'MO', 'United States', 'Active', true),
  (tid, 'Lenovo',    'LE', 'China',         'Active', true),
  (tid, 'Asus',      'AS', 'Taiwan',        'Active', true),
  (tid, 'ZTE',       'ZT', 'China',         'Active', true)
ON CONFLICT DO NOTHING;

-- ── Storage Options ──────────────────────────────────────────────────────────
INSERT INTO storage_options (tenant_id, name, is_system)
VALUES
  (tid, '16GB',  true),
  (tid, '32GB',  true),
  (tid, '64GB',  true),
  (tid, '128GB', true),
  (tid, '256GB', true),
  (tid, '512GB', true),
  (tid, '1TB',   true)
ON CONFLICT DO NOTHING;

-- ── RAM Options ──────────────────────────────────────────────────────────────
INSERT INTO ram_options (tenant_id, name, is_system)
VALUES
  (tid, '2GB',  true),
  (tid, '3GB',  true),
  (tid, '4GB',  true),
  (tid, '6GB',  true),
  (tid, '8GB',  true),
  (tid, '12GB', true),
  (tid, '16GB', true)
ON CONFLICT DO NOTHING;

-- ── Colors ───────────────────────────────────────────────────────────────────
INSERT INTO colors (tenant_id, name, is_system)
VALUES
  (tid, 'Black',      true),
  (tid, 'White',      true),
  (tid, 'Gold',       true),
  (tid, 'Silver',     true),
  (tid, 'Blue',       true),
  (tid, 'Green',      true),
  (tid, 'Red',        true),
  (tid, 'Purple',     true),
  (tid, 'Pink',       true),
  (tid, 'Gray',       true),
  (tid, 'Midnight',   true),
  (tid, 'Starlight',  true),
  (tid, 'Yellow',     true),
  (tid, 'Orange',     true)
ON CONFLICT DO NOTHING;

-- ── iPhone Models ────────────────────────────────────────────────────────────
INSERT INTO iphone_models (tenant_id, name, brand_name, is_system)
VALUES
  (tid, 'iPhone 7',          'Apple', true),
  (tid, 'iPhone 7 Plus',     'Apple', true),
  (tid, 'iPhone 8',          'Apple', true),
  (tid, 'iPhone 8 Plus',     'Apple', true),
  (tid, 'iPhone X',          'Apple', true),
  (tid, 'iPhone XR',         'Apple', true),
  (tid, 'iPhone XS',         'Apple', true),
  (tid, 'iPhone XS Max',     'Apple', true),
  (tid, 'iPhone 11',         'Apple', true),
  (tid, 'iPhone 11 Pro',     'Apple', true),
  (tid, 'iPhone 11 Pro Max', 'Apple', true),
  (tid, 'iPhone 12',         'Apple', true),
  (tid, 'iPhone 12 Mini',    'Apple', true),
  (tid, 'iPhone 12 Pro',     'Apple', true),
  (tid, 'iPhone 12 Pro Max', 'Apple', true),
  (tid, 'iPhone 13',         'Apple', true),
  (tid, 'iPhone 13 Mini',    'Apple', true),
  (tid, 'iPhone 13 Pro',     'Apple', true),
  (tid, 'iPhone 13 Pro Max', 'Apple', true),
  (tid, 'iPhone 14',         'Apple', true),
  (tid, 'iPhone 14 Plus',    'Apple', true),
  (tid, 'iPhone 14 Pro',     'Apple', true),
  (tid, 'iPhone 14 Pro Max', 'Apple', true),
  (tid, 'iPhone 15',         'Apple', true),
  (tid, 'iPhone 15 Plus',    'Apple', true),
  (tid, 'iPhone 15 Pro',     'Apple', true),
  (tid, 'iPhone 15 Pro Max', 'Apple', true),
  (tid, 'iPhone 16',         'Apple', true),
  (tid, 'iPhone 16 Plus',    'Apple', true),
  (tid, 'iPhone 16 Pro',     'Apple', true),
  (tid, 'iPhone 16 Pro Max', 'Apple', true),
  (tid, 'iPhone SE (2020)',   'Apple', true),
  (tid, 'iPhone SE (2022)',   'Apple', true)
ON CONFLICT DO NOTHING;

-- ── Android Models (popular Pakistan market) ─────────────────────────────────
INSERT INTO android_models (tenant_id, name, brand_name, is_system)
VALUES
  -- Samsung
  (tid, 'Galaxy A05',        'Samsung', true),
  (tid, 'Galaxy A05s',       'Samsung', true),
  (tid, 'Galaxy A15',        'Samsung', true),
  (tid, 'Galaxy A25',        'Samsung', true),
  (tid, 'Galaxy A35',        'Samsung', true),
  (tid, 'Galaxy A55',        'Samsung', true),
  (tid, 'Galaxy A14',        'Samsung', true),
  (tid, 'Galaxy A24',        'Samsung', true),
  (tid, 'Galaxy A34',        'Samsung', true),
  (tid, 'Galaxy A54',        'Samsung', true),
  (tid, 'Galaxy A13',        'Samsung', true),
  (tid, 'Galaxy A23',        'Samsung', true),
  (tid, 'Galaxy A33',        'Samsung', true),
  (tid, 'Galaxy A53',        'Samsung', true),
  (tid, 'Galaxy A73',        'Samsung', true),
  (tid, 'Galaxy S22',        'Samsung', true),
  (tid, 'Galaxy S22+',       'Samsung', true),
  (tid, 'Galaxy S22 Ultra',  'Samsung', true),
  (tid, 'Galaxy S23',        'Samsung', true),
  (tid, 'Galaxy S23+',       'Samsung', true),
  (tid, 'Galaxy S23 Ultra',  'Samsung', true),
  (tid, 'Galaxy S24',        'Samsung', true),
  (tid, 'Galaxy S24+',       'Samsung', true),
  (tid, 'Galaxy S24 Ultra',  'Samsung', true),
  (tid, 'Galaxy F14',        'Samsung', true),
  (tid, 'Galaxy M14',        'Samsung', true),
  (tid, 'Galaxy M34',        'Samsung', true),
  (tid, 'Galaxy M54',        'Samsung', true),
  -- Xiaomi
  (tid, 'Redmi 9',           'Xiaomi', true),
  (tid, 'Redmi 9A',          'Xiaomi', true),
  (tid, 'Redmi 9C',          'Xiaomi', true),
  (tid, 'Redmi 10',          'Xiaomi', true),
  (tid, 'Redmi 10A',         'Xiaomi', true),
  (tid, 'Redmi 10C',         'Xiaomi', true),
  (tid, 'Redmi 12',          'Xiaomi', true),
  (tid, 'Redmi 12C',         'Xiaomi', true),
  (tid, 'Redmi 13C',         'Xiaomi', true),
  (tid, 'Redmi Note 11',     'Xiaomi', true),
  (tid, 'Redmi Note 12',     'Xiaomi', true),
  (tid, 'Redmi Note 13',     'Xiaomi', true),
  (tid, 'Redmi Note 13 Pro', 'Xiaomi', true),
  (tid, 'Xiaomi 13',         'Xiaomi', true),
  (tid, 'Xiaomi 14',         'Xiaomi', true),
  (tid, 'POCO X5',           'Xiaomi', true),
  (tid, 'POCO X6',           'Xiaomi', true),
  (tid, 'POCO M6 Pro',       'Xiaomi', true),
  -- Oppo
  (tid, 'Oppo A17',          'Oppo', true),
  (tid, 'Oppo A18',          'Oppo', true),
  (tid, 'Oppo A38',          'Oppo', true),
  (tid, 'Oppo A57',          'Oppo', true),
  (tid, 'Oppo A58',          'Oppo', true),
  (tid, 'Oppo A78',          'Oppo', true),
  (tid, 'Oppo A96',          'Oppo', true),
  (tid, 'Oppo Reno 8',       'Oppo', true),
  (tid, 'Oppo Reno 10',      'Oppo', true),
  (tid, 'Oppo Reno 11',      'Oppo', true),
  (tid, 'Oppo F21 Pro',      'Oppo', true),
  (tid, 'Oppo F23',          'Oppo', true),
  (tid, 'Oppo F25 Pro',      'Oppo', true),
  -- Vivo
  (tid, 'Vivo Y02',          'Vivo', true),
  (tid, 'Vivo Y16',          'Vivo', true),
  (tid, 'Vivo Y22',          'Vivo', true),
  (tid, 'Vivo Y27',          'Vivo', true),
  (tid, 'Vivo Y35',          'Vivo', true),
  (tid, 'Vivo Y36',          'Vivo', true),
  (tid, 'Vivo Y100',         'Vivo', true),
  (tid, 'Vivo V25',          'Vivo', true),
  (tid, 'Vivo V27',          'Vivo', true),
  (tid, 'Vivo V29',          'Vivo', true),
  (tid, 'Vivo V30',          'Vivo', true),
  -- Realme
  (tid, 'Realme C30',        'Realme', true),
  (tid, 'Realme C33',        'Realme', true),
  (tid, 'Realme C51',        'Realme', true),
  (tid, 'Realme C53',        'Realme', true),
  (tid, 'Realme C55',        'Realme', true),
  (tid, 'Realme C67',        'Realme', true),
  (tid, 'Realme 11',         'Realme', true),
  (tid, 'Realme 11 Pro',     'Realme', true),
  (tid, 'Realme 12',         'Realme', true),
  (tid, 'Realme 12 Pro',     'Realme', true),
  (tid, 'Realme Narzo 60',   'Realme', true),
  -- OnePlus
  (tid, 'OnePlus Nord CE3',  'OnePlus', true),
  (tid, 'OnePlus Nord CE4',  'OnePlus', true),
  (tid, 'OnePlus 11',        'OnePlus', true),
  (tid, 'OnePlus 12',        'OnePlus', true),
  (tid, 'OnePlus 12R',       'OnePlus', true),
  -- Tecno
  (tid, 'Tecno Spark 10',    'Tecno', true),
  (tid, 'Tecno Spark 20',    'Tecno', true),
  (tid, 'Tecno Camon 20',    'Tecno', true),
  (tid, 'Tecno Camon 30',    'Tecno', true),
  (tid, 'Tecno Pop 8',       'Tecno', true),
  (tid, 'Tecno Pova 5',      'Tecno', true),
  -- Infinix
  (tid, 'Infinix Hot 30',    'Infinix', true),
  (tid, 'Infinix Hot 40',    'Infinix', true),
  (tid, 'Infinix Smart 8',   'Infinix', true),
  (tid, 'Infinix Note 30',   'Infinix', true),
  (tid, 'Infinix Zero 30',   'Infinix', true),
  -- Motorola
  (tid, 'Moto G54',          'Motorola', true),
  (tid, 'Moto G84',          'Motorola', true),
  (tid, 'Moto G85',          'Motorola', true),
  (tid, 'Motorola Edge 40',  'Motorola', true),
  (tid, 'Motorola Edge 50',  'Motorola', true)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Catalog seeded successfully for tenant: %', tid;
END $$;

-- Verify
SELECT 'brands' as tbl, COUNT(*) FROM brands WHERE tenant_id = '79811ff0-d67e-4bf1-b7de-b776ae33e93a'
UNION ALL
SELECT 'storage_options', COUNT(*) FROM storage_options WHERE tenant_id = '79811ff0-d67e-4bf1-b7de-b776ae33e93a'
UNION ALL
SELECT 'ram_options', COUNT(*) FROM ram_options WHERE tenant_id = '79811ff0-d67e-4bf1-b7de-b776ae33e93a'
UNION ALL
SELECT 'colors', COUNT(*) FROM colors WHERE tenant_id = '79811ff0-d67e-4bf1-b7de-b776ae33e93a'
UNION ALL
SELECT 'iphone_models', COUNT(*) FROM iphone_models WHERE tenant_id = '79811ff0-d67e-4bf1-b7de-b776ae33e93a'
UNION ALL
SELECT 'android_models', COUNT(*) FROM android_models WHERE tenant_id = '79811ff0-d67e-4bf1-b7de-b776ae33e93a';

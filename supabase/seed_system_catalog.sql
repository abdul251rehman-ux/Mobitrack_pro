-- ============================================================
-- SYSTEM CATALOG SEED
-- Run this in Supabase SQL Editor
-- Step 1: Add is_system column to catalog tables
-- Step 2: Seed standard brands, storage, RAM, colors per tenant
-- ============================================================

-- 1. Add is_system column (safe to run multiple times)
ALTER TABLE brands          ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
ALTER TABLE storage_options ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
ALTER TABLE ram_options      ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
ALTER TABLE colors           ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- 2. Seed function: inserts system defaults for a given tenant
--    Call: SELECT seed_system_catalog('<your-tenant-uuid>');
CREATE OR REPLACE FUNCTION seed_system_catalog(p_tenant_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN

  -- ── Brands (Pakistani market) ─────────────────────────────
  INSERT INTO brands (tenant_id, name, logo_initials, country, status, is_system)
  SELECT p_tenant_id, b.name, b.initials, b.country, 'Active', true
  FROM (VALUES
    ('Samsung',  'SA', 'South Korea'),
    ('Apple',    'AP', 'United States'),
    ('Xiaomi',   'XI', 'China'),
    ('Oppo',     'OP', 'China'),
    ('Vivo',     'VI', 'China'),
    ('Realme',   'RE', 'China'),
    ('OnePlus',  'OP', 'China'),
    ('Huawei',   'HW', 'China'),
    ('Nokia',    'NO', 'Finland'),
    ('Tecno',    'TE', 'China'),
    ('Infinix',  'IN', 'China'),
    ('Itel',     'IT', 'China'),
    ('Google',   'GO', 'United States'),
    ('Sony',     'SO', 'Japan'),
    ('Motorola', 'MO', 'United States')
  ) AS b(name, initials, country)
  WHERE NOT EXISTS (
    SELECT 1 FROM brands
    WHERE tenant_id = p_tenant_id AND LOWER(name) = LOWER(b.name)
  );

  -- ── Storage Options ───────────────────────────────────────
  INSERT INTO storage_options (tenant_id, name, is_system)
  SELECT p_tenant_id, s.name, true
  FROM (VALUES
    ('16GB'), ('32GB'), ('64GB'), ('128GB'),
    ('256GB'), ('512GB'), ('1TB')
  ) AS s(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM storage_options
    WHERE tenant_id = p_tenant_id AND LOWER(name) = LOWER(s.name)
  );

  -- ── RAM Options ───────────────────────────────────────────
  INSERT INTO ram_options (tenant_id, name, is_system)
  SELECT p_tenant_id, r.name, true
  FROM (VALUES
    ('2GB'), ('3GB'), ('4GB'), ('6GB'),
    ('8GB'), ('12GB'), ('16GB')
  ) AS r(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM ram_options
    WHERE tenant_id = p_tenant_id AND LOWER(name) = LOWER(r.name)
  );

  -- ── Colors ────────────────────────────────────────────────
  INSERT INTO colors (tenant_id, name, is_system)
  SELECT p_tenant_id, c.name, true
  FROM (VALUES
    ('Black'), ('White'), ('Gold'), ('Silver'),
    ('Blue'), ('Green'), ('Red'), ('Purple'),
    ('Pink'), ('Gray'), ('Midnight'), ('Starlight')
  ) AS c(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM colors
    WHERE tenant_id = p_tenant_id AND LOWER(name) = LOWER(c.name)
  );

END;
$$;

-- ── HOW TO USE ────────────────────────────────────────────────────────────────
-- First find your tenant ID:
--   SELECT id, name FROM tenants;
--
-- Then seed it:
--   SELECT seed_system_catalog('paste-your-tenant-uuid-here');
--
-- To seed ALL existing tenants at once:
--   SELECT seed_system_catalog(id) FROM tenants;
-- ─────────────────────────────────────────────────────────────────────────────

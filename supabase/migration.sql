-- ============================================================================
-- MobiTrack Pro — Complete Supabase Migration (v3 — FINAL BULLETPROOF)
-- Run this in Supabase SQL Editor as a single block on a fresh database.
--
-- Covers EVERY table, column, index, RLS policy, and trigger referenced
-- anywhere in the codebase — lib/api/*, app/**, hooks/**, context/**.
--
-- KEY DECISIONS vs v2:
--   • tenants          — added owner_name (auth-context.tsx inserts it)
--   • profiles         — removed FK to auth.users (app uses custom auth);
--                        renamed avatar → avatar_url; added password column
--   • imei_records     — SUPERSET: simple schema (lib/api/inventory) +
--                        complex schema (app/purchases/new, app/sales/new)
--   • used_phones      — SUPERSET: simple (lib/api/inventory) + complex
--                        (app/purchases/new page)
--   • NEW TABLES: colors, storage_options, ram_options, iphone_models,
--                 conditions  (used by app/purchases/new, app/products/mobiles)
--   • RLS policies     — USING (true) because app uses custom password auth
--                        (not Supabase Auth); auth.uid() is always NULL so
--                        uid-based policies would block every query.
--                        Tighten these policies if/when real Supabase Auth
--                        is adopted.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TENANTS
-- lib/api/auth.ts  inserts: name, slug, phone, email, address, city, currency, tax_rate
-- context/auth-context.tsx inserts: name, owner_name, email, phone
-- lib/api/settings.ts updates: name, phone, email, address, city, logo, currency, tax_rate
-- ============================================================================
CREATE TABLE tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  owner_name  TEXT,
  slug        TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  city        TEXT,
  logo        TEXT,
  currency    TEXT        DEFAULT 'PKR',
  tax_rate    NUMERIC     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. PROFILES
-- context/auth-context.tsx:
--   SELECT: id, tenant_id, name, email, phone, role, avatar_url, status, password
--   INSERT: id (crypto.randomUUID()), tenant_id, name, email, phone, role, status, password
-- lib/api/auth.ts inserts via Supabase Auth user id — also compatible since
--   id is just a UUID PK with no FK constraint.
-- ============================================================================
CREATE TABLE profiles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  phone       TEXT,
  role        TEXT        NOT NULL DEFAULT 'Cashier'
                          CHECK (role IN ('Admin', 'Manager', 'Cashier')),
  avatar_url  TEXT,
  password    TEXT,
  status      TEXT        DEFAULT 'Active'
                          CHECK (status IN ('Active', 'Inactive')),
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. SUPPLIERS
-- ============================================================================
CREATE TABLE suppliers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name        TEXT        NOT NULL,
  contact_person      TEXT,
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  city                TEXT,
  total_purchases     NUMERIC     DEFAULT 0,
  outstanding_balance NUMERIC     DEFAULT 0,
  rating              NUMERIC     DEFAULT 0,
  status              TEXT        DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 4. CUSTOMERS
-- ============================================================================
CREATE TABLE customers (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL,
  phone              TEXT,
  email              TEXT,
  address            TEXT,
  city               TEXT,
  total_purchases    INT         DEFAULT 0,
  total_spent        NUMERIC     DEFAULT 0,
  last_purchase_date DATE,
  loyalty_tier       TEXT        DEFAULT 'Bronze'
                                 CHECK (loyalty_tier IN ('Bronze','Silver','Gold','Platinum')),
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 5. BRANDS
-- app/purchases/new inserts: tenant_id, name, logo_initials, status
-- app/products/mobiles reads: name, logo_initials, status
-- ============================================================================
CREATE TABLE brands (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  logo_initials   TEXT,
  country         TEXT,
  mobile_count    INT         DEFAULT 0,
  accessory_count INT         DEFAULT 0,
  status          TEXT        DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 6. CATEGORIES
-- app/purchases/new inserts: tenant_id, name, type, item_count
-- type values used: 'Mobile', 'Accessory', 'Both'
-- ============================================================================
CREATE TABLE categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('Mobile','Accessory','Both')),
  description TEXT,
  item_count  INT         DEFAULT 0,
  status      TEXT        DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 7. COLORS  (NEW — app/purchases/new, app/products/mobiles)
-- ============================================================================
CREATE TABLE colors (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 8. STORAGE OPTIONS  (NEW — app/purchases/new, app/products/mobiles)
-- ============================================================================
CREATE TABLE storage_options (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 9. RAM OPTIONS  (NEW — app/purchases/new, app/products/mobiles)
-- ============================================================================
CREATE TABLE ram_options (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 10a. ANDROID MODELS  (custom models added by tenant beyond MASTER_BRANDS)
-- ============================================================================
CREATE TABLE android_models (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_android_models_tenant ON android_models(tenant_id);
ALTER TABLE android_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY android_models_all ON android_models USING (true);

-- ============================================================================
-- 10. IPHONE MODELS  (NEW — app/purchases/new, app/products/mobiles)
-- ============================================================================
CREATE TABLE iphone_models (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 11. CONDITIONS  (NEW — app/purchases/new, app/products/mobiles)
-- Values used: 'New', 'Refurbished', 'Used' — no constraint since user-defined
-- ============================================================================
CREATE TABLE conditions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 12. INVITATIONS  (lib/api/settings.ts)
-- ============================================================================
CREATE TABLE invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'Cashier'
                          CHECK (role IN ('Admin','Manager','Cashier')),
  status      TEXT        DEFAULT 'pending'
                          CHECK (status IN ('pending','accepted','rejected')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 13. MOBILES
-- app/purchases/new inserts: tenant_id, brand, model, imei, color, storage, ram,
--   purchase_price, selling_price, supplier_id, stock, condition, category,
--   device_type, date_added, image_url, battery_health
-- ============================================================================
CREATE TABLE mobiles (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand          TEXT,
  model          TEXT,
  imei           TEXT,
  color          TEXT,
  storage        TEXT,
  ram            TEXT,
  purchase_price NUMERIC,
  selling_price  NUMERIC,
  supplier_id    UUID        REFERENCES suppliers(id),
  stock          INT         DEFAULT 0,
  condition      TEXT        DEFAULT 'New',
  category       TEXT        DEFAULT '',
  device_type    TEXT        DEFAULT 'android' CHECK (device_type IN ('android','iphone')),
  battery_health NUMERIC,
  notes          TEXT,
  image_url      TEXT,
  date_added     DATE        DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_mobiles_imei_unique
  ON mobiles(tenant_id, imei) WHERE imei IS NOT NULL;

-- ============================================================================
-- 14. ACCESSORIES
-- ============================================================================
CREATE TABLE accessories (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  brand             TEXT,
  sku               TEXT,
  category          TEXT,
  purchase_price    NUMERIC,
  selling_price     NUMERIC,
  stock             INT         DEFAULT 0,
  supplier_id       UUID        REFERENCES suppliers(id),
  compatible_models TEXT[]      DEFAULT '{}',
  description       TEXT,
  image_url         TEXT,
  date_added        DATE        DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 15. SHOPS  (B2B dealers / consignment partners)
-- ============================================================================
CREATE TABLE shops (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  owner_name          TEXT,
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  city                TEXT,
  shop_type           TEXT        CHECK (shop_type IN ('Retailer','Dealer','Wholesaler','Repair Shop')),
  status              TEXT        DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  total_orders        INT         DEFAULT 0,
  total_spent         NUMERIC     DEFAULT 0,
  outstanding_balance NUMERIC     DEFAULT 0,
  last_order_date     DATE,
  notes               TEXT,
  date_added          DATE        DEFAULT CURRENT_DATE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 16. SALES
-- ============================================================================
CREATE TABLE sales (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number  TEXT,
  date            DATE        DEFAULT CURRENT_DATE,
  customer_id     UUID        REFERENCES customers(id),
  customer_name   TEXT,
  customer_phone  TEXT,
  subtotal        NUMERIC,
  discount        NUMERIC     DEFAULT 0,
  tax             NUMERIC     DEFAULT 0,
  total           NUMERIC,
  payment_method  TEXT,
  amount_received NUMERIC,
  change_due      NUMERIC,
  status          TEXT        DEFAULT 'Completed'
                              CHECK (status IN ('Completed','Pending','Refunded')),
  notes           TEXT,
  created_by      UUID        REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 17. SALE ITEMS
-- ============================================================================
CREATE TABLE sale_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sale_id      UUID        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id   UUID,
  product_name TEXT,
  product_type TEXT        CHECK (product_type IN ('Mobile','Accessory')),
  quantity     INT,
  unit_price   NUMERIC,
  discount     NUMERIC     DEFAULT 0,
  line_total   NUMERIC,
  imei         TEXT
);

-- ============================================================================
-- 18. PURCHASES
-- ============================================================================
CREATE TABLE purchases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  po_number       TEXT,
  date            DATE        DEFAULT CURRENT_DATE,
  supplier_id     UUID        REFERENCES suppliers(id),
  supplier_name   TEXT,
  subtotal        NUMERIC,
  shipping_cost   NUMERIC     DEFAULT 0,
  tax             NUMERIC     DEFAULT 0,
  total           NUMERIC,
  amount_paid     NUMERIC     DEFAULT 0,
  balance_due     NUMERIC,
  payment_status  TEXT        DEFAULT 'Unpaid'
                              CHECK (payment_status IN ('Paid','Partial','Unpaid')),
  delivery_status TEXT        DEFAULT 'Pending'
                              CHECK (delivery_status IN ('Received','Pending','Partial')),
  payment_method  TEXT,
  due_date        DATE,
  notes           TEXT,
  created_by      UUID        REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 19. PURCHASE ITEMS
-- ============================================================================
CREATE TABLE purchase_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  purchase_id  UUID        NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id   UUID,
  product_name TEXT,
  product_type TEXT        CHECK (product_type IN ('Mobile','Accessory')),
  quantity     INT,
  unit_cost    NUMERIC,
  total        NUMERIC,
  imeis        TEXT[]      DEFAULT '{}'
);

-- ============================================================================
-- 20. EXPENSES
-- ============================================================================
CREATE TABLE expenses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  category        TEXT        CHECK (category IN (
                    'Rent','Electricity','Internet & Phone','Staff Salaries',
                    'Marketing & Advertising','Packaging & Supplies','Repair & Maintenance',
                    'Transport','Equipment & Furniture','Shop License & Taxes','Miscellaneous',
                    'Utilities','Salaries','Marketing','Maintenance',
                    'Transportation','Office Supplies','Insurance','Taxes','Other')),
  amount          NUMERIC     NOT NULL,
  date            DATE        DEFAULT CURRENT_DATE,
  type            TEXT        CHECK (type IN ('one-time','daily','monthly','yearly')),
  payment_method  TEXT,
  status          TEXT        DEFAULT 'Paid' CHECK (status IN ('Paid','Pending')),
  notes           TEXT,
  is_recurring    BOOLEAN     DEFAULT false,
  recurring_day   INT,
  recurring_month INT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 21. RETURNS
-- ============================================================================
CREATE TABLE returns (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  return_number    TEXT,
  date             DATE        DEFAULT CURRENT_DATE,
  sale_id          UUID        REFERENCES sales(id),
  invoice_number   TEXT,
  customer_id      UUID        REFERENCES customers(id),
  customer_name    TEXT,
  customer_phone   TEXT,
  reason           TEXT        CHECK (reason IN (
                     'Defective','Wrong Item','Customer Changed Mind','Damaged',
                     'Not As Described','Warranty Claim','Other')),
  subtotal         NUMERIC,
  refund_amount    NUMERIC,
  refund_method    TEXT,
  status           TEXT        DEFAULT 'Pending'
                               CHECK (status IN ('Pending','Approved','Rejected','Completed','Exchanged')),
  restock_items    BOOLEAN     DEFAULT true,
  exchange_sale_id UUID,
  processed_by     UUID        REFERENCES profiles(id),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  resolved_at      TIMESTAMPTZ
);

-- ============================================================================
-- 22. RETURN ITEMS
-- ============================================================================
CREATE TABLE return_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  return_id    UUID        NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id   UUID,
  product_name TEXT,
  product_type TEXT        CHECK (product_type IN ('Mobile','Accessory')),
  quantity     INT,
  unit_price   NUMERIC,
  line_total   NUMERIC,
  imei         TEXT,
  condition    TEXT        CHECK (condition IN ('Good','Damaged','Defective'))
);

-- ============================================================================
-- 23. PAYMENTS
-- app/purchases/new inserts without reference_id (nullable)
-- app/sales/new inserts without reference_id (nullable)
-- ============================================================================
CREATE TABLE payments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date             DATE        DEFAULT CURRENT_DATE,
  type             TEXT        CHECK (type IN ('Received','Paid')),
  entity_type      TEXT        CHECK (entity_type IN ('Customer','Supplier')),
  entity_id        UUID,
  entity_name      TEXT,
  reference_type   TEXT        CHECK (reference_type IN ('Sale','Purchase','Return','Advance','Settlement')),
  reference_id     UUID,
  reference_number TEXT,
  amount           NUMERIC     NOT NULL,
  method           TEXT,
  status           TEXT        DEFAULT 'Completed'
                               CHECK (status IN ('Completed','Pending','Failed','Cancelled')),
  notes            TEXT,
  processed_by     UUID        REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 24. WARRANTY RECORDS
-- ============================================================================
CREATE TABLE warranty_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id      UUID,
  product_name    TEXT,
  product_type    TEXT        CHECK (product_type IN ('Mobile','Accessory')),
  imei            TEXT,
  customer_id     UUID        REFERENCES customers(id),
  customer_name   TEXT,
  customer_phone  TEXT,
  sale_id         UUID        REFERENCES sales(id),
  invoice_number  TEXT,
  purchase_date   DATE,
  warranty_months INT,
  expiry_date     DATE,
  status          TEXT        DEFAULT 'Active'
                              CHECK (status IN ('Active','Expired','Claimed','Voided')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 25. WARRANTY CLAIMS
-- ============================================================================
CREATE TABLE warranty_claims (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  warranty_id      UUID        NOT NULL REFERENCES warranty_records(id) ON DELETE CASCADE,
  date             DATE        DEFAULT CURRENT_DATE,
  issue            TEXT,
  resolution       TEXT,
  status           TEXT        DEFAULT 'Open'
                               CHECK (status IN ('Open','In Progress','Resolved','Rejected')),
  repair_ticket_id UUID,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 26. REPAIR TICKETS
-- ============================================================================
CREATE TABLE repair_tickets (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_number             TEXT,
  date                      DATE        DEFAULT CURRENT_DATE,
  customer_id               UUID        REFERENCES customers(id),
  customer_name             TEXT,
  customer_phone            TEXT,
  device_brand              TEXT,
  device_model              TEXT,
  imei                      TEXT,
  issue                     TEXT,
  diagnosis                 TEXT,
  priority                  TEXT        DEFAULT 'Medium'
                                        CHECK (priority IN ('Low','Medium','High','Urgent')),
  status                    TEXT        DEFAULT 'Received'
                                        CHECK (status IN (
                                          'Received','Diagnosing','In Repair',
                                          'Waiting Parts','Repaired','Delivered','Cancelled')),
  estimated_cost            NUMERIC     DEFAULT 0,
  actual_cost               NUMERIC     DEFAULT 0,
  warranty_claim_id         UUID,
  technician_name           TEXT,
  received_date             DATE,
  estimated_completion_date DATE,
  completed_date            DATE,
  delivered_date            DATE,
  notes                     TEXT,
  created_at                TIMESTAMPTZ DEFAULT now(),
  updated_at                TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 27. REPAIR PARTS
-- DbRepairPart uses repair_ticket_id (NOT ticket_id)
-- ============================================================================
CREATE TABLE repair_parts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  repair_ticket_id UUID        NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  cost             NUMERIC,
  quantity         INT         DEFAULT 1
);

-- ============================================================================
-- 28. IMEI RECORDS  — SUPERSET SCHEMA
--
-- Simple schema (lib/api/inventory.ts):
--   INSERT: tenant_id, product_id, product_name, imei, status, purchase_id,
--           sale_id, notes
--
-- Complex schema (app/purchases/new/page.tsx line 392-399):
--   INSERT: tenant_id, imei_number, brand, model, color, storage_capacity,
--           pta_status, device_status, purchase_price, selling_price,
--           supplier_id, supplier_name, purchase_date
--
-- Update schema (app/sales/new/page.tsx line 262-264):
--   UPDATE: device_status, sold_date, customer_name, customer_phone
--   WHERE:  imei_number = ?, tenant_id = ?
--
-- BOTH imei (simple) and imei_number (complex/page) are kept.
-- No CHECK on device_status/pta_status — code uses lowercase ('in_stock','sold','pending').
-- ============================================================================
CREATE TABLE imei_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Simple schema fields
  product_id       UUID,
  product_name     TEXT,
  imei             TEXT,
  status           TEXT        DEFAULT 'In Stock'
                               CHECK (status IN ('In Stock','Sold','Reserved','Returned','Defective')),
  purchase_id      UUID,
  sale_id          UUID,
  notes            TEXT,
  -- Complex schema fields (app/purchases/new page)
  imei_number      TEXT,
  brand            TEXT,
  model            TEXT,
  color            TEXT,
  storage_capacity TEXT,
  pta_status       TEXT,
  device_status    TEXT,
  purchase_price   NUMERIC,
  selling_price    NUMERIC,
  supplier_id      UUID        REFERENCES suppliers(id),
  supplier_name    TEXT,
  purchase_date    DATE,
  -- Update fields (app/sales/new page)
  sold_date        DATE,
  customer_id      UUID        REFERENCES customers(id),
  customer_name    TEXT,
  customer_phone   TEXT,
  -- Extra optional fields
  imei_2           TEXT,
  warranty_expiry  DATE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Partial unique indexes (both columns are nullable — NULLs allowed to coexist)
CREATE UNIQUE INDEX idx_imei_records_imei_unique
  ON imei_records(tenant_id, imei) WHERE imei IS NOT NULL;
CREATE UNIQUE INDEX idx_imei_records_imei_number_unique
  ON imei_records(tenant_id, imei_number) WHERE imei_number IS NOT NULL;

-- ============================================================================
-- 29. IMEI HISTORY
-- ============================================================================
CREATE TABLE imei_history (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  imei_record_id UUID        NOT NULL REFERENCES imei_records(id) ON DELETE CASCADE,
  date           TIMESTAMPTZ DEFAULT now(),
  event          TEXT,
  description    TEXT,
  performed_by   TEXT
);

-- ============================================================================
-- 30. STOCK ALERT RULES  (lib/api/inventory.ts)
-- INSERT: tenant_id, product_id, product_name, product_type, threshold,
--         current_stock, enabled
-- ============================================================================
CREATE TABLE stock_alert_rules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id    UUID,
  product_name  TEXT,
  product_type  TEXT        CHECK (product_type IN ('Mobile','Accessory')),
  threshold     INT         DEFAULT 5,
  current_stock INT         DEFAULT 0,
  enabled       BOOLEAN     DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 31. STOCK ALERT LOGS  (lib/api/inventory.ts)
-- NOTE: column is alerted_at (NOT triggered_at)
-- UPDATE: acknowledged = true
-- ============================================================================
CREATE TABLE stock_alert_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id       UUID        NOT NULL REFERENCES stock_alert_rules(id) ON DELETE CASCADE,
  product_name  TEXT,
  current_stock INT,
  threshold     INT,
  alerted_at    TIMESTAMPTZ DEFAULT now(),
  acknowledged  BOOLEAN     DEFAULT false
);

-- ============================================================================
-- 32. USED PHONES  — SUPERSET SCHEMA
--
-- Simple schema (lib/api/inventory.ts, DbUsedPhone interface):
--   INSERT: brand, model, imei, color, storage, ram, condition, grade,
--           purchase_price, selling_price, customer_id, customer_name,
--           defects, notes, status, date_added
--
-- Complex schema (app/purchases/new/page.tsx line 404-428):
--   INSERT: tenant_id, imei_number, brand, model, color, storage, ram,
--           condition_grade, battery_health, screen_condition, body_condition,
--           functional_issues[], accessories_included[], source_type,
--           source_customer_name, purchase_price, refurbishment_cost,
--           selling_price, pta_status, status, warranty_days, photos[],
--           date_added
--
-- No CHECK on status — simple uses 'In Stock'/'Sold'/'Listed',
--   complex uses 'in_stock' (lowercase). Both must work.
-- No CHECK on grade — code uses 'A+','A','B+','B','C','D'.
-- ============================================================================
CREATE TABLE used_phones (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Common fields
  brand                TEXT,
  model                TEXT,
  color                TEXT,
  storage              TEXT,
  ram                  TEXT,
  purchase_price       NUMERIC,
  selling_price        NUMERIC,
  status               TEXT,
  date_added           DATE        DEFAULT CURRENT_DATE,
  -- Simple schema (lib/api)
  imei                 TEXT,
  condition            TEXT,
  grade                TEXT,
  customer_id          UUID,
  customer_name        TEXT,
  defects              TEXT,
  notes                TEXT,
  -- Complex schema (purchases/new page)
  imei_number          TEXT,
  condition_grade      TEXT,
  battery_health       NUMERIC,
  screen_condition     TEXT,
  body_condition       TEXT,
  functional_issues    TEXT[]      DEFAULT '{}',
  accessories_included TEXT[]      DEFAULT '{}',
  source_type          TEXT,
  source_customer_id   UUID,
  source_customer_name TEXT,
  refurbishment_cost   NUMERIC     DEFAULT 0,
  pta_status           TEXT,
  warranty_days        INT         DEFAULT 7,
  photos               TEXT[]      DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 33. CONSIGNMENTS
-- ============================================================================
CREATE TABLE consignments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dispatch_number  TEXT,
  date             DATE        DEFAULT CURRENT_DATE,
  shop_id          UUID        REFERENCES shops(id),
  shop_name        TEXT,
  shop_phone       TEXT,
  total_value      NUMERIC,
  amount_collected NUMERIC     DEFAULT 0,
  status           TEXT        DEFAULT 'Active'
                               CHECK (status IN ('Active','Partially Settled','Fully Settled','Returned')),
  due_date         DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 34. CONSIGNMENT ITEMS
-- ============================================================================
CREATE TABLE consignment_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  consignment_id  UUID        NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
  product_id      UUID,
  product_name    TEXT,
  product_type    TEXT        CHECK (product_type IN ('Mobile','Accessory')),
  dispatched      INT,
  returned        INT         DEFAULT 0,
  sold            INT         DEFAULT 0,
  unit_price      NUMERIC,
  imeis           TEXT[]      DEFAULT '{}',
  sold_imeis      TEXT[]      DEFAULT '{}',
  returned_imeis  TEXT[]      DEFAULT '{}'
);

-- ============================================================================
-- 35. CONSIGNMENT TRANSACTIONS
-- ============================================================================
CREATE TABLE consignment_transactions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  consignment_id UUID        NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
  date           DATE        DEFAULT CURRENT_DATE,
  type           TEXT        CHECK (type IN ('Sale','Return')),
  amount         NUMERIC,
  payment_method TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 36. CONSIGNMENT TRANSACTION ITEMS
-- ============================================================================
CREATE TABLE consignment_transaction_items (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID        NOT NULL REFERENCES consignment_transactions(id) ON DELETE CASCADE,
  product_id     UUID,
  product_name   TEXT,
  quantity       INT,
  unit_price     NUMERIC,
  imeis          TEXT[]      DEFAULT '{}'
);

-- ============================================================================
-- 37. RESERVED SALES
-- ============================================================================
CREATE TABLE reserved_sales (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_number TEXT,
  date               DATE        DEFAULT CURRENT_DATE,
  shop_id            UUID        REFERENCES shops(id),
  shop_name          TEXT,
  shop_phone         TEXT,
  subtotal           NUMERIC,
  discount           NUMERIC     DEFAULT 0,
  total              NUMERIC,
  advance_paid       NUMERIC     DEFAULT 0,
  balance_due        NUMERIC,
  status             TEXT        DEFAULT 'Reserved'
                                 CHECK (status IN ('Reserved','Confirmed','Cancelled')),
  reserved_until     DATE,
  payment_method     TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 38. RESERVED SALE ITEMS
-- ============================================================================
CREATE TABLE reserved_sale_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reserved_sale_id UUID        NOT NULL REFERENCES reserved_sales(id) ON DELETE CASCADE,
  product_id       UUID,
  product_name     TEXT,
  product_type     TEXT        CHECK (product_type IN ('Mobile','Accessory')),
  quantity         INT,
  unit_price       NUMERIC,
  discount         NUMERIC     DEFAULT 0,
  line_total       NUMERIC
);

-- ============================================================================
-- 39. AUDIT LOGS
-- ============================================================================
CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  timestamp   TIMESTAMPTZ DEFAULT now(),
  user_id     UUID        REFERENCES profiles(id),
  user_name   TEXT,
  user_role   TEXT,
  action      TEXT        CHECK (action IN (
                'Create','Update','Delete','Login','Logout',
                'Export','Print','Void','Refund','Approve','Reject')),
  module      TEXT        CHECK (module IN (
                'Sales','Purchases','Inventory','Customers','Suppliers',
                'Expenses','Returns','Repairs','Warranty','Settings',
                'Users','Reports','IMEI','Shops','Consignments','Auth')),
  entity_id   TEXT,
  entity_name TEXT,
  description TEXT,
  old_value   TEXT,
  new_value   TEXT,
  ip_address  TEXT
);

-- ============================================================================
-- 40. TENANT SETTINGS
-- lib/api/auth.ts inserts: tenant_id, low_stock_threshold, default_warranty_months,
--   invoice_prefix, po_prefix, return_prefix, reservation_prefix,
--   consignment_prefix, repair_prefix, tax_enabled, tax_rate, currency,
--   date_format, receipt_footer
-- context/auth-context.tsx inserts: { tenant_id } only (rest use defaults)
-- ============================================================================
CREATE TABLE tenant_settings (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  low_stock_threshold     INT         DEFAULT 5,
  default_warranty_months INT         DEFAULT 12,
  invoice_prefix          TEXT        DEFAULT 'INV',
  po_prefix               TEXT        DEFAULT 'PO',
  return_prefix           TEXT        DEFAULT 'RET',
  reservation_prefix      TEXT        DEFAULT 'RSV',
  consignment_prefix      TEXT        DEFAULT 'CON',
  repair_prefix           TEXT        DEFAULT 'RPR',
  tax_enabled             BOOLEAN     DEFAULT false,
  tax_rate                NUMERIC     DEFAULT 0,
  currency                TEXT        DEFAULT 'PKR',
  date_format             TEXT        DEFAULT 'DD/MM/YYYY',
  receipt_footer          TEXT        DEFAULT 'Thank you for your business!',
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_profiles_tenant              ON profiles(tenant_id);
CREATE INDEX idx_profiles_email               ON profiles(email);
CREATE INDEX idx_suppliers_tenant             ON suppliers(tenant_id);
CREATE INDEX idx_customers_tenant             ON customers(tenant_id);
CREATE INDEX idx_brands_tenant                ON brands(tenant_id);
CREATE INDEX idx_categories_tenant            ON categories(tenant_id);
CREATE INDEX idx_colors_tenant                ON colors(tenant_id);
CREATE INDEX idx_storage_options_tenant       ON storage_options(tenant_id);
CREATE INDEX idx_ram_options_tenant           ON ram_options(tenant_id);
CREATE INDEX idx_iphone_models_tenant         ON iphone_models(tenant_id);
CREATE INDEX idx_conditions_tenant            ON conditions(tenant_id);
CREATE INDEX idx_invitations_tenant           ON invitations(tenant_id);
CREATE INDEX idx_mobiles_tenant               ON mobiles(tenant_id);
CREATE INDEX idx_mobiles_brand                ON mobiles(tenant_id, brand);
CREATE INDEX idx_mobiles_imei                 ON mobiles(tenant_id, imei);
CREATE INDEX idx_accessories_tenant           ON accessories(tenant_id);
CREATE INDEX idx_shops_tenant                 ON shops(tenant_id);
CREATE INDEX idx_sales_tenant_date            ON sales(tenant_id, date DESC);
CREATE INDEX idx_sales_customer               ON sales(tenant_id, customer_id);
CREATE INDEX idx_sale_items_tenant            ON sale_items(tenant_id);
CREATE INDEX idx_sale_items_sale              ON sale_items(sale_id);
CREATE INDEX idx_purchases_tenant_date        ON purchases(tenant_id, date DESC);
CREATE INDEX idx_purchases_supplier           ON purchases(tenant_id, supplier_id);
CREATE INDEX idx_purchase_items_tenant        ON purchase_items(tenant_id);
CREATE INDEX idx_purchase_items_purchase      ON purchase_items(purchase_id);
CREATE INDEX idx_expenses_tenant_date         ON expenses(tenant_id, date DESC);
CREATE INDEX idx_returns_tenant_date          ON returns(tenant_id, date DESC);
CREATE INDEX idx_return_items_tenant          ON return_items(tenant_id);
CREATE INDEX idx_return_items_return          ON return_items(return_id);
CREATE INDEX idx_payments_tenant_date         ON payments(tenant_id, date DESC);
CREATE INDEX idx_warranty_records_tenant      ON warranty_records(tenant_id);
CREATE INDEX idx_warranty_claims_tenant       ON warranty_claims(tenant_id);
CREATE INDEX idx_warranty_claims_warranty     ON warranty_claims(warranty_id);
CREATE INDEX idx_repair_tickets_tenant        ON repair_tickets(tenant_id);
CREATE INDEX idx_repair_parts_tenant          ON repair_parts(tenant_id);
CREATE INDEX idx_repair_parts_ticket          ON repair_parts(repair_ticket_id);
CREATE INDEX idx_imei_records_tenant          ON imei_records(tenant_id);
CREATE INDEX idx_imei_records_product         ON imei_records(tenant_id, product_id);
CREATE INDEX idx_imei_records_imei_number     ON imei_records(tenant_id, imei_number);
CREATE INDEX idx_stock_alert_rules_tenant     ON stock_alert_rules(tenant_id);
CREATE INDEX idx_stock_alert_logs_tenant      ON stock_alert_logs(tenant_id);
CREATE INDEX idx_used_phones_tenant           ON used_phones(tenant_id);
CREATE INDEX idx_consignments_tenant          ON consignments(tenant_id);
CREATE INDEX idx_consignment_items_tenant     ON consignment_items(tenant_id);
CREATE INDEX idx_consignment_items_parent     ON consignment_items(consignment_id);
CREATE INDEX idx_consignment_txns_tenant      ON consignment_transactions(tenant_id);
CREATE INDEX idx_consignment_txns_parent      ON consignment_transactions(consignment_id);
CREATE INDEX idx_reserved_sales_tenant        ON reserved_sales(tenant_id);
CREATE INDEX idx_reserved_sale_items_tenant   ON reserved_sale_items(tenant_id);
CREATE INDEX idx_reserved_sale_items_parent   ON reserved_sale_items(reserved_sale_id);
CREATE INDEX idx_audit_logs_tenant            ON audit_logs(tenant_id, timestamp DESC);


-- ============================================================================
-- ROW LEVEL SECURITY
--
-- IMPORTANT: This app uses context/auth-context.tsx for authentication, which
-- stores sessions in localStorage and makes Supabase requests as the anon
-- user WITHOUT going through Supabase Auth. Therefore auth.uid() is always
-- NULL for all client queries, and uid-based policies would block everything.
--
-- All policies below use USING (true) to allow all rows through RLS while
-- keeping the RLS framework in place. If you switch to Supabase Auth in the
-- future, replace USING (true) with proper tenant-scoped expressions.
-- ============================================================================

ALTER TABLE tenants                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE colors                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_options            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ram_options                ENABLE ROW LEVEL SECURITY;
ALTER TABLE iphone_models              ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations                ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories                ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_records           ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_claims            ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_tickets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_parts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE imei_records               ENABLE ROW LEVEL SECURITY;
ALTER TABLE imei_history               ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alert_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alert_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE used_phones                ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignment_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignment_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE consignment_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserved_sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserved_sale_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON tenants                       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON profiles                      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON suppliers                     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON customers                     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON brands                        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON categories                    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON colors                        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON storage_options               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON ram_options                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON iphone_models                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON conditions                    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON invitations                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON mobiles                       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON accessories                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON shops                         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sales                         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sale_items                    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON purchases                     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON purchase_items                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON expenses                      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON returns                       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON return_items                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON payments                      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON warranty_records              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON warranty_claims               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON repair_tickets                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON repair_parts                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON imei_records                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON imei_history                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON stock_alert_rules             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON stock_alert_logs              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON used_phones                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON consignments                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON consignment_items             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON consignment_transactions      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON consignment_transaction_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON reserved_sales                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON reserved_sale_items           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON audit_logs                    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON tenant_settings               FOR ALL USING (true) WITH CHECK (true);


-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- A. updated_at auto-timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants                  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles                 FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON suppliers                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON mobiles                  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON accessories              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sales                    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON purchases                FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON expenses                 FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON shops                    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON warranty_records         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON repair_tickets           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON imei_records             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON used_phones              FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON consignments             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reserved_sales           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenant_settings          FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- B. Customer loyalty tier auto-calculation
CREATE OR REPLACE FUNCTION update_customer_loyalty()
RETURNS TRIGGER AS $$
BEGIN
  NEW.loyalty_tier := CASE
    WHEN NEW.total_spent >= 500000 THEN 'Platinum'
    WHEN NEW.total_spent >= 200000 THEN 'Gold'
    WHEN NEW.total_spent >= 50000  THEN 'Silver'
    ELSE 'Bronze'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_loyalty_trigger
  BEFORE INSERT OR UPDATE OF total_spent ON customers
  FOR EACH ROW EXECUTE FUNCTION update_customer_loyalty();

-- C. Stock decrement on sale item insert
CREATE OR REPLACE FUNCTION decrement_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_type = 'Mobile' THEN
    UPDATE mobiles     SET stock = GREATEST(0, stock - NEW.quantity) WHERE id = NEW.product_id;
  ELSIF NEW.product_type = 'Accessory' THEN
    UPDATE accessories SET stock = GREATEST(0, stock - NEW.quantity) WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sale_item_stock_decrement
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION decrement_stock_on_sale();

-- D. Stock increment on purchase item insert
CREATE OR REPLACE FUNCTION increment_stock_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_type = 'Mobile' THEN
    UPDATE mobiles     SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.product_type = 'Accessory' THEN
    UPDATE accessories SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER purchase_item_stock_increment
  AFTER INSERT ON purchase_items
  FOR EACH ROW EXECUTE FUNCTION increment_stock_on_purchase();

-- E. Auto-update customer stats when a completed sale is recorded
CREATE OR REPLACE FUNCTION update_customer_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'Completed' THEN
    UPDATE customers SET
      total_purchases    = total_purchases + 1,
      total_spent        = total_spent + COALESCE(NEW.total, 0),
      last_purchase_date = NEW.date
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sale_update_customer
  AFTER INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION update_customer_on_sale();

-- F. Auto-update supplier stats when a purchase is recorded
CREATE OR REPLACE FUNCTION update_supplier_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.supplier_id IS NOT NULL THEN
    UPDATE suppliers SET
      total_purchases     = total_purchases + 1,
      outstanding_balance = outstanding_balance + COALESCE(NEW.balance_due, 0)
    WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER purchase_update_supplier
  AFTER INSERT ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_supplier_on_purchase();

-- ============================================================================
-- GRANTS
-- Required so the Supabase anon/authenticated roles (used by the JS client)
-- can read and write all tables. Without these, every query returns 0 rows.
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

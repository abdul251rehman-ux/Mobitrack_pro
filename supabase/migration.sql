-- ============================================================================
-- MobiTrack Pro — Complete Supabase Migration
-- Multi-tenant, multi-user mobile shop management system
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TENANTS — top-level entity; each tenant = one mobile shop business
-- ============================================================================

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  ntn TEXT,                        -- tax registration number
  currency TEXT DEFAULT 'PKR',
  logo_url TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Cancelled')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. PROFILES — linked to auth.users; maps every user to a tenant + role
-- ============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'Cashier' CHECK (role IN ('Admin', 'Manager', 'Cashier')),
  avatar_url TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. SUPPLIERS
-- ============================================================================

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  total_purchases NUMERIC DEFAULT 0,
  outstanding_balance NUMERIC DEFAULT 0,
  rating NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 4. CUSTOMERS
-- ============================================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  total_purchases INT DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_purchase_date DATE,
  loyalty_tier TEXT DEFAULT 'Bronze' CHECK (loyalty_tier IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 5. BRANDS
-- ============================================================================

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_initials TEXT,
  country TEXT,
  mobile_count INT DEFAULT 0,
  accessory_count INT DEFAULT 0,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 6. CATEGORIES
-- ============================================================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Mobile', 'Accessory', 'Both')),
  description TEXT,
  item_count INT DEFAULT 0,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 7. MOBILES
-- ============================================================================

CREATE TABLE mobiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand TEXT,
  model TEXT,
  imei TEXT,
  color TEXT,
  storage TEXT,
  ram TEXT,
  purchase_price NUMERIC,
  selling_price NUMERIC,
  supplier_id UUID REFERENCES suppliers(id),
  stock INT DEFAULT 0,
  condition TEXT DEFAULT 'New',
  category TEXT DEFAULT '',
  device_type TEXT DEFAULT 'android' CHECK (device_type IN ('android', 'iphone')),
  battery_health INT,
  notes TEXT,
  image_url TEXT,
  date_added DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- IMEI must be unique within a tenant (allow NULLs)
CREATE UNIQUE INDEX idx_mobiles_imei_unique ON mobiles(tenant_id, imei) WHERE imei IS NOT NULL;

-- ============================================================================
-- 8. ACCESSORIES
-- ============================================================================

CREATE TABLE accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT,
  sku TEXT,
  category TEXT,
  purchase_price NUMERIC,
  selling_price NUMERIC,
  stock INT DEFAULT 0,
  supplier_id UUID REFERENCES suppliers(id),
  compatible_models TEXT[] DEFAULT '{}',
  description TEXT,
  image_url TEXT,
  date_added DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 9. SALES
-- ============================================================================

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number TEXT,
  date DATE DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  subtotal NUMERIC,
  discount NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC,
  payment_method TEXT,
  amount_received NUMERIC,
  change_due NUMERIC,
  status TEXT DEFAULT 'Completed' CHECK (status IN ('Completed', 'Pending', 'Refunded')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 10. SALE ITEMS
-- ============================================================================

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT,
  product_type TEXT CHECK (product_type IN ('Mobile', 'Accessory')),
  quantity INT,
  unit_price NUMERIC,
  discount NUMERIC DEFAULT 0,
  line_total NUMERIC,
  imei TEXT
);

-- ============================================================================
-- 11. PURCHASES
-- ============================================================================

CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  po_number TEXT,
  date DATE DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name TEXT,
  subtotal NUMERIC,
  shipping_cost NUMERIC DEFAULT 0,
  tax NUMERIC DEFAULT 0,
  total NUMERIC,
  amount_paid NUMERIC DEFAULT 0,
  balance_due NUMERIC,
  payment_status TEXT DEFAULT 'Unpaid' CHECK (payment_status IN ('Paid', 'Partial', 'Unpaid')),
  delivery_status TEXT DEFAULT 'Pending' CHECK (delivery_status IN ('Received', 'Pending', 'Partial')),
  payment_method TEXT,
  due_date DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 12. PURCHASE ITEMS
-- ============================================================================

CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT,
  product_type TEXT CHECK (product_type IN ('Mobile', 'Accessory')),
  quantity INT,
  unit_cost NUMERIC,
  total NUMERIC,
  imeis TEXT[] DEFAULT '{}'
);

-- ============================================================================
-- 13. EXPENSES
-- ============================================================================

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT CHECK (category IN (
    'Rent', 'Utilities', 'Salaries', 'Marketing', 'Maintenance',
    'Transportation', 'Office Supplies', 'Insurance', 'Taxes',
    'Miscellaneous', 'Other'
  )),
  amount NUMERIC NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  type TEXT CHECK (type IN ('one-time', 'daily', 'monthly', 'yearly')),
  payment_method TEXT,
  status TEXT DEFAULT 'Paid' CHECK (status IN ('Paid', 'Pending')),
  notes TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_day INT,
  recurring_month INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 14. SHOPS — other shops / dealers that you sell to (B2B)
-- ============================================================================

CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  shop_type TEXT CHECK (shop_type IN ('Retailer', 'Dealer', 'Wholesaler', 'Repair Shop')),
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  total_orders INT DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  outstanding_balance NUMERIC DEFAULT 0,
  last_order_date DATE,
  notes TEXT,
  date_added DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 15. RETURNS
-- ============================================================================

CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  return_number TEXT,
  date DATE DEFAULT CURRENT_DATE,
  sale_id UUID REFERENCES sales(id),
  invoice_number TEXT,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  reason TEXT CHECK (reason IN (
    'Defective', 'Wrong Item', 'Customer Changed Mind', 'Damaged',
    'Not As Described', 'Warranty Claim', 'Other'
  )),
  subtotal NUMERIC,
  refund_amount NUMERIC,
  refund_method TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Completed', 'Exchanged')),
  restock_items BOOLEAN DEFAULT true,
  exchange_sale_id UUID,
  processed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- 16. RETURN ITEMS
-- ============================================================================

CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT,
  product_type TEXT CHECK (product_type IN ('Mobile', 'Accessory')),
  quantity INT,
  unit_price NUMERIC,
  line_total NUMERIC,
  imei TEXT,
  condition TEXT CHECK (condition IN ('Good', 'Damaged', 'Defective'))
);

-- ============================================================================
-- 17. PAYMENTS
-- ============================================================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  type TEXT CHECK (type IN ('Received', 'Paid')),
  entity_type TEXT CHECK (entity_type IN ('Customer', 'Supplier')),
  entity_id UUID,
  entity_name TEXT,
  reference_type TEXT CHECK (reference_type IN ('Sale', 'Purchase', 'Return', 'Advance', 'Settlement')),
  reference_id UUID,
  reference_number TEXT,
  amount NUMERIC NOT NULL,
  method TEXT,
  status TEXT DEFAULT 'Completed' CHECK (status IN ('Completed', 'Pending', 'Failed', 'Cancelled')),
  notes TEXT,
  processed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 18. WARRANTY RECORDS
-- ============================================================================

CREATE TABLE warranty_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT,
  product_type TEXT CHECK (product_type IN ('Mobile', 'Accessory')),
  imei TEXT,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  sale_id UUID REFERENCES sales(id),
  invoice_number TEXT,
  purchase_date DATE,
  warranty_months INT,
  expiry_date DATE,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Claimed', 'Voided')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 19. WARRANTY CLAIMS
-- ============================================================================

CREATE TABLE warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_id UUID NOT NULL REFERENCES warranty_records(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  issue TEXT,
  resolution TEXT,
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Rejected')),
  repair_ticket_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 20. REPAIR TICKETS
-- ============================================================================

CREATE TABLE repair_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_number TEXT,
  date DATE DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  customer_phone TEXT,
  device_brand TEXT,
  device_model TEXT,
  imei TEXT,
  issue TEXT,
  diagnosis TEXT,
  priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT DEFAULT 'Received' CHECK (status IN (
    'Received', 'Diagnosing', 'In Repair', 'Waiting Parts',
    'Repaired', 'Delivered', 'Cancelled'
  )),
  estimated_cost NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  warranty_claim_id UUID,
  technician_name TEXT,
  received_date DATE,
  estimated_completion_date DATE,
  completed_date DATE,
  delivered_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 21. REPAIR PARTS
-- ============================================================================

CREATE TABLE repair_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES repair_tickets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cost NUMERIC,
  quantity INT DEFAULT 1
);

-- ============================================================================
-- 22. IMEI RECORDS — centralised IMEI tracking with PTA status
-- ============================================================================

CREATE TABLE imei_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  imei_number TEXT NOT NULL,
  imei_2 TEXT,
  brand TEXT,
  model TEXT,
  color TEXT,
  storage_capacity TEXT,
  pta_status TEXT CHECK (pta_status IN ('approved', 'blocked', 'pending', 'not_registered')),
  pta_tax_amount NUMERIC DEFAULT 0,
  device_status TEXT DEFAULT 'in_stock' CHECK (device_status IN (
    'in_stock', 'sold', 'returned', 'defective', 'stolen', 'lost'
  )),
  purchase_price NUMERIC,
  selling_price NUMERIC,
  supplier_id UUID,
  supplier_name TEXT,
  customer_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  purchase_date DATE,
  sold_date DATE,
  warranty_expiry DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, imei_number)
);

-- ============================================================================
-- 23. IMEI HISTORY — audit trail for each IMEI
-- ============================================================================

CREATE TABLE imei_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imei_record_id UUID NOT NULL REFERENCES imei_records(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT now(),
  event TEXT,
  description TEXT,
  performed_by TEXT
);

-- ============================================================================
-- 24. STOCK ALERT RULES
-- ============================================================================

CREATE TABLE stock_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_type TEXT CHECK (product_type IN ('Mobile', 'Accessory')),
  brand TEXT,
  model TEXT,
  category TEXT,
  minimum_stock INT DEFAULT 5,
  reorder_quantity INT DEFAULT 10,
  preferred_supplier_id UUID,
  notification_channels TEXT[] DEFAULT '{dashboard}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 25. STOCK ALERT LOGS
-- ============================================================================

CREATE TABLE stock_alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES stock_alert_rules(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_type TEXT CHECK (alert_type IN ('out_of_stock', 'low_stock', 'overstock')),
  product_name TEXT,
  current_stock INT,
  threshold INT,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- 26. USED PHONES — trade-ins and second-hand inventory
-- ============================================================================

CREATE TABLE used_phones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  imei_number TEXT,
  brand TEXT,
  model TEXT,
  color TEXT,
  storage TEXT,
  ram TEXT,
  condition_grade TEXT CHECK (condition_grade IN ('A+', 'A', 'B+', 'B', 'C', 'D')),
  battery_health INT,
  screen_condition TEXT,
  body_condition TEXT,
  functional_issues TEXT[] DEFAULT '{}',
  accessories_included TEXT[] DEFAULT '{}',
  source_type TEXT CHECK (source_type IN (
    'customer_trade_in', 'purchased', 'refurbished_in_house', 'auction'
  )),
  source_customer_id UUID,
  source_customer_name TEXT,
  purchase_price NUMERIC,
  refurbishment_cost NUMERIC DEFAULT 0,
  selling_price NUMERIC,
  pta_status TEXT,
  warranty_days INT DEFAULT 0,
  photos TEXT[] DEFAULT '{}',
  notes TEXT,
  date_added DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 27. CONSIGNMENTS — goods dispatched to other shops on credit
-- ============================================================================

CREATE TABLE consignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dispatch_number TEXT,
  date DATE DEFAULT CURRENT_DATE,
  shop_id UUID REFERENCES shops(id),
  shop_name TEXT,
  shop_phone TEXT,
  total_value NUMERIC,
  amount_collected NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Partially Settled', 'Fully Settled', 'Returned')),
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 28. CONSIGNMENT ITEMS
-- ============================================================================

CREATE TABLE consignment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_id UUID NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT,
  product_type TEXT CHECK (product_type IN ('Mobile', 'Accessory')),
  dispatched INT,
  returned INT DEFAULT 0,
  sold INT DEFAULT 0,
  unit_price NUMERIC,
  imeis TEXT[] DEFAULT '{}',
  sold_imeis TEXT[] DEFAULT '{}',
  returned_imeis TEXT[] DEFAULT '{}'
);

-- ============================================================================
-- 29. CONSIGNMENT TRANSACTIONS
-- ============================================================================

CREATE TABLE consignment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_id UUID NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  type TEXT CHECK (type IN ('Sale', 'Return')),
  amount NUMERIC,
  payment_method TEXT,
  notes TEXT
);

-- ============================================================================
-- 30. RESERVED SALES — bookings / holds for dealer shops
-- ============================================================================

CREATE TABLE reserved_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_number TEXT,
  date DATE DEFAULT CURRENT_DATE,
  shop_id UUID REFERENCES shops(id),
  shop_name TEXT,
  shop_phone TEXT,
  subtotal NUMERIC,
  discount NUMERIC DEFAULT 0,
  total NUMERIC,
  advance_paid NUMERIC DEFAULT 0,
  balance_due NUMERIC,
  status TEXT DEFAULT 'Reserved' CHECK (status IN ('Reserved', 'Confirmed', 'Cancelled')),
  reserved_until DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 31. RESERVED SALE ITEMS
-- ============================================================================

CREATE TABLE reserved_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserved_sale_id UUID NOT NULL REFERENCES reserved_sales(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT,
  product_type TEXT CHECK (product_type IN ('Mobile', 'Accessory')),
  quantity INT,
  unit_price NUMERIC,
  discount NUMERIC DEFAULT 0,
  line_total NUMERIC
);

-- ============================================================================
-- 32. AUDIT LOGS — immutable record of all user actions
-- ============================================================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES profiles(id),
  user_name TEXT,
  user_role TEXT,
  action TEXT CHECK (action IN (
    'Create', 'Update', 'Delete', 'Login', 'Logout',
    'Export', 'Print', 'Void', 'Refund', 'Approve', 'Reject'
  )),
  module TEXT CHECK (module IN (
    'Sales', 'Purchases', 'Inventory', 'Customers', 'Suppliers',
    'Expenses', 'Returns', 'Repairs', 'Warranty', 'Settings',
    'Users', 'Reports', 'IMEI', 'Shops', 'Consignments', 'Auth'
  )),
  entity_id TEXT,
  entity_name TEXT,
  description TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT
);

-- ============================================================================
-- 33. TENANT SETTINGS — per-tenant configuration (invoice prefixes, etc.)
-- ============================================================================

CREATE TABLE tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  tax_rate NUMERIC DEFAULT 0,
  invoice_prefix TEXT DEFAULT 'INV',
  invoice_next_number INT DEFAULT 1,
  po_prefix TEXT DEFAULT 'PO',
  po_next_number INT DEFAULT 1,
  return_prefix TEXT DEFAULT 'RET',
  return_next_number INT DEFAULT 1,
  ticket_prefix TEXT DEFAULT 'RPR',
  ticket_next_number INT DEFAULT 1,
  invoice_footer TEXT,
  invoice_terms TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================================
-- INDEXES — performance indexes for common query patterns
-- ============================================================================

CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_mobiles_tenant ON mobiles(tenant_id);
CREATE INDEX idx_mobiles_brand ON mobiles(tenant_id, brand);
CREATE INDEX idx_mobiles_imei ON mobiles(tenant_id, imei);
CREATE INDEX idx_accessories_tenant ON accessories(tenant_id);
CREATE INDEX idx_sales_tenant_date ON sales(tenant_id, date DESC);
CREATE INDEX idx_sales_customer ON sales(tenant_id, customer_id);
CREATE INDEX idx_purchases_tenant_date ON purchases(tenant_id, date DESC);
CREATE INDEX idx_purchases_supplier ON purchases(tenant_id, supplier_id);
CREATE INDEX idx_expenses_tenant_date ON expenses(tenant_id, date DESC);
CREATE INDEX idx_payments_tenant_date ON payments(tenant_id, date DESC);
CREATE INDEX idx_returns_tenant ON returns(tenant_id, date DESC);
CREATE INDEX idx_warranty_tenant ON warranty_records(tenant_id);
CREATE INDEX idx_repair_tickets_tenant ON repair_tickets(tenant_id);
CREATE INDEX idx_imei_records_tenant ON imei_records(tenant_id);
CREATE INDEX idx_shops_tenant ON shops(tenant_id);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, timestamp DESC);
CREATE INDEX idx_consignments_tenant ON consignments(tenant_id);
CREATE INDEX idx_reserved_sales_tenant ON reserved_sales(tenant_id);
CREATE INDEX idx_used_phones_tenant ON used_phones(tenant_id);
CREATE INDEX idx_stock_alert_rules_tenant ON stock_alert_rules(tenant_id);
CREATE INDEX idx_stock_alert_logs_tenant ON stock_alert_logs(tenant_id);


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) — tenant isolation for every table
-- ============================================================================

-- ---- tenants ---------------------------------------------------------------
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_own" ON tenants
  FOR ALL
  USING (id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ---- profiles --------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_profiles" ON profiles
  FOR SELECT
  USING (tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "own_profile_update" ON profiles
  FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "admin_manage_profiles" ON profiles
  FOR ALL
  USING (
    tenant_id = (SELECT p.tenant_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) = 'Admin'
  );

-- ---- Helper: macro for standard tenant-isolation policy --------------------
-- We apply the same pattern to every tenant-scoped table.

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON suppliers
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON customers
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON brands
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON categories
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE mobiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON mobiles
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON accessories
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON sales
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON purchases
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON expenses
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON shops
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON returns
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON payments
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE warranty_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON warranty_records
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE repair_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON repair_tickets
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE imei_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON imei_records
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE stock_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON stock_alert_rules
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE stock_alert_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON stock_alert_logs
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE used_phones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON used_phones
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE consignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON consignments
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE reserved_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON reserved_sales
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON audit_logs
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON tenant_settings
  FOR ALL
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Child tables (no tenant_id) inherit access through their parent FK + RLS.
-- We still enable RLS and create permissive policies based on the parent row.

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_items_via_sale" ON sale_items
  FOR ALL
  USING (sale_id IN (SELECT id FROM sales))
  WITH CHECK (sale_id IN (SELECT id FROM sales));

ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_items_via_purchase" ON purchase_items
  FOR ALL
  USING (purchase_id IN (SELECT id FROM purchases))
  WITH CHECK (purchase_id IN (SELECT id FROM purchases));

ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return_items_via_return" ON return_items
  FOR ALL
  USING (return_id IN (SELECT id FROM returns))
  WITH CHECK (return_id IN (SELECT id FROM returns));

ALTER TABLE warranty_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warranty_claims_via_warranty" ON warranty_claims
  FOR ALL
  USING (warranty_id IN (SELECT id FROM warranty_records))
  WITH CHECK (warranty_id IN (SELECT id FROM warranty_records));

ALTER TABLE repair_parts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repair_parts_via_ticket" ON repair_parts
  FOR ALL
  USING (ticket_id IN (SELECT id FROM repair_tickets))
  WITH CHECK (ticket_id IN (SELECT id FROM repair_tickets));

ALTER TABLE imei_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "imei_history_via_record" ON imei_history
  FOR ALL
  USING (imei_record_id IN (SELECT id FROM imei_records))
  WITH CHECK (imei_record_id IN (SELECT id FROM imei_records));

ALTER TABLE consignment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consignment_items_via_consignment" ON consignment_items
  FOR ALL
  USING (consignment_id IN (SELECT id FROM consignments))
  WITH CHECK (consignment_id IN (SELECT id FROM consignments));

ALTER TABLE consignment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consignment_txns_via_consignment" ON consignment_transactions
  FOR ALL
  USING (consignment_id IN (SELECT id FROM consignments))
  WITH CHECK (consignment_id IN (SELECT id FROM consignments));

ALTER TABLE reserved_sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reserved_items_via_reserved_sale" ON reserved_sale_items
  FOR ALL
  USING (reserved_sale_id IN (SELECT id FROM reserved_sales))
  WITH CHECK (reserved_sale_id IN (SELECT id FROM reserved_sales));


-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. updated_at auto-timestamp (applied to all tables that have updated_at)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON suppliers         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON mobiles           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON accessories       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sales             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON purchases         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON expenses          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON shops             FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON warranty_records  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON repair_tickets    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON imei_records      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON used_phones       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON consignments      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON reserved_sales    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenant_settings   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- B. Auto-create tenant + profile when a new user signs up via Supabase Auth
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- Create a new tenant for the first-time user
  INSERT INTO tenants (name, owner_name, email)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'shop_name', 'My Shop'),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email
  )
  RETURNING id INTO new_tenant_id;

  -- Create profile linked to the new tenant; first user is always Admin
  INSERT INTO profiles (id, tenant_id, name, email, phone, role)
  VALUES (
    NEW.id,
    new_tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'Admin'
  );

  -- Create default settings row for the tenant
  INSERT INTO tenant_settings (tenant_id) VALUES (new_tenant_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ----------------------------------------------------------------------------
-- C. Auto-generate sequential document numbers
-- ----------------------------------------------------------------------------

-- Invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  settings RECORD;
  inv_number TEXT;
BEGIN
  SELECT * INTO settings FROM tenant_settings WHERE tenant_id = p_tenant_id FOR UPDATE;
  inv_number := settings.invoice_prefix || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(settings.invoice_next_number::TEXT, 4, '0');
  UPDATE tenant_settings SET invoice_next_number = invoice_next_number + 1 WHERE tenant_id = p_tenant_id;
  RETURN inv_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Purchase order number
CREATE OR REPLACE FUNCTION generate_po_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  settings RECORD;
  po_num TEXT;
BEGIN
  SELECT * INTO settings FROM tenant_settings WHERE tenant_id = p_tenant_id FOR UPDATE;
  po_num := settings.po_prefix || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(settings.po_next_number::TEXT, 4, '0');
  UPDATE tenant_settings SET po_next_number = po_next_number + 1 WHERE tenant_id = p_tenant_id;
  RETURN po_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Return number
CREATE OR REPLACE FUNCTION generate_return_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  settings RECORD;
  ret_num TEXT;
BEGIN
  SELECT * INTO settings FROM tenant_settings WHERE tenant_id = p_tenant_id FOR UPDATE;
  ret_num := settings.return_prefix || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(settings.return_next_number::TEXT, 4, '0');
  UPDATE tenant_settings SET return_next_number = return_next_number + 1 WHERE tenant_id = p_tenant_id;
  RETURN ret_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Repair ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
  settings RECORD;
  tkt_num TEXT;
BEGIN
  SELECT * INTO settings FROM tenant_settings WHERE tenant_id = p_tenant_id FOR UPDATE;
  tkt_num := settings.ticket_prefix || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || LPAD(settings.ticket_next_number::TEXT, 4, '0');
  UPDATE tenant_settings SET ticket_next_number = ticket_next_number + 1 WHERE tenant_id = p_tenant_id;
  RETURN tkt_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- D. Customer loyalty tier auto-calculation
-- ----------------------------------------------------------------------------

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
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_loyalty();

-- ----------------------------------------------------------------------------
-- E. Stock decrement on sale
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION decrement_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_type = 'Mobile' THEN
    UPDATE mobiles SET stock = GREATEST(0, stock - NEW.quantity) WHERE id = NEW.product_id;
  ELSE
    UPDATE accessories SET stock = GREATEST(0, stock - NEW.quantity) WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sale_item_stock_decrement
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION decrement_stock_on_sale();

-- ----------------------------------------------------------------------------
-- F. Stock increment on purchase
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_stock_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.product_type = 'Mobile' THEN
    UPDATE mobiles SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  ELSE
    UPDATE accessories SET stock = stock + NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER purchase_item_stock_increment
  AFTER INSERT ON purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION increment_stock_on_purchase();

-- ----------------------------------------------------------------------------
-- G. Auto-update customer stats when a sale is completed
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_customer_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NEW.status = 'Completed' THEN
    UPDATE customers SET
      total_purchases = total_purchases + 1,
      total_spent = total_spent + NEW.total,
      last_purchase_date = NEW.date
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sale_update_customer
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_on_sale();

-- ----------------------------------------------------------------------------
-- H. Auto-update supplier stats when a purchase is recorded
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_supplier_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers SET
    total_purchases = total_purchases + 1,
    outstanding_balance = outstanding_balance + NEW.balance_due
  WHERE id = NEW.supplier_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER purchase_update_supplier
  AFTER INSERT ON purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_supplier_on_purchase();


-- ============================================================================
-- ADD battery_health COLUMN TO mobiles TABLE
-- ============================================================================
ALTER TABLE mobiles ADD COLUMN IF NOT EXISTS battery_health INT;

-- ============================================================================
-- ADD device_type COLUMN TO mobiles TABLE (android / iphone)
-- ============================================================================
ALTER TABLE mobiles ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'android';

-- Remove restrictive CHECK constraints on condition and category
-- so that dynamic values from the categories/conditions tables are accepted
ALTER TABLE mobiles DROP CONSTRAINT IF EXISTS mobiles_condition_check;
ALTER TABLE mobiles DROP CONSTRAINT IF EXISTS mobiles_category_check;

-- ============================================================================
-- END OF MIGRATION
-- Run this in Supabase SQL Editor as a single transaction.
-- ============================================================================

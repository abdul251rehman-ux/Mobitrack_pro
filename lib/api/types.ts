import type {
  Mobile,
  Accessory,
  Supplier,
  Customer,
  Sale,
  SaleItem,
  Purchase,
  PurchaseItem,
  Expense,
  Shop,
  ReservedSale,
  ReservedSaleItem,
  Consignment,
  ConsignmentItem,
  ConsignmentTransaction,
  Return,
  ReturnItem,
  Payment,
  WarrantyRecord,
  WarrantyClaim,
  RepairTicket,
  RepairPart,
  AuditLog,
  AppUser,
} from '@/data/types'

// ─── Tenant & Profile (not in data/types, defined here) ─────────────────────

export interface Tenant {
  id: string
  name: string
  slug: string
  phone: string
  email: string
  address: string
  city: string
  logo?: string
  currency: string
  taxRate: number
  createdAt: string
}

export interface TenantSettings {
  id: string
  tenantId: string
  lowStockThreshold: number
  defaultWarrantyMonths: number
  invoicePrefix: string
  poPrefix: string
  returnPrefix: string
  reservationPrefix: string
  consignmentPrefix: string
  repairPrefix: string
  taxEnabled: boolean
  taxRate: number
  currency: string
  dateFormat: string
  receiptFooter: string
  createdAt: string
  updatedAt: string
}

export interface Profile {
  id: string
  tenantId: string
  name: string
  email: string
  phone: string
  role: string
  avatar?: string
  status: string
  lastLogin?: string
  createdAt: string
}

export interface ImeiRecord {
  id: string
  tenantId: string
  productId: string
  productName: string
  imei: string
  status: 'In Stock' | 'Sold' | 'Reserved' | 'Returned' | 'Defective'
  purchaseId?: string
  saleId?: string
  notes?: string
  createdAt: string
}

export interface StockAlertRule {
  id: string
  tenantId: string
  productId: string
  productName: string
  productType: 'Mobile' | 'Accessory'
  threshold: number
  currentStock: number
  enabled: boolean
  createdAt: string
}

export interface StockAlertLog {
  id: string
  tenantId: string
  ruleId: string
  productName: string
  currentStock: number
  threshold: number
  alertedAt: string
  acknowledged: boolean
}

export interface UsedPhone {
  id: string
  tenantId: string
  brand: string
  model: string
  imei: string
  color: string
  storage: string
  ram: string
  condition: string
  grade: 'A' | 'B' | 'C' | 'D'
  purchasePrice: number
  sellingPrice: number
  customerId?: string
  customerName?: string
  defects?: string
  notes?: string
  status: 'In Stock' | 'Sold' | 'Listed'
  dateAdded: string
}

// ─── Database Row Types (snake_case, matching Supabase tables) ──────────────

export interface DbMobile {
  id: string
  tenant_id: string
  brand: string
  model: string
  imei: string
  color: string
  storage: string
  ram: string
  purchase_price: number
  selling_price: number
  supplier_id: string | null
  stock: number
  condition: string
  category: string
  device_type: 'android' | 'iphone'
  notes: string | null
  image_url: string | null
  battery_health: number | null
  date_added: string
  created_at: string
  updated_at: string
}

export interface DbAccessory {
  id: string
  tenant_id: string
  name: string
  brand: string
  sku: string
  category: string
  purchase_price: number
  selling_price: number
  stock: number
  supplier_id: string | null
  compatible_models: string[]
  description: string | null
  date_added: string
  image_url: string | null
  created_at: string
  updated_at: string
}

export interface DbSupplier {
  id: string
  tenant_id: string
  company_name: string
  contact_person: string
  phone: string
  email: string
  address: string
  city: string
  total_purchases: number
  outstanding_balance: number
  rating: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DbCustomer {
  id: string
  tenant_id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  total_purchases: number
  total_spent: number
  last_purchase_date: string
  loyalty_tier: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DbSale {
  id: string
  tenant_id: string
  invoice_number: string
  date: string
  customer_id: string
  customer_name: string
  customer_phone: string
  subtotal: number
  discount: number
  tax: number
  total: number
  payment_method: string
  amount_received: number
  change_due: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DbSaleItem {
  id: string
  tenant_id: string
  sale_id: string
  product_id: string
  product_name: string
  product_type: string
  quantity: number
  unit_price: number
  discount: number
  line_total: number
}

export interface DbPurchase {
  id: string
  tenant_id: string
  po_number: string
  date: string
  supplier_id: string
  supplier_name: string
  subtotal: number
  shipping_cost: number
  tax: number
  total: number
  amount_paid: number
  balance_due: number
  payment_status: string
  delivery_status: string
  payment_method: string
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DbPurchaseItem {
  id: string
  tenant_id: string
  purchase_id: string
  product_id: string
  product_name: string
  product_type: string
  quantity: number
  unit_cost: number
  total: number
  imeis: string[] | null
}

export interface DbExpense {
  id: string
  tenant_id: string
  title: string
  category: string
  amount: number
  date: string
  type: string
  payment_method: string
  status: string
  notes: string | null
  is_recurring: boolean
  recurring_day: number | null
  recurring_month: number | null
  created_at: string
  updated_at: string
}

export interface DbShop {
  id: string
  tenant_id: string
  name: string
  owner_name: string
  phone: string
  email: string | null
  address: string
  city: string
  shop_type: string
  status: string
  total_orders: number
  total_spent: number
  outstanding_balance: number
  last_order_date: string | null
  notes: string | null
  date_added: string
  created_at: string
  updated_at: string
}

export interface DbReservedSale {
  id: string
  tenant_id: string
  reservation_number: string
  date: string
  shop_id: string
  shop_name: string
  shop_phone: string
  subtotal: number
  discount: number
  total: number
  advance_paid: number
  balance_due: number
  status: string
  reserved_until: string
  payment_method: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DbReservedSaleItem {
  id: string
  tenant_id: string
  reserved_sale_id: string
  product_id: string
  product_name: string
  product_type: string
  quantity: number
  unit_price: number
  discount: number
  line_total: number
}

export interface DbConsignment {
  id: string
  tenant_id: string
  dispatch_number: string
  date: string
  shop_id: string
  shop_name: string
  shop_phone: string
  total_value: number
  amount_collected: number
  status: string
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DbConsignmentItem {
  id: string
  tenant_id: string
  consignment_id: string
  product_id: string
  product_name: string
  product_type: string
  dispatched: number
  returned: number
  sold: number
  unit_price: number
  imeis: string[] | null
  sold_imeis: string[] | null
  returned_imeis: string[] | null
}

export interface DbConsignmentTransaction {
  id: string
  tenant_id: string
  consignment_id: string
  date: string
  type: string
  amount: number
  payment_method: string | null
  notes: string | null
  created_at: string
}

export interface DbConsignmentTransactionItem {
  id: string
  transaction_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  imeis: string[] | null
}

export interface DbReturn {
  id: string
  tenant_id: string
  return_number: string
  date: string
  sale_id: string
  invoice_number: string
  customer_id: string
  customer_name: string
  customer_phone: string
  reason: string
  subtotal: number
  refund_amount: number
  refund_method: string
  status: string
  restock_items: boolean
  exchange_sale_id: string | null
  processed_by: string
  notes: string | null
  created_at: string
  resolved_at: string | null
}

export interface DbReturnItem {
  id: string
  tenant_id: string
  return_id: string
  product_id: string
  product_name: string
  product_type: string
  quantity: number
  unit_price: number
  line_total: number
  imei: string | null
  condition: string
}

export interface DbPayment {
  id: string
  tenant_id: string
  date: string
  type: string
  entity_type: string
  entity_id: string
  entity_name: string
  reference_type: string
  reference_id: string | null
  reference_number: string | null
  amount: number
  method: string
  status: string
  notes: string | null
  processed_by: string
  created_at: string
}

export interface DbWarrantyRecord {
  id: string
  tenant_id: string
  product_id: string
  product_name: string
  product_type: string
  imei: string | null
  customer_id: string
  customer_name: string
  customer_phone: string
  sale_id: string
  invoice_number: string
  purchase_date: string
  warranty_months: number
  expiry_date: string
  status: string
  created_at: string
  updated_at: string
}

export interface DbWarrantyClaim {
  id: string
  tenant_id: string
  warranty_id: string
  date: string
  issue: string
  resolution: string
  status: string
  repair_ticket_id: string | null
  notes: string | null
  created_at: string
}

export interface DbRepairTicket {
  id: string
  tenant_id: string
  ticket_number: string
  date: string
  customer_id: string
  customer_name: string
  customer_phone: string
  device_brand: string
  device_model: string
  imei: string | null
  issue: string
  diagnosis: string | null
  priority: string
  status: string
  estimated_cost: number
  actual_cost: number
  warranty_claim_id: string | null
  technician_name: string
  received_date: string
  estimated_completion_date: string | null
  completed_date: string | null
  delivered_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DbRepairPart {
  id: string
  tenant_id: string
  repair_ticket_id: string
  name: string
  cost: number
  quantity: number
}

export interface DbAuditLog {
  id: string
  tenant_id: string
  timestamp: string
  user_id: string
  user_name: string
  user_role: string
  action: string
  module: string
  entity_id: string | null
  entity_name: string | null
  description: string
  old_value: string | null
  new_value: string | null
  ip_address: string | null
}

export interface DbTenant {
  id: string
  name: string
  slug: string
  phone: string
  email: string
  address: string
  city: string
  logo: string | null
  currency: string
  tax_rate: number
  created_at: string
  updated_at: string
}

export interface DbTenantSettings {
  id: string
  tenant_id: string
  low_stock_threshold: number
  default_warranty_months: number
  invoice_prefix: string
  po_prefix: string
  return_prefix: string
  reservation_prefix: string
  consignment_prefix: string
  repair_prefix: string
  tax_enabled: boolean
  tax_rate: number
  currency: string
  date_format: string
  receipt_footer: string
  created_at: string
  updated_at: string
}

export interface DbProfile {
  id: string
  tenant_id: string
  name: string
  email: string
  phone: string
  role: string
  avatar: string | null
  status: string
  last_login: string | null
  created_at: string
}

export interface DbImeiRecord {
  id: string
  tenant_id: string
  product_id: string
  product_name: string
  imei: string
  status: string
  purchase_id: string | null
  sale_id: string | null
  notes: string | null
  created_at: string
}

export interface DbStockAlertRule {
  id: string
  tenant_id: string
  product_id: string
  product_name: string
  product_type: string
  threshold: number
  current_stock: number
  enabled: boolean
  created_at: string
}

export interface DbStockAlertLog {
  id: string
  tenant_id: string
  rule_id: string
  product_name: string
  current_stock: number
  threshold: number
  alerted_at: string
  acknowledged: boolean
}

export interface DbUsedPhone {
  id: string
  tenant_id: string
  brand: string
  model: string
  imei: string
  color: string
  storage: string
  ram: string
  condition: string
  grade: string
  purchase_price: number
  selling_price: number
  customer_id: string | null
  customer_name: string | null
  defects: string | null
  notes: string | null
  status: string
  date_added: string
  created_at: string
  updated_at: string
}

// ─── Converter Functions ────────────────────────────────────────────────────

export function toMobile(db: DbMobile): Mobile {
  return {
    id: db.id,
    brand: db.brand,
    model: db.model,
    imei: db.imei,
    color: db.color,
    storage: db.storage,
    ram: db.ram,
    purchasePrice: db.purchase_price,
    sellingPrice: db.selling_price,
    supplierId: db.supplier_id ?? '',
    stock: db.stock,
    condition: db.condition as Mobile['condition'],
    category: db.category as Mobile['category'],
    deviceType: db.device_type ?? 'android',
    notes: db.notes ?? undefined,
    dateAdded: db.date_added,
    image: db.image_url ?? undefined,
    batteryHealth: db.battery_health ?? undefined,
  }
}

export function toDbMobile(m: Partial<Mobile>, tenantId: string): Partial<DbMobile> {
  const db: Record<string, unknown> = { tenant_id: tenantId }
  if (m.brand !== undefined) db.brand = m.brand
  if (m.model !== undefined) db.model = m.model
  if (m.imei !== undefined) db.imei = m.imei
  if (m.color !== undefined) db.color = m.color
  if (m.storage !== undefined) db.storage = m.storage
  if (m.ram !== undefined) db.ram = m.ram
  if (m.purchasePrice !== undefined) db.purchase_price = m.purchasePrice
  if (m.sellingPrice !== undefined) db.selling_price = m.sellingPrice
  if (m.supplierId !== undefined) db.supplier_id = m.supplierId || null
  if (m.stock !== undefined) db.stock = m.stock
  if (m.condition !== undefined) db.condition = m.condition
  if (m.category !== undefined) db.category = m.category
  if (m.deviceType !== undefined) db.device_type = m.deviceType
  if (m.notes !== undefined) db.notes = m.notes || null
  if (m.dateAdded !== undefined) db.date_added = m.dateAdded
  if (m.image !== undefined) db.image_url = m.image || null
  if (m.batteryHealth !== undefined) db.battery_health = m.batteryHealth || null
  return db as Partial<DbMobile>
}

export function toAccessory(db: DbAccessory): Accessory {
  return {
    id: db.id,
    name: db.name,
    brand: db.brand,
    sku: db.sku,
    category: db.category,
    purchasePrice: db.purchase_price,
    sellingPrice: db.selling_price,
    stock: db.stock,
    supplierId: db.supplier_id ?? '',
    compatibleModels: db.compatible_models ?? [],
    description: db.description ?? undefined,
    dateAdded: db.date_added,
    image: db.image_url ?? undefined,
  }
}

export function toDbAccessory(a: Partial<Accessory>, tenantId: string): Partial<DbAccessory> {
  const db: Record<string, unknown> = { tenant_id: tenantId }
  if (a.name !== undefined) db.name = a.name
  if (a.brand !== undefined) db.brand = a.brand
  if (a.sku !== undefined) db.sku = a.sku
  if (a.category !== undefined) db.category = a.category
  if (a.purchasePrice !== undefined) db.purchase_price = a.purchasePrice
  if (a.sellingPrice !== undefined) db.selling_price = a.sellingPrice
  if (a.stock !== undefined) db.stock = a.stock
  if (a.supplierId !== undefined) db.supplier_id = a.supplierId || null
  if (a.compatibleModels !== undefined) db.compatible_models = a.compatibleModels
  if (a.description !== undefined) db.description = a.description || null
  if (a.dateAdded !== undefined) db.date_added = a.dateAdded
  if (a.image !== undefined) db.image_url = a.image || null
  return db as Partial<DbAccessory>
}

export function toSupplier(db: DbSupplier): Supplier {
  return {
    id: db.id,
    companyName: db.company_name,
    contactPerson: db.contact_person,
    phone: db.phone,
    email: db.email,
    address: db.address,
    city: db.city,
    totalPurchases: db.total_purchases,
    outstandingBalance: db.outstanding_balance,
    rating: db.rating,
    status: db.status as Supplier['status'],
    notes: db.notes ?? undefined,
  }
}

export function toDbSupplier(s: Partial<Supplier>, tenantId: string): Partial<DbSupplier> {
  const db: Record<string, unknown> = { tenant_id: tenantId }
  if (s.companyName !== undefined) db.company_name = s.companyName
  if (s.contactPerson !== undefined) db.contact_person = s.contactPerson
  if (s.phone !== undefined) db.phone = s.phone
  if (s.email !== undefined) db.email = s.email
  if (s.address !== undefined) db.address = s.address
  if (s.city !== undefined) db.city = s.city
  if (s.totalPurchases !== undefined) db.total_purchases = s.totalPurchases
  if (s.outstandingBalance !== undefined) db.outstanding_balance = s.outstandingBalance
  if (s.rating !== undefined) db.rating = s.rating
  if (s.status !== undefined) db.status = s.status
  if (s.notes !== undefined) db.notes = s.notes || null
  return db as Partial<DbSupplier>
}

export function toCustomer(db: DbCustomer): Customer {
  return {
    id: db.id,
    name: db.name,
    phone: db.phone,
    email: db.email ?? undefined,
    address: db.address ?? undefined,
    totalPurchases: db.total_purchases,
    totalSpent: db.total_spent,
    lastPurchaseDate: db.last_purchase_date,
    loyaltyTier: db.loyalty_tier as Customer['loyaltyTier'],
    notes: db.notes ?? undefined,
  }
}

export function toDbCustomer(c: Partial<Customer>, tenantId: string): Partial<DbCustomer> {
  const db: Record<string, unknown> = { tenant_id: tenantId }
  if (c.name !== undefined) db.name = c.name
  if (c.phone !== undefined) db.phone = c.phone
  if (c.email !== undefined) db.email = c.email || null
  if (c.address !== undefined) db.address = c.address || null
  if (c.totalPurchases !== undefined) db.total_purchases = c.totalPurchases
  if (c.totalSpent !== undefined) db.total_spent = c.totalSpent
  if (c.lastPurchaseDate !== undefined) db.last_purchase_date = c.lastPurchaseDate
  if (c.loyaltyTier !== undefined) db.loyalty_tier = c.loyaltyTier
  if (c.notes !== undefined) db.notes = c.notes || null
  return db as Partial<DbCustomer>
}

export function toSale(db: DbSale, items: DbSaleItem[]): Sale {
  return {
    id: db.id,
    invoiceNumber: db.invoice_number,
    date: db.date,
    customerId: db.customer_id,
    customerName: db.customer_name,
    customerPhone: db.customer_phone,
    items: items.map(toSaleItem),
    subtotal: db.subtotal,
    discount: db.discount,
    tax: db.tax,
    total: db.total,
    paymentMethod: db.payment_method,
    amountReceived: db.amount_received,
    changeDue: db.change_due,
    status: db.status as Sale['status'],
    notes: db.notes ?? undefined,
  }
}

export function toSaleItem(db: DbSaleItem): SaleItem {
  return {
    productId: db.product_id,
    productName: db.product_name,
    productType: db.product_type as SaleItem['productType'],
    quantity: db.quantity,
    unitPrice: db.unit_price,
    discount: db.discount,
    lineTotal: db.line_total,
  }
}

export function toDbSale(s: Partial<Sale>, tenantId: string): Partial<DbSale> {
  const db: Record<string, unknown> = { tenant_id: tenantId }
  if (s.invoiceNumber !== undefined) db.invoice_number = s.invoiceNumber
  if (s.date !== undefined) db.date = s.date
  if (s.customerId !== undefined) db.customer_id = s.customerId || null
  if (s.customerName !== undefined) db.customer_name = s.customerName
  if (s.customerPhone !== undefined) db.customer_phone = s.customerPhone
  if (s.subtotal !== undefined) db.subtotal = s.subtotal
  if (s.discount !== undefined) db.discount = s.discount
  if (s.tax !== undefined) db.tax = s.tax
  if (s.total !== undefined) db.total = s.total
  if (s.paymentMethod !== undefined) db.payment_method = s.paymentMethod
  if (s.amountReceived !== undefined) db.amount_received = s.amountReceived
  if (s.changeDue !== undefined) db.change_due = s.changeDue
  if (s.status !== undefined) db.status = s.status
  if (s.notes !== undefined) db.notes = s.notes || null
  return db as Partial<DbSale>
}

export function toDbSaleItem(item: SaleItem, saleId: string, tenantId: string): Partial<DbSaleItem> {
  return {
    tenant_id: tenantId,
    sale_id: saleId,
    product_id: item.productId || undefined,
    product_name: item.productName,
    product_type: item.productType,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    discount: item.discount,
    line_total: item.lineTotal,
  }
}

export function toPurchase(db: DbPurchase, items: DbPurchaseItem[]): Purchase {
  return {
    id: db.id,
    poNumber: db.po_number,
    date: db.date,
    supplierId: db.supplier_id,
    supplierName: db.supplier_name,
    items: items.map(toPurchaseItem),
    subtotal: db.subtotal,
    shippingCost: db.shipping_cost,
    tax: db.tax,
    total: db.total,
    amountPaid: db.amount_paid,
    balanceDue: db.balance_due,
    paymentStatus: db.payment_status as Purchase['paymentStatus'],
    deliveryStatus: db.delivery_status as Purchase['deliveryStatus'],
    paymentMethod: db.payment_method,
    dueDate: db.due_date ?? undefined,
    notes: db.notes ?? undefined,
  }
}

export function toPurchaseItem(db: DbPurchaseItem): PurchaseItem {
  return {
    productId: db.product_id,
    productName: db.product_name,
    productType: db.product_type as PurchaseItem['productType'],
    quantity: db.quantity,
    unitCost: db.unit_cost,
    total: db.total,
    imeis: db.imeis ?? undefined,
  }
}

export function toDbPurchase(p: Partial<Purchase>, tenantId: string): Partial<DbPurchase> {
  const db: Record<string, unknown> = { tenant_id: tenantId }
  if (p.poNumber !== undefined) db.po_number = p.poNumber
  if (p.date !== undefined) db.date = p.date
  if (p.supplierId !== undefined) db.supplier_id = p.supplierId
  if (p.supplierName !== undefined) db.supplier_name = p.supplierName
  if (p.subtotal !== undefined) db.subtotal = p.subtotal
  if (p.shippingCost !== undefined) db.shipping_cost = p.shippingCost
  if (p.tax !== undefined) db.tax = p.tax
  if (p.total !== undefined) db.total = p.total
  if (p.amountPaid !== undefined) db.amount_paid = p.amountPaid
  if (p.balanceDue !== undefined) db.balance_due = p.balanceDue
  if (p.paymentStatus !== undefined) db.payment_status = p.paymentStatus
  if (p.deliveryStatus !== undefined) db.delivery_status = p.deliveryStatus
  if (p.paymentMethod !== undefined) db.payment_method = p.paymentMethod
  if (p.dueDate !== undefined) db.due_date = p.dueDate || null
  if (p.notes !== undefined) db.notes = p.notes || null
  return db as Partial<DbPurchase>
}

export function toDbPurchaseItem(item: PurchaseItem, purchaseId: string, tenantId: string): Partial<DbPurchaseItem> {
  return {
    tenant_id: tenantId,
    purchase_id: purchaseId,
    product_id: item.productId || undefined,
    product_name: item.productName,
    product_type: item.productType,
    quantity: item.quantity,
    unit_cost: item.unitCost,
    total: item.total,
    imeis: item.imeis ?? undefined,
  }
}

export function toExpense(db: DbExpense): Expense {
  return {
    id: db.id,
    title: db.title,
    category: db.category as Expense['category'],
    amount: db.amount,
    date: db.date,
    type: db.type as Expense['type'],
    paymentMethod: db.payment_method as Expense['paymentMethod'],
    status: db.status as Expense['status'],
    notes: db.notes ?? undefined,
    isRecurring: db.is_recurring,
    recurringDay: db.recurring_day ?? undefined,
    recurringMonth: db.recurring_month ?? undefined,
  }
}

export function toDbExpense(e: Partial<Expense>, tenantId: string): Partial<DbExpense> {
  const db: Record<string, unknown> = { tenant_id: tenantId }
  if (e.title !== undefined) db.title = e.title
  if (e.category !== undefined) db.category = e.category
  if (e.amount !== undefined) db.amount = e.amount
  if (e.date !== undefined) db.date = e.date
  if (e.type !== undefined) db.type = e.type
  if (e.paymentMethod !== undefined) db.payment_method = e.paymentMethod
  if (e.status !== undefined) db.status = e.status
  if (e.notes !== undefined) db.notes = e.notes || null
  if (e.isRecurring !== undefined) db.is_recurring = e.isRecurring
  if (e.recurringDay !== undefined) db.recurring_day = e.recurringDay ?? null
  if (e.recurringMonth !== undefined) db.recurring_month = e.recurringMonth ?? null
  return db as Partial<DbExpense>
}

export function toShop(db: DbShop): Shop {
  return {
    id: db.id,
    name: db.name,
    ownerName: db.owner_name,
    phone: db.phone,
    email: db.email ?? undefined,
    address: db.address,
    city: db.city,
    shopType: db.shop_type as Shop['shopType'],
    status: db.status as Shop['status'],
    totalOrders: db.total_orders,
    totalSpent: db.total_spent,
    outstandingBalance: db.outstanding_balance,
    lastOrderDate: db.last_order_date ?? undefined,
    notes: db.notes ?? undefined,
    dateAdded: db.date_added,
  }
}

export function toDbShop(s: Partial<Shop>, tenantId: string): Partial<DbShop> {
  const db: Record<string, unknown> = { tenant_id: tenantId }
  if (s.name !== undefined) db.name = s.name
  if (s.ownerName !== undefined) db.owner_name = s.ownerName
  if (s.phone !== undefined) db.phone = s.phone
  if (s.email !== undefined) db.email = s.email || null
  if (s.address !== undefined) db.address = s.address
  if (s.city !== undefined) db.city = s.city
  if (s.shopType !== undefined) db.shop_type = s.shopType
  if (s.status !== undefined) db.status = s.status
  if (s.totalOrders !== undefined) db.total_orders = s.totalOrders
  if (s.totalSpent !== undefined) db.total_spent = s.totalSpent
  if (s.outstandingBalance !== undefined) db.outstanding_balance = s.outstandingBalance
  if (s.lastOrderDate !== undefined) db.last_order_date = s.lastOrderDate || null
  if (s.notes !== undefined) db.notes = s.notes || null
  if (s.dateAdded !== undefined) db.date_added = s.dateAdded
  return db as Partial<DbShop>
}

export function toReservedSale(db: DbReservedSale, items: DbReservedSaleItem[]): ReservedSale {
  return {
    id: db.id,
    reservationNumber: db.reservation_number,
    date: db.date,
    shopId: db.shop_id,
    shopName: db.shop_name,
    shopPhone: db.shop_phone,
    items: items.map(toReservedSaleItem),
    subtotal: db.subtotal,
    discount: db.discount,
    total: db.total,
    advancePaid: db.advance_paid,
    balanceDue: db.balance_due,
    status: db.status as ReservedSale['status'],
    reservedUntil: db.reserved_until,
    paymentMethod: db.payment_method,
    notes: db.notes ?? undefined,
  }
}

export function toReservedSaleItem(db: DbReservedSaleItem): ReservedSaleItem {
  return {
    productId: db.product_id,
    productName: db.product_name,
    productType: db.product_type as ReservedSaleItem['productType'],
    quantity: db.quantity,
    unitPrice: db.unit_price,
    discount: db.discount,
    lineTotal: db.line_total,
  }
}

export function toConsignment(
  db: DbConsignment,
  items: DbConsignmentItem[],
  transactions: (DbConsignmentTransaction & { items: DbConsignmentTransactionItem[] })[]
): Consignment {
  return {
    id: db.id,
    dispatchNumber: db.dispatch_number,
    date: db.date,
    shopId: db.shop_id,
    shopName: db.shop_name,
    shopPhone: db.shop_phone,
    items: items.map(toConsignmentItem),
    totalValue: db.total_value,
    amountCollected: db.amount_collected,
    status: db.status as Consignment['status'],
    dueDate: db.due_date ?? undefined,
    notes: db.notes ?? undefined,
    transactions: transactions.map(toConsignmentTransaction),
  }
}

export function toConsignmentItem(db: DbConsignmentItem): ConsignmentItem {
  return {
    productId: db.product_id,
    productName: db.product_name,
    productType: db.product_type as ConsignmentItem['productType'],
    dispatched: db.dispatched,
    returned: db.returned,
    sold: db.sold,
    unitPrice: db.unit_price,
    imeis: db.imeis ?? undefined,
    soldImeis: db.sold_imeis ?? undefined,
    returnedImeis: db.returned_imeis ?? undefined,
  }
}

export function toConsignmentTransaction(
  db: DbConsignmentTransaction & { items: DbConsignmentTransactionItem[] }
): ConsignmentTransaction {
  return {
    id: db.id,
    date: db.date,
    type: db.type as ConsignmentTransaction['type'],
    items: db.items.map((i) => ({
      productId: i.product_id,
      productName: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      imeis: i.imeis ?? undefined,
    })),
    amount: db.amount,
    paymentMethod: db.payment_method ?? undefined,
    notes: db.notes ?? undefined,
  }
}

export function toReturn(db: DbReturn, items: DbReturnItem[]): Return {
  return {
    id: db.id,
    returnNumber: db.return_number,
    date: db.date,
    saleId: db.sale_id,
    invoiceNumber: db.invoice_number,
    customerId: db.customer_id,
    customerName: db.customer_name,
    customerPhone: db.customer_phone,
    items: items.map(toReturnItem),
    reason: db.reason as Return['reason'],
    subtotal: db.subtotal,
    refundAmount: db.refund_amount,
    refundMethod: db.refund_method,
    status: db.status as Return['status'],
    restockItems: db.restock_items,
    exchangeSaleId: db.exchange_sale_id ?? undefined,
    processedBy: db.processed_by,
    notes: db.notes ?? undefined,
    createdAt: db.created_at,
    resolvedAt: db.resolved_at ?? undefined,
  }
}

export function toReturnItem(db: DbReturnItem): ReturnItem {
  return {
    productId: db.product_id,
    productName: db.product_name,
    productType: db.product_type as ReturnItem['productType'],
    quantity: db.quantity,
    unitPrice: db.unit_price,
    lineTotal: db.line_total,
    imei: db.imei ?? undefined,
    condition: db.condition as ReturnItem['condition'],
  }
}

export function toPayment(db: DbPayment): Payment {
  return {
    id: db.id,
    date: db.date,
    type: db.type as Payment['type'],
    entityType: db.entity_type as Payment['entityType'],
    entityId: db.entity_id,
    entityName: db.entity_name,
    referenceType: db.reference_type as Payment['referenceType'],
    referenceId: db.reference_id ?? undefined,
    referenceNumber: db.reference_number ?? undefined,
    amount: db.amount,
    method: db.method,
    status: db.status as Payment['status'],
    notes: db.notes ?? undefined,
    processedBy: db.processed_by,
    createdAt: db.created_at,
  }
}

export function toDbPayment(p: Partial<Payment>, tenantId: string): Partial<DbPayment> {
  const db: Record<string, unknown> = { tenant_id: tenantId }
  if (p.date !== undefined) db.date = p.date
  if (p.type !== undefined) db.type = p.type
  if (p.entityType !== undefined) db.entity_type = p.entityType
  if (p.entityId !== undefined) db.entity_id = p.entityId
  if (p.entityName !== undefined) db.entity_name = p.entityName
  if (p.referenceType !== undefined) db.reference_type = p.referenceType
  if (p.referenceId !== undefined) db.reference_id = p.referenceId || null
  if (p.referenceNumber !== undefined) db.reference_number = p.referenceNumber || null
  if (p.amount !== undefined) db.amount = p.amount
  if (p.method !== undefined) db.method = p.method
  if (p.status !== undefined) db.status = p.status
  if (p.notes !== undefined) db.notes = p.notes || null
  if (p.processedBy !== undefined) db.processed_by = p.processedBy || null
  return db as Partial<DbPayment>
}

export function toWarrantyRecord(db: DbWarrantyRecord, claims: DbWarrantyClaim[]): WarrantyRecord {
  return {
    id: db.id,
    productId: db.product_id,
    productName: db.product_name,
    productType: db.product_type as WarrantyRecord['productType'],
    imei: db.imei ?? undefined,
    customerId: db.customer_id,
    customerName: db.customer_name,
    customerPhone: db.customer_phone,
    saleId: db.sale_id,
    invoiceNumber: db.invoice_number,
    purchaseDate: db.purchase_date,
    warrantyMonths: db.warranty_months,
    expiryDate: db.expiry_date,
    status: db.status as WarrantyRecord['status'],
    claims: claims.map(toWarrantyClaim),
  }
}

export function toWarrantyClaim(db: DbWarrantyClaim): WarrantyClaim {
  return {
    id: db.id,
    date: db.date,
    issue: db.issue,
    resolution: db.resolution,
    status: db.status as WarrantyClaim['status'],
    repairTicketId: db.repair_ticket_id ?? undefined,
    notes: db.notes ?? undefined,
  }
}

export function toRepairTicket(db: DbRepairTicket, parts: DbRepairPart[]): RepairTicket {
  return {
    id: db.id,
    ticketNumber: db.ticket_number,
    date: db.date,
    customerId: db.customer_id,
    customerName: db.customer_name,
    customerPhone: db.customer_phone,
    deviceBrand: db.device_brand,
    deviceModel: db.device_model,
    imei: db.imei ?? undefined,
    issue: db.issue,
    diagnosis: db.diagnosis ?? undefined,
    priority: db.priority as RepairTicket['priority'],
    status: db.status as RepairTicket['status'],
    estimatedCost: db.estimated_cost,
    actualCost: db.actual_cost,
    parts: parts.map((p) => ({ name: p.name, cost: p.cost, quantity: p.quantity })),
    warrantyClaimId: db.warranty_claim_id ?? undefined,
    technicianName: db.technician_name,
    receivedDate: db.received_date,
    estimatedCompletionDate: db.estimated_completion_date ?? undefined,
    completedDate: db.completed_date ?? undefined,
    deliveredDate: db.delivered_date ?? undefined,
    notes: db.notes ?? undefined,
  }
}

export function toAuditLog(db: DbAuditLog): AuditLog {
  return {
    id: db.id,
    timestamp: db.timestamp,
    userId: db.user_id,
    userName: db.user_name,
    userRole: db.user_role,
    action: db.action as AuditLog['action'],
    module: db.module as AuditLog['module'],
    entityId: db.entity_id ?? undefined,
    entityName: db.entity_name ?? undefined,
    description: db.description,
    oldValue: db.old_value ?? undefined,
    newValue: db.new_value ?? undefined,
    ipAddress: db.ip_address ?? undefined,
  }
}

export function toDbAuditLog(a: Partial<AuditLog>, tenantId: string): Partial<DbAuditLog> {
  const db: Record<string, unknown> = { tenant_id: tenantId }
  if (a.timestamp !== undefined) db.timestamp = a.timestamp
  if (a.userId !== undefined) db.user_id = a.userId
  if (a.userName !== undefined) db.user_name = a.userName
  if (a.userRole !== undefined) db.user_role = a.userRole
  if (a.action !== undefined) db.action = a.action
  if (a.module !== undefined) db.module = a.module
  if (a.entityId !== undefined) db.entity_id = a.entityId || null
  if (a.entityName !== undefined) db.entity_name = a.entityName || null
  if (a.description !== undefined) db.description = a.description
  if (a.oldValue !== undefined) db.old_value = a.oldValue || null
  if (a.newValue !== undefined) db.new_value = a.newValue || null
  if (a.ipAddress !== undefined) db.ip_address = a.ipAddress || null
  return db as Partial<DbAuditLog>
}

export function toTenant(db: DbTenant): Tenant {
  return {
    id: db.id,
    name: db.name,
    slug: db.slug,
    phone: db.phone,
    email: db.email,
    address: db.address,
    city: db.city,
    logo: db.logo ?? undefined,
    currency: db.currency,
    taxRate: db.tax_rate,
    createdAt: db.created_at,
  }
}

export function toTenantSettings(db: DbTenantSettings): TenantSettings {
  return {
    id: db.id,
    tenantId: db.tenant_id,
    lowStockThreshold: db.low_stock_threshold,
    defaultWarrantyMonths: db.default_warranty_months,
    invoicePrefix: db.invoice_prefix,
    poPrefix: db.po_prefix,
    returnPrefix: db.return_prefix,
    reservationPrefix: db.reservation_prefix,
    consignmentPrefix: db.consignment_prefix,
    repairPrefix: db.repair_prefix,
    taxEnabled: db.tax_enabled,
    taxRate: db.tax_rate,
    currency: db.currency,
    dateFormat: db.date_format,
    receiptFooter: db.receipt_footer,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  }
}

export function toProfile(db: DbProfile): Profile {
  return {
    id: db.id,
    tenantId: db.tenant_id,
    name: db.name,
    email: db.email,
    phone: db.phone,
    role: db.role,
    avatar: db.avatar ?? undefined,
    status: db.status,
    lastLogin: db.last_login ?? undefined,
    createdAt: db.created_at,
  }
}

export function toImeiRecord(db: DbImeiRecord): ImeiRecord {
  return {
    id: db.id,
    tenantId: db.tenant_id,
    productId: db.product_id,
    productName: db.product_name,
    imei: db.imei,
    status: db.status as ImeiRecord['status'],
    purchaseId: db.purchase_id ?? undefined,
    saleId: db.sale_id ?? undefined,
    notes: db.notes ?? undefined,
    createdAt: db.created_at,
  }
}

export function toStockAlertRule(db: DbStockAlertRule): StockAlertRule {
  return {
    id: db.id,
    tenantId: db.tenant_id,
    productId: db.product_id,
    productName: db.product_name,
    productType: db.product_type as StockAlertRule['productType'],
    threshold: db.threshold,
    currentStock: db.current_stock,
    enabled: db.enabled,
    createdAt: db.created_at,
  }
}

export function toStockAlertLog(db: DbStockAlertLog): StockAlertLog {
  return {
    id: db.id,
    tenantId: db.tenant_id,
    ruleId: db.rule_id,
    productName: db.product_name,
    currentStock: db.current_stock,
    threshold: db.threshold,
    alertedAt: db.alerted_at,
    acknowledged: db.acknowledged,
  }
}

export function toUsedPhone(db: DbUsedPhone): UsedPhone {
  return {
    id: db.id,
    tenantId: db.tenant_id,
    brand: db.brand,
    model: db.model,
    imei: db.imei,
    color: db.color,
    storage: db.storage,
    ram: db.ram,
    condition: db.condition,
    grade: db.grade as UsedPhone['grade'],
    purchasePrice: db.purchase_price,
    sellingPrice: db.selling_price,
    customerId: db.customer_id ?? undefined,
    customerName: db.customer_name ?? undefined,
    defects: db.defects ?? undefined,
    notes: db.notes ?? undefined,
    status: db.status as UsedPhone['status'],
    dateAdded: db.date_added,
  }
}


export interface Mobile {
  id: string;
  brand: string;
  model: string;
  imei: string;
  color: string;
  storage: string;
  ram: string;
  purchasePrice: number;
  sellingPrice: number;
  supplierId: string;
  stock: number;
  condition: string;
  category: string;
  deviceType: 'android' | 'iphone';
  notes?: string;
  dateAdded: string;
  image?: string;
  batteryHealth?: number;
}

export interface Accessory {
  id: string;
  name: string;
  brand: string;
  sku: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  supplierId: string;
  compatibleModels: string[];
  description?: string;
  dateAdded: string;
  image?: string;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  totalPurchases: number;
  outstandingBalance: number;
  rating: number;
  status: "Active" | "Inactive";
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  totalSpent: number;
  lastPurchaseDate: string;
  loyaltyTier: "Bronze" | "Silver" | "Gold" | "Platinum";
  notes?: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  productType: "Mobile" | "Accessory";
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountReceived: number;
  changeDue: number;
  status: "Completed" | "Pending" | "Refunded";
  notes?: string;
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | "Rent"
  | "Electricity"
  | "Internet & Phone"
  | "Staff Salaries"
  | "Marketing & Advertising"
  | "Packaging & Supplies"
  | "Repair & Maintenance"
  | "Transport"
  | "Equipment & Furniture"
  | "Shop License & Taxes"
  | "Miscellaneous"

export type ExpenseType = "one-time" | "daily" | "monthly" | "yearly"

export type ExpensePayment = "Cash" | "Bank Transfer" | "JazzCash" | "EasyPaisa" | "Card"

export interface Expense {
  id: string
  title: string
  category: ExpenseCategory
  amount: number
  date: string              // YYYY-MM-DD
  type: ExpenseType
  paymentMethod: ExpensePayment
  status: "Paid" | "Pending"
  notes?: string
  isRecurring: boolean
  recurringDay?: number     // 1–31 (monthly) or day within month (yearly)
  recurringMonth?: number   // 1–12 (yearly only)
}

// ─── Shops ────────────────────────────────────────────────────────────────────

export interface Shop {
  id: string
  name: string
  ownerName: string
  phone: string
  email?: string
  address: string
  city: string
  shopType: "Retailer" | "Dealer" | "Wholesaler" | "Repair Shop"
  status: "Active" | "Inactive"
  totalOrders: number
  totalSpent: number
  outstandingBalance: number
  lastOrderDate?: string
  notes?: string
  dateAdded: string
}

export interface ReservedSaleItem {
  productId: string
  productName: string
  productType: "Mobile" | "Accessory"
  quantity: number
  unitPrice: number
  discount: number
  lineTotal: number
}

export interface ReservedSale {
  id: string
  reservationNumber: string
  date: string
  shopId: string
  shopName: string
  shopPhone: string
  items: ReservedSaleItem[]
  subtotal: number
  discount: number
  total: number
  advancePaid: number
  balanceDue: number
  status: "Reserved" | "Confirmed" | "Cancelled"
  reservedUntil: string   // date the reservation expires
  paymentMethod: string
  notes?: string
}

// ─── Consignments ─────────────────────────────────────────────────────────────

export interface ConsignmentItem {
  productId: string
  productName: string
  productType: "Mobile" | "Accessory"
  dispatched: number      // total sent out
  returned: number        // came back (stock restored)
  sold: number            // shop reported sold + we collected payment
  unitPrice: number       // price we charge the other shop per item
  imeis?: string[]        // dispatched IMEI numbers (mobiles only, length === dispatched)
  soldImeis?: string[]    // which specific IMEIs were sold
  returnedImeis?: string[] // which specific IMEIs came back
}

export type ConsignmentStatus = "Active" | "Partially Settled" | "Fully Settled" | "Returned"

export interface ConsignmentTransaction {
  id: string
  date: string
  type: "Sale" | "Return"
  items: { productId: string; productName: string; quantity: number; unitPrice: number; imeis?: string[] }[]
  amount: number          // 0 for returns, total collected for sales
  paymentMethod?: string
  notes?: string
}

export interface Consignment {
  id: string
  dispatchNumber: string
  date: string
  shopId: string
  shopName: string
  shopPhone: string
  items: ConsignmentItem[]
  totalValue: number        // dispatched × unitPrice for all items
  amountCollected: number   // from sale transactions
  status: ConsignmentStatus
  dueDate?: string
  notes?: string
  transactions: ConsignmentTransaction[]
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  productType: "Mobile" | "Accessory";
  quantity: number;
  unitCost: number;
  total: number;
  imeis?: string[];
}

export interface Purchase {
  id: string;
  poNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: "Paid" | "Partial" | "Unpaid";
  deliveryStatus: "Received" | "Pending" | "Partial";
  paymentMethod: string;
  dueDate?: string;
  notes?: string;
}

// ─── Returns / Refunds ──────────────────────────────────────────────────────

export type ReturnReason =
  | "Defective"
  | "Wrong Item"
  | "Customer Changed Mind"
  | "Not As Described"
  | "Duplicate Order"
  | "Damaged in Transit"
  | "Warranty Claim"
  | "Other"

export type ReturnStatus = "Pending" | "Approved" | "Rejected" | "Completed" | "Exchanged"

export interface ReturnItem {
  productId: string
  productName: string
  productType: "Mobile" | "Accessory"
  quantity: number
  unitPrice: number
  lineTotal: number
  imei?: string
  condition: "Good" | "Damaged" | "Defective"
}

export interface Return {
  id: string
  returnNumber: string
  date: string
  saleId: string
  invoiceNumber: string
  customerId: string
  customerName: string
  customerPhone: string
  items: ReturnItem[]
  reason: ReturnReason
  subtotal: number
  refundAmount: number
  refundMethod: string
  status: ReturnStatus
  restockItems: boolean
  exchangeSaleId?: string
  processedBy: string
  notes?: string
  createdAt: string
  resolvedAt?: string
}

// ─── Warranty & Repair ──────────────────────────────────────────────────────

export type WarrantyStatus = "Active" | "Expired" | "Claimed" | "Voided"
export type RepairStatus = "Received" | "Diagnosing" | "In Repair" | "Waiting Parts" | "Repaired" | "Delivered" | "Cancelled"
export type RepairPriority = "Low" | "Medium" | "High" | "Urgent"

export interface WarrantyRecord {
  id: string
  productId: string
  productName: string
  productType: "Mobile" | "Accessory"
  imei?: string
  customerId: string
  customerName: string
  customerPhone: string
  saleId: string
  invoiceNumber: string
  purchaseDate: string
  warrantyMonths: number
  expiryDate: string
  status: WarrantyStatus
  claims: WarrantyClaim[]
}

export interface WarrantyClaim {
  id: string
  date: string
  issue: string
  resolution: string
  status: "Open" | "In Progress" | "Resolved" | "Rejected"
  repairTicketId?: string
  notes?: string
}

export interface RepairTicket {
  id: string
  ticketNumber: string
  date: string
  customerId: string
  customerName: string
  customerPhone: string
  deviceBrand: string
  deviceModel: string
  imei?: string
  issue: string
  diagnosis?: string
  priority: RepairPriority
  status: RepairStatus
  estimatedCost: number
  actualCost: number
  parts: RepairPart[]
  warrantyClaimId?: string
  technicianName: string
  receivedDate: string
  estimatedCompletionDate?: string
  completedDate?: string
  deliveredDate?: string
  notes?: string
}

export interface RepairPart {
  name: string
  cost: number
  quantity: number
}

// ─── Audit Log ──────────────────────────────────────────────────────────────

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "SALE"
  | "REFUND"
  | "PURCHASE"
  | "PAYMENT"
  | "STOCK_ADJUST"
  | "PRICE_CHANGE"
  | "EXPORT"
  | "SETTINGS_CHANGE"

export type AuditModule =
  | "Sales"
  | "Purchases"
  | "Products"
  | "Customers"
  | "Suppliers"
  | "Inventory"
  | "Expenses"
  | "Settings"
  | "Auth"
  | "Returns"
  | "Warranty"
  | "Payments"

export interface AuditLog {
  id: string
  timestamp: string
  userId: string
  userName: string
  userRole: string
  action: AuditAction
  module: AuditModule
  entityId?: string
  entityName?: string
  description: string
  oldValue?: string
  newValue?: string
  ipAddress?: string
}

// ─── Auth / Users ───────────────────────────────────────────────────────────

export type UserRole = "Admin" | "Manager" | "Cashier"

export interface AppUser {
  id: string
  tenantId: string
  name: string
  email: string
  phone: string
  role: UserRole
  avatar?: string
  status: "Active" | "Inactive"
  lastLogin?: string
  createdAt: string
}

// ─── Payments ───────────────────────────────────────────────────────────────

export interface Payment {
  id: string
  date: string
  type: "Received" | "Paid"
  entityType: "Customer" | "Supplier"
  entityId: string
  entityName: string
  referenceType: "Sale" | "Purchase" | "Return" | "Advance" | "Settlement"
  referenceId?: string
  referenceNumber?: string
  amount: number
  method: string
  status: "Completed" | "Pending" | "Failed" | "Cancelled"
  notes?: string
  processedBy: string
  createdAt: string
}

// Type definitions for IMEI records (data now fetched from Supabase)

export type PTAStatus = "approved" | "blocked" | "pending" | "not_registered"
export type DeviceStatus = "in_stock" | "sold" | "returned" | "defective" | "stolen" | "lost"

export interface IMEIHistoryEvent {
  id: string
  date: string
  event: string
  description: string
}

export interface IMEIRecord {
  id: string
  imei_number: string
  imei_2?: string
  brand: string
  model: string
  color: string
  storage_capacity: string
  pta_status: PTAStatus
  pta_tax_amount?: number
  device_status: DeviceStatus
  purchase_price: number
  selling_price?: number
  supplier_id: string
  supplier_name: string
  customer_name?: string
  customer_phone?: string
  sold_date?: string
  purchase_date: string
  warranty_expiry?: string
  notes?: string
  created_at: string
  updated_at: string
  history: IMEIHistoryEvent[]
}

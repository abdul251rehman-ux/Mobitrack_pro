// Type definitions for stock alerts (data now fetched from Supabase)

export type AlertType = "out_of_stock" | "low_stock" | "overstock"
export type AlertStatus = "active" | "acknowledged" | "resolved"
export type ProductType = "mobile_phone" | "accessory"
export type NotifyChannel = "dashboard" | "email" | "sms"

export interface StockAlertRule {
  id: string
  product_type: ProductType
  brand?: string
  model?: string
  category?: string
  minimum_stock_level: number
  reorder_quantity?: number
  preferred_supplier_id?: string
  preferred_supplier_name?: string
  alert_enabled: boolean
  notify_via: NotifyChannel[]
  created_at: string
  updated_at: string
}

export interface StockAlertLog {
  id: string
  product_name: string
  product_type: ProductType
  brand: string
  model?: string
  category?: string
  alert_type: AlertType
  status: AlertStatus
  current_stock: number
  minimum_stock_level: number
  last_restocked?: string
  acknowledged_by?: string
  acknowledged_at?: string
  resolved_at?: string
  created_at: string
}

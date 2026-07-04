// Type definitions and constants for used phones (data now fetched from Supabase)

export type ConditionGrade = "A+" | "A" | "B+" | "B" | "C" | "D"
export type ScreenCondition = "perfect" | "minor_scratches" | "cracked" | "replaced"
export type BodyCondition = "perfect" | "minor_wear" | "dents" | "heavy_damage"
export type SourceType = "customer_trade_in" | "walk_in" | "purchased" | "refurbished_in_house" | "auction"
export type PhoneStatus = "in_stock" | "under_repair" | "sold" | "listed_online"
export type UsedPTAStatus = "approved" | "pending" | "blocked"

export interface UsedPhone {
  id: string
  imei_number: string
  brand: string
  model: string
  color: string
  storage: string
  ram: string
  condition_grade: ConditionGrade
  screen_condition: ScreenCondition
  body_condition: BodyCondition
  battery_health?: number
  functional_issues: string[]
  accessories_included: string[]
  source_type: SourceType
  source_customer_id?: string
  source_customer_name?: string
  source_phone?: string
  source_cnic?: string
  source_address?: string
  supplier_id?: string
  supplier_name?: string
  purchase_price: number
  refurbishment_cost: number
  selling_price: number
  pta_status: UsedPTAStatus
  status: PhoneStatus
  warranty_days: number
  condition_notes?: string
  photos: string[]
  purchased_date: string
  sold_date?: string
  created_at: string
}

export const FUNCTIONAL_ISSUES = [
  { id: "no_wifi", label: "Wi-Fi Not Working" },
  { id: "no_bluetooth", label: "Bluetooth Issue" },
  { id: "speaker_issue", label: "Speaker Problem" },
  { id: "mic_issue", label: "Microphone Issue" },
  { id: "camera_issue", label: "Camera Not Working" },
  { id: "charging_issue", label: "Charging Port Issue" },
  { id: "button_issue", label: "Button Malfunction" },
  { id: "touch_issue", label: "Touch Screen Issue" },
  { id: "face_id_issue", label: "Face ID / Fingerprint Issue" },
  { id: "gps_issue", label: "GPS Not Working" },
  { id: "sim_issue", label: "SIM Card Issue" },
  { id: "battery_drain", label: "Fast Battery Drain" },
  { id: "overheating", label: "Overheating" },
  { id: "restart_issue", label: "Random Restarts" },
  { id: "display_issue", label: "Display Artifacts" },
]

export const ACCESSORIES_LIST = [
  { id: "box", label: "Original Box" },
  { id: "charger", label: "Charger" },
  { id: "cable", label: "USB Cable" },
  { id: "earphones", label: "Earphones" },
  { id: "case", label: "Phone Case" },
  { id: "screen_protector", label: "Screen Protector" },
  { id: "manual", label: "Manual / Docs" },
  { id: "sim_tool", label: "SIM Ejector Tool" },
]

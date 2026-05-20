import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toImeiRecord, toStockAlertRule, toStockAlertLog, toUsedPhone } from './types'
import type {
  DbImeiRecord,
  DbStockAlertRule,
  DbStockAlertLog,
  DbUsedPhone,
  ImeiRecord,
  StockAlertRule,
  StockAlertLog,
  UsedPhone,
} from './types'

// ─── IMEI Records ───────────────────────────────────────────────────────────

export async function getImeiRecords(): Promise<ImeiRecord[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('imei_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch IMEI records: ${error.message}`)
    return (data as DbImeiRecord[]).map(toImeiRecord)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch IMEI records')
  }
}

export async function getImeiRecordsByProduct(productId: string): Promise<ImeiRecord[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('imei_records')
      .select('*')
      .eq('product_id', productId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch IMEI records: ${error.message}`)
    return (data as DbImeiRecord[]).map(toImeiRecord)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch IMEI records')
  }
}

export async function createImeiRecord(
  data: Omit<ImeiRecord, 'id' | 'tenantId' | 'createdAt'>
): Promise<ImeiRecord> {
  try {
    const tenantId = await getTenantId()

    const dbRecord = {
      tenant_id: tenantId,
      product_id: data.productId,
      product_name: data.productName,
      imei: data.imei,
      status: data.status,
      purchase_id: data.purchaseId || null,
      sale_id: data.saleId || null,
      notes: data.notes || null,
    }

    const { data: created, error } = await supabase
      .from('imei_records')
      .insert(dbRecord)
      .select()
      .single()

    if (error) throw new Error(`Failed to create IMEI record: ${error.message}`)
    return toImeiRecord(created as DbImeiRecord)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create IMEI record')
  }
}

export async function updateImeiStatus(
  id: string,
  status: ImeiRecord['status'],
  saleId?: string
): Promise<void> {
  try {
    const updateData: Record<string, unknown> = { status }
    if (saleId !== undefined) updateData.sale_id = saleId

    const { error } = await supabase
      .from('imei_records')
      .update(updateData)
      .eq('id', id)

    if (error) throw new Error(`Failed to update IMEI status: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update IMEI status')
  }
}

// ─── Stock Alert Rules ──────────────────────────────────────────────────────

export async function getStockAlertRules(): Promise<StockAlertRule[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('stock_alert_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch stock alert rules: ${error.message}`)
    return (data as DbStockAlertRule[]).map(toStockAlertRule)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch stock alert rules')
  }
}

export async function createStockAlertRule(
  data: Omit<StockAlertRule, 'id' | 'tenantId' | 'createdAt'>
): Promise<StockAlertRule> {
  try {
    const tenantId = await getTenantId()

    const dbRule = {
      tenant_id: tenantId,
      product_id: data.productId,
      product_name: data.productName,
      product_type: data.productType,
      threshold: data.threshold,
      current_stock: data.currentStock,
      enabled: data.enabled,
    }

    const { data: created, error } = await supabase
      .from('stock_alert_rules')
      .insert(dbRule)
      .select()
      .single()

    if (error) throw new Error(`Failed to create stock alert rule: ${error.message}`)
    return toStockAlertRule(created as DbStockAlertRule)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create stock alert rule')
  }
}

export async function updateStockAlertRule(
  id: string,
  data: Partial<Pick<StockAlertRule, 'threshold' | 'enabled'>>
): Promise<void> {
  try {
    const updateData: Record<string, unknown> = {}
    if (data.threshold !== undefined) updateData.threshold = data.threshold
    if (data.enabled !== undefined) updateData.enabled = data.enabled

    const { error } = await supabase
      .from('stock_alert_rules')
      .update(updateData)
      .eq('id', id)

    if (error) throw new Error(`Failed to update stock alert rule: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update stock alert rule')
  }
}

// ─── Stock Alert Logs ───────────────────────────────────────────────────────

export async function getStockAlertLogs(): Promise<StockAlertLog[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('stock_alert_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('alerted_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch stock alert logs: ${error.message}`)
    return (data as DbStockAlertLog[]).map(toStockAlertLog)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch stock alert logs')
  }
}

export async function acknowledgeStockAlert(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('stock_alert_logs')
      .update({ acknowledged: true })
      .eq('id', id)

    if (error) throw new Error(`Failed to acknowledge stock alert: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to acknowledge stock alert')
  }
}

// ─── Used Phones ────────────────────────────────────────────────────────────

export async function getUsedPhones(): Promise<UsedPhone[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('used_phones')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch used phones: ${error.message}`)
    return (data as DbUsedPhone[]).map(toUsedPhone)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch used phones')
  }
}

export async function createUsedPhone(
  data: Omit<UsedPhone, 'id' | 'created_at'>
): Promise<UsedPhone> {
  try {
    const tenantId = await getTenantId()

    const dbPhone = {
      tenant_id: tenantId,
      brand: data.brand,
      model: data.model,
      color: data.color,
      storage: data.storage,
      ram: data.ram,
      imei_number: data.imei_number || null,
      condition_grade: data.condition_grade,
      screen_condition: data.screen_condition,
      body_condition: data.body_condition,
      battery_health: data.battery_health ?? null,
      functional_issues: data.functional_issues,
      accessories_included: data.accessories_included,
      source_type: data.source_type,
      source_customer_name: data.source_customer_name || null,
      purchase_price: data.purchase_price,
      refurbishment_cost: data.refurbishment_cost,
      selling_price: data.selling_price,
      pta_status: data.pta_status,
      status: data.status,
      warranty_days: data.warranty_days,
      condition_notes: data.condition_notes || null,
      photos: data.photos,
      purchased_date: data.purchased_date,
      sold_date: data.sold_date || null,
    }

    const { data: created, error } = await supabase
      .from('used_phones')
      .insert(dbPhone)
      .select()
      .single()

    if (error) throw new Error(`Failed to create used phone: ${error.message}`)
    return toUsedPhone(created as DbUsedPhone)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create used phone')
  }
}

export async function updateUsedPhone(
  id: string,
  data: Partial<UsedPhone>
): Promise<UsedPhone> {
  try {
    const updatePayload: Record<string, unknown> = {}
    if (data.brand !== undefined) updatePayload.brand = data.brand
    if (data.model !== undefined) updatePayload.model = data.model
    if (data.color !== undefined) updatePayload.color = data.color
    if (data.storage !== undefined) updatePayload.storage = data.storage
    if (data.ram !== undefined) updatePayload.ram = data.ram
    if (data.imei_number !== undefined) updatePayload.imei_number = data.imei_number
    if (data.condition_grade !== undefined) updatePayload.condition_grade = data.condition_grade
    if (data.screen_condition !== undefined) updatePayload.screen_condition = data.screen_condition
    if (data.body_condition !== undefined) updatePayload.body_condition = data.body_condition
    if (data.battery_health !== undefined) updatePayload.battery_health = data.battery_health ?? null
    if (data.functional_issues !== undefined) updatePayload.functional_issues = data.functional_issues
    if (data.accessories_included !== undefined) updatePayload.accessories_included = data.accessories_included
    if (data.source_type !== undefined) updatePayload.source_type = data.source_type
    if (data.source_customer_name !== undefined) updatePayload.source_customer_name = data.source_customer_name
    if (data.purchase_price !== undefined) updatePayload.purchase_price = data.purchase_price
    if (data.refurbishment_cost !== undefined) updatePayload.refurbishment_cost = data.refurbishment_cost
    if (data.selling_price !== undefined) updatePayload.selling_price = data.selling_price
    if (data.pta_status !== undefined) updatePayload.pta_status = data.pta_status
    if (data.status !== undefined) updatePayload.status = data.status
    if (data.warranty_days !== undefined) updatePayload.warranty_days = data.warranty_days
    if (data.condition_notes !== undefined) updatePayload.condition_notes = data.condition_notes
    if (data.photos !== undefined) updatePayload.photos = data.photos
    if (data.purchased_date !== undefined) updatePayload.purchased_date = data.purchased_date
    if (data.sold_date !== undefined) updatePayload.sold_date = data.sold_date ?? null

    const { data: updated, error } = await supabase
      .from('used_phones')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update used phone: ${error.message}`)
    return toUsedPhone(updated as DbUsedPhone)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update used phone')
  }
}

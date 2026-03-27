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
  data: Omit<UsedPhone, 'id' | 'tenantId'>
): Promise<UsedPhone> {
  try {
    const tenantId = await getTenantId()

    const dbPhone = {
      tenant_id: tenantId,
      brand: data.brand,
      model: data.model,
      imei: data.imei,
      color: data.color,
      storage: data.storage,
      ram: data.ram,
      condition: data.condition,
      grade: data.grade,
      purchase_price: data.purchasePrice,
      selling_price: data.sellingPrice,
      customer_id: data.customerId || null,
      customer_name: data.customerName || null,
      defects: data.defects || null,
      notes: data.notes || null,
      status: data.status,
      date_added: data.dateAdded,
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
    if (data.imei !== undefined) updatePayload.imei = data.imei
    if (data.color !== undefined) updatePayload.color = data.color
    if (data.storage !== undefined) updatePayload.storage = data.storage
    if (data.ram !== undefined) updatePayload.ram = data.ram
    if (data.condition !== undefined) updatePayload.condition = data.condition
    if (data.grade !== undefined) updatePayload.grade = data.grade
    if (data.purchasePrice !== undefined) updatePayload.purchase_price = data.purchasePrice
    if (data.sellingPrice !== undefined) updatePayload.selling_price = data.sellingPrice
    if (data.status !== undefined) updatePayload.status = data.status
    if (data.defects !== undefined) updatePayload.defects = data.defects
    if (data.notes !== undefined) updatePayload.notes = data.notes

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

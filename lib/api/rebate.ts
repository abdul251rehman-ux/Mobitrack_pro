import { supabase } from '../supabase'
import { getTenantId } from './helpers'

export type RebateType = 'rebate' | 'rate_diff'
export type RebateStatus = 'draft' | 'posted'

export interface RebateEntry {
  id: string
  tenantId: string
  type: RebateType
  supplierId: string
  supplierName: string
  model: string
  period: string        // "2026-07" for rebate, date string for rate_diff
  units: number
  ratePerUnit: number   // rebate amount per unit OR price difference per unit
  oldBuyPrice: number   // rate_diff only
  newBuyPrice: number   // rate_diff only
  total: number
  status: RebateStatus
  updateStockPrice: boolean   // rate_diff: update imei_records buy price
  updateSellPrice: boolean    // rate_diff: update mobiles sell price
  notes: string
  postedAt: string | null
  createdAt: string
}

export interface CreateRebateInput {
  type: RebateType
  supplierId: string
  supplierName: string
  model: string
  period: string
  units: number
  ratePerUnit: number
  oldBuyPrice?: number
  newBuyPrice?: number
  total: number
  status: RebateStatus
  updateStockPrice?: boolean
  updateSellPrice?: boolean
  notes?: string
}

function toRebateEntry(row: any): RebateEntry {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    type: row.type,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name ?? '',
    model: row.model ?? '',
    period: row.period ?? '',
    units: row.units ?? 0,
    ratePerUnit: row.rate_per_unit ?? 0,
    oldBuyPrice: row.old_buy_price ?? 0,
    newBuyPrice: row.new_buy_price ?? 0,
    total: row.total ?? 0,
    status: row.status ?? 'draft',
    updateStockPrice: row.update_stock_price ?? false,
    updateSellPrice: row.update_sell_price ?? false,
    notes: row.notes ?? '',
    postedAt: row.posted_at ?? null,
    createdAt: row.created_at,
  }
}

export async function getRebateEntries(): Promise<RebateEntry[]> {
  const tenantId = await getTenantId()
  const { data, error } = await supabase
    .from('rebate_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toRebateEntry)
}

export async function createRebateEntry(input: CreateRebateInput): Promise<RebateEntry> {
  const tenantId = await getTenantId()
  const { data, error } = await supabase
    .from('rebate_entries')
    .insert({
      tenant_id: tenantId,
      type: input.type,
      supplier_id: input.supplierId,
      supplier_name: input.supplierName,
      model: input.model,
      period: input.period,
      units: input.units,
      rate_per_unit: input.ratePerUnit,
      old_buy_price: input.oldBuyPrice ?? 0,
      new_buy_price: input.newBuyPrice ?? 0,
      total: input.total,
      status: input.status,
      update_stock_price: input.updateStockPrice ?? false,
      update_sell_price: input.updateSellPrice ?? false,
      notes: input.notes ?? '',
      posted_at: input.status === 'posted' ? new Date().toISOString() : null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return toRebateEntry(data)
}

export async function updateRebateEntry(id: string, input: Partial<CreateRebateInput>): Promise<RebateEntry> {
  const tenantId = await getTenantId()
  const patch: any = {}
  if (input.type !== undefined) patch.type = input.type
  if (input.supplierId !== undefined) patch.supplier_id = input.supplierId
  if (input.supplierName !== undefined) patch.supplier_name = input.supplierName
  if (input.model !== undefined) patch.model = input.model
  if (input.period !== undefined) patch.period = input.period
  if (input.units !== undefined) patch.units = input.units
  if (input.ratePerUnit !== undefined) patch.rate_per_unit = input.ratePerUnit
  if (input.oldBuyPrice !== undefined) patch.old_buy_price = input.oldBuyPrice
  if (input.newBuyPrice !== undefined) patch.new_buy_price = input.newBuyPrice
  if (input.total !== undefined) patch.total = input.total
  if (input.updateStockPrice !== undefined) patch.update_stock_price = input.updateStockPrice
  if (input.updateSellPrice !== undefined) patch.update_sell_price = input.updateSellPrice
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.status !== undefined) {
    patch.status = input.status
    patch.posted_at = input.status === 'posted' ? new Date().toISOString() : null
  }
  const { data, error } = await supabase
    .from('rebate_entries')
    .update(patch)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return toRebateEntry(data)
}

export async function deleteRebateEntry(id: string): Promise<void> {
  const tenantId = await getTenantId()
  const { error } = await supabase
    .from('rebate_entries')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (error) throw new Error(error.message)
}

// Post a draft rebate to supplier ledger + optionally update stock prices
export async function postRebateEntry(entry: RebateEntry): Promise<void> {
  const tenantId = await getTenantId()

  // 1. Update supplier outstanding balance
  // (rebate is tracked in rebate_entries; supplier ledger reads it directly — no payments row needed)
  const { data: sup } = await supabase.from('suppliers').select('outstanding_balance').eq('id', entry.supplierId).single()
  if (sup) {
    await supabase.from('suppliers').update({
      outstanding_balance: (sup.outstanding_balance ?? 0) - entry.total
    }).eq('id', entry.supplierId)
  }

  // 2. For rate_diff: optionally update buy price on unsold IMEI records
  if (entry.type === 'rate_diff' && entry.updateStockPrice && entry.newBuyPrice > 0) {
    await supabase.from('imei_records')
      .update({ purchase_price: entry.newBuyPrice })
      .eq('tenant_id', tenantId)
      .eq('model', entry.model)
      .eq('supplier_id', entry.supplierId)
      .eq('device_status', 'in_stock')
  }

  // 3. For rate_diff: optionally update selling price on mobiles catalog
  if (entry.type === 'rate_diff' && entry.updateSellPrice && entry.newBuyPrice > 0) {
    await supabase.from('mobiles')
      .update({ purchase_price: entry.newBuyPrice })
      .eq('tenant_id', tenantId)
      .eq('model', entry.model)
      .eq('supplier_id', entry.supplierId)
  }

  // 4. Mark as posted
  await supabase.from('rebate_entries')
    .update({ status: 'posted', posted_at: new Date().toISOString() })
    .eq('id', entry.id)
    .eq('tenant_id', tenantId)
}

// Get last purchase buy price for a model+supplier (for rate_diff old price auto-fill)
export async function getLastBuyPrice(model: string, supplierId: string): Promise<number | null> {
  const tenantId = await getTenantId()
  const { data } = await supabase
    .from('imei_records')
    .select('purchase_price')
    .eq('tenant_id', tenantId)
    .eq('model', model)
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.purchase_price ?? null
}

// Get sold units of a model from a supplier in a given month (for rebate auto-fill)
// period = "2026-07"
export async function getSoldUnitsInPeriod(model: string, supplierId: string, period: string): Promise<number> {
  const tenantId = await getTenantId()
  const [year, month] = period.split('-')
  const from = `${year}-${month}-01`
  // Last day of month
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
  const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

  const { count } = await supabase
    .from('imei_records')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('model', model)
    .eq('supplier_id', supplierId)
    .eq('device_status', 'sold')
    .gte('updated_at', from)
    .lte('updated_at', to)
  return count ?? 0
}

// Get rebate-eligible purchased units: excludes items returned back to supplier
export async function getTotalPurchasedUnits(model: string, supplierId: string): Promise<number> {
  const tenantId = await getTenantId()
  const { count } = await supabase.from('imei_records')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('model', model)
    .eq('supplier_id', supplierId)
    .neq('device_status', 'returned')   // purchase-returned phones get no rebate
  return count ?? 0
}

// Get total purchased accessory units (stock = current quantity from last purchase)
export async function getTotalPurchasedAccessoryUnits(name: string, supplierId: string): Promise<number> {
  const tenantId = await getTenantId()
  const { data } = await supabase.from('accessories')
    .select('stock')
    .eq('tenant_id', tenantId)
    .eq('name', name)
    .eq('supplier_id', supplierId)
    .maybeSingle()
  return (data as any)?.stock ?? 0
}

// Get all accessory names for a supplier (for model dropdown in rebate form)
export async function getAccessoryNamesForSupplier(supplierId: string): Promise<string[]> {
  const tenantId = await getTenantId()
  const { data } = await supabase.from('accessories')
    .select('name')
    .eq('tenant_id', tenantId)
    .eq('supplier_id', supplierId)
  const unique = Array.from(new Set((data ?? []).map((r: any) => r.name).filter(Boolean))) as string[]
  return unique.sort()
}

// Get unsold stock count for a model (for rate_diff auto-fill)
export async function getUnsoldStockForModel(model: string, supplierId: string): Promise<number> {
  const tenantId = await getTenantId()
  const { count } = await supabase.from('imei_records')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('model', model)
    .eq('supplier_id', supplierId)
    .eq('device_status', 'in_stock')
  return count ?? 0
}

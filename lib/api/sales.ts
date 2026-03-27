import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toSale, toDbSale, toDbSaleItem } from './types'
import type { DbSale, DbSaleItem } from './types'
import type { Sale, SaleItem } from '@/data/types'

export async function getSales(): Promise<Sale[]> {
  try {
    const tenantId = await getTenantId()
    const { data: sales, error } = await supabase
      .from('sales')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch sales: ${error.message}`)

    // Fetch all sale items for these sales in one query
    const saleIds = (sales as DbSale[]).map((s) => s.id)
    if (saleIds.length === 0) return []

    const { data: allItems, error: itemsError } = await supabase
      .from('sale_items')
      .select('*')
      .in('sale_id', saleIds)

    if (itemsError) throw new Error(`Failed to fetch sale items: ${itemsError.message}`)

    const itemsBySale = new Map<string, DbSaleItem[]>()
    for (const item of (allItems as DbSaleItem[])) {
      const list = itemsBySale.get(item.sale_id) ?? []
      list.push(item)
      itemsBySale.set(item.sale_id, list)
    }

    return (sales as DbSale[]).map((s) => toSale(s, itemsBySale.get(s.id) ?? []))
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch sales')
  }
}

export async function getSaleById(id: string): Promise<Sale | null> {
  try {
    const tenantId = await getTenantId()
    const { data: sale, error } = await supabase
      .from('sales')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch sale: ${error.message}`)
    }

    const { data: items, error: itemsError } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', id)

    if (itemsError) throw new Error(`Failed to fetch sale items: ${itemsError.message}`)

    return toSale(sale as DbSale, (items as DbSaleItem[]) ?? [])
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch sale')
  }
}

export async function createSale(
  data: Omit<Sale, 'id'>,
  items: Omit<SaleItem, 'id'>[]
): Promise<Sale> {
  try {
    const tenantId = await getTenantId()
    const dbSale = toDbSale(data as Partial<Sale>, tenantId)

    // Insert the sale
    const { data: createdSale, error: saleError } = await supabase
      .from('sales')
      .insert(dbSale)
      .select()
      .single()

    if (saleError) throw new Error(`Failed to create sale: ${saleError.message}`)

    const saleId = (createdSale as DbSale).id

    // Insert sale items
    const dbItems = items.map((item) => toDbSaleItem(item as SaleItem, saleId, tenantId))

    const { data: createdItems, error: itemsError } = await supabase
      .from('sale_items')
      .insert(dbItems)
      .select()

    if (itemsError) throw new Error(`Failed to create sale items: ${itemsError.message}`)

    // Stock decrement is handled by DB trigger
    return toSale(createdSale as DbSale, (createdItems as DbSaleItem[]) ?? [])
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create sale')
  }
}

export async function updateSaleStatus(id: string, status: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('sales')
      .update({ status })
      .eq('id', id)

    if (error) throw new Error(`Failed to update sale status: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update sale status')
  }
}

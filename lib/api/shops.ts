import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import {
  toShop,
  toDbShop,
  toReservedSale,
  toConsignment,
} from './types'
import type {
  DbShop,
  DbReservedSale,
  DbReservedSaleItem,
  DbConsignment,
  DbConsignmentItem,
  DbConsignmentTransaction,
  DbConsignmentTransactionItem,
} from './types'
import type { Shop, ReservedSale, Consignment } from '@/data/types'

// ─── Shops ──────────────────────────────────────────────────────────────────

export async function getShops(): Promise<Shop[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch shops: ${error.message}`)
    return (data as DbShop[]).map(toShop)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch shops')
  }
}

export async function getShopById(id: string): Promise<Shop | null> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('shops')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch shop: ${error.message}`)
    }
    return toShop(data as DbShop)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch shop')
  }
}

export async function createShop(data: Omit<Shop, 'id'>): Promise<Shop> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbShop(data as Partial<Shop>, tenantId)

    const { data: created, error } = await supabase
      .from('shops')
      .insert(dbData)
      .select()
      .single()

    if (error) throw new Error(`Failed to create shop: ${error.message}`)
    return toShop(created as DbShop)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create shop')
  }
}

export async function updateShop(id: string, data: Partial<Shop>): Promise<Shop> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbShop(data, tenantId)
    const { tenant_id: _, ...updateData } = dbData as DbShop

    const { data: updated, error } = await supabase
      .from('shops')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update shop: ${error.message}`)
    return toShop(updated as DbShop)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update shop')
  }
}

export async function deleteShop(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('shops')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete shop: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to delete shop')
  }
}

// ─── Reserved Sales ─────────────────────────────────────────────────────────

export async function getReservedSales(): Promise<ReservedSale[]> {
  try {
    const tenantId = await getTenantId()
    const { data: sales, error } = await supabase
      .from('reserved_sales')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch reserved sales: ${error.message}`)

    const saleIds = (sales as DbReservedSale[]).map((s) => s.id)
    if (saleIds.length === 0) return []

    const { data: allItems, error: itemsError } = await supabase
      .from('reserved_sale_items')
      .select('*')
      .in('reserved_sale_id', saleIds)

    if (itemsError) throw new Error(`Failed to fetch reserved sale items: ${itemsError.message}`)

    const itemsBySale = new Map<string, DbReservedSaleItem[]>()
    for (const item of (allItems as DbReservedSaleItem[])) {
      const list = itemsBySale.get(item.reserved_sale_id) ?? []
      list.push(item)
      itemsBySale.set(item.reserved_sale_id, list)
    }

    return (sales as DbReservedSale[]).map((s) =>
      toReservedSale(s, itemsBySale.get(s.id) ?? [])
    )
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch reserved sales')
  }
}

// ─── Consignments ───────────────────────────────────────────────────────────

export async function getConsignments(): Promise<Consignment[]> {
  try {
    const tenantId = await getTenantId()
    const { data: consignments, error } = await supabase
      .from('consignments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch consignments: ${error.message}`)

    const consignmentIds = (consignments as DbConsignment[]).map((c) => c.id)
    if (consignmentIds.length === 0) return []

    // Fetch items
    const { data: allItems, error: itemsError } = await supabase
      .from('consignment_items')
      .select('*')
      .in('consignment_id', consignmentIds)

    if (itemsError) throw new Error(`Failed to fetch consignment items: ${itemsError.message}`)

    const itemsByConsignment = new Map<string, DbConsignmentItem[]>()
    for (const item of (allItems as DbConsignmentItem[])) {
      const list = itemsByConsignment.get(item.consignment_id) ?? []
      list.push(item)
      itemsByConsignment.set(item.consignment_id, list)
    }

    // Fetch transactions
    const { data: allTransactions, error: txError } = await supabase
      .from('consignment_transactions')
      .select('*')
      .in('consignment_id', consignmentIds)

    if (txError) throw new Error(`Failed to fetch consignment transactions: ${txError.message}`)

    const txIds = (allTransactions as DbConsignmentTransaction[]).map((t) => t.id)
    let allTxItems: DbConsignmentTransactionItem[] = []

    if (txIds.length > 0) {
      const { data: txItems, error: txItemsError } = await supabase
        .from('consignment_transaction_items')
        .select('*')
        .in('transaction_id', txIds)

      if (txItemsError) throw new Error(`Failed to fetch transaction items: ${txItemsError.message}`)
      allTxItems = (txItems as DbConsignmentTransactionItem[]) ?? []
    }

    const txItemsByTx = new Map<string, DbConsignmentTransactionItem[]>()
    for (const item of allTxItems) {
      const list = txItemsByTx.get(item.transaction_id) ?? []
      list.push(item)
      txItemsByTx.set(item.transaction_id, list)
    }

    const txByConsignment = new Map<string, (DbConsignmentTransaction & { items: DbConsignmentTransactionItem[] })[]>()
    for (const tx of (allTransactions as DbConsignmentTransaction[])) {
      const list = txByConsignment.get(tx.consignment_id) ?? []
      list.push({ ...tx, items: txItemsByTx.get(tx.id) ?? [] })
      txByConsignment.set(tx.consignment_id, list)
    }

    return (consignments as DbConsignment[]).map((c) =>
      toConsignment(
        c,
        itemsByConsignment.get(c.id) ?? [],
        txByConsignment.get(c.id) ?? []
      )
    )
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch consignments')
  }
}

export async function getConsignmentById(id: string): Promise<Consignment | null> {
  try {
    const tenantId = await getTenantId()
    const { data: consignment, error } = await supabase
      .from('consignments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch consignment: ${error.message}`)
    }

    const { data: items, error: itemsError } = await supabase
      .from('consignment_items')
      .select('*')
      .eq('consignment_id', id)

    if (itemsError) throw new Error(`Failed to fetch consignment items: ${itemsError.message}`)

    const { data: transactions, error: txError } = await supabase
      .from('consignment_transactions')
      .select('*')
      .eq('consignment_id', id)

    if (txError) throw new Error(`Failed to fetch consignment transactions: ${txError.message}`)

    const txIds = (transactions as DbConsignmentTransaction[]).map((t) => t.id)
    let txItems: DbConsignmentTransactionItem[] = []

    if (txIds.length > 0) {
      const { data: txItemsData, error: txItemsError } = await supabase
        .from('consignment_transaction_items')
        .select('*')
        .in('transaction_id', txIds)

      if (txItemsError) throw new Error(`Failed to fetch transaction items: ${txItemsError.message}`)
      txItems = (txItemsData as DbConsignmentTransactionItem[]) ?? []
    }

    const txItemsByTx = new Map<string, DbConsignmentTransactionItem[]>()
    for (const item of txItems) {
      const list = txItemsByTx.get(item.transaction_id) ?? []
      list.push(item)
      txItemsByTx.set(item.transaction_id, list)
    }

    const fullTransactions = (transactions as DbConsignmentTransaction[]).map((tx) => ({
      ...tx,
      items: txItemsByTx.get(tx.id) ?? [],
    }))

    return toConsignment(
      consignment as DbConsignment,
      (items as DbConsignmentItem[]) ?? [],
      fullTransactions
    )
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch consignment')
  }
}

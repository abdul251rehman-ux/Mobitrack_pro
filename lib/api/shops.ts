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
import type { Shop, ReservedSale, Consignment, ConsignmentTransaction } from '@/data/types'

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

// ─── Create Consignment (Dispatch) ──────────────────────────────────────────

export async function createConsignment(con: Omit<Consignment, 'id' | 'dispatchNumber' | 'transactions'>): Promise<Consignment> {
  const tenantId = await getTenantId()

  // Generate dispatch number
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('consignments')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
  const seq = String((count ?? 0) + 1).padStart(3, '0')
  const dispatchNumber = `DSP-${year}-${seq}`

  // Insert consignment header
  const { data: conRow, error: conErr } = await supabase
    .from('consignments')
    .insert({
      tenant_id: tenantId,
      dispatch_number: dispatchNumber,
      date: con.date,
      shop_id: con.shopId,
      shop_name: con.shopName,
      shop_phone: con.shopPhone ?? null,
      total_value: con.totalValue,
      amount_collected: 0,
      status: 'Active',
      due_date: con.dueDate ?? null,
      notes: con.notes ?? null,
    })
    .select()
    .single()

  if (conErr) throw new Error(`Failed to create consignment: ${conErr.message}`)
  const conId = (conRow as DbConsignment).id

  // Insert items
  const itemRows = con.items.map(it => ({
    tenant_id: tenantId,
    consignment_id: conId,
    product_id: it.productId,
    product_name: it.productName,
    product_type: it.productType,
    dispatched: it.dispatched,
    returned: 0,
    sold: 0,
    unit_price: it.unitPrice,
    imeis: it.imeis ?? null,
    sold_imeis: null,
    returned_imeis: null,
  }))

  const { error: itemsErr } = await supabase.from('consignment_items').insert(itemRows)
  if (itemsErr) throw new Error(`Failed to insert consignment items: ${itemsErr.message}`)

  return getConsignmentById(conId) as Promise<Consignment>
}

// ─── Record Consignment Sale ─────────────────────────────────────────────────

export async function recordConsignmentSale(
  conId: string,
  txn: ConsignmentTransaction
): Promise<Consignment> {
  const tenantId = await getTenantId()

  // Fetch current consignment_items to get row IDs and current counts
  const { data: dbItems, error: fetchErr } = await supabase
    .from('consignment_items')
    .select('id, product_id, sold, sold_imeis')
    .eq('consignment_id', conId)
  if (fetchErr) throw new Error(`Failed to fetch consignment items: ${fetchErr.message}`)

  // Insert transaction header
  const { data: txRow, error: txErr } = await supabase
    .from('consignment_transactions')
    .insert({
      tenant_id: tenantId,
      consignment_id: conId,
      date: txn.date,
      type: 'Sale',
      amount: txn.amount,
      payment_method: txn.paymentMethod ?? null,
      notes: txn.notes ?? null,
    })
    .select()
    .single()

  if (txErr) throw new Error(`Failed to create transaction: ${txErr.message}`)
  const txId = (txRow as DbConsignmentTransaction).id

  // Insert transaction items
  const txItemRows = txn.items.map(it => ({
    transaction_id: txId,
    product_id: it.productId,
    product_name: it.productName,
    quantity: it.quantity,
    unit_price: it.unitPrice,
    imeis: it.imeis ?? null,
  }))
  const { error: txItemsErr } = await supabase.from('consignment_transaction_items').insert(txItemRows)
  if (txItemsErr) throw new Error(`Failed to insert transaction items: ${txItemsErr.message}`)

  // Update each consignment_item: increment sold + append sold_imeis
  for (const txItem of txn.items) {
    const dbItem = (dbItems as any[]).find((r: any) => r.product_id === txItem.productId)
    if (!dbItem) continue
    const newSold = (dbItem.sold ?? 0) + txItem.quantity
    const newSoldImeis = txItem.imeis
      ? [...(dbItem.sold_imeis ?? []), ...txItem.imeis]
      : dbItem.sold_imeis
    await supabase
      .from('consignment_items')
      .update({ sold: newSold, sold_imeis: newSoldImeis })
      .eq('id', dbItem.id)
  }

  // Update consignment: amount_collected + status
  const { data: allItems } = await supabase
    .from('consignment_items')
    .select('dispatched, returned, sold')
    .eq('consignment_id', conId)

  const rows = (allItems ?? []) as { dispatched: number; returned: number; sold: number }[]
  const newStatus = computeConsignmentStatus(rows)

  const { data: conRow } = await supabase
    .from('consignments')
    .select('amount_collected')
    .eq('id', conId)
    .single()

  await supabase
    .from('consignments')
    .update({ amount_collected: ((conRow as any)?.amount_collected ?? 0) + txn.amount, status: newStatus })
    .eq('id', conId)

  return getConsignmentById(conId) as Promise<Consignment>
}

// ─── Record Consignment Return ───────────────────────────────────────────────

export async function recordConsignmentReturn(
  conId: string,
  txn: ConsignmentTransaction
): Promise<Consignment> {
  const tenantId = await getTenantId()

  // Fetch current consignment_items for row IDs + current counts + product_type
  const { data: dbItems, error: fetchErr } = await supabase
    .from('consignment_items')
    .select('id, product_id, product_type, returned, returned_imeis')
    .eq('consignment_id', conId)
  if (fetchErr) throw new Error(`Failed to fetch consignment items: ${fetchErr.message}`)

  // Insert transaction header
  const { data: txRow, error: txErr } = await supabase
    .from('consignment_transactions')
    .insert({
      tenant_id: tenantId,
      consignment_id: conId,
      date: txn.date,
      type: 'Return',
      amount: 0,
      payment_method: null,
      notes: txn.notes ?? null,
    })
    .select()
    .single()

  if (txErr) throw new Error(`Failed to create return transaction: ${txErr.message}`)
  const txId = (txRow as DbConsignmentTransaction).id

  const txItemRows = txn.items.map(it => ({
    transaction_id: txId,
    product_id: it.productId,
    product_name: it.productName,
    quantity: it.quantity,
    unit_price: it.unitPrice,
    imeis: it.imeis ?? null,
  }))
  const { error: txItemsErr } = await supabase.from('consignment_transaction_items').insert(txItemRows)
  if (txItemsErr) throw new Error(`Failed to insert return items: ${txItemsErr.message}`)

  // Update consignment_items + restore stock
  for (const txItem of txn.items) {
    const dbItem = (dbItems as any[]).find((r: any) => r.product_id === txItem.productId)
    if (!dbItem) continue

    const newReturned = (dbItem.returned ?? 0) + txItem.quantity
    const newReturnedImeis = txItem.imeis
      ? [...(dbItem.returned_imeis ?? []), ...txItem.imeis]
      : dbItem.returned_imeis

    await supabase
      .from('consignment_items')
      .update({ returned: newReturned, returned_imeis: newReturnedImeis })
      .eq('id', dbItem.id)

    // Stock restore is skipped — consignment items use free-text product names without real product IDs
  }

  // Recompute status
  const { data: allItems } = await supabase
    .from('consignment_items')
    .select('dispatched, returned, sold')
    .eq('consignment_id', conId)

  const rows = (allItems ?? []) as { dispatched: number; returned: number; sold: number }[]
  await supabase.from('consignments').update({ status: computeConsignmentStatus(rows) }).eq('id', conId)

  return getConsignmentById(conId) as Promise<Consignment>
}

function computeConsignmentStatus(rows: { dispatched: number; returned: number; sold: number }[]): string {
  if (rows.length === 0) return 'Active'
  const totalOut = rows.reduce((s, r) => s + (r.dispatched - r.returned - r.sold), 0)
  if (rows.every(r => r.returned === r.dispatched)) return 'Returned'
  if (rows.every(r => r.sold + r.returned === r.dispatched)) return 'Fully Settled'
  if (totalOut < rows.reduce((s, r) => s + r.dispatched, 0)) return 'Partially Settled'
  return 'Active'
}

// ─── Confirm Reserved Sale ───────────────────────────────────────────────────

export async function confirmReservedSale(id: string, paymentMethod: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('reserved_sales')
    .update({ status: 'Confirmed', payment_method: paymentMethod, notes: notes || null })
    .eq('id', id)
  if (error) throw new Error(`Failed to confirm reservation: ${error.message}`)
}

// ─── Cancel Reserved Sale ────────────────────────────────────────────────────

export async function cancelReservedSale(id: string): Promise<void> {
  const { error } = await supabase
    .from('reserved_sales')
    .update({ status: 'Cancelled' })
    .eq('id', id)
  if (error) throw new Error(`Failed to cancel reservation: ${error.message}`)
}

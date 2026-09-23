import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toSale } from './types'
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

/**
 * Creates a sale, its line items, and every side effect (stock decrement,
 * IMEI/used-phone status, customer stats, payments, finance transactions)
 * in one atomic Postgres transaction via fn_create_sale. Either everything
 * commits or nothing does - no half-saved sale is possible.
 */
export async function createSale(
  data: Omit<Sale, 'id' | 'invoiceNumber' | 'paymentMethod' | 'amountReceived' | 'changeDue'> & { customerId?: string },
  items: Omit<SaleItem, 'id'>[],
  splits: { accountId: string; amount: number }[]
): Promise<Sale> {
  const tenantId = await getTenantId()

  const { data: result, error } = await supabase.rpc('fn_create_sale', {
    p_tenant_id: tenantId,
    p_date: data.date,
    p_customer_id: data.customerId || null,
    p_customer_name: data.customerName,
    p_customer_phone: data.customerPhone,
    p_discount: data.discount,
    p_tax: data.tax,
    p_warranty_days: data.warrantyDays ?? null,
    p_notes: data.notes ?? null,
    p_items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productType: item.productType,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      lineTotal: item.lineTotal,
      imei: item.imei ?? null,
    })),
    p_splits: splits,
  })

  if (error) throw new Error(`Failed to create sale: ${error.message}`)

  return toSale(result.sale as DbSale, (result.items as DbSaleItem[]) ?? [])
}

/**
 * Voids (deletes) a sale and reverses every side effect it caused - stock,
 * IMEI/used-phone status, customer stats, finance balances - atomically.
 * Replaces the old handleDeleteSale, which had no error checking at all
 * and never reversed customer stats.
 */
export async function voidSale(saleId: string): Promise<void> {
  const tenantId = await getTenantId()
  const { error } = await supabase.rpc('fn_void_sale', {
    p_tenant_id: tenantId,
    p_sale_id: saleId,
  })
  if (error) throw new Error(`Failed to void sale: ${error.message}`)
}

// Applies a general (not tied to one invoice) customer payment across that
// customer's oldest not-fully-paid sales first (FIFO), via the
// settle_customer_payment RPC (supabase/fix_purchase_payment_sync.sql). See
// settleSupplierPayment (lib/api/purchases.ts) for the matching supplier-side
// gap this closes - "Collect Payment" only wrote to `payments`, never back
// onto the sales rows themselves.
export async function settleCustomerPayment(customerId: string, amount: number): Promise<void> {
  const tenantId = await getTenantId()
  const { error } = await supabase.rpc('settle_customer_payment', {
    p_tenant_id: tenantId,
    p_customer_id: customerId,
    p_amount: amount,
  })
  if (error) throw new Error(`Failed to settle customer payment: ${error.message}`)
}

// Atomic, row-locked reserve/release of sale_items.returned_qty (see
// supabase/add_return_item_tracking.sql) - used by app/returns/page.tsx so
// two returns (or a return and a reject) touching the same sale_items row
// at nearly the same time can't clobber each other's read-then-write,
// mirroring adjust_account_balance/adjust_supplier_balance.
export async function reserveReturnQty(saleItemId: string, qty: number): Promise<void> {
  const tenantId = await getTenantId()
  const { error } = await supabase.rpc('reserve_return_qty', {
    p_sale_item_id: saleItemId,
    p_tenant_id: tenantId,
    p_qty: qty,
  })
  if (error) throw new Error(`Failed to reserve returned quantity: ${error.message}`)
}

export async function releaseReturnQty(saleItemId: string, qty: number): Promise<void> {
  const tenantId = await getTenantId()
  const { error } = await supabase.rpc('release_return_qty', {
    p_sale_item_id: saleItemId,
    p_tenant_id: tenantId,
    p_qty: qty,
  })
  if (error) throw new Error(`Failed to release returned quantity: ${error.message}`)
}

export async function updateSaleStatus(id: string, status: string): Promise<void> {
  try {
    const tenantId = await getTenantId()
    const { error } = await supabase
      .from('sales')
      .update({ status })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw new Error(`Failed to update sale status: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update sale status')
  }
}

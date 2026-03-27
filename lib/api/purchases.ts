import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toPurchase, toDbPurchase, toDbPurchaseItem } from './types'
import type { DbPurchase, DbPurchaseItem } from './types'
import type { Purchase, PurchaseItem } from '@/data/types'

export async function getPurchases(): Promise<Purchase[]> {
  try {
    const tenantId = await getTenantId()
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch purchases: ${error.message}`)

    const purchaseIds = (purchases as DbPurchase[]).map((p) => p.id)
    if (purchaseIds.length === 0) return []

    const { data: allItems, error: itemsError } = await supabase
      .from('purchase_items')
      .select('*')
      .in('purchase_id', purchaseIds)

    if (itemsError) throw new Error(`Failed to fetch purchase items: ${itemsError.message}`)

    const itemsByPurchase = new Map<string, DbPurchaseItem[]>()
    for (const item of (allItems as DbPurchaseItem[])) {
      const list = itemsByPurchase.get(item.purchase_id) ?? []
      list.push(item)
      itemsByPurchase.set(item.purchase_id, list)
    }

    return (purchases as DbPurchase[]).map((p) =>
      toPurchase(p, itemsByPurchase.get(p.id) ?? [])
    )
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch purchases')
  }
}

export async function getPurchaseById(id: string): Promise<Purchase | null> {
  try {
    const tenantId = await getTenantId()
    const { data: purchase, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch purchase: ${error.message}`)
    }

    const { data: items, error: itemsError } = await supabase
      .from('purchase_items')
      .select('*')
      .eq('purchase_id', id)

    if (itemsError) throw new Error(`Failed to fetch purchase items: ${itemsError.message}`)

    return toPurchase(purchase as DbPurchase, (items as DbPurchaseItem[]) ?? [])
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch purchase')
  }
}

export async function createPurchase(
  data: Omit<Purchase, 'id'>,
  items: Omit<PurchaseItem, 'id'>[]
): Promise<Purchase> {
  try {
    const tenantId = await getTenantId()
    const dbPurchase = toDbPurchase(data as Partial<Purchase>, tenantId)

    const { data: created, error: purchaseError } = await supabase
      .from('purchases')
      .insert(dbPurchase)
      .select()
      .single()

    if (purchaseError) throw new Error(`Failed to create purchase: ${purchaseError.message}`)

    const purchaseId = (created as DbPurchase).id

    const dbItems = items.map((item) =>
      toDbPurchaseItem(item as PurchaseItem, purchaseId, tenantId)
    )

    const { data: createdItems, error: itemsError } = await supabase
      .from('purchase_items')
      .insert(dbItems)
      .select()

    if (itemsError) throw new Error(`Failed to create purchase items: ${itemsError.message}`)

    return toPurchase(created as DbPurchase, (createdItems as DbPurchaseItem[]) ?? [])
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create purchase')
  }
}

export async function updatePurchaseStatus(id: string, data: Partial<Purchase>): Promise<void> {
  try {
    const updatePayload: Record<string, unknown> = {}
    if (data.paymentStatus !== undefined) updatePayload.payment_status = data.paymentStatus
    if (data.deliveryStatus !== undefined) updatePayload.delivery_status = data.deliveryStatus
    if (data.amountPaid !== undefined) updatePayload.amount_paid = data.amountPaid
    if (data.balanceDue !== undefined) updatePayload.balance_due = data.balanceDue
    if (data.notes !== undefined) updatePayload.notes = data.notes

    const { error } = await supabase
      .from('purchases')
      .update(updatePayload)
      .eq('id', id)

    if (error) throw new Error(`Failed to update purchase: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update purchase')
  }
}

import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toReturn, toReturnItem } from './types'
import type { DbReturn, DbReturnItem } from './types'
import type { Return, ReturnItem, ReturnStatus } from '@/data/types'

export async function getReturns(): Promise<Return[]> {
  try {
    const tenantId = await getTenantId()
    const { data: returns, error } = await supabase
      .from('returns')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch returns: ${error.message}`)

    const returnIds = (returns as DbReturn[]).map((r) => r.id)
    if (returnIds.length === 0) return []

    const { data: allItems, error: itemsError } = await supabase
      .from('return_items')
      .select('*')
      .in('return_id', returnIds)

    if (itemsError) throw new Error(`Failed to fetch return items: ${itemsError.message}`)

    const itemsByReturn = new Map<string, DbReturnItem[]>()
    for (const item of (allItems as DbReturnItem[])) {
      const list = itemsByReturn.get(item.return_id) ?? []
      list.push(item)
      itemsByReturn.set(item.return_id, list)
    }

    return (returns as DbReturn[]).map((r) => toReturn(r, itemsByReturn.get(r.id) ?? []))
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch returns')
  }
}

export async function getReturnById(id: string): Promise<Return | null> {
  try {
    const tenantId = await getTenantId()
    const { data: returnData, error } = await supabase
      .from('returns')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch return: ${error.message}`)
    }

    const { data: items, error: itemsError } = await supabase
      .from('return_items')
      .select('*')
      .eq('return_id', id)

    if (itemsError) throw new Error(`Failed to fetch return items: ${itemsError.message}`)

    return toReturn(returnData as DbReturn, (items as DbReturnItem[]) ?? [])
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch return')
  }
}

export async function createReturn(
  data: Omit<Return, 'id'>,
  items: ReturnItem[]
): Promise<Return> {
  try {
    const tenantId = await getTenantId()

    const dbReturn: Record<string, unknown> = {
      tenant_id: tenantId,
      return_number: data.returnNumber,
      date: data.date,
      sale_id: data.saleId,
      invoice_number: data.invoiceNumber,
      customer_id: data.customerId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      reason: data.reason,
      subtotal: data.subtotal,
      refund_amount: data.refundAmount,
      refund_method: data.refundMethod,
      status: data.status,
      restock_items: data.restockItems,
      exchange_sale_id: data.exchangeSaleId || null,
      processed_by: data.processedBy,
      notes: data.notes || null,
    }

    const { data: created, error } = await supabase
      .from('returns')
      .insert(dbReturn)
      .select()
      .single()

    if (error) throw new Error(`Failed to create return: ${error.message}`)

    const returnId = (created as DbReturn).id

    const dbItems = items.map((item) => ({
      tenant_id: tenantId,
      return_id: returnId,
      product_id: item.productId,
      product_name: item.productName,
      product_type: item.productType,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      imei: item.imei || null,
      condition: item.condition,
    }))

    const { data: createdItems, error: itemsError } = await supabase
      .from('return_items')
      .insert(dbItems)
      .select()

    if (itemsError) throw new Error(`Failed to create return items: ${itemsError.message}`)

    return toReturn(created as DbReturn, (createdItems as DbReturnItem[]) ?? [])
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create return')
  }
}

export async function updateReturnStatus(id: string, status: ReturnStatus): Promise<void> {
  try {
    const updateData: Record<string, unknown> = { status }
    if (status === 'Completed' || status === 'Rejected') {
      updateData.resolved_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('returns')
      .update(updateData)
      .eq('id', id)

    if (error) throw new Error(`Failed to update return status: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update return status')
  }
}

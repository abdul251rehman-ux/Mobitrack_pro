import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toCustomer, toDbCustomer } from './types'
import type { DbCustomer } from './types'
import type { Customer } from '@/data/types'

export async function getCustomers(): Promise<Customer[]> {
  try {
    const tenantId = await getTenantId()
    const [{ data, error }, { data: salesData }] = await Promise.all([
      supabase.from('customers').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('sales').select('customer_id, total, date').eq('tenant_id', tenantId).neq('status', 'Refunded'),
    ])

    if (error) throw new Error(`Failed to fetch customers: ${error.message}`)

    // Build per-customer sales stats from live sales data
    const statsMap = new Map<string, { count: number; spent: number; lastDate: string | null }>()
    for (const s of (salesData ?? [])) {
      const cid = s.customer_id
      if (!cid) continue
      const existing = statsMap.get(cid) ?? { count: 0, spent: 0, lastDate: null }
      existing.count += 1
      existing.spent += s.total ?? 0
      if (!existing.lastDate || s.date > existing.lastDate) existing.lastDate = s.date
      statsMap.set(cid, existing)
    }

    return (data as DbCustomer[]).map(db => {
      const stats = statsMap.get(db.id)
      return toCustomer({
        ...db,
        total_purchases: stats?.count ?? 0,
        total_spent: stats?.spent ?? 0,
        last_purchase_date: stats?.lastDate ?? null,
      })
    })
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch customers')
  }
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch customer: ${error.message}`)
    }
    return toCustomer(data as DbCustomer)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch customer')
  }
}

export async function createCustomer(data: Omit<Customer, 'id'>): Promise<Customer> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbCustomer(data as Partial<Customer>, tenantId)

    const { data: created, error } = await supabase
      .from('customers')
      .insert(dbData)
      .select()
      .single()

    if (error) throw new Error(`Failed to create customer: ${error.message}`)
    return toCustomer(created as DbCustomer)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create customer')
  }
}

export async function updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbCustomer(data, tenantId)
    const { tenant_id: _, ...updateData } = dbData as DbCustomer

    const { data: updated, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update customer: ${error.message}`)
    return toCustomer(updated as DbCustomer)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update customer')
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  try {
    const tenantId = await getTenantId()
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw new Error(`Failed to delete customer: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to delete customer')
  }
}

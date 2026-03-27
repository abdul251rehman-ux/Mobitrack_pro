import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toCustomer, toDbCustomer } from './types'
import type { DbCustomer } from './types'
import type { Customer } from '@/data/types'

export async function getCustomers(): Promise<Customer[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch customers: ${error.message}`)
    return (data as DbCustomer[]).map(toCustomer)
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
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete customer: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to delete customer')
  }
}

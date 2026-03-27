import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toSupplier, toDbSupplier } from './types'
import type { DbSupplier } from './types'
import type { Supplier } from '@/data/types'

export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch suppliers: ${error.message}`)
    return (data as DbSupplier[]).map(toSupplier)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch suppliers')
  }
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch supplier: ${error.message}`)
    }
    return toSupplier(data as DbSupplier)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch supplier')
  }
}

export async function createSupplier(data: Omit<Supplier, 'id'>): Promise<Supplier> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbSupplier(data as Partial<Supplier>, tenantId)

    const { data: created, error } = await supabase
      .from('suppliers')
      .insert(dbData)
      .select()
      .single()

    if (error) throw new Error(`Failed to create supplier: ${error.message}`)
    return toSupplier(created as DbSupplier)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create supplier')
  }
}

export async function updateSupplier(id: string, data: Partial<Supplier>): Promise<Supplier> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbSupplier(data, tenantId)
    const { tenant_id: _, ...updateData } = dbData as DbSupplier

    const { data: updated, error } = await supabase
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update supplier: ${error.message}`)
    return toSupplier(updated as DbSupplier)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update supplier')
  }
}

export async function deleteSupplier(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete supplier: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to delete supplier')
  }
}

import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import {
  toMobile,
  toDbMobile,
  toAccessory,
  toDbAccessory,
} from './types'
import type { DbMobile, DbAccessory } from './types'
import type { Mobile, Accessory } from '@/data/types'

// ─── Mobiles ────────────────────────────────────────────────────────────────

export async function getMobiles(): Promise<Mobile[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('mobiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch mobiles: ${error.message}`)
    return (data as DbMobile[]).map(toMobile)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch mobiles')
  }
}

export async function getMobileById(id: string): Promise<Mobile | null> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('mobiles')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch mobile: ${error.message}`)
    }
    return toMobile(data as DbMobile)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch mobile')
  }
}

export async function createMobile(data: Omit<Mobile, 'id'>): Promise<Mobile> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbMobile(data as Partial<Mobile>, tenantId)

    const { data: created, error } = await supabase
      .from('mobiles')
      .insert(dbData)
      .select()
      .single()

    if (error) throw new Error(`Failed to create mobile: ${error.message}`)
    return toMobile(created as DbMobile)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create mobile')
  }
}

export async function updateMobile(id: string, data: Partial<Mobile>): Promise<Mobile> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbMobile(data, tenantId)
    // Remove tenant_id from update payload — it should not change
    const { tenant_id: _, ...updateData } = dbData as DbMobile

    const { data: updated, error } = await supabase
      .from('mobiles')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update mobile: ${error.message}`)
    return toMobile(updated as DbMobile)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update mobile')
  }
}

export async function deleteMobile(id: string): Promise<void> {
  try {
    const tenantId = await getTenantId()
    await supabase.from('imei_records').delete().eq('product_id', id).eq('tenant_id', tenantId)

    const { error } = await supabase
      .from('mobiles')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw new Error(`Failed to delete mobile: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to delete mobile')
  }
}

// ─── Accessories ────────────────────────────────────────────────────────────

export async function getAccessories(): Promise<Accessory[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('accessories')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch accessories: ${error.message}`)
    return (data as DbAccessory[]).map(toAccessory)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch accessories')
  }
}

export async function getAccessoryById(id: string): Promise<Accessory | null> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('accessories')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch accessory: ${error.message}`)
    }
    return toAccessory(data as DbAccessory)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch accessory')
  }
}

export async function createAccessory(data: Omit<Accessory, 'id'>): Promise<Accessory> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbAccessory(data as Partial<Accessory>, tenantId)

    const { data: created, error } = await supabase
      .from('accessories')
      .insert(dbData)
      .select()
      .single()

    if (error) throw new Error(`Failed to create accessory: ${error.message}`)
    return toAccessory(created as DbAccessory)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create accessory')
  }
}

export async function updateAccessory(id: string, data: Partial<Accessory>): Promise<Accessory> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbAccessory(data, tenantId)
    const { tenant_id: _, ...updateData } = dbData as DbAccessory

    const { data: updated, error } = await supabase
      .from('accessories')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new Error(`Failed to update accessory: ${error.message}`)
    return toAccessory(updated as DbAccessory)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update accessory')
  }
}

export async function deleteAccessory(id: string): Promise<void> {
  try {
    const tenantId = await getTenantId()
    const { error } = await supabase
      .from('accessories')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (error) throw new Error(`Failed to delete accessory: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to delete accessory')
  }
}

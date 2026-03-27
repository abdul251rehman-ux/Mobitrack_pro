import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toTenant, toTenantSettings, toProfile } from './types'
import type {
  DbTenant,
  DbTenantSettings,
  DbProfile,
  Tenant,
  TenantSettings,
  Profile,
} from './types'

// ─── Tenant ─────────────────────────────────────────────────────────────────

export async function getTenant(): Promise<Tenant> {
  try {
    const tenantId = await getTenantId()

    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single()

    if (error) throw new Error(`Failed to fetch tenant: ${error.message}`)
    return toTenant(data as DbTenant)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch tenant')
  }
}

export async function updateTenant(data: Partial<Tenant>): Promise<void> {
  try {
    const tenantId = await getTenantId()

    const updatePayload: Record<string, unknown> = {}
    if (data.name !== undefined) updatePayload.name = data.name
    if (data.phone !== undefined) updatePayload.phone = data.phone
    if (data.email !== undefined) updatePayload.email = data.email
    if (data.address !== undefined) updatePayload.address = data.address
    if (data.city !== undefined) updatePayload.city = data.city
    if (data.logo !== undefined) updatePayload.logo = data.logo || null
    if (data.currency !== undefined) updatePayload.currency = data.currency
    if (data.taxRate !== undefined) updatePayload.tax_rate = data.taxRate

    const { error } = await supabase
      .from('tenants')
      .update(updatePayload)
      .eq('id', tenantId)

    if (error) throw new Error(`Failed to update tenant: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update tenant')
  }
}

// ─── Tenant Settings ────────────────────────────────────────────────────────

export async function getTenantSettings(): Promise<TenantSettings> {
  try {
    const tenantId = await getTenantId()

    const { data, error } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (error) throw new Error(`Failed to fetch tenant settings: ${error.message}`)
    return toTenantSettings(data as DbTenantSettings)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch tenant settings')
  }
}

export async function updateTenantSettings(data: Partial<TenantSettings>): Promise<void> {
  try {
    const tenantId = await getTenantId()

    const updatePayload: Record<string, unknown> = {}
    if (data.lowStockThreshold !== undefined) updatePayload.low_stock_threshold = data.lowStockThreshold
    if (data.defaultWarrantyMonths !== undefined) updatePayload.default_warranty_months = data.defaultWarrantyMonths
    if (data.invoicePrefix !== undefined) updatePayload.invoice_prefix = data.invoicePrefix
    if (data.poPrefix !== undefined) updatePayload.po_prefix = data.poPrefix
    if (data.returnPrefix !== undefined) updatePayload.return_prefix = data.returnPrefix
    if (data.reservationPrefix !== undefined) updatePayload.reservation_prefix = data.reservationPrefix
    if (data.consignmentPrefix !== undefined) updatePayload.consignment_prefix = data.consignmentPrefix
    if (data.repairPrefix !== undefined) updatePayload.repair_prefix = data.repairPrefix
    if (data.taxEnabled !== undefined) updatePayload.tax_enabled = data.taxEnabled
    if (data.taxRate !== undefined) updatePayload.tax_rate = data.taxRate
    if (data.currency !== undefined) updatePayload.currency = data.currency
    if (data.dateFormat !== undefined) updatePayload.date_format = data.dateFormat
    if (data.receiptFooter !== undefined) updatePayload.receipt_footer = data.receiptFooter

    const { error } = await supabase
      .from('tenant_settings')
      .update(updatePayload)
      .eq('tenant_id', tenantId)

    if (error) throw new Error(`Failed to update tenant settings: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update tenant settings')
  }
}

// ─── Profiles (Users in Tenant) ─────────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch profiles: ${error.message}`)
    return (data as DbProfile[]).map(toProfile)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch profiles')
  }
}

export async function getProfileById(id: string): Promise<Profile | null> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch profile: ${error.message}`)
    }
    return toProfile(data as DbProfile)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch profile')
  }
}

export async function updateProfile(id: string, data: Partial<Profile>): Promise<void> {
  try {
    const updatePayload: Record<string, unknown> = {}
    if (data.name !== undefined) updatePayload.name = data.name
    if (data.phone !== undefined) updatePayload.phone = data.phone
    if (data.role !== undefined) updatePayload.role = data.role
    if (data.avatar !== undefined) updatePayload.avatar = data.avatar || null
    if (data.status !== undefined) updatePayload.status = data.status

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', id)

    if (error) throw new Error(`Failed to update profile: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update profile')
  }
}

export async function inviteUser(email: string, role: string): Promise<void> {
  try {
    const tenantId = await getTenantId()

    // Use Supabase Auth admin invite (requires service role in production).
    // From the client side, we insert a pending invitation record that a
    // server-side function or edge function processes.
    const { error } = await supabase
      .from('invitations')
      .insert({
        tenant_id: tenantId,
        email,
        role,
        status: 'pending',
      })

    if (error) throw new Error(`Failed to invite user: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to invite user')
  }
}

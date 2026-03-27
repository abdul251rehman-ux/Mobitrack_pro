import { supabase } from '../supabase'

export interface AuthUser {
  id: string
  email: string
  name: string
  phone: string
  role: string
  tenantId: string
  avatar?: string
}

export async function signUp(
  email: string,
  password: string,
  metadata: { name: string; phone: string; shop_name: string }
): Promise<AuthUser> {
  try {
    // 1. Create the auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: metadata.name,
          phone: metadata.phone,
          shop_name: metadata.shop_name,
        },
      },
    })

    if (authError) throw new Error(`Sign up failed: ${authError.message}`)
    if (!authData.user) throw new Error('Sign up failed: No user returned')

    // 2. Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: metadata.shop_name,
        slug: metadata.shop_name.toLowerCase().replace(/\s+/g, '-'),
        phone: metadata.phone,
        email,
        address: '',
        city: '',
        currency: 'PKR',
        tax_rate: 0,
      })
      .select()
      .single()

    if (tenantError) throw new Error(`Failed to create tenant: ${tenantError.message}`)

    // 3. Create profile linked to tenant
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        tenant_id: tenant.id,
        name: metadata.name,
        email,
        phone: metadata.phone,
        role: 'Admin',
        status: 'Active',
      })

    if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`)

    // 4. Create default tenant settings
    const { error: settingsError } = await supabase
      .from('tenant_settings')
      .insert({
        tenant_id: tenant.id,
        low_stock_threshold: 5,
        default_warranty_months: 12,
        invoice_prefix: 'INV',
        po_prefix: 'PO',
        return_prefix: 'RET',
        reservation_prefix: 'RSV',
        consignment_prefix: 'CON',
        repair_prefix: 'RPR',
        tax_enabled: false,
        tax_rate: 0,
        currency: 'PKR',
        date_format: 'DD/MM/YYYY',
        receipt_footer: 'Thank you for your business!',
      })

    if (settingsError) {
      console.error('Failed to create default tenant settings:', settingsError.message)
    }

    return {
      id: authData.user.id,
      email,
      name: metadata.name,
      phone: metadata.phone,
      role: 'Admin',
      tenantId: tenant.id,
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('Sign up failed')
  }
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthUser> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) throw new Error(`Sign in failed: ${authError.message}`)
    if (!authData.user) throw new Error('Sign in failed: No user returned')

    // Fetch profile to get tenant and role info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Sign in failed: User profile not found')
    }

    // Update last login
    await supabase
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', authData.user.id)

    return {
      id: authData.user.id,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
      tenantId: profile.tenant_id,
      avatar: profile.avatar ?? undefined,
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('Sign in failed')
  }
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(`Sign out failed: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Sign out failed')
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) return null

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) return null

    return {
      id: user.id,
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
      tenantId: profile.tenant_id,
      avatar: profile.avatar ?? undefined,
    }
  } catch {
    return null
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (error) throw new Error(`Password reset failed: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Password reset failed')
  }
}

export async function updatePassword(newPassword: string): Promise<void> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (error) throw new Error(`Password update failed: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Password update failed')
  }
}

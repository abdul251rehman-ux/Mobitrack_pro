import { supabase } from "@/lib/supabase"
import bcrypt from "bcryptjs"

const STORAGE_KEY = "mobitrack_session"

// Bcrypt hashes are 60 chars and always start with one of these version prefixes -
// used to tell an already-hashed password apart from a plaintext one left over
// from before this was introduced (see the one-time migration in supabase/).
const BCRYPT_PREFIX = /^\$2[aby]\$/

export function isPasswordHashed(value: string): boolean {
  return BCRYPT_PREFIX.test(value)
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

/**
 * Verifies a login attempt against a stored password value that may still be
 * plaintext (pre-migration or if the migration hasn't run yet on this row).
 * Falls back to a plain string comparison only when the stored value isn't a
 * bcrypt hash, so already-hashed rows are never compared as plaintext.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (isPasswordHashed(stored)) return bcrypt.compare(plain, stored)
  return plain === stored
}

/**
 * Returns the current user's tenant_id from localStorage session.
 */
export async function getTenantId(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("getTenantId can only be called on the client")
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) throw new Error("Not authenticated. Please sign in.")

    const user = JSON.parse(saved)
    if (!user?.tenantId) throw new Error("No tenant found in session.")

    const tenantId: string = user.tenantId

    // Set DB-level session variable so RLS policies can enforce tenant isolation.
    // Must be awaited — queries in the same Promise.all will fail RLS if this hasn't run first.
    try { await supabase.rpc("set_tenant_context", { p_tenant_id: tenantId }) } catch { /* non-fatal */ }

    return tenantId
  } catch {
    throw new Error("Not authenticated. Please sign in.")
  }
}

/**
 * Returns the current user's id from localStorage session.
 */
export async function getCurrentUserId(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("getCurrentUserId can only be called on the client")
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) throw new Error("Not authenticated. Please sign in.")

    const user = JSON.parse(saved)
    if (!user?.id) throw new Error("No user found in session.")

    return user.id
  } catch {
    throw new Error("Not authenticated. Please sign in.")
  }
}

/**
 * Self-service password change for the logged-in user. Requires the current
 * password to verify it's really them (unlike an Admin resetting someone
 * else's forgotten password via updateProfileFull, which has no old password
 * to check) before overwriting the stored hash with the new one.
 */
export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  const userId = await getCurrentUserId()
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from("profiles")
    .select("password")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .single()
  if (error || !data) throw new Error("Could not verify your account")

  const ok = await verifyPassword(currentPassword, (data as { password: string }).password)
  if (!ok) throw new Error("Current password is incorrect")

  const newHash = await hashPassword(newPassword)
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ password: newHash })
    .eq("id", userId)
    .eq("tenant_id", tenantId)
  if (updateErr) throw new Error(`Failed to update password: ${updateErr.message}`)
}

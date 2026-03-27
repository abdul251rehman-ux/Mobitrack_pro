const STORAGE_KEY = "mobitrack_session"

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

    return user.tenantId
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

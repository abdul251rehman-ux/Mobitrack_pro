"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import { supabase } from "@/lib/supabase"

// ─── Types ──────────────────────────────────────────────────────────────────

export type UserRole = "Admin" | "Manager" | "Cashier" | string

export interface AuthUser {
  id: string
  tenantId: string
  name: string
  email: string
  phone: string
  role: UserRole
  avatar?: string
  status: string
  permissions: string[] | "*"
}

/** @deprecated Use AuthUser instead */
export type AppUser = AuthUser

// ─── All available permission keys ──────────────────────────────────────────

export const ALL_MODULES = [
  { key: "sales",           label: "Sales",             actions: ["view","create","edit","delete"] },
  { key: "purchases",       label: "Purchases",         actions: ["view","create","edit","delete"] },
  { key: "returns",         label: "Sale Returns",      actions: ["view","create","edit","delete"] },
  { key: "inventory",       label: "Inventory",         actions: ["view","edit"] },
  { key: "products",        label: "Products",          actions: ["view","create","edit","delete"] },
  { key: "catalog",         label: "Catalog",           actions: ["view","edit"] },
  { key: "customers",       label: "Customers",         actions: ["view","create","edit","delete"] },
  { key: "suppliers",       label: "Suppliers",         actions: ["view","create","edit","delete"] },
  { key: "expenses",        label: "Expenses",          actions: ["view","create","edit","delete"] },
  { key: "payments",        label: "Finance / Payments",actions: ["view","create","edit"] },
  { key: "ledger",          label: "Ledger",            actions: ["view"] },
  { key: "reports",         label: "Reports",           actions: ["view"] },
  { key: "rebate",          label: "Rebate",            actions: ["view","create","edit","delete"] },
  { key: "staff",           label: "Staff",             actions: ["view","create","edit","delete"] },
  { key: "settings",        label: "Settings",          actions: ["general"] },
  { key: "audit-log",       label: "Audit Log",         actions: ["view"] },
] as const

// Default permissions for built-in roles (used as templates when creating staff)
export const ROLE_PERMISSION_TEMPLATES: Record<string, string[] | "*"> = {
  Admin: "*",
  Manager: [
    "sales.view","sales.create","sales.edit","sales.delete",
    "purchases.view","purchases.create","purchases.edit","purchases.delete",
    "returns.view","returns.create","returns.edit",
    "products.view","products.create","products.edit","products.delete",
    "catalog.view","catalog.edit",
    "customers.view","customers.create","customers.edit","customers.delete",
    "suppliers.view","suppliers.create","suppliers.edit","suppliers.delete",
    "inventory.view","inventory.edit",
    "expenses.view","expenses.create","expenses.edit","expenses.delete",
    "payments.view","payments.create","payments.edit",
    "ledger.view",
    "reports.view",
    "rebate.view","rebate.create","rebate.edit",
    "staff.view",
    "settings.general",
    "audit-log.view",
  ],
  Cashier: [
    "sales.view","sales.create",
    "customers.view","customers.create",
    "products.view",
    "inventory.view",
  ],
  Custom: [],
}

// ─── Context types ───────────────────────────────────────────────────────────

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  signUp: (
    email: string,
    password: string,
    metadata: { name: string; phone: string; shopName: string }
  ) => Promise<{ success: boolean; error?: string }>
  hasPermission: (permission: string) => boolean
}

const STORAGE_KEY = "mobitrack_session"
const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const loginedAt: number = parsed._loginedAt ?? 0
        const expired = Date.now() - loginedAt > SESSION_TTL_MS
        if (expired) {
          localStorage.removeItem(STORAGE_KEY)
        } else {
          const { _loginedAt: _, ...authUser } = parsed
          // Backfill permissions for sessions saved before this field existed
          if (authUser.role === "Admin") {
            authUser.permissions = "*"
          } else if (!Array.isArray(authUser.permissions) || authUser.permissions.length === 0) {
            authUser.permissions = ROLE_PERMISSION_TEMPLATES[authUser.role] ?? []
          }
          setUser(authUser)
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Fail fast with a clear message when there's no network at all, rather
    // than letting the request hang and surface as a generic/misleading error.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("You're offline - check your internet connection and try again.")
    }

    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, tenant_id, name, email, phone, role, avatar_url, status, password, permissions")
      .eq("email", email.toLowerCase().trim())
      .order("created_at", { ascending: false })
      .limit(1)

    // A real connection/DB error (network down, Supabase unreachable, etc.)
    // must not be reported as "wrong password" - surface it distinctly.
    if (error) throw new Error("Could not reach the server - check your internet connection and try again.")

    const data = rows?.[0] ?? null

    if (!data) return false
    if (data.password !== password) return false
    if (data.status?.toLowerCase() === "inactive") return false

    // Resolve permissions: DB field takes priority; fallback to role template
    let permissions: string[] | "*"
    if (data.role === "Admin") {
      permissions = "*"
    } else if (Array.isArray(data.permissions) && data.permissions.length > 0) {
      permissions = data.permissions as string[]
    } else {
      permissions = (ROLE_PERMISSION_TEMPLATES[data.role] ?? []) as string[]
    }

    const authUser: AuthUser = {
      id: data.id,
      tenantId: data.tenant_id,
      name: data.name ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      role: data.role as UserRole,
      avatar: data.avatar_url ?? undefined,
      status: data.status ?? "Active",
      permissions,
    }

    setUser(authUser)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...authUser, _loginedAt: Date.now() }))
    return true
  }, [])

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata: { name: string; phone: string; shopName: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email.toLowerCase().trim())
          .single()

        if (existing) return { success: false, error: "Email already registered" }

        const { data: tenant, error: tenantErr } = await supabase
          .from("tenants")
          .insert({
            name: metadata.shopName,
            owner_name: metadata.name,
            email: email.toLowerCase().trim(),
            phone: metadata.phone,
          })
          .select()
          .single()

        if (tenantErr || !tenant) {
          return { success: false, error: "Failed to create shop: " + tenantErr?.message }
        }

        const { error: profileErr } = await supabase
          .from("profiles")
          .insert({
            id: crypto.randomUUID(),
            tenant_id: tenant.id,
            name: metadata.name,
            email: email.toLowerCase().trim(),
            phone: metadata.phone,
            role: "Admin",
            status: "Active",
            password: password,
            permissions: null,
          })

        if (profileErr) {
          await supabase.from("tenants").delete().eq("id", tenant.id)
          return { success: false, error: "Failed to create profile: " + profileErr.message }
        }

        await supabase.from("tenant_settings").insert({ tenant_id: tenant.id })

        const tid = tenant.id
        await Promise.all([
          supabase.from("brands").insert([
            { tenant_id: tid, name: "Samsung",  logo_initials: "SA", country: "South Korea",  status: "Active", is_system: true },
            { tenant_id: tid, name: "Apple",    logo_initials: "AP", country: "United States", status: "Active", is_system: true },
            { tenant_id: tid, name: "Xiaomi",   logo_initials: "XI", country: "China",         status: "Active", is_system: true },
            { tenant_id: tid, name: "Oppo",     logo_initials: "OP", country: "China",         status: "Active", is_system: true },
            { tenant_id: tid, name: "Vivo",     logo_initials: "VI", country: "China",         status: "Active", is_system: true },
            { tenant_id: tid, name: "Realme",   logo_initials: "RE", country: "China",         status: "Active", is_system: true },
            { tenant_id: tid, name: "OnePlus",  logo_initials: "ON", country: "China",         status: "Active", is_system: true },
            { tenant_id: tid, name: "Huawei",   logo_initials: "HW", country: "China",         status: "Active", is_system: true },
            { tenant_id: tid, name: "Nokia",    logo_initials: "NO", country: "Finland",       status: "Active", is_system: true },
            { tenant_id: tid, name: "Tecno",    logo_initials: "TE", country: "China",         status: "Active", is_system: true },
            { tenant_id: tid, name: "Infinix",  logo_initials: "IN", country: "China",         status: "Active", is_system: true },
            { tenant_id: tid, name: "Itel",     logo_initials: "IT", country: "China",         status: "Active", is_system: true },
            { tenant_id: tid, name: "Google",   logo_initials: "GO", country: "United States", status: "Active", is_system: true },
            { tenant_id: tid, name: "Sony",     logo_initials: "SO", country: "Japan",         status: "Active", is_system: true },
            { tenant_id: tid, name: "Motorola", logo_initials: "MO", country: "United States", status: "Active", is_system: true },
          ]),
          supabase.from("storage_options").insert([
            { tenant_id: tid, name: "16GB",  is_system: true },
            { tenant_id: tid, name: "32GB",  is_system: true },
            { tenant_id: tid, name: "64GB",  is_system: true },
            { tenant_id: tid, name: "128GB", is_system: true },
            { tenant_id: tid, name: "256GB", is_system: true },
            { tenant_id: tid, name: "512GB", is_system: true },
            { tenant_id: tid, name: "1TB",   is_system: true },
          ]),
          supabase.from("ram_options").insert([
            { tenant_id: tid, name: "2GB",  is_system: true },
            { tenant_id: tid, name: "3GB",  is_system: true },
            { tenant_id: tid, name: "4GB",  is_system: true },
            { tenant_id: tid, name: "6GB",  is_system: true },
            { tenant_id: tid, name: "8GB",  is_system: true },
            { tenant_id: tid, name: "12GB", is_system: true },
            { tenant_id: tid, name: "16GB", is_system: true },
          ]),
          supabase.from("colors").insert([
            { tenant_id: tid, name: "Black",     is_system: true },
            { tenant_id: tid, name: "White",     is_system: true },
            { tenant_id: tid, name: "Gold",      is_system: true },
            { tenant_id: tid, name: "Silver",    is_system: true },
            { tenant_id: tid, name: "Blue",      is_system: true },
            { tenant_id: tid, name: "Green",     is_system: true },
            { tenant_id: tid, name: "Red",       is_system: true },
            { tenant_id: tid, name: "Purple",    is_system: true },
            { tenant_id: tid, name: "Pink",      is_system: true },
            { tenant_id: tid, name: "Gray",      is_system: true },
            { tenant_id: tid, name: "Midnight",  is_system: true },
            { tenant_id: tid, name: "Starlight", is_system: true },
          ]),
        ])

        return { success: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        return { success: false, error: msg }
      }
    },
    []
  )

  const logout = useCallback(async () => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false
      if (user.permissions === "*") return true
      if (!Array.isArray(user.permissions)) return false
      return user.permissions.includes(permission)
    },
    [user]
  )

  const isAuthenticated = user !== null

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, logout, signUp, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}

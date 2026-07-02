"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import { supabase } from "@/lib/supabase"

// ─── Types ──────────────────────────────────────────────────────────────────

export type UserRole = "Admin" | "Manager" | "Cashier"

export interface AuthUser {
  id: string
  tenantId: string
  name: string
  email: string
  phone: string
  role: UserRole
  avatar?: string
  status: string
}

/** @deprecated Use AuthUser instead */
export type AppUser = AuthUser

// ─── Permission matrix ──────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, string[] | "*"> = {
  Admin: "*",
  Manager: [
    "sales.create", "sales.view", "sales.edit", "sales.delete",
    "purchases.create", "purchases.view", "purchases.edit", "purchases.delete",
    "products.create", "products.view", "products.edit", "products.delete",
    "customers.create", "customers.view", "customers.edit", "customers.delete",
    "suppliers.create", "suppliers.view", "suppliers.edit", "suppliers.delete",
    "inventory.view", "inventory.edit",
    "expenses.create", "expenses.view", "expenses.edit", "expenses.delete",
    "returns.create", "returns.view", "returns.edit",
    "warranty.create", "warranty.view", "warranty.edit",
    "repairs.create", "repairs.view", "repairs.edit",
    "reports.view",
    "payments.create", "payments.view", "payments.edit",
    "shops.create", "shops.view", "shops.edit", "shops.delete",
    "catalog.view", "catalog.edit",
    "ledger.view",
    "settings.general",
    "audit-log.view",
  ],
  Cashier: [
    "sales.create", "sales.view",
    "customers.view", "customers.create",
    "products.view",
    "inventory.view",
  ],
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

  // On mount: restore session from localStorage (expires after SESSION_TTL_MS)
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
          setUser(authUser)
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    setIsLoading(false)
  }, [])

  // ── login: check email + password against profiles table ──────────────────

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { data: rows, error } = await supabase
        .from("profiles")
        .select("id, tenant_id, name, email, phone, role, avatar_url, status, password")
        .eq("email", email.toLowerCase().trim())
        .order("created_at", { ascending: false })
        .limit(1)

      const data = rows?.[0] ?? null

      if (error || !data) {
        console.error("Login: user not found", error?.message)
        return false
      }

      // Check password
      if (data.password !== password) {
        console.error("Login: wrong password")
        return false
      }

      // Check active status
      if (data.status?.toLowerCase() === "inactive") {
        console.error("Login: account inactive")
        return false
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
      }

      setUser(authUser)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...authUser, _loginedAt: Date.now() }))
      return true
    } catch (err) {
      console.error("Login exception:", err)
      return false
    }
  }, [])

  // ── signUp: create tenant + profile ───────────────────────────────────────

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      metadata: { name: string; phone: string; shopName: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // Check if email already exists
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", email.toLowerCase().trim())
          .single()

        if (existing) {
          return { success: false, error: "Email already registered" }
        }

        // Create tenant
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

        // Create profile
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
          })

        if (profileErr) {
          // Rollback tenant
          await supabase.from("tenants").delete().eq("id", tenant.id)
          return { success: false, error: "Failed to create profile: " + profileErr.message }
        }

        // Create tenant settings
        await supabase.from("tenant_settings").insert({ tenant_id: tenant.id })

        // Seed default catalog for this tenant
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

  // ── logout ─────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // ── hasPermission ──────────────────────────────────────────────────────────

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false
      const perms = ROLE_PERMISSIONS[user.role]
      if (perms === "*") return true
      return perms.includes(permission)
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

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}

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

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: restore session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setUser(JSON.parse(saved))
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    setIsLoading(false)
  }, [])

  // ── login: check email + password against profiles table ──────────────────

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, tenant_id, name, email, phone, role, avatar_url, status, password")
        .eq("email", email.toLowerCase().trim())
        .single()

      if (error || !data) {
        console.error("Login: user not found", error?.message)
        return false
      }

      // Check password
      if (data.password !== password) {
        console.error("Login: wrong password")
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser))
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

        // Create profile with password
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

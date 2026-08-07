"use client"
import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"

export interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  read: boolean
  time: string
  createdAt: Date
}

interface AppContextType {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  mobileSidebarOpen: boolean
  toggleMobileSidebar: () => void
  closeMobileSidebar: () => void
  notifications: Notification[]
  unreadCount: number
  markAllRead: () => void
  markRead: (id: string) => void
  refreshNotifications: () => void
}

function relativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

async function fetchLiveNotifications(): Promise<Notification[]> {
  const results: Notification[] = []

  try {
    const tenantId = await getTenantId()

    // 1. Low stock — models with fewer than 5 units in stock
    const { data: stockData } = await supabase
      .from("imei_records")
      .select("model")
      .eq("tenant_id", tenantId)
      .eq("device_status", "in_stock")

    if (stockData) {
      const counts: Record<string, number> = {}
      stockData.forEach((r: any) => {
        if (r.model) counts[r.model] = (counts[r.model] ?? 0) + 1
      })
      Object.entries(counts)
        .filter(([, qty]) => qty <= 5)
        .slice(0, 3)
        .forEach(([model, qty], i) => {
          results.push({
            id: `low-stock-${i}`,
            title: "Low Stock Alert",
            message: `${model} has only ${qty} unit${qty === 1 ? "" : "s"} left`,
            type: "warning",
            read: false,
            time: "Just now",
            createdAt: new Date(),
          })
        })
    }

    // 2. Recent sales (last 24h)
    const since24h = new Date(Date.now() - 86400_000).toISOString()
    const { data: salesData } = await supabase
      .from("sales")
      .select("id, invoice_number, total, created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(3)

    if (salesData) {
      salesData.forEach((s: any) => {
        const date = new Date(s.created_at)
        results.push({
          id: `sale-${s.id}`,
          title: "New Sale",
          message: `${s.invoice_number ?? "Invoice"} — Rs ${Number(s.total ?? 0).toLocaleString()}`,
          type: "success",
          read: false,
          time: relativeTime(date),
          createdAt: date,
        })
      })
    }

    // 3. Recent supplier payments (last 24h)
    const { data: payData } = await supabase
      .from("payments")
      .select("id, amount, created_at, entity_name")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "Supplier")
      .eq("type", "Paid")
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(2)

    if (payData) {
      payData.forEach((p: any) => {
        const date = new Date(p.created_at)
        const supplierName = p.entity_name ?? "Supplier"
        results.push({
          id: `pay-${p.id}`,
          title: "Payment Made",
          message: `${supplierName} — Rs ${Number(p.amount ?? 0).toLocaleString()}`,
          type: "info",
          read: false,
          time: relativeTime(date),
          createdAt: date,
        })
      })
    }

    // 4. Pending purchases (status = pending)
    const { data: poData } = await supabase
      .from("purchases")
      .select("id, po_number, created_at, suppliers(name)")
      .eq("tenant_id", tenantId)
      .eq("status", "Pending")
      .order("created_at", { ascending: false })
      .limit(2)

    if (poData) {
      poData.forEach((po: any) => {
        const date = new Date(po.created_at)
        const supplierName = po.suppliers?.name ?? "Supplier"
        results.push({
          id: `po-${po.id}`,
          title: "Pending Purchase",
          message: `${po.po_number ?? "PO"} from ${supplierName} awaiting delivery`,
          type: "info",
          read: false,
          time: relativeTime(date),
          createdAt: date,
        })
      })
    }
  } catch {
    // Silently fail — notifications are non-critical
  }

  // Sort newest first, cap at 10
  return results
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const loadNotifications = useCallback(async () => {
    const live = await fetchLiveNotifications()
    setNotifications(live)
  }, [])

  // Load on mount, refresh every 5 minutes
  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  const toggleSidebar = useCallback(() => setSidebarCollapsed(prev => !prev), [])
  const toggleMobileSidebar = useCallback(() => setMobileSidebarOpen(prev => !prev), [])
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  return (
    <AppContext.Provider value={{
      sidebarCollapsed, toggleSidebar,
      mobileSidebarOpen, toggleMobileSidebar, closeMobileSidebar,
      notifications, unreadCount, markAllRead, markRead,
      refreshNotifications: loadNotifications,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("useApp must be used within AppProvider")
  return context
}

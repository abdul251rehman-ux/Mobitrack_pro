"use client"
import React, { createContext, useContext, useState, useCallback } from "react"

interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  read: boolean
  time: string
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
}

const defaultNotifications: Notification[] = [
  { id: "1", title: "Low Stock Alert", message: "iPhone 16 Pro Max has only 4 units left", type: "warning", read: false, time: "2 min ago" },
  { id: "2", title: "New Sale", message: "Invoice INV-2025-0052 created for ₨ 440,000", type: "success", read: false, time: "15 min ago" },
  { id: "3", title: "Payment Received", message: "Cell City Electronics paid ₨ 320,000", type: "success", read: false, time: "1 hr ago" },
  { id: "4", title: "Low Stock Alert", message: "Realme GT 5 Pro has only 4 units left", type: "warning", read: false, time: "2 hr ago" },
  { id: "5", title: "Purchase Order", message: "PO-2025-0052 pending delivery from Karachi Mobile Hub", type: "info", read: false, time: "3 hr ago" },
]

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(defaultNotifications)

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev)
  }, [])

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(prev => !prev)
  }, [])

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  return (
    <AppContext.Provider value={{ sidebarCollapsed, toggleSidebar, mobileSidebarOpen, toggleMobileSidebar, closeMobileSidebar, notifications, unreadCount, markAllRead, markRead }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("useApp must be used within AppProvider")
  return context
}

"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { Smartphone, ShieldOff } from "lucide-react"

const PUBLIC_ROUTES = ["/auth/login", "/auth/register"]

// Map route prefixes to the permission required to access them
const ROUTE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: "/products",       permission: "products.view" },
  { prefix: "/inventory",      permission: "inventory.view" },
  { prefix: "/catalog",        permission: "catalog.view" },
  { prefix: "/purchases",      permission: "purchases.view" },
  { prefix: "/returns",        permission: "returns.view" },
  { prefix: "/purchase-returns", permission: "purchases.view" },
  { prefix: "/finance",        permission: "payments.view" },
  { prefix: "/expenses",       permission: "expenses.view" },
  { prefix: "/ledger",         permission: "ledger.view" },
  { prefix: "/suppliers",      permission: "suppliers.view" },
  { prefix: "/shops",          permission: "shops.view" },
  { prefix: "/reports",        permission: "reports.view" },
  { prefix: "/profit-loss",    permission: "reports.view" },
  { prefix: "/audit-log",      permission: "audit-log.view" },
  { prefix: "/settings",       permission: "settings.general" },
]

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasPermission } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  // Required permission for this path (undefined = no restriction beyond auth)
  const requiredPermission = ROUTE_PERMISSIONS.find(r => pathname.startsWith(r.prefix))?.permission

  useEffect(() => {
    const timer = setTimeout(() => setChecked(true), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!checked) return
    if (!isAuthenticated && !isPublicRoute) router.replace("/auth/login")
    if (isAuthenticated && isPublicRoute) router.replace("/")
  }, [checked, isAuthenticated, isPublicRoute, router])

  if (!checked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 animate-pulse">
            <Smartphone className="w-7 h-7 text-white" />
          </div>
          <p className="text-slate-500 text-sm font-medium">Loading MobiTrack Pro...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && !isPublicRoute) return null
  if (isAuthenticated && isPublicRoute) return null

  // Authenticated but lacks permission for this route
  if (isAuthenticated && requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 max-w-xs text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
            <ShieldOff className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Access Restricted</h2>
          <p className="text-sm text-slate-500">
            Your account does not have permission to view this page. Contact your Admin.
          </p>
          <button
            onClick={() => router.replace("/")}
            className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ShieldOff } from "lucide-react"
import { useAuth } from "@/context/auth-context"

/**
 * Wraps a page and blocks access if the user lacks the required permission.
 * Shows a "not allowed" screen and redirects to dashboard after 2 seconds.
 *
 * Usage:
 *   export default function PurchasesPage() {
 *     return (
 *       <PermissionGate permission="purchases.view">
 *         <ActualContent />
 *       </PermissionGate>
 *     )
 *   }
 */
export function PermissionGate({
  permission,
  children,
}: {
  permission: string
  children: React.ReactNode
}) {
  const { hasPermission, isLoading } = useAuth()
  const router = useRouter()
  const allowed = hasPermission(permission)

  useEffect(() => {
    if (!isLoading && !allowed) {
      const t = setTimeout(() => router.replace("/"), 2500)
      return () => clearTimeout(t)
    }
  }, [isLoading, allowed, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
          <ShieldOff className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Access Denied</h2>
          <p className="text-sm text-slate-500 mt-1">
            You don't have permission to view this page.
          </p>
          <p className="text-xs text-slate-400 mt-2">Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

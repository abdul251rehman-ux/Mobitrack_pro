"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { Smartphone } from "lucide-react"

const PUBLIC_ROUTES = ["/auth/login", "/auth/register"]

// Per-route permission enforcement lives in each page's <PermissionGate> wrapper
// (see components/shared/permission-gate.tsx) — this component only handles auth.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated && !isPublicRoute) router.replace("/auth/login")
    if (isAuthenticated && isPublicRoute) router.replace("/")
  }, [isLoading, isAuthenticated, isPublicRoute, router])

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 animate-pulse">
            <Smartphone className="w-7 h-7 text-white" />
          </div>
          <p className="text-slate-500 text-sm font-medium">Loading MobiTrack Pro...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && !isPublicRoute) return null
  if (isAuthenticated && isPublicRoute) return null

  return <>{children}</>
}

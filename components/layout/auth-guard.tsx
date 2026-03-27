"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { Smartphone } from "lucide-react"

const PUBLIC_ROUTES = ["/auth/login", "/auth/register"]

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  useEffect(() => {
    // Give localStorage a tick to restore session
    const timer = setTimeout(() => {
      setChecked(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!checked) return
    if (!isAuthenticated && !isPublicRoute) {
      router.replace("/auth/login")
    }
    if (isAuthenticated && isPublicRoute) {
      router.replace("/")
    }
  }, [checked, isAuthenticated, isPublicRoute, router])

  // Show loading screen while checking auth
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

  // Not authenticated and not on public route — will redirect
  if (!isAuthenticated && !isPublicRoute) {
    return null
  }

  // Authenticated on public route — will redirect
  if (isAuthenticated && isPublicRoute) {
    return null
  }

  return <>{children}</>
}

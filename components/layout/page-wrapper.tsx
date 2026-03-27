"use client"
import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface PageWrapperProps {
  children: React.ReactNode
  loading?: boolean
}

export function PageWrapper({ children, loading = false }: PageWrapperProps) {
  const [showSkeleton, setShowSkeleton] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(false), 400)
    return () => clearTimeout(timer)
  }, [])

  if (showSkeleton || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  return <div className="animate-fade-in">{children}</div>
}

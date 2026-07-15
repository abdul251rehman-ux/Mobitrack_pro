"use client"
import { cn } from "@/lib/utils"

interface PageLoaderProps {
  className?: string
  /** Height of the container the spinner centers in. Defaults to a full page-ish height. */
  fullPage?: boolean
}

/**
 * The one sanctioned loading spinner for the app (see docs/BRAND_GUIDELINES.md §5).
 * Replaces the ~4 different spinner sizes/weights previously copy-pasted per page.
 */
export function PageLoader({ className, fullPage = true }: PageLoaderProps) {
  return (
    <div className={cn("flex items-center justify-center", fullPage ? "h-64" : "py-10", className)}>
      <div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin" />
    </div>
  )
}

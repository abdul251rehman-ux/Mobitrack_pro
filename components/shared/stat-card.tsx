"use client"
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string
  subtext?: string
  icon: LucideIcon
  trend?: number
  trendLabel?: string
  color?: string
  iconBg?: string
  gradient?: string
  className?: string
}

// Maps the light iconBg hint to a vibrant icon container + blob + top-border color
const iconBgMap: Record<string, { container: string; blob: string; topBorder: string }> = {
  "bg-violet-100":  { container: "bg-violet-600",  blob: "bg-violet-400",  topBorder: "border-t-violet-500"  },
  "bg-emerald-100": { container: "bg-emerald-600", blob: "bg-emerald-400", topBorder: "border-t-emerald-500" },
  "bg-blue-100":    { container: "bg-blue-600",    blob: "bg-blue-400",    topBorder: "border-t-blue-500"    },
  "bg-amber-100":   { container: "bg-amber-500",   blob: "bg-amber-400",   topBorder: "border-t-amber-500"   },
  "bg-red-100":     { container: "bg-red-600",     blob: "bg-red-400",     topBorder: "border-t-red-500"     },
  "bg-indigo-100":  { container: "bg-indigo-600",  blob: "bg-indigo-400",  topBorder: "border-t-indigo-500"  },
  "bg-cyan-100":    { container: "bg-cyan-600",    blob: "bg-cyan-400",    topBorder: "border-t-cyan-500"    },
  "bg-rose-100":    { container: "bg-rose-600",    blob: "bg-rose-400",    topBorder: "border-t-rose-500"    },
  "bg-pink-100":    { container: "bg-pink-600",    blob: "bg-pink-400",    topBorder: "border-t-pink-500"    },
  "bg-teal-100":    { container: "bg-teal-600",    blob: "bg-teal-400",    topBorder: "border-t-teal-500"    },
}
const DEFAULT_COLORS = { container: "bg-blue-600", blob: "bg-blue-400", topBorder: "border-t-blue-500" }

export function StatCard({
  title, value, subtext, icon: Icon,
  trend, trendLabel, className, iconBg = "bg-blue-100",
}: StatCardProps) {
  const colors = iconBgMap[iconBg] ?? DEFAULT_COLORS

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl bg-white p-3 sm:p-4 md:p-6",
      "border border-slate-100 border-t-2",
      "shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200",
      colors.topBorder,
      className
    )}>
      {/* Background blob — hidden on mobile to avoid clipping */}
      <div className={cn("absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-[0.06] hidden sm:block", colors.blob)} />

      {/* Icon + trend row */}
      <div className="flex items-start justify-between mb-3 sm:mb-5">
        <div className={cn("w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm", colors.container)}>
          <Icon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
        </div>
        {trend !== undefined && (
          <span className={cn(
            "flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border",
            trend >= 0
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-600 border-red-200"
          )}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>

      {/* Value */}
      <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 leading-none tracking-tight mb-1.5 sm:mb-2 truncate">
        {value}
      </p>

      {/* Title */}
      <p className="text-[12px] sm:text-[13px] font-semibold text-slate-500 leading-snug">{title}</p>

      {/* Subtext */}
      {(subtext || trendLabel) && (
        <p className="text-[11px] sm:text-xs text-slate-400 mt-1">{subtext ?? trendLabel}</p>
      )}
    </div>
  )
}

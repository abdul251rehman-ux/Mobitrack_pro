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

// Fixed wayfinding palette (see docs/BRAND_GUIDELINES.md §6) — indigo is the
// default/primary slot, cyan the secondary; emerald/amber/rose are reserved
// for semantic success/warning/danger stat tiles (not arbitrary wayfinding),
// slate is the neutral fallback. No other hues are permitted here.
const iconBgMap: Record<string, { container: string; topBorder: string }> = {
  "bg-indigo-100":  { container: "bg-indigo-600",  topBorder: "border-t-indigo-500"  },
  "bg-cyan-100":    { container: "bg-cyan-600",    topBorder: "border-t-cyan-500"    },
  "bg-emerald-100": { container: "bg-emerald-600", topBorder: "border-t-emerald-500" },
  "bg-amber-100":   { container: "bg-amber-500",   topBorder: "border-t-amber-500"   },
  "bg-rose-100":    { container: "bg-rose-600",    topBorder: "border-t-rose-500"    },
  "bg-slate-100":   { container: "bg-slate-600",   topBorder: "border-t-slate-400"   },
}
const DEFAULT_COLORS = { container: "bg-indigo-600", topBorder: "border-t-indigo-500" }

export function StatCard({
  title, value, subtext, icon: Icon,
  trend, trendLabel, className, iconBg = "bg-indigo-100",
}: StatCardProps) {
  const colors = iconBgMap[iconBg] ?? DEFAULT_COLORS

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl bg-white px-4 py-3",
      "border border-slate-100 border-t-2",
      "shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
      colors.topBorder,
      className
    )}>
      {/* Icon + trend row */}
      <div className="flex items-center justify-between mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-sm", colors.container)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        {trend !== undefined && (
          <span className={cn(
            "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
            trend >= 0
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-600 border-rose-200"
          )}>
            {trend >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>

      {/* Value */}
      <p className="text-xl font-bold text-slate-900 leading-none tracking-tight mb-1 truncate">
        {value}
      </p>

      {/* Title */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>

      {/* Subtext */}
      {(subtext || trendLabel) && (
        <p className="text-[10px] text-slate-400 mt-0.5">{subtext ?? trendLabel}</p>
      )}
    </div>
  )
}

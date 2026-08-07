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
  /** Center the icon/value/title/subtext on mobile only — for a card spanning the full row width there (e.g. an odd tile left over in a 2-col mobile grid). Reverts to the normal left-aligned layout at sm: and up. */
  centerOnMobile?: boolean
  /** Show the subtext line on mobile too, instead of only from sm: up. Use when the subtext carries information the title/value don't already convey (e.g. a count). */
  subtextOnMobile?: boolean
  /** Override the value's text color class (default text-slate-900) — for values whose sign carries meaning, e.g. an outstanding balance shown in rose/emerald/slate depending on direction. */
  valueClassName?: string
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
  trend, trendLabel, className, iconBg = "bg-indigo-100", centerOnMobile, subtextOnMobile, valueClassName,
}: StatCardProps) {
  const colors = iconBgMap[iconBg] ?? DEFAULT_COLORS

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl bg-white px-2.5 py-2 sm:px-4 sm:py-3 min-w-0",
      "border border-slate-100 border-t-2",
      "shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
      colors.topBorder,
      centerOnMobile && "flex flex-col items-center text-center sm:items-stretch sm:text-left",
      className
    )}>
      {/* Icon + trend row */}
      <div className={cn("flex items-center justify-between mb-1 sm:mb-2", centerOnMobile && "w-full justify-center relative sm:justify-between")}>
        <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0", colors.container)}>
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
        </div>
        {trend !== undefined && (
          <span className={cn(
            "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0",
            trend >= 0
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-600 border-rose-200",
            centerOnMobile && "absolute right-0 sm:static"
          )}>
            {trend >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>

      {/* Value — shrinks for long numbers so it never gets clipped */}
      <p className={cn(
        "font-bold leading-none tracking-tight mb-1 truncate",
        valueClassName ?? "text-slate-900",
        value.length > 14 ? "text-xs sm:text-sm" : value.length > 10 ? "text-sm sm:text-base" : "text-base sm:text-xl"
      )}>
        {value}
      </p>

      {/* Title */}
      <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">{title}</p>

      {/* Subtext */}
      {(subtext || trendLabel) && (
        <p className={cn("text-[10px] text-slate-400 mt-0.5 truncate", !subtextOnMobile && "hidden sm:block")}>{subtext ?? trendLabel}</p>
      )}
    </div>
  )
}

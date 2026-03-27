"use client"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Sale statuses
  Completed:      { label: "Completed",     className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  Pending:        { label: "Pending",       className: "bg-amber-50 text-amber-700 border border-amber-200"       },
  Refunded:       { label: "Refunded",      className: "bg-red-50 text-red-700 border border-red-200"             },
  // Payment
  Paid:           { label: "Paid",          className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  Partial:        { label: "Partial",       className: "bg-amber-50 text-amber-700 border border-amber-200"       },
  Unpaid:         { label: "Unpaid",        className: "bg-red-50 text-red-700 border border-red-200"             },
  // Delivery
  Received:       { label: "Received",      className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  // Stock
  "In Stock":     { label: "In Stock",      className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  "Low Stock":    { label: "Low Stock",     className: "bg-amber-50 text-amber-700 border border-amber-200"       },
  "Out of Stock": { label: "Out of Stock",  className: "bg-red-50 text-red-700 border border-red-200"             },
  // People
  Active:         { label: "Active",        className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  Inactive:       { label: "Inactive",      className: "bg-slate-100 text-slate-500 border border-slate-200"      },
  // Loyalty tiers — distinct colors per tier
  Bronze:         { label: "Bronze",        className: "bg-orange-50 text-orange-700 border border-orange-200"    },
  Silver:         { label: "Silver",        className: "bg-slate-100 text-slate-600 border border-slate-300"      },
  Gold:           { label: "Gold",          className: "bg-amber-50 text-amber-700 border border-amber-200"       },
  Platinum:       { label: "Platinum",      className: "bg-slate-800 text-white border border-slate-700"          },
  // Conditions
  New:            { label: "New",           className: "bg-blue-50 text-blue-700 border border-blue-200"          },
  Refurbished:    { label: "Refurbished",   className: "bg-violet-50 text-violet-700 border border-violet-200"    },
  Used:           { label: "Used",          className: "bg-slate-100 text-slate-600 border border-slate-200"      },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-slate-100 text-slate-600 border border-slate-200" }
  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap",
      config.className,
      className
    )}>
      {config.label}
    </span>
  )
}

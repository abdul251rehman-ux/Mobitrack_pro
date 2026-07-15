"use client"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  className?: string
}

// Strict 4-color semantic system (see docs/BRAND_GUIDELINES.md §2):
// emerald = success/positive, amber = warning/attention, rose = danger/negative,
// indigo = info/neutral highlight. Everything else (tiers, conditions) uses
// neutral slate + label, never a new hue.
const statusConfig: Record<string, { label: string; className: string }> = {
  // Sale statuses
  Completed:      { label: "Completed",     className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  Pending:        { label: "Pending",       className: "bg-amber-50 text-amber-700 border border-amber-200"       },
  Refunded:       { label: "Refunded",      className: "bg-rose-50 text-rose-700 border border-rose-200"          },
  // Payment
  Paid:           { label: "Paid",          className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  Partial:        { label: "Partial",       className: "bg-amber-50 text-amber-700 border border-amber-200"       },
  Unpaid:         { label: "Unpaid",        className: "bg-rose-50 text-rose-700 border border-rose-200"          },
  // Delivery
  Received:       { label: "Received",      className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  // Stock
  "In Stock":     { label: "In Stock",      className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  "Low Stock":    { label: "Low Stock",     className: "bg-amber-50 text-amber-700 border border-amber-200"       },
  "Out of Stock": { label: "Out of Stock",  className: "bg-rose-50 text-rose-700 border border-rose-200"          },
  Sold:           { label: "Sold",          className: "bg-slate-100 text-slate-600 border border-slate-200"      },
  // People
  Active:         { label: "Active",        className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  Inactive:       { label: "Inactive",      className: "bg-slate-100 text-slate-500 border border-slate-200"      },
  // Loyalty tiers — neutral slate + label, not a rainbow of hues
  Bronze:         { label: "Bronze",        className: "bg-slate-100 text-slate-600 border border-slate-200"      },
  Silver:         { label: "Silver",        className: "bg-slate-100 text-slate-600 border border-slate-300"      },
  Gold:           { label: "Gold",          className: "bg-slate-100 text-slate-700 border border-slate-300"      },
  Platinum:       { label: "Platinum",      className: "bg-slate-800 text-white border border-slate-700"          },
  // Conditions
  New:            { label: "New",           className: "bg-indigo-50 text-indigo-700 border border-indigo-200"    },
  Refurbished:    { label: "Refurbished",   className: "bg-slate-100 text-slate-600 border border-slate-200"      },
  Used:           { label: "Used",          className: "bg-slate-100 text-slate-600 border border-slate-200"      },
  // PTA / registration (used-phones)
  Approved:       { label: "Approved",      className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  "Non-PTA":      { label: "Non-PTA",       className: "bg-rose-50 text-rose-700 border border-rose-200"          },
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

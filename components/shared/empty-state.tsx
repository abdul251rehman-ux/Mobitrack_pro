"use client"
import { LucideIcon, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({
  icon: Icon = Search,
  title = "No results found",
  description = "Try adjusting your filters or search terms",
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-slate-100 to-slate-200/80 flex items-center justify-center mb-5 shadow-inner">
        <Icon className="w-9 h-9 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1.5">{title}</h3>
      <p className="text-sm text-slate-400 mb-5 max-w-xs leading-relaxed">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="sm" className="gap-1.5">
          {action.label}
        </Button>
      )}
    </div>
  )
}

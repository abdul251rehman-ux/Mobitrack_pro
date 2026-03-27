"use client"
import { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  badge?: ReactNode
}

export function PageHeader({ title, description, action, badge }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 pb-6 border-b border-slate-100">
      <div className="min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 mb-0.5 flex-wrap">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {badge}
        </div>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {action && (
        <div className="shrink-0 w-full sm:w-auto">
          <div className="w-full sm:w-auto [&>button]:w-full [&>a]:w-full sm:[&>button]:w-auto sm:[&>a]:w-auto">
            {action}
          </div>
        </div>
      )}
    </div>
  )
}

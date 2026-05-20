"use client"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
  badge?: ReactNode
  icon?: ReactNode
  /** Tailwind bg class for the icon container e.g. "bg-blue-600" — defaults to bg-blue-600 */
  iconBg?: string
}

export function PageHeader({ title, description, action, badge, icon, iconBg = "bg-blue-600" }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-5 border-b border-slate-100">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm", iconBg)}>
            <span className="text-white [&>svg]:w-4.5 [&>svg]:h-4.5 [&>*]:w-[18px] [&>*]:h-[18px]">
              {icon}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">{title}</h1>
            {badge}
          </div>
          {description && <p className="text-sm text-slate-500 mt-0.5 leading-snug">{description}</p>}
        </div>
      </div>
      {action && (
        <div className="shrink-0 w-full sm:w-auto">
          <div className="w-full sm:w-auto [&>button]:w-full [&>a]:w-full sm:[&>button]:w-auto sm:[&>a]:w-auto flex gap-2 flex-wrap">
            {action}
          </div>
        </div>
      )}
    </div>
  )
}

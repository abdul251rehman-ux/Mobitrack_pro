"use client"
import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * The one sanctioned "slide-in detail panel" pattern (see docs/BRAND_GUIDELINES.md §5).
 * Replaces the independently hand-rolled drawers previously duplicated across
 * Supplier Ledger, Person Ledger, and Rebate.
 *
 * Usage:
 *   <DetailDrawer open={!!entry} onOpenChange={(o) => !o && setEntry(null)}>
 *     <DetailDrawerHeader icon={<Wallet />} iconBg="bg-emerald-100" iconColor="text-emerald-600"
 *       title="Payment Made" subtitle={entry.reference} />
 *     <DetailDrawerBody>...</DetailDrawerBody>
 *     <DetailDrawerFooter>...</DetailDrawerFooter>
 *   </DetailDrawer>
 */
export function DetailDrawer({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-0 right-0 z-50 h-full w-full max-w-xs sm:max-w-sm bg-white shadow-2xl border-l border-slate-200 flex flex-col",
            "data-[state=open]:animate-in data-[state=closed]:animate-out duration-200",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

interface DetailDrawerHeaderProps {
  icon: React.ReactNode
  iconBg?: string
  iconColor?: string
  headerBg?: string
  title: string
  subtitle?: string
}

export function DetailDrawerHeader({
  icon, iconBg = "bg-indigo-100", iconColor = "text-indigo-600", headerBg = "bg-slate-50", title, subtitle,
}: DetailDrawerHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0", headerBg)}>
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          <span className={cn("[&>*]:w-4 [&>*]:h-4", iconColor)}>{icon}</span>
        </div>
        <div className="min-w-0">
          <DialogPrimitive.Title className="text-xs font-bold text-slate-800 truncate">{title}</DialogPrimitive.Title>
          {subtitle && <DialogPrimitive.Description className="text-[10px] text-slate-400 truncate">{subtitle}</DialogPrimitive.Description>}
        </div>
      </div>
      <DialogPrimitive.Close className="p-1 rounded-md hover:bg-white/60 transition-colors shrink-0">
        <X className="w-4 h-4 text-slate-500" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </div>
  )
}

export function DetailDrawerBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex-1 overflow-y-auto px-4 py-3 space-y-3", className)}>{children}</div>
}

export function DetailDrawerFooter({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-3 border-t border-slate-100 shrink-0">{children}</div>
}

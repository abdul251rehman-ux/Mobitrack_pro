"use client"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  variant?: "default" | "destructive"
  loading?: boolean
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", onConfirm, variant = "default", loading = false
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { if (loading) { e.preventDefault(); return } onConfirm() }}
            disabled={loading}
            className={variant === "destructive" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}
          >
            {loading ? "Working..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

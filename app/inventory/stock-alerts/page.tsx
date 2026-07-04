﻿"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, AlertOctagon, TrendingUp, Bell, BellRing, Plus, Pencil, Trash2,
  CheckCircle, Clock, X, Smartphone, Package, Eye, ShoppingCart, RotateCcw,
  Settings, Mail, MessageSquare, Monitor, Search,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { format } from "date-fns"

import type {
  StockAlertRule, StockAlertLog, AlertType, AlertStatus,
  ProductType, NotifyChannel,
} from "@/data/stock-alerts"
import { getStockAlertRules, getStockAlertLogs } from "@/lib/api/inventory"
import { getSuppliers } from "@/lib/api/suppliers"
import type { Supplier } from "@/data/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn, formatDate } from "@/lib/utils"

// â"€â"€â"€ Constants â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const ACCESSORY_CATEGORIES = [
  "Headphones/Earbuds", "Chargers & Cables", "Screen Protectors",
  "Phone Cases", "Power Banks", "Speakers", "Smartwatches",
]

const ALERT_TYPE_META: Record<AlertType, { label: string; className: string; rowClass: string; icon: React.ElementType }> = {
  out_of_stock: { label: "Out of Stock", className: "bg-red-50 text-red-700 border-red-200",    rowClass: "hover:bg-red-50/30",    icon: AlertOctagon  },
  low_stock:    { label: "Low Stock",    className: "bg-orange-50 text-orange-700 border-orange-200", rowClass: "hover:bg-orange-50/30", icon: AlertTriangle },
  overstock:    { label: "Overstocked", className: "bg-blue-50 text-blue-700 border-blue-200",  rowClass: "hover:bg-blue-50/30",   icon: TrendingUp    },
}

const ALERT_STATUS_META: Record<AlertStatus, { label: string; className: string }> = {
  active:       { label: "Active",       className: "bg-red-50 text-red-700 border-red-200"         },
  acknowledged: { label: "Acknowledged", className: "bg-amber-50 text-amber-700 border-amber-200"   },
  resolved:     { label: "Resolved",     className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
}

const CHANNEL_META: Record<NotifyChannel, { icon: React.ElementType; label: string }> = {
  dashboard: { icon: Monitor,       label: "Dashboard" },
  email:     { icon: Mail,          label: "Email"     },
  sms:       { icon: MessageSquare, label: "SMS"       },
}

// â"€â"€â"€ Chip Components â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function AlertTypeBadge({ type }: { type: AlertType }) {
  const { label, className, icon: Icon } = ALERT_TYPE_META[type]
  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border", className)}>
      <Icon className="w-2.5 h-2.5" />{label}
    </span>
  )
}

function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const { label, className } = ALERT_STATUS_META[status]
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border", className)}>
      {label}
    </span>
  )
}

function PulsingDot({ type }: { type: AlertType }) {
  if (type !== "out_of_stock") return null
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-8 h-4 rounded-full transition-colors duration-200 focus:outline-none",
        checked ? "bg-blue-600" : "bg-slate-200",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className={cn(
        "absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200",
        checked ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  )
}

// â"€â"€â"€ Table Header / Cell helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <TableHead className={cn("text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap bg-slate-50", right && "text-right")}>
    {children}
  </TableHead>
)
const TD = ({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) => (
  <TableCell className={cn("text-xs px-3 py-2", right && "text-right", className)}>
    {children}
  </TableCell>
)

// â"€â"€â"€ Zod Schema â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const ruleSchema = z.object({
  product_type:           z.enum(["mobile_phone", "accessory"] as const),
  brand:                  z.string().optional(),
  model:                  z.string().optional(),
  category:               z.string().optional(),
  minimum_stock_level:    z.string().min(1, "Required").refine((v) => !isNaN(Number(v)) && Number(v) >= 1, "Must be â‰¥ 1"),
  reorder_quantity:       z.string().optional(),
  preferred_supplier_id:  z.string().optional(),
  notify_via_dashboard:   z.boolean(),
  notify_via_email:       z.boolean(),
  notify_via_sms:         z.boolean(),
})
type RuleFormData = z.infer<typeof ruleSchema>

// â"€â"€â"€ Rule Form Dialog â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function RuleFormDialog({ open, editRule, onClose, onSave, suppliers }: {
  open: boolean; editRule: StockAlertRule | null
  onClose: () => void; onSave: (data: RuleFormData, rule: StockAlertRule | null) => void
  suppliers: Supplier[]
}) {
  const isEdit = editRule !== null
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { product_type: "mobile_phone", minimum_stock_level: "5", notify_via_dashboard: true, notify_via_email: false, notify_via_sms: false },
  })
  const productType = watch("product_type")

  useEffect(() => {
    if (editRule) {
      reset({
        product_type: editRule.product_type, brand: editRule.brand ?? "", model: editRule.model ?? "",
        category: editRule.category ?? "", minimum_stock_level: editRule.minimum_stock_level.toString(),
        reorder_quantity: editRule.reorder_quantity?.toString() ?? "",
        preferred_supplier_id: editRule.preferred_supplier_id ?? "",
        notify_via_dashboard: editRule.notify_via.includes("dashboard"),
        notify_via_email:     editRule.notify_via.includes("email"),
        notify_via_sms:       editRule.notify_via.includes("sms"),
      })
    } else {
      reset({ product_type: "mobile_phone", brand: "", model: "", category: "", minimum_stock_level: "5",
        reorder_quantity: "", preferred_supplier_id: "", notify_via_dashboard: true, notify_via_email: false, notify_via_sms: false })
    }
  }, [editRule, reset, open])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-blue-600" />
            {isEdit ? "Edit Alert Rule" : "New Alert Rule"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => onSave(d, editRule))} className="space-y-3 mt-1">
          {/* Product Type */}
          <div className="space-y-1">
            <Label className="text-xs">Product Type *</Label>
            <Select onValueChange={(v) => setValue("product_type", v as ProductType)} defaultValue={editRule?.product_type ?? "mobile_phone"}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile_phone"><span className="flex items-center gap-1.5 text-xs"><Smartphone className="w-3.5 h-3.5 text-blue-500" />Mobile Phone</span></SelectItem>
                <SelectItem value="accessory"><span className="flex items-center gap-1.5 text-xs"><Package className="w-3.5 h-3.5 text-purple-500" />Accessory</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Brand/Model or Category */}
          {productType === "mobile_phone" ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Brand <span className="text-slate-400 font-normal">(blank = all)</span></Label>
                <Input {...register("brand")} placeholder="e.g. Samsung" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Model <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Input {...register("model")} placeholder="e.g. S24" className="h-8 text-xs" />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Category <span className="text-slate-400 font-normal">(blank = all)</span></Label>
              <Select onValueChange={(v) => setValue("category", v === "__all__" ? "" : v)} defaultValue={editRule?.category || "__all__"}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Categories</SelectItem>
                  {ACCESSORY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Min Stock + Reorder */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Min Stock Level *</Label>
              <Input {...register("minimum_stock_level")} type="number" onWheel={e => e.currentTarget.blur()} min="1" placeholder="5" className="h-8 text-xs" />
              {errors.minimum_stock_level && <p className="text-[10px] text-red-500">{errors.minimum_stock_level.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Reorder Qty</Label>
              <Input {...register("reorder_quantity")} type="number" onWheel={e => e.currentTarget.blur()} min="0" placeholder="10" className="h-8 text-xs" />
            </div>
          </div>

          {/* Preferred Supplier */}
          <div className="space-y-1">
            <Label className="text-xs">Preferred Supplier <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Select onValueChange={(v) => setValue("preferred_supplier_id", v === "__none__" ? "" : v)} defaultValue={editRule?.preferred_supplier_id || "__none__"}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="No preference" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No preference</SelectItem>
                {suppliers.filter((s) => s.status === "Active").map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notify Via */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notify Via *</Label>
            <div className="flex items-center gap-4">
              {(["notify_via_dashboard", "notify_via_email", "notify_via_sms"] as const).map((key) => {
                const channel = key.replace("notify_via_", "") as NotifyChannel
                const { icon: Icon, label } = CHANNEL_META[channel]
                return (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <Checkbox checked={!!watch(key)} onCheckedChange={(v) => setValue(key, !!v)} />
                    <Icon className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-600">{label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700">
              {isEdit ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// â"€â"€â"€ Confirm Delete Dialog â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function ConfirmDeleteDialog({ open, title, description, onConfirm, onClose }: {
  open: boolean; title: string; description: string; onConfirm: () => void; onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-1.5 text-red-600">
            <Trash2 className="w-3.5 h-3.5" />{title}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700" onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// â"€â"€â"€ Main Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
type AlertTypeFilter = AlertType | "all"
type ActiveTab = "alerts" | "rules" | "history"

export default function StockAlertsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>("alerts")

  const [rules, setRules] = useState<StockAlertRule[]>([])
  const [logs, setLogs] = useState<StockAlertLog[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [alertTypeFilter, setAlertTypeFilter] = useState<AlertTypeFilter>("all")
  const [alertStatusFilter, setAlertStatusFilter] = useState<AlertStatus | "active_only">("active_only")
  const [alertSearch, setAlertSearch] = useState("")

  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [editRule, setEditRule] = useState<StockAlertRule | null>(null)
  const [deleteRule, setDeleteRule] = useState<StockAlertRule | null>(null)
  const [ruleTypeFilter, setRuleTypeFilter] = useState<ProductType | "all">("all")

  const [historyStatusFilter, setHistoryStatusFilter] = useState<AlertStatus | "all">("all")
  const [historyTypeFilter, setHistoryTypeFilter] = useState<ProductType | "all">("all")
  const [historyDateFrom, setHistoryDateFrom] = useState("")
  const [historyDateTo, setHistoryDateTo] = useState("")

  async function fetchData() {
    try {
      const [rulesRes, logsRes, suppliersRes] = await Promise.all([
        getStockAlertRules().catch(() => [] as StockAlertRule[]),
        getStockAlertLogs().catch(() => [] as StockAlertLog[]),
        getSuppliers(),
      ])
      setRules(rulesRes as unknown as StockAlertRule[])
      setLogs(logsRes as unknown as StockAlertLog[])
      setSuppliers(suppliersRes)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const stats = useMemo(() => {
    const active = logs.filter((l) => l.status !== "resolved")
    return {
      outOfStock: active.filter((l) => l.alert_type === "out_of_stock").length,
      lowStock:   active.filter((l) => l.alert_type === "low_stock").length,
      overstock:  active.filter((l) => l.alert_type === "overstock").length,
      total:      active.length,
    }
  }, [logs])

  const filteredAlerts = useMemo(() => {
    const q = alertSearch.toLowerCase().trim()
    return logs.filter((l) => {
      if (alertStatusFilter === "active_only" && l.status === "resolved") return false
      if (alertTypeFilter !== "all" && l.alert_type !== alertTypeFilter) return false
      if (q && !l.product_name.toLowerCase().includes(q) && !l.brand.toLowerCase().includes(q) && !(l.model?.toLowerCase().includes(q))) return false
      return true
    }).sort((a, b) => {
      const order: Record<AlertType, number> = { out_of_stock: 0, low_stock: 1, overstock: 2 }
      const statusOrder: Record<AlertStatus, number> = { active: 0, acknowledged: 1, resolved: 2 }
      if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status]
      return order[a.alert_type] - order[b.alert_type]
    })
  }, [logs, alertTypeFilter, alertStatusFilter, alertSearch])

  const filteredRules = useMemo(() =>
    rules.filter((r) => ruleTypeFilter === "all" || r.product_type === ruleTypeFilter),
    [rules, ruleTypeFilter]
  )

  const filteredHistory = useMemo(() =>
    logs.filter((l) => {
      if (historyStatusFilter !== "all" && l.status !== historyStatusFilter) return false
      if (historyTypeFilter !== "all" && l.product_type !== historyTypeFilter) return false
      if (historyDateFrom && l.created_at < historyDateFrom) return false
      if (historyDateTo && l.created_at > historyDateTo + "T23:59:59Z") return false
      return true
    }).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [logs, historyStatusFilter, historyTypeFilter, historyDateFrom, historyDateTo]
  )

  const handleAcknowledge = useCallback((log: StockAlertLog) => {
    setLogs((prev) => prev.map((l) => l.id === log.id ? { ...l, status: "acknowledged" as AlertStatus, acknowledged_by: "Ahmed Khan", acknowledged_at: new Date().toISOString() } : l))
    toast.success(`Alert for "${log.product_name}" acknowledged`)
  }, [])

  const handleResolve = useCallback((log: StockAlertLog) => {
    setLogs((prev) => prev.map((l) => l.id === log.id ? { ...l, status: "resolved" as AlertStatus, resolved_at: new Date().toISOString() } : l))
    toast.success("Alert resolved")
  }, [])

  const handleCreatePO = useCallback((log: StockAlertLog) => {
    toast.success(`Opening purchase order for ${log.product_name}...`)
    router.push("/purchases/new")
  }, [router])

  const handleSaveRule = useCallback((data: RuleFormData, rule: StockAlertRule | null) => {
    const notify_via: NotifyChannel[] = []
    if (data.notify_via_dashboard) notify_via.push("dashboard")
    if (data.notify_via_email)     notify_via.push("email")
    if (data.notify_via_sms)       notify_via.push("sms")
    if (notify_via.length === 0) { toast.error("Select at least one notification channel"); return }

    const supplier = suppliers.find((s) => s.id === data.preferred_supplier_id)
    const now = new Date().toISOString()

    if (rule) {
      setRules((prev) => prev.map((r) => r.id === rule.id ? {
        ...r, product_type: data.product_type, brand: data.brand || undefined,
        model: data.model || undefined, category: data.category || undefined,
        minimum_stock_level: Number(data.minimum_stock_level),
        reorder_quantity: data.reorder_quantity ? Number(data.reorder_quantity) : undefined,
        preferred_supplier_id: data.preferred_supplier_id || undefined,
        preferred_supplier_name: supplier?.companyName,
        notify_via, updated_at: now,
      } : r))
      toast.success("Alert rule updated")
    } else {
      setRules((prev) => [{
        id: `rule-${Date.now()}`, product_type: data.product_type,
        brand: data.brand || undefined, model: data.model || undefined,
        category: data.category || undefined,
        minimum_stock_level: Number(data.minimum_stock_level),
        reorder_quantity: data.reorder_quantity ? Number(data.reorder_quantity) : undefined,
        preferred_supplier_id: data.preferred_supplier_id || undefined,
        preferred_supplier_name: supplier?.companyName,
        alert_enabled: true, notify_via, created_at: now, updated_at: now,
      }, ...prev])
      toast.success("Alert rule created")
    }
    setShowRuleDialog(false); setEditRule(null)
  }, [suppliers])

  const handleToggleRule = useCallback((rule: StockAlertRule) => {
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, alert_enabled: !r.alert_enabled, updated_at: new Date().toISOString() } : r))
    toast.success(rule.alert_enabled ? "Alert rule disabled" : "Alert rule enabled")
  }, [])

  const handleDeleteRule = useCallback(() => {
    if (!deleteRule) return
    setRules((prev) => prev.filter((r) => r.id !== deleteRule.id))
    toast.success("Alert rule deleted")
    setDeleteRule(null)
  }, [deleteRule])

  const handleStatCardClick = (type: AlertTypeFilter) => {
    setAlertTypeFilter((prev) => prev === type ? "all" : type)
    setAlertStatusFilter("active_only")
    setActiveTab("alerts")
  }

  const activeAlertCount = stats.outOfStock + stats.lowStock + stats.overstock

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // â"€â"€ Stat card definitions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const statCards = [
    { type: "out_of_stock" as AlertTypeFilter, title: "Out of Stock", value: stats.outOfStock, sub: "Immediate action required", Icon: AlertOctagon, iconBg: "bg-red-500",    active: alertTypeFilter === "out_of_stock", activeBorder: "border-red-300 bg-red-50/40", hoverBorder: "hover:border-red-200", pulse: stats.outOfStock > 0 },
    { type: "low_stock"    as AlertTypeFilter, title: "Low Stock",    value: stats.lowStock,   sub: "Below minimum level",      Icon: AlertTriangle, iconBg: "bg-orange-500", active: alertTypeFilter === "low_stock",    activeBorder: "border-orange-300 bg-orange-50/40", hoverBorder: "hover:border-orange-200", pulse: false },
    { type: "overstock"    as AlertTypeFilter, title: "Overstocked",  value: stats.overstock,  sub: "Excess inventory detected", Icon: TrendingUp,    iconBg: "bg-blue-600",  active: alertTypeFilter === "overstock",   activeBorder: "border-blue-300 bg-blue-50/40", hoverBorder: "hover:border-blue-200",   pulse: false },
  ]

  return (
    <div className="p-4 space-y-3">

      {/* â"€â"€ Compact header â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 relative">
            <Bell className="w-4 h-4 text-white" />
            {activeAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                {activeAlertCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Stock Alerts</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {activeAlertCount} active alert{activeAlertCount !== 1 ? "s" : ""} - {rules.filter((r) => r.alert_enabled).length} active rules
            </p>
          </div>
        </div>
        <Button onClick={() => { setEditRule(null); setShowRuleDialog(true) }} size="sm" className="h-8 text-xs gap-1.5 px-3 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-3.5 h-3.5" />Add Alert Rule
        </Button>
      </div>

      {/* â"€â"€ 3 stat cards â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="grid grid-cols-3 gap-2.5">
        {statCards.map((card) => (
          <button
            key={card.type}
            onClick={() => handleStatCardClick(card.type)}
            className={cn(
              "text-left bg-white rounded-xl border px-3 py-2.5 transition-all hover:shadow-sm active:scale-[.98]",
              card.active && activeTab === "alerts" ? card.activeBorder : `border-slate-200 ${card.hoverBorder}`
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className={`w-6 h-6 rounded-md ${card.iconBg} flex items-center justify-center`}>
                <card.Icon className="w-3.5 h-3.5 text-white" />
              </div>
              {card.pulse && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
              )}
            </div>
            <p className="text-lg font-bold text-slate-900 leading-none">{card.value}</p>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">{card.title}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>
          </button>
        ))}
      </div>

      {/* â"€â"€ Tabs â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <TabsList className="h-8 p-0.5 rounded-xl bg-slate-100">
          <TabsTrigger value="alerts" className="h-7 text-xs gap-1.5 px-3">
            <BellRing className="w-3 h-3 shrink-0" />Alerts
            {stats.total > 0 && (
              <span className="min-w-[14px] h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold px-1">
                {stats.total}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules" className="h-7 text-xs gap-1.5 px-3">
            <Settings className="w-3 h-3 shrink-0" />Rules
            <span className="text-[10px] text-slate-400">({rules.length})</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="h-7 text-xs gap-1.5 px-3">
            <Clock className="w-3 h-3 shrink-0" />History
          </TabsTrigger>
        </TabsList>

        {/* â"€â"€ Tab 1: Alerts â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        <TabsContent value="alerts" className="mt-3 space-y-2.5">
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input value={alertSearch} onChange={(e) => setAlertSearch(e.target.value)} placeholder="Search product, brand..." className="pl-8 h-8 text-xs" />
              {alertSearch && (
                <button onClick={() => setAlertSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <Select value={alertTypeFilter} onValueChange={(v) => setAlertTypeFilter(v as AlertTypeFilter)}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="overstock">Overstocked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={alertStatusFilter} onValueChange={(v) => setAlertStatusFilter(v as AlertStatus | "active_only")}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active_only">Active &amp; Ack.</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            {(alertTypeFilter !== "all" || alertSearch) && (
              <button onClick={() => { setAlertTypeFilter("all"); setAlertSearch("") }} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />Clear
              </button>
            )}
            <span className="ml-auto text-[10px] text-slate-400">{filteredAlerts.length} alert{filteredAlerts.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Alerts table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-slate-50">
                    <TH>Product</TH><TH>Type</TH><TH right>Current Stock</TH><TH right>Min Level</TH>
                    <TH>Status</TH><TH>Last Restocked</TH><TH right>Actions</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          </div>
                          <p className="text-xs font-medium text-slate-500">No alerts found</p>
                          <p className="text-[10px] text-slate-400">All stock levels are healthy</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAlerts.map((log) => (
                      <TableRow key={log.id} className={cn("transition-colors", ALERT_TYPE_META[log.alert_type].rowClass)}>
                        <TD>
                          <div className="flex items-center gap-1.5">
                            <PulsingDot type={log.alert_type} />
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{log.product_name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {log.product_type === "mobile_phone" ? <Smartphone className="w-2.5 h-2.5 text-blue-400" /> : <Package className="w-2.5 h-2.5 text-purple-400" />}
                                <span className="text-[10px] text-slate-400">{log.brand}{log.category ? ` - ${log.category}` : ""}</span>
                              </div>
                            </div>
                          </div>
                        </TD>
                        <TD><AlertTypeBadge type={log.alert_type} /></TD>
                        <TD right>
                          <span className={cn("text-sm font-bold", log.current_stock === 0 ? "text-red-600" : log.alert_type === "low_stock" ? "text-orange-600" : "text-blue-600")}>
                            {log.current_stock}
                          </span>
                        </TD>
                        <TD right className="text-slate-500">{log.minimum_stock_level}</TD>
                        <TD><AlertStatusBadge status={log.status} /></TD>
                        <TD className="text-slate-400">{log.last_restocked ? formatDate(log.last_restocked) : "-"}</TD>
                        <TD right>
                          <div className="flex items-center justify-end gap-0.5">
                            {log.status === "active" && (
                              <button onClick={() => handleAcknowledge(log)} title="Acknowledge" className="p-1 rounded-md hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {log.status === "acknowledged" && (
                              <button onClick={() => handleResolve(log)} title="Mark Resolved" className="p-1 rounded-md hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors">
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {log.alert_type !== "overstock" && log.status !== "resolved" && (
                              <button onClick={() => handleCreatePO(log)} title="Create PO" className="p-1 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                                <ShoppingCart className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => router.push(log.product_type === "mobile_phone" ? "/products/mobiles" : "/products/accessories")} title="View Product" className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TD>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* â"€â"€ Tab 2: Rules â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        <TabsContent value="rules" className="mt-3 space-y-2.5">
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex items-center gap-2">
            <Select value={ruleTypeFilter} onValueChange={(v) => setRuleTypeFilter(v as ProductType | "all")}>
              <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Product Types</SelectItem>
                <SelectItem value="mobile_phone">Mobile Phones</SelectItem>
                <SelectItem value="accessory">Accessories</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto text-[10px] text-slate-400">{filteredRules.length} rule{filteredRules.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Rules table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-slate-50">
                    <TH>Rule Scope</TH><TH right>Min Stock</TH><TH right>Reorder Qty</TH>
                    <TH>Preferred Supplier</TH><TH>Notify Via</TH><TH right>Enabled</TH><TH right>Actions</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-xs text-slate-400">No rules found</TableCell></TableRow>
                  ) : (
                    filteredRules.map((rule) => (
                      <TableRow key={rule.id} className={cn("hover:bg-slate-50/50 transition-colors", !rule.alert_enabled && "opacity-60")}>
                        <TD>
                          <div className="flex items-center gap-2">
                            {rule.product_type === "mobile_phone"
                              ? <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center shrink-0"><Smartphone className="w-3 h-3 text-blue-600" /></div>
                              : <div className="w-6 h-6 rounded-md bg-purple-50 flex items-center justify-center shrink-0"><Package className="w-3 h-3 text-purple-600" /></div>
                            }
                            <div>
                              <p className="text-xs font-semibold text-slate-800">
                                {rule.brand ? rule.brand : "All"} {rule.model ?? ""}{rule.category ?? ""}
                                {!rule.brand && !rule.category && (rule.product_type === "mobile_phone" ? " Mobile Phones" : " Accessories")}
                              </p>
                              <p className="text-[10px] text-slate-400 capitalize">{rule.product_type.replace("_", " ")}</p>
                            </div>
                          </div>
                        </TD>
                        <TD right className="font-bold text-slate-700">{rule.minimum_stock_level}</TD>
                        <TD right className="text-slate-500">{rule.reorder_quantity ?? "-"}</TD>
                        <TD className="text-slate-500">{rule.preferred_supplier_name ?? "Any"}</TD>
                        <TD>
                          <div className="flex items-center gap-1">
                            {rule.notify_via.map((ch) => {
                              const { icon: Icon, label } = CHANNEL_META[ch]
                              return (
                                <span key={ch} title={label} className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center">
                                  <Icon className="w-2.5 h-2.5 text-slate-500" />
                                </span>
                              )
                            })}
                          </div>
                        </TD>
                        <TD right><Toggle checked={rule.alert_enabled} onChange={() => handleToggleRule(rule)} /></TD>
                        <TD right>
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => { setEditRule(rule); setShowRuleDialog(true) }} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteRule(rule)} className="p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TD>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* â"€â"€ Tab 3: History â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        <TabsContent value="history" className="mt-3 space-y-2.5">
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex flex-wrap items-center gap-2">
            <Select value={historyStatusFilter} onValueChange={(v) => setHistoryStatusFilter(v as AlertStatus | "all")}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={historyTypeFilter} onValueChange={(v) => setHistoryTypeFilter(v as ProductType | "all")}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="mobile_phone">Mobile Phones</SelectItem>
                <SelectItem value="accessory">Accessories</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">From</span>
              <Input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} className="h-8 text-xs w-32" />
              <span className="text-[10px] text-slate-400">To</span>
              <Input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} className="h-8 text-xs w-32" />
            </div>
            {(historyStatusFilter !== "all" || historyTypeFilter !== "all" || historyDateFrom || historyDateTo) && (
              <button onClick={() => { setHistoryStatusFilter("all"); setHistoryTypeFilter("all"); setHistoryDateFrom(""); setHistoryDateTo("") }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />Clear
              </button>
            )}
            <span className="ml-auto text-[10px] text-slate-400">{filteredHistory.length} record{filteredHistory.length !== 1 ? "s" : ""}</span>
          </div>

          {/* History table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-slate-50">
                    <TH>Product</TH><TH>Alert Type</TH><TH right>Stock at Alert</TH>
                    <TH>Status</TH><TH>Triggered</TH><TH>Acknowledged By</TH><TH>Resolved</TH>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-slate-300" />
                          </div>
                          <p className="text-xs text-slate-400">No history records found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHistory.map((log) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <TD>
                          <p className="text-xs font-semibold text-slate-800">{log.product_name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {log.product_type === "mobile_phone" ? <Smartphone className="w-2.5 h-2.5 text-blue-400" /> : <Package className="w-2.5 h-2.5 text-purple-400" />}
                            <span className="text-[10px] text-slate-400">{log.brand}</span>
                          </div>
                        </TD>
                        <TD><AlertTypeBadge type={log.alert_type} /></TD>
                        <TD right>
                          <span className="text-xs font-bold text-slate-700">{log.current_stock}</span>
                          <span className="text-[10px] text-slate-400"> / {log.minimum_stock_level}</span>
                        </TD>
                        <TD><AlertStatusBadge status={log.status} /></TD>
                        <TD>
                          <p className="text-xs text-slate-600">{format(new Date(log.created_at), "dd MMM yyyy")}</p>
                          <p className="text-[10px] text-slate-400">{format(new Date(log.created_at), "hh:mm a")}</p>
                        </TD>
                        <TD>
                          {log.acknowledged_by ? (
                            <div>
                              <p className="text-xs font-medium text-slate-600">{log.acknowledged_by}</p>
                              {log.acknowledged_at && <p className="text-[10px] text-slate-400">{format(new Date(log.acknowledged_at), "dd MMM, hh:mm a")}</p>}
                            </div>
                          ) : <span className="text-slate-300">-</span>}
                        </TD>
                        <TD>
                          {log.resolved_at
                            ? <p className="text-xs text-emerald-600 font-medium">{format(new Date(log.resolved_at), "dd MMM yyyy")}</p>
                            : <span className="text-slate-300">-</span>}
                        </TD>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* â"€â"€ Dialogs â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <RuleFormDialog
        open={showRuleDialog} editRule={editRule}
        onClose={() => { setShowRuleDialog(false); setEditRule(null) }}
        onSave={handleSaveRule} suppliers={suppliers}
      />
      <ConfirmDeleteDialog
        open={!!deleteRule} title="Delete Alert Rule"
        description="Are you sure you want to delete this alert rule? This cannot be undone and any active alerts from this rule will no longer be tracked."
        onConfirm={handleDeleteRule} onClose={() => setDeleteRule(null)}
      />
    </div>
  )
}

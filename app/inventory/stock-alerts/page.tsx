"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, AlertOctagon, TrendingUp, Bell, BellRing, Plus, Pencil, Trash2,
  CheckCircle, Clock, X,
  Smartphone, Package, Eye, ShoppingCart, RotateCcw, Settings,
  Mail, MessageSquare, Monitor, Search,
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

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn, formatDate } from "@/lib/utils"

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCESSORY_CATEGORIES = [
  "Headphones/Earbuds", "Chargers & Cables", "Screen Protectors",
  "Phone Cases", "Power Banks", "Speakers", "Smartwatches",
]

// ─── Badge Helpers ────────────────────────────────────────────────────────────

const ALERT_TYPE_META: Record<AlertType, { label: string; className: string; rowClass: string; icon: React.ElementType }> = {
  out_of_stock: {
    label: "Out of Stock",
    className: "bg-red-100 text-red-700 border-red-200",
    rowClass: "bg-red-50/30 hover:bg-red-50/50",
    icon: AlertOctagon,
  },
  low_stock: {
    label: "Low Stock",
    className: "bg-orange-100 text-orange-700 border-orange-200",
    rowClass: "bg-orange-50/30 hover:bg-orange-50/50",
    icon: AlertTriangle,
  },
  overstock: {
    label: "Overstocked",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    rowClass: "bg-blue-50/30 hover:bg-blue-50/50",
    icon: TrendingUp,
  },
}

const ALERT_STATUS_META: Record<AlertStatus, { label: string; className: string }> = {
  active:       { label: "Active",       className: "bg-red-50 text-red-700 border-red-200" },
  acknowledged: { label: "Acknowledged", className: "bg-amber-50 text-amber-700 border-amber-200" },
  resolved:     { label: "Resolved",     className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
}

function AlertTypeBadge({ type }: { type: AlertType }) {
  const { label, className, icon: Icon } = ALERT_TYPE_META[type]
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", className)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const { label, className } = ALERT_STATUS_META[status]
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", className)}>
      {label}
    </span>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        checked ? "bg-blue-600" : "bg-slate-200",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  )
}

// ─── Notify Channel Labels ────────────────────────────────────────────────────

const CHANNEL_META: Record<NotifyChannel, { icon: React.ElementType; label: string }> = {
  dashboard: { icon: Monitor,        label: "Dashboard" },
  email:     { icon: Mail,           label: "Email" },
  sms:       { icon: MessageSquare,  label: "SMS" },
}

// ─── Pulsing Dot for Critical Alerts ─────────────────────────────────────────

function PulsingDot({ type }: { type: AlertType }) {
  if (type !== "out_of_stock") return null
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
    </span>
  )
}

// ─── Zod Schema for Alert Rule Form ──────────────────────────────────────────

const ruleSchema = z.object({
  product_type: z.enum(["mobile_phone", "accessory"] as const),
  brand: z.string().optional(),
  model: z.string().optional(),
  category: z.string().optional(),
  minimum_stock_level: z
    .string()
    .min(1, "Required")
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 1, "Must be at least 1"),
  reorder_quantity: z.string().optional(),
  preferred_supplier_id: z.string().optional(),
  notify_via_dashboard: z.boolean(),
  notify_via_email: z.boolean(),
  notify_via_sms: z.boolean(),
})
type RuleFormData = z.infer<typeof ruleSchema>

// ─── Add / Edit Rule Dialog ───────────────────────────────────────────────────

function RuleFormDialog({
  open,
  editRule,
  onClose,
  onSave,
  suppliers,
}: {
  open: boolean
  editRule: StockAlertRule | null
  onClose: () => void
  onSave: (data: RuleFormData, rule: StockAlertRule | null) => void
  suppliers: Supplier[]
}) {
  const isEdit = editRule !== null
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      product_type: "mobile_phone" as ProductType,
      minimum_stock_level: "5",
      notify_via_dashboard: true,
      notify_via_email: false,
      notify_via_sms: false,
    },
  })

  const productType = watch("product_type")

  useEffect(() => {
    if (editRule) {
      reset({
        product_type: editRule.product_type,
        brand: editRule.brand ?? "",
        model: editRule.model ?? "",
        category: editRule.category ?? "",
        minimum_stock_level: editRule.minimum_stock_level.toString(),
        reorder_quantity: editRule.reorder_quantity?.toString() ?? "",
        preferred_supplier_id: editRule.preferred_supplier_id ?? "",
        notify_via_dashboard: editRule.notify_via.includes("dashboard"),
        notify_via_email: editRule.notify_via.includes("email"),
        notify_via_sms: editRule.notify_via.includes("sms"),
      })
    } else {
      reset({
        product_type: "mobile_phone",
        brand: "",
        model: "",
        category: "",
        minimum_stock_level: "5",
        reorder_quantity: "",
        preferred_supplier_id: "",
        notify_via_dashboard: true,
        notify_via_email: false,
        notify_via_sms: false,
      })
    }
  }, [editRule, reset, open])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            {isEdit ? "Edit Alert Rule" : "New Alert Rule"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the alert rule settings below." : "Define when a stock alert should be triggered."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => onSave(d, editRule))} className="space-y-4 mt-2">
          {/* Product Type */}
          <div className="space-y-1.5">
            <Label>Product Type *</Label>
            <Select
              onValueChange={(v) => setValue("product_type", v as ProductType)}
              defaultValue={editRule?.product_type ?? "mobile_phone"}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile_phone">
                  <div className="flex items-center gap-2"><Smartphone className="w-4 h-4 text-blue-500" /> Mobile Phone</div>
                </SelectItem>
                <SelectItem value="accessory">
                  <div className="flex items-center gap-2"><Package className="w-4 h-4 text-purple-500" /> Accessory</div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Brand & Model (mobile) or Category (accessory) */}
          {productType === "mobile_phone" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand">Brand <span className="text-slate-400 text-xs">(leave blank for all)</span></Label>
                <Input {...register("brand")} id="brand" placeholder="e.g. Samsung" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Model <span className="text-slate-400 text-xs">(optional)</span></Label>
                <Input {...register("model")} id="model" placeholder="e.g. Galaxy S24" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Category <span className="text-slate-400 text-xs">(leave blank for all)</span></Label>
              <Select onValueChange={(v) => setValue("category", v)} defaultValue={editRule?.category ?? ""}>
                <SelectTrigger><SelectValue placeholder="All accessory categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Categories</SelectItem>
                  {ACCESSORY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Stock Levels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="minimum_stock_level">Minimum Stock Level *</Label>
              <Input {...register("minimum_stock_level")} id="minimum_stock_level" type="number" min="1" placeholder="5" />
              {errors.minimum_stock_level && <p className="text-xs text-red-500">{errors.minimum_stock_level.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reorder_quantity">Reorder Quantity</Label>
              <Input {...register("reorder_quantity")} id="reorder_quantity" type="number" min="0" placeholder="10" />
            </div>
          </div>

          {/* Preferred Supplier */}
          <div className="space-y-1.5">
            <Label>Preferred Supplier <span className="text-slate-400 text-xs">(optional)</span></Label>
            <Select onValueChange={(v) => setValue("preferred_supplier_id", v)} defaultValue={editRule?.preferred_supplier_id ?? ""}>
              <SelectTrigger><SelectValue placeholder="No preference" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">No preference</SelectItem>
                {suppliers.filter((s) => s.status === "Active").map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notification Channels */}
          <div className="space-y-2">
            <Label>Notify Via *</Label>
            <div className="flex items-center gap-4 flex-wrap">
              {(["notify_via_dashboard", "notify_via_email", "notify_via_sms"] as const).map((key) => {
                const channel = key.replace("notify_via_", "") as NotifyChannel
                const { icon: Icon, label } = CHANNEL_META[channel]
                return (
                  <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={!!watch(key)}
                      onCheckedChange={(v) => setValue(key, !!v)}
                    />
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              {isEdit ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Confirm Delete Dialog ────────────────────────────────────────────────────

function ConfirmDeleteDialog({
  open,
  title,
  description,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type AlertTypeFilter = AlertType | "all"
type ActiveTab = "alerts" | "rules" | "history"

export default function StockAlertsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>("alerts")

  // Data state
  const [rules, setRules] = useState<StockAlertRule[]>([])
  const [logs, setLogs] = useState<StockAlertLog[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  // Alert tab state
  const [alertTypeFilter, setAlertTypeFilter] = useState<AlertTypeFilter>("all")
  const [alertStatusFilter, setAlertStatusFilter] = useState<AlertStatus | "active_only">("active_only")
  const [alertSearch, setAlertSearch] = useState("")

  // Rules tab state
  const [showRuleDialog, setShowRuleDialog] = useState(false)
  const [editRule, setEditRule] = useState<StockAlertRule | null>(null)
  const [deleteRule, setDeleteRule] = useState<StockAlertRule | null>(null)
  const [ruleTypeFilter, setRuleTypeFilter] = useState<ProductType | "all">("all")

  // History tab state
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

  useEffect(() => {
    fetchData()
  }, [])

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = logs.filter((l) => l.status !== "resolved")
    return {
      outOfStock: active.filter((l) => l.alert_type === "out_of_stock").length,
      lowStock:   active.filter((l) => l.alert_type === "low_stock").length,
      overstock:  active.filter((l) => l.alert_type === "overstock").length,
      total:      active.length,
    }
  }, [logs])

  // ── Filtered Alerts ───────────────────────────────────────────────────────
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

  // ── Filtered Rules ────────────────────────────────────────────────────────
  const filteredRules = useMemo(() => {
    return rules.filter((r) => ruleTypeFilter === "all" || r.product_type === ruleTypeFilter)
  }, [rules, ruleTypeFilter])

  // ── Filtered History ──────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    return logs.filter((l) => {
      if (historyStatusFilter !== "all" && l.status !== historyStatusFilter) return false
      if (historyTypeFilter !== "all" && l.product_type !== historyTypeFilter) return false
      if (historyDateFrom && l.created_at < historyDateFrom) return false
      if (historyDateTo && l.created_at > historyDateTo + "T23:59:59Z") return false
      return true
    }).sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [logs, historyStatusFilter, historyTypeFilter, historyDateFrom, historyDateTo])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAcknowledge = useCallback((log: StockAlertLog) => {
    setLogs((prev) => prev.map((l) => l.id === log.id ? {
      ...l,
      status: "acknowledged" as AlertStatus,
      acknowledged_by: "Ahmed Khan",
      acknowledged_at: new Date().toISOString(),
    } : l))
    toast.success(`Alert for "${log.product_name}" acknowledged`)
  }, [])

  const handleResolve = useCallback((log: StockAlertLog) => {
    setLogs((prev) => prev.map((l) => l.id === log.id ? {
      ...l,
      status: "resolved" as AlertStatus,
      resolved_at: new Date().toISOString(),
    } : l))
    toast.success(`Alert resolved`)
  }, [])

  const handleCreatePO = useCallback((log: StockAlertLog) => {
    toast.success(`Opening purchase order for ${log.product_name}...`)
    router.push("/purchases/new")
  }, [router])

  const handleSaveRule = useCallback((data: RuleFormData, rule: StockAlertRule | null) => {
    const notify_via: NotifyChannel[] = []
    if (data.notify_via_dashboard) notify_via.push("dashboard")
    if (data.notify_via_email) notify_via.push("email")
    if (data.notify_via_sms) notify_via.push("sms")
    if (notify_via.length === 0) { toast.error("Select at least one notification channel"); return }

    const supplier = suppliers.find((s) => s.id === data.preferred_supplier_id)
    const now = new Date().toISOString()

    if (rule) {
      setRules((prev) => prev.map((r) => r.id === rule.id ? {
        ...r,
        product_type: data.product_type,
        brand: data.brand || undefined,
        model: data.model || undefined,
        category: data.category || undefined,
        minimum_stock_level: Number(data.minimum_stock_level),
        reorder_quantity: data.reorder_quantity ? Number(data.reorder_quantity) : undefined,
        preferred_supplier_id: data.preferred_supplier_id || undefined,
        preferred_supplier_name: supplier?.companyName,
        notify_via,
        updated_at: now,
      } : r))
      toast.success("Alert rule updated")
    } else {
      const newRule: StockAlertRule = {
        id: `rule-${Date.now()}`,
        product_type: data.product_type,
        brand: data.brand || undefined,
        model: data.model || undefined,
        category: data.category || undefined,
        minimum_stock_level: Number(data.minimum_stock_level),
        reorder_quantity: data.reorder_quantity ? Number(data.reorder_quantity) : undefined,
        preferred_supplier_id: data.preferred_supplier_id || undefined,
        preferred_supplier_name: supplier?.companyName,
        alert_enabled: true,
        notify_via,
        created_at: now,
        updated_at: now,
      }
      setRules((prev) => [newRule, ...prev])
      toast.success("Alert rule created")
    }
    setShowRuleDialog(false)
    setEditRule(null)
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

  // ─────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2"><Skeleton className="h-8 w-44" /><Skeleton className="h-4 w-60" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="rounded-2xl border bg-white p-5 space-y-3"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-8 w-16" /><Skeleton className="h-4 w-28" /></div>)}
        </div>
        <div className="rounded-2xl border bg-white p-5"><Skeleton className="h-64 w-full" /></div>
      </div>
    )
  }

  const activeAlertCount = stats.outOfStock + stats.lowStock + stats.overstock

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Stock Alerts"
        description={`${activeAlertCount} active alert${activeAlertCount !== 1 ? "s" : ""} · ${rules.filter((r) => r.alert_enabled).length} active rules`}
        badge={
          activeAlertCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              {activeAlertCount} Alerts
            </span>
          ) : undefined
        }
        action={
          <Button onClick={() => { setEditRule(null); setShowRuleDialog(true) }} className="bg-blue-600 hover:bg-blue-700 gap-1.5" size="sm">
            <Plus className="w-4 h-4" /> Add Alert Rule
          </Button>
        }
      />

      {/* ── Stat Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Out of Stock */}
        <button
          onClick={() => handleStatCardClick("out_of_stock")}
          className={cn(
            "text-left rounded-2xl border-2 p-5 transition-all duration-200 bg-white",
            "hover:shadow-lg hover:-translate-y-0.5 group",
            alertTypeFilter === "out_of_stock" && activeTab === "alerts"
              ? "border-red-400 shadow-md shadow-red-100"
              : "border-slate-100 hover:border-red-300"
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center shadow-sm">
              <AlertOctagon className="w-6 h-6 text-white" />
            </div>
            {stats.outOfStock > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">{stats.outOfStock}</p>
          <p className="text-sm font-semibold text-slate-500">Out of Stock</p>
          <p className="text-xs text-slate-400 mt-0.5">Immediate action required</p>
        </button>

        {/* Low Stock */}
        <button
          onClick={() => handleStatCardClick("low_stock")}
          className={cn(
            "text-left rounded-2xl border-2 p-5 transition-all duration-200 bg-white",
            "hover:shadow-lg hover:-translate-y-0.5 group",
            alertTypeFilter === "low_stock" && activeTab === "alerts"
              ? "border-orange-400 shadow-md shadow-orange-100"
              : "border-slate-100 hover:border-orange-300"
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-sm">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">{stats.lowStock}</p>
          <p className="text-sm font-semibold text-slate-500">Low Stock</p>
          <p className="text-xs text-slate-400 mt-0.5">Below minimum level</p>
        </button>

        {/* Overstocked */}
        <button
          onClick={() => handleStatCardClick("overstock")}
          className={cn(
            "text-left rounded-2xl border-2 p-5 transition-all duration-200 bg-white",
            "hover:shadow-lg hover:-translate-y-0.5 group",
            alertTypeFilter === "overstock" && activeTab === "alerts"
              ? "border-blue-400 shadow-md shadow-blue-100"
              : "border-slate-100 hover:border-blue-300"
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-1">{stats.overstock}</p>
          <p className="text-sm font-semibold text-slate-500">Overstocked</p>
          <p className="text-xs text-slate-400 mt-0.5">Excess inventory detected</p>
        </button>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ActiveTab)}>
        <TabsList className="bg-slate-100 w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="alerts" className="gap-2">
            <BellRing className="w-4 h-4" />
            Active Alerts
            {stats.total > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold px-1">
                {stats.total}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Settings className="w-4 h-4" />
            Alert Rules
            <span className="ml-1 text-[11px] text-slate-500">({rules.length})</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Active Alerts ───────────────────────────────────────── */}
        <TabsContent value="alerts">
          <div className="space-y-4">
            {/* Filters */}
            <Card className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <Input
                    value={alertSearch}
                    onChange={(e) => setAlertSearch(e.target.value)}
                    placeholder="Search product, brand..."
                    className="pl-8 h-8 text-sm bg-slate-50"
                  />
                  {alertSearch && (
                    <button onClick={() => setAlertSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <Select value={alertTypeFilter} onValueChange={(v) => setAlertTypeFilter(v as AlertTypeFilter)}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-slate-50">
                    <SelectValue placeholder="Alert Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    <SelectItem value="low_stock">Low Stock</SelectItem>
                    <SelectItem value="overstock">Overstocked</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={alertStatusFilter} onValueChange={(v) => setAlertStatusFilter(v as AlertStatus | "active_only")}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-slate-50">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active_only">Active &amp; Ack.</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>

                {(alertTypeFilter !== "all" || alertSearch) && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-400 hover:text-red-500"
                    onClick={() => { setAlertTypeFilter("all"); setAlertSearch("") }}>
                    <X className="w-3.5 h-3.5 mr-1" /> Clear
                  </Button>
                )}
                <span className="ml-auto text-xs text-slate-500">{filteredAlerts.length} alert{filteredAlerts.length !== 1 ? "s" : ""}</span>
              </div>
            </Card>

            {/* Alerts Table */}
            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Current Stock</TableHead>
                    <TableHead className="text-center">Min Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Restocked</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                            <CheckCircle className="w-7 h-7 text-emerald-400" />
                          </div>
                          <p className="text-slate-500 font-medium">No alerts found</p>
                          <p className="text-slate-400 text-sm">All stock levels are healthy</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAlerts.map((log) => {
                      const meta = ALERT_TYPE_META[log.alert_type]
                      return (
                        <TableRow key={log.id} className={cn("transition-colors", meta.rowClass)}>
                          {/* Product */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <PulsingDot type={log.alert_type} />
                              <div>
                                <p className="font-semibold text-sm text-slate-800">{log.product_name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {log.product_type === "mobile_phone"
                                    ? <Smartphone className="w-3 h-3 text-blue-400" />
                                    : <Package className="w-3 h-3 text-purple-400" />
                                  }
                                  <span className="text-xs text-slate-500">{log.brand}</span>
                                  {log.category && <span className="text-xs text-slate-400">· {log.category}</span>}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* Alert Type */}
                          <TableCell><AlertTypeBadge type={log.alert_type} /></TableCell>

                          {/* Current Stock */}
                          <TableCell className="text-center">
                            <span className={cn(
                              "text-lg font-bold",
                              log.current_stock === 0 ? "text-red-600" : log.alert_type === "low_stock" ? "text-orange-600" : "text-blue-600"
                            )}>
                              {log.current_stock}
                            </span>
                          </TableCell>

                          {/* Min Level */}
                          <TableCell className="text-center">
                            <span className="text-sm font-medium text-slate-600">{log.minimum_stock_level}</span>
                          </TableCell>

                          {/* Status */}
                          <TableCell><AlertStatusBadge status={log.status} /></TableCell>

                          {/* Last Restocked */}
                          <TableCell>
                            <span className="text-xs text-slate-500">
                              {log.last_restocked ? formatDate(log.last_restocked) : "—"}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {log.status === "active" && (
                                <button
                                  onClick={() => handleAcknowledge(log)}
                                  title="Acknowledge"
                                  className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              {log.status === "acknowledged" && (
                                <button
                                  onClick={() => handleResolve(log)}
                                  title="Mark Resolved"
                                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
                              {log.alert_type !== "overstock" && log.status !== "resolved" && (
                                <button
                                  onClick={() => handleCreatePO(log)}
                                  title="Create Purchase Order"
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => router.push(log.product_type === "mobile_phone" ? "/products/mobiles" : "/products/accessories")}
                                title="View Product"
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 2: Alert Rules ─────────────────────────────────────────── */}
        <TabsContent value="rules">
          <div className="space-y-4">
            {/* Rules Filters */}
            <Card className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={ruleTypeFilter} onValueChange={(v) => setRuleTypeFilter(v as ProductType | "all")}>
                  <SelectTrigger className="w-44 h-8 text-xs bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Product Types</SelectItem>
                    <SelectItem value="mobile_phone">Mobile Phones</SelectItem>
                    <SelectItem value="accessory">Accessories</SelectItem>
                  </SelectContent>
                </Select>
                <span className="ml-auto text-xs text-slate-500">{filteredRules.length} rule{filteredRules.length !== 1 ? "s" : ""}</span>
              </div>
            </Card>

            {/* Rules Table */}
            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Rule Scope</TableHead>
                    <TableHead className="text-center">Min Stock</TableHead>
                    <TableHead className="text-center">Reorder Qty</TableHead>
                    <TableHead>Preferred Supplier</TableHead>
                    <TableHead>Notify Via</TableHead>
                    <TableHead className="text-center">Enabled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-slate-400 text-sm">No rules found</TableCell>
                    </TableRow>
                  ) : (
                    filteredRules.map((rule) => (
                      <TableRow key={rule.id} className={cn("transition-colors hover:bg-slate-50/50", !rule.alert_enabled && "opacity-60")}>
                        {/* Scope */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {rule.product_type === "mobile_phone"
                              ? <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0"><Smartphone className="w-3.5 h-3.5 text-blue-600" /></div>
                              : <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0"><Package className="w-3.5 h-3.5 text-purple-600" /></div>
                            }
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {rule.brand ? rule.brand : "All"} {rule.model ? rule.model : ""}
                                {rule.category ? rule.category : ""}
                                {!rule.brand && !rule.category && (rule.product_type === "mobile_phone" ? "Mobile Phones" : "Accessories")}
                              </p>
                              <p className="text-xs text-slate-400 capitalize">{rule.product_type.replace("_", " ")}</p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Min Stock */}
                        <TableCell className="text-center">
                          <span className="text-sm font-bold text-slate-700">{rule.minimum_stock_level}</span>
                        </TableCell>

                        {/* Reorder Qty */}
                        <TableCell className="text-center">
                          <span className="text-sm text-slate-600">{rule.reorder_quantity ?? "—"}</span>
                        </TableCell>

                        {/* Supplier */}
                        <TableCell>
                          <span className="text-xs text-slate-600">{rule.preferred_supplier_name ?? "Any"}</span>
                        </TableCell>

                        {/* Notify Via */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {rule.notify_via.map((ch) => {
                              const { icon: Icon, label } = CHANNEL_META[ch]
                              return (
                                <span key={ch} title={label} className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
                                  <Icon className="w-3 h-3 text-slate-500" />
                                </span>
                              )
                            })}
                          </div>
                        </TableCell>

                        {/* Toggle */}
                        <TableCell className="text-center">
                          <Toggle checked={rule.alert_enabled} onChange={() => handleToggleRule(rule)} />
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setEditRule(rule); setShowRuleDialog(true) }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteRule(rule)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 3: Alert History ───────────────────────────────────────── */}
        <TabsContent value="history">
          <div className="space-y-4">
            {/* History Filters */}
            <Card className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={historyStatusFilter} onValueChange={(v) => setHistoryStatusFilter(v as AlertStatus | "all")}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={historyTypeFilter} onValueChange={(v) => setHistoryTypeFilter(v as ProductType | "all")}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="mobile_phone">Mobile Phones</SelectItem>
                    <SelectItem value="accessory">Accessories</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5">
                  <Input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} className="h-8 text-xs w-36 bg-slate-50" />
                  <span className="text-xs text-slate-400">to</span>
                  <Input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} className="h-8 text-xs w-36 bg-slate-50" />
                </div>

                {(historyStatusFilter !== "all" || historyTypeFilter !== "all" || historyDateFrom || historyDateTo) && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-400 hover:text-red-500"
                    onClick={() => { setHistoryStatusFilter("all"); setHistoryTypeFilter("all"); setHistoryDateFrom(""); setHistoryDateTo("") }}>
                    <X className="w-3.5 h-3.5 mr-1" /> Clear
                  </Button>
                )}
                <span className="ml-auto text-xs text-slate-500">{filteredHistory.length} records</span>
              </div>
            </Card>

            {/* History Table */}
            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead>Product</TableHead>
                    <TableHead>Alert Type</TableHead>
                    <TableHead className="text-center">Stock at Alert</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Triggered</TableHead>
                    <TableHead>Acknowledged By</TableHead>
                    <TableHead>Resolved</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-slate-400 text-sm">No history records found</TableCell>
                    </TableRow>
                  ) : (
                    filteredHistory.map((log) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Product */}
                        <TableCell>
                          <p className="font-semibold text-sm text-slate-800">{log.product_name}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {log.product_type === "mobile_phone"
                              ? <Smartphone className="w-3 h-3 text-blue-400" />
                              : <Package className="w-3 h-3 text-purple-400" />
                            }
                            <span className="text-xs text-slate-500">{log.brand}</span>
                          </div>
                        </TableCell>

                        {/* Alert Type */}
                        <TableCell><AlertTypeBadge type={log.alert_type} /></TableCell>

                        {/* Stock */}
                        <TableCell className="text-center">
                          <span className="font-bold text-slate-700">{log.current_stock}</span>
                          <span className="text-xs text-slate-400"> / {log.minimum_stock_level}</span>
                        </TableCell>

                        {/* Status */}
                        <TableCell><AlertStatusBadge status={log.status} /></TableCell>

                        {/* Triggered */}
                        <TableCell>
                          <p className="text-xs text-slate-600">{format(new Date(log.created_at), "dd MMM yyyy")}</p>
                          <p className="text-[10px] text-slate-400">{format(new Date(log.created_at), "hh:mm a")}</p>
                        </TableCell>

                        {/* Acknowledged By */}
                        <TableCell>
                          {log.acknowledged_by ? (
                            <div>
                              <p className="text-xs text-slate-600 font-medium">{log.acknowledged_by}</p>
                              {log.acknowledged_at && (
                                <p className="text-[10px] text-slate-400">{format(new Date(log.acknowledged_at), "dd MMM, hh:mm a")}</p>
                              )}
                            </div>
                          ) : <span className="text-slate-300 text-sm">—</span>}
                        </TableCell>

                        {/* Resolved */}
                        <TableCell>
                          {log.resolved_at ? (
                            <p className="text-xs text-emerald-600 font-medium">{format(new Date(log.resolved_at), "dd MMM yyyy")}</p>
                          ) : <span className="text-slate-300 text-sm">—</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}
      <RuleFormDialog
        open={showRuleDialog}
        editRule={editRule}
        onClose={() => { setShowRuleDialog(false); setEditRule(null) }}
        onSave={handleSaveRule}
        suppliers={suppliers}
      />

      <ConfirmDeleteDialog
        open={!!deleteRule}
        title="Delete Alert Rule"
        description={`Are you sure you want to delete this alert rule? This cannot be undone and any active alerts from this rule will no longer be tracked.`}
        onConfirm={handleDeleteRule}
        onClose={() => setDeleteRule(null)}
      />
    </div>
  )
}

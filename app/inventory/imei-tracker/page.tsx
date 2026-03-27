"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  Search, Plus, Eye, Pencil, ShoppingCart, Printer, Smartphone,
  Package, DollarSign, AlertTriangle, Shield, Ban, Clock, CheckCircle,
  ChevronUp, ChevronDown, ChevronsUpDown, Upload, X, Copy, History,
  Calendar, User, Truck, FileText, ChevronLeft, ChevronRight,
  MoreHorizontal, Tag, HardDrive, Palette, ShieldCheck, ShieldX,
  ShieldAlert, ShieldOff, Box, RotateCcw, Wrench, AlertOctagon,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { format } from "date-fns"

import type { IMEIRecord, PTAStatus, DeviceStatus, IMEIHistoryEvent } from "@/data/imei-records"
import { getImeiRecords, createImeiRecord, updateImeiStatus } from "@/lib/api/inventory"
import { getSuppliers } from "@/lib/api/suppliers"
import { getCustomers } from "@/lib/api/customers"
import type { Supplier, Customer } from "@/data/types"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn, formatCurrency, formatDate } from "@/lib/utils"

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const BRANDS = ["Samsung", "Apple", "Xiaomi", "Oppo", "Vivo", "OnePlus", "Tecno", "Infinix", "Realme", "Nokia", "Huawei", "Motorola"]
const STORAGE_OPTIONS = ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"]
const PTA_STATUS_OPTIONS: PTAStatus[] = ["approved", "blocked", "pending", "not_registered"]
const DEVICE_STATUS_OPTIONS: DeviceStatus[] = ["in_stock", "sold", "returned", "defective", "stolen", "lost"]

// ─── Luhn Algorithm ──────────────────────────────────────────────────────────

function luhnCheck(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false
  const digits = imei.split("").map(Number).reverse()
  const sum = digits.reduce((acc, digit, idx) => {
    if (idx % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    return acc + digit
  }, 0)
  return sum % 10 === 0
}

// ─── Badge Helpers ────────────────────────────────────────────────────────────

const PTA_META: Record<PTAStatus, { label: string; className: string; icon: React.ElementType }> = {
  approved:       { label: "Approved",       className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: ShieldCheck },
  blocked:        { label: "Blocked",        className: "bg-red-50 text-red-700 border-red-200",             icon: ShieldX },
  pending:        { label: "Pending",        className: "bg-amber-50 text-amber-700 border-amber-200",       icon: ShieldAlert },
  not_registered: { label: "Not Registered", className: "bg-slate-100 text-slate-600 border-slate-200",      icon: ShieldOff },
}

const DEVICE_META: Record<DeviceStatus, { label: string; className: string; icon: React.ElementType }> = {
  in_stock:  { label: "In Stock",  className: "bg-blue-50 text-blue-700 border-blue-200",     icon: Box },
  sold:      { label: "Sold",      className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle },
  returned:  { label: "Returned",  className: "bg-amber-50 text-amber-700 border-amber-200",  icon: RotateCcw },
  defective: { label: "Defective", className: "bg-orange-50 text-orange-700 border-orange-200", icon: Wrench },
  stolen:    { label: "Stolen",    className: "bg-red-50 text-red-700 border-red-200",        icon: AlertOctagon },
  lost:      { label: "Lost",      className: "bg-slate-100 text-slate-500 border-slate-200", icon: AlertTriangle },
}

const HISTORY_META: Record<string, { icon: React.ElementType; color: string }> = {
  purchased:       { icon: Truck,         color: "text-blue-600 bg-blue-100" },
  stocked:         { icon: Package,       color: "text-indigo-600 bg-indigo-100" },
  sold:            { icon: ShoppingCart,  color: "text-emerald-600 bg-emerald-100" },
  returned:        { icon: RotateCcw,     color: "text-amber-600 bg-amber-100" },
  repaired:        { icon: Wrench,        color: "text-orange-600 bg-orange-100" },
  reported_stolen: { icon: AlertOctagon,  color: "text-red-600 bg-red-100" },
  reported_lost:   { icon: AlertTriangle, color: "text-slate-600 bg-slate-100" },
  pta_registered:  { icon: ShieldCheck,   color: "text-emerald-600 bg-emerald-100" },
  pta_blocked:     { icon: ShieldX,       color: "text-red-600 bg-red-100" },
  warranty_claim:  { icon: FileText,      color: "text-violet-600 bg-violet-100" },
}

function PTABadge({ status }: { status: PTAStatus }) {
  const { label, className, icon: Icon } = PTA_META[status]
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", className)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const { label, className, icon: Icon } = DEVICE_META[status]
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", className)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}

// ─── Sort Helper ─────────────────────────────────────────────────────────────

type SortField = "imei_number" | "brand" | "model" | "pta_status" | "device_status" | "purchase_price" | "purchase_date"

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: "asc" | "desc" }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />
  return sortDir === "asc"
    ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
    : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const imeiSchema = z.object({
  imei_number: z
    .string()
    .regex(/^\d{15}$/, "Must be exactly 15 digits")
    .refine(luhnCheck, "Invalid IMEI — failed Luhn algorithm check"),
  imei_2: z
    .string()
    .refine((v) => v === "" || (v.length === 15 && /^\d{15}$/.test(v) && luhnCheck(v)), {
      message: "Must be exactly 15 digits and pass Luhn check",
    })
    .optional()
    .or(z.literal("")),
  brand: z.string().min(1, "Required"),
  model: z.string().min(1, "Required"),
  color: z.string().min(1, "Required"),
  storage_capacity: z.string().min(1, "Required"),
  pta_status: z.enum(["approved", "blocked", "pending", "not_registered"] as const),
  pta_tax_amount: z.string().optional(),
  device_status: z.enum(["in_stock", "sold", "returned", "defective", "stolen", "lost"] as const),
  purchase_price: z.string().min(1, "Required").refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Must be a positive number"),
  selling_price: z.string().optional(),
  supplier_id: z.string().min(1, "Required"),
  purchase_date: z.string().min(1, "Required"),
  warranty_expiry: z.string().optional(),
  notes: z.string().optional(),
})
type IMEIFormData = z.infer<typeof imeiSchema>

const soldSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  customer_phone: z.string().min(10, "Valid phone number required"),
  selling_price: z.string().min(1, "Required").refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Must be a positive number"),
  sold_date: z.string().min(1, "Required"),
})
type SoldFormData = z.infer<typeof soldSchema>

// ─── Details Slide-Over ───────────────────────────────────────────────────────

function DetailsSlideOver({
  record,
  onClose,
  onEdit,
}: {
  record: IMEIRecord | null
  onClose: () => void
  onEdit: (r: IMEIRecord) => void
}) {
  if (!record) return null

  const ptaMeta = PTA_META[record.pta_status]
  const deviceMeta = DEVICE_META[record.device_status]
  const profit = record.selling_price ? record.selling_price - record.purchase_price : null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{record.brand} {record.model}</p>
              <p className="text-xs text-slate-500 font-mono">{record.imei_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(record)} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <PTABadge status={record.pta_status} />
            <DeviceStatusBadge status={record.device_status} />
          </div>

          {/* Device Details */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Device Details</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Tag, label: "Brand", value: record.brand },
                { icon: Smartphone, label: "Model", value: record.model },
                { icon: Palette, label: "Color", value: record.color },
                { icon: HardDrive, label: "Storage", value: record.storage_capacity },
                { icon: Calendar, label: "Purchased", value: formatDate(record.purchase_date) },
                { icon: Calendar, label: "Warranty", value: record.warranty_expiry ? formatDate(record.warranty_expiry) : "—" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-[11px] text-slate-500 font-medium">{label}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* IMEI Numbers */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">IMEI Numbers</p>
            <div className="space-y-2">
              <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500 font-medium mb-0.5">IMEI 1 (Primary)</p>
                  <p className="text-sm font-mono font-semibold text-slate-800">{record.imei_number}</p>
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(record.imei_number); toast.success("IMEI copied") }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {record.imei_2 && (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium mb-0.5">IMEI 2 (Secondary)</p>
                    <p className="text-sm font-mono font-semibold text-slate-800">{record.imei_2}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(record.imei_2!); toast.success("IMEI 2 copied") }}
                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Financial */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Financial</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-500 font-medium mb-1">Purchase</p>
                <p className="text-sm font-bold text-slate-800">{formatCurrency(record.purchase_price)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[11px] text-slate-500 font-medium mb-1">Selling</p>
                <p className="text-sm font-bold text-slate-800">{record.selling_price ? formatCurrency(record.selling_price) : "—"}</p>
              </div>
              <div className={cn("rounded-xl p-3", profit !== null ? (profit >= 0 ? "bg-emerald-50" : "bg-red-50") : "bg-slate-50")}>
                <p className="text-[11px] text-slate-500 font-medium mb-1">Profit</p>
                <p className={cn("text-sm font-bold", profit !== null ? (profit >= 0 ? "text-emerald-700" : "text-red-600") : "text-slate-400")}>
                  {profit !== null ? formatCurrency(profit) : "—"}
                </p>
              </div>
            </div>
            {record.pta_tax_amount != null && record.pta_tax_amount > 0 && (
              <div className="mt-2 bg-amber-50 rounded-xl p-3">
                <p className="text-[11px] text-amber-600 font-medium mb-0.5">PTA Tax Paid</p>
                <p className="text-sm font-bold text-amber-700">{formatCurrency(record.pta_tax_amount)}</p>
              </div>
            )}
          </div>

          {/* Supplier & Customer */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Parties</p>
            <div className="space-y-2">
              <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium">Supplier</p>
                  <p className="text-sm font-semibold text-slate-800">{record.supplier_name}</p>
                </div>
              </div>
              {record.customer_name && (
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 font-medium">Customer</p>
                    <p className="text-sm font-semibold text-slate-800">{record.customer_name}</p>
                    {record.customer_phone && <p className="text-xs text-slate-500">{record.customer_phone}</p>}
                    {record.sold_date && <p className="text-xs text-slate-400">Sold: {formatDate(record.sold_date)}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {record.notes && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Notes</p>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">{record.notes}</p>
            </div>
          )}

          {/* History Timeline */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-slate-400" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device History</p>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-100" />
              <div className="space-y-4">
                {[...record.history].reverse().map((event) => {
                  const meta = HISTORY_META[event.event] ?? { icon: FileText, color: "text-slate-600 bg-slate-100" }
                  const Icon = meta.icon
                  return (
                    <div key={event.id} className="flex items-start gap-3 relative pl-2">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 shadow-sm", meta.color)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <p className="text-xs font-semibold text-slate-700 capitalize">{event.event.replace(/_/g, " ")}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{event.description}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{format(new Date(event.date), "dd MMM yyyy, hh:mm a")}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Add / Edit Dialog ────────────────────────────────────────────────────────

function IMEIFormDialog({
  open,
  onClose,
  onSave,
  editRecord,
  suppliers,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: IMEIFormData, record: IMEIRecord | null) => void
  editRecord: IMEIRecord | null
  suppliers: Supplier[]
}) {
  const isEdit = editRecord !== null

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<IMEIFormData>({
    resolver: zodResolver(imeiSchema),
    defaultValues: {
      pta_status: "pending",
      device_status: "in_stock",
      purchase_date: new Date().toISOString().split("T")[0],
    },
  })

  // Populate form when editing
  useEffect(() => {
    if (editRecord) {
      reset({
        imei_number: editRecord.imei_number,
        imei_2: editRecord.imei_2 ?? "",
        brand: editRecord.brand,
        model: editRecord.model,
        color: editRecord.color,
        storage_capacity: editRecord.storage_capacity,
        pta_status: editRecord.pta_status,
        pta_tax_amount: editRecord.pta_tax_amount?.toString() ?? "",
        device_status: editRecord.device_status,
        purchase_price: editRecord.purchase_price.toString(),
        selling_price: editRecord.selling_price?.toString() ?? "",
        supplier_id: editRecord.supplier_id,
        purchase_date: editRecord.purchase_date,
        warranty_expiry: editRecord.warranty_expiry ?? "",
        notes: editRecord.notes ?? "",
      })
    } else {
      reset({
        imei_number: "",
        imei_2: "",
        brand: "",
        model: "",
        color: "",
        storage_capacity: "",
        pta_status: "pending",
        pta_tax_amount: "",
        device_status: "in_stock",
        purchase_price: "",
        selling_price: "",
        supplier_id: "",
        purchase_date: new Date().toISOString().split("T")[0],
        warranty_expiry: "",
        notes: "",
      })
    }
  }, [editRecord, reset, open])

  const onSubmit = (data: IMEIFormData) => {
    onSave(data, editRecord)
  }

  const field = (id: keyof IMEIFormData) => ({ ...register(id), id })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-600" />
            {isEdit ? "Edit IMEI Record" : "Add New IMEI Record"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Update device details below." : "Enter device details. IMEI will be validated using the Luhn algorithm."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* IMEI Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="imei_number">IMEI 1 (Primary) *</Label>
              <Input {...field("imei_number")} placeholder="Enter 15-digit IMEI" maxLength={15} className="font-mono" />
              {errors.imei_number && <p className="text-xs text-red-500">{errors.imei_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imei_2">IMEI 2 (Dual SIM, optional)</Label>
              <Input {...field("imei_2")} placeholder="Enter 15-digit IMEI" maxLength={15} className="font-mono" />
              {errors.imei_2 && <p className="text-xs text-red-500">{errors.imei_2.message}</p>}
            </div>
          </div>

          {/* Brand & Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Brand *</Label>
              <Select onValueChange={(v) => setValue("brand", v)} defaultValue={editRecord?.brand}>
                <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                <SelectContent>
                  {BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.brand && <p className="text-xs text-red-500">{errors.brand.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model *</Label>
              <Input {...field("model")} placeholder="e.g. Galaxy S24 Ultra" />
              {errors.model && <p className="text-xs text-red-500">{errors.model.message}</p>}
            </div>
          </div>

          {/* Color & Storage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="color">Color *</Label>
              <Input {...field("color")} placeholder="e.g. Titanium Black" />
              {errors.color && <p className="text-xs text-red-500">{errors.color.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Storage *</Label>
              <Select onValueChange={(v) => setValue("storage_capacity", v)} defaultValue={editRecord?.storage_capacity}>
                <SelectTrigger><SelectValue placeholder="Select storage" /></SelectTrigger>
                <SelectContent>
                  {STORAGE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.storage_capacity && <p className="text-xs text-red-500">{errors.storage_capacity.message}</p>}
            </div>
          </div>

          {/* PTA & Device Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>PTA Status *</Label>
              <Select onValueChange={(v) => setValue("pta_status", v as PTAStatus)} defaultValue={editRecord?.pta_status ?? "pending"}>
                <SelectTrigger><SelectValue placeholder="PTA Status" /></SelectTrigger>
                <SelectContent>
                  {PTA_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{PTA_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.pta_status && <p className="text-xs text-red-500">{errors.pta_status.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Device Status *</Label>
              <Select onValueChange={(v) => setValue("device_status", v as DeviceStatus)} defaultValue={editRecord?.device_status ?? "in_stock"}>
                <SelectTrigger><SelectValue placeholder="Device Status" /></SelectTrigger>
                <SelectContent>
                  {DEVICE_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{DEVICE_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.device_status && <p className="text-xs text-red-500">{errors.device_status.message}</p>}
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="purchase_price">Purchase Price (₨) *</Label>
              <Input {...field("purchase_price")} type="number" min="0" placeholder="0" />
              {errors.purchase_price && <p className="text-xs text-red-500">{errors.purchase_price.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="selling_price">Selling Price (₨)</Label>
              <Input {...field("selling_price")} type="number" min="0" placeholder="0" />
              {errors.selling_price && <p className="text-xs text-red-500">{errors.selling_price.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pta_tax_amount">PTA Tax (₨)</Label>
              <Input {...field("pta_tax_amount")} type="number" min="0" placeholder="0" />
            </div>
          </div>

          {/* Supplier */}
          <div className="space-y-1.5">
            <Label>Supplier *</Label>
            <Select onValueChange={(v) => setValue("supplier_id", v)} defaultValue={editRecord?.supplier_id}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplier_id && <p className="text-xs text-red-500">{errors.supplier_id.message}</p>}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="purchase_date">Purchase Date *</Label>
              <Input {...field("purchase_date")} type="date" />
              {errors.purchase_date && <p className="text-xs text-red-500">{errors.purchase_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warranty_expiry">Warranty Expiry</Label>
              <Input {...field("warranty_expiry")} type="date" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea {...register("notes")} id="notes" placeholder="Any additional notes..." rows={2} className="resize-none" />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? "Saving..." : isEdit ? "Update Record" : "Add IMEI Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Mark as Sold Dialog ──────────────────────────────────────────────────────

function MarkAsSoldDialog({
  open,
  record,
  onClose,
  onSell,
  customers,
}: {
  open: boolean
  record: IMEIRecord | null
  onClose: () => void
  onSell: (data: SoldFormData) => void
  customers: Customer[]
}) {
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<SoldFormData>({
    resolver: zodResolver(soldSchema),
    defaultValues: {
      sold_date: new Date().toISOString().split("T")[0],
      selling_price: record?.selling_price?.toString() ?? "",
    },
  })

  useEffect(() => {
    if (open && record) {
      reset({
        customer_name: "",
        customer_phone: "",
        selling_price: record.selling_price?.toString() ?? "",
        sold_date: new Date().toISOString().split("T")[0],
      })
    }
  }, [open, record, reset])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            Mark as Sold
          </DialogTitle>
          {record && (
            <DialogDescription>
              {record.brand} {record.model} — IMEI: {record.imei_number}
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit(onSell)} className="space-y-4 mt-2">
          {/* Quick select from customers */}
          <div className="space-y-1.5">
            <Label>Quick Select Customer</Label>
            <Select onValueChange={(v) => {
              const c = customers.find((c) => c.id === v)
              if (c) { setValue("customer_name", c.name); setValue("customer_phone", c.phone) }
            }}>
              <SelectTrigger><SelectValue placeholder="Select existing customer..." /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} — {c.phone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer_name">Customer Name *</Label>
            <Input {...register("customer_name")} placeholder="Full name" />
            {errors.customer_name && <p className="text-xs text-red-500">{errors.customer_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="customer_phone">Customer Phone *</Label>
            <Input {...register("customer_phone")} placeholder="+92 3XX XXXXXXX" />
            {errors.customer_phone && <p className="text-xs text-red-500">{errors.customer_phone.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="selling_price">Selling Price (₨) *</Label>
              <Input {...register("selling_price")} type="number" min="0" placeholder="0" />
              {errors.selling_price && <p className="text-xs text-red-500">{errors.selling_price.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sold_date">Sale Date *</Label>
              <Input {...register("sold_date")} type="date" />
              {errors.sold_date && <p className="text-xs text-red-500">{errors.sold_date.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Confirm Sale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Bulk Import Dialog ───────────────────────────────────────────────────────

function BulkImportDialog({ open, onClose, onImport, suppliers }: { open: boolean; onClose: () => void; onImport: (rows: IMEIRecord[]) => void; suppliers: Supplier[] }) {
  const [preview, setPreview] = useState<string[][]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState("")

  const sampleCsv = `imei_number,brand,model,color,storage_capacity,pta_status,device_status,purchase_price,supplier_id,purchase_date
356938035643800,Samsung,Galaxy A15,Black,128GB,pending,in_stock,32000,sup-001,2026-03-14`

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.trim().split("\n").map((l) => l.split(",").map((c) => c.trim().replace(/"/g, "")))
      setPreview(lines.slice(0, 6))
      setErrors([])
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (preview.length < 2) { setErrors(["No data rows found."]); return }
    const [headers, ...rows] = preview
    const errs: string[] = []
    const newRecords: IMEIRecord[] = []

    rows.forEach((row, i) => {
      if (row.length < 10) { errs.push(`Row ${i + 2}: insufficient columns`); return }
      const [imei_number, brand, model, color, storage_capacity, pta_status, device_status, purchase_price, supplier_id, purchase_date] = row
      if (!/^\d{15}$/.test(imei_number)) { errs.push(`Row ${i + 2}: invalid IMEI "${imei_number}"`); return }
      if (!PTA_STATUS_OPTIONS.includes(pta_status as PTAStatus)) { errs.push(`Row ${i + 2}: invalid PTA status "${pta_status}"`); return }
      if (!DEVICE_STATUS_OPTIONS.includes(device_status as DeviceStatus)) { errs.push(`Row ${i + 2}: invalid device status "${device_status}"`); return }

      const supplier = suppliers.find((s) => s.id === supplier_id)
      newRecords.push({
        id: `imei-import-${Date.now()}-${i}`,
        imei_number, brand, model, color, storage_capacity,
        pta_status: pta_status as PTAStatus,
        device_status: device_status as DeviceStatus,
        purchase_price: Number(purchase_price),
        supplier_id,
        supplier_name: supplier?.companyName ?? supplier_id,
        purchase_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        history: [
          { id: `h-import-${i}`, date: new Date().toISOString(), event: "purchased", description: `Imported via CSV. Purchased from ${supplier?.companyName ?? supplier_id}.` },
          { id: `h-import-${i}-2`, date: new Date().toISOString(), event: "stocked", description: "Added to inventory via bulk import." },
        ],
      })
    })

    if (errs.length > 0) { setErrors(errs); return }
    onImport(newRecords)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Bulk Import IMEI Records
          </DialogTitle>
          <DialogDescription>Upload a CSV file to import multiple IMEI records at once.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Sample format */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-semibold text-slate-600 mb-2">Required CSV format:</p>
            <pre className="text-[10px] text-slate-500 overflow-x-auto leading-relaxed whitespace-pre-wrap">{sampleCsv}</pre>
            <button
              onClick={() => {
                const blob = new Blob([sampleCsv], { type: "text/csv" })
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a"); a.href = url; a.download = "imei_template.csv"; a.click()
              }}
              className="mt-2 text-xs text-blue-600 hover:underline font-medium"
            >
              Download template
            </button>
          </div>

          {/* File input */}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors">
            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500 mb-3">{fileName || "Drop CSV file here or click to browse"}</p>
            <input type="file" accept=".csv" onChange={handleFile} className="hidden" id="csv-upload" />
            <label htmlFor="csv-upload">
              <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => document.getElementById("csv-upload")?.click()}>
                Choose File
              </Button>
            </label>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50">
                  <tr>{preview[0].map((h, i) => <th key={i} className="px-2 py-1.5 text-left text-slate-600 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {row.map((cell, j) => <td key={j} className="px-2 py-1.5 text-slate-600 font-mono">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
              {errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={preview.length < 2} className="bg-blue-600 hover:bg-blue-700">
            Import {Math.max(0, preview.length - 1)} Records
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Print Label Dialog ───────────────────────────────────────────────────────

function PrintLabelDialog({ open, record, onClose }: { open: boolean; record: IMEIRecord | null; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            Print Device Label
          </DialogTitle>
        </DialogHeader>
        {record && (
          <div>
            <div id="print-label" className="border-2 border-slate-800 rounded-xl p-5 text-center space-y-2 bg-white">
              <p className="font-bold text-lg text-slate-900">{record.brand} {record.model}</p>
              <p className="text-slate-500 text-sm">{record.color} · {record.storage_capacity}</p>
              <Separator className="my-2" />
              <div className="space-y-1">
                <p className="text-xs text-slate-500">IMEI</p>
                <p className="font-mono font-bold text-slate-900 text-lg tracking-widest">{record.imei_number}</p>
                {record.imei_2 && <p className="font-mono text-xs text-slate-500">{record.imei_2}</p>}
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-xs text-slate-500">
                <span>PTA: {PTA_META[record.pta_status].label}</span>
                <span>{formatCurrency(record.selling_price ?? record.purchase_price)}</span>
              </div>
            </div>
            <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Print Label
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IMEITrackerPage() {
  const [records, setRecords] = useState<IMEIRecord[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState("")
  const [ptaFilter, setPtaFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [brandFilter, setBrandFilter] = useState("all")

  // Sorting
  const [sortField, setSortField] = useState<SortField>("purchase_date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // Pagination
  const [page, setPage] = useState(1)

  // Dialog states
  const [selectedRecord, setSelectedRecord] = useState<IMEIRecord | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showAddEdit, setShowAddEdit] = useState(false)
  const [editRecord, setEditRecord] = useState<IMEIRecord | null>(null)
  const [showSold, setShowSold] = useState(false)
  const [sellRecord, setSellRecord] = useState<IMEIRecord | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [printRecord, setPrintRecord] = useState<IMEIRecord | null>(null)

  // Fetch data from Supabase
  async function fetchData() {
    try {
      const [imeiRes, suppliersRes, customersRes] = await Promise.all([
        getImeiRecords().catch(() => [] as IMEIRecord[]),
        getSuppliers(),
        getCustomers(),
      ])
      // Map API ImeiRecord to page's IMEIRecord type if needed
      setRecords(imeiRes as unknown as IMEIRecord[])
      setSuppliers(suppliersRes)
      setCustomers(customersRes)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Stats
  const stats = useMemo(() => ({
    total: records.length,
    inStock: records.filter((r) => r.device_status === "in_stock").length,
    sold: records.filter((r) => r.device_status === "sold").length,
    blockedOrStolen: records.filter((r) => r.pta_status === "blocked" || r.device_status === "stolen").length,
  }), [records])

  // Available brands for filter
  const availableBrands = useMemo(() => [...new Set(records.map((r) => r.brand))].sort(), [records])

  // Filtered + sorted records
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return records
      .filter((r) => {
        if (q && !r.imei_number.includes(q) && !r.brand.toLowerCase().includes(q) && !r.model.toLowerCase().includes(q) && !(r.customer_name?.toLowerCase().includes(q)) && !(r.supplier_name.toLowerCase().includes(q))) return false
        if (ptaFilter !== "all" && r.pta_status !== ptaFilter) return false
        if (statusFilter !== "all" && r.device_status !== statusFilter) return false
        if (brandFilter !== "all" && r.brand !== brandFilter) return false
        return true
      })
      .sort((a, b) => {
        let aVal: string | number = a[sortField] as string | number ?? ""
        let bVal: string | number = b[sortField] as string | number ?? ""
        if (typeof aVal === "string") aVal = aVal.toLowerCase()
        if (typeof bVal === "string") bVal = bVal.toLowerCase()
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1
        return 0
      })
  }, [records, search, ptaFilter, statusFilter, brandFilter, sortField, sortDir])

  // Paginated
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  // Sort toggle
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("asc") }
    setPage(1)
  }

  // Reset page on filter change
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handlePTAFilter = (v: string) => { setPtaFilter(v); setPage(1) }
  const handleStatusFilter = (v: string) => { setStatusFilter(v); setPage(1) }
  const handleBrandFilter = (v: string) => { setBrandFilter(v); setPage(1) }

  // Handlers
  const handleViewDetails = (r: IMEIRecord) => { setSelectedRecord(r); setShowDetails(true) }
  const handleEdit = (r: IMEIRecord) => { setEditRecord(r); setShowAddEdit(true); setShowDetails(false) }
  const handleAddNew = () => { setEditRecord(null); setShowAddEdit(true) }
  const handleSell = (r: IMEIRecord) => { setSellRecord(r); setShowSold(true) }
  const handlePrint = (r: IMEIRecord) => { setPrintRecord(r); setShowPrint(true) }
  const handleCopyIMEI = (imei: string) => { navigator.clipboard.writeText(imei); toast.success("IMEI copied to clipboard") }

  const handleSaveRecord = useCallback(async (data: IMEIFormData, record: IMEIRecord | null) => {
    const supplierObj = suppliers.find((s) => s.id === data.supplier_id)
    const now = new Date().toISOString()
    const todayDate = now.split("T")[0]

    try {
      if (record) {
        // Edit — optimistic local update + persist
        setRecords((prev) => prev.map((r) => r.id === record.id ? {
          ...r,
          ...data,
          imei_2: data.imei_2 || undefined,
          purchase_price: Number(data.purchase_price),
          selling_price: data.selling_price ? Number(data.selling_price) : undefined,
          pta_tax_amount: data.pta_tax_amount ? Number(data.pta_tax_amount) : undefined,
          supplier_name: supplierObj?.companyName ?? data.supplier_id,
          warranty_expiry: data.warranty_expiry || undefined,
          notes: data.notes || undefined,
          updated_at: now,
        } : r))
        await updateImeiStatus(record.id, data.device_status as 'In Stock' | 'Sold' | 'Reserved' | 'Returned' | 'Defective').catch(() => {})
        toast.success("IMEI record updated successfully")
      } else {
        // Add
        const newRecord: IMEIRecord = {
          id: `imei-${Date.now()}`,
          imei_number: data.imei_number,
          imei_2: data.imei_2 || undefined,
          brand: data.brand,
          model: data.model,
          color: data.color,
          storage_capacity: data.storage_capacity,
          pta_status: data.pta_status,
          pta_tax_amount: data.pta_tax_amount ? Number(data.pta_tax_amount) : undefined,
          device_status: data.device_status,
          purchase_price: Number(data.purchase_price),
          selling_price: data.selling_price ? Number(data.selling_price) : undefined,
          supplier_id: data.supplier_id,
          supplier_name: supplierObj?.companyName ?? data.supplier_id,
          purchase_date: data.purchase_date,
          warranty_expiry: data.warranty_expiry || undefined,
          notes: data.notes || undefined,
          created_at: now,
          updated_at: now,
          history: [
            { id: `h-${Date.now()}-1`, date: now, event: "purchased", description: `Purchased from ${supplierObj?.companyName ?? data.supplier_id} at ${formatCurrency(Number(data.purchase_price))}` },
            { id: `h-${Date.now()}-2`, date: now, event: "stocked", description: "Device added to inventory. IMEI verified." },
          ],
        }
        setRecords((prev) => [newRecord, ...prev])
        // Also persist to Supabase
        await createImeiRecord({
          productId: '',
          productName: `${data.brand} ${data.model}`,
          imei: data.imei_number,
          status: 'In Stock',
          notes: data.notes || undefined,
        }).catch(() => {})
        toast.success("IMEI record added successfully")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save IMEI record")
    }
    setShowAddEdit(false)
    setEditRecord(null)
  }, [suppliers])

  const handleConfirmSale = useCallback(async (data: SoldFormData) => {
    if (!sellRecord) return
    const now = new Date().toISOString()
    setRecords((prev) => prev.map((r) => r.id === sellRecord.id ? {
      ...r,
      device_status: "sold" as DeviceStatus,
      selling_price: Number(data.selling_price),
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      sold_date: data.sold_date,
      updated_at: now,
      history: [...r.history, {
        id: `h-${Date.now()}`,
        date: now,
        event: "sold" as const,
        description: `Sold to ${data.customer_name} (${data.customer_phone}) for ${formatCurrency(Number(data.selling_price))}.`,
      }],
    } : r))
    // Also persist status change to Supabase
    await updateImeiStatus(sellRecord.id, 'Sold').catch(() => {})
    toast.success(`Device sold to ${data.customer_name}`)
    setShowSold(false)
    setSellRecord(null)
  }, [sellRecord])

  const handleImport = useCallback((rows: IMEIRecord[]) => {
    setRecords((prev) => [...rows, ...prev])
    toast.success(`${rows.length} IMEI records imported successfully`)
    setShowImport(false)
  }, [])

  // Sortable TH
  const SortTH = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-slate-50 transition-colors"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1.5">
        {children}
        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </div>
    </TableHead>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <PageHeader
        title="IMEI Tracker"
        description={`Track ${stats.total} devices · ${stats.inStock} in stock · ${stats.sold} sold`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-1.5">
              <Upload className="w-4 h-4" /> Bulk Import
            </Button>
            <Button size="sm" onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
              <Plus className="w-4 h-4" /> Add IMEI
            </Button>
          </div>
        }
      />

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Devices" value={stats.total.toString()} icon={Smartphone} iconBg="bg-blue-100" subtext="All IMEI records" />
        <StatCard title="In Stock" value={stats.inStock.toString()} icon={Package} iconBg="bg-indigo-100" subtext="Available for sale" />
        <StatCard title="Sold" value={stats.sold.toString()} icon={DollarSign} iconBg="bg-emerald-100" subtext="Completed sales" />
        <StatCard title="Blocked / Stolen" value={stats.blockedOrStolen.toString()} icon={AlertTriangle} iconBg="bg-red-100" subtext="PTA blocked or stolen" />
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search IMEI, brand, model, customer, supplier..."
              className="pl-9 bg-slate-50 border-slate-200"
            />
            {search && (
              <button onClick={() => handleSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* PTA Status */}
          <Select value={ptaFilter} onValueChange={handlePTAFilter}>
            <SelectTrigger className="w-40 h-8 text-xs bg-slate-50">
              <SelectValue placeholder="PTA Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All PTA Status</SelectItem>
              {PTA_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{PTA_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Device Status */}
          <Select value={statusFilter} onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-40 h-8 text-xs bg-slate-50">
              <SelectValue placeholder="Device Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {DEVICE_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{DEVICE_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Brand */}
          <Select value={brandFilter} onValueChange={handleBrandFilter}>
            <SelectTrigger className="w-36 h-8 text-xs bg-slate-50">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {availableBrands.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {(ptaFilter !== "all" || statusFilter !== "all" || brandFilter !== "all" || search) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-500 hover:text-red-500"
              onClick={() => { setSearch(""); setPtaFilter("all"); setStatusFilter("all"); setBrandFilter("all"); setPage(1) }}
            >
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
          )}

          <span className="ml-auto text-xs text-slate-500 flex items-center">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""} found
          </span>
        </div>
      </Card>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <SortTH field="imei_number">IMEI</SortTH>
                <SortTH field="brand">Brand / Model</SortTH>
                <TableHead>Color / Storage</TableHead>
                <SortTH field="pta_status">PTA Status</SortTH>
                <SortTH field="device_status">Device Status</SortTH>
                <SortTH field="purchase_price">Purchase</SortTH>
                <TableHead>Selling</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <Smartphone className="w-7 h-7 text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-medium">No IMEI records found</p>
                      <p className="text-slate-400 text-sm">Try adjusting your search or filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((record) => (
                  <TableRow key={record.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* IMEI */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-semibold text-slate-800">{record.imei_number}</span>
                        <button
                          onClick={() => handleCopyIMEI(record.imei_number)}
                          className="text-slate-300 hover:text-blue-500 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {record.imei_2 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-mono text-[11px] text-slate-400">{record.imei_2}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded">SIM 2</span>
                        </div>
                      )}
                    </TableCell>

                    {/* Brand/Model */}
                    <TableCell>
                      <p className="font-semibold text-slate-800 text-sm">{record.brand}</p>
                      <p className="text-xs text-slate-500">{record.model}</p>
                    </TableCell>

                    {/* Color/Storage */}
                    <TableCell>
                      <p className="text-sm text-slate-700">{record.color}</p>
                      <span className="inline-block text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono mt-0.5">{record.storage_capacity}</span>
                    </TableCell>

                    {/* PTA Status */}
                    <TableCell><PTABadge status={record.pta_status} /></TableCell>

                    {/* Device Status */}
                    <TableCell><DeviceStatusBadge status={record.device_status} /></TableCell>

                    {/* Purchase Price */}
                    <TableCell>
                      <p className="text-sm font-semibold text-slate-800">{formatCurrency(record.purchase_price)}</p>
                      <p className="text-[11px] text-slate-400">{formatDate(record.purchase_date)}</p>
                    </TableCell>

                    {/* Selling Price */}
                    <TableCell>
                      {record.selling_price ? (
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">{formatCurrency(record.selling_price)}</p>
                          <p className="text-[11px] text-slate-400">{record.sold_date ? formatDate(record.sold_date) : ""}</p>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>

                    {/* Supplier */}
                    <TableCell>
                      <p className="text-sm text-slate-600 max-w-[140px] truncate">{record.supplier_name}</p>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleViewDetails(record)}
                          title="View Details"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(record)}
                          title="Edit"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {record.device_status === "in_stock" && (
                          <button
                            onClick={() => handleSell(record)}
                            title="Mark as Sold"
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handlePrint(record)}
                          title="Print Label"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(1)} disabled={page === 1}>
                <ChevronLeft className="w-3 h-3" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page + i - 2
                if (p < 1 || p > totalPages) return null
                return (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="icon"
                    className={cn("h-7 w-7 text-xs", p === page && "bg-blue-600 hover:bg-blue-700")}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              })}
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────────────── */}
      <DetailsSlideOver record={showDetails ? selectedRecord : null} onClose={() => setShowDetails(false)} onEdit={handleEdit} />

      <IMEIFormDialog
        open={showAddEdit}
        onClose={() => { setShowAddEdit(false); setEditRecord(null) }}
        onSave={handleSaveRecord}
        editRecord={editRecord}
        suppliers={suppliers}
      />

      <MarkAsSoldDialog
        open={showSold}
        record={sellRecord}
        onClose={() => { setShowSold(false); setSellRecord(null) }}
        onSell={handleConfirmSale}
        customers={customers}
      />

      <BulkImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        suppliers={suppliers}
      />

      <PrintLabelDialog
        open={showPrint}
        record={printRecord}
        onClose={() => { setShowPrint(false); setPrintRecord(null) }}
      />
    </div>
  )
}

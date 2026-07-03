﻿"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  Plus, Search, Grid3X3, List, Smartphone, Copy, Eye, Pencil, Trash2, Filter,
  TrendingUp, Package, DollarSign, AlertTriangle, ShoppingBag,
  Tag, Hash, Palette, HardDrive, Cpu, Truck, FileText, ArrowDownLeft, ArrowUpRight, Layers,
  ImageIcon, X as XIcon, Upload,
} from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { format } from "date-fns"
import { ColumnDef } from "@tanstack/react-table"

import { getMobiles, createMobile, updateMobile, deleteMobile } from "@/lib/api/products"
import { NewPurchaseSheet } from "@/app/purchases/new-purchase-sheet"
import { MASTER_BRANDS, MASTER_BRAND_NAMES, APPLE_MODELS } from "@/data/brands"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { getSuppliers } from "@/lib/api/suppliers"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { Mobile, Supplier } from "@/data/types"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatCurrency, calculateMargin } from "@/lib/utils"
// All dropdowns are now dynamic - fetched from database

// â"€â"€â"€ Zod Schema â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const mobileSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  color: z.string().min(1, "Color is required"),
  storage: z.string().min(1, "Storage is required"),
  ram: z.string().min(1, "RAM is required"),
  condition: z.string().min(1, "Condition is required"),
  category: z.string().min(1, "Category is required"),
  imei: z.string().trim().optional().default("").refine((v) => !v || /^\d{15}$/.test(v), "IMEI must be 15 digits when provided"),
  notes: z.string().optional(),
  // price/stock/supplier are set via Purchase page, not here
  purchasePrice: z.string().optional().transform(v => v ? parseFloat(v) : 0).pipe(z.number().min(0)),
  sellingPrice: z.string().optional().transform(v => v ? parseFloat(v) : 0).pipe(z.number().min(0)),
  supplierId: z.string().optional().default(""),
  stock: z.string().optional().transform(v => v ? parseInt(v, 10) : 0).pipe(z.number().min(0)),
})

// Input type = what the HTML form fields contain (strings for numeric inputs)
type MobileFormInput = z.input<typeof mobileSchema>
// Output type = what the validated/transformed schema produces (numbers for numeric fields)
type MobileFormOutput = z.output<typeof mobileSchema>

// For mobiles, only In Stock / Out of Stock - no Low Stock concept
function getMobileStockStatus(stock: number): "In Stock" | "Out of Stock" {
  return stock > 0 ? "In Stock" : "Out of Stock"
}

const stockDotColor: Record<string, string> = {
  "In Stock": "bg-emerald-500",
  "Low Stock": "bg-amber-500",
  "Out of Stock": "bg-red-500",
}

// â"€â"€â"€ Stock badge config â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const stockBadgeStyle: Record<string, string> = {
  "In Stock":     "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Low Stock":    "bg-amber-50 text-amber-700 border border-amber-200",
  "Out of Stock": "bg-red-50 text-red-600 border border-red-200",
}
const stockDotStyle: Record<string, string> = {
  "In Stock":     "bg-emerald-500",
  "Low Stock":    "bg-amber-500",
  "Out of Stock": "bg-red-500",
}

// â"€â"€â"€ Mobile Card â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function MobileCard({
  mobile,
  onView,
  onEdit,
  onDelete,
}: {
  mobile: Mobile
  onView: (m: Mobile) => void
  onEdit: (m: Mobile) => void
  onDelete: (m: Mobile) => void
}) {
  const margin = calculateMargin(mobile.purchasePrice, mobile.sellingPrice)
  const stockStatus = getMobileStockStatus(mobile.stock)

  function handleCopyImei() {
    if (!mobile.imei) {
      toast.info("No IMEI recorded for this stock batch")
      return
    }
    navigator.clipboard.writeText(mobile.imei)
    toast.success("IMEI copied to clipboard")
  }

  return (
    <Card className="relative overflow-hidden border border-slate-200/80 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/8 transition-all duration-200 hover:-translate-y-0.5 bg-white group rounded-xl">

      {/* â"€â"€ Image / Hero section â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="relative h-28 overflow-hidden bg-linear-to-br from-slate-50 via-blue-50/40 to-slate-100">
        {mobile.image ? (
          <Image
            src={mobile.image}
            alt={`${mobile.brand} ${mobile.model}`}
            fill
            className="object-contain p-3 drop-shadow-md group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-600/30">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
          </div>
        )}

        {/* Brand + OS badges - top left */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-white/90 backdrop-blur-sm text-slate-700 shadow-sm border border-slate-200/60">
            {mobile.brand}
          </span>
          <span className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold shadow-sm",
            mobile.deviceType === "iphone" ? "bg-slate-900 text-white" : "bg-green-600 text-white"
          )}>
            {mobile.deviceType === "iphone" ? "iPhone" : "Android"}
          </span>
        </div>

        {/* Margin badge - top right (only shown after purchase sets price) */}
        {mobile.purchasePrice > 0 && mobile.sellingPrice > 0 && (
          <span className="absolute top-2 right-2 z-10 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white shadow-sm">
            <TrendingUp className="w-2.5 h-2.5" />
            {margin.toFixed(1)}%
          </span>
        )}
      </div>

      {/* â"€â"€ Content â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="p-3 space-y-2">

        {/* Model name + specs */}
        <div>
          <h3 className="font-bold text-slate-900 text-[13px] leading-snug truncate">
            {mobile.model}
          </h3>
          <p className="text-[10px] text-slate-400 font-medium tracking-wide">
            {mobile.storage} / {mobile.ram} &middot; {mobile.color}
          </p>
        </div>


        {/* Price block */}
        {mobile.purchasePrice > 0 || mobile.sellingPrice > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Buy</p>
              <p className="text-[11px] font-semibold text-slate-600 truncate">{formatCurrency(mobile.purchasePrice)}</p>
            </div>
            <div className="rounded-lg bg-blue-600 px-2.5 py-1.5 shadow-sm shadow-blue-600/20">
              <p className="text-[9px] font-bold text-blue-200 uppercase tracking-wider">Sell</p>
              <p className="text-[11px] font-bold text-white truncate">{formatCurrency(mobile.sellingPrice)}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-2.5 py-2 text-center">
            <p className="text-[10px] text-amber-600 font-medium">No price set - purchase to stock</p>
          </div>
        )}

        {/* Stock badge */}
        <div className="flex items-center justify-between">
          {mobile.stock > 0 ? (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", stockBadgeStyle[stockStatus])}>
              <span className={cn("w-1.5 h-1.5 rounded-full", stockDotStyle[stockStatus])} />
              {stockStatus}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-500">
              Catalog only
            </span>
          )}
          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
            {mobile.stock} units
          </span>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-slate-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md gap-1 px-1"
            onClick={() => onView(mobile)}
          >
            <Eye className="w-3 h-3" />
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md gap-1 px-1"
            onClick={() => onEdit(mobile)}
          >
            <Pencil className="w-3 h-3" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md gap-1 px-1"
            onClick={() => onDelete(mobile)}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </Button>
        </div>
      </div>
    </Card>
  )
}

// â"€â"€â"€ View Dialog â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ViewDialog({
  mobile,
  open,
  onOpenChange,
  suppliers,
}: {
  mobile: Mobile | null
  open: boolean
  onOpenChange: (v: boolean) => void
  suppliers: Supplier[]
}) {
  if (!mobile) return null

  const m = mobile
  const supplier = suppliers.find(s => s.id === m.supplierId)
  const margin = calculateMargin(m.purchasePrice, m.sellingPrice)
  const stockStatus = getMobileStockStatus(m.stock)
  function handleCopyImei() {
    if (!m.imei) {
      toast.info("No IMEI recorded for this stock batch")
      return
    }
    navigator.clipboard.writeText(m.imei)
    toast.success("IMEI copied to clipboard")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Mobile Phone Details</DialogTitle>
          <DialogDescription>Full information for this device</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-blue-600 p-6 flex items-center gap-4 text-white">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-sm">{m.brand}</p>
            <h3 className="text-xl font-bold">{m.model}</h3>
            <p className="text-white/70 text-sm mt-0.5">{m.color} - {m.storage} / {m.ram}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-400 text-xs mb-1">IMEI</p>
            <div className="flex items-center gap-1">
            <span className="font-mono text-slate-700 text-xs">{m.imei || "Not recorded"}</span>
              <button onClick={handleCopyImei} className="text-slate-400 hover:text-slate-600">
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-400 text-xs mb-1">Condition</p>
            <StatusBadge status={m.condition} />
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-400 text-xs mb-1">Purchase Price</p>
            <p className="font-semibold text-slate-700">{formatCurrency(m.purchasePrice)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-400 text-xs mb-1">Selling Price</p>
            <p className="font-bold text-slate-900">{formatCurrency(m.sellingPrice)}</p>
          </div>
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-slate-400 text-xs mb-1">Margin</p>
            <p className="font-bold text-blue-700">{margin.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-400 text-xs mb-1">Stock</p>
            <div className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", stockDotColor[stockStatus])} />
              <span className="font-medium text-slate-700">{m.stock} units</span>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-400 text-xs mb-1">Category</p>
            <p className="font-medium text-slate-700">{m.category}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-400 text-xs mb-1">Device Type</p>
            <p className={cn("font-bold text-sm", m.deviceType === "iphone" ? "text-slate-900" : "text-green-700")}>
              {m.deviceType === "iphone" ? " iPhone" : " Android"}
            </p>
          </div>
          {m.batteryHealth != null && (
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-slate-400 text-xs mb-1">Battery Health</p>
              <p className="font-medium text-slate-700">{m.batteryHealth}%</p>
            </div>
          )}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-400 text-xs mb-1">Date Added</p>
            <p className="font-medium text-slate-700">{format(new Date(m.dateAdded), "dd MMM yyyy")}</p>
          </div>
          {supplier && (
            <div className="col-span-2 rounded-lg bg-slate-50 p-3">
              <p className="text-slate-400 text-xs mb-1">Supplier</p>
              <p className="font-medium text-slate-700">{supplier.companyName}</p>
              <p className="text-xs text-slate-400">{supplier.contactPerson} - {supplier.phone}</p>
            </div>
          )}
          {m.notes && (
            <div className="col-span-2 rounded-lg bg-slate-50 p-3">
              <p className="text-slate-400 text-xs mb-1">Notes</p>
              <p className="text-slate-600 text-sm">{m.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// â"€â"€â"€ Add/Edit Drawer â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€


interface IPhoneFormState {
  model: string; color: string; storage: string; batteryHealth: string
  condition: string; imei: string; faceIdWorking: boolean; iCloudLocked: boolean
  category: string; notes: string
}

const defaultIPhoneForm: IPhoneFormState = {
  model: "", color: "", storage: "", batteryHealth: "100",
  condition: "New", imei: "", faceIdWorking: true, iCloudLocked: false,
  category: "", notes: "",
}

function MobileFormDrawer({
  open,
  onOpenChange,
  editingMobile,
  onSubmit,
  suppliers,
  brands,
  onAddBrand,
  colors,
  onAddColor,
  mobileCategories,
  onAddMobileCategory,
  onAddSupplier,
  androidModels,
  onAddAndroidModel,
  iphoneModels,
  onAddIphoneModel,
  storageOptions,
  onAddStorage,
  ramOptions,
  onAddRam,
  conditions,
  onAddCondition,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editingMobile: Mobile | null
  onSubmit: (data: MobileFormOutput, imageUrl: string, deviceType: "android" | "iphone") => Promise<void> | void
  suppliers: Supplier[]
  brands: string[]
  onAddBrand: (name: string) => Promise<boolean>
  colors: string[]
  onAddColor: (name: string) => Promise<boolean>
  mobileCategories: string[]
  onAddMobileCategory: (name: string) => Promise<boolean>
  onAddSupplier: (name: string, phone: string) => Promise<Supplier | null>
  androidModels: string[]
  onAddAndroidModel: (name: string) => Promise<boolean>
  iphoneModels: string[]
  onAddIphoneModel: (name: string) => Promise<boolean>
  storageOptions: string[]
  onAddStorage: (name: string) => Promise<boolean>
  ramOptions: string[]
  onAddRam: (name: string) => Promise<boolean>
  conditions: string[]
  onAddCondition: (name: string) => Promise<boolean>
}) {
  const isEditing = !!editingMobile
  const [deviceType, setDeviceType] = useState<"android" | "iphone">("android")
  const [imageUrl, setImageUrl] = useState<string>(editingMobile?.image ?? "")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showNewBrand, setShowNewBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState("")
  const [addingBrand, setAddingBrand] = useState(false)
  const [showNewColor, setShowNewColor] = useState(false)
  const [newColorName, setNewColorName] = useState("")
  const [addingColor, setAddingColor] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [addingCategory, setAddingCategory] = useState(false)
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierPhone, setNewSupplierPhone] = useState("")
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [showNewAndroidModel, setShowNewAndroidModel] = useState(false)
  const [newAndroidModelName, setNewAndroidModelName] = useState("")
  const [addingAndroidModel, setAddingAndroidModel] = useState(false)
  const [showNewIphoneModel, setShowNewIphoneModel] = useState(false)
  const [newIphoneModelName, setNewIphoneModelName] = useState("")
  const [addingIphoneModel, setAddingIphoneModel] = useState(false)
  const [showNewStorage, setShowNewStorage] = useState(false)
  const [newStorageName, setNewStorageName] = useState("")
  const [addingStorage, setAddingStorage] = useState(false)
  const [showNewRam, setShowNewRam] = useState(false)
  const [newRamName, setNewRamName] = useState("")
  const [addingRam, setAddingRam] = useState(false)
  const [showNewIphoneColor, setShowNewIphoneColor] = useState(false)
  const [newIphoneColorName, setNewIphoneColorName] = useState("")
  const [addingIphoneColor, setAddingIphoneColor] = useState(false)
  const [showNewCondition, setShowNewCondition] = useState(false)
  const [newConditionName, setNewConditionName] = useState("")
  const [addingCondition, setAddingCondition] = useState(false)
  const [showNewIphoneCondition, setShowNewIphoneCondition] = useState(false)
  const [newIphoneConditionName, setNewIphoneConditionName] = useState("")
  const [addingIphoneCondition, setAddingIphoneCondition] = useState(false)
  const [showNewIphoneCategory, setShowNewIphoneCategory] = useState(false)
  const [newIphoneCategoryName, setNewIphoneCategoryName] = useState("")
  const [addingIphoneCategory, setAddingIphoneCategory] = useState(false)
  const [ip, setIp] = useState<IPhoneFormState>(defaultIPhoneForm)
  const [ipErrors, setIpErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setImageUrl(editingMobile?.image ?? "")
    if (editingMobile?.deviceType === "iphone" || editingMobile?.brand === "Apple") {
      setDeviceType("iphone")
      setIp({
        ...defaultIPhoneForm,
        model: editingMobile.model,
        color: editingMobile.color,
        storage: editingMobile.storage,
        condition: editingMobile.condition === "New" ? "New" : "Good",
        imei: editingMobile.imei,
        category: editingMobile.category,
        notes: editingMobile.notes ?? "",
      })
    } else {
      setDeviceType("android")
    }
  }, [editingMobile])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImageUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setImageUrl("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const {
    register,
    handleSubmit: handleAndroidSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MobileFormInput, unknown, MobileFormOutput>({
    resolver: zodResolver(mobileSchema) as never,
    defaultValues: editingMobile && editingMobile.brand !== "Apple"
      ? {
          brand: editingMobile.brand, model: editingMobile.model,
          color: editingMobile.color, storage: editingMobile.storage, ram: editingMobile.ram,
          condition: editingMobile.condition, category: editingMobile.category,
          notes: editingMobile.notes ?? "",
        }
      : {
          brand: "", model: "", color: "", storage: "", ram: "",
          condition: "New" as const, category: "Mid-Range" as const, notes: "",
        },
  })

  // price/stock set via Purchase page - no live margin in catalog form

  function handleClose() {
    reset()
    setImageUrl("")
    setIp(defaultIPhoneForm)
    setIpErrors({})
    setStagedPhones([])
    if (fileInputRef.current) fileInputRef.current.value = ""
    onOpenChange(false)
  }

  // â"€â"€ Batch staging â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  type StagedPhone = { data: MobileFormOutput; imageUrl: string; deviceType: "android" | "iphone" }
  const [stagedPhones, setStagedPhones] = useState<StagedPhone[]>([])

  function stagePhone(data: MobileFormOutput, imgUrl: string, dt: "android" | "iphone") {
    setStagedPhones(prev => [...prev, { data, imageUrl: imgUrl, deviceType: dt }])
    // Reset form but keep brand for quick repeated entry
    const keepBrand = data.brand
    reset({ brand: keepBrand, model: "", color: "", storage: "", ram: "", condition: "", category: "", notes: "" })
    setIp({ ...defaultIPhoneForm })
    setImageUrl("")
    toast.success(`${data.brand} ${data.model} staged - add another or save all`)
  }

  async function saveAll(current?: StagedPhone) {
    const all = current ? [...stagedPhones, current] : stagedPhones
    if (all.length === 0) return
    for (const p of all) {
      await onSubmit(p.data, p.imageUrl, p.deviceType)
    }
    setStagedPhones([])
    handleClose()
  }

  function onAndroidValid(data: MobileFormOutput) {
    if (stagedPhones.length > 0) {
      saveAll({ data, imageUrl, deviceType: "android" })
    } else {
      onSubmit(data, imageUrl, "android")
      handleClose()
    }
  }

  function onAndroidStage(data: MobileFormOutput) {
    stagePhone(data, imageUrl, "android")
  }

  function buildIPhoneData(): MobileFormOutput {
    const condMap: Record<string, "New" | "Refurbished" | "Used"> = {
      New: "New", Excellent: "Refurbished", Good: "Refurbished", Fair: "Used", Poor: "Used",
    }
    const noteParts = [
      ip.batteryHealth ? `Battery Health: ${ip.batteryHealth}%` : "",
      `Face ID: ${ip.faceIdWorking ? "Working" : "Not Working"}`,
      `iCloud: ${ip.iCloudLocked ? "Locked" : "Unlocked"}`,
      ip.notes,
    ].filter(Boolean).join(" | ")
    return {
      brand: "Apple", model: ip.model, imei: ip.imei.trim(), color: ip.color,
      storage: ip.storage, ram: "N/A",
      purchasePrice: 0, sellingPrice: 0, supplierId: "", stock: 0,
      condition: condMap[ip.condition] ?? "New", category: ip.category,
      notes: noteParts || undefined,
    }
  }

  function validateIPhone(): boolean {
    const errs: Record<string, string> = {}
    if (!ip.model) errs.model = "Model is required"
    if (!ip.color) errs.color = "Color is required"
    if (!ip.storage) errs.storage = "Storage is required"
    if (ip.imei && !/^\d{15}$/.test(ip.imei)) errs.imei = "IMEI must be 15 digits when provided"
    if (Object.keys(errs).length > 0) { setIpErrors(errs); return false }
    return true
  }

  function handleIPhoneSubmit() {
    if (!validateIPhone()) return
    const data = buildIPhoneData()
    if (stagedPhones.length > 0) {
      saveAll({ data, imageUrl, deviceType: "iphone" })
    } else {
      onSubmit(data, imageUrl, "iphone")
      handleClose()
    }
  }

  function handleIPhoneStage() {
    if (!validateIPhone()) return
    stagePhone(buildIPhoneData(), imageUrl, "iphone")
  }

  function upIp<K extends keyof IPhoneFormState>(key: K, val: IPhoneFormState[K]) {
    setIp(prev => ({ ...prev, [key]: val }))
    if (ipErrors[key]) setIpErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  const activeSuppliers = suppliers.filter(s => s.status === "Active")

  const marginBar = (m: number) => cn(
    "flex items-center justify-between rounded-lg px-4 py-2.5 border",
    m >= 25 ? "bg-emerald-50 border-emerald-200" : m >= 15 ? "bg-blue-50 border-blue-200" :
    m >= 0  ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"
  )
  const marginText = (m: number) => cn("text-lg font-bold",
    m >= 25 ? "text-emerald-700" : m >= 15 ? "text-blue-700" : m >= 0 ? "text-amber-700" : "text-red-700"
  )

  const imgUploadArea = (
    <div className="p-4">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {imageUrl ? (
        <div className="relative group w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          <Image src={imageUrl} alt="Device preview" fill className="object-contain p-3" sizes="100vw" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-slate-700 shadow hover:bg-slate-100">
              <Upload className="w-3.5 h-3.5" /> Change
            </button>
            <button type="button" onClick={removeImage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 rounded-lg text-xs font-semibold text-white shadow hover:bg-red-600">
              <XIcon className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="w-full h-36 rounded-xl border-2 border-dashed border-slate-200 hover:border-pink-400 bg-slate-50 hover:bg-pink-50/40 flex flex-col items-center justify-center gap-2 transition-colors group">
          <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-pink-100 flex items-center justify-center">
            <Upload className="w-5 h-5 text-slate-400 group-hover:text-pink-500" />
          </div>
          <p className="text-sm font-medium text-slate-500 group-hover:text-pink-600">Click to upload image</p>
          <p className="text-xs text-slate-400">PNG, JPG, WEBP - up to 5 MB</p>
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full sm:w-[700px] bg-white z-50 shadow-2xl flex flex-col",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* â"€â"€ Header â"€â"€ */}
        <div className={cn(
          "shrink-0 px-6 py-4",
          isEditing ? "bg-gradient-to-r from-blue-500 to-indigo-600" : "bg-gradient-to-r from-emerald-500 to-teal-600"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Pencil className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">Edit Mobile Phone</h2>
                <p className="text-xs text-white/70 mt-0.5">Update details for this catalog entry.</p>
              </div>
            </div>
            <button type="button" onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <XIcon className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* â"€â"€ Android / iPhone tabs â"€â"€ */}
          <div className="flex gap-2 bg-white/10 rounded-xl p-1">
            <button type="button" onClick={() => setDeviceType("android")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                deviceType === "android" ? "bg-white text-slate-800 shadow-sm" : "text-white/70 hover:text-white"
              )}>
              <Smartphone className="w-4 h-4" /> Android
            </button>
            <button type="button" onClick={() => setDeviceType("iphone")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all",
                deviceType === "iphone" ? "bg-white text-slate-800 shadow-sm" : "text-white/70 hover:text-white"
              )}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              iPhone
            </button>
          </div>
        </div>

        {/* â"€â"€ Scrollable body â"€â"€ */}
        <div className="flex-1 overflow-y-auto">

          {/* â•â• ANDROID FORM â•â• */}
          {deviceType === "android" && (
            <form id="android-form" onSubmit={handleAndroidSubmit(onAndroidValid)} className="p-3 sm:p-5 space-y-4 overflow-x-hidden">

              {/* Device Identity */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Device Identity</span>
                </div>
                <div className="p-3 sm:p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Tag className="w-3 h-3" /> Brand <span className="text-red-500">*</span>
                      </Label>
                      {(() => {
                        const dbBrands = brands.filter(b => b !== "Apple")
                        const allAndroidBrands = Array.from(new Set([
                          ...MASTER_BRAND_NAMES.filter(b => b !== "Apple"),
                          ...dbBrands,
                        ])).sort()
                        return (
                          <SearchableSelect
                            value={watch("brand") ?? ""}
                            onChange={val => {
                              setValue("brand", val, { shouldValidate: true })
                              setValue("model", "", { shouldValidate: false })
                            }}
                            options={allAndroidBrands}
                            placeholder="Search brand..."
                            allowCustom
                            customWarning="This brand is not in the standard list. It will be saved as entered."
                            onAddNew={async (name) => { await onAddBrand(name) }}
                            error={!!errors.brand}
                          />
                        )
                      })()}
                      {errors.brand && <p className="text-xs text-red-500">{errors.brand.message}</p>}
                    </div>
                    <div className={cn("space-y-1.5", showNewColor && "col-span-2")}>
                      <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Palette className="w-3 h-3" /> Color <span className="text-red-500">*</span>
                      </Label>
                      {!showNewColor ? (
                        <>
                          <Select value={watch("color") ?? ""}
                            onValueChange={val => setValue("color", val, { shouldValidate: true })}>
                            <SelectTrigger className={cn("bg-slate-50 h-9 text-sm", errors.color && "border-red-400")}>
                              <SelectValue placeholder="Color" />
                            </SelectTrigger>
                            <SelectContent>
                              {colors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => setShowNewColor(true)}
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add New Color
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input
                              placeholder="e.g. Midnight Blue"
                              value={newColorName}
                              onChange={e => setNewColorName(e.target.value)}
                              className="bg-slate-50 h-9 text-sm flex-1 min-w-0 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400"
                              autoFocus
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  if (!newColorName.trim()) return
                                  setAddingColor(true)
                                  const ok = await onAddColor(newColorName.trim())
                                  setAddingColor(false)
                                  if (ok) {
                                    setValue("color", newColorName.trim(), { shouldValidate: true })
                                    setNewColorName("")
                                    setShowNewColor(false)
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={!newColorName.trim() || addingColor}
                              className="h-9 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
                              onClick={async () => {
                                if (!newColorName.trim()) return
                                setAddingColor(true)
                                const ok = await onAddColor(newColorName.trim())
                                setAddingColor(false)
                                if (ok) {
                                  setValue("color", newColorName.trim(), { shouldValidate: true })
                                  setNewColorName("")
                                  setShowNewColor(false)
                                }
                              }}
                            >
                              {addingColor ? "..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="h-9 px-2 text-slate-400 hover:text-slate-600 shrink-0"
                              onClick={() => { setShowNewColor(false); setNewColorName("") }}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">Press Enter or click Save</p>
                        </div>
                      )}
                      {errors.color && <p className="text-xs text-red-500">{errors.color.message}</p>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Smartphone className="w-3 h-3" /> Model <span className="text-red-500">*</span>
                    </Label>
                    {(() => {
                      const selectedBrand = watch("brand") ?? ""
                      const brandEntry = MASTER_BRANDS.find(b => b.name.toLowerCase() === selectedBrand.toLowerCase())
                      const masterModels = brandEntry?.models ?? []
                      const allAndroidModels = Array.from(new Set([...masterModels, ...androidModels])).sort()
                      return (
                        <>
                          {!showNewAndroidModel ? (
                            <>
                              <SearchableSelect
                                value={watch("model") ?? ""}
                                onChange={val => setValue("model", val, { shouldValidate: true })}
                                options={allAndroidModels}
                                placeholder={selectedBrand ? `Search ${selectedBrand} model...` : "Select brand first"}
                                disabled={!selectedBrand}
                                allowCustom
                                customWarning="This model is not in the standard list. Double-check the spelling to avoid filter issues."
                                error={!!errors.model}
                              />
                              {selectedBrand && (
                                <button type="button" onClick={() => setShowNewAndroidModel(true)}
                                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors">
                                  <Plus className="w-3 h-3" /> Add New Model
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex gap-1.5">
                                <input
                                  placeholder={`e.g. ${selectedBrand ? selectedBrand + " " : ""}Note 50 Pro`}
                                  value={newAndroidModelName}
                                  onChange={e => setNewAndroidModelName(e.target.value)}
                                  className="bg-slate-50 h-9 text-sm flex-1 min-w-0 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400"
                                  autoFocus
                                  onKeyDown={async (e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault()
                                      if (!newAndroidModelName.trim()) return
                                      setAddingAndroidModel(true)
                                      const ok = await onAddAndroidModel(newAndroidModelName.trim())
                                      setAddingAndroidModel(false)
                                      if (ok) {
                                        setValue("model", newAndroidModelName.trim(), { shouldValidate: true })
                                        setNewAndroidModelName("")
                                        setShowNewAndroidModel(false)
                                      }
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  disabled={!newAndroidModelName.trim() || addingAndroidModel}
                                  className="h-9 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
                                  onClick={async () => {
                                    if (!newAndroidModelName.trim()) return
                                    setAddingAndroidModel(true)
                                    const ok = await onAddAndroidModel(newAndroidModelName.trim())
                                    setAddingAndroidModel(false)
                                    if (ok) {
                                      setValue("model", newAndroidModelName.trim(), { shouldValidate: true })
                                      setNewAndroidModelName("")
                                      setShowNewAndroidModel(false)
                                    }
                                  }}
                                >
                                  {addingAndroidModel ? "..." : "Save"}
                                </button>
                                <button type="button"
                                  className="h-9 px-2 text-slate-400 hover:text-slate-600 shrink-0"
                                  onClick={() => { setShowNewAndroidModel(false); setNewAndroidModelName("") }}>
                                  <XIcon className="w-4 h-4" />
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-400">Press Enter or click Save - model will be added to your list</p>
                            </div>
                          )}
                        </>
                      )
                    })()}
                    {errors.model && <p className="text-xs text-red-500">{errors.model.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={cn("space-y-1.5", showNewCondition && "col-span-2")}>
                      <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Layers className="w-3 h-3" /> Condition <span className="text-red-500">*</span>
                      </Label>
                      {!showNewCondition ? (
                        <>
                          <Select value={watch("condition") ?? ""}
                            onValueChange={val => setValue("condition", val, { shouldValidate: true })}>
                            <SelectTrigger className={cn("bg-slate-50 h-9 text-sm", errors.condition && "border-red-400")}>
                              <SelectValue placeholder="Condition" />
                            </SelectTrigger>
                            <SelectContent>
                              {conditions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button type="button" onClick={() => setShowNewCondition(true)}
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors">
                            <Plus className="w-3 h-3" /> Add New Condition
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input placeholder="e.g. Like New" value={newConditionName} onChange={e => setNewConditionName(e.target.value)}
                              className="bg-slate-50 h-9 text-sm flex-1 min-w-0 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400" autoFocus
                              onKeyDown={async (e) => { if (e.key === "Enter") { e.preventDefault(); if (!newConditionName.trim()) return; setAddingCondition(true); const ok = await onAddCondition(newConditionName.trim()); setAddingCondition(false); if (ok) { setValue("condition", newConditionName.trim(), { shouldValidate: true }); setNewConditionName(""); setShowNewCondition(false); } } }} />
                            <button type="button" disabled={!newConditionName.trim() || addingCondition}
                              className="h-9 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
                              onClick={async () => { if (!newConditionName.trim()) return; setAddingCondition(true); const ok = await onAddCondition(newConditionName.trim()); setAddingCondition(false); if (ok) { setValue("condition", newConditionName.trim(), { shouldValidate: true }); setNewConditionName(""); setShowNewCondition(false); } }}>
                              {addingCondition ? "..." : "Save"}
                            </button>
                            <button type="button" className="h-9 px-2 text-slate-400 hover:text-slate-600 shrink-0"
                              onClick={() => { setShowNewCondition(false); setNewConditionName("") }}>
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">Press Enter or click Save</p>
                        </div>
                      )}
                      {errors.condition && <p className="text-xs text-red-500">{errors.condition.message}</p>}
                    </div>
                    <div className={cn("space-y-1.5", showNewCategory && "col-span-2")}>
                      <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Layers className="w-3 h-3" /> Category <span className="text-red-500">*</span>
                      </Label>
                      {!showNewCategory ? (
                        <>
                          <Select value={watch("category") ?? ""}
                            onValueChange={val => setValue("category", val, { shouldValidate: true })}>
                            <SelectTrigger className={cn("bg-slate-50 h-9 text-sm", errors.category && "border-red-400")}>
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {mobileCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => setShowNewCategory(true)}
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add New Category
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input
                              placeholder="e.g. Gaming"
                              value={newCategoryName}
                              onChange={e => setNewCategoryName(e.target.value)}
                              className="bg-slate-50 h-9 text-sm flex-1 min-w-0 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400"
                              autoFocus
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  if (!newCategoryName.trim()) return
                                  setAddingCategory(true)
                                  const ok = await onAddMobileCategory(newCategoryName.trim())
                                  setAddingCategory(false)
                                  if (ok) {
                                    setValue("category", newCategoryName.trim(), { shouldValidate: true })
                                    setNewCategoryName("")
                                    setShowNewCategory(false)
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={!newCategoryName.trim() || addingCategory}
                              className="h-9 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
                              onClick={async () => {
                                if (!newCategoryName.trim()) return
                                setAddingCategory(true)
                                const ok = await onAddMobileCategory(newCategoryName.trim())
                                setAddingCategory(false)
                                if (ok) {
                                  setValue("category", newCategoryName.trim(), { shouldValidate: true })
                                  setNewCategoryName("")
                                  setShowNewCategory(false)
                                }
                              }}
                            >
                              {addingCategory ? "..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="h-9 px-2 text-slate-400 hover:text-slate-600 shrink-0"
                              onClick={() => { setShowNewCategory(false); setNewCategoryName("") }}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">Press Enter or click Save</p>
                        </div>
                      )}
                      {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Device Image */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-pink-50 border-b border-pink-100">
                  <ImageIcon className="w-3.5 h-3.5 text-pink-600" />
                  <span className="text-[11px] font-bold text-pink-700 uppercase tracking-wider">Device Image</span>
                  <span className="text-[10px] text-pink-400 ml-1">(optional)</span>
                </div>
                {imgUploadArea}
              </div>

              {/* Specs */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border-b border-indigo-100">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Specs</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className={cn("space-y-1.5", showNewStorage && "col-span-2")}>
                      <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <HardDrive className="w-3 h-3" /> Storage <span className="text-red-500">*</span>
                      </Label>
                      {!showNewStorage ? (
                        <>
                          <Select value={watch("storage") ?? ""}
                            onValueChange={val => setValue("storage", val, { shouldValidate: true })}>
                            <SelectTrigger className={cn("bg-slate-50 h-9 text-sm", errors.storage && "border-red-400")}>
                              <SelectValue placeholder="Storage" />
                            </SelectTrigger>
                            <SelectContent>
                              {storageOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => setShowNewStorage(true)}
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add New Storage
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input
                              placeholder="e.g. 256GB"
                              value={newStorageName}
                              onChange={e => setNewStorageName(e.target.value)}
                              className="bg-slate-50 h-9 text-sm flex-1 min-w-0 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400"
                              autoFocus
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  if (!newStorageName.trim()) return
                                  setAddingStorage(true)
                                  const ok = await onAddStorage(newStorageName.trim())
                                  setAddingStorage(false)
                                  if (ok) {
                                    setValue("storage", newStorageName.trim(), { shouldValidate: true })
                                    setNewStorageName("")
                                    setShowNewStorage(false)
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={!newStorageName.trim() || addingStorage}
                              className="h-9 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
                              onClick={async () => {
                                if (!newStorageName.trim()) return
                                setAddingStorage(true)
                                const ok = await onAddStorage(newStorageName.trim())
                                setAddingStorage(false)
                                if (ok) {
                                  setValue("storage", newStorageName.trim(), { shouldValidate: true })
                                  setNewStorageName("")
                                  setShowNewStorage(false)
                                }
                              }}
                            >
                              {addingStorage ? "..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="h-9 px-2 text-slate-400 hover:text-slate-600 shrink-0"
                              onClick={() => { setShowNewStorage(false); setNewStorageName("") }}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">Press Enter or click Save</p>
                        </div>
                      )}
                      {errors.storage && <p className="text-xs text-red-500">{errors.storage.message}</p>}
                    </div>
                    <div className={cn("space-y-1.5", showNewRam && "col-span-2")}>
                      <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Cpu className="w-3 h-3" /> RAM <span className="text-red-500">*</span>
                      </Label>
                      {!showNewRam ? (
                        <>
                          <Select value={watch("ram") ?? ""}
                            onValueChange={val => setValue("ram", val, { shouldValidate: true })}>
                            <SelectTrigger className={cn("bg-slate-50 h-9 text-sm", errors.ram && "border-red-400")}>
                              <SelectValue placeholder="RAM" />
                            </SelectTrigger>
                            <SelectContent>
                              {ramOptions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => setShowNewRam(true)}
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add New RAM
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input
                              placeholder="e.g. 16GB"
                              value={newRamName}
                              onChange={e => setNewRamName(e.target.value)}
                              className="bg-slate-50 h-9 text-sm flex-1 min-w-0 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400"
                              autoFocus
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  if (!newRamName.trim()) return
                                  setAddingRam(true)
                                  const ok = await onAddRam(newRamName.trim())
                                  setAddingRam(false)
                                  if (ok) {
                                    setValue("ram", newRamName.trim(), { shouldValidate: true })
                                    setNewRamName("")
                                    setShowNewRam(false)
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={!newRamName.trim() || addingRam}
                              className="h-9 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
                              onClick={async () => {
                                if (!newRamName.trim()) return
                                setAddingRam(true)
                                const ok = await onAddRam(newRamName.trim())
                                setAddingRam(false)
                                if (ok) {
                                  setValue("ram", newRamName.trim(), { shouldValidate: true })
                                  setNewRamName("")
                                  setShowNewRam(false)
                                }
                              }}
                            >
                              {addingRam ? "..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="h-9 px-2 text-slate-400 hover:text-slate-600 shrink-0"
                              onClick={() => { setShowNewRam(false); setNewRamName("") }}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">Press Enter or click Save</p>
                        </div>
                      )}
                      {errors.ram && <p className="text-xs text-red-500">{errors.ram.message}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-b border-violet-100">
                  <FileText className="w-3.5 h-3.5 text-violet-600" />
                  <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Notes</span>
                </div>
                <div className="p-4">
                  <Textarea placeholder="Any additional notes about this phone..." rows={2} {...register("notes")}
                    className="bg-slate-50 text-sm resize-none" />
                  <p className="text-[11px] text-slate-400 mt-1.5">Price and stock are set when you purchase this phone from a supplier.</p>
                </div>
              </div>
            </form>
          )}

          {/* â•â• IPHONE FORM â•â• */}
          {deviceType === "iphone" && (
            <div className="p-5 space-y-4">

              {/* iPhone Identity */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
                  <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">iPhone Identity</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Smartphone className="w-3 h-3" /> iPhone Model <span className="text-red-500">*</span>
                    </Label>
                    {(() => {
                      const allIphoneModels = Array.from(new Set([...APPLE_MODELS, ...iphoneModels]));
                      return (
                        <SearchableSelect
                          value={ip.model}
                          onChange={val => upIp("model", val)}
                          options={allIphoneModels}
                          placeholder="Search iPhone model..."
                          allowCustom
                          customWarning="This model is not in the standard list. Double-check spelling to avoid filter issues."
                          onAddNew={async (name) => { await onAddIphoneModel(name) }}
                          error={!!ipErrors.model}
                        />
                      )
                    })()}
                    {ipErrors.model && <p className="text-xs text-red-500">{ipErrors.model}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={cn("space-y-1.5", showNewIphoneColor && "col-span-2")}>
                      <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Palette className="w-3 h-3" /> Color <span className="text-red-500">*</span>
                      </Label>
                      {!showNewIphoneColor ? (
                        <>
                          <Select value={ip.color} onValueChange={val => upIp("color", val)}>
                            <SelectTrigger className={cn("bg-slate-50 h-9 text-sm", ipErrors.color && "border-red-400")}>
                              <SelectValue placeholder="Select color" />
                            </SelectTrigger>
                            <SelectContent>
                              {colors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => setShowNewIphoneColor(true)}
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add New Color
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input
                              placeholder="e.g. Desert Titanium"
                              value={newIphoneColorName}
                              onChange={e => setNewIphoneColorName(e.target.value)}
                              className="bg-slate-50 h-9 text-sm flex-1 min-w-0 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400"
                              autoFocus
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  if (!newIphoneColorName.trim()) return
                                  setAddingIphoneColor(true)
                                  const ok = await onAddColor(newIphoneColorName.trim())
                                  setAddingIphoneColor(false)
                                  if (ok) {
                                    upIp("color", newIphoneColorName.trim())
                                    setNewIphoneColorName("")
                                    setShowNewIphoneColor(false)
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={!newIphoneColorName.trim() || addingIphoneColor}
                              className="h-9 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
                              onClick={async () => {
                                if (!newIphoneColorName.trim()) return
                                setAddingIphoneColor(true)
                                const ok = await onAddColor(newIphoneColorName.trim())
                                setAddingIphoneColor(false)
                                if (ok) {
                                  upIp("color", newIphoneColorName.trim())
                                  setNewIphoneColorName("")
                                  setShowNewIphoneColor(false)
                                }
                              }}
                            >
                              {addingIphoneColor ? "..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="h-9 px-2 text-slate-400 hover:text-slate-600 shrink-0"
                              onClick={() => { setShowNewIphoneColor(false); setNewIphoneColorName("") }}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">Press Enter or click Save</p>
                        </div>
                      )}
                      {ipErrors.color && <p className="text-xs text-red-500">{ipErrors.color}</p>}
                    </div>
                    <div className={cn("space-y-1.5", showNewStorage && "col-span-2")}>
                      <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <HardDrive className="w-3 h-3" /> Storage <span className="text-red-500">*</span>
                      </Label>
                      {!showNewStorage ? (
                        <>
                          <Select value={ip.storage} onValueChange={val => upIp("storage", val)}>
                            <SelectTrigger className={cn("bg-slate-50 h-9 text-sm", ipErrors.storage && "border-red-400")}>
                              <SelectValue placeholder="Storage" />
                            </SelectTrigger>
                            <SelectContent>
                              {storageOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button
                            type="button"
                            onClick={() => setShowNewStorage(true)}
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors"
                          >
                            <Plus className="w-3 h-3" /> Add New Storage
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input
                              placeholder="e.g. 256GB"
                              value={newStorageName}
                              onChange={e => setNewStorageName(e.target.value)}
                              className="bg-slate-50 h-9 text-sm flex-1 min-w-0 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400"
                              autoFocus
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  if (!newStorageName.trim()) return
                                  setAddingStorage(true)
                                  const ok = await onAddStorage(newStorageName.trim())
                                  setAddingStorage(false)
                                  if (ok) {
                                    upIp("storage", newStorageName.trim())
                                    setNewStorageName("")
                                    setShowNewStorage(false)
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              disabled={!newStorageName.trim() || addingStorage}
                              className="h-9 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
                              onClick={async () => {
                                if (!newStorageName.trim()) return
                                setAddingStorage(true)
                                const ok = await onAddStorage(newStorageName.trim())
                                setAddingStorage(false)
                                if (ok) {
                                  upIp("storage", newStorageName.trim())
                                  setNewStorageName("")
                                  setShowNewStorage(false)
                                }
                              }}
                            >
                              {addingStorage ? "..." : "Save"}
                            </button>
                            <button
                              type="button"
                              className="h-9 px-2 text-slate-400 hover:text-slate-600 shrink-0"
                              onClick={() => { setShowNewStorage(false); setNewStorageName("") }}
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">Press Enter or click Save</p>
                        </div>
                      )}
                      {ipErrors.storage && <p className="text-xs text-red-500">{ipErrors.storage}</p>}
                    </div>
                    <div className={cn("space-y-1.5", showNewIphoneCondition && "col-span-2")}>
                      <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Layers className="w-3 h-3" /> Condition <span className="text-red-500">*</span>
                      </Label>
                      {!showNewIphoneCondition ? (
                        <>
                          <Select value={ip.condition} onValueChange={val => upIp("condition", val)}>
                            <SelectTrigger className="bg-slate-50 h-9 text-sm"><SelectValue placeholder="Condition" /></SelectTrigger>
                            <SelectContent>
                              {conditions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button type="button" onClick={() => setShowNewIphoneCondition(true)}
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors">
                            <Plus className="w-3 h-3" /> Add New Condition
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input placeholder="e.g. Like New" value={newIphoneConditionName} onChange={e => setNewIphoneConditionName(e.target.value)}
                              className="bg-slate-50 h-9 text-sm flex-1 min-w-0 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400" autoFocus
                              onKeyDown={async (e) => { if (e.key === "Enter") { e.preventDefault(); if (!newIphoneConditionName.trim()) return; setAddingIphoneCondition(true); const ok = await onAddCondition(newIphoneConditionName.trim()); setAddingIphoneCondition(false); if (ok) { upIp("condition", newIphoneConditionName.trim()); setNewIphoneConditionName(""); setShowNewIphoneCondition(false); } } }} />
                            <button type="button" disabled={!newIphoneConditionName.trim() || addingIphoneCondition}
                              className="h-9 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
                              onClick={async () => { if (!newIphoneConditionName.trim()) return; setAddingIphoneCondition(true); const ok = await onAddCondition(newIphoneConditionName.trim()); setAddingIphoneCondition(false); if (ok) { upIp("condition", newIphoneConditionName.trim()); setNewIphoneConditionName(""); setShowNewIphoneCondition(false); } }}>
                              {addingIphoneCondition ? "..." : "Save"}
                            </button>
                            <button type="button" className="h-9 px-2 text-slate-400 hover:text-slate-600 shrink-0"
                              onClick={() => { setShowNewIphoneCondition(false); setNewIphoneConditionName("") }}>
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">Press Enter or click Save</p>
                        </div>
                      )}
                    </div>
                    <div className={cn("space-y-1.5", showNewIphoneCategory && "col-span-2")}>
                      <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Layers className="w-3 h-3" /> Category <span className="text-red-500">*</span>
                      </Label>
                      {!showNewIphoneCategory ? (
                        <>
                          <Select value={ip.category} onValueChange={val => upIp("category", val)}>
                            <SelectTrigger className="bg-slate-50 h-9 text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
                            <SelectContent>
                              {mobileCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button type="button" onClick={() => setShowNewIphoneCategory(true)}
                            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors">
                            <Plus className="w-3 h-3" /> Add New Category
                          </button>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex gap-1.5">
                            <input placeholder="e.g. Premium" value={newIphoneCategoryName} onChange={e => setNewIphoneCategoryName(e.target.value)}
                              className="bg-slate-50 h-9 text-sm flex-1 min-w-0 rounded-md border border-slate-200 px-3 outline-none focus:border-blue-400" autoFocus
                              onKeyDown={async (e) => { if (e.key === "Enter") { e.preventDefault(); if (!newIphoneCategoryName.trim()) return; setAddingIphoneCategory(true); const ok = await onAddMobileCategory(newIphoneCategoryName.trim()); setAddingIphoneCategory(false); if (ok) { upIp("category", newIphoneCategoryName.trim()); setNewIphoneCategoryName(""); setShowNewIphoneCategory(false); } } }} />
                            <button type="button" disabled={!newIphoneCategoryName.trim() || addingIphoneCategory}
                              className="h-9 px-3 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 shrink-0"
                              onClick={async () => { if (!newIphoneCategoryName.trim()) return; setAddingIphoneCategory(true); const ok = await onAddMobileCategory(newIphoneCategoryName.trim()); setAddingIphoneCategory(false); if (ok) { upIp("category", newIphoneCategoryName.trim()); setNewIphoneCategoryName(""); setShowNewIphoneCategory(false); } }}>
                              {addingIphoneCategory ? "..." : "Save"}
                            </button>
                            <button type="button" className="h-9 px-2 text-slate-400 hover:text-slate-600 shrink-0"
                              onClick={() => { setShowNewIphoneCategory(false); setNewIphoneCategoryName("") }}>
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400">Press Enter or click Save</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Device Image */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-pink-50 border-b border-pink-100">
                  <ImageIcon className="w-3.5 h-3.5 text-pink-600" />
                  <span className="text-[11px] font-bold text-pink-700 uppercase tracking-wider">Device Image</span>
                  <span className="text-[10px] text-pink-400 ml-1">(optional)</span>
                </div>
                {imgUploadArea}
              </div>

              {/* iPhone Specifics */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
                  <Cpu className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">iPhone Specifics</span>
                </div>
                <div className="p-4 space-y-4">

                  {/* Battery Health */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-600">Battery Health</Label>
                      <span className={cn("text-sm font-black px-3 py-0.5 rounded-full",
                        parseInt(ip.batteryHealth) >= 85 ? "bg-emerald-100 text-emerald-700" :
                        parseInt(ip.batteryHealth) >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      )}>{ip.batteryHealth || 0}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="range" min={1} max={100} value={ip.batteryHealth || "100"}
                        onChange={e => upIp("batteryHealth", e.target.value)} className="flex-1 accent-blue-600" />
                      <Input type="number" onWheel={e => e.currentTarget.blur()} min={1} max={100} value={ip.batteryHealth}
                        onChange={e => upIp("batteryHealth", e.target.value)} className="w-20 h-8 text-sm text-center font-bold" />
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all",
                        parseInt(ip.batteryHealth) >= 85 ? "bg-emerald-500" :
                        parseInt(ip.batteryHealth) >= 70 ? "bg-amber-500" : "bg-red-500"
                      )} style={{ width: `${ip.batteryHealth || 0}%` }} />
                    </div>
                  </div>

                  {/* IMEI */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Hash className="w-3 h-3" /> IMEI <span className="text-slate-400 font-normal">(optional)</span>
                    </Label>
                    <Input value={ip.imei}
                      onChange={e => upIp("imei", e.target.value.replace(/\D/g, "").slice(0, 15))}
                      placeholder="15-digit IMEI number" maxLength={15}
                      className={cn("bg-slate-50 h-9 text-sm font-mono", ipErrors.imei && "border-red-400")} />
                    {ipErrors.imei ? <p className="text-xs text-red-500">{ipErrors.imei}</p>
                      : <p className="text-[11px] text-slate-400">Settings â†' General â†' About â†' IMEI</p>}
                  </div>

                  {/* Face ID + iCloud toggles */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={cn("flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-colors",
                      ip.faceIdWorking ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}>
                      <div>
                        <p className="text-xs font-bold text-slate-700">Face ID</p>
                        <p className={cn("text-[10px] font-semibold", ip.faceIdWorking ? "text-emerald-600" : "text-red-500")}>
                          {ip.faceIdWorking ? "Working" : "Not Working"}
                        </p>
                      </div>
                      <button type="button" onClick={() => upIp("faceIdWorking", !ip.faceIdWorking)}
                        className={cn("w-12 h-6 rounded-full transition-colors relative shrink-0",
                          ip.faceIdWorking ? "bg-emerald-500" : "bg-slate-300")}>
                        <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                          ip.faceIdWorking ? "right-0.5" : "left-0.5")} />
                      </button>
                    </div>
                    <div className={cn("flex items-center justify-between rounded-xl border-2 px-4 py-3 transition-colors",
                      ip.iCloudLocked ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
                      <div>
                        <p className="text-xs font-bold text-slate-700">iCloud Lock</p>
                        <p className={cn("text-[10px] font-semibold", ip.iCloudLocked ? "text-red-500" : "text-emerald-600")}>
                          {ip.iCloudLocked ? "Locked" : "Unlocked"}
                        </p>
                      </div>
                      <button type="button" onClick={() => upIp("iCloudLocked", !ip.iCloudLocked)}
                        className={cn("w-12 h-6 rounded-full transition-colors relative shrink-0",
                          ip.iCloudLocked ? "bg-red-500" : "bg-emerald-500")}>
                        <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                          ip.iCloudLocked ? "right-0.5" : "left-0.5")} />
                      </button>
                    </div>
                  </div>
                  {ip.iCloudLocked && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-600 font-medium">iCloud locked - cannot activate without original Apple ID. Price accordingly.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-b border-violet-100">
                  <FileText className="w-3.5 h-3.5 text-violet-600" />
                  <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Notes</span>
                </div>
                <div className="p-4">
                  <Textarea placeholder="Any additional notes about this iPhone..." rows={2} value={ip.notes}
                    onChange={e => upIp("notes", e.target.value)} className="bg-slate-50 text-sm resize-none" />
                  <p className="text-[11px] text-slate-400 mt-1.5">Price and stock are set when you purchase this phone from a supplier.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* â"€â"€ Staged phones list â"€â"€ */}
        {stagedPhones.length > 0 && (
          <div className="shrink-0 border-t border-slate-200 bg-amber-50 px-5 py-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Staged - ready to save ({stagedPhones.length})</p>
            {stagedPhones.map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-white rounded-lg border border-amber-200 px-3 py-1.5 text-xs">
                <span className="font-medium text-slate-800">{p.data.brand} {p.data.model}</span>
                <span className="text-slate-400">{p.data.color} - {p.data.storage} - {p.data.condition}</span>
                <button type="button" onClick={() => setStagedPhones(prev => prev.filter((_, j) => j !== i))}
                  className="ml-2 text-slate-400 hover:text-red-500">âœ•</button>
              </div>
            ))}
          </div>
        )}

        {/* â"€â"€ Sticky footer â"€â"€ */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 flex items-center gap-3 flex-wrap">
          <Button type="button" variant="outline" onClick={handleClose} className="w-28">Cancel</Button>
          {!isEditing && (
            deviceType === "android" ? (
              <Button type="button" variant="outline"
                onClick={() => handleAndroidSubmit(onAndroidStage)()}
                className="border-amber-300 text-amber-700 hover:bg-amber-50">
                + Add Another
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={handleIPhoneStage}
                className="border-amber-300 text-amber-700 hover:bg-amber-50">
                + Add Another
              </Button>
            )
          )}
          {deviceType === "android" ? (
            <Button type="submit" form="android-form" disabled={isSubmitting}
              className={cn("ml-auto", isEditing ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700")}>
              {isEditing ? "Save Changes" : stagedPhones.length > 0 ? `Save All (${stagedPhones.length + 1})` : "Add Android Phone"}
            </Button>
          ) : (
            <Button type="button" onClick={handleIPhoneSubmit}
              className={cn("ml-auto", isEditing ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-800 hover:bg-slate-900")}>
              {isEditing ? "Save Changes" : stagedPhones.length > 0 ? `Save All (${stagedPhones.length + 1})` : "Add iPhone"}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}

// â"€â"€â"€ Main Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function MobilesPage() {
  const [mobileList, setMobileList] = useState<Mobile[]>([])
  const [supplierList, setSupplierList] = useState<Supplier[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [mobileCategories, setMobileCategories] = useState<string[]>([])
  const [androidModels, setAndroidModels] = useState<string[]>([])
  const [iphoneModels, setIphoneModels] = useState<string[]>([])
  const [storageOptions, setStorageOptions] = useState<string[]>([])
  const [ramOptions, setRamOptions] = useState<string[]>([])
  const [conditions, setConditions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"grid" | "table">("grid")
  const [search, setSearch] = useState("")
  const [brandFilter, setBrandFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [deviceTypeFilter, setDeviceTypeFilter] = useState("all")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMobile, setEditingMobile] = useState<Mobile | null>(null)
  const [viewMobile, setViewMobile] = useState<Mobile | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Mobile | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editSheetPurchaseId, setEditSheetPurchaseId] = useState<string | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)

  // â"€â"€â"€ Fetch brands from DB â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function fetchBrands() {
    try {
      const tenantId = await getTenantId()
      const { data } = await supabase
        .from("brands")
        .select("name")
        .eq("tenant_id", tenantId)
        .eq("status", "Active")
        .order("name")
      if (data) {
        setBrands(data.map((b: { name: string }) => b.name))
      }
    } catch {
      // empty
    }
  }

  async function handleAddBrand(name: string): Promise<boolean> {
    try {
      const tenantId = await getTenantId()
      const { error } = await supabase.from("brands").insert({
        tenant_id: tenantId,
        name: name.trim(),
        logo_initials: name.trim().substring(0, 2).toUpperCase(),
        status: "Active",
      })
      if (error) {
        toast.error("Failed to add brand: " + error.message)
        return false
      }
      setBrands(prev => Array.from(new Set([...prev, name.trim()])).sort())
      toast.success(`Brand "${name.trim()}" added!`)
      return true
    } catch {
      toast.error("Failed to add brand")
      return false
    }
  }

  // â"€â"€â"€ Fetch colors from DB â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function fetchColors() {
    try {
      const tenantId = await getTenantId()
      const { data } = await supabase
        .from("colors")
        .select("name")
        .eq("tenant_id", tenantId)
        .order("name")
      if (data) {
        setColors(data.map((c: { name: string }) => c.name))
      }
    } catch {
      // empty
    }
  }

  async function handleAddColor(name: string): Promise<boolean> {
    try {
      const tenantId = await getTenantId()
      const { error } = await supabase.from("colors").insert({
        tenant_id: tenantId,
        name: name.trim(),
      })
      if (error) {
        toast.error("Failed to add color: " + error.message)
        return false
      }
      setColors(prev => Array.from(new Set([...prev, name.trim()])).sort())
      toast.success(`Color "${name.trim()}" added!`)
      return true
    } catch {
      toast.error("Failed to add color")
      return false
    }
  }

  // â"€â"€â"€ Add supplier inline â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function handleAddSupplier(name: string, phone: string): Promise<Supplier | null> {
    try {
      const tenantId = await getTenantId()
      const { data, error } = await supabase.from("suppliers").insert({
        tenant_id: tenantId,
        company_name: name, contact_person: name,
        phone: phone || "", email: "", address: "", city: "",
        status: "Active", rating: 0, total_purchases: 0, outstanding_balance: 0,
      }).select().single()
      if (error || !data) { toast.error("Failed: " + (error?.message || "")); return null }
      const s: Supplier = {
        id: data.id, companyName: data.company_name, contactPerson: data.contact_person,
        phone: data.phone, email: "", address: "", city: "", status: "Active",
        rating: 0, totalPurchases: 0, outstandingBalance: 0,
      }
      setSupplierList(prev => [...prev, s])
      toast.success(`Supplier "${name}" added!`)
      return s
    } catch { toast.error("Failed to add supplier"); return null }
  }

  // â"€â"€â"€ Fetch mobile categories from DB â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function fetchMobileCategories() {
    try {
      const tenantId = await getTenantId()
      const { data } = await supabase
        .from("categories")
        .select("name")
        .eq("tenant_id", tenantId)
        .eq("type", "Mobile")
        .eq("status", "Active")
        .order("name")
      if (data) {
        setMobileCategories(data.map((c: { name: string }) => c.name))
      }
    } catch {
      // empty
    }
  }

  async function handleAddMobileCategory(name: string): Promise<boolean> {
    try {
      const tenantId = await getTenantId()
      const { error } = await supabase.from("categories").insert({
        tenant_id: tenantId,
        name: name.trim(),
        type: "Mobile",
        status: "Active",
      })
      if (error) {
        toast.error("Failed to add category: " + error.message)
        return false
      }
      setMobileCategories(prev => Array.from(new Set([...prev, name.trim()])).sort())
      toast.success(`Category "${name.trim()}" added!`)
      return true
    } catch {
      toast.error("Failed to add category")
      return false
    }
  }

  // â"€â"€â"€ Fetch iPhone models from DB â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function handleAddAndroidModel(name: string): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed) return false
    setAndroidModels(prev => Array.from(new Set([...prev, trimmed])).sort())
    toast.success(`Model "${trimmed}" added!`)
    return true
  }

  async function handleAddIphoneModel(name: string): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed) return false
    setIphoneModels(prev => Array.from(new Set([...prev, trimmed])).sort())
    toast.success(`Model "${trimmed}" added!`)
    return true
  }

  // â"€â"€â"€ Fetch storage options from DB â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function fetchStorageOptions() {
    try {
      const tenantId = await getTenantId()
      const { data } = await supabase
        .from("storage_options")
        .select("name")
        .eq("tenant_id", tenantId)
        .order("name")
      if (data) {
        setStorageOptions(data.map((d: { name: string }) => d.name))
      }
    } catch {
      // empty
    }
  }

  async function handleAddStorage(name: string): Promise<boolean> {
    try {
      const tenantId = await getTenantId()
      const { error } = await supabase.from("storage_options").insert({
        tenant_id: tenantId,
        name: name.trim(),
      })
      if (error) {
        toast.error("Failed to add storage option: " + error.message)
        return false
      }
      setStorageOptions(prev => Array.from(new Set([...prev, name.trim()])).sort())
      toast.success(`Storage "${name.trim()}" added!`)
      return true
    } catch {
      toast.error("Failed to add storage option")
      return false
    }
  }

  // â"€â"€â"€ Fetch RAM options from DB â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function fetchRamOptions() {
    try {
      const tenantId = await getTenantId()
      const { data } = await supabase
        .from("ram_options")
        .select("name")
        .eq("tenant_id", tenantId)
        .order("name")
      if (data) {
        setRamOptions(data.map((d: { name: string }) => d.name))
      }
    } catch {
      // empty
    }
  }

  async function handleAddRam(name: string): Promise<boolean> {
    try {
      const tenantId = await getTenantId()
      const { error } = await supabase.from("ram_options").insert({
        tenant_id: tenantId,
        name: name.trim(),
      })
      if (error) {
        toast.error("Failed to add RAM option: " + error.message)
        return false
      }
      setRamOptions(prev => Array.from(new Set([...prev, name.trim()])).sort())
      toast.success(`RAM "${name.trim()}" added!`)
      return true
    } catch {
      toast.error("Failed to add RAM option")
      return false
    }
  }

  // â"€â"€â"€ Fetch conditions from DB â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function fetchConditions() {
    try {
      const tenantId = await getTenantId()
      const { data } = await supabase
        .from("conditions")
        .select("name")
        .eq("tenant_id", tenantId)
        .order("name")
      if (data) setConditions(data.map((c: { name: string }) => c.name))
    } catch { /* empty */ }
  }

  async function handleAddCondition(name: string): Promise<boolean> {
    try {
      const tenantId = await getTenantId()
      const { error } = await supabase.from("conditions").insert({ tenant_id: tenantId, name: name.trim() })
      if (error) { toast.error("Failed: " + error.message); return false }
      setConditions(prev => Array.from(new Set([...prev, name.trim()])).sort())
      toast.success(`Condition "${name.trim()}" added!`)
      return true
    } catch { toast.error("Failed to add condition"); return false }
  }

  // â"€â"€â"€ Fetch data from Supabase â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function fetchData() {
    try {
      const [mobilesRes, suppliersRes] = await Promise.all([
        getMobiles(),
        getSuppliers(),
      ])
      setMobileList(mobilesRes)
      setSupplierList(suppliersRes)
      // Seed model lists from existing catalog entries
      setAndroidModels(Array.from(new Set(mobilesRes.filter(m => m.deviceType !== "iphone").map(m => m.model))).sort())
      setIphoneModels(Array.from(new Set(mobilesRes.filter(m => m.deviceType === "iphone").map(m => m.model))).sort())
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchBrands()
    fetchColors()
    fetchMobileCategories()
    fetchConditions()
    fetchStorageOptions()
    fetchRamOptions()
  }, [])

  // â"€â"€â"€ Derived stats â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const stats = useMemo(() => {
    const inStock = mobileList.filter(m => m.stock > 0)
    const total = inStock.length
    const totalStock = inStock.reduce((s, m) => s + m.stock, 0)
    const outOfStock = mobileList.filter(m => m.stock === 0).length
    const totalValue = inStock.reduce((s, m) => s + m.sellingPrice * m.stock, 0)
    return { total, totalStock, outOfStock, totalValue }
  }, [mobileList])

  // â"€â"€â"€ Filtered list â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const filtered = useMemo(() => {
    return mobileList.filter(m => {
      if (m.stock === 0) return false
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        m.model.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        m.imei.includes(q) ||
        m.color.toLowerCase().includes(q)
      const matchBrand = brandFilter === "all" || m.brand.toLowerCase() === brandFilter.toLowerCase()
      const matchCategory = categoryFilter === "all" || m.category === categoryFilter
      const matchDeviceType = deviceTypeFilter === "all" || m.deviceType === deviceTypeFilter
      const stockStatus = getMobileStockStatus(m.stock)
      const matchStock =
        stockFilter === "all" ||
        (stockFilter === "in" && stockStatus === "In Stock") ||
        (stockFilter === "out" && stockStatus === "Out of Stock")
      return matchSearch && matchBrand && matchCategory && matchDeviceType && matchStock
    })
  }, [mobileList, search, brandFilter, categoryFilter, deviceTypeFilter, stockFilter])

  // â"€â"€â"€ Handlers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function handleEdit(mobile: Mobile) {
    try {
      const tenantId = await getTenantId()
      const { data } = await supabase
        .from("purchase_items")
        .select("purchase_id")
        .eq("product_id", mobile.id)
        .eq("tenant_id", tenantId)
        .limit(1)
        .maybeSingle()
      if (data?.purchase_id) {
        setEditSheetPurchaseId(data.purchase_id)
        setEditSheetOpen(true)
      } else {
        // No purchase record - fall back to simple mobile edit dialog
        setEditingMobile(mobile)
        setDialogOpen(true)
      }
    } catch {
      setEditingMobile(mobile)
      setDialogOpen(true)
    }
  }

  function handleView(mobile: Mobile) {
    setViewMobile(mobile)
    setViewDialogOpen(true)
  }

  function handleDeleteClick(mobile: Mobile) {
    setDeleteTarget(mobile)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    try {
      await deleteMobile(deleteTarget.id)
      toast.success(`${deleteTarget.brand} ${deleteTarget.model} deleted successfully`)
      setDeleteTarget(null)
      setDeleteDialogOpen(false)
      await fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete mobile")
    }
  }

  async function handleFormSubmit(data: MobileFormOutput, imageUrl: string, deviceType: "android" | "iphone") {
    try {
      if (editingMobile) {
        await updateMobile(editingMobile.id, {
          brand: data.brand,
          model: data.model,
          imei: "",
          color: data.color,
          storage: data.storage,
          ram: data.ram,
          purchasePrice: data.purchasePrice,
          sellingPrice: data.sellingPrice,
          supplierId: data.supplierId,
          stock: data.stock,
          condition: data.condition,
          category: data.category,
          deviceType,
          notes: data.notes || undefined,
          image: imageUrl || undefined,
        })
        toast.success("Mobile phone updated successfully")
      } else {
        await createMobile({
          brand: data.brand,
          model: data.model,
          imei: "",
          color: data.color,
          storage: data.storage,
          ram: data.ram,
          purchasePrice: data.purchasePrice,
          sellingPrice: data.sellingPrice,
          supplierId: data.supplierId,
          stock: data.stock,
          condition: data.condition,
          category: data.category,
          deviceType,
          notes: data.notes || undefined,
          image: imageUrl || undefined,
          dateAdded: format(new Date(), "yyyy-MM-dd"),
        })
        toast.success("Mobile phone added successfully")
      }
      await fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save mobile")
    }
  }

  function clearFilters() {
    setSearch("")
    setBrandFilter("all")
    setCategoryFilter("all")
    setDeviceTypeFilter("all")
    setStockFilter("all")
  }

  // â"€â"€â"€ Table columns â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  const columns: ColumnDef<Mobile>[] = useMemo(
    () => [
      {
        accessorKey: "brand",
        header: "Brand",
        cell: ({ row }) => {
          const brand = row.original.brand
          return (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700">
              {brand}
            </span>
          )
        },
      },
      {
        accessorKey: "deviceType",
        header: "Type",
        cell: ({ row }) => {
          const dt = row.original.deviceType
          return (
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold",
              dt === "iphone" ? "bg-slate-900 text-white" : "bg-green-100 text-green-700"
            )}>
              {dt === "iphone" ? "iPhone" : "Android"}
            </span>
          )
        },
      },
      {
        accessorKey: "model",
        header: "Model",
        cell: ({ row }) => (
          <span className="font-medium text-slate-900">{row.original.model}</span>
        ),
      },
      {
        accessorKey: "stock",
        header: "Stock",
        cell: ({ row }) => {
          const s = row.original.stock
          const status = getMobileStockStatus(s)
          return (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", stockBadgeStyle[status])}>
              <span className={cn("w-1.5 h-1.5 rounded-full", stockDotStyle[status])} />
              {s} units
            </span>
          )
        },
      },
      {
        id: "storageRam",
        header: "Storage / RAM",
        cell: ({ row }) => (
          <span className="text-sm text-slate-600">{row.original.storage} / {row.original.ram}</span>
        ),
      },
      {
        accessorKey: "purchasePrice",
        header: "Buy Price",
        cell: ({ row }) => (
          <span className="text-sm text-slate-500">{formatCurrency(row.original.purchasePrice)}</span>
        ),
      },
      {
        accessorKey: "sellingPrice",
        header: "Sell Price",
        cell: ({ row }) => (
          <span className="text-sm font-semibold text-slate-900">{formatCurrency(row.original.sellingPrice)}</span>
        ),
      },
      {
        id: "margin",
        header: "Margin %",
        cell: ({ row }) => {
          const m = calculateMargin(row.original.purchasePrice, row.original.sellingPrice)
          return (
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
              <TrendingUp className="w-3 h-3" />
              {m.toFixed(1)}%
            </span>
          )
        },
      },
      {
        accessorKey: "condition",
        header: "Condition",
        cell: ({ row }) => <StatusBadge status={row.original.condition} />,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const st = getMobileStockStatus(row.original.stock)
          return <StatusBadge status={st} />
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const mobile = row.original
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => handleView(mobile)}
              >
                <Eye className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => handleEdit(mobile)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                onClick={() => handleDeleteClick(mobile)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const hasActiveFilters =
    search !== "" || brandFilter !== "all" || categoryFilter !== "all" || deviceTypeFilter !== "all" || stockFilter !== "all"

  // â"€â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  if (loading) {
    return (
      <div className="space-y-4 max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Loading mobiles...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-screen-2xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Mobile Phones"
        description="Catalog is built automatically from purchases - edit entries here"
        icon={<Smartphone />}
        iconBg="bg-blue-600"
        badge={
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {mobileList.length} devices
          </Badge>
        }
        action={
          <Link href="/purchases/new">
            <Button className="gap-2">
              <ShoppingBag className="w-4 h-4" />
              New Purchase
            </Button>
          </Link>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard
          title="Total Models"
          value={String(stats.total)}
          icon={Smartphone}
          iconBg="bg-blue-100"
          gradient="from-blue-50 to-blue-100"
          subtext="in inventory"
        />
        <StatCard
          title="Total Units"
          value={String(stats.totalStock)}
          icon={Package}
          iconBg="bg-blue-100"
          gradient="from-emerald-50 to-emerald-100"
          subtext="across all models"
        />
        <StatCard
          title="Inventory Value"
          value={formatCurrency(stats.totalValue)}
          icon={DollarSign}
          iconBg="bg-blue-100"
          gradient="from-purple-50 to-purple-100"
          subtext="at selling price"
        />
        <StatCard
          title="Out of Stock"
          value={String(stats.outOfStock)}
          icon={AlertTriangle}
          iconBg="bg-red-100"
          gradient="from-red-50 to-red-100"
          subtext="models need restock"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 space-y-2.5">
        {/* Row 1: Search + View toggle */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search model, brand, IMEI..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-shrink-0">
            <button
              onClick={() => setView("grid")}
              className={cn("p-1.5 rounded-md transition-colors", view === "grid" ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600")}
              title="Grid view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("table")}
              className={cn("p-1.5 rounded-md transition-colors", view === "table" ? "bg-white shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600")}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Filters in one row */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-0 sm:w-32 sm:flex-none">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-0 sm:w-36 sm:flex-none">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {mobileCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={deviceTypeFilter} onValueChange={setDeviceTypeFilter}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-0 sm:w-32 sm:flex-none">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="android">Android</SelectItem>
              <SelectItem value="iphone">iPhone</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-0 sm:w-32 sm:flex-none">
              <SelectValue placeholder="Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="in">In Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1 shrink-0 px-2.5">
              <Filter className="w-3 h-3" />
              Clear
            </Button>
          )}

          {hasActiveFilters && (
            <span className="text-xs text-slate-400 ml-auto shrink-0 hidden sm:inline">
              {filtered.length} of {mobileList.length}
            </span>
          )}
        </div>
      </div>

      {/* Grid View */}
      {view === "grid" && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="No mobile phones found"
              description="Create a purchase order to add phones to the catalog automatically"
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(mobile => (
                <MobileCard
                  key={mobile.id}
                  mobile={mobile}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Table View */}
      {view === "table" && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Smartphone}
              title="No mobile phones found"
              description="Create a purchase order to add phones to the catalog automatically"
            />
          ) : (
            <>
              {/* â"€â"€ Mobile: professional list cards (hidden on md+) â"€â"€â"€â"€ */}
              <div className="md:hidden space-y-2.5">
                {filtered.map(mobile => {
                  const margin = calculateMargin(mobile.purchasePrice, mobile.sellingPrice)
                  const stockStatus = getMobileStockStatus(mobile.stock)
                  const accentColor =
                    stockStatus === "In Stock" ? "bg-emerald-500" : "bg-red-500"
                  return (
                    <div
                      key={mobile.id}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex"
                    >
                      {/* Left accent strip - color = stock status */}
                      <div className={cn("w-1 shrink-0", accentColor)} />

                      {/* Card body */}
                      <div className="flex-1 p-3 space-y-2.5 min-w-0">

                        {/* Zone 1 - Identity */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0 leading-snug">
                                {mobile.brand}
                              </span>
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0 leading-snug">
                                {mobile.condition}
                              </span>
                            </div>
                            <p className="font-bold text-slate-900 text-[15px] leading-tight truncate">
                              {mobile.model}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-slate-400">
                                {mobile.storage} / {mobile.ram} &middot; {mobile.color}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                {mobile.stock} units
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                â†- {margin.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <StatusBadge status={stockStatus} className="shrink-0 text-[10px] px-1.5 py-0.5" />
                        </div>

                        {/* Zone 2 - Prices */}
                        <div className="flex items-center gap-2">
                          {/* Buy */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Buy</p>
                            <p className="text-xs font-semibold text-slate-500 truncate">{formatCurrency(mobile.purchasePrice)}</p>
                          </div>
                          {/* Divider */}
                          <div className="w-px h-8 bg-slate-200 shrink-0" />
                          {/* Sell */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mb-0.5">Sell</p>
                            <p className="text-sm font-bold text-blue-700 truncate">{formatCurrency(mobile.sellingPrice)}</p>
                          </div>
                          {/* Divider */}
                          <div className="w-px h-8 bg-slate-200 shrink-0" />
                          {/* Stock */}
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Stock</p>
                              <p className="text-[11px] text-slate-500 font-mono truncate">{mobile.stock} units</p>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(String(mobile.stock))
                                toast.success("Stock copied")
                              }}
                              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Zone 3 - Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => handleView(mobile)}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                          <button
                            onClick={() => handleEdit(mobile)}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClick(mobile)}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold text-slate-400 bg-slate-50 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* â"€â"€ Desktop: full DataTable (hidden on mobile) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
              <div className="hidden md:block">
                <DataTable
                  columns={columns}
                  data={filtered}
                  searchPlaceholder="Search mobile phones..."
                />
              </div>
            </>
          )}
        </>
      )}

      {/* Add/Edit Drawer */}
      <MobileFormDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingMobile={editingMobile}
        onSubmit={handleFormSubmit}
        suppliers={supplierList}
        brands={brands}
        onAddBrand={handleAddBrand}
        colors={colors}
        onAddColor={handleAddColor}
        mobileCategories={mobileCategories}
        onAddMobileCategory={handleAddMobileCategory}
        onAddSupplier={handleAddSupplier}
        androidModels={androidModels}
        onAddAndroidModel={handleAddAndroidModel}
        iphoneModels={iphoneModels}
        onAddIphoneModel={handleAddIphoneModel}
        storageOptions={storageOptions}
        onAddStorage={handleAddStorage}
        ramOptions={ramOptions}
        onAddRam={handleAddRam}
        conditions={conditions}
        onAddCondition={handleAddCondition}
      />

      {/* View Dialog */}
      <ViewDialog
        mobile={viewMobile}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        suppliers={supplierList}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Mobile Phone"
        description={
          deleteTarget
            ? `Are you sure you want to delete ${deleteTarget.brand} ${deleteTarget.model}? This action cannot be undone.`
            : "Are you sure you want to delete this mobile phone?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />

      {/* Edit Purchase Sheet */}
      <NewPurchaseSheet
        open={editSheetOpen}
        onClose={() => { setEditSheetOpen(false); setEditSheetPurchaseId(null) }}
        onCreated={fetchData}
        editPurchaseId={editSheetPurchaseId}
      />
    </div>
  )
}

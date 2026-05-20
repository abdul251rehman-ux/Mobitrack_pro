"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Image from "next/image"
import {
  Plus, Search, Grid3X3, List, Headphones, Pencil, Trash2,
  TrendingUp, Package, DollarSign, AlertTriangle, X, Tag,
  Volume2, Zap, Shield, Smartphone, BatteryCharging, Keyboard, HardDrive, Watch,
  Type, Hash, Layers, FileText,
  ImageIcon, Upload,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { format } from "date-fns"
import { ColumnDef } from "@tanstack/react-table"

import { getAccessories, createAccessory, updateAccessory, deleteAccessory } from "@/lib/api/products"
import { MASTER_BRAND_NAMES } from "@/data/brands"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { Accessory } from "@/data/types"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn, formatCurrency, calculateMargin, getStockStatus } from "@/lib/utils"
// categories and brands are fetched from database

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const accessorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  brand: z.string().min(1, "Brand is required"),
  sku: z.string().optional().default(""),
  category: z.string().min(1, "Category is required"),
  // price/stock/supplier set via Purchase page
  purchasePrice: z.string().optional().transform(v => v ? parseFloat(v) : 0).pipe(z.number().min(0)),
  sellingPrice: z.string().optional().transform(v => v ? parseFloat(v) : 0).pipe(z.number().min(0)),
  stock: z.string().optional().transform(v => v ? parseInt(v, 10) : 0).pipe(z.number().min(0)),
  supplierId: z.string().optional().default(""),
  compatibleModels: z.array(z.string()).optional().default([]),
  description: z.string().optional(),
})

type AccessoryFormInput = z.input<typeof accessorySchema>
type AccessoryFormOutput = z.output<typeof accessorySchema>

const stockDotColor: Record<string, string> = {
  "In Stock": "bg-emerald-500",
  "Low Stock": "bg-amber-500",
  "Out of Stock": "bg-red-500",
}

// ─── Category Config ──────────────────────────────────────────────────────────

const categoryConfig: Record<string, { icon: React.ElementType; iconBg: string; badge: string; headerGradient: string }> = {
  "Headphones/Earbuds": { icon: Headphones,      iconBg: "bg-violet-100 text-violet-600", badge: "bg-violet-50 text-violet-700 border-violet-200", headerGradient: "from-violet-500 to-purple-600"  },
  "Speakers":           { icon: Volume2,          iconBg: "bg-blue-100 text-blue-600",    badge: "bg-blue-50 text-blue-700 border-blue-200",       headerGradient: "from-blue-500 to-blue-700"       },
  "Chargers & Cables":  { icon: Zap,              iconBg: "bg-amber-100 text-amber-600",  badge: "bg-amber-50 text-amber-700 border-amber-200",    headerGradient: "from-amber-500 to-orange-500"    },
  "Cases & Covers":     { icon: Shield,           iconBg: "bg-green-100 text-green-600",  badge: "bg-green-50 text-green-700 border-green-200",    headerGradient: "from-green-500 to-emerald-600"   },
  "Screen Protectors":  { icon: Smartphone,       iconBg: "bg-cyan-100 text-cyan-600",    badge: "bg-cyan-50 text-cyan-700 border-cyan-200",       headerGradient: "from-cyan-500 to-teal-600"       },
  "Power Banks":        { icon: BatteryCharging,  iconBg: "bg-indigo-100 text-indigo-600",badge: "bg-indigo-50 text-indigo-700 border-indigo-200", headerGradient: "from-indigo-500 to-violet-600"   },
  "Mouse & Keyboards":  { icon: Keyboard,         iconBg: "bg-rose-100 text-rose-600",    badge: "bg-rose-50 text-rose-700 border-rose-200",       headerGradient: "from-rose-500 to-pink-600"       },
  "Memory Cards":       { icon: HardDrive,        iconBg: "bg-pink-100 text-pink-600",    badge: "bg-pink-50 text-pink-700 border-pink-200",       headerGradient: "from-pink-500 to-rose-500"       },
  "Smartwatches":       { icon: Watch,            iconBg: "bg-teal-100 text-teal-600",    badge: "bg-teal-50 text-teal-700 border-teal-200",       headerGradient: "from-teal-500 to-cyan-600"       },
  "Other":              { icon: Package,          iconBg: "bg-slate-100 text-slate-600",  badge: "bg-slate-50 text-slate-700 border-slate-200",    headerGradient: "from-slate-500 to-slate-700"     },
}

function getMarginStyle(m: number) {
  if (m >= 40) return { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "text-emerald-500" }
  if (m >= 25) return { badge: "bg-blue-50 text-blue-700 border-blue-200",         icon: "text-blue-500" }
  if (m >= 15) return { badge: "bg-amber-50 text-amber-700 border-amber-200",      icon: "text-amber-500" }
  return              { badge: "bg-red-50 text-red-700 border-red-200",             icon: "text-red-500" }
}

const stockPillStyle: Record<string, string> = {
  "In Stock":    "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Low Stock":   "bg-amber-50 text-amber-700 border-amber-200",
  "Out of Stock":"bg-red-50 text-red-700 border-red-200",
}

// ─── Accessory Card ───────────────────────────────────────────────────────────

function AccessoryCard({
  accessory,
  onEdit,
  onDelete,
}: {
  accessory: Accessory
  onEdit: (a: Accessory) => void
  onDelete: (a: Accessory) => void
}) {
  const hasPrices = accessory.purchasePrice > 0 && accessory.sellingPrice > 0
  const margin = hasPrices ? calculateMargin(accessory.purchasePrice, accessory.sellingPrice) : 0
  const profit = accessory.sellingPrice - accessory.purchasePrice
  const cfg = categoryConfig[accessory.category] ?? categoryConfig["Other"]
  const Icon = cfg.icon
  const marginStyle = getMarginStyle(margin)

  return (
    <Card className="relative overflow-hidden border border-slate-200/80 hover:shadow-md hover:shadow-slate-200/70 transition-all duration-200 hover:-translate-y-0.5 bg-white group rounded-xl">

      {/* Header */}
      {accessory.image ? (
        <div className="relative h-24 bg-white border-b border-slate-100 overflow-hidden">
          <Image
            src={accessory.image}
            alt={accessory.name}
            fill
            className="object-contain p-2"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
          {hasPrices && (
            <span className="absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-0.5 rounded-md bg-white shadow-sm border border-slate-100 px-1.5 py-0.5 text-[10px] font-bold">
              <TrendingUp className={cn("w-2.5 h-2.5", marginStyle.icon)} />
              <span className={marginStyle.icon}>{margin.toFixed(1)}%</span>
            </span>
          )}
        </div>
      ) : (
        <div className={cn("relative bg-gradient-to-br h-24 flex items-center justify-between px-4 overflow-hidden", cfg.headerGradient)}>
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-5 -left-3 w-14 h-14 rounded-full bg-white/10 pointer-events-none" />
          <div className="relative z-10 p-2 rounded-xl bg-white/20 backdrop-blur-sm">
            <Icon className="w-5 h-5 text-white/90" />
          </div>
          {hasPrices && (
            <span className="relative z-10 inline-flex items-center gap-0.5 rounded-md bg-white/90 shadow px-1.5 py-0.5 text-[10px] font-bold">
              <TrendingUp className={cn("w-2.5 h-2.5", marginStyle.icon)} />
              <span className={marginStyle.icon}>{margin.toFixed(1)}%</span>
            </span>
          )}
        </div>
      )}

      {/* Body */}
      <div className="p-3 space-y-2">

        {/* Category + name */}
        <div>
          <span className={cn(
            "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium mb-1",
            cfg.badge
          )}>
            {accessory.category}
          </span>
          <h3 className="font-bold text-slate-900 text-[13px] leading-snug line-clamp-1">
            {accessory.name}
          </h3>
          <p className="text-[10px] text-slate-400 font-mono truncate">
            {accessory.brand} · {accessory.sku}
          </p>
        </div>

        {/* Price box */}
        {hasPrices ? (
          <div className="bg-slate-50 rounded-lg px-2.5 py-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Sell Price</span>
              <span className="text-[13px] font-extrabold text-slate-900 tabular-nums leading-none">
                {formatCurrency(accessory.sellingPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Buy Price</span>
              <span className="text-[10px] text-slate-500 tabular-nums">{formatCurrency(accessory.purchasePrice)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="text-[10px] text-slate-400">Profit</span>
              <span className="text-[10px] font-semibold text-emerald-600 tabular-nums">+{formatCurrency(profit)}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-center">
            <p className="text-[10px] font-medium text-amber-700">No price set — purchase to stock</p>
          </div>
        )}

        {/* Stock + action buttons */}
        <div className="flex items-center justify-between gap-1.5">
          {accessory.stock > 0 ? (
            <span className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
              stockPillStyle[getStockStatus(accessory.stock)]
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", stockDotColor[getStockStatus(accessory.stock)])} />
              {accessory.stock} units
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              Catalog only
            </span>
          )}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              onClick={() => onEdit(accessory)}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => onDelete(accessory)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

      </div>
    </Card>
  )
}

// ─── Tag Input ────────────────────────────────────────────────────────────────

function TagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [inputValue, setInputValue] = useState("")

  function addTag() {
    const trimmed = inputValue.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInputValue("")
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. iPhone 15 Pro"
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag}>
          Add
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
            >
              <Tag className="w-3 h-3 text-slate-400" />
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="text-slate-400 hover:text-red-500 transition-colors ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Add/Edit Dialog ──────────────────────────────────────────────────────────

function AccessoryFormDialog({
  open,
  onOpenChange,
  editingAccessory,
  onSubmit,
  categories,
  onAddCategory,
  brands,
  onAddBrand,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editingAccessory: Accessory | null
  onSubmit: (data: AccessoryFormOutput, imageUrl: string) => void
  categories: string[]
  onAddCategory: (name: string) => Promise<boolean>
  brands: string[]
  onAddBrand: (name: string) => Promise<boolean>
}) {
  const isEditing = !!editingAccessory
  const [compatibleModels, setCompatibleModels] = useState<string[]>(
    editingAccessory?.compatibleModels ?? []
  )
  const [imageUrl, setImageUrl] = useState<string>(editingAccessory?.image ?? "")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [addingCategory, setAddingCategory] = useState(false)
  const [showNewBrand, setShowNewBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState("")
  const [addingBrand, setAddingBrand] = useState(false)

  useEffect(() => {
    setImageUrl(editingAccessory?.image ?? "")
  }, [editingAccessory])

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
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccessoryFormInput, unknown, AccessoryFormOutput>({
    resolver: zodResolver(accessorySchema) as never,
    defaultValues: editingAccessory
      ? {
          name: editingAccessory.name,
          brand: editingAccessory.brand,
          sku: editingAccessory.sku,
          category: editingAccessory.category,
          compatibleModels: editingAccessory.compatibleModels ?? [],
          description: editingAccessory.description ?? "",
        }
      : {
          name: "",
          brand: "",
          sku: "",
          category: "",
          compatibleModels: [],
          description: "",
        },
  })

  useMemo(() => {
    setCompatibleModels(editingAccessory?.compatibleModels ?? [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingAccessory?.id])

  // price/stock set via Purchase page — no live margin in catalog form

  function handleClose() {
    reset()
    setCompatibleModels([])
    setImageUrl("")
    if (fileInputRef.current) fileInputRef.current.value = ""
    onOpenChange(false)
  }

  function handleFormSubmit(data: AccessoryFormOutput) {
    onSubmit({ ...data, compatibleModels }, imageUrl)
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-visible p-0 gap-0" style={{ overflowY: "auto" }}>
        <DialogTitle className="sr-only">
          {isEditing ? "Edit Accessory" : "Add New Accessory"}
        </DialogTitle>

        {/* ── Gradient header banner ── */}
        <div className={cn(
          "px-5 pt-5 pb-4 pr-12 rounded-t-2xl",
          isEditing
            ? "bg-linear-to-r from-blue-500 to-indigo-600"
            : "bg-linear-to-r from-emerald-500 to-teal-600"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              {isEditing
                ? <Pencil className="w-5 h-5 text-white" />
                : <Plus className="w-5 h-5 text-white" />
              }
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                {isEditing ? "Edit Accessory" : "Add New Accessory"}
              </h2>
              <p className="text-xs text-white/70 mt-0.5">
                {isEditing ? "Update the accessory details below." : "Fill in the details to add a new accessory."}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-4">

          {/* ── Section 1: Product Info ── */}
          <div className="rounded-xl border border-slate-200 overflow-visible">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
              <Tag className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Product Info</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Type className="w-3 h-3" /> Name <span className="text-red-500">*</span>
                  </Label>
                  <Input id="name" placeholder="e.g. Galaxy Buds2 Pro" {...register("name")}
                    className={cn("bg-slate-50 h-9 text-sm", errors.name && "border-red-400")} />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="brand" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Tag className="w-3 h-3" /> Brand <span className="text-red-500">*</span>
                  </Label>
                  {(() => {
                    const allBrands = Array.from(new Set([...MASTER_BRAND_NAMES, ...brands])).sort()
                    return (
                      <SearchableSelect
                        value={watch("brand") ?? ""}
                        onChange={val => setValue("brand", val, { shouldValidate: true })}
                        options={allBrands}
                        placeholder="Search brand..."
                        allowCustom
                        customWarning="This brand is not in the standard list. It will be saved as entered."
                        onAddNew={async (name) => { await onAddBrand(name) }}
                        error={!!errors.brand}
                      />
                    )
                  })()}
                  <button
                    type="button"
                    onClick={() => { setShowNewBrand(true); setNewBrandName("") }}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add New Brand
                  </button>
                  {errors.brand && <p className="text-xs text-red-500">{errors.brand.message}</p>}

                  {/* Quick Add Brand Modal */}
                  <Dialog open={showNewBrand} onOpenChange={setShowNewBrand}>
                    <DialogContent className="max-w-xs">
                      <DialogHeader>
                        <DialogTitle className="text-sm font-bold">Add New Brand</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 py-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Brand Name <span className="text-red-500">*</span></Label>
                          <Input
                            placeholder="e.g. Anker, Baseus, JBL"
                            value={newBrandName}
                            onChange={e => setNewBrandName(e.target.value)}
                            className="h-8 text-xs"
                            autoFocus
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                if (!newBrandName.trim() || addingBrand) return
                                setAddingBrand(true)
                                const ok = await onAddBrand(newBrandName.trim())
                                setAddingBrand(false)
                                if (ok) {
                                  setValue("brand", newBrandName.trim(), { shouldValidate: true })
                                  setNewBrandName("")
                                  setShowNewBrand(false)
                                }
                              }
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">This brand will be saved globally and available across all products.</p>
                      </div>
                      <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowNewBrand(false)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          disabled={!newBrandName.trim() || addingBrand}
                          onClick={async () => {
                            if (!newBrandName.trim() || addingBrand) return
                            setAddingBrand(true)
                            const ok = await onAddBrand(newBrandName.trim())
                            setAddingBrand(false)
                            if (ok) {
                              setValue("brand", newBrandName.trim(), { shouldValidate: true })
                              setNewBrandName("")
                              setShowNewBrand(false)
                            }
                          }}
                        >
                          {addingBrand ? "Saving..." : "Add Brand"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sku" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Hash className="w-3 h-3" /> SKU <span className="text-slate-400 font-normal text-[10px]">(optional)</span>
                  </Label>
                  <Input id="sku" placeholder="e.g. EAR-SAM-0001" {...register("sku")}
                    className="bg-slate-50 h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <Layers className="w-3 h-3" /> Category <span className="text-red-500">*</span>
                  </Label>
                  <SearchableSelect
                    value={watch("category") ?? ""}
                    onChange={val => setValue("category", val, { shouldValidate: true })}
                    options={categories}
                    placeholder="Search category..."
                    allowCustom
                    customWarning="This category is not in your list. Use 'Add permanently' to save it for future use."
                    onAddNew={async (name) => { await onAddCategory(name) }}
                    error={!!errors.category}
                  />
                  <button
                    type="button"
                    onClick={() => { setShowNewCategory(true); setNewCategoryName("") }}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add New Category
                  </button>
                  {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}

                  {/* Quick Add Category Modal */}
                  <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
                    <DialogContent className="max-w-xs">
                      <DialogHeader>
                        <DialogTitle className="text-sm font-bold">Add New Category</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 py-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Category Name <span className="text-red-500">*</span></Label>
                          <Input
                            placeholder="e.g. Earphones, Cases, Chargers"
                            value={newCategoryName}
                            onChange={e => setNewCategoryName(e.target.value)}
                            className="h-8 text-xs"
                            autoFocus
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                if (!newCategoryName.trim() || addingCategory) return
                                setAddingCategory(true)
                                const ok = await onAddCategory(newCategoryName.trim())
                                setAddingCategory(false)
                                if (ok) {
                                  setValue("category", newCategoryName.trim(), { shouldValidate: true })
                                  setNewCategoryName("")
                                  setShowNewCategory(false)
                                }
                              }
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">Saved as an accessory category only — will not appear in mobile phone categories.</p>
                      </div>
                      <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowNewCategory(false)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          disabled={!newCategoryName.trim() || addingCategory}
                          onClick={async () => {
                            if (!newCategoryName.trim() || addingCategory) return
                            setAddingCategory(true)
                            const ok = await onAddCategory(newCategoryName.trim())
                            setAddingCategory(false)
                            if (ok) {
                              setValue("category", newCategoryName.trim(), { shouldValidate: true })
                              setNewCategoryName("")
                              setShowNewCategory(false)
                            }
                          }}
                        >
                          {addingCategory ? "Saving..." : "Add Category"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Product Image ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-pink-50 border-b border-pink-100">
              <ImageIcon className="w-3.5 h-3.5 text-pink-600" />
              <span className="text-[11px] font-bold text-pink-700 uppercase tracking-wider">Product Image</span>
              <span className="text-[10px] text-pink-400 font-normal ml-1">(optional)</span>
            </div>
            <div className="p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              {imageUrl ? (
                <div className="relative group w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <Image
                    src={imageUrl}
                    alt="Accessory preview"
                    fill
                    className="object-contain p-3"
                    sizes="100vw"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-slate-700 shadow hover:bg-slate-100 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" /> Change
                    </button>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 rounded-lg text-xs font-semibold text-white shadow hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-36 rounded-xl border-2 border-dashed border-slate-200 hover:border-pink-400 bg-slate-50 hover:bg-pink-50/40 flex flex-col items-center justify-center gap-2 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-pink-100 flex items-center justify-center transition-colors">
                    <Upload className="w-5 h-5 text-slate-400 group-hover:text-pink-500 transition-colors" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-500 group-hover:text-pink-600 transition-colors">
                      Click to upload image
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WEBP — up to 5 MB</p>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* ── Section 3: Notes & Details ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-b border-violet-100">
              <FileText className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Notes & Details</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                <p className="text-[11px] text-blue-700 font-medium">
                  Price and stock are set when you purchase this accessory from a supplier on the Purchase page.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Smartphone className="w-3 h-3" /> Compatible Models
                  <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <TagInput tags={compatibleModels} onChange={setCompatibleModels} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description" className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <FileText className="w-3 h-3" /> Description
                  <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <Textarea id="description" placeholder="Brief description of this accessory..."
                  rows={3} {...register("description")} className="bg-slate-50 text-sm resize-none" />
              </div>
            </div>
          </div>

          {/* ── Footer buttons ── */}
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1 pb-1">
            <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}
              className={cn("w-full sm:w-auto sm:ml-auto",
                isEditing ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"
              )}>
              {isEditing ? "Save Changes" : "Add Accessory"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccessoriesPage() {
  const [accessoryList, setAccessoryList] = useState<Accessory[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"grid" | "table">("grid")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Accessory | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // ─── Fetch categories from DB ─────────────────────────────────────────────

  async function fetchCategories() {
    try {
      const tenantId = await getTenantId()
      const { data } = await supabase
        .from("categories")
        .select("name")
        .eq("tenant_id", tenantId)
        .in("type", ["Accessory", "Both"])
        .order("name")
      if (data) {
        setCategories(data.map((c: { name: string }) => c.name))
      }
    } catch {
      // empty — user will add categories via the form
    }
  }

  async function handleAddCategory(name: string) {
    try {
      const tenantId = await getTenantId()
      const { error } = await supabase.from("categories").insert({
        tenant_id: tenantId,
        name: name.trim(),
        type: "Accessory",
        status: "Active",
      })
      if (error) {
        toast.error("Failed to add category: " + error.message)
        return false
      }
      setCategories(prev => Array.from(new Set([...prev, name.trim()])).sort())
      toast.success(`Category "${name.trim()}" added!`)
      return true
    } catch {
      toast.error("Failed to add category")
      return false
    }
  }

  // ─── Fetch brands from DB ───────────────────────────────────────────────

  async function fetchBrands() {
    try {
      const tenantId = await getTenantId()
      const { data } = await supabase
        .from("brands")
        .select("name")
        .eq("tenant_id", tenantId)
        .eq("status", "Active")
        .order("name")
      if (data && data.length > 0) {
        setBrands(data.map((b: { name: string }) => b.name))
      }
    } catch {
      // fallback — empty
    }
  }

  async function handleAddBrand(name: string) {
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

  // ─── Fetch data from Supabase ─────────────────────────────────────────────

  async function fetchData() {
    try {
      const accessoriesRes = await getAccessories()
      setAccessoryList(accessoriesRes)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchCategories()
    fetchBrands()
  }, [])

  // ─── Derived stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = accessoryList.length
    const totalStock = accessoryList.reduce((s, a) => s + a.stock, 0)
    const inventoryValue = accessoryList.reduce((s, a) => s + a.sellingPrice * a.stock, 0)
    const lowStock = accessoryList.filter(a => {
      const status = getStockStatus(a.stock)
      return status === "Low Stock" || status === "Out of Stock"
    }).length
    return { total, totalStock, inventoryValue, lowStock }
  }, [accessoryList])

  // ─── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return accessoryList.filter(a => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.brand.toLowerCase().includes(q) ||
        a.sku.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      const matchCategory = categoryFilter === "all" || a.category === categoryFilter
      const stockStatus = getStockStatus(a.stock)
      const matchStock =
        stockFilter === "all" ||
        (stockFilter === "in" && stockStatus === "In Stock") ||
        (stockFilter === "low" && stockStatus === "Low Stock") ||
        (stockFilter === "out" && stockStatus === "Out of Stock")
      return matchSearch && matchCategory && matchStock
    })
  }, [accessoryList, search, categoryFilter, stockFilter])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleAdd() {
    setEditingAccessory(null)
    setDialogOpen(true)
  }

  function handleEdit(accessory: Accessory) {
    setEditingAccessory(accessory)
    setDialogOpen(true)
  }

  function handleDeleteClick(accessory: Accessory) {
    setDeleteTarget(accessory)
    setDeleteDialogOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    try {
      await deleteAccessory(deleteTarget.id)
      toast.success(`${deleteTarget.name} deleted successfully`)
      setDeleteTarget(null)
      setDeleteDialogOpen(false)
      await fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete accessory")
    }
  }

  async function handleFormSubmit(data: AccessoryFormOutput, imageUrl: string) {
    try {
      const catalogData = {
        name: data.name,
        brand: data.brand,
        sku: data.sku,
        category: data.category,
        purchasePrice: 0,
        sellingPrice: 0,
        stock: 0,
        supplierId: "",
        compatibleModels: data.compatibleModels ?? [],
        description: data.description || undefined,
        image: imageUrl || undefined,
      }
      if (editingAccessory) {
        await updateAccessory(editingAccessory.id, catalogData)
        toast.success("Accessory updated successfully")
      } else {
        await createAccessory({ ...catalogData, dateAdded: format(new Date(), "yyyy-MM-dd") })
        toast.success("Accessory added to catalog")
      }
      await fetchData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save accessory")
    }
  }

  function clearFilters() {
    setSearch("")
    setCategoryFilter("all")
    setStockFilter("all")
  }

  // ─── Table columns ─────────────────────────────────────────────────────────

  const columns: ColumnDef<Accessory>[] = useMemo(
    () => [
      {
        id: "product",
        header: "Product",
        cell: ({ row }) => {
          const acc = row.original
          const cfg = categoryConfig[acc.category] ?? categoryConfig["Other"]
          const Icon = cfg.icon
          return (
            <div className="flex items-center gap-3 min-w-0 py-0.5">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm", cfg.iconBg)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 text-sm leading-tight">{acc.name}</p>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{acc.brand} · {acc.sku}</p>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => {
          const cat = row.original.category
          const cfg = categoryConfig[cat] ?? categoryConfig["Other"]
          return (
            <span className={cn(
              "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap",
              cfg.badge
            )}>
              {cat}
            </span>
          )
        },
      },
      {
        accessorKey: "purchasePrice",
        header: "Buy Price",
        cell: ({ row }) => (
          <div className="tabular-nums">
            <span className="text-sm text-slate-400">{formatCurrency(row.original.purchasePrice)}</span>
          </div>
        ),
      },
      {
        accessorKey: "sellingPrice",
        header: "Sell Price",
        cell: ({ row }) => (
          <div className="tabular-nums">
            <span className="text-sm font-bold text-slate-900">{formatCurrency(row.original.sellingPrice)}</span>
          </div>
        ),
      },
      {
        id: "margin",
        header: "Margin",
        cell: ({ row }) => {
          const m = calculateMargin(row.original.purchasePrice, row.original.sellingPrice)
          const style = getMarginStyle(m)
          return (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums",
              style.badge
            )}>
              <TrendingUp className={cn("w-3 h-3", style.icon)} />
              {m.toFixed(1)}%
            </span>
          )
        },
      },
      {
        accessorKey: "stock",
        header: "Stock",
        cell: ({ row }) => {
          const stock = row.original.stock
          const status = getStockStatus(stock)
          return (
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums",
              stockPillStyle[status]
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", stockDotColor[status])} />
              {stock} units
            </span>
          )
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const accessory = row.original
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                onClick={() => handleEdit(accessory)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => handleDeleteClick(accessory)}
              >
                <Trash2 className="w-3.5 h-3.5" />
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
    search !== "" || categoryFilter !== "all" || stockFilter !== "all"

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Loading accessories...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <PageHeader
        title="Accessories"
        description="Manage your accessories inventory"
        icon={<Headphones />}
        iconBg="bg-emerald-600"
        badge={
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {accessoryList.length} products
          </Badge>
        }
        action={
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add New Accessory
          </Button>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard
          title="Total Products"
          value={String(stats.total)}
          icon={Headphones}
          iconBg="bg-violet-100"
          gradient="from-violet-50 to-violet-100"
          subtext="accessories in inventory"
        />
        <StatCard
          title="Units in Stock"
          value={String(stats.totalStock)}
          icon={Package}
          iconBg="bg-emerald-100"
          gradient="from-emerald-50 to-emerald-100"
          subtext="across all products"
        />
        <StatCard
          title="Inventory Value"
          value={formatCurrency(stats.inventoryValue)}
          icon={DollarSign}
          iconBg="bg-blue-100"
          gradient="from-blue-50 to-blue-100"
          subtext="at selling price"
        />
        <StatCard
          title="Low Stock Alerts"
          value={String(stats.lowStock)}
          icon={AlertTriangle}
          iconBg="bg-amber-100"
          gradient="from-amber-50 to-amber-100"
          subtext="products need attention"
        />
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
        {/* Row 1: Search + View Toggle */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search by name, brand, SKU, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5 shrink-0">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                view === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                view === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>

        {/* Row 2: Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          {/* Category filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="flex-1 min-w-[130px] sm:w-52 sm:flex-none bg-slate-50 border-slate-200">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Stock filter */}
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="flex-1 min-w-[110px] sm:w-40 sm:flex-none bg-slate-50 border-slate-200">
              <SelectValue placeholder="All Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock</SelectItem>
              <SelectItem value="in">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> In Stock
                </span>
              </SelectItem>
              <SelectItem value="low">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Low Stock
                </span>
              </SelectItem>
              <SelectItem value="out">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Out of Stock
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="shrink-0 text-slate-500 gap-1.5 border-slate-200">
              <X className="w-3.5 h-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400 font-medium">Active filters:</span>
            {search && (
              <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 rounded-full px-3 py-1 text-xs font-medium">
                Search: &quot;{search}&quot;
                <button onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-700 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {categoryFilter !== "all" && (
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-xs font-medium">
                {categoryFilter}
                <button onClick={() => setCategoryFilter("all")} className="text-blue-400 hover:text-blue-700 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {stockFilter !== "all" && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-3 py-1 text-xs font-medium">
                {stockFilter === "in" ? "In Stock" : stockFilter === "low" ? "Low Stock" : "Out of Stock"}
                <button onClick={() => setStockFilter("all")} className="text-emerald-400 hover:text-emerald-700 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <span className="ml-auto text-xs text-slate-500 font-medium">
              {filtered.length} of {accessoryList.length} results
            </span>
          </div>
        )}
      </div>

      {/* Grid / Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No accessories found"
          description={
            hasActiveFilters
              ? "Try adjusting your filters or search query."
              : "Add your first accessory to get started."
          }
          action={
            hasActiveFilters
              ? { label: "Clear Filters", onClick: clearFilters }
              : { label: "Add New Accessory", onClick: handleAdd }
          }
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(accessory => (
            <AccessoryCard
              key={accessory.id}
              accessory={accessory}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      ) : (
        <>
          {/* ── Mobile: professional list cards (hidden on md+) ──── */}
          <div className="md:hidden space-y-2.5">
            {filtered.map(accessory => {
              const margin = calculateMargin(accessory.purchasePrice, accessory.sellingPrice)
              const stockStatus = getStockStatus(accessory.stock)
              const accentColor =
                stockStatus === "In Stock"    ? "bg-emerald-500" :
                stockStatus === "Low Stock"   ? "bg-amber-400"   :
                                               "bg-red-500"
              const catCfg = categoryConfig[accessory.category] ?? categoryConfig["Other"]
              const CatIcon = catCfg.icon
              return (
                <div
                  key={accessory.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex"
                >
                  {/* Left accent strip — color = stock status */}
                  <div className={cn("w-1 shrink-0", accentColor)} />

                  {/* Card body */}
                  <div className="flex-1 p-3 space-y-2.5 min-w-0">

                    {/* Zone 1 — Identity */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0 leading-snug">
                            {accessory.brand}
                          </span>
                          <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium border px-2 py-0.5 rounded-full shrink-0 leading-snug", catCfg.badge)}>
                            <CatIcon className="w-2.5 h-2.5" />
                            {accessory.category}
                          </span>
                        </div>
                        <p className="font-bold text-slate-900 text-[15px] leading-tight truncate">
                          {accessory.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-slate-400 font-mono">
                            {accessory.sku}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {accessory.stock} units
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                            ↗ {margin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={stockStatus} className="shrink-0 text-[10px] px-1.5 py-0.5" />
                    </div>

                    {/* Zone 2 — Prices */}
                    <div className="flex items-center gap-2">
                      {/* Buy */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Buy</p>
                        <p className="text-xs font-semibold text-slate-500 truncate">{formatCurrency(accessory.purchasePrice)}</p>
                      </div>
                      {/* Divider */}
                      <div className="w-px h-8 bg-slate-200 shrink-0" />
                      {/* Sell */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-blue-500 uppercase tracking-wider mb-0.5">Sell</p>
                        <p className="text-sm font-bold text-blue-700 truncate">{formatCurrency(accessory.sellingPrice)}</p>
                      </div>
                      {/* Divider */}
                      <div className="w-px h-8 bg-slate-200 shrink-0" />
                      {/* Margin */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Margin</p>
                        <p className={cn("text-xs font-bold truncate", getMarginStyle(margin).icon)}>{margin.toFixed(1)}%</p>
                      </div>
                    </div>

                    {/* Zone 3 — Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleEdit(accessory)}
                        className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(accessory)}
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

          {/* ── Desktop: full DataTable (hidden on mobile) ─────────── */}
          <div className="hidden md:block">
            <DataTable columns={columns} data={filtered} searchPlaceholder="Search accessories..." />
          </div>
        </>
      )}

      {/* Add / Edit Dialog */}
      <AccessoryFormDialog
        open={dialogOpen}
        onOpenChange={open => {
          setDialogOpen(open)
          if (!open) setEditingAccessory(null)
        }}
        editingAccessory={editingAccessory}
        onSubmit={handleFormSubmit}
        categories={categories}
        onAddCategory={handleAddCategory}
        brands={brands}
        onAddBrand={handleAddBrand}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Accessory"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : "Are you sure you want to delete this accessory?"
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

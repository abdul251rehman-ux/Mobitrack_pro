"use client"

import { useState, useMemo, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import Link from "next/link"
import {
  Plus, Search, MapPin, Phone, Mail, Star,
  Eye, Pencil, Trash2, Building2, Copy,
} from "lucide-react"

import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/lib/api/suppliers"
import { getPurchases } from "@/lib/api/purchases"
import { Supplier, Purchase } from "@/data/types"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils"
import { CITIES } from "@/lib/constants"

// ─── Zod Schema ───────────────────────────────────────────────────────────────
const supplierSchema = z.object({
  companyName:   z.string().min(2, "Company name must be at least 2 characters"),
  contactPerson: z.string().min(2, "Contact person name required"),
  phone:         z.string().min(7, "Valid phone number required"),
  email:         z.string().email("Valid email").optional().or(z.literal("")),
  address:       z.string().min(5, "Address required"),
  city:          z.string().min(1, "City required"),
  notes:         z.string().optional(),
  status:        z.enum(["Active","Inactive"]),
})
type SupplierForm = z.infer<typeof supplierSchema>

// ─── Star Rating Display ──────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={rating >= star ? "text-amber-400 text-xs" : rating >= star - 0.5 ? "text-amber-300 text-xs" : "text-slate-200 text-xs"}>★</span>
      ))}
      <span className="ml-1 text-[10px] font-medium text-slate-400">{rating.toFixed(1)}</span>
    </div>
  )
}

// ─── Supplier Card ────────────────────────────────────────────────────────────
function SupplierCard({
  supplier,
  onEdit,
  onDelete,
}: {
  supplier: Supplier
  onEdit: (s: Supplier) => void
  onDelete: (s: Supplier) => void
}) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard`)
    })
  }

  // Generate a consistent gradient from company name
  const gradients = [
    "from-blue-500 to-indigo-600", "from-violet-500 to-purple-600",
    "from-emerald-500 to-teal-600", "from-amber-500 to-orange-500",
    "from-rose-500 to-pink-600",   "from-cyan-500 to-blue-600",
    "from-indigo-500 to-blue-700", "from-teal-500 to-emerald-600",
  ]
  const gradientIdx = supplier.companyName.charCodeAt(0) % gradients.length
  const headerGradient = gradients[gradientIdx]
  const initials = supplier.companyName
    .split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col overflow-hidden">

      {/* ── Card Header ── */}
      <div className={`bg-linear-to-r ${headerGradient} px-3 pt-3 pb-4`}>
        <div className="flex items-start justify-between gap-2">
          <div className="w-9 h-9 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center shadow-sm shrink-0">
            <span className="text-white font-bold text-xs">{initials}</span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${supplier.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
            {supplier.status}
          </span>
        </div>
        <div className="mt-2">
          <h3 className="font-bold text-white text-sm leading-tight truncate">{supplier.companyName}</h3>
          <p className="text-white/70 text-[10px] mt-0.5 truncate">{supplier.contactPerson}</p>
        </div>
      </div>

      {/* ── Contact Info ── */}
      <div className="px-3 py-2.5 border-b border-slate-100">
        <div className="grid grid-cols-2 gap-1.5 mb-1.5">
          <button onClick={() => copyToClipboard(supplier.phone, "Phone")}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md px-1.5 py-1.5 transition-colors group min-w-0">
            <div className="w-5 h-5 rounded bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0">
              <Phone className="w-2.5 h-2.5 text-slate-500 group-hover:text-blue-600" />
            </div>
            <span className="truncate font-medium">{supplier.phone}</span>
          </button>
          <button onClick={() => copyToClipboard(supplier.email, "Email")}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-md px-1.5 py-1.5 transition-colors group min-w-0">
            <div className="w-5 h-5 rounded bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0">
              <Mail className="w-2.5 h-2.5 text-slate-500 group-hover:text-blue-600" />
            </div>
            <span className="truncate">{supplier.email || "—"}</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5 px-1.5 py-1">
          <div className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center shrink-0">
            <MapPin className="w-2.5 h-2.5 text-slate-500" />
          </div>
          <span className="text-xs text-slate-500 truncate">{supplier.city}{supplier.address ? ` — ${supplier.address}` : ""}</span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="px-3 py-2.5 grid grid-cols-2 gap-2 border-b border-slate-100">
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Purchases</p>
          <p className="text-sm font-bold text-slate-800">{formatCurrency(supplier.totalPurchases)}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Outstanding</p>
          <p className={`text-sm font-bold ${supplier.outstandingBalance > 0 ? "text-red-600" : "text-slate-400"}`}>
            {supplier.outstandingBalance > 0 ? formatCurrency(supplier.outstandingBalance) : "—"}
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <StarRating rating={supplier.rating} />
        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/suppliers/${supplier.id}`}>
            <button className="flex items-center gap-1 h-7 px-2.5 text-[10px] font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors">
              <Eye className="w-3 h-3" />View
            </button>
          </Link>
          <button onClick={() => onEdit(supplier)} title="Edit"
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={() => onDelete(supplier)} title="Delete"
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add / Edit Dialog ────────────────────────────────────────────────────────
function SupplierFormDialog({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Supplier | null
  onSave: (data: SupplierForm, id?: string) => void
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierForm>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      companyName:   editing?.companyName   ?? "",
      contactPerson: editing?.contactPerson ?? "",
      phone:         editing?.phone         ?? "",
      email:         editing?.email         ?? "",
      address:       editing?.address       ?? "",
      city:          (editing?.city as SupplierForm["city"]) ?? "Lahore",
      notes:         editing?.notes         ?? "",
      status:        editing?.status        ?? "Active",
    },
  })

  // Sync form when editing changes
  useMemo(() => {
    reset({
      companyName:   editing?.companyName   ?? "",
      contactPerson: editing?.contactPerson ?? "",
      phone:         editing?.phone         ?? "",
      email:         editing?.email         ?? "",
      address:       editing?.address       ?? "",
      city:          (editing?.city as SupplierForm["city"]) ?? "Lahore",
      notes:         editing?.notes         ?? "",
      status:        editing?.status        ?? "Active",
    })
  }, [editing, reset])

  const statusValue = watch("status")
  const cityValue   = watch("city")

  // When editing a supplier whose city isn't in the preset list, treat as "Other"
  const [customCity, setCustomCity] = useState("")
  useEffect(() => {
    if (editing?.city && !CITIES.slice(0, -1).includes(editing.city as any)) {
      setValue("city", "Other")
      setCustomCity(editing.city)
    } else {
      setCustomCity("")
    }
  }, [editing, setValue])

  const onSubmit = (data: SupplierForm) => {
    if (data.city === "Other" && !customCity.trim()) {
      toast.error("Please enter a city name")
      return
    }
    const finalCity = data.city === "Other" ? customCity.trim() : data.city
    onSave({ ...data, city: finalCity }, editing?.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900">
            {editing ? "Edit Supplier" : "Add New Supplier"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {editing ? `Updating details for ${editing.companyName}` : "Fill in the supplier details below"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-1">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="companyName">Company Name <span className="text-red-500">*</span></Label>
            <Input id="companyName" placeholder="e.g. Cell City Electronics" {...register("companyName")} className={`h-8 text-xs ${errors.companyName ? "border-red-400" : ""}`} />
            {errors.companyName && <p className="text-xs text-red-500">{errors.companyName.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="contactPerson">Contact Person <span className="text-red-500">*</span></Label>
            <Input id="contactPerson" placeholder="e.g. Muhammad Tariq" {...register("contactPerson")} className={`h-8 text-xs ${errors.contactPerson ? "border-red-400" : ""}`} />
            {errors.contactPerson && <p className="text-xs text-red-500">{errors.contactPerson.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="phone">Phone <span className="text-red-500">*</span></Label>
              <Input id="phone" placeholder="+92 300 1234567" {...register("phone")} className={`h-8 text-xs ${errors.phone ? "border-red-400" : ""}`} />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="email">Email <span className="text-slate-400 text-[10px]">(optional)</span></Label>
              <Input id="email" type="email" placeholder="contact@company.pk" {...register("email")} className={`h-8 text-xs ${errors.email ? "border-red-400" : ""}`} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="address">Address <span className="text-red-500">*</span></Label>
            <Input id="address" placeholder="Shop 14, Hall Road Electronics Market" {...register("address")} className={`h-8 text-xs ${errors.address ? "border-red-400" : ""}`} />
            {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">City <span className="text-red-500">*</span></Label>
            <Select value={cityValue} onValueChange={(v) => { setValue("city", v, { shouldValidate: true }); if (v !== "Other") setCustomCity("") }}>
              <SelectTrigger className={`h-8 text-xs ${errors.city ? "border-red-400" : ""}`}><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c} className={c === "Other" ? "font-medium text-blue-600 border-t border-slate-100 mt-1 pt-1" : ""}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cityValue === "Other" && (
              <Input
                placeholder="Enter city name..."
                value={customCity}
                onChange={e => setCustomCity(e.target.value)}
                className={`h-8 text-xs mt-1 ${!customCity.trim() ? "border-amber-400" : ""}`}
                autoFocus
              />
            )}
            {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Any additional notes..." rows={2} {...register("notes")} className="text-xs" />
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <p className="text-xs font-medium text-slate-700">Account Status</p>
              <p className="text-[10px] text-slate-400">{statusValue === "Active" ? "Active — can receive orders" : "Inactive"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${statusValue === "Active" ? "text-emerald-600" : "text-slate-400"}`}>{statusValue}</span>
              <Switch checked={statusValue === "Active"} onCheckedChange={(checked) => setValue("status", checked ? "Active" : "Inactive")} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]">
              {editing ? "Save Changes" : "Add Supplier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SuppliersPage() {
  const [supplierList, setSupplierList] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [data, allPurchases] = await Promise.all([
          getSuppliers(),
          getPurchases(),
        ])

        // Calculate real totalPurchases and outstandingBalance from purchases data
        const purchasesBySupplier = new Map<string, { total: number; balance: number }>()
        allPurchases.forEach((p) => {
          const existing = purchasesBySupplier.get(p.supplierId) || { total: 0, balance: 0 }
          existing.total += p.total
          existing.balance += p.balanceDue
          purchasesBySupplier.set(p.supplierId, existing)
        })

        const enriched = data.map((s) => {
          const stats = purchasesBySupplier.get(s.id)
          return {
            ...s,
            totalPurchases: stats?.total ?? 0,
            outstandingBalance: stats?.balance ?? 0,
          }
        })

        setSupplierList(enriched)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch suppliers")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search,       setSearch]       = useState("")
  const [cityFilter,   setCityFilter]   = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [ratingFilter, setRatingFilter] = useState("all")

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [formOpen,       setFormOpen]       = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<Supplier | null>(null)
  const [deleteOpen,     setDeleteOpen]     = useState(false)

  // ── Derived / filtered list ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return supplierList.filter((s) => {
      if (q && !(
        s.companyName.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q)
      )) return false

      if (cityFilter   !== "all" && s.city   !== cityFilter)   return false
      if (statusFilter !== "all" && s.status !== statusFilter) return false

      if (ratingFilter === "5star" && s.rating < 4.75)  return false
      if (ratingFilter === "4plus" && s.rating < 4.0)   return false
      if (ratingFilter === "3plus" && s.rating < 3.0)   return false

      return true
    })
  }, [supplierList, search, cityFilter, statusFilter, ratingFilter])

  // ── Cities for filter (unique from data) ─────────────────────────────────
  const uniqueCities = useMemo(() => {
    return Array.from(new Set(supplierList.map((s) => s.city).filter(Boolean))).sort()
  }, [supplierList])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddClick = () => {
    setEditingSupplier(null)
    setFormOpen(true)
  }

  const handleEditClick = (s: Supplier) => {
    setEditingSupplier(s)
    setFormOpen(true)
  }

  const handleDeleteClick = (s: Supplier) => {
    setDeleteTarget(s)
    setDeleteOpen(true)
  }

  const handleSave = async (data: SupplierForm, id?: string) => {
    try {
      if (id) {
        const updated = await updateSupplier(id, {
          companyName:   data.companyName,
          contactPerson: data.contactPerson,
          phone:         data.phone,
          email:         data.email,
          address:       data.address,
          city:          data.city,
          notes:         data.notes,
          status:        data.status,
        })
        setSupplierList((prev) =>
          prev.map((s) => (s.id === id ? updated : s))
        )
        toast.success(`${data.companyName} updated successfully`)
      } else {
        const created = await createSupplier({
          companyName:        data.companyName,
          contactPerson:      data.contactPerson,
          phone:              data.phone,
          email:              data.email || "",
          address:            data.address,
          city:               data.city,
          totalPurchases:     0,
          outstandingBalance: 0,
          rating:             0,
          status:             data.status,
          notes:              data.notes,
        })
        setSupplierList((prev) => [created, ...prev])
        toast.success(`${data.companyName} added successfully`)
      }
      setFormOpen(false)
      setEditingSupplier(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save supplier")
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteSupplier(deleteTarget.id)
      setSupplierList((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      toast.success(`${deleteTarget.companyName} deleted`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete supplier")
    }
    setDeleteOpen(false)
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-slate-900">Suppliers</h1>
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">{supplierList.length}</span>
        </div>
        <button onClick={handleAddClick} className="flex items-center gap-1.5 h-8 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm">
          <Plus className="w-3.5 h-3.5" />Add Supplier
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-slate-200">
        <div className="relative shrink-0 w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs" />
        </div>
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-32 h-8 text-xs shrink-0">
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {uniqueCities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28 h-8 text-xs shrink-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-32 h-8 text-xs shrink-0">
            <SelectValue placeholder="Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5star">★★★★★ 5 Stars</SelectItem>
            <SelectItem value="4plus">★★★★ 4+ Stars</SelectItem>
            <SelectItem value="3plus">★★★ 3+ Stars</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">{filtered.length} of {supplierList.length} suppliers</span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="w-10 h-10 text-slate-200 mb-3" />
          <h3 className="text-sm font-semibold text-slate-500 mb-1">No suppliers found</h3>
          <p className="text-xs text-slate-400">
            Try adjusting your filters or{" "}
            <button onClick={handleAddClick} className="text-blue-600 hover:underline font-medium">add a new supplier</button>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <SupplierCard key={s.id} supplier={s} onEdit={handleEditClick} onDelete={handleDeleteClick} />
          ))}
        </div>
      )}

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditingSupplier(null) }}
        editing={editingSupplier}
        onSave={handleSave}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Supplier"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.companyName}"? This action cannot be undone.` : "Are you sure?"}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}

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
import { Supplier } from "@/data/types"
import { PageWrapper } from "@/components/layout/page-wrapper"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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

// ─── Constants ────────────────────────────────────────────────────────────────
const CITIES = [
  "Lahore", "Karachi", "Islamabad", "Faisalabad",
  "Rawalpindi", "Peshawar", "Multan",
] as const

// ─── Zod Schema ───────────────────────────────────────────────────────────────
const supplierSchema = z.object({
  companyName:   z.string().min(2, "Company name must be at least 2 characters"),
  contactPerson: z.string().min(2, "Contact person name required"),
  phone:         z.string().min(7, "Valid phone number required"),
  email:         z.string().email("Valid email required"),
  address:       z.string().min(5, "Address required"),
  city:          z.enum(["Lahore","Karachi","Islamabad","Faisalabad","Rawalpindi","Peshawar","Multan"]),
  notes:         z.string().optional(),
  status:        z.enum(["Active","Inactive"]),
})
type SupplierForm = z.infer<typeof supplierSchema>

// ─── Star Rating Display ──────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" title={`${rating} / 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rating >= star
        const half   = !filled && rating >= star - 0.5
        return (
          <span
            key={star}
            className={
              filled ? "text-amber-400 text-sm" :
              half   ? "text-amber-300 text-sm" :
                       "text-slate-200 text-sm"
            }
          >
            ★
          </span>
        )
      })}
      <span className="ml-1 text-xs font-medium text-slate-500">{rating.toFixed(1)}</span>
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
    <div className="bg-white rounded-2xl border border-slate-200/80 hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 hover:-translate-y-1 flex flex-col overflow-hidden">
      {/* Gradient header */}
      <div className={`bg-linear-to-br ${headerGradient} h-20 relative overflow-hidden flex items-end px-5 pb-0`}>
        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-6 -left-2 w-16 h-16 rounded-full bg-white/10 pointer-events-none" />
        {/* Initials avatar */}
        <div className="relative z-10 w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center translate-y-6 shadow-lg">
          <span className="text-white font-bold text-base">{initials}</span>
        </div>
        {/* Status badge */}
        <div className="ml-auto mb-2 relative z-10">
          <StatusBadge status={supplier.status} className="bg-white/90 border-white/50 text-slate-700" />
        </div>
      </div>

      {/* Name below header */}
      <div className="pt-8 px-5 pb-3">
        <h3 className="font-bold text-slate-900 text-base leading-tight truncate">
          {supplier.companyName}
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">{supplier.contactPerson}</p>
      </div>

      {/* Contact Info */}
      <div className="px-5 pb-3 space-y-1.5">
        <button
          onClick={() => copyToClipboard(supplier.phone, "Phone")}
          className="w-full flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-1 -mx-2 transition-colors group"
        >
          <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
          <span className="truncate">{supplier.phone}</span>
          <Copy className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
        <button
          onClick={() => copyToClipboard(supplier.email, "Email")}
          className="w-full flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-1 -mx-2 transition-colors group"
        >
          <Mail className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
          <span className="truncate">{supplier.email}</span>
          <Copy className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
        <div className="flex items-start gap-2 text-sm text-slate-500 px-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span className="truncate">{supplier.city} — {supplier.address}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-slate-100" />

      {/* Stats */}
      <div className="px-5 py-3 grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-2.5">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">
            Total Purchases
          </p>
          <p className="text-sm font-bold text-slate-800 truncate">
            {formatCurrency(supplier.totalPurchases)}
          </p>
        </div>
        <div className={`rounded-xl p-2.5 ${supplier.outstandingBalance > 0 ? "bg-red-50" : "bg-slate-50"}`}>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">
            Outstanding
          </p>
          <p className={`text-sm font-bold truncate ${supplier.outstandingBalance > 0 ? "text-red-600" : "text-slate-800"}`}>
            {supplier.outstandingBalance > 0
              ? formatCurrency(supplier.outstandingBalance)
              : "—"}
          </p>
        </div>
      </div>

      {/* Rating */}
      <div className="px-5 pb-3">
        <StarRating rating={supplier.rating} />
      </div>

      {/* Divider */}
      <div className="mx-5 border-t border-slate-100" />

      {/* Actions */}
      <div className="px-5 py-3 flex items-center justify-between gap-2 mt-auto">
        <Link href={`/suppliers/${supplier.id}`} className="flex-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
          >
            <Eye className="w-3.5 h-3.5" />
            View Details
          </Button>
        </Link>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
            onClick={() => onEdit(supplier)}
            title="Edit supplier"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
            onClick={() => onDelete(supplier)}
            title="Delete supplier"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
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

  const onSubmit = (data: SupplierForm) => {
    onSave(data, editing?.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            {editing ? "Edit Supplier" : "Add New Supplier"}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {editing
              ? `Updating details for ${editing.companyName}`
              : "Fill in the supplier details below"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {/* Company Name */}
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Company Name <span className="text-red-500">*</span></Label>
            <Input
              id="companyName"
              placeholder="e.g. Cell City Electronics"
              {...register("companyName")}
              className={errors.companyName ? "border-red-400" : ""}
            />
            {errors.companyName && (
              <p className="text-xs text-red-500">{errors.companyName.message}</p>
            )}
          </div>

          {/* Contact Person */}
          <div className="space-y-1.5">
            <Label htmlFor="contactPerson">Contact Person <span className="text-red-500">*</span></Label>
            <Input
              id="contactPerson"
              placeholder="e.g. Muhammad Tariq"
              {...register("contactPerson")}
              className={errors.contactPerson ? "border-red-400" : ""}
            />
            {errors.contactPerson && (
              <p className="text-xs text-red-500">{errors.contactPerson.message}</p>
            )}
          </div>

          {/* Phone + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone <span className="text-red-500">*</span></Label>
              <Input
                id="phone"
                placeholder="+92 300 1234567"
                {...register("phone")}
                className={errors.phone ? "border-red-400" : ""}
              />
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@company.pk"
                {...register("email")}
                className={errors.email ? "border-red-400" : ""}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="address">Address <span className="text-red-500">*</span></Label>
            <Input
              id="address"
              placeholder="Shop 14, Hall Road Electronics Market"
              {...register("address")}
              className={errors.address ? "border-red-400" : ""}
            />
            {errors.address && (
              <p className="text-xs text-red-500">{errors.address.message}</p>
            )}
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label>City <span className="text-red-500">*</span></Label>
            <Select
              value={cityValue}
              onValueChange={(v) => setValue("city", v as SupplierForm["city"])}
            >
              <SelectTrigger className={errors.city ? "border-red-400" : ""}>
                <SelectValue placeholder="Select city" />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.city && (
              <p className="text-xs text-red-500">{errors.city.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about this supplier..."
              rows={3}
              {...register("notes")}
            />
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-700">Account Status</p>
              <p className="text-xs text-slate-400">
                {statusValue === "Active" ? "Supplier is active and can receive orders" : "Supplier is inactive"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${statusValue === "Active" ? "text-emerald-600" : "text-slate-400"}`}>
                {statusValue}
              </span>
              <Switch
                checked={statusValue === "Active"}
                onCheckedChange={(checked) =>
                  setValue("status", checked ? "Active" : "Inactive")
                }
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
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
        const data = await getSuppliers()
        setSupplierList(data)
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
          email:              data.email,
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
      <PageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <PageHeader
        title="Suppliers"
        description="Manage your supplier network and purchase relationships"
        badge={
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-700 font-semibold px-2.5"
          >
            {supplierList.length}
          </Badge>
        }
        action={
          <Button
            onClick={handleAddClick}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </Button>
        }
      />

      {/* ── Filter Bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search suppliers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* City filter */}
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {uniqueCities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        {/* Rating filter */}
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
            <SelectValue placeholder="Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5star">★★★★★ 5 Stars</SelectItem>
            <SelectItem value="4plus">★★★★ 4+ Stars</SelectItem>
            <SelectItem value="3plus">★★★ 3+ Stars</SelectItem>
          </SelectContent>
        </Select>

        {/* Result count */}
        <span className="text-sm text-slate-400 ml-auto whitespace-nowrap">
          {filtered.length} of {supplierList.length} suppliers
        </span>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Building2 className="w-12 h-12 text-slate-200 mb-4" />
          <h3 className="text-base font-semibold text-slate-500 mb-1">No suppliers found</h3>
          <p className="text-sm text-slate-400">
            Try adjusting your filters or{" "}
            <button
              onClick={handleAddClick}
              className="text-blue-600 hover:underline font-medium"
            >
              add a new supplier
            </button>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────── */}
      <SupplierFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v)
          if (!v) setEditingSupplier(null)
        }}
        editing={editingSupplier}
        onSave={handleSave}
      />

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Supplier"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.companyName}"? This action cannot be undone.`
            : "Are you sure?"
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </PageWrapper>
  )
}

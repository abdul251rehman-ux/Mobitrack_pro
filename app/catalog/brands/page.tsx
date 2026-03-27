"use client"

import { useState, useMemo, useEffect } from "react"
import { Plus, Pencil, Trash2, Award, Smartphone, Package, Globe, Search, Calendar } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"

interface Brand {
  id: string
  name: string
  country: string
  logoInitials: string
  mobileCount: number
  accessoryCount: number
  status: "Active" | "Inactive"
  description: string
  createdAt: string
}
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { DataTable } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageWrapper } from "@/components/layout/page-wrapper"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/utils"

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BrandsPage() {
  const [list, setList] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Brand | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null)
  const [mobileSearch, setMobileSearch] = useState("")

  // form state
  const [formName, setFormName] = useState("")
  const [formCountry, setFormCountry] = useState("")
  const [formInitials, setFormInitials] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formStatus, setFormStatus] = useState<Brand["status"]>("Active")
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // ── Fetch brands from Supabase ──────────────────────────────────────────────
  async function fetchBrands() {
    try {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      const mapped: Brand[] = (data ?? []).map((b: Record<string, unknown>) => ({
        id: b.id as string,
        name: b.name as string,
        country: b.country as string,
        logoInitials: (b.logo_initials ?? (b.name as string).slice(0, 2).toUpperCase()) as string,
        mobileCount: (b.mobile_count ?? 0) as number,
        accessoryCount: (b.accessory_count ?? 0) as number,
        status: (b.status ?? "Active") as Brand["status"],
        description: (b.description ?? "") as string,
        createdAt: (b.created_at ?? new Date().toISOString()) as string,
      }))
      setList(mapped)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch brands")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBrands()
  }, [])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: list.length,
    active: list.filter((b) => b.status === "Active").length,
    inactive: list.filter((b) => b.status === "Inactive").length,
    totalMobiles: list.reduce((s, b) => s + b.mobileCount, 0),
    totalAccessories: list.reduce((s, b) => s + b.accessoryCount, 0),
  }), [list])

  // ── Open dialog ────────────────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null)
    setFormName("")
    setFormCountry("")
    setFormInitials("")
    setFormDesc("")
    setFormStatus("Active")
    setFormErrors({})
    setDialogOpen(true)
  }

  function openEdit(brand: Brand) {
    setEditTarget(brand)
    setFormName(brand.name)
    setFormCountry(brand.country)
    setFormInitials(brand.logoInitials)
    setFormDesc(brand.description)
    setFormStatus(brand.status)
    setFormErrors({})
    setDialogOpen(true)
  }

  // ── Auto-generate initials ─────────────────────────────────────────────────
  function handleNameChange(val: string) {
    setFormName(val)
    if (!editTarget) {
      const parts = val.trim().split(" ")
      const auto = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : val.slice(0, 2).toUpperCase()
      setFormInitials(auto)
    }
    if (formErrors.name) setFormErrors((p) => ({ ...p, name: "" }))
  }

  // ── Validate ───────────────────────────────────────────────────────────────
  function validate() {
    const errs: Record<string, string> = {}
    if (!formName.trim()) errs.name = "Brand name is required"
    else if (
      list.some(
        (b) =>
          b.name.toLowerCase() === formName.trim().toLowerCase() &&
          b.id !== editTarget?.id
      )
    )
      errs.name = "Brand name already exists"
    if (!formCountry.trim()) errs.country = "Country is required"
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return
    try {
      if (editTarget) {
        const { error } = await supabase
          .from('brands')
          .update({
            name: formName.trim(),
            country: formCountry.trim(),
            logo_initials: formInitials.trim().toUpperCase().slice(0, 2) || formName.slice(0, 2).toUpperCase(),
            description: formDesc.trim(),
            status: formStatus,
          })
          .eq('id', editTarget.id)
        if (error) throw error
        toast.success("Brand updated successfully")
      } else {
        const { error } = await supabase
          .from('brands')
          .insert({
            tenant_id: await getTenantId(),
            name: formName.trim(),
            country: formCountry.trim(),
            logo_initials: formInitials.trim().toUpperCase().slice(0, 2) || formName.slice(0, 2).toUpperCase(),
            mobile_count: 0,
            accessory_count: 0,
            status: formStatus,
            description: formDesc.trim(),
          })
        if (error) throw error
        toast.success("Brand added successfully")
      }
      setDialogOpen(false)
      await fetchBrands()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save brand")
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', deleteTarget.id)
      if (error) throw error
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      await fetchBrands()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete brand")
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Brand>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Brand",
      cell: ({ row }) => {
        const b = row.original
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white text-xs font-bold">{b.logoInitials}</span>
            </div>
            <div>
              <p className="font-semibold text-slate-800">{b.name}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {b.country}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "mobileCount",
      header: "Mobiles",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5 text-blue-500" />
          <span className="font-medium text-slate-700">{row.original.mobileCount}</span>
        </div>
      ),
    },
    {
      accessorKey: "accessoryCount",
      header: "Accessories",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-700">{row.original.accessoryCount}</span>
        </div>
      ),
    },
    {
      id: "total",
      header: "Total Products",
      cell: ({ row }) => {
        const total = row.original.mobileCount + row.original.accessoryCount
        return (
          <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">
            {total}
          </span>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Added",
      cell: ({ row }) => (
        <span className="text-slate-500 text-sm">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => openEdit(row.original)}
            className="hover:text-blue-600 hover:bg-blue-50"
            title="Edit brand"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleteTarget(row.original)}
            className="hover:text-red-500 hover:bg-red-50"
            title="Delete brand"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ], [])

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Loading brands...</p>
          </div>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <PageHeader
        title="Brands"
        description="Manage mobile and accessory brands in your catalog"
        action={
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add Brand
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total Brands" value={String(stats.total)} icon={Award} subtext={`${stats.active} active`} />
        <StatCard title="Active Brands" value={String(stats.active)} icon={Globe} subtext="Currently in use" />
        <StatCard title="Mobile Products" value={String(stats.totalMobiles)} icon={Smartphone} subtext="Across all brands" />
        <StatCard title="Accessories" value={String(stats.totalAccessories)} icon={Package} subtext="Across all brands" />
      </div>

      {/* Mobile Cards (md:hidden) */}
      <div className="md:hidden space-y-3">
        {/* Mobile search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search brands..."
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-10 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>

        {/* Cards */}
        {list
          .filter((b) => b.name.toLowerCase().includes(mobileSearch.toLowerCase()))
          .map((brand) => {
            const accentColor = brand.status === "Active" ? "bg-emerald-500" : "bg-slate-300"
            const total = brand.mobileCount + brand.accessoryCount

            return (
              <div
                key={brand.id}
                className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Left accent strip */}
                <div className={`w-1 shrink-0 ${accentColor}`} />

                {/* Card body */}
                <div className="flex-1 p-3 min-w-0">
                  {/* Zone 1: Logo + Name/Country + Status */}
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                      <span className="text-white text-xs font-bold">{brand.logoInitials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{brand.name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Globe className="w-3 h-3" />
                        {brand.country}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                      brand.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}>
                      {brand.status}
                    </span>
                  </div>

                  {/* Zone 2: Product count chips */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-medium">
                      <Smartphone className="w-3 h-3" />
                      {brand.mobileCount} Mobiles
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium">
                      <Package className="w-3 h-3" />
                      {brand.accessoryCount} Acc.
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-medium">
                      Total: {total}
                    </span>
                  </div>

                  {/* Zone 3: Description + Date */}
                  {brand.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-1.5">{brand.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-slate-400 mb-2.5">
                    <Calendar className="w-3 h-3" />
                    {formatDate(brand.createdAt)}
                  </div>

                  {/* Zone 4: Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => openEdit(brand)}
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => setDeleteTarget(brand)}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}

        {list.filter((b) => b.name.toLowerCase().includes(mobileSearch.toLowerCase())).length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">No brands found</div>
        )}
      </div>

      {/* Desktop Table (hidden md:block) */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={list}
          searchKey="name"
          searchPlaceholder="Search brands..."
        />
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Brand" : "Add New Brand"}</DialogTitle>
            <DialogDescription>
              {editTarget ? "Update the brand details below." : "Fill in the details to add a new brand."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand-name">
                  Brand Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="brand-name"
                  placeholder="e.g. Samsung"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={formErrors.name ? "border-red-400" : ""}
                />
                {formErrors.name && (
                  <p className="text-xs text-red-500">{formErrors.name}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="brand-initials">
                  Logo Initials{" "}
                  <span className="text-slate-400 font-normal text-xs">(2 chars)</span>
                </Label>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                    <span className="text-white text-xs font-bold">
                      {formInitials || "??"}
                    </span>
                  </div>
                  <Input
                    id="brand-initials"
                    placeholder="SM"
                    value={formInitials}
                    onChange={(e) => setFormInitials(e.target.value.toUpperCase().slice(0, 2))}
                    maxLength={2}
                    className="text-center font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand-country">
                  Country <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="brand-country"
                  placeholder="e.g. South Korea"
                  value={formCountry}
                  onChange={(e) => {
                    setFormCountry(e.target.value)
                    if (formErrors.country) setFormErrors((p) => ({ ...p, country: "" }))
                  }}
                  className={formErrors.country ? "border-red-400" : ""}
                />
                {formErrors.country && (
                  <p className="text-xs text-red-500">{formErrors.country}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as Brand["status"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="brand-desc">
                Description{" "}
                <span className="text-slate-400 font-normal text-xs">(optional)</span>
              </Label>
              <Textarea
                id="brand-desc"
                placeholder="Brief description of this brand..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editTarget ? "Save Changes" : "Add Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Brand"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
      />
    </PageWrapper>
  )
}

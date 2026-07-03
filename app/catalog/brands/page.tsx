"use client"

import { useState, useMemo, useEffect } from "react"
import { Plus, Pencil, Trash2, Award, Smartphone, Package, Globe, Search, Lock, Calendar } from "lucide-react"
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
  isSystem: boolean
}

import { DataTable } from "@/components/shared/data-table"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/utils"

// ─── Status chip ──────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: Brand["status"] }) {
  return status === "Active" ? (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
      Active
    </span>
  ) : (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
      Inactive
    </span>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BrandsPage() {
  const [list, setList] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Brand | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null)
  const [mobileSearch, setMobileSearch] = useState("")

  const [formName, setFormName] = useState("")
  const [formCountry, setFormCountry] = useState("")
  const [formInitials, setFormInitials] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formStatus, setFormStatus] = useState<Brand["status"]>("Active")
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  async function fetchBrands() {
    try {
      const [{ data, error }, { data: mobiles }, { data: accessories }] = await Promise.all([
        supabase.from("brands").select("*").order("created_at", { ascending: false }),
        supabase.from("mobiles").select("brand"),
        supabase.from("accessories").select("brand"),
      ])
      if (error) throw error

      // Count real products per brand (case-insensitive match)
      const mobileCountMap: Record<string, number> = {}
      for (const m of mobiles ?? []) {
        if (m.brand) mobileCountMap[m.brand.toLowerCase()] = (mobileCountMap[m.brand.toLowerCase()] ?? 0) + 1
      }
      const accessoryCountMap: Record<string, number> = {}
      for (const a of accessories ?? []) {
        if (a.brand) accessoryCountMap[a.brand.toLowerCase()] = (accessoryCountMap[a.brand.toLowerCase()] ?? 0) + 1
      }

      const mapped: Brand[] = (data ?? []).map((b: Record<string, unknown>) => {
        const key = (b.name as string).toLowerCase()
        return {
          id: b.id as string,
          name: b.name as string,
          country: b.country as string,
          logoInitials: (b.logo_initials ?? (b.name as string).slice(0, 2).toUpperCase()) as string,
          mobileCount: mobileCountMap[key] ?? 0,
          accessoryCount: accessoryCountMap[key] ?? 0,
          status: (b.status ?? "Active") as Brand["status"],
          description: (b.description ?? "") as string,
          createdAt: (b.created_at ?? new Date().toISOString()) as string,
          isSystem: (b.is_system ?? false) as boolean,
        }
      })
      setList(mapped)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch brands")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBrands() }, [])

  const stats = useMemo(() => ({
    total:            list.length,
    active:           list.filter((b) => b.status === "Active").length,
    totalMobiles:     list.reduce((s, b) => s + b.mobileCount, 0),
    totalAccessories: list.reduce((s, b) => s + b.accessoryCount, 0),
  }), [list])

  function openAdd() {
    setEditTarget(null); setFormName(""); setFormCountry(""); setFormInitials("")
    setFormDesc(""); setFormStatus("Active"); setFormErrors({})
    setDialogOpen(true)
  }
  function openEdit(brand: Brand) {
    setEditTarget(brand); setFormName(brand.name); setFormCountry(brand.country)
    setFormInitials(brand.logoInitials); setFormDesc(brand.description); setFormStatus(brand.status)
    setFormErrors({})
    setDialogOpen(true)
  }

  function handleNameChange(val: string) {
    setFormName(val)
    if (!editTarget) {
      const parts = val.trim().split(" ")
      setFormInitials(
        parts.length >= 2
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : val.slice(0, 2).toUpperCase()
      )
    }
    if (formErrors.name) setFormErrors((p) => ({ ...p, name: "" }))
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!formName.trim()) errs.name = "Brand name is required"
    else if (list.some((b) => b.name.toLowerCase() === formName.trim().toLowerCase() && b.id !== editTarget?.id))
      errs.name = "Brand name already exists"
    if (!formCountry.trim()) errs.country = "Country is required"
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    try {
      const initials = formInitials.trim().toUpperCase().slice(0, 2) || formName.slice(0, 2).toUpperCase()
      if (editTarget) {
        const { error } = await supabase.from("brands")
          .update({ name: formName.trim(), country: formCountry.trim(), logo_initials: initials, description: formDesc.trim(), status: formStatus })
          .eq("id", editTarget.id)
        if (error) throw error
        toast.success("Brand updated successfully")
      } else {
        const { error } = await supabase.from("brands").insert({
          tenant_id: await getTenantId(),
          name: formName.trim(), country: formCountry.trim(), logo_initials: initials,
          mobile_count: 0, accessory_count: 0, status: formStatus, description: formDesc.trim(),
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

  async function handleDelete() {
    if (!deleteTarget) return
    if (deleteTarget.isSystem) { toast.error("System brands cannot be deleted"); return }
    try {
      const { error } = await supabase.from("brands").delete().eq("id", deleteTarget.id)
      if (error) throw error
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      await fetchBrands()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete brand")
    }
  }

  const columns: ColumnDef<Brand>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Brand",
      cell: ({ row }) => {
        const b = row.original
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white text-[10px] font-bold">{b.logoInitials}</span>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <p className="text-xs font-semibold text-slate-800">{b.name}</p>
                {b.isSystem && (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                    <Lock className="w-2 h-2" /> System
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                <Globe className="w-2.5 h-2.5" />{b.country}
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
        <div className="flex items-center gap-1">
          <Smartphone className="w-3 h-3 text-blue-400" />
          <span className="text-xs font-medium text-slate-700">{row.original.mobileCount}</span>
        </div>
      ),
    },
    {
      accessorKey: "accessoryCount",
      header: "Accessories",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Package className="w-3 h-3 text-slate-400" />
          <span className="text-xs font-medium text-slate-700">{row.original.accessoryCount}</span>
        </div>
      ),
    },
    {
      id: "total",
      header: "Total Products",
      cell: ({ row }) => {
        const total = row.original.mobileCount + row.original.accessoryCount
        return (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
            {total}
          </span>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      accessorKey: "createdAt",
      header: "Added",
      cell: ({ row }) => (
        <span className="text-xs text-slate-400">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const b = row.original
        return (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => openEdit(b)}
              className="p-1 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {b.isSystem ? (
              <span className="p-1 text-amber-300 cursor-not-allowed" title="System brand - cannot be deleted">
                <Lock className="w-3.5 h-3.5" />
              </span>
            ) : (
              <button
                onClick={() => setDeleteTarget(b)}
                className="p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )
      },
    },
  ], [])

  const statCards = [
    { title: "Total Brands",     value: stats.total,            sub: `${stats.active} active`,    Icon: Award,       iconBg: "bg-blue-500"   },
    { title: "Active Brands",    value: stats.active,           sub: "Currently in use",          Icon: Globe,       iconBg: "bg-emerald-500"},
    { title: "Mobile Products",  value: stats.totalMobiles,     sub: "Across all brands",         Icon: Smartphone,  iconBg: "bg-sky-500"    },
    { title: "Accessories",      value: stats.totalAccessories, sub: "Across all brands",         Icon: Package,     iconBg: "bg-slate-500"  },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">

      {/* ── Compact header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Award className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Brands</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Manage mobile and accessory brands in your catalog</p>
          </div>
        </div>
        <Button onClick={openAdd} size="sm" className="h-8 text-xs gap-1.5 px-3">
          <Plus className="w-3.5 h-3.5" />
          Add Brand
        </Button>
      </div>

      {/* ── 4 stat cards in one row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2.5">
        {statCards.map((card) => (
          <div key={card.title} className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none">{card.title}</p>
              <div className={`w-6 h-6 rounded-md ${card.iconBg} flex items-center justify-center shrink-0`}>
                <card.Icon className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <p className="text-lg font-bold text-slate-900 leading-none">{card.value}</p>
            <p className="text-[10px] text-slate-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Mobile cards (md:hidden) ────────────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search brands..."
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        {list
          .filter((b) => b.name.toLowerCase().includes(mobileSearch.toLowerCase()))
          .map((brand) => {
            const accentBg = brand.status === "Active" ? "bg-emerald-500" : "bg-slate-300"
            const total = brand.mobileCount + brand.accessoryCount
            return (
              <div key={brand.id} className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className={`w-1 shrink-0 ${accentBg}`} />
                <div className="flex-1 p-2.5 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-white text-[10px] font-bold">{brand.logoInitials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-semibold text-slate-800 truncate">{brand.name}</p>
                        {brand.isSystem && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-600 border border-amber-200 shrink-0">
                            <Lock className="w-2 h-2" />
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Globe className="w-2.5 h-2.5" />{brand.country}
                      </p>
                    </div>
                    <StatusChip status={brand.status} />
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
                      <Smartphone className="w-2.5 h-2.5" />{brand.mobileCount} Mobiles
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                      <Package className="w-2.5 h-2.5" />{brand.accessoryCount} Acc.
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium">
                      Total: {total}
                    </span>
                  </div>
                  {brand.description && (
                    <p className="text-[10px] text-slate-400 line-clamp-1 mb-1">{brand.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-2">
                    <Calendar className="w-2.5 h-2.5" />{formatDate(brand.createdAt)}
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => openEdit(brand)}>
                      <Pencil className="w-3 h-3" />Edit
                    </Button>
                    {brand.isSystem ? (
                      <Button variant="outline" size="sm" disabled className="flex-1 h-7 text-[10px] gap-1 text-amber-400 border-amber-200 cursor-not-allowed opacity-60">
                        <Lock className="w-3 h-3" />Locked
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-red-500 border-red-200 hover:bg-red-50" onClick={() => setDeleteTarget(brand)}>
                        <Trash2 className="w-3 h-3" />Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        {list.filter((b) => b.name.toLowerCase().includes(mobileSearch.toLowerCase())).length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">No brands found</div>
        )}
      </div>

      {/* ── Desktop table ───────────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <DataTable columns={columns} data={list} searchKey="name" searchPlaceholder="Search brands..." />
      </div>

      {/* ── Add / Edit Dialog ───────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editTarget ? "Edit Brand" : "Add New Brand"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Row 1: Name + Initials */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Brand Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. Samsung"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className={`h-8 text-xs ${formErrors.name ? "border-red-400" : ""}`}
                />
                {formErrors.name && <p className="text-[10px] text-red-500">{formErrors.name}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  Initials <span className="text-slate-400 font-normal">(2 chars)</span>
                </Label>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-bold">{formInitials || "??"}</span>
                  </div>
                  <Input
                    placeholder="SM"
                    value={formInitials}
                    onChange={(e) => setFormInitials(e.target.value.toUpperCase().slice(0, 2))}
                    maxLength={2}
                    className="h-8 text-xs text-center font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Country + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Country <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. South Korea"
                  value={formCountry}
                  onChange={(e) => { setFormCountry(e.target.value); if (formErrors.country) setFormErrors((p) => ({ ...p, country: "" })) }}
                  className={`h-8 text-xs ${formErrors.country ? "border-red-400" : ""}`}
                />
                {formErrors.country && <p className="text-[10px] text-red-500">{formErrors.country}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={formStatus} onValueChange={(v) => setFormStatus(v as Brand["status"])}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs">
                Description <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="Brief description of this brand..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                className="resize-none text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave}>
              {editTarget ? "Save Changes" : "Add Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Brand"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
      />
    </div>
  )
}

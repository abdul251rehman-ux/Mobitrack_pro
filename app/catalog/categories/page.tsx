"use client"

import { useState, useMemo, useEffect } from "react"
import { Plus, Pencil, Trash2, Tag, Smartphone, Package, Layers, Search, Calendar, Hash } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"

interface Category {
  id: string
  name: string
  type: "Mobile" | "Accessory" | "Both"
  description: string
  itemCount: number
  createdAt: string
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

// ─── Type chip ────────────────────────────────────────────────────────────────
function TypeChip({ type }: { type: Category["type"] }) {
  const cfg = {
    Mobile:    "bg-blue-50 text-blue-700 border-blue-200",
    Accessory: "bg-slate-50 text-slate-600 border-slate-200",
    Both:      "bg-violet-50 text-violet-700 border-violet-200",
  }
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${cfg[type]}`}>
      {type}
    </span>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CategoriesPage() {
  const [list, setList] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [mobileSearch, setMobileSearch] = useState("")

  const [formName, setFormName] = useState("")
  const [formType, setFormType] = useState<Category["type"]>("Mobile")
  const [formDesc, setFormDesc] = useState("")
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  async function fetchCategories() {
    try {
      const [{ data, error }, { data: mobiles }, { data: accessories }] = await Promise.all([
        supabase.from("categories").select("*").order("created_at", { ascending: false }),
        supabase.from("mobiles").select("category"),
        supabase.from("accessories").select("category"),
      ])
      if (error) throw error

      // Count real products per category (case-insensitive match)
      const countMap: Record<string, number> = {}
      for (const m of mobiles ?? []) {
        if (m.category) countMap[m.category.toLowerCase()] = (countMap[m.category.toLowerCase()] ?? 0) + 1
      }
      for (const a of accessories ?? []) {
        if (a.category) countMap[a.category.toLowerCase()] = (countMap[a.category.toLowerCase()] ?? 0) + 1
      }

      const mapped: Category[] = (data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        type: (c.type ?? "Mobile") as Category["type"],
        description: (c.description ?? "") as string,
        itemCount: countMap[(c.name as string).toLowerCase()] ?? 0,
        createdAt: (c.created_at ?? new Date().toISOString()) as string,
      }))
      setList(mapped)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCategories() }, [])

  const stats = useMemo(() => ({
    total:     list.length,
    mobile:    list.filter((c) => c.type === "Mobile").length,
    accessory: list.filter((c) => c.type === "Accessory").length,
    both:      list.filter((c) => c.type === "Both").length,
    totalItems: list.reduce((s, c) => s + c.itemCount, 0),
  }), [list])

  function openAdd() {
    setEditTarget(null); setFormName(""); setFormType("Mobile"); setFormDesc(""); setFormErrors({})
    setDialogOpen(true)
  }
  function openEdit(cat: Category) {
    setEditTarget(cat); setFormName(cat.name); setFormType(cat.type); setFormDesc(cat.description); setFormErrors({})
    setDialogOpen(true)
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!formName.trim()) errs.name = "Name is required"
    else if (list.some((c) => c.name.toLowerCase() === formName.trim().toLowerCase() && c.id !== editTarget?.id))
      errs.name = "Category name already exists"
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    try {
      if (editTarget) {
        const { error } = await supabase.from("categories")
          .update({ name: formName.trim(), type: formType, description: formDesc.trim() })
          .eq("id", editTarget.id)
        if (error) throw error
        toast.success("Category updated successfully")
      } else {
        const tenantId = await getTenantId()
        const { error } = await supabase.from("categories")
          .insert({ tenant_id: tenantId, name: formName.trim(), type: formType, description: formDesc.trim(), item_count: 0 })
        if (error) throw error
        toast.success("Category added successfully")
      }
      setDialogOpen(false)
      await fetchCategories()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save category")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const { error } = await supabase.from("categories").delete().eq("id", deleteTarget.id)
      if (error) throw error
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      await fetchCategories()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category")
    }
  }

  const columns: ColumnDef<Category>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Category Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
            <Tag className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span className="text-xs font-semibold text-slate-800">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <TypeChip type={row.original.type} />,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-xs text-slate-400 line-clamp-1 max-w-56">
          {row.original.description || "—"}
        </span>
      ),
    },
    {
      accessorKey: "itemCount",
      header: "Items",
      cell: ({ row }) => (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
          {row.original.itemCount}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-xs text-slate-400">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => openEdit(row.original)}
            className="p-1 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ], [])

  const statCards = [
    { title: "Total Categories",    value: stats.total,     sub: `${stats.totalItems} total items`, Icon: Layers,     iconBg: "bg-blue-500" },
    { title: "Mobile Categories",   value: stats.mobile,    sub: "For mobile phones",               Icon: Smartphone, iconBg: "bg-sky-500"  },
    { title: "Accessory Categories",value: stats.accessory, sub: "For accessories",                 Icon: Package,    iconBg: "bg-slate-500"},
    { title: "Shared (Both)",       value: stats.both,      sub: "Used for both types",             Icon: Tag,        iconBg: "bg-violet-500"},
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
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Categories</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Manage product categories for mobiles and accessories</p>
          </div>
        </div>
        <Button onClick={openAdd} size="sm" className="h-8 text-xs gap-1.5 px-3">
          <Plus className="w-3.5 h-3.5" />
          Add Category
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
            placeholder="Search categories..."
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>
        {list
          .filter((c) => c.name.toLowerCase().includes(mobileSearch.toLowerCase()))
          .map((cat) => {
            const accentBg = cat.type === "Mobile" ? "bg-blue-500" : cat.type === "Accessory" ? "bg-slate-400" : "bg-violet-500"
            return (
              <div key={cat.id} className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className={`w-1 shrink-0 ${accentBg}`} />
                <div className="flex-1 p-2.5 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 truncate flex-1">{cat.name}</span>
                    <TypeChip type={cat.type} />
                  </div>
                  {cat.description && (
                    <p className="text-[10px] text-slate-400 line-clamp-1 ml-8 mb-1">{cat.description}</p>
                  )}
                  <div className="flex items-center gap-3 ml-8 mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                      <Hash className="w-3 h-3" />{cat.itemCount} items
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                      <Calendar className="w-3 h-3" />{formatDate(cat.createdAt)}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => openEdit(cat)}>
                      <Pencil className="w-3 h-3" />Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-red-500 border-red-200 hover:bg-red-50" onClick={() => setDeleteTarget(cat)}>
                      <Trash2 className="w-3 h-3" />Delete
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        {list.filter((c) => c.name.toLowerCase().includes(mobileSearch.toLowerCase())).length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">No categories found</div>
        )}
      </div>

      {/* ── Desktop table ───────────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <DataTable columns={columns} data={list} searchKey="name" searchPlaceholder="Search categories..." />
      </div>

      {/* ── Add / Edit Dialog ───────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editTarget ? "Edit Category" : "Add New Category"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Flagship, Cases & Covers"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); if (formErrors.name) setFormErrors((p) => ({ ...p, name: "" })) }}
                className={`h-8 text-xs ${formErrors.name ? "border-red-400" : ""}`}
              />
              {formErrors.name && <p className="text-[10px] text-red-500">{formErrors.name}</p>}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as Category["type"])}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mobile">Mobile</SelectItem>
                  <SelectItem value="Accessory">Accessory</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Description <span className="text-slate-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="Brief description of this category..."
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
              {editTarget ? "Save Changes" : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ──────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Category"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
      />
    </div>
  )
}

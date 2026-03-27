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
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/utils"

// ─── Type badge helper ─────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: Category["type"] }) {
  const styles = {
    Mobile: "border-blue-200 text-blue-700 bg-blue-50",
    Accessory: "border-slate-200 text-slate-700 bg-slate-50",
    Both: "border-blue-200 text-blue-600 bg-blue-50",
  }
  return (
    <Badge variant="outline" className={`text-xs ${styles[type]}`}>
      {type}
    </Badge>
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

  // form state
  const [formName, setFormName] = useState("")
  const [formType, setFormType] = useState<Category["type"]>("Mobile")
  const [formDesc, setFormDesc] = useState("")
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // ── Fetch categories from Supabase ──────────────────────────────────────────
  async function fetchCategories() {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      const mapped: Category[] = (data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        type: (c.type ?? "Mobile") as Category["type"],
        description: (c.description ?? "") as string,
        itemCount: (c.item_count ?? 0) as number,
        createdAt: (c.created_at ?? new Date().toISOString()) as string,
      }))
      setList(mapped)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch categories")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: list.length,
    mobile: list.filter((c) => c.type === "Mobile").length,
    accessory: list.filter((c) => c.type === "Accessory").length,
    both: list.filter((c) => c.type === "Both").length,
    totalItems: list.reduce((s, c) => s + c.itemCount, 0),
  }), [list])

  // ── Open dialog ────────────────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null)
    setFormName("")
    setFormType("Mobile")
    setFormDesc("")
    setFormErrors({})
    setDialogOpen(true)
  }

  function openEdit(cat: Category) {
    setEditTarget(cat)
    setFormName(cat.name)
    setFormType(cat.type)
    setFormDesc(cat.description)
    setFormErrors({})
    setDialogOpen(true)
  }

  // ── Validate ───────────────────────────────────────────────────────────────
  function validate() {
    const errs: Record<string, string> = {}
    if (!formName.trim()) errs.name = "Name is required"
    else if (
      list.some(
        (c) =>
          c.name.toLowerCase() === formName.trim().toLowerCase() &&
          c.id !== editTarget?.id
      )
    )
      errs.name = "Category name already exists"
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) return
    try {
      if (editTarget) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: formName.trim(),
            type: formType,
            description: formDesc.trim(),
          })
          .eq('id', editTarget.id)
        if (error) throw error
        toast.success("Category updated successfully")
      } else {
        const tenantId = await getTenantId()
        const { error } = await supabase
          .from('categories')
          .insert({
            tenant_id: tenantId,
            name: formName.trim(),
            type: formType,
            description: formDesc.trim(),
            item_count: 0,
          })
        if (error) throw error
        toast.success("Category added successfully")
      }
      setDialogOpen(false)
      await fetchCategories()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save category")
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', deleteTarget.id)
      if (error) throw error
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      await fetchCategories()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete category")
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Category>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Category Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4 text-blue-600" />
          </div>
          <span className="font-semibold text-slate-800">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => <TypeBadge type={row.original.type} />,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <span className="text-slate-500 text-sm line-clamp-1 max-w-xs">
          {row.original.description || "—"}
        </span>
      ),
    },
    {
      accessorKey: "itemCount",
      header: "Items",
      cell: ({ row }) => (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">
          {row.original.itemCount}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
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
            title="Edit category"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDeleteTarget(row.original)}
            className="hover:text-red-500 hover:bg-red-50"
            title="Delete category"
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
            <p className="text-sm text-slate-500">Loading categories...</p>
          </div>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <PageHeader
        title="Categories"
        description="Manage product categories for mobiles and accessories"
        action={
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" />
            Add Category
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total Categories" value={String(stats.total)} icon={Layers} subtext={`${stats.totalItems} total items`} />
        <StatCard title="Mobile Categories" value={String(stats.mobile)} icon={Smartphone} subtext="For mobile phones" />
        <StatCard title="Accessory Categories" value={String(stats.accessory)} icon={Package} subtext="For accessories" />
        <StatCard title="Shared (Both)" value={String(stats.both)} icon={Tag} subtext="Used for both types" />
      </div>

      {/* Mobile Cards (md:hidden) */}
      <div className="md:hidden space-y-3">
        {/* Mobile search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-10 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
          />
        </div>

        {/* Cards */}
        {list
          .filter((c) => c.name.toLowerCase().includes(mobileSearch.toLowerCase()))
          .map((cat) => {
            const accentColor =
              cat.type === "Mobile"
                ? "bg-blue-500"
                : cat.type === "Accessory"
                ? "bg-slate-400"
                : "bg-violet-500"

            const iconBg =
              cat.type === "Mobile"
                ? "bg-blue-100"
                : cat.type === "Accessory"
                ? "bg-slate-100"
                : "bg-violet-100"

            const iconColor =
              cat.type === "Mobile"
                ? "text-blue-600"
                : cat.type === "Accessory"
                ? "text-slate-600"
                : "text-violet-600"

            return (
              <div
                key={cat.id}
                className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Left accent strip */}
                <div className={`w-1 shrink-0 ${accentColor}`} />

                {/* Card body */}
                <div className="flex-1 p-3 min-w-0">
                  {/* Row 1: Icon + Name + TypeBadge */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                      <Tag className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <span className="font-semibold text-slate-800 text-sm truncate flex-1">
                      {cat.name}
                    </span>
                    <TypeBadge type={cat.type} />
                  </div>

                  {/* Row 2: Description */}
                  {cat.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2 ml-10">
                      {cat.description}
                    </p>
                  )}

                  {/* Row 3: Items + Date */}
                  <div className="flex items-center gap-3 ml-10 mb-2.5">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
                      <Hash className="w-3 h-3 text-slate-400" />
                      {cat.itemCount} items
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {formatDate(cat.createdAt)}
                    </span>
                  </div>

                  {/* Row 4: Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => openEdit(cat)}
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => setDeleteTarget(cat)}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}

        {list.filter((c) => c.name.toLowerCase().includes(mobileSearch.toLowerCase())).length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">No categories found</div>
        )}
      </div>

      {/* Desktop Table (hidden md:block) */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={list}
          searchKey="name"
          searchPlaceholder="Search categories..."
        />
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Category" : "Add New Category"}</DialogTitle>
            <DialogDescription>
              {editTarget ? "Update the category details below." : "Fill in the details to create a new category."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cat-name"
                placeholder="e.g. Flagship, Cases & Covers"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value)
                  if (formErrors.name) setFormErrors((p) => ({ ...p, name: "" }))
                }}
                className={formErrors.name ? "border-red-400" : ""}
              />
              {formErrors.name && (
                <p className="text-xs text-red-500">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as Category["type"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mobile">Mobile</SelectItem>
                  <SelectItem value="Accessory">Accessory</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">
                Description{" "}
                <span className="text-slate-400 font-normal text-xs">(optional)</span>
              </Label>
              <Textarea
                id="cat-desc"
                placeholder="Brief description of this category..."
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
              {editTarget ? "Save Changes" : "Add Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Category"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
      />
    </PageWrapper>
  )
}

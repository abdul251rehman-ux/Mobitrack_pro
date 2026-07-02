"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Plus, Pencil, Trash2, Search, Smartphone, Lock, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"

interface PhoneModel {
  id: string
  name: string
  brandName: string
  deviceType: "iphone" | "android"
  isSystem: boolean
  createdAt: string
}

interface Brand { id: string; name: string }

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ModelsPage() {
  const [models, setModels] = useState<PhoneModel[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterBrand, setFilterBrand] = useState("all")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PhoneModel | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PhoneModel | null>(null)

  const [formName, setFormName] = useState("")
  const [formBrand, setFormBrand] = useState("")
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  async function fetchAll() {
    setLoading(true)
    try {
      const tenantId = await getTenantId()
      const [brandsRes, iphoneRes, androidRes] = await Promise.all([
        supabase.from("brands").select("id, name").eq("tenant_id", tenantId).eq("status", "Active").order("name"),
        supabase.from("iphone_models").select("id, name, brand_name, is_system, created_at").eq("tenant_id", tenantId).order("name"),
        supabase.from("android_models").select("id, name, brand_name, is_system, created_at").eq("tenant_id", tenantId).order("name"),
      ])
      setBrands((brandsRes.data ?? []).map((b: any) => ({ id: b.id, name: b.name })))
      const iphones: PhoneModel[] = (iphoneRes.data ?? []).map((m: any) => ({
        id: `iphone-${m.id}`, name: m.name, brandName: m.brand_name || "Apple",
        deviceType: "iphone", isSystem: m.is_system ?? false, createdAt: m.created_at,
      }))
      const androids: PhoneModel[] = (androidRes.data ?? []).map((m: any) => ({
        id: `android-${m.id}`, name: m.name, brandName: m.brand_name || "",
        deviceType: "android", isSystem: m.is_system ?? false, createdAt: m.created_at,
      }))
      setModels([...iphones, ...androids].sort((a, b) => a.brandName.localeCompare(b.brandName) || a.name.localeCompare(b.name)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load models")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return models.filter(m =>
      (filterBrand === "all" || m.brandName.toLowerCase() === filterBrand.toLowerCase()) &&
      (!q || m.name.toLowerCase().includes(q) || m.brandName.toLowerCase().includes(q))
    )
  }, [models, search, filterBrand])

  // Group by brand for display
  const grouped = useMemo(() => {
    const map = new Map<string, PhoneModel[]>()
    for (const m of filtered) {
      const key = m.brandName || "Unknown"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const stats = useMemo(() => {
    const brandSet = new Set(models.map(m => m.brandName))
    return {
      total: models.length,
      iphone: models.filter(m => m.deviceType === "iphone").length,
      android: models.filter(m => m.deviceType === "android").length,
      brands: brandSet.size,
    }
  }, [models])

  function openAdd(brandName?: string) {
    setEditTarget(null)
    setFormName("")
    setFormBrand(brandName ?? "")
    setFormErrors({})
    setDialogOpen(true)
  }

  function openEdit(m: PhoneModel) {
    setEditTarget(m)
    setFormName(m.name)
    setFormBrand(m.brandName)
    setFormErrors({})
    setDialogOpen(true)
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!formName.trim()) errs.name = "Model name is required"
    if (!formBrand.trim()) errs.brand = "Brand is required"
    const isDupe = models.some(
      m => m.name.toLowerCase() === formName.trim().toLowerCase() &&
           m.brandName.toLowerCase() === formBrand.trim().toLowerCase() &&
           m.id !== editTarget?.id
    )
    if (isDupe) errs.name = "This model already exists for this brand"
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    try {
      const tenantId = await getTenantId()
      const selectedBrand = brands.find(b => b.name.toLowerCase() === formBrand.trim().toLowerCase())
      const isApple = formBrand.trim().toLowerCase() === "apple"
      const table = isApple ? "iphone_models" : "android_models"

      if (editTarget) {
        const realId = editTarget.id.replace(/^(iphone|android)-/, "")
        const oldTable = editTarget.deviceType === "iphone" ? "iphone_models" : "android_models"
        const newTable = isApple ? "iphone_models" : "android_models"

        if (oldTable === newTable) {
          const { error } = await supabase.from(oldTable).update({ name: formName.trim(), brand_name: formBrand.trim() }).eq("id", realId)
          if (error) throw error
        } else {
          // Brand type changed (e.g., from Android brand → Apple) — delete old, insert new
          await supabase.from(oldTable).delete().eq("id", realId)
          const { error } = await supabase.from(newTable).insert({ tenant_id: tenantId, name: formName.trim(), brand_name: formBrand.trim(), is_system: false })
          if (error) throw error
        }
        toast.success("Model updated")
      } else {
        const { error } = await supabase.from(table).insert({ tenant_id: tenantId, name: formName.trim(), brand_name: formBrand.trim(), is_system: false })
        if (error) throw error
        toast.success(`Model "${formName.trim()}" added`)
      }
      setDialogOpen(false)
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save model")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    if (deleteTarget.isSystem) { toast.error("System models cannot be deleted"); return }
    try {
      const realId = deleteTarget.id.replace(/^(iphone|android)-/, "")
      const table = deleteTarget.deviceType === "iphone" ? "iphone_models" : "android_models"
      const { error } = await supabase.from(table).delete().eq("id", realId)
      if (error) throw error
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete model")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Phone Models</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Manage models per brand — used in purchases &amp; inventory</p>
          </div>
        </div>
        <Button onClick={() => openAdd()} size="sm" className="h-8 text-xs gap-1.5 px-3 bg-violet-600 hover:bg-violet-700">
          <Plus className="w-3.5 h-3.5" />
          Add Model
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { title: "Total Models",    value: stats.total,   sub: "All brands",       color: "bg-violet-500" },
          { title: "iPhone Models",   value: stats.iphone,  sub: "Apple only",       color: "bg-slate-700"  },
          { title: "Android Models",  value: stats.android, sub: "All other brands", color: "bg-emerald-500"},
          { title: "Brands Covered",  value: stats.brands,  sub: "With models",      color: "bg-blue-500"   },
        ].map(c => (
          <div key={c.title} className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none">{c.title}</p>
              <div className={`w-6 h-6 rounded-md ${c.color} flex items-center justify-center shrink-0`}>
                <Smartphone className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <p className="text-lg font-bold text-slate-900 leading-none">{c.value}</p>
            <p className="text-[10px] text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search models..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
          />
        </div>
        <div className="relative">
          <select
            value={filterBrand}
            onChange={e => setFilterBrand(e.target.value)}
            className="h-8 pl-2 pr-7 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 appearance-none"
          >
            <option value="all">All Brands</option>
            {Array.from(new Set(models.map(m => m.brandName))).sort().map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
        </div>
        <span className="text-[10px] text-slate-400 ml-auto">{filtered.length} model{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Grouped model list */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No models found</p>
          <Button onClick={() => openAdd()} size="sm" variant="outline" className="mt-3 text-xs h-7">
            <Plus className="w-3 h-3 mr-1" />Add First Model
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([brandName, mList]) => (
            <div key={brandName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Brand header row */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-[9px] font-bold">{brandName.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-800">{brandName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">
                    {mList.length} model{mList.length !== 1 ? "s" : ""}
                  </span>
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                    mList[0].deviceType === "iphone" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"
                  )}>
                    {mList[0].deviceType === "iphone" ? "iPhone" : "Android"}
                  </span>
                </div>
                <Button
                  onClick={() => openAdd(brandName)}
                  size="sm" variant="outline"
                  className="h-6 text-[10px] px-2 gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
                >
                  <Plus className="w-2.5 h-2.5" />Add
                </Button>
              </div>

              {/* Model rows */}
              <div className="divide-y divide-slate-50">
                {mList.map(m => (
                  <div key={m.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50/60 transition-colors group">
                    <Smartphone className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    <span className="text-xs text-slate-800 flex-1 font-medium">{m.name}</span>
                    {m.isSystem && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                        <Lock className="w-2 h-2" />System
                      </span>
                    )}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(m)}
                        className="p-1 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {m.isSystem ? (
                        <span className="p-1 text-amber-300 cursor-not-allowed" title="System model — cannot be deleted">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteTarget(m)}
                          className="p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {editTarget ? "Edit Model" : "Add Phone Model"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Brand <span className="text-red-500">*</span></Label>
              <div className="relative">
                <select
                  value={formBrand}
                  onChange={e => { setFormBrand(e.target.value); if (formErrors.brand) setFormErrors(p => ({ ...p, brand: "" })) }}
                  className={cn(
                    "w-full h-8 pl-2 pr-7 text-xs rounded-md border bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 appearance-none",
                    formErrors.brand ? "border-red-400" : "border-slate-200"
                  )}
                >
                  <option value="">Select brand…</option>
                  {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
              {formErrors.brand && <p className="text-[10px] text-red-500">{formErrors.brand}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Model Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder={formBrand.toLowerCase() === "apple" ? "e.g. iPhone 15 Pro Max" : "e.g. Samsung S24 Ultra"}
                value={formName}
                onChange={e => { setFormName(e.target.value); if (formErrors.name) setFormErrors(p => ({ ...p, name: "" })) }}
                className={cn("h-8 text-xs", formErrors.name ? "border-red-400" : "")}
                autoFocus
              />
              {formErrors.name && <p className="text-[10px] text-red-500">{formErrors.name}</p>}
            </div>
            <p className="text-[10px] text-slate-400 bg-slate-50 rounded-md px-2 py-1.5">
              Tip: Editing a model name will NOT update historical purchase records — only future purchases will use the new name.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs bg-violet-600 hover:bg-violet-700" onClick={handleSave}>
              {editTarget ? "Save Changes" : "Add Model"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Delete Model"
        description={`Delete "${deleteTarget?.name}" (${deleteTarget?.brandName})? This won't affect existing purchase records.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
      />
    </div>
  )
}

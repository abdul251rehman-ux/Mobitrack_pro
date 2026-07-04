"use client"

import { useState, useMemo, useEffect } from "react"
import { Plus, Pencil, Trash2, Search, Palette, Lock } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"

interface ColorItem {
  id: string
  name: string
  isSystem: boolean
  usageCount: number
}

export default function ColorsPage() {
  const [list, setList] = useState<ColorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ColorItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ColorItem | null>(null)
  const [formName, setFormName] = useState("")
  const [formError, setFormError] = useState("")

  async function fetchAll() {
    setLoading(true)
    try {
      const tenantId = await getTenantId()
      const [colorsRes, mobilesRes] = await Promise.all([
        supabase.from("colors").select("id, name, is_system, created_at").eq("tenant_id", tenantId).order("name"),
        supabase.from("mobiles").select("color").eq("tenant_id", tenantId),
      ])
      if (colorsRes.error) throw colorsRes.error

      const usageMap: Record<string, number> = {}
      for (const m of mobilesRes.data ?? []) {
        if (m.color) usageMap[m.color.toLowerCase()] = (usageMap[m.color.toLowerCase()] ?? 0) + 1
      }

      setList((colorsRes.data ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        isSystem: c.is_system ?? false,
        usageCount: usageMap[c.name.toLowerCase()] ?? 0,
      })))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load colors")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return q ? list.filter(c => c.name.toLowerCase().includes(q)) : list
  }, [list, search])

  function openAdd() { setEditTarget(null); setFormName(""); setFormError(""); setDialogOpen(true) }
  function openEdit(c: ColorItem) { setEditTarget(c); setFormName(c.name); setFormError(""); setDialogOpen(true) }

  function validate() {
    if (!formName.trim()) { setFormError("Color name is required"); return false }
    const dupe = list.some(c => c.name.toLowerCase() === formName.trim().toLowerCase() && c.id !== editTarget?.id)
    if (dupe) { setFormError("Color already exists"); return false }
    setFormError("")
    return true
  }

  async function handleSave() {
    if (!validate()) return
    try {
      const tenantId = await getTenantId()
      if (editTarget) {
        const { error } = await supabase.from("colors").update({ name: formName.trim() }).eq("id", editTarget.id)
        if (error) throw error
        toast.success("Color updated")
      } else {
        const { error } = await supabase.from("colors").insert({ tenant_id: tenantId, name: formName.trim(), is_system: false })
        if (error) throw error
        toast.success(`"${formName.trim()}" added`)
      }
      setDialogOpen(false)
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    if (deleteTarget.isSystem) { toast.error("System colors cannot be deleted"); return }
    if (deleteTarget.usageCount > 0) {
      toast.error(`Cannot delete - used in ${deleteTarget.usageCount} phone record${deleteTarget.usageCount !== 1 ? "s" : ""}`)
      setDeleteTarget(null)
      return
    }
    try {
      const { error } = await supabase.from("colors").delete().eq("id", deleteTarget.id)
      if (error) throw error
      toast.success(`"${deleteTarget.name}" deleted`)
      setDeleteTarget(null)
      await fetchAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
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
          <div className="w-7 h-7 rounded-lg bg-pink-500 flex items-center justify-center shrink-0">
            <Palette className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Colors</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Manage phone colors used in purchases &amp; inventory</p>
          </div>
        </div>
        <Button onClick={openAdd} size="sm" className="h-8 text-xs gap-1.5 px-3 bg-pink-500 hover:bg-pink-600">
          <Plus className="w-3.5 h-3.5" />Add Color
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { title: "Total Colors", value: list.length, sub: "In catalog" },
          { title: "In Use", value: list.filter(c => c.usageCount > 0).length, sub: "Used in stock" },
          { title: "Unused", value: list.filter(c => c.usageCount === 0 && !c.isSystem).length, sub: "Safe to delete" },
        ].map(c => (
          <div key={c.title} className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2.5 flex flex-col gap-1">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{c.title}</p>
            <p className="text-lg font-bold text-slate-900 leading-none">{c.value}</p>
            <p className="text-[10px] text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search colors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400"
          />
        </div>
        <span className="text-[10px] text-slate-400 ml-auto">{filtered.length} color{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Palette className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No colors found</p>
          <Button onClick={openAdd} size="sm" variant="outline" className="mt-3 text-xs h-7">
            <Plus className="w-3 h-3 mr-1" />Add First Color
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {filtered.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-2.5 flex items-center gap-2 group hover:border-pink-300 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0 text-sm font-bold text-slate-600">
                {c.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{c.name}</p>
                <p className="text-[10px] text-slate-400">
                  {c.usageCount > 0 ? `${c.usageCount} phone${c.usageCount !== 1 ? "s" : ""}` : "Unused"}
                </p>
              </div>
              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => openEdit(c)} className="p-0.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                  <Pencil className="w-3 h-3" />
                </button>
                {c.isSystem ? (
                  <span className="p-0.5 text-amber-300 cursor-not-allowed" title="System - cannot delete"><Lock className="w-3 h-3" /></span>
                ) : (
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className={cn("p-0.5 rounded transition-colors", c.usageCount > 0 ? "text-slate-200 cursor-not-allowed" : "hover:bg-red-50 text-slate-400 hover:text-red-500")}
                    title={c.usageCount > 0 ? `In use by ${c.usageCount} phone(s)` : "Delete"}
                    disabled={c.usageCount > 0}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">{editTarget ? "Edit Color" : "Add Color"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Color Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Midnight Black"
                value={formName}
                onChange={e => { setFormName(e.target.value); setFormError("") }}
                className={cn("h-8 text-xs", formError ? "border-red-400" : "")}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") handleSave() }}
              />
              {formError && <p className="text-[10px] text-red-500">{formError}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs bg-pink-500 hover:bg-pink-600" onClick={handleSave}>
              {editTarget ? "Save" : "Add Color"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Delete Color"
        description={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
      />
    </div>
  )
}

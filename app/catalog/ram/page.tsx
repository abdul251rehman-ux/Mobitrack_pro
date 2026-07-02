"use client"

import { useState, useMemo, useEffect } from "react"
import { Plus, Pencil, Trash2, Search, Cpu, Lock } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"

interface RamItem {
  id: string
  name: string
  isSystem: boolean
  usageCount: number
}

export default function RamPage() {
  const [list, setList] = useState<RamItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RamItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RamItem | null>(null)
  const [formName, setFormName] = useState("")
  const [formError, setFormError] = useState("")

  async function fetchAll() {
    setLoading(true)
    try {
      const tenantId = await getTenantId()
      const [ramRes, mobilesRes] = await Promise.all([
        supabase.from("ram_options").select("id, name, is_system, created_at").eq("tenant_id", tenantId).order("name"),
        supabase.from("mobiles").select("ram").eq("tenant_id", tenantId),
      ])
      if (ramRes.error) throw ramRes.error

      const usageMap: Record<string, number> = {}
      for (const m of mobilesRes.data ?? []) {
        if (m.ram) usageMap[m.ram.toLowerCase()] = (usageMap[m.ram.toLowerCase()] ?? 0) + 1
      }

      setList((ramRes.data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        isSystem: r.is_system ?? false,
        usageCount: usageMap[r.name.toLowerCase()] ?? 0,
      })))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load RAM options")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return q ? list.filter(r => r.name.toLowerCase().includes(q)) : list
  }, [list, search])

  function openAdd() { setEditTarget(null); setFormName(""); setFormError(""); setDialogOpen(true) }
  function openEdit(r: RamItem) { setEditTarget(r); setFormName(r.name); setFormError(""); setDialogOpen(true) }

  function validate() {
    if (!formName.trim()) { setFormError("RAM value is required"); return false }
    const dupe = list.some(r => r.name.toLowerCase() === formName.trim().toLowerCase() && r.id !== editTarget?.id)
    if (dupe) { setFormError("Already exists"); return false }
    setFormError("")
    return true
  }

  async function handleSave() {
    if (!validate()) return
    try {
      const tenantId = await getTenantId()
      if (editTarget) {
        const { error } = await supabase.from("ram_options").update({ name: formName.trim() }).eq("id", editTarget.id)
        if (error) throw error
        toast.success("RAM option updated")
      } else {
        const { error } = await supabase.from("ram_options").insert({ tenant_id: tenantId, name: formName.trim(), is_system: false })
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
    if (deleteTarget.isSystem) { toast.error("System entries cannot be deleted"); return }
    if (deleteTarget.usageCount > 0) {
      toast.error(`Cannot delete — used in ${deleteTarget.usageCount} phone record${deleteTarget.usageCount !== 1 ? "s" : ""}`)
      setDeleteTarget(null)
      return
    }
    try {
      const { error } = await supabase.from("ram_options").delete().eq("id", deleteTarget.id)
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
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">RAM Options</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Manage RAM values (4GB, 6GB, 8GB, 12GB…) for Android phones</p>
          </div>
        </div>
        <Button onClick={openAdd} size="sm" className="h-8 text-xs gap-1.5 px-3 bg-indigo-500 hover:bg-indigo-600">
          <Plus className="w-3.5 h-3.5" />Add RAM
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { title: "Total Options",  value: list.length,                                          sub: "In catalog"    },
          { title: "In Use",         value: list.filter(r => r.usageCount > 0).length,            sub: "Used in stock" },
          { title: "Unused",         value: list.filter(r => r.usageCount === 0 && !r.isSystem).length, sub: "Safe to delete" },
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
            placeholder="Search RAM..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-8 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>
        <span className="text-[10px] text-slate-400 ml-auto">{filtered.length} option{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Cpu className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No RAM options found</p>
          <Button onClick={openAdd} size="sm" variant="outline" className="mt-3 text-xs h-7">
            <Plus className="w-3 h-3 mr-1" />Add First Option
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {filtered.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50/60 transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800">{r.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {r.usageCount > 0 ? `Used in ${r.usageCount} phone${r.usageCount !== 1 ? "s" : ""}` : "Unused · Android only"}
                  </p>
                </div>
                {r.isSystem && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                    <Lock className="w-2 h-2" />System
                  </span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(r)} className="p-1 rounded-md hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {r.isSystem ? (
                    <span className="p-1 text-amber-300 cursor-not-allowed" title="System — cannot delete"><Lock className="w-3.5 h-3.5" /></span>
                  ) : (
                    <button
                      onClick={() => setDeleteTarget(r)}
                      disabled={r.usageCount > 0}
                      className={cn("p-1 rounded-md transition-colors", r.usageCount > 0 ? "text-slate-200 cursor-not-allowed" : "hover:bg-red-50 text-slate-400 hover:text-red-500")}
                      title={r.usageCount > 0 ? `In use by ${r.usageCount} phone(s)` : "Delete"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">{editTarget ? "Edit RAM" : "Add RAM Option"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <div className="space-y-1">
              <Label className="text-xs">RAM Value <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. 4GB, 6GB, 8GB, 12GB"
                value={formName}
                onChange={e => { setFormName(e.target.value); setFormError("") }}
                className={cn("h-8 text-xs", formError ? "border-red-400" : "")}
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") handleSave() }}
              />
              {formError && <p className="text-[10px] text-red-500">{formError}</p>}
            </div>
            <p className="text-[10px] text-slate-400 bg-slate-50 rounded-md px-2 py-1.5">
              RAM applies to Android phones only. iPhones do not show a RAM field.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs bg-indigo-500 hover:bg-indigo-600" onClick={handleSave}>
              {editTarget ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title="Delete RAM Option"
        description={`Delete "${deleteTarget?.name}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
      />
    </div>
  )
}

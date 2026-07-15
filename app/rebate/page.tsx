"use client"

import { PermissionGate } from "@/components/shared/permission-gate"
import { useState, useEffect, useMemo } from "react"
import {
  Plus, BadgePercent, TrendingDown, Calendar, CheckCircle2,
  Clock, Pencil, Trash2, X, Search,
  ArrowDownToLine, Eye, Hash, AlignLeft, Building2,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { getSuppliers } from "@/lib/api/suppliers"
import {
  getRebateEntries, createRebateEntry, updateRebateEntry,
  deleteRebateEntry, postRebateEntry, getUnsoldStockForModel, getLastBuyPrice,
  getTotalPurchasedUnits, getTotalPurchasedAccessoryUnits, getAccessoryNamesForSupplier,
} from "@/lib/api/rebate"
import type { RebateEntry, RebateType, RebateStatus, CreateRebateInput } from "@/lib/api/rebate"
import type { Supplier } from "@/data/types"
import { formatCurrency, cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { PageLoader } from "@/components/shared/page-loader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

// ── helpers ──────────────────────────────────────────────────────────────────

function monthOptions() {
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleString("default", { month: "long", year: "numeric" })
    opts.push({ value, label })
  }
  return opts
}

const MONTHS = monthOptions()
const TODAY = new Date().toISOString().slice(0, 7)

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  type: RebateType
  supplierId: string
  model: string
  period: string
  units: string
  ratePerUnit: string
  oldBuyPrice: string
  newBuyPrice: string
  updateStockPrice: boolean
  updateSellPrice: boolean
  notes: string
  status: RebateStatus
}

function emptyForm(type: RebateType = "rebate"): FormState {
  return {
    type, supplierId: "", model: "", period: TODAY,
    units: "", ratePerUnit: "", oldBuyPrice: "", newBuyPrice: "",
    updateStockPrice: true, updateSellPrice: false,
    notes: "", status: "draft",
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function RebatePageInner() {
  const [entries, setEntries] = useState<RebateEntry[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [models, setModels] = useState<string[]>([])
  const [accessoryNames, setAccessoryNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"all" | RebateType>("all")
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<RebateEntry | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [posting, setPosting] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [unsoldCount, setUnsoldCount] = useState<number | null>(null)
  const [totalPurchased, setTotalPurchased] = useState<number | null>(null)
  const [fetchingUnsold, setFetchingUnsold] = useState(false)
  const [drawerEntry, setDrawerEntry] = useState<RebateEntry | null>(null)

  useEffect(() => {
    Promise.all([
      getRebateEntries().then(setEntries),
      getSuppliers().then(setSuppliers),
    ]).finally(() => setLoading(false))
  }, [])

  // Reload models + accessories whenever supplier changes
  useEffect(() => {
    if (!form.supplierId) { setModels([]); setAccessoryNames([]); return }
    async function loadModelsForSupplier() {
      try {
        const tenantId = await getTenantId()
        const [{ data: imeiData }, accNames] = await Promise.all([
          supabase.from("imei_records").select("model").eq("tenant_id", tenantId).eq("supplier_id", form.supplierId),
          getAccessoryNamesForSupplier(form.supplierId),
        ])
        const phoneModels = Array.from(new Set((imeiData ?? []).map((r: any) => r.model).filter(Boolean))) as string[]
        setModels(phoneModels.sort())
        setAccessoryNames(accNames)
        const allOptions = [...phoneModels, ...accNames]
        setForm(f => ({ ...f, model: allOptions.includes(f.model) ? f.model : "" }))
      } catch {}
    }
    loadModelsForSupplier()
  }, [form.supplierId])

  const isAccessoryModel = accessoryNames.includes(form.model)

  // Auto-fetch hint values when model/supplier/period changes — units always editable
  useEffect(() => {
    if (!form.model || !form.supplierId) {
      setUnsoldCount(null)
      setTotalPurchased(null)
      return
    }
    setFetchingUnsold(true)

    if (form.type === "rebate") {
      // Auto-fill total purchased units as a hint; shopkeeper adjusts to agreed amount
      const fetchUnits = isAccessoryModel
        ? getTotalPurchasedAccessoryUnits(form.model, form.supplierId)
        : getTotalPurchasedUnits(form.model, form.supplierId)
      fetchUnits
        .then(total => {
          setTotalPurchased(total)
          setForm(f => ({ ...f, units: String(total) }))
        })
        .catch(() => setTotalPurchased(null))
        .finally(() => setFetchingUnsold(false))
    } else {
      // Rate diff: unsold units in stock + last buy price (accessories use stock count)
      if (isAccessoryModel) {
        getTotalPurchasedAccessoryUnits(form.model, form.supplierId)
          .then(count => {
            setUnsoldCount(count)
            setForm(f => ({ ...f, units: String(count) }))
          })
          .catch(() => setUnsoldCount(null))
          .finally(() => setFetchingUnsold(false))
      } else {
        Promise.all([
          getUnsoldStockForModel(form.model, form.supplierId),
          getLastBuyPrice(form.model, form.supplierId),
        ])
          .then(([count, lastPrice]) => {
            setUnsoldCount(count)
            setForm(f => ({
              ...f,
              units: String(count),
              ...(lastPrice !== null && !f.oldBuyPrice ? { oldBuyPrice: String(lastPrice) } : {}),
            }))
          })
          .catch(() => setUnsoldCount(null))
          .finally(() => setFetchingUnsold(false))
      }
    }
  }, [form.type, form.model, form.supplierId, form.period, isAccessoryModel])

  const priceDiff = form.type === "rate_diff"
    ? Math.max(0, (parseFloat(form.oldBuyPrice) || 0) - (parseFloat(form.newBuyPrice) || 0))
    : 0

  const effectiveRate = form.type === "rebate"
    ? (parseFloat(form.ratePerUnit) || 0)
    : priceDiff

  const total = effectiveRate * (parseInt(form.units) || 0)

  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === form.supplierId),
    [suppliers, form.supplierId]
  )

  function openAdd(type: RebateType) {
    setEditEntry(null)
    setForm(emptyForm(type))
    setUnsoldCount(null)
    setTotalPurchased(null)
    setShowForm(true)
  }

  function openEdit(e: RebateEntry) {
    setEditEntry(e)
    setForm({
      type: e.type, supplierId: e.supplierId, model: e.model,
      period: e.period, units: String(e.units), ratePerUnit: String(e.ratePerUnit),
      oldBuyPrice: String(e.oldBuyPrice), newBuyPrice: String(e.newBuyPrice),
      updateStockPrice: e.updateStockPrice, updateSellPrice: e.updateSellPrice,
      notes: e.notes, status: e.status,
    })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditEntry(null) }

  async function handleSave(status: RebateStatus) {
    if (!form.supplierId) { toast.error("Select a supplier"); return }
    if (!form.model.trim()) { toast.error("Enter model name"); return }
    if (!form.units || parseInt(form.units) <= 0) { toast.error("Enter units"); return }
    if (form.type === "rebate" && (!form.ratePerUnit || parseFloat(form.ratePerUnit) <= 0)) {
      toast.error("Enter rebate rate per unit"); return
    }
    if (form.type === "rate_diff") {
      if (!form.oldBuyPrice || parseFloat(form.oldBuyPrice) <= 0) { toast.error("Enter old buy price"); return }
      if (!form.newBuyPrice || parseFloat(form.newBuyPrice) <= 0) { toast.error("Enter new buy price"); return }
      if (parseFloat(form.newBuyPrice) >= parseFloat(form.oldBuyPrice)) {
        toast.error("New price must be lower than old price"); return
      }
    }

    setSaving(true)
    try {
      const input: CreateRebateInput = {
        type: form.type,
        supplierId: form.supplierId,
        supplierName: selectedSupplier?.companyName ?? "",
        model: form.model.trim(),
        period: form.period,
        units: parseInt(form.units),
        ratePerUnit: form.type === "rebate" ? parseFloat(form.ratePerUnit) : priceDiff,
        oldBuyPrice: parseFloat(form.oldBuyPrice) || 0,
        newBuyPrice: parseFloat(form.newBuyPrice) || 0,
        total,
        status,
        updateStockPrice: form.updateStockPrice,
        updateSellPrice: form.updateSellPrice,
        notes: form.notes,
      }

      if (editEntry) {
        const updated = await updateRebateEntry(editEntry.id, input)
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
        toast.success("Entry updated")
      } else {
        const created = await createRebateEntry(input)
        // If saving as posted, run the post logic too
        if (status === "posted") {
          await postRebateEntry(created)
          const refreshed = await getRebateEntries()
          setEntries(refreshed)
        } else {
          setEntries(prev => [created, ...prev])
        }
        toast.success(status === "posted" ? "Posted to supplier ledger" : "Saved as draft")
      }
      closeForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handlePost(entry: RebateEntry) {
    setPosting(entry.id)
    try {
      await postRebateEntry(entry)
      const refreshed = await getRebateEntries()
      setEntries(refreshed)
      toast.success("Posted to supplier ledger — balance updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Post failed")
    } finally {
      setPosting(null)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await deleteRebateEntry(id)
      setEntries(prev => prev.filter(e => e.id !== id))
      toast.success("Deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(null)
    }
  }

  const filtered = useMemo(() => {
    let list = entries
    if (tab !== "all") list = list.filter(e => e.type === tab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.supplierName.toLowerCase().includes(q) ||
        e.model.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q)
      )
    }
    return list
  }, [entries, tab, search])

  // Summary stats
  const totalRebate = entries.filter(e => e.type === "rebate" && e.status === "posted").reduce((s, e) => s + e.total, 0)
  const totalRateDiff = entries.filter(e => e.type === "rate_diff" && e.status === "posted").reduce((s, e) => s + e.total, 0)
  const thisMonth = entries.filter(e => e.status === "posted" && e.createdAt?.startsWith(TODAY)).reduce((s, e) => s + e.total, 0)
  const drafts = entries.filter(e => e.status === "draft").length

  if (loading) return <PageLoader />

  return (
    <div className="space-y-4">

      {/* Header */}
      <PageHeader
        title="Rebate"
        description="Track supplier rebates and rate difference credits"
        icon={<BadgePercent />}
        iconBg="bg-indigo-600"
        action={
          <div className="flex gap-2">
            <Button onClick={() => openAdd("rate_diff")} variant="outline" className="h-8 text-xs gap-1.5 border-cyan-200 text-cyan-700 hover:bg-cyan-50">
              <TrendingDown className="w-3.5 h-3.5" /> Rate Difference
            </Button>
            <Button onClick={() => openAdd("rebate")} className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-3.5 h-3.5" /> Add Rebate
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Rebate", value: totalRebate, icon: BadgePercent, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Rate Difference", value: totalRateDiff, icon: TrendingDown, color: "text-cyan-600", bg: "bg-cyan-50" },
          { label: "This Month", value: thisMonth, icon: Calendar, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Pending Drafts", value: drafts, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", isCount: true },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", card.bg)}>
                <card.icon className={cn("w-3.5 h-3.5", card.color)} />
              </div>
            </div>
            <p className={cn("text-lg font-bold", card.color)}>
              {(card as any).isCount ? card.value : formatCurrency(card.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white">
          {(["all", "rebate", "rate_diff"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
              )}>
              {t === "all" ? "All" : t === "rebate" ? "Rebate" : "Rate Difference"}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input placeholder="Search supplier, model..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <BadgePercent className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-400">No entries yet</p>
            <p className="text-xs text-slate-400 mt-1">Add a rebate or rate difference to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  {["Date", "Supplier", "Model", "Type", "Period", "Units", "Rate/Unit", "Total", "Status", "Actions"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                      {format(new Date(entry.createdAt), "dd MMM yy")}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[140px] truncate">
                      {entry.supplierName}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[120px] truncate">{entry.model}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                        entry.type === "rebate" ? "bg-indigo-100 text-indigo-700" : "bg-cyan-100 text-cyan-700"
                      )}>
                        {entry.type === "rebate" ? <BadgePercent className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {entry.type === "rebate" ? "Rebate" : "Rate Diff"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{entry.period}</td>
                    <td className="px-3 py-2.5 text-slate-700 font-mono">{entry.units}</td>
                    <td className="px-3 py-2.5 text-slate-700 font-mono">{formatCurrency(entry.ratePerUnit)}</td>
                    <td className="px-3 py-2.5 font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(entry.total)}</td>
                    <td className="px-3 py-2.5">
                      {entry.status === "posted" ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Posted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">
                          <Clock className="w-2.5 h-2.5" /> Draft
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setDrawerEntry(entry)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-600 transition-colors">
                          <Eye className="w-3 h-3" />
                        </button>
                        {entry.status === "draft" && (
                          <>
                            <button onClick={() => handlePost(entry)} disabled={posting === entry.id}
                              title="Post to ledger"
                              className="p-1 rounded hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 transition-colors disabled:opacity-40">
                              {posting === entry.id
                                ? <div className="w-3 h-3 border border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                : <ArrowDownToLine className="w-3 h-3" />}
                            </button>
                            <button onClick={() => openEdit(entry)}
                              className="p-1 rounded hover:bg-indigo-50 text-slate-300 hover:text-indigo-500 transition-colors">
                              <Pencil className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDelete(entry.id)} disabled={deleting === entry.id}
                          className="p-1 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-40">
                          {deleting === entry.id
                            ? <div className="w-3 h-3 border border-rose-400 border-t-transparent rounded-full animate-spin" />
                            : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {drawerEntry && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]" onClick={() => setDrawerEntry(null)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-white z-50 shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Drawer header */}
            <div className={cn("flex items-center justify-between px-4 py-3 border-b border-slate-100", drawerEntry.type === "rebate" ? "bg-indigo-50" : "bg-cyan-50")}>
              <div className="flex items-center gap-2">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", drawerEntry.type === "rebate" ? "bg-indigo-100" : "bg-cyan-100")}>
                  {drawerEntry.type === "rebate"
                    ? <BadgePercent className={cn("w-4 h-4", "text-indigo-600")} />
                    : <TrendingDown className="w-4 h-4 text-cyan-600" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{drawerEntry.type === "rebate" ? "Rebate" : "Rate Difference"}</p>
                  <p className="text-[10px] text-slate-400">{drawerEntry.supplierName}</p>
                </div>
              </div>
              <button onClick={() => setDrawerEntry(null)} className="p-1 rounded-md hover:bg-white/60">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* Total */}
              <div className={cn("rounded-xl p-3 text-center border", drawerEntry.type === "rebate" ? "bg-indigo-50 border-indigo-200" : "bg-cyan-50 border-cyan-200")}>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Total Credit</p>
                <p className={cn("text-2xl font-bold", drawerEntry.type === "rebate" ? "text-indigo-700" : "text-cyan-700")}>{formatCurrency(drawerEntry.total)}</p>
                <p className="text-[10px] text-slate-400 mt-1">{drawerEntry.units} units × {formatCurrency(drawerEntry.ratePerUnit)}/unit</p>
              </div>

              {/* Details */}
              <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-white">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Supplier</p>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">{drawerEntry.supplierName}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-3 py-2.5 bg-white">
                  <Hash className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Model</p>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">{drawerEntry.model}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-3 py-2.5 bg-white">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Period</p>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">{drawerEntry.period}</p>
                  </div>
                </div>
                {drawerEntry.type === "rate_diff" && (
                  <div className="flex items-start gap-3 px-3 py-2.5 bg-white">
                    <TrendingDown className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Price Change</p>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">
                        {formatCurrency(drawerEntry.oldBuyPrice)} → {formatCurrency(drawerEntry.newBuyPrice)}
                        <span className="ml-1 text-rose-500">(−{formatCurrency(drawerEntry.oldBuyPrice - drawerEntry.newBuyPrice)}/unit)</span>
                      </p>
                    </div>
                  </div>
                )}
                {drawerEntry.notes && (
                  <div className="flex items-start gap-3 px-3 py-2.5 bg-white">
                    <AlignLeft className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Notes</p>
                      <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{drawerEntry.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Status + dates */}
              <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Status</span>
                  {drawerEntry.status === "posted"
                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-2.5 h-2.5" /> Posted</span>
                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700"><Clock className="w-2.5 h-2.5" /> Draft</span>}
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Created</span>
                  <span className="text-xs text-slate-600">{format(new Date(drawerEntry.createdAt), "dd MMM yyyy")}</span>
                </div>
                {drawerEntry.postedAt && (
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Posted</span>
                    <span className="text-xs text-slate-600">{format(new Date(drawerEntry.postedAt), "dd MMM yyyy")}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {drawerEntry.status === "draft" && (
                <div className="flex gap-2">
                  <button onClick={() => { openEdit(drawerEntry); setDrawerEntry(null) }}
                    className="flex-1 h-8 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={async () => { await handlePost(drawerEntry); setDrawerEntry(null) }} disabled={posting === drawerEntry.id}
                    className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <ArrowDownToLine className="w-3 h-3" /> Post to Ledger
                  </button>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-100">
              <button onClick={() => setDrawerEntry(null)} className="w-full h-8 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Modal header */}
            <div className={cn(
              "flex items-center gap-3 px-5 py-4 rounded-t-2xl",
              form.type === "rebate" ? "bg-indigo-600" : "bg-cyan-600"
            )}>
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                {form.type === "rebate" ? <BadgePercent className="w-4 h-4 text-white" /> : <TrendingDown className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-bold text-white">
                  {editEntry ? "Edit" : "Add"} {form.type === "rebate" ? "Rebate" : "Rate Difference"}
                </h2>
                <p className="text-[11px] text-white/70">
                  {form.type === "rebate" ? "Supplier credit — reduces your payable balance" : "Supplier compensates for price drop on unsold stock"}
                </p>
              </div>
              <button onClick={closeForm} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* Type toggle (only on new) */}
              {!editEntry && (
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  {(["rebate", "rate_diff"] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...emptyForm(t), supplierId: f.supplierId }))}
                      className={cn("flex-1 py-2 text-xs font-semibold transition-colors",
                        form.type === t
                          ? t === "rebate" ? "bg-indigo-600 text-white" : "bg-cyan-600 text-white"
                          : "text-slate-500 hover:bg-slate-50"
                      )}>
                      {t === "rebate" ? "Rebate" : "Rate Difference"}
                    </button>
                  ))}
                </div>
              )}

              {/* Supplier */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Supplier <span className="text-rose-500">*</span></Label>
                <select
                  value={form.supplierId}
                  onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.filter(s => s.status === "Active").map(s => (
                    <option key={s.id} value={s.id}>{s.companyName}</option>
                  ))}
                </select>
              </div>

              {/* Model — phones and accessories purchased from selected supplier */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  Model / Item <span className="text-rose-500">*</span>
                  {form.supplierId && models.length === 0 && accessoryNames.length === 0 && (
                    <span className="ml-1.5 text-[10px] text-amber-500 font-normal">No purchases found for this supplier</span>
                  )}
                </Label>
                <select
                  value={form.model}
                  onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  disabled={!form.supplierId || (models.length === 0 && accessoryNames.length === 0)}
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">{form.supplierId ? "Select model or item..." : "Select supplier first"}</option>
                  {models.length > 0 && (
                    <optgroup label="Phones">
                      {models.map(m => <option key={m} value={m}>{m}</option>)}
                    </optgroup>
                  )}
                  {accessoryNames.length > 0 && (
                    <optgroup label="Accessories">
                      {accessoryNames.map(n => <option key={`acc-${n}`} value={n}>{n}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Period */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">
                  {form.type === "rebate" ? "Period (Month)" : "Date"}
                </Label>
                {form.type === "rebate" ? (
                  <select
                    value={form.period}
                    onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                ) : (
                  <input type="date" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                )}
              </div>

              {/* Rate Diff specific: old + new price */}
              {form.type === "rate_diff" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">Old Buy Price (Rs) <span className="text-rose-500">*</span></Label>
                    <input type="number" min={0} onWheel={e => e.currentTarget.blur()}
                      value={form.oldBuyPrice} onChange={e => setForm(f => ({ ...f, oldBuyPrice: e.target.value }))}
                      placeholder="40000"
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">New Buy Price (Rs) <span className="text-rose-500">*</span></Label>
                    <input type="number" min={0} onWheel={e => e.currentTarget.blur()}
                      value={form.newBuyPrice} onChange={e => setForm(f => ({ ...f, newBuyPrice: e.target.value }))}
                      placeholder="37000"
                      className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400" />
                  </div>
                  {priceDiff > 0 && (
                    <div className="col-span-2 flex items-center gap-2 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
                      <TrendingDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      <span className="text-xs text-cyan-700 font-semibold">
                        Price dropped by {formatCurrency(priceDiff)} per unit
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Units + Rate per unit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">
                    Units <span className="text-rose-500">*</span>
                    {fetchingUnsold && (
                      <span className="ml-1 text-[10px] text-indigo-500">loading...</span>
                    )}
                    {form.type === "rebate" && totalPurchased !== null && !fetchingUnsold && (
                      <span className="ml-1 text-[10px] text-slate-400">
                        ({totalPurchased} {isAccessoryModel ? "in stock" : "purchased, excl. returns"})
                      </span>
                    )}
                    {form.type === "rate_diff" && unsoldCount !== null && !fetchingUnsold && (
                      <span className="ml-1 text-[10px] text-slate-400">({unsoldCount} in stock)</span>
                    )}
                  </Label>
                  <input type="number" min={1} onWheel={e => e.currentTarget.blur()}
                    value={form.units} onChange={e => setForm(f => ({ ...f, units: e.target.value }))}
                    placeholder="50"
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">
                    {form.type === "rebate" ? "Rebate / Unit (Rs)" : "Diff / Unit (Rs)"}
                  </Label>
                  <input type="number" min={0} onWheel={e => e.currentTarget.blur()}
                    value={form.type === "rebate" ? form.ratePerUnit : String(priceDiff || "")}
                    onChange={form.type === "rebate" ? e => setForm(f => ({ ...f, ratePerUnit: e.target.value })) : undefined}
                    readOnly={form.type === "rate_diff"}
                    placeholder={form.type === "rebate" ? "500" : "Auto"}
                    className={cn(
                      "w-full h-9 rounded-lg border px-3 text-sm bg-white focus:outline-none focus:ring-2",
                      form.type === "rate_diff" ? "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed" : "border-slate-200 focus:ring-indigo-400"
                    )} />
                </div>
              </div>

              {/* Total */}
              {total > 0 && (
                <div className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3 border",
                  form.type === "rebate" ? "bg-indigo-50 border-indigo-200" : "bg-cyan-50 border-cyan-200"
                )}>
                  <span className="text-sm font-semibold text-slate-700">Total Credit</span>
                  <span className={cn("text-xl font-bold", form.type === "rebate" ? "text-indigo-700" : "text-cyan-700")}>
                    {formatCurrency(total)}
                  </span>
                </div>
              )}

              {/* Rate diff options */}
              {form.type === "rate_diff" && (
                <div className="space-y-2 rounded-xl border border-slate-200 p-3 bg-slate-50">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">When posted</p>
                  {[
                    { key: "updateStockPrice" as const, label: "Update buy price on unsold IMEI records", desc: "Changes purchase_price on all unsold units of this model" },
                    { key: "updateSellPrice" as const, label: "Update buy price in mobile catalog", desc: "Updates purchase_price on the mobiles table" },
                  ].map(opt => (
                    <label key={opt.key} className="flex items-start gap-2.5 cursor-pointer group">
                      <input type="checkbox" checked={form[opt.key]}
                        onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                      <div>
                        <span className="text-xs font-medium text-slate-700">{opt.label}</span>
                        <p className="text-[10px] text-slate-400">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-600">Notes (optional)</Label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Any additional details..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={closeForm} className="flex-1 h-9 text-sm">Cancel</Button>
                <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving}
                  className="flex-1 h-9 text-sm border-amber-200 text-amber-700 hover:bg-amber-50">
                  {saving ? "Saving..." : "Save Draft"}
                </Button>
                <Button onClick={() => handleSave("posted")} disabled={saving}
                  className={cn("flex-1 h-9 text-sm", form.type === "rebate" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-cyan-600 hover:bg-cyan-700")}>
                  {saving ? "Posting..." : "Post to Ledger"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


export default function RebatePage() {
  return (
    <PermissionGate permission="rebate.view">
      <RebatePageInner />
    </PermissionGate>
  )
}


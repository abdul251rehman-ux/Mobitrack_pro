"use client"

import { useState, useMemo, useEffect } from "react"
import { Tag, Smartphone, Package, Layers, ChevronDown, ChevronUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { toast } from "sonner"

// ─── Hardcoded categories ─────────────────────────────────────────────────────
const CATEGORIES = [
  { name: "PTA Approved", type: "iPhone",  description: "Officially PTA approved iPhones" },
  { name: "Non-PTA",      type: "iPhone",  description: "Non-PTA / imported iPhones" },
  { name: "JV",           type: "iPhone",  description: "Joint Venture iPhones" },
  { name: "PTA Approved", type: "Android", description: "Officially PTA approved Android phones" },
  { name: "Non-PTA",      type: "Android", description: "Non-PTA / imported Android phones" },
]

type FilterType = "All" | "iPhone" | "Android"

interface PhoneRow {
  id: string
  brand: string
  model: string
  color: string
  storage: string
  stock: number
  selling_price: number
  category: string
  device_type: string
}

function TypeChip({ type }: { type: string }) {
  const cfg: Record<string, string> = {
    iPhone:  "bg-blue-50 text-blue-700 border-blue-200",
    Android: "bg-emerald-50 text-emerald-700 border-emerald-200",
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${cfg[type] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {type}
    </span>
  )
}

function StockPill({ stock }: { stock: number }) {
  if (stock <= 0)
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Out of Stock</span>
  if (stock <= 3)
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Low: {stock}</span>
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{stock} in stock</span>
}

function CategoryCard({ cat, phones, loading }: {
  cat: typeof CATEGORIES[0]
  phones: PhoneRow[]
  loading: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const isIphone = cat.type === "iPhone"
  const accentBg   = isIphone ? "bg-blue-50"   : "bg-emerald-50"
  const accentText = isIphone ? "text-blue-600" : "text-emerald-600"
  const accentBorder = isIphone ? "border-blue-100" : "border-emerald-100"

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="p-4 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accentBg}`}>
          <Tag className={`w-4 h-4 ${accentText}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold text-slate-800">{cat.name}</span>
            <TypeChip type={cat.type} />
          </div>
          <p className="text-[11px] text-slate-400 mb-2">{cat.description}</p>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              phones.length > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-400"
            }`}>
              {loading ? "…" : `${phones.length} model${phones.length !== 1 ? "s" : ""}`}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              phones.reduce((s, p) => s + p.stock, 0) > 0 ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-400"
            }`}>
              {loading ? "…" : `${phones.reduce((s, p) => s + p.stock, 0)} units`}
            </span>
          </div>
        </div>
        {!loading && phones.length > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
              : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        )}
      </div>

      {/* Phone list (expanded) */}
      {expanded && phones.length > 0 && (
        <div className={`border-t ${accentBorder}`}>
          <div className="divide-y divide-slate-100">
            {phones.map(phone => (
              <div key={phone.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accentBg}`}>
                  <Smartphone className={`w-3.5 h-3.5 ${accentText}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {phone.brand} {phone.model}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {phone.color} · {phone.storage}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-bold text-slate-700">
                    PKR {phone.selling_price?.toLocaleString() ?? "—"}
                  </span>
                  <StockPill stock={phone.stock} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state inside card */}
      {expanded && phones.length === 0 && (
        <div className={`border-t ${accentBorder} py-6 text-center`}>
          <Package className="w-6 h-6 text-slate-300 mx-auto mb-1" />
          <p className="text-[11px] text-slate-400">No phones in this category</p>
        </div>
      )}
    </div>
  )
}

export default function CategoriesPage() {
  const [phones, setPhones] = useState<PhoneRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>("All")

  useEffect(() => {
    async function load() {
      try {
        const tenantId = await getTenantId()
        const { data, error } = await supabase
          .from("mobiles")
          .select("id, brand, model, color, storage, stock, selling_price, category, device_type")
          .eq("tenant_id", tenantId)
        if (error) throw error
        setPhones(data ?? [])
      } catch {
        toast.error("Failed to load phones")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() =>
    filter === "All" ? CATEGORIES : CATEGORIES.filter(c => c.type === filter),
    [filter]
  )

  function getPhonesForCat(cat: typeof CATEGORIES[0]) {
    return phones.filter(p => {
      const deviceType = p.device_type === "iphone" ? "iPhone" : "Android"
      return p.category === cat.name && deviceType === cat.type
    })
  }

  const totalUnits = phones.reduce((s, p) => s + (p.stock ?? 0), 0)

  const stats = {
    total:   CATEGORIES.length,
    iphone:  CATEGORIES.filter(c => c.type === "iPhone").length,
    android: CATEGORIES.filter(c => c.type === "Android").length,
    totalUnits,
  }

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 leading-none">Categories</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">Device categories used across purchases and inventory</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { title: "Total Categories",   value: stats.total,      sub: `${stats.totalUnits} total units`,  Icon: Layers,     bg: "bg-blue-500"    },
          { title: "iPhone Categories",  value: stats.iphone,     sub: "PTA · Non-PTA · JV",               Icon: Smartphone, bg: "bg-sky-500"     },
          { title: "Android Categories", value: stats.android,    sub: "PTA · Non-PTA",                    Icon: Smartphone, bg: "bg-emerald-500" },
          { title: "Total Units",        value: stats.totalUnits, sub: "Across all categories",             Icon: Package,    bg: "bg-violet-500"  },
        ].map(card => (
          <div key={card.title} className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2.5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none">{card.title}</p>
              <div className={`w-6 h-6 rounded-md ${card.bg} flex items-center justify-center shrink-0`}>
                <card.Icon className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <p className="text-lg font-bold text-slate-900 leading-none">{loading ? "—" : card.value}</p>
            <p className="text-[10px] text-slate-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(["All", "iPhone", "Android"] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              filter === f
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            {f === "All" ? "All Categories" : `${f} Only`}
          </button>
        ))}
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((cat, i) => (
          <CategoryCard
            key={i}
            cat={cat}
            phones={getPhonesForCat(cat)}
            loading={loading}
          />
        ))}
      </div>

    </div>
  )
}

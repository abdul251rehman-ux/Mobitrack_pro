"use client"

import { useState, useMemo, useEffect } from "react"
import { Tag, Smartphone, Package, Layers } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { toast } from "sonner"

// ─── Hardcoded categories (no DB table needed) ────────────────────────────────
const CATEGORIES = [
  { name: "PTA Approved", type: "iPhone",   description: "Officially PTA approved iPhones" },
  { name: "Non-PTA",      type: "iPhone",   description: "Non-PTA / imported iPhones" },
  { name: "JV",           type: "iPhone",   description: "Joint Venture iPhones" },
  { name: "PTA Approved", type: "Android",  description: "Officially PTA approved Android phones" },
  { name: "Non-PTA",      type: "Android",  description: "Non-PTA / imported Android phones" },
]

type FilterType = "All" | "iPhone" | "Android"

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

export default function CategoriesPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>("All")

  useEffect(() => {
    async function load() {
      try {
        const tenantId = await getTenantId()
        const { data: mobiles } = await supabase
          .from("mobiles")
          .select("category, device_type")
          .eq("tenant_id", tenantId)

        const map: Record<string, number> = {}
        for (const m of mobiles ?? []) {
          if (!m.category) continue
          const deviceType = m.device_type === "iphone" ? "iPhone" : "Android"
          const key = `${m.category}__${deviceType}`
          map[key] = (map[key] ?? 0) + 1
        }
        setCounts(map)
      } catch {
        toast.error("Failed to load category counts")
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

  const stats = {
    total:   CATEGORIES.length,
    iphone:  CATEGORIES.filter(c => c.type === "iPhone").length,
    android: CATEGORIES.filter(c => c.type === "Android").length,
    totalItems: Object.values(counts).reduce((s, n) => s + n, 0),
  }

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Categories</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Device categories used across purchases and inventory</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2.5">
        {[
          { title: "Total Categories",   value: stats.total,      sub: `${stats.totalItems} total phones`, Icon: Layers,     bg: "bg-blue-500" },
          { title: "iPhone Categories",  value: stats.iphone,     sub: "PTA · Non-PTA · JV",              Icon: Smartphone, bg: "bg-sky-500"  },
          { title: "Android Categories", value: stats.android,    sub: "PTA · Non-PTA",                   Icon: Smartphone, bg: "bg-emerald-500" },
          { title: "Total Phones",       value: stats.totalItems, sub: "Across all categories",            Icon: Package,    bg: "bg-violet-500" },
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
        {filtered.map((cat, i) => {
          const key = `${cat.name}__${cat.type}`
          const count = counts[key] ?? 0
          return (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                cat.type === "iPhone" ? "bg-blue-50" : "bg-emerald-50"
              }`}>
                <Tag className={`w-4 h-4 ${cat.type === "iPhone" ? "text-blue-600" : "text-emerald-600"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-bold text-slate-800">{cat.name}</span>
                  <TypeChip type={cat.type} />
                </div>
                <p className="text-[11px] text-slate-400 mb-2">{cat.description}</p>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    count > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-400"
                  }`}>
                    {loading ? "…" : `${count} phone${count !== 1 ? "s" : ""} in stock`}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

"use client"
import React, { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import {
  TrendingUp, ShoppingCart, Package, DollarSign,
  ArrowRight, AlertTriangle, Plus, BarChart2, Smartphone,
  ShoppingBag, CheckCircle2, Users, Truck, Tag, ArrowUpRight,
  ArrowDownRight, Calendar, ChevronDown, Clock, CalendarDays, X,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts"
import Link from "next/link"
import { toast } from "sonner"
import { getSales } from "@/lib/api/sales"
import { getPurchases } from "@/lib/api/purchases"
import { getMobiles, getAccessories } from "@/lib/api/products"
import { getCustomers } from "@/lib/api/customers"
import { getSuppliers } from "@/lib/api/suppliers"
import type { Sale, Purchase, Mobile, Accessory, Customer, Supplier } from "@/data/types"
import { PageWrapper } from "@/components/layout/page-wrapper"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatCurrency, formatDate } from "@/lib/utils"
import { format, subMonths, subDays, startOfWeek, endOfWeek, subWeeks, addDays, parseISO, differenceInDays } from "date-fns"

/* ─── Custom Tooltips ─────────────────────────────────────────────────────── */
const SparkTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/20 bg-white/20 backdrop-blur-sm px-2.5 py-1.5 shadow-xl text-xs text-white font-bold">
      {formatCurrency(payload[0].value)}
    </div>
  )
}

const RevenueTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-slate-600 mb-2 text-xs uppercase tracking-wide">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500 text-xs">{entry.name}:</span>
          <span className="font-bold text-slate-800 text-xs">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-slate-700 mb-1 max-w-40 truncate">{label}</p>
      <p className="font-bold text-blue-600">{payload[0].value} units sold</p>
    </div>
  )
}

const BAR_COLORS = ["#2563EB", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"]

type Period = "yesterday" | "thisWeek" | "lastWeek" | "month" | "lastMonth" | "year" | "range"

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth()
  const TODAY = format(new Date(), "yyyy-MM-dd")
  const [period, setPeriod] = useState<Period>("month")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<Sale[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [mobiles, setMobiles] = useState<Mobile[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [shopName, setShopName] = useState("MobiTrack Pro")

  useEffect(() => {
    async function load() {
      try {
        const [s, p, m, a, c, sup] = await Promise.all([
          getSales(),
          getPurchases(),
          getMobiles(),
          getAccessories(),
          getCustomers(),
          getSuppliers(),
        ])
        setSales(s)
        setPurchases(p)
        setMobiles(m)
        setAccessories(a)
        setCustomers(c)
        setSuppliers(sup)

        // Fetch shop name from tenants table
        if (user?.tenantId) {
          const { data: tenant } = await supabase
            .from("tenants")
            .select("name")
            .eq("id", user.tenantId)
            .single()
          if (tenant?.name) setShopName(tenant.name)
        }
      } catch (err) {
        toast.error("Failed to load dashboard data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.tenantId])

  const todayParsed = new Date()
  const currentMonthKey = format(todayParsed, "yyyy-MM")
  const lastMonthKey = format(subMonths(todayParsed, 1), "yyyy-MM")
  const currentYearKey = format(todayParsed, "yyyy")
  const todayStr = format(todayParsed, "yyyy-MM-dd")
  const yesterdayStr = format(subDays(todayParsed, 1), "yyyy-MM-dd")
  const thisWeekStart = format(startOfWeek(todayParsed, { weekStartsOn: 1 }), "yyyy-MM-dd")
  const lastWeekStartStr = format(startOfWeek(subWeeks(todayParsed, 1), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const lastWeekEndStr = format(endOfWeek(subWeeks(todayParsed, 1), { weekStartsOn: 1 }), "yyyy-MM-dd")

  /* ── Period filter ──────────────────────────────────────────────────── */
  const filteredSales = useMemo(() => {
    const base = sales.filter(s => s.status !== "Refunded")
    if (period === "yesterday") return base.filter(s => s.date === yesterdayStr)
    if (period === "thisWeek") return base.filter(s => s.date >= thisWeekStart && s.date <= todayStr)
    if (period === "lastWeek") return base.filter(s => s.date >= lastWeekStartStr && s.date <= lastWeekEndStr)
    if (period === "month") return base.filter(s => s.date.startsWith(currentMonthKey))
    if (period === "lastMonth") return base.filter(s => s.date.startsWith(lastMonthKey))
    if (period === "year") return base.filter(s => s.date.startsWith(currentYearKey))
    if (period === "range" && dateFrom && dateTo) return base.filter(s => s.date >= dateFrom && s.date <= dateTo)
    return base.filter(s => s.date.startsWith(currentMonthKey))
  }, [period, sales, currentMonthKey, lastMonthKey, currentYearKey, yesterdayStr, thisWeekStart, todayStr, lastWeekStartStr, lastWeekEndStr, dateFrom, dateTo])

  const filteredPurchases = useMemo(() => {
    const base = purchases
    if (period === "yesterday") return base.filter(p => p.date === yesterdayStr)
    if (period === "thisWeek") return base.filter(p => p.date >= thisWeekStart && p.date <= todayStr)
    if (period === "lastWeek") return base.filter(p => p.date >= lastWeekStartStr && p.date <= lastWeekEndStr)
    if (period === "month") return base.filter(p => p.date.startsWith(currentMonthKey))
    if (period === "lastMonth") return base.filter(p => p.date.startsWith(lastMonthKey))
    if (period === "year") return base.filter(p => p.date.startsWith(currentYearKey))
    if (period === "range" && dateFrom && dateTo) return base.filter(p => p.date >= dateFrom && p.date <= dateTo)
    return base.filter(p => p.date.startsWith(currentMonthKey))
  }, [period, purchases, currentMonthKey, lastMonthKey, currentYearKey, yesterdayStr, thisWeekStart, todayStr, lastWeekStartStr, lastWeekEndStr, dateFrom, dateTo])

  const periodRevenue    = useMemo(() => filteredSales.reduce((s, x) => s + x.total, 0), [filteredSales])
  const periodPurchases  = useMemo(() => filteredPurchases.reduce((s, x) => s + x.total, 0), [filteredPurchases])

  const mobileMap = useMemo(() => new Map(mobiles.map(m => [m.id, m.purchasePrice])), [mobiles])
  const accMap    = useMemo(() => new Map(accessories.map(a => [a.id, a.purchasePrice])), [accessories])

  const periodProfit = useMemo(() => filteredSales.reduce((total, sale) =>
    total + sale.items.reduce((sub, item) => {
      const cost = item.productType === "Mobile"
        ? (mobileMap.get(item.productId) ?? item.unitPrice * 0.82)
        : (accMap.get(item.productId) ?? item.unitPrice * 0.75)
      return sub + (item.unitPrice - cost) * item.quantity - item.discount
    }, 0), 0), [filteredSales, mobileMap, accMap])

  /* ── Sparkline data for financial cards (daily within period) */
  const salesSparkData = useMemo(() => {
    const base = (arr: typeof sales) => arr.filter(s => s.status !== "Refunded")
    if (period === "year") {
      return Array.from({ length: 12 }, (_, i) => {
        const monthKey = format(subMonths(todayParsed, 11 - i), "yyyy-MM")
        return { v: base(sales).filter(s => s.date.startsWith(monthKey)).reduce((s, x) => s + x.total, 0) }
      })
    }
    if (period === "yesterday") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = format(subDays(todayParsed, 6 - i), "yyyy-MM-dd")
        return { v: base(sales).filter(s => s.date === d).reduce((s, x) => s + x.total, 0) }
      })
    }
    if (period === "thisWeek") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = format(addDays(parseISO(thisWeekStart), i), "yyyy-MM-dd")
        return { v: base(sales).filter(s => s.date === d).reduce((s, x) => s + x.total, 0) }
      })
    }
    if (period === "lastWeek") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = format(addDays(parseISO(lastWeekStartStr), i), "yyyy-MM-dd")
        return { v: base(sales).filter(s => s.date === d).reduce((s, x) => s + x.total, 0) }
      })
    }
    if (period === "range" && dateFrom && dateTo) {
      const totalDays = Math.max(1, differenceInDays(parseISO(dateTo), parseISO(dateFrom)))
      const points = Math.min(10, totalDays + 1)
      return Array.from({ length: points }, (_, i) => {
        const d = format(addDays(parseISO(dateFrom), Math.round(i * totalDays / (points - 1 || 1))), "yyyy-MM-dd")
        return { v: base(sales).filter(s => s.date <= d && s.date >= dateFrom).reduce((s, x) => s + x.total, 0) }
      })
    }
    // month / lastMonth
    const baseMonth = period === "lastMonth" ? lastMonthKey : currentMonthKey
    return Array.from({ length: 10 }, (_, i) => {
      const dayStr = `${baseMonth}-${String((i + 1) * 3).padStart(2, "0")}`
      return { v: base(sales).filter(s => s.date <= dayStr && s.date >= baseMonth + "-01").reduce((s, x) => s + x.total, 0) }
    })
  }, [period, sales, currentMonthKey, lastMonthKey, thisWeekStart, lastWeekStartStr, dateFrom, dateTo])

  const purchaseSparkData = useMemo(() => {
    if (period === "year") {
      return Array.from({ length: 12 }, (_, i) => {
        const monthKey = format(subMonths(todayParsed, 11 - i), "yyyy-MM")
        return { v: purchases.filter(p => p.date.startsWith(monthKey)).reduce((s, x) => s + x.total, 0) }
      })
    }
    if (period === "yesterday") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = format(subDays(todayParsed, 6 - i), "yyyy-MM-dd")
        return { v: purchases.filter(p => p.date === d).reduce((s, x) => s + x.total, 0) }
      })
    }
    if (period === "thisWeek") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = format(addDays(parseISO(thisWeekStart), i), "yyyy-MM-dd")
        return { v: purchases.filter(p => p.date === d).reduce((s, x) => s + x.total, 0) }
      })
    }
    if (period === "lastWeek") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = format(addDays(parseISO(lastWeekStartStr), i), "yyyy-MM-dd")
        return { v: purchases.filter(p => p.date === d).reduce((s, x) => s + x.total, 0) }
      })
    }
    if (period === "range" && dateFrom && dateTo) {
      const totalDays = Math.max(1, differenceInDays(parseISO(dateTo), parseISO(dateFrom)))
      const points = Math.min(10, totalDays + 1)
      return Array.from({ length: points }, (_, i) => {
        const d = format(addDays(parseISO(dateFrom), Math.round(i * totalDays / (points - 1 || 1))), "yyyy-MM-dd")
        return { v: purchases.filter(p => p.date <= d && p.date >= dateFrom).reduce((s, x) => s + x.total, 0) }
      })
    }
    const baseMonth = period === "lastMonth" ? lastMonthKey : currentMonthKey
    return Array.from({ length: 10 }, (_, i) => {
      const dayStr = `${baseMonth}-${String((i + 1) * 3).padStart(2, "0")}`
      return { v: purchases.filter(p => p.date <= dayStr && p.date >= baseMonth + "-01").reduce((s, x) => s + x.total, 0) }
    })
  }, [period, purchases, currentMonthKey, lastMonthKey, thisWeekStart, lastWeekStartStr, dateFrom, dateTo])

  const profitSparkData = useMemo(() =>
    salesSparkData.map((d, i) => ({ v: Math.max(0, d.v - (purchaseSparkData[i]?.v ?? 0) * 0.3) }))
  , [salesSparkData, purchaseSparkData])

  /* ── Revenue chart — last 7 months */
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const monthDate  = subMonths(todayParsed, 6 - i)
      const monthKey   = format(monthDate, "yyyy-MM")
      const monthLabel = format(monthDate, "MMM ''yy")
      const monthSales = sales.filter(s => s.date.startsWith(monthKey) && s.status !== "Refunded")
      const revenue    = monthSales.reduce((s, x) => s + x.total, 0)
      const profit     = monthSales.reduce((total, sale) =>
        total + sale.items.reduce((sub, item) => {
          const cost = item.productType === "Mobile"
            ? (mobileMap.get(item.productId) ?? item.unitPrice * 0.82)
            : (accMap.get(item.productId) ?? item.unitPrice * 0.75)
          return sub + (item.unitPrice - cost) * item.quantity - item.discount
        }, 0), 0)
      return { month: monthLabel, Revenue: revenue, Profit: Math.max(0, profit) }
    })
  }, [mobileMap, accMap, sales])

  /* ── Top selling products */
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; units: number }> = {}
    sales.filter(s => s.status !== "Refunded").forEach(sale =>
      sale.items.forEach(item => {
        if (!map[item.productId]) map[item.productId] = { name: item.productName, units: 0 }
        map[item.productId].units += item.quantity
      })
    )
    return Object.values(map).sort((a, b) => b.units - a.units).slice(0, 5)
  }, [sales])

  /* ── Low stock */
  const lowStockItems = useMemo(() => {
    const lm = mobiles.filter(m => m.stock <= 5).map(m => ({ id: m.id, name: `${m.brand} ${m.model}`, stock: m.stock, type: "Mobile" as const }))
    const la = accessories.filter(a => a.stock <= 5).map(a => ({ id: a.id, name: a.name, stock: a.stock, type: "Accessory" as const }))
    return [...lm, ...la].sort((a, b) => a.stock - b.stock).slice(0, 6)
  }, [mobiles, accessories])

  /* ── Recent tables */
  const recentSales     = useMemo(() => [...sales].reverse().slice(0, 7), [sales])
  const recentPurchases = useMemo(() => [...purchases].reverse().slice(0, 7), [purchases])

  const totalProducts = mobiles.length + accessories.length
  const totalSalesCount = sales.length
  const totalPurchasesCount = purchases.length

  const periodLabel = {
    yesterday: "Yesterday",
    thisWeek: "This Week",
    lastWeek: "Last Week",
    month: "This Month",
    lastMonth: "Last Month",
    year: "This Year",
    range: dateFrom && dateTo ? `${dateFrom} – ${dateTo}` : "Custom Range",
  }[period]

  const FILTER_OPTIONS: { value: Period; label: string; icon: React.ElementType; desc: string }[] = [
    { value: "yesterday", label: "Yesterday",    icon: Clock,        desc: "Sales from yesterday" },
    { value: "thisWeek",  label: "This Week",    icon: CalendarDays, desc: "Mon – today" },
    { value: "lastWeek",  label: "Last Week",    icon: CalendarDays, desc: "Mon – Sun, prev week" },
    { value: "month",     label: "This Month",   icon: Calendar,     desc: format(todayParsed, "MMMM yyyy") },
    { value: "lastMonth", label: "Last Month",   icon: Calendar,     desc: format(subMonths(todayParsed, 1), "MMMM yyyy") },
    { value: "year",      label: "This Year",    icon: TrendingUp,   desc: currentYearKey },
    { value: "range",     label: "Custom Range", icon: CalendarDays, desc: "Pick a date range" },
  ]

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading dashboard...</p>
          </div>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>

      {/* ── Welcome Banner ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 mb-6 shadow-lg shadow-blue-200">
        {/* decorative circles */}
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute right-20 -bottom-12 w-32 h-32 rounded-full bg-white/5" />
        <div className="absolute right-8 top-4 w-16 h-16 rounded-full bg-white/8" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1">Welcome back,</p>
            <h1 className="text-white text-xl sm:text-2xl font-bold tracking-tight">{user?.name || "User"}</h1>
            <p className="text-blue-200 text-sm mt-1">{formatDate(TODAY)} — {shopName}</p>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-blue-200 text-xs">Today's Sales</p>
              <p className="text-white text-xl font-bold">
                {formatCurrency(sales.filter(s => s.date === TODAY).reduce((s, x) => s + x.total, 0))}
              </p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="text-right">
              <p className="text-blue-200 text-xs">Transactions</p>
              <p className="text-white text-xl font-bold">
                {sales.filter(s => s.date === TODAY).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-6">
        {[
          { href: "/sales/new",           icon: Plus,        label: "New Sale",      bg: "from-blue-500 to-blue-600",       shadow: "shadow-blue-200"   },
          { href: "/purchases/new",       icon: ShoppingBag, label: "New Purchase",  bg: "from-violet-500 to-violet-600",   shadow: "shadow-violet-200" },
          { href: "/products/mobiles",    icon: Smartphone,  label: "Add Mobile",    bg: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-200"},
          { href: "/products/accessories",icon: Package,     label: "Accessories",   bg: "from-amber-500 to-amber-600",     shadow: "shadow-amber-200"  },
          { href: "/customers",           icon: Users,       label: "Customers",     bg: "from-rose-500 to-rose-600",       shadow: "shadow-rose-200"   },
          { href: "/reports",             icon: BarChart2,   label: "Reports",       bg: "from-cyan-500 to-cyan-600",       shadow: "shadow-cyan-200"   },
        ].map(({ href, icon: Icon, label, bg, shadow }) => (
          <Link key={href} href={href}>
            <div className="flex flex-col items-center justify-center gap-1.5 sm:gap-2.5 rounded-xl sm:rounded-2xl bg-white border border-slate-100 p-2.5 sm:p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer text-center group shadow-sm">
              <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-linear-to-br ${bg} flex items-center justify-center shadow-md ${shadow} group-hover:scale-110 transition-transform`}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-700 leading-tight">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Financial Overview ───────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Financial Overview</h2>
            <p className="text-xs text-slate-400 mt-0.5">Revenue, purchases & profit summary</p>
          </div>
          {/* Period filter trigger button */}
          <div className="relative self-start sm:self-auto">
            <button
              onClick={() => setShowFilterMenu(v => !v)}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-300 hover:shadow-md transition-all min-w-[140px]"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="flex-1 text-left truncate">{periodLabel}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${showFilterMenu ? "rotate-180" : ""}`} />
            </button>

            {/* Desktop dropdown */}
            {showFilterMenu && (
              <div className="hidden sm:block absolute right-0 mt-1.5 z-50 bg-white border border-slate-100 rounded-2xl shadow-xl py-1.5 min-w-[180px]">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setPeriod(opt.value); if (opt.value !== "range") setShowFilterMenu(false) }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-colors ${
                      period === opt.value ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <opt.icon className={`w-3.5 h-3.5 ${period === opt.value ? "text-blue-500" : "text-slate-400"}`} />
                    {opt.label}
                  </button>
                ))}
                {period === "range" && (
                  <div className="px-3 pb-2 pt-1 border-t border-slate-100 space-y-1.5">
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile bottom sheet — rendered via portal to escape overflow:hidden on AppShell */}
          {showFilterMenu && typeof document !== "undefined" && createPortal(
            <div className="sm:hidden fixed inset-0 z-[9999] flex flex-col justify-end" onClick={() => setShowFilterMenu(false)}>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
              <div
                className="relative bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-slate-200" />
                </div>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Select Period</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Filter financial overview data</p>
                  </div>
                  <button onClick={() => setShowFilterMenu(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                {/* Options */}
                <div className="px-4 py-3 space-y-1">
                  {FILTER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setPeriod(opt.value); if (opt.value !== "range") setShowFilterMenu(false) }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all ${
                        period === opt.value
                          ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        period === opt.value ? "bg-white/20" : "bg-white shadow-sm"
                      }`}>
                        <opt.icon className={`w-4 h-4 ${period === opt.value ? "text-white" : "text-blue-500"}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-semibold leading-tight ${period === opt.value ? "text-white" : "text-slate-800"}`}>{opt.label}</p>
                        <p className={`text-[10px] mt-0.5 ${period === opt.value ? "text-blue-100" : "text-slate-400"}`}>{opt.desc}</p>
                      </div>
                      {period === opt.value && (
                        <CheckCircle2 className="w-4.5 h-4.5 text-white shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                {/* Custom range date pickers */}
                {period === "range" && (
                  <div className="mx-4 mb-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Date Range</p>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">From</label>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={e => setDateFrom(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">To</label>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={e => setDateTo(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setShowFilterMenu(false)}
                      className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm shadow-md shadow-blue-200 active:scale-95 transition-transform"
                    >
                      Apply Range
                    </button>
                  </div>
                )}
                {/* Safe area bottom */}
                <div className="h-6" />
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* ── MOBILE: individual gradient cards ── */}
        <div className="sm:hidden space-y-3">
          {([
            {
              label: "Sales Revenue", value: formatCurrency(periodRevenue),
              sub: `${filteredSales.length} transactions`,
              icon: ShoppingCart, grad: "from-blue-500 to-blue-600",
              shadow: "shadow-blue-200/60",
            },
            {
              label: "Purchases", value: formatCurrency(periodPurchases),
              sub: `${filteredPurchases.length} orders`,
              icon: TrendingUp, grad: "from-violet-500 to-violet-600",
              shadow: "shadow-violet-200/60",
            },
            {
              label: "Gross Profit", value: formatCurrency(Math.max(0, Math.round(periodProfit))),
              sub: `${periodRevenue > 0 ? Math.round((periodProfit / periodRevenue) * 100) : 0}% margin`,
              icon: DollarSign, grad: "from-emerald-500 to-emerald-600",
              shadow: "shadow-emerald-200/60",
            },
          ] as const).map(({ label, value, sub, icon: Icon, grad, shadow }) => (
            <div key={label} className={`relative overflow-hidden rounded-2xl bg-linear-to-r ${grad} px-5 py-5 shadow-lg ${shadow}`}>
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
              <div className="absolute right-6 bottom-0 w-14 h-14 rounded-full bg-white/5" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs font-medium mb-1">{label}</p>
                  <p className="text-white text-2xl font-bold tracking-tight">{value}</p>
                  <p className="text-white/60 text-xs mt-1.5">{sub}</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── DESKTOP: full gradient cards with sparklines ── */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-4">
          {/* Sales Card */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-blue-500 to-blue-700 p-5 shadow-lg shadow-blue-200/60">
            <div className="absolute -right-4 -top-4 w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute -right-2 bottom-0 w-16 h-16 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-blue-200 text-xs font-medium">Sales Revenue</p>
                  <p className="text-blue-100 text-[11px]">{periodLabel}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-white text-2xl font-bold tracking-tight mb-1">{formatCurrency(periodRevenue)}</p>
              <p className="text-blue-200 text-xs">{filteredSales.length} transactions</p>
              <div className="mt-3 h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesSparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ffffff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip content={<SparkTooltip />} />
                    <Area type="monotone" dataKey="v" stroke="#ffffff" strokeWidth={2} fill="url(#salesSpark)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Purchases Card */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-violet-500 to-violet-700 p-5 shadow-lg shadow-violet-200/60">
            <div className="absolute -right-4 -top-4 w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute -right-2 bottom-0 w-16 h-16 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-violet-200 text-xs font-medium">Purchases</p>
                  <p className="text-violet-100 text-[11px]">{periodLabel}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-white text-2xl font-bold tracking-tight mb-1">{formatCurrency(periodPurchases)}</p>
              <p className="text-violet-200 text-xs">{filteredPurchases.length} purchase orders</p>
              <div className="mt-3 h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={purchaseSparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="purchaseSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ffffff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip content={<SparkTooltip />} />
                    <Area type="monotone" dataKey="v" stroke="#ffffff" strokeWidth={2} fill="url(#purchaseSpark)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Profit Card */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-500 to-emerald-700 p-5 shadow-lg shadow-emerald-200/60">
            <div className="absolute -right-4 -top-4 w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute -right-2 bottom-0 w-16 h-16 rounded-full bg-white/5" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-emerald-200 text-xs font-medium">Gross Profit</p>
                  <p className="text-emerald-100 text-[11px]">{periodLabel}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
              </div>
              <p className="text-white text-2xl font-bold tracking-tight mb-1">{formatCurrency(Math.max(0, Math.round(periodProfit)))}</p>
              <p className="text-emerald-200 text-xs">
                {periodRevenue > 0 ? Math.round((periodProfit / periodRevenue) * 100) : 0}% gross margin
              </p>
              <div className="mt-3 h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitSparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="profitSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ffffff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip content={<SparkTooltip />} />
                    <Area type="monotone" dataKey="v" stroke="#ffffff" strokeWidth={2} fill="url(#profitSpark)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat Counters ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {([
          { label: "Total Products",   value: totalProducts,       icon: Package,     color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-100",    href: "/products/mobiles"  },
          { label: "Customers",        value: customers.length,    icon: Users,       color: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-100",  href: "/customers"         },
          { label: "Suppliers",        value: suppliers.length,    icon: Truck,       color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", href: "/suppliers"         },
          { label: "Total Sales",      value: totalSalesCount,     icon: ShoppingCart,color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100",   href: "/sales"             },
          { label: "Total Purchases",  value: totalPurchasesCount, icon: TrendingUp,  color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-100",    href: "/purchases"         },
        ] as const).map(({ label, value, icon: Icon, color, bg, border, href }, idx) => (
          <Link key={href} href={href} className={idx === 4 ? "col-span-2 sm:col-span-1" : ""}>
            <div className={`flex flex-col gap-3.5 rounded-2xl bg-white border ${border} p-4 sm:p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer shadow-sm h-full`}>
              <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-800 leading-none">{value}</p>
                <p className="text-xs text-slate-500 mt-1.5 font-medium">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Revenue Chart ────────────────────────────────────────────────── */}
      <Card className="mb-6 border-slate-100 shadow-sm rounded-2xl">
        <CardHeader className="pb-0 pt-5 px-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">Revenue & Profit Overview</CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">Monthly revenue vs gross profit — last 7 months</p>
            </div>
            <div className="flex items-center gap-5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />Profit
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-2 pb-4">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}k`}
                width={48}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2.5}
                fill="url(#revGrad)" dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#2563eb" }} />
              <Area type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2.5}
                fill="url(#profGrad)" dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#059669" }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Recent Transactions (side by side) ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6">

        {/* Recent Sales */}
        <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="px-5 py-4 border-b border-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-200">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">Recent Sales</CardTitle>
                  <p className="text-[10px] text-slate-400">Latest transactions</p>
                </div>
              </div>
              <Link href="/sales" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile card list */}
            <div className="divide-y divide-slate-50 md:hidden">
              {recentSales.map(sale => (
                <div key={sale.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/70 transition-colors gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md shrink-0">{sale.invoiceNumber}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-xs truncate">{sale.customerName}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(sale.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-800 text-sm">{formatCurrency(sale.total)}</span>
                    <StatusBadge status={sale.status} />
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/70">
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Invoice</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Customer</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Total</th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{sale.invoiceNumber}</span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-800 text-xs truncate max-w-28">{sale.customerName}</p>
                      <p className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(sale.date)}</p>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="font-bold text-slate-800 text-sm">{formatCurrency(sale.total)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={sale.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Purchases */}
        <Card className="border-slate-100 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="px-5 py-4 border-b border-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shadow-sm shadow-violet-200">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">Recent Purchases</CardTitle>
                  <p className="text-[10px] text-slate-400">Latest purchase orders</p>
                </div>
              </div>
              <Link href="/purchases" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile card list */}
            <div className="divide-y divide-slate-50 md:hidden">
              {recentPurchases.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/70 transition-colors gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md shrink-0">{p.poNumber}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-xs truncate">{p.supplierName}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(p.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-slate-800 text-sm">{formatCurrency(p.total)}</span>
                    <StatusBadge status={p.paymentStatus} />
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/70">
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">PO #</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Supplier</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Total</th>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentPurchases.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">{p.poNumber}</span>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-800 text-xs truncate max-w-28">{p.supplierName}</p>
                      <p className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(p.date)}</p>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="font-bold text-slate-800 text-sm">{formatCurrency(p.total)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom row: Top Products + Low Stock ───────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Top Selling Products */}
        <Card className="border-slate-100 shadow-sm rounded-2xl">
          <CardHeader className="pb-2 px-6 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-800">Top Selling Products</CardTitle>
                <p className="text-xs text-slate-400">By units sold — all time</p>
              </div>
              <Link href="/products/mobiles" className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-5 pt-2">
            <ResponsiveContainer width="100%" height={Math.max(120, topProducts.length * 36)}>
              <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  domain={[0, (dataMax: number) => Math.max(dataMax + 1, 2)]}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                  tickFormatter={(v: string) => v.length > 11 ? v.substring(0, 10) + "…" : v}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="units" radius={[0, 6, 6, 0]} maxBarSize={16}>
                  {topProducts.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-1.5 border-t border-slate-50 pt-3">
              {topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: BAR_COLORS[i] }} />
                    <span className="text-slate-600 truncate">{p.name}</span>
                  </div>
                  <span className="font-bold text-slate-700 shrink-0 ml-2">{p.units} sold</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="border-slate-100 shadow-sm rounded-2xl">
          <CardHeader className="px-6 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm shadow-amber-200">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">Low Stock Alerts</CardTitle>
                  <p className="text-[10px] text-slate-400">Items needing restock</p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {lowStockItems.length} items
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5 pt-0 space-y-2">
            {lowStockItems.length === 0 ? (
              <div className="flex items-center gap-2 py-4 text-emerald-600 text-sm font-medium">
                <CheckCircle2 className="w-5 h-5" />
                All stock levels are healthy
              </div>
            ) : (
              lowStockItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 hover:bg-amber-50/40 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${item.stock === 0 ? "bg-red-100" : "bg-amber-100"}`}>
                    {item.type === "Mobile"
                      ? <Smartphone className={`w-4 h-4 ${item.stock === 0 ? "text-red-600" : "text-amber-600"}`} />
                      : <Package className={`w-4 h-4 ${item.stock === 0 ? "text-red-600" : "text-amber-600"}`} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{item.type}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {item.stock === 0 ? (
                      <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">OUT</span>
                    ) : (
                      <span className="text-sm font-bold text-amber-600">{item.stock} <span className="text-[10px] text-slate-400 font-normal">left</span></span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>
    </PageWrapper>
  )
}

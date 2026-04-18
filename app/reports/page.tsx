"use client"

import { useState, useMemo, useEffect } from "react"
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { toast } from "sonner"
import { getSales } from "@/lib/api/sales"
import { getPurchases } from "@/lib/api/purchases"
import { getMobiles, getAccessories } from "@/lib/api/products"
import { getSuppliers } from "@/lib/api/suppliers"
import type { Sale, Purchase, Mobile, Accessory, Supplier } from "@/data/types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/shared/status-badge"
import { StatCard } from "@/components/shared/stat-card"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Download, FileText, TrendingUp, TrendingDown,
  BarChart2, Package, DollarSign, ShoppingCart, BarChart3,
} from "lucide-react"
import { format, parseISO, startOfMonth, subMonths } from "date-fns"

const COLORS     = ["#2563EB","#3b82f6","#60a5fa","#93c5fd","#bfdbfe","#1e40af","#1d4ed8","#dbeafe"]
const PIE_COLORS = ["#2563EB","#3b82f6","#60a5fa","#1e40af","#93c5fd"]

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-xs">
      {"★".repeat(Math.floor(rating))}{"☆".repeat(5 - Math.floor(rating))}
      <span className="text-slate-400 text-[10px] ml-1">({rating})</span>
    </span>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-2.5 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-0.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === "number" && p.value > 1000 ? formatCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Reusable section card ─────────────────────────────────────────────────────
function SectionCard({ title, badge, children, className }: {
  title: string; badge?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className ?? ""}`}>
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  )
}

// ── Date range + export bar ───────────────────────────────────────────────────
function DateBar({ from, to, onFrom, onTo }: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2.5 flex flex-wrap items-end gap-3">
      <div>
        <p className="text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wide">From</p>
        <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-8 text-xs w-36" />
      </div>
      <div>
        <p className="text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-wide">To</p>
        <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="h-8 text-xs w-36" />
      </div>
      <div className="flex gap-2 ml-auto">
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 px-3">
          <Download className="w-3.5 h-3.5" />Export CSV
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 px-3">
          <FileText className="w-3.5 h-3.5" />Export PDF
        </Button>
      </div>
    </div>
  )
}

// ── Compact table head/cell helpers ───────────────────────────────────────────
const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>
)
const TD = ({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) => (
  <td className={`text-xs px-3 py-1.5 ${right ? "text-right" : ""} ${className ?? ""}`}>{children}</td>
)

export default function ReportsPage() {
  const [loading, setLoading]           = useState(true)
  const [sales, setSales]               = useState<Sale[]>([])
  const [purchases, setPurchases]       = useState<Purchase[]>([])
  const [mobiles, setMobiles]           = useState<Mobile[]>([])
  const [accessories, setAccessories]   = useState<Accessory[]>([])
  const [suppliers, setSuppliers]       = useState<Supplier[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [s, p, m, a, sup] = await Promise.all([getSales(), getPurchases(), getMobiles(), getAccessories(), getSuppliers()])
        setSales(s); setPurchases(p); setMobiles(m); setAccessories(a); setSuppliers(sup)
      } catch { toast.error("Failed to load reports data") }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const [salesFrom,     setSalesFrom]     = useState(new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0])
  const [salesTo,       setSalesTo]       = useState(new Date().toISOString().split("T")[0])
  const [purchasesFrom, setPurchasesFrom] = useState(new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0])
  const [purchasesTo,   setPurchasesTo]   = useState(new Date().toISOString().split("T")[0])

  // ── Sales data ────────────────────────────────────────────────────────────
  const salesData = useMemo(() => {
    const filtered = sales.filter((s) => s.date >= salesFrom && s.date <= salesTo && s.status !== "Refunded")
    const totalSales = filtered.reduce((a, s) => a + s.total, 0)
    const dailyMap: Record<string, number> = {}
    filtered.forEach((s) => { dailyMap[s.date] = (dailyMap[s.date] || 0) + s.total })
    const dailyEntries = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))
    const dailyChartData = dailyEntries.map(([date, amount]) => ({ date: format(parseISO(date), "dd MMM"), Sales: amount }))
    const days = dailyEntries.length || 1
    const highestDay = dailyEntries.reduce((max, [, v]) => Math.max(max, v), 0)
    const productMap: Record<string, { name: string; type: string; units: number; revenue: number }> = {}
    filtered.forEach((s) => s.items.forEach((item) => {
      if (!productMap[item.productId]) productMap[item.productId] = { name: item.productName, type: item.productType, units: 0, revenue: 0 }
      productMap[item.productId].units += item.quantity
      productMap[item.productId].revenue += item.lineTotal
    }))
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    const pmMap: Record<string, number> = {}
    filtered.forEach((s) => { pmMap[s.paymentMethod] = (pmMap[s.paymentMethod] || 0) + s.total })
    return {
      totalSales, numTx: filtered.length, avgDaily: totalSales / days, highestDay,
      dailyChartData, topProducts, paymentPieData: Object.entries(pmMap).map(([name, value]) => ({ name, value })),
    }
  }, [salesFrom, salesTo, sales])

  // ── Purchases data ────────────────────────────────────────────────────────
  const purchasesData = useMemo(() => {
    const filtered = purchases.filter((p) => p.date >= purchasesFrom && p.date <= purchasesTo)
    const totalSpend = filtered.reduce((a, p) => a + p.total, 0)
    const monthlyMap: Record<string, number> = {}
    filtered.forEach((p) => { const k = format(parseISO(p.date), "MMM yyyy"); monthlyMap[k] = (monthlyMap[k] || 0) + p.total })
    const supplierMap: Record<string, { name: string; orders: number; spent: number }> = {}
    filtered.forEach((p) => {
      if (!supplierMap[p.supplierId]) supplierMap[p.supplierId] = { name: p.supplierName, orders: 0, spent: 0 }
      supplierMap[p.supplierId].orders++; supplierMap[p.supplierId].spent += p.total
    })
    const catMap = { Mobiles: 0, Accessories: 0 }
    filtered.forEach((p) => p.items.forEach((item) => {
      if (item.productType === "Mobile") catMap.Mobiles += item.total
      else catMap.Accessories += item.total
    }))
    return {
      totalSpend, uniqueSuppliers: new Set(filtered.map((p) => p.supplierId)).size,
      avgOrderValue: filtered.length ? totalSpend / filtered.length : 0,
      pendingPayments: filtered.filter((p) => p.paymentStatus !== "Paid").reduce((a, p) => a + p.balanceDue, 0),
      monthlyChartData: Object.entries(monthlyMap).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime()).map(([month, Spend]) => ({ month, Spend })),
      supplierRows: Object.values(supplierMap).sort((a, b) => b.spent - a.spent).map((s) => ({ ...s, pct: totalSpend ? ((s.spent / totalSpend) * 100).toFixed(1) : "0.0" })),
      categoryBarData: [{ category: "Mobiles", Spend: catMap.Mobiles }, { category: "Accessories", Spend: catMap.Accessories }],
    }
  }, [purchasesFrom, purchasesTo, purchases])

  // ── P&L data ──────────────────────────────────────────────────────────────
  const plData = useMemo(() => {
    const now = new Date()
    const costMap: Record<string, number> = {}
    mobiles.forEach((m) => { costMap[m.id] = m.purchasePrice })
    accessories.forEach((a) => { costMap[a.id] = a.purchasePrice })
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(startOfMonth(now), 5 - i)
      return { key: format(d, "yyyy-MM"), label: format(d, "MMM yy") }
    })
    const monthlyRows = months.map(({ key, label }) => {
      const monthSales = sales.filter((s) => s.date.startsWith(key) && s.status !== "Refunded")
      const revenue = monthSales.reduce((a, s) => a + s.total, 0)
      const cost = monthSales.reduce((a, s) => a + s.items.reduce((b, item) => b + (costMap[item.productId] || item.unitPrice * 0.82) * item.quantity, 0), 0)
      const profit = revenue - cost
      return { month: label, Revenue: revenue, Cost: cost, Profit: profit, margin: revenue ? (profit / revenue) * 100 : 0 }
    })
    const grossRevenue = monthlyRows.reduce((a, r) => a + r.Revenue, 0)
    const totalCost    = monthlyRows.reduce((a, r) => a + r.Cost, 0)
    const grossProfit  = grossRevenue - totalCost
    return {
      grossRevenue, totalCost, grossProfit, profitMargin: grossRevenue ? (grossProfit / grossRevenue) * 100 : 0,
      monthlyRows, tableRows: monthlyRows.map((r, i) => {
        const prev = i > 0 ? monthlyRows[i - 1].Profit : null
        return { ...r, momChange: prev !== null && prev !== 0 ? ((r.Profit - prev) / Math.abs(prev)) * 100 : null }
      }),
    }
  }, [sales, mobiles, accessories])

  // ── Inventory data ────────────────────────────────────────────────────────
  const inventoryData = useMemo(() => {
    const mSV = mobiles.reduce((a, m) => a + m.purchasePrice * m.stock, 0)
    const aSV  = accessories.reduce((a, acc) => a + acc.purchasePrice * acc.stock, 0)
    const totalUnits = mobiles.reduce((a, m) => a + m.stock, 0) + accessories.reduce((a, acc) => a + acc.stock, 0)
    const catValueMap: Record<string, number> = {}
    mobiles.forEach((m) => { catValueMap[m.category] = (catValueMap[m.category] || 0) + m.purchasePrice * m.stock })
    accessories.forEach((a) => { const cat = a.category.split("/")[0].trim(); catValueMap[cat] = (catValueMap[cat] || 0) + a.purchasePrice * a.stock })
    const allProducts = [...mobiles.map((m) => ({ name: `${m.brand} ${m.model}`, stock: m.stock })), ...accessories.map((a) => ({ name: a.name, stock: a.stock }))]
    const lowStock = [
      ...mobiles.filter((m) => m.stock < 5).map((m) => ({ name: `${m.brand} ${m.model}`, stock: m.stock, suggested: Math.max(10, 10 - m.stock) })),
      ...accessories.filter((a) => a.stock < 5).map((a) => ({ name: a.name, stock: a.stock, suggested: Math.max(20, 20 - a.stock) })),
    ].sort((a, b) => a.stock - b.stock)
    return {
      totalProducts: mobiles.length + accessories.length, totalStockValue: mSV + aSV,
      avgProductValue: totalUnits > 0 ? (mSV + aSV) / totalUnits : 0,
      categoryDonutData: Object.entries(catValueMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })),
      topByUnits: allProducts.sort((a, b) => b.stock - a.stock).slice(0, 10),
      lowStockItems: lowStock,
    }
  }, [mobiles, accessories])

  // ── Supplier perf data ────────────────────────────────────────────────────
  const supplierPerf = useMemo(() => {
    const supplierRows = suppliers.filter((s) => s.status === "Active").sort((a, b) => b.totalPurchases - a.totalPurchases).map((s, i) => ({ rank: i + 1, ...s }))
    const top5 = supplierRows.slice(0, 5).map((s) => ({ name: s.companyName.split(" ").slice(0, 2).join(" "), Volume: s.totalPurchases }))
    const pmCount: Record<string, number> = { Paid: 0, Partial: 0, Unpaid: 0 }
    purchases.forEach((p) => { pmCount[p.paymentStatus] = (pmCount[p.paymentStatus] || 0) + p.total })
    return { supplierRows, top5, paymentPie: Object.entries(pmCount).map(([name, value]) => ({ name, value })) }
  }, [suppliers, purchases])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Reports & Analytics</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 px-3">
            <FileText className="w-3.5 h-3.5" />Generate PDF
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5 px-3 bg-blue-600 hover:bg-blue-700">
            <Download className="w-3.5 h-3.5" />Export All
          </Button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="sales" className="space-y-3">
        <TabsList className="bg-white border border-slate-200 p-0.5 rounded-xl shadow-sm h-8 overflow-x-auto">
          {[["sales","Sales Report"],["purchases","Purchase Report"],["pl","Profit & Loss"],["inventory","Inventory Report"],["suppliers","Supplier Performance"]].map(([v, l]) => (
            <TabsTrigger key={v} value={v} className="h-7 text-xs px-3 rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">{l}</TabsTrigger>
          ))}
        </TabsList>

        {/* ══ SALES REPORT ══════════════════════════════════════════════════════ */}
        <TabsContent value="sales" className="space-y-3 mt-0">
          <DateBar from={salesFrom} to={salesTo} onFrom={setSalesFrom} onTo={setSalesTo} />

          <div className="grid grid-cols-4 gap-2.5">
            <StatCard title="Total Sales"       value={formatCurrency(salesData.totalSales)}           subtext="Excl. refunded orders" icon={DollarSign}  iconBg="bg-blue-100"   trend={12} />
            <StatCard title="Avg Daily Sale"    value={formatCurrency(Math.round(salesData.avgDaily))} subtext="Over selected period"  icon={TrendingUp}  iconBg="bg-blue-100" />
            <StatCard title="Highest Single Day" value={formatCurrency(salesData.highestDay)}          subtext="Peak revenue day"      icon={BarChart2}   iconBg="bg-blue-100" />
            <StatCard title="Transactions"      value={salesData.numTx.toString()}                    subtext="Completed + Pending"   icon={ShoppingCart} iconBg="bg-blue-100" />
          </div>

          <SectionCard title="Daily Sales Over Period">
            <div className="p-3">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={salesData.dailyChartData} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v/1000).toFixed(0)}K`} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <SectionCard title="Top 10 Selling Products" className="xl:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-slate-50 border-b border-slate-100">
                    <TH>#</TH><TH>Product</TH><TH>Type</TH><TH right>Units</TH><TH right>Revenue</TH>
                  </tr></thead>
                  <tbody>
                    {salesData.topProducts.map((p, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <TD>
                          {i < 3
                            ? <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold ${i===0?"bg-blue-600 text-white":i===1?"bg-blue-400 text-white":"bg-blue-100 text-blue-700"}`}>{i+1}</span>
                            : <span className="text-slate-400 text-[10px] pl-0.5">{i+1}</span>}
                        </TD>
                        <TD className="font-semibold text-slate-800">{p.name}</TD>
                        <TD>
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${p.type==="Mobile"?"text-blue-600 border-blue-200 bg-blue-50":"text-slate-600 border-slate-200 bg-slate-50"}`}>{p.type}</span>
                        </TD>
                        <TD right className="font-semibold text-slate-700">{p.units}</TD>
                        <TD right className="font-semibold text-blue-600">{formatCurrency(p.revenue)}</TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
            <SectionCard title="Payment Methods">
              <div className="p-3">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={salesData.paymentPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value">
                      {salesData.paymentPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        {/* ══ PURCHASE REPORT ═══════════════════════════════════════════════════ */}
        <TabsContent value="purchases" className="space-y-3 mt-0">
          <DateBar from={purchasesFrom} to={purchasesTo} onFrom={setPurchasesFrom} onTo={setPurchasesTo} />

          <div className="grid grid-cols-4 gap-2.5">
            <StatCard title="Total Spend"       value={formatCurrency(purchasesData.totalSpend)}                    subtext="All purchase orders"       icon={DollarSign}   iconBg="bg-red-100" />
            <StatCard title="Unique Suppliers"  value={purchasesData.uniqueSuppliers.toString()}                   subtext="Active in period"          icon={Package}      iconBg="bg-blue-100" />
            <StatCard title="Avg Order Value"   value={formatCurrency(Math.round(purchasesData.avgOrderValue))}     subtext="Per purchase order"        icon={ShoppingCart} iconBg="bg-blue-100" />
            <StatCard title="Pending Payments"  value={formatCurrency(purchasesData.pendingPayments)}               subtext="Balance due to suppliers"  icon={TrendingDown} iconBg="bg-blue-100" />
          </div>

          <SectionCard title="Monthly Purchase Spend">
            <div className="p-3">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={purchasesData.monthlyChartData} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v/1000).toFixed(0)}K`} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="Spend" stroke="#ef4444" fill="url(#spendGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <SectionCard title="Supplier-wise Breakdown" className="xl:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="bg-slate-50 border-b border-slate-100">
                    <TH>Supplier</TH><TH right>Orders</TH><TH right>Total Spent</TH><TH right>% of Total</TH>
                  </tr></thead>
                  <tbody>
                    {purchasesData.supplierRows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <TD className="font-medium text-slate-800">{row.name}</TD>
                        <TD right className="text-slate-600">{row.orders}</TD>
                        <TD right className="font-semibold text-red-600">{formatCurrency(row.spent)}</TD>
                        <TD right>
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-14 bg-slate-100 rounded-full h-1"><div className="bg-red-400 h-1 rounded-full" style={{ width: `${row.pct}%` }} /></div>
                            <span className="text-[10px] font-medium text-slate-600">{row.pct}%</span>
                          </div>
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
            <SectionCard title="Category Breakdown">
              <div className="p-3">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={purchasesData.categoryBarData} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v/1000).toFixed(0)}K`} width={40} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Spend" radius={[4,4,0,0]}>
                      {purchasesData.categoryBarData.map((_, i) => <Cell key={i} fill={i===0?"#2563EB":"#60a5fa"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        {/* ══ PROFIT & LOSS ═════════════════════════════════════════════════════ */}
        <TabsContent value="pl" className="space-y-3 mt-0">
          <div className="grid grid-cols-4 gap-2.5">
            <StatCard title="Gross Revenue"  value={formatCurrency(plData.grossRevenue)}                     subtext="Last 6 months"      icon={DollarSign}  iconBg="bg-blue-100" />
            <StatCard title="Total Cost"     value={formatCurrency(plData.totalCost)}                        subtext="COGS – last 6 months" icon={TrendingDown} iconBg="bg-red-100" />
            <StatCard title="Gross Profit"   value={formatCurrency(plData.grossProfit)}                      subtext="Revenue minus cost"  icon={TrendingUp}  iconBg="bg-blue-100" trend={parseFloat(plData.profitMargin.toFixed(1))} />
            <StatCard title="Profit Margin"  value={`${plData.profitMargin.toFixed(1)}%`}                   subtext="Gross margin"        icon={BarChart2}   iconBg="bg-blue-100" />
          </div>

          <SectionCard title="Monthly Revenue vs Cost — Last 6 Months">
            <div className="p-3">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={plData.monthlyRows} margin={{ top: 4, right: 16, left: 4, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v/1000).toFixed(0)}K`} width={44} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Revenue" fill="#2563EB" radius={[4,4,0,0]} />
                  <Bar dataKey="Cost"    fill="#94a3b8" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="Month-over-Month Analysis">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-slate-50 border-b border-slate-100">
                  <TH>Month</TH><TH right>Revenue</TH><TH right>Cost</TH><TH right>Profit</TH><TH right>Margin</TH><TH right>MoM Change</TH>
                </tr></thead>
                <tbody>
                  {plData.tableRows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <TD className="font-semibold text-slate-700">{row.month}</TD>
                      <TD right className="text-blue-600 font-medium">{formatCurrency(row.Revenue)}</TD>
                      <TD right className="text-red-500 font-medium">{formatCurrency(row.Cost)}</TD>
                      <TD right className="font-bold text-emerald-600">{formatCurrency(row.Profit)}</TD>
                      <TD right>
                        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border text-blue-600 border-blue-200 bg-blue-50">{row.margin.toFixed(1)}%</span>
                      </TD>
                      <TD right>
                        {row.momChange === null ? <span className="text-slate-400">—</span> : (
                          <span className={`flex items-center justify-end gap-0.5 text-[10px] font-semibold ${row.momChange>=0?"text-emerald-600":"text-red-500"}`}>
                            {row.momChange>=0?<TrendingUp className="w-3 h-3"/>:<TrendingDown className="w-3 h-3"/>}
                            {Math.abs(row.momChange).toFixed(1)}%
                          </span>
                        )}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ══ INVENTORY REPORT ══════════════════════════════════════════════════ */}
        <TabsContent value="inventory" className="space-y-3 mt-0">
          <div className="grid grid-cols-3 gap-2.5">
            <StatCard title="Total Products"   value={inventoryData.totalProducts.toString()}             subtext={`${mobiles.length} mobiles, ${accessories.length} accessories`} icon={Package}  iconBg="bg-blue-100" />
            <StatCard title="Total Stock Value" value={formatCurrency(inventoryData.totalStockValue)}    subtext="At purchase cost"   icon={DollarSign} iconBg="bg-blue-100" />
            <StatCard title="Avg Product Value" value={formatCurrency(Math.round(inventoryData.avgProductValue))} subtext="Per unit in stock" icon={BarChart2}  iconBg="bg-blue-100" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <SectionCard title="Stock Value by Category">
              <div className="p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={inventoryData.categoryDonutData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value"
                      label={(p: any) => `${p.name} ${((p.percent??0)*100).toFixed(0)}%`} labelLine={false}>
                      {inventoryData.categoryDonutData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Top 10 Products by Units in Stock">
              <div className="p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={inventoryData.topByUnits} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 8 }} width={100} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="stock" name="Units" fill="#2563EB" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Low Stock / Reorder Alert"
            badge={<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{inventoryData.lowStockItems.length} items</span>}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-slate-50 border-b border-slate-100">
                  <TH>Product Name</TH><TH right>Current Stock</TH><TH right>Suggested Reorder</TH>
                </tr></thead>
                <tbody>
                  {inventoryData.lowStockItems.length === 0
                    ? <tr><td colSpan={3} className="text-center py-8 text-xs text-slate-400">No low stock items</td></tr>
                    : inventoryData.lowStockItems.map((item, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <TD className="font-medium text-slate-800">{item.name}</TD>
                        <TD right className={`font-bold ${item.stock===0?"text-red-600":"text-amber-600"}`}>{item.stock===0?"Out of Stock":item.stock}</TD>
                        <TD right className="font-semibold text-emerald-600">{item.suggested} units</TD>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ══ SUPPLIER PERFORMANCE ═══════════════════════════════════════════════ */}
        <TabsContent value="suppliers" className="space-y-3 mt-0">
          <SectionCard title="Supplier Rankings">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-slate-50 border-b border-slate-100">
                  <TH>Rank</TH><TH>Supplier</TH><TH right>Orders</TH><TH right>Total Value</TH><TH right>Outstanding</TH><TH>Rating</TH><TH>Status</TH>
                </tr></thead>
                <tbody>
                  {supplierPerf.supplierRows.map((s) => {
                    const orders = purchases.filter((p) => p.supplierId === s.id).length
                    return (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <TD>
                          {s.rank<=3
                            ? <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold ${s.rank===1?"bg-blue-600 text-white":s.rank===2?"bg-blue-400 text-white":"bg-blue-100 text-blue-700"}`}>{s.rank}</span>
                            : <span className="text-slate-400 text-[10px] font-medium pl-0.5">{s.rank}</span>}
                        </TD>
                        <TD><p className="font-semibold text-slate-800">{s.companyName}</p><p className="text-[10px] text-slate-400">{s.city}</p></TD>
                        <TD right className="font-medium text-slate-700">{orders}</TD>
                        <TD right className="font-semibold text-blue-600">{formatCurrency(s.totalPurchases)}</TD>
                        <TD right className="font-semibold text-red-500">{formatCurrency(s.outstandingBalance)}</TD>
                        <TD><Stars rating={s.rating} /></TD>
                        <TD><StatusBadge status={s.status} /></TD>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            <SectionCard title="Top 5 Suppliers by Purchase Volume">
              <div className="p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={supplierPerf.top5} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `₨${(v/1_000_000).toFixed(1)}M`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Volume" name="Volume (₨)" fill="#2563EB" radius={[0,4,4,0]}>
                      {supplierPerf.top5.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Payment Status Overview">
              <div className="p-3">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={supplierPerf.paymentPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value"
                      label={(p: any) => `${p.name} ${((p.percent??0)*100).toFixed(0)}%`}>
                      {supplierPerf.paymentPie.map((entry, i) => (
                        <Cell key={i} fill={entry.name==="Paid"?"#10b981":entry.name==="Partial"?"#f59e0b":"#ef4444"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

"use client"

import { useState, useMemo, useEffect } from "react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { toast } from "sonner"
import { getSales } from "@/lib/api/sales"
import { getPurchases } from "@/lib/api/purchases"
import { getMobiles, getAccessories } from "@/lib/api/products"
import { getSuppliers } from "@/lib/api/suppliers"
import type { Sale, Purchase, Mobile, Accessory, Supplier } from "@/data/types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/shared/status-badge"
import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Package,
  DollarSign,
  ShoppingCart,
} from "lucide-react"
import { format, parseISO, startOfMonth, subMonths } from "date-fns"

// ─── Colour palette for charts ────────────────────────────────────────────────
const COLORS = ["#2563EB", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#1e40af", "#1d4ed8", "#dbeafe"]
const PIE_COLORS = ["#2563EB", "#3b82f6", "#60a5fa", "#1e40af", "#93c5fd"]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function compactCurrency(n: number): string {
  if (n >= 1_000_000) return `₨ ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `₨ ${(n / 1_000).toFixed(1)}K`
  return `₨ ${n.toLocaleString("en-PK")}`
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {"★".repeat(Math.floor(rating))}
      {"☆".repeat(5 - Math.floor(rating))}
      <span className="text-slate-500 text-xs ml-1">({rating})</span>
    </span>
  )
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === "number" && p.value > 1000 ? compactCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<Sale[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [mobiles, setMobiles] = useState<Mobile[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [s, p, m, a, sup] = await Promise.all([
          getSales(),
          getPurchases(),
          getMobiles(),
          getAccessories(),
          getSuppliers(),
        ])
        setSales(s)
        setPurchases(p)
        setMobiles(m)
        setAccessories(a)
        setSuppliers(sup)
      } catch (err) {
        toast.error("Failed to load reports data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Date range state ──────────────────────────────────────────────────────
  const [salesFrom, setSalesFrom] = useState(new Date(new Date().getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
  const [salesTo, setSalesTo] = useState(new Date().toISOString().split("T")[0])
  const [purchasesFrom, setPurchasesFrom] = useState(new Date(new Date().getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
  const [purchasesTo, setPurchasesTo] = useState(new Date().toISOString().split("T")[0])

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 1 — Sales Report calculations
  // ═══════════════════════════════════════════════════════════════════════════
  const salesData = useMemo(() => {
    const filtered = sales.filter((s) => {
      const d = s.date
      return d >= salesFrom && d <= salesTo && s.status !== "Refunded"
    })

    const totalSales = filtered.reduce((a, s) => a + s.total, 0)
    const numTx = filtered.length

    // Daily totals
    const dailyMap: Record<string, number> = {}
    filtered.forEach((s) => {
      dailyMap[s.date] = (dailyMap[s.date] || 0) + s.total
    })
    const dailyEntries = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))
    const dailyChartData = dailyEntries.map(([date, amount]) => ({
      date: format(parseISO(date), "dd MMM"),
      Sales: amount,
    }))

    const days = dailyEntries.length || 1
    const avgDaily = totalSales / days
    const highestDay = dailyEntries.reduce((max, [, v]) => Math.max(max, v), 0)

    // Top products
    const productMap: Record<string, { name: string; type: string; units: number; revenue: number }> = {}
    filtered.forEach((s) => {
      s.items.forEach((item) => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = { name: item.productName, type: item.productType, units: 0, revenue: 0 }
        }
        productMap[item.productId].units += item.quantity
        productMap[item.productId].revenue += item.lineTotal
      })
    })
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Payment method breakdown
    const pmMap: Record<string, number> = {}
    filtered.forEach((s) => {
      pmMap[s.paymentMethod] = (pmMap[s.paymentMethod] || 0) + s.total
    })
    const paymentPieData = Object.entries(pmMap).map(([name, value]) => ({ name, value }))

    return { totalSales, numTx, avgDaily, highestDay, dailyChartData, topProducts, paymentPieData }
  }, [salesFrom, salesTo, sales])

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 2 — Purchase Report calculations
  // ═══════════════════════════════════════════════════════════════════════════
  const purchasesData = useMemo(() => {
    const filtered = purchases.filter((p) => p.date >= purchasesFrom && p.date <= purchasesTo)

    const totalSpend = filtered.reduce((a, p) => a + p.total, 0)
    const uniqueSuppliers = new Set(filtered.map((p) => p.supplierId)).size
    const avgOrderValue = filtered.length ? totalSpend / filtered.length : 0
    const pendingPayments = filtered.filter((p) => p.paymentStatus !== "Paid").reduce((a, p) => a + p.balanceDue, 0)

    // Monthly spend
    const monthlyMap: Record<string, number> = {}
    filtered.forEach((p) => {
      const key = format(parseISO(p.date), "MMM yyyy")
      monthlyMap[key] = (monthlyMap[key] || 0) + p.total
    })
    const monthlyChartData = Object.entries(monthlyMap)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([month, Spend]) => ({ month, Spend }))

    // Supplier breakdown
    const supplierMap: Record<string, { name: string; orders: number; spent: number }> = {}
    filtered.forEach((p) => {
      if (!supplierMap[p.supplierId]) {
        supplierMap[p.supplierId] = { name: p.supplierName, orders: 0, spent: 0 }
      }
      supplierMap[p.supplierId].orders++
      supplierMap[p.supplierId].spent += p.total
    })
    const supplierRows = Object.values(supplierMap)
      .sort((a, b) => b.spent - a.spent)
      .map((s) => ({ ...s, pct: totalSpend ? ((s.spent / totalSpend) * 100).toFixed(1) : "0.0" }))

    // Category breakdown (Mobiles vs Accessories)
    const catMap: Record<string, number> = { Mobiles: 0, Accessories: 0 }
    filtered.forEach((p) => {
      p.items.forEach((item) => {
        if (item.productType === "Mobile") catMap.Mobiles += item.total
        else catMap.Accessories += item.total
      })
    })
    const categoryBarData = [
      { category: "Mobiles", Spend: catMap.Mobiles },
      { category: "Accessories", Spend: catMap.Accessories },
    ]

    return { totalSpend, uniqueSuppliers, avgOrderValue, pendingPayments, monthlyChartData, supplierRows, categoryBarData }
  }, [purchasesFrom, purchasesTo, purchases])

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 3 — Profit & Loss calculations (last 6 months)
  // ═══════════════════════════════════════════════════════════════════════════
  const plData = useMemo(() => {
    const now = new Date()

    // Build cost lookup: productId -> purchasePrice
    const costMap: Record<string, number> = {}
    mobiles.forEach((m) => { costMap[m.id] = m.purchasePrice })
    accessories.forEach((a) => { costMap[a.id] = a.purchasePrice })

    // Last 6 months
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(startOfMonth(now), 5 - i)
      return { key: format(d, "yyyy-MM"), label: format(d, "MMM yy") }
    })

    const monthlyRows = months.map(({ key, label }) => {
      const monthSales = sales.filter((s) => s.date.startsWith(key) && s.status !== "Refunded")
      const revenue = monthSales.reduce((a, s) => a + s.total, 0)
      const cost = monthSales.reduce((a, s) => {
        return a + s.items.reduce((b, item) => {
          const unitCost = costMap[item.productId] || item.unitPrice * 0.82
          return b + unitCost * item.quantity
        }, 0)
      }, 0)
      const profit = revenue - cost
      const margin = revenue ? (profit / revenue) * 100 : 0
      return { month: label, Revenue: revenue, Cost: cost, Profit: profit, margin }
    })

    const grossRevenue = monthlyRows.reduce((a, r) => a + r.Revenue, 0)
    const totalCost = monthlyRows.reduce((a, r) => a + r.Cost, 0)
    const grossProfit = grossRevenue - totalCost
    const profitMargin = grossRevenue ? (grossProfit / grossRevenue) * 100 : 0

    // MoM change
    const tableRows = monthlyRows.map((r, i) => {
      const prev = i > 0 ? monthlyRows[i - 1].Profit : null
      const momChange = prev !== null && prev !== 0 ? ((r.Profit - prev) / Math.abs(prev)) * 100 : null
      return { ...r, momChange }
    })

    return { grossRevenue, totalCost, grossProfit, profitMargin, monthlyRows, tableRows }
  }, [sales, mobiles, accessories])

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 4 — Inventory Report
  // ═══════════════════════════════════════════════════════════════════════════
  const inventoryData = useMemo(() => {
    const totalProducts = mobiles.length + accessories.length
    const mobileStockValue = mobiles.reduce((a, m) => a + m.purchasePrice * m.stock, 0)
    const accessoryStockValue = accessories.reduce((a, acc) => a + acc.purchasePrice * acc.stock, 0)
    const totalStockValue = mobileStockValue + accessoryStockValue
    const totalUnits = mobiles.reduce((a, m) => a + m.stock, 0) + accessories.reduce((a, acc) => a + acc.stock, 0)
    const avgProductValue = totalUnits > 0 ? totalStockValue / totalUnits : 0

    // Category donut (mobiles by category + accessories grouped)
    const catValueMap: Record<string, number> = {}
    mobiles.forEach((m) => {
      catValueMap[m.category] = (catValueMap[m.category] || 0) + m.purchasePrice * m.stock
    })
    // Group accessories by category
    const accCatMap: Record<string, number> = {}
    accessories.forEach((a) => {
      const cat = a.category.split("/")[0].trim()
      accCatMap[cat] = (accCatMap[cat] || 0) + a.purchasePrice * a.stock
    })
    Object.entries(accCatMap).forEach(([k, v]) => {
      catValueMap[k] = (catValueMap[k] || 0) + v
    })
    const categoryDonutData = Object.entries(catValueMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))

    // Top 10 products by units
    const allProducts = [
      ...mobiles.map((m) => ({ name: `${m.brand} ${m.model}`, stock: m.stock })),
      ...accessories.map((a) => ({ name: a.name, stock: a.stock })),
    ]
    const topByUnits = allProducts.sort((a, b) => b.stock - a.stock).slice(0, 10)

    // Low stock / reorder
    const lowStockMobiles = mobiles
      .filter((m) => m.stock < 5)
      .map((m) => ({ name: `${m.brand} ${m.model}`, stock: m.stock, suggested: Math.max(10, 10 - m.stock) }))
    const lowStockAcc = accessories
      .filter((a) => a.stock < 5)
      .map((a) => ({ name: a.name, stock: a.stock, suggested: Math.max(20, 20 - a.stock) }))
    const lowStockItems = [...lowStockMobiles, ...lowStockAcc].sort((a, b) => a.stock - b.stock)

    return { totalProducts, totalStockValue, avgProductValue, categoryDonutData, topByUnits, lowStockItems }
  }, [mobiles, accessories])

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 5 — Supplier Performance
  // ═══════════════════════════════════════════════════════════════════════════
  const supplierPerf = useMemo(() => {
    const supplierRows = suppliers
      .filter((s) => s.status === "Active")
      .sort((a, b) => b.totalPurchases - a.totalPurchases)
      .map((s, i) => ({ rank: i + 1, ...s }))

    // Top 5 for horizontal bar
    const top5 = supplierRows.slice(0, 5).map((s) => ({
      name: s.companyName.split(" ").slice(0, 2).join(" "),
      Volume: s.totalPurchases,
    }))

    // Payment pie from purchases
    const pmCount: Record<string, number> = { Paid: 0, Partial: 0, Unpaid: 0 }
    purchases.forEach((p) => { pmCount[p.paymentStatus] = (pmCount[p.paymentStatus] || 0) + p.total })
    const paymentPie = Object.entries(pmCount).map(([name, value]) => ({ name, value }))

    return { supplierRows, top5, paymentPie }
  }, [suppliers, purchases])

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading reports...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive business intelligence across sales, purchases, profit and inventory"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="w-4 h-4" /> Generate PDF
            </Button>
            <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4" /> Export All
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="bg-white border border-slate-200 p-1 rounded-xl shadow-sm flex-wrap h-auto gap-1 overflow-x-auto">
          <TabsTrigger value="sales" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Sales Report
          </TabsTrigger>
          <TabsTrigger value="purchases" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Purchase Report
          </TabsTrigger>
          <TabsTrigger value="pl" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Profit & Loss
          </TabsTrigger>
          <TabsTrigger value="inventory" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Inventory Report
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Supplier Performance
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 1 — SALES REPORT
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="sales" className="space-y-6">
          {/* Date range */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">From</label>
                  <Input type="date" value={salesFrom} onChange={(e) => setSalesFrom(e.target.value)} className="w-full sm:w-40" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">To</label>
                  <Input type="date" value={salesTo} onChange={(e) => setSalesTo(e.target.value)} className="w-full sm:w-40" />
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" /> Export CSV
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="w-4 h-4" /> Export PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Total Sales"
              value={formatCurrency(salesData.totalSales)}
              subtext="Excluding refunded orders"
              icon={DollarSign}
              iconBg="bg-blue-100"
              gradient="from-blue-50 to-blue-100"
              trend={12}
            />
            <StatCard
              title="Avg Daily Sale"
              value={formatCurrency(Math.round(salesData.avgDaily))}
              subtext="Over selected period"
              icon={TrendingUp}
              iconBg="bg-blue-100"
              gradient="from-emerald-50 to-emerald-100"
            />
            <StatCard
              title="Highest Single Day"
              value={formatCurrency(salesData.highestDay)}
              subtext="Peak revenue day"
              icon={BarChart2}
              iconBg="bg-blue-100"
              gradient="from-amber-50 to-amber-100"
            />
            <StatCard
              title="Transactions"
              value={salesData.numTx.toString()}
              subtext="Completed + Pending"
              icon={ShoppingCart}
              iconBg="bg-blue-100"
              gradient="from-purple-50 to-purple-100"
            />
          </div>

          {/* Line chart — daily sales */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">Daily Sales Over Period</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={salesData.dailyChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Top 10 products table */}
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Top 10 Selling Products</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {salesData.topProducts.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      {i < 3 ? (
                        <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? "bg-blue-600 text-white" : i === 1 ? "bg-blue-400 text-white" : "bg-blue-100 text-blue-700"}`}>{i + 1}</span>
                      ) : (
                        <span className="w-7 h-7 flex items-center justify-center text-slate-400 text-xs font-medium shrink-0">{i + 1}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className={`text-xs ${p.type === "Mobile" ? "text-blue-600 border-blue-200 bg-blue-50" : "text-slate-600 border-slate-200 bg-slate-50"}`}>{p.type}</Badge>
                          <span className="text-xs text-slate-500">{p.units} units</span>
                        </div>
                      </div>
                      <span className="font-semibold text-blue-600 text-sm shrink-0">{formatCurrency(p.revenue)}</span>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Product</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Units</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.topProducts.map((p, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-400">
                            {i < 3 ? (
                              <span className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold ${i === 0 ? "bg-blue-600 text-white" : i === 1 ? "bg-blue-400 text-white" : "bg-blue-100 text-blue-700"}`}>
                                {i + 1}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs pl-1">{i + 1}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={p.type === "Mobile" ? "text-blue-600 border-blue-200 bg-blue-50" : "text-slate-600 border-slate-200 bg-slate-50"}>
                              {p.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">{p.units}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-600">{formatCurrency(p.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Payment method donut */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={salesData.paymentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {salesData.paymentPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 2 — PURCHASE REPORT
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="purchases" className="space-y-6">
          {/* Date range */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">From</label>
                  <Input type="date" value={purchasesFrom} onChange={(e) => setPurchasesFrom(e.target.value)} className="w-full sm:w-40" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500">To</label>
                  <Input type="date" value={purchasesTo} onChange={(e) => setPurchasesTo(e.target.value)} className="w-full sm:w-40" />
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" /> Export CSV
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="w-4 h-4" /> Export PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Total Spend"
              value={formatCurrency(purchasesData.totalSpend)}
              subtext="All purchase orders"
              icon={DollarSign}
              iconBg="bg-red-100"
              gradient="from-red-50 to-red-100"
            />
            <StatCard
              title="Unique Suppliers"
              value={purchasesData.uniqueSuppliers.toString()}
              subtext="Active in period"
              icon={Package}
              iconBg="bg-blue-100"
              gradient="from-blue-50 to-blue-100"
            />
            <StatCard
              title="Avg Order Value"
              value={formatCurrency(Math.round(purchasesData.avgOrderValue))}
              subtext="Per purchase order"
              icon={ShoppingCart}
              iconBg="bg-blue-100"
              gradient="from-amber-50 to-amber-100"
            />
            <StatCard
              title="Pending Payments"
              value={formatCurrency(purchasesData.pendingPayments)}
              subtext="Balance due to suppliers"
              icon={TrendingDown}
              iconBg="bg-blue-100"
              gradient="from-orange-50 to-orange-100"
            />
          </div>

          {/* Monthly spend line chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">Monthly Purchase Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={purchasesData.monthlyChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="Spend" stroke="#ef4444" fill="url(#spendGrad)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Supplier breakdown table */}
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Supplier-wise Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {purchasesData.supplierRows.map((row, i) => (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-slate-800 text-sm">{row.name}</span>
                        <span className="font-semibold text-red-600 text-sm">{formatCurrency(row.spent)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{row.orders} orders</span>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                            <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${row.pct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-600 shrink-0">{row.pct}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Supplier</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Orders</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total Spent</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchasesData.supplierRows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{row.orders}</td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">{formatCurrency(row.spent)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                <div
                                  className="bg-red-400 h-1.5 rounded-full"
                                  style={{ width: `${row.pct}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-slate-600">{row.pct}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Category bar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={purchasesData.categoryBarData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Spend" radius={[4, 4, 0, 0]}>
                      {purchasesData.categoryBarData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "#2563EB" : "#60a5fa"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 3 — PROFIT & LOSS
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="pl" className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Gross Revenue"
              value={formatCurrency(plData.grossRevenue)}
              subtext="Last 6 months"
              icon={DollarSign}
              iconBg="bg-blue-100"
              gradient="from-blue-50 to-blue-100"
            />
            <StatCard
              title="Total Cost"
              value={formatCurrency(plData.totalCost)}
              subtext="COGS — last 6 months"
              icon={TrendingDown}
              iconBg="bg-red-100"
              gradient="from-red-50 to-red-100"
            />
            <StatCard
              title="Gross Profit"
              value={formatCurrency(plData.grossProfit)}
              subtext="Revenue minus cost"
              icon={TrendingUp}
              iconBg="bg-blue-100"
              gradient="from-emerald-50 to-emerald-100"
              trend={parseFloat(plData.profitMargin.toFixed(1))}
            />
            <StatCard
              title="Profit Margin"
              value={`${plData.profitMargin.toFixed(1)}%`}
              subtext="Gross margin"
              icon={BarChart2}
              iconBg="bg-blue-100"
              gradient="from-purple-50 to-purple-100"
            />
          </div>

          {/* Revenue vs Cost bar chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">Monthly Revenue vs Cost — Last 6 Months</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={plData.monthlyRows} margin={{ top: 5, right: 20, left: 10, bottom: 5 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Month-over-month table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">Month-over-Month Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {plData.tableRows.map((row, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-slate-700 text-sm">{row.month}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-xs">{row.margin.toFixed(1)}%</Badge>
                        {row.momChange !== null && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold ${row.momChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {row.momChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {Math.abs(row.momChange).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-400 mb-0.5">Revenue</p>
                        <p className="font-semibold text-blue-600">{formatCurrency(row.Revenue)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">Cost</p>
                        <p className="font-semibold text-red-500">{formatCurrency(row.Cost)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-0.5">Profit</p>
                        <p className="font-bold text-emerald-600">{formatCurrency(row.Profit)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Month</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Revenue</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Cost</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Profit</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Margin %</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">MoM Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plData.tableRows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.month}</td>
                        <td className="px-4 py-3 text-right text-blue-600 font-medium">{formatCurrency(row.Revenue)}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">{formatCurrency(row.Cost)}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(row.Profit)}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                            {row.margin.toFixed(1)}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.momChange === null ? (
                            <span className="text-slate-400 text-xs">—</span>
                          ) : (
                            <span className={`flex items-center justify-end gap-1 text-xs font-semibold ${row.momChange >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {row.momChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(row.momChange).toFixed(1)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 4 — INVENTORY REPORT
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="inventory" className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Products"
              value={inventoryData.totalProducts.toString()}
              subtext={`${mobiles.length} mobiles, ${accessories.length} accessories`}
              icon={Package}
              iconBg="bg-blue-100"
              gradient="from-blue-50 to-blue-100"
            />
            <StatCard
              title="Total Stock Value"
              value={formatCurrency(inventoryData.totalStockValue)}
              subtext="At purchase cost"
              icon={DollarSign}
              iconBg="bg-blue-100"
              gradient="from-emerald-50 to-emerald-100"
            />
            <StatCard
              title="Avg Product Value"
              value={formatCurrency(Math.round(inventoryData.avgProductValue))}
              subtext="Per unit in stock"
              icon={BarChart2}
              iconBg="bg-blue-100"
              gradient="from-amber-50 to-amber-100"
            />
          </div>

          {/* Two charts side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Category donut */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Stock Value by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={inventoryData.categoryDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={(props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {inventoryData.categoryDonutData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top 10 by units bar chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Top 10 Products by Units in Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={inventoryData.topByUnits}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={110} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="stock" name="Units" fill="#2563EB" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Low stock table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-800">Low Stock / Reorder Alert</CardTitle>
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  {inventoryData.lowStockItems.length} items
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {inventoryData.lowStockItems.length === 0 ? (
                  <p className="px-4 py-8 text-center text-slate-400 text-sm">No low stock items</p>
                ) : (
                  inventoryData.lowStockItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 gap-3">
                      <span className="font-medium text-slate-800 text-sm flex-1 min-w-0 truncate">{item.name}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${item.stock === 0 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                        {item.stock === 0 ? "Out of Stock" : `Stock: ${item.stock}`}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600 shrink-0">Reorder: {item.suggested}</span>
                    </div>
                  ))
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Product Name</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Current Stock</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Suggested Reorder Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryData.lowStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-sm">No low stock items</td>
                      </tr>
                    ) : (
                      inventoryData.lowStockItems.map((item, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold ${item.stock === 0 ? "text-red-600" : "text-amber-600"}`}>
                              {item.stock === 0 ? "Out of Stock" : item.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">{item.suggested} units</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB 5 — SUPPLIER PERFORMANCE
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="suppliers" className="space-y-6">
          {/* Supplier ranking table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">Supplier Rankings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-slate-100">
                {supplierPerf.supplierRows.map((s) => {
                  const orderCount = purchases.filter((p) => p.supplierId === s.id).length
                  return (
                    <div key={s.id} className="flex gap-3 px-4 py-3">
                      {/* Rank */}
                      {s.rank <= 3 ? (
                        <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${s.rank === 1 ? "bg-blue-600 text-white" : s.rank === 2 ? "bg-blue-400 text-white" : "bg-blue-100 text-blue-700"}`}>{s.rank}</span>
                      ) : (
                        <span className="w-7 h-7 flex items-center justify-center text-slate-400 text-xs font-medium shrink-0 mt-0.5">{s.rank}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate">{s.companyName}</p>
                            <p className="text-xs text-slate-400">{s.city}</p>
                          </div>
                          <StatusBadge status={s.status} />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1.5">
                          <span className="text-xs text-slate-500">{orderCount} orders</span>
                          <span className="text-xs font-semibold text-blue-600">{formatCurrency(s.totalPurchases)}</span>
                          {s.outstandingBalance > 0 && (
                            <span className="text-xs font-semibold text-red-500">Due: {formatCurrency(s.outstandingBalance)}</span>
                          )}
                        </div>
                        <Stars rating={s.rating} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Rank</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Supplier</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total Orders</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total Value</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Outstanding</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Rating</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierPerf.supplierRows.map((s) => {
                      const orderCount = purchases.filter((p) => p.supplierId === s.id).length
                      return (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            {s.rank <= 3 ? (
                              <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-xs font-bold ${s.rank === 1 ? "bg-blue-600 text-white" : s.rank === 2 ? "bg-blue-400 text-white" : "bg-blue-100 text-blue-700"}`}>
                                {s.rank}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs font-medium pl-1">{s.rank}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{s.companyName}</p>
                            <p className="text-xs text-slate-400">{s.city}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">{orderCount}</td>
                          <td className="px-4 py-3 text-right font-semibold text-blue-600">{formatCurrency(s.totalPurchases)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-red-500">{formatCurrency(s.outstandingBalance)}</td>
                          <td className="px-4 py-3"><Stars rating={s.rating} /></td>
                          <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Top 5 suppliers horizontal bar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Top 5 Suppliers by Purchase Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={supplierPerf.top5}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `₨${(v / 1_000_000).toFixed(1)}M`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Volume" name="Volume (₨)" fill="#2563EB" radius={[0, 4, 4, 0]}>
                      {supplierPerf.top5.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment overview pie */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">Payment Status Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={supplierPerf.paymentPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                      label={(props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {supplierPerf.paymentPie.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.name === "Paid" ? "#10b981" : entry.name === "Partial" ? "#f59e0b" : "#ef4444"}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

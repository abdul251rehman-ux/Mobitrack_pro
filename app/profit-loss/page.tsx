"use client"

import { useState, useMemo, useEffect } from "react"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { toast } from "sonner"
import { getSales } from "@/lib/api/sales"
import { getPurchases } from "@/lib/api/purchases"
import { getExpenses } from "@/lib/api/expenses"
import { getReturns } from "@/lib/api/returns"
import { Sale, Purchase, Expense, Return } from "@/data/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { exportToCSV } from "@/lib/csv-export"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  subMonths,
  isWithinInterval,
  parseISO,
} from "date-fns"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  CreditCard,
  Receipt,
  Download,
  FileText,
  BarChart2,
  Minus,
} from "lucide-react"

// ─── Colour palette ──────────────────────────────────────────────────────────
const PIE_COLORS = [
  "#2563EB",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#f97316",
  "#14b8a6",
  "#6366f1",
  "#84cc16",
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function compactCurrency(n: number): string {
  if (n >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `Rs ${(n / 1_000).toFixed(1)}K`
  return `Rs ${n.toLocaleString("en-PK")}`
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === "number" ? compactCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

type PeriodKey = "this-month" | "last-month" | "last-3" | "last-6" | "this-year" | "all"

function getPeriodRange(key: PeriodKey): { start: Date; end: Date } {
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)

  switch (key) {
    case "this-month":
      return { start: thisMonthStart, end: thisMonthEnd }
    case "last-month": {
      const lm = subMonths(now, 1)
      return { start: startOfMonth(lm), end: endOfMonth(lm) }
    }
    case "last-3":
      return { start: startOfMonth(subMonths(now, 2)), end: thisMonthEnd }
    case "last-6":
      return { start: startOfMonth(subMonths(now, 5)), end: thisMonthEnd }
    case "this-year":
      return { start: new Date(now.getFullYear(), 0, 1), end: thisMonthEnd }
    case "all":
      return { start: new Date(2000, 0, 1), end: new Date(2099, 11, 31) }
  }
}

// ─── Page Component ──────────────────────────────────────────────────────────
export default function ProfitLossPage() {
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<Sale[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [returns, setReturns] = useState<Return[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [s, p, e, r] = await Promise.all([
          getSales(),
          getPurchases(),
          getExpenses(),
          getReturns(),
        ])
        setSales(s)
        setPurchases(p)
        setExpenses(e)
        setReturns(r)
      } catch (err) {
        toast.error("Failed to load profit & loss data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const [period, setPeriod] = useState<PeriodKey>("all")

  const { start, end } = useMemo(() => getPeriodRange(period), [period])

  // Filter helpers
  const inPeriod = (dateStr: string) => {
    try {
      const d = parseISO(dateStr)
      return isWithinInterval(d, { start, end })
    } catch {
      return false
    }
  }

  // Filtered data
  const filteredSales = useMemo(() => sales.filter((s) => inPeriod(s.date)), [start, end, sales])
  const filteredPurchases = useMemo(() => purchases.filter((p) => inPeriod(p.date)), [start, end, purchases])
  const filteredExpenses = useMemo(() => expenses.filter((e) => inPeriod(e.date)), [start, end, expenses])
  const filteredReturns = useMemo(() => returns.filter((r) => inPeriod(r.date)), [start, end, returns])

  // Totals
  const totalRevenue = useMemo(
    () => filteredSales.reduce((sum, s) => sum + s.total, 0),
    [filteredSales]
  )
  const totalCOGS = useMemo(
    () => filteredPurchases.reduce((sum, p) => sum + p.total, 0),
    [filteredPurchases]
  )
  const totalRefunds = useMemo(
    () => filteredReturns.reduce((sum, r) => sum + r.refundAmount, 0),
    [filteredReturns]
  )
  const netRevenue = totalRevenue - totalRefunds
  const grossProfit = netRevenue - totalCOGS
  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  )
  const netProfit = grossProfit - totalExpenses
  const grossMargin = netRevenue > 0 ? ((grossProfit / netRevenue) * 100) : 0
  const netMargin = netRevenue > 0 ? ((netProfit / netRevenue) * 100) : 0

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + e.amount
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filteredExpenses])

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    if (filteredSales.length === 0 && filteredPurchases.length === 0 && filteredExpenses.length === 0) {
      return []
    }

    // Collect all dates to determine range
    const allDates = [
      ...filteredSales.map((s) => parseISO(s.date)),
      ...filteredPurchases.map((p) => parseISO(p.date)),
      ...filteredExpenses.map((e) => parseISO(e.date)),
      ...filteredReturns.map((r) => parseISO(r.date)),
    ]

    if (allDates.length === 0) return []

    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))

    const months = eachMonthOfInterval({ start: startOfMonth(minDate), end: startOfMonth(maxDate) })

    return months.map((monthStart) => {
      const monthEnd = endOfMonth(monthStart)
      const label = format(monthStart, "MMM yyyy")
      const monthInterval = { start: monthStart, end: monthEnd }

      const revenue = filteredSales
        .filter((s) => isWithinInterval(parseISO(s.date), monthInterval))
        .reduce((sum, s) => sum + s.total, 0)

      const refunds = filteredReturns
        .filter((r) => isWithinInterval(parseISO(r.date), monthInterval))
        .reduce((sum, r) => sum + r.refundAmount, 0)

      const cogs = filteredPurchases
        .filter((p) => isWithinInterval(parseISO(p.date), monthInterval))
        .reduce((sum, p) => sum + p.total, 0)

      const opex = filteredExpenses
        .filter((e) => isWithinInterval(parseISO(e.date), monthInterval))
        .reduce((sum, e) => sum + e.amount, 0)

      const totalExp = cogs + opex + refunds
      const profit = revenue - totalExp

      return { month: label, Revenue: revenue, Expenses: totalExp, Profit: profit }
    })
  }, [filteredSales, filteredPurchases, filteredExpenses, filteredReturns])

  // CSV export
  const handleExport = () => {
    const rows: Record<string, unknown>[] = [
      { "Line Item": "Sales Revenue", Amount: totalRevenue },
      { "Line Item": "Less: Returns/Refunds", Amount: -totalRefunds },
      { "Line Item": "Net Revenue", Amount: netRevenue },
      { "Line Item": "", Amount: "" },
      { "Line Item": "Cost of Goods Sold (Purchases)", Amount: totalCOGS },
      { "Line Item": "Gross Profit", Amount: grossProfit },
      { "Line Item": `Gross Margin`, Amount: `${grossMargin.toFixed(1)}%` },
      { "Line Item": "", Amount: "" },
      { "Line Item": "── Operating Expenses ──", Amount: "" },
      ...expenseByCategory.map((c) => ({ "Line Item": `  ${c.name}`, Amount: c.value })),
      { "Line Item": "Total Operating Expenses", Amount: totalExpenses },
      { "Line Item": "", Amount: "" },
      { "Line Item": "Net Profit / (Loss)", Amount: netProfit },
      { "Line Item": "Net Profit Margin", Amount: `${netMargin.toFixed(1)}%` },
    ]
    exportToCSV(rows, `Profit-Loss-Statement-${format(new Date(), "yyyy-MM-dd")}`, [
      { key: "Line Item", header: "Line Item" },
      { key: "Amount", header: "Amount (PKR)" },
    ])
  }

  const periodLabel: Record<PeriodKey, string> = {
    "this-month": "This Month",
    "last-month": "Last Month",
    "last-3": "Last 3 Months",
    "last-6": "Last 6 Months",
    "this-year": "This Year",
    all: "All Time",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading profit & loss data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Profit & Loss Statement"
        description="Financial overview of revenue, costs, and profitability"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3">Last 3 Months</SelectItem>
                <SelectItem value="last-6">Last 6 Months</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* ── Summary Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={DollarSign}
          iconBg="bg-emerald-100"
          subtext={`${filteredSales.length} sales`}
        />
        <StatCard
          title="Cost of Goods"
          value={formatCurrency(totalCOGS)}
          icon={ShoppingCart}
          iconBg="bg-red-100"
          subtext={`${filteredPurchases.length} purchases`}
        />
        <StatCard
          title="Gross Profit"
          value={formatCurrency(grossProfit)}
          icon={TrendingUp}
          iconBg="bg-blue-100"
          subtext={`${grossMargin.toFixed(1)}% margin`}
        />
        <StatCard
          title="Operating Expenses"
          value={formatCurrency(totalExpenses)}
          icon={Receipt}
          iconBg="bg-amber-100"
          subtext={`${expenseByCategory.length} categories`}
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(Math.abs(netProfit))}
          icon={netProfit >= 0 ? TrendingUp : TrendingDown}
          iconBg={netProfit >= 0 ? "bg-emerald-100" : "bg-red-100"}
          subtext={`${netMargin.toFixed(1)}% margin`}
          trend={netMargin > 0 ? Number(netMargin.toFixed(1)) : undefined}
        />
      </div>

      {/* ── P&L Formal Statement ────────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Profit &amp; Loss Statement
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {periodLabel[period]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-100">
            {/* Revenue Section */}
            <div className="py-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">
                Revenue
              </h3>
              <div className="space-y-2 pl-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Sales Revenue</span>
                  <span className="font-medium text-slate-800">{formatCurrency(totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Less: Returns / Refunds</span>
                  <span className="font-medium text-red-600">
                    ({formatCurrency(totalRefunds)})
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-2">
                  <span className="text-slate-700">Net Revenue</span>
                  <span className="text-slate-900">{formatCurrency(netRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Cost of Goods Sold */}
            <div className="py-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">
                Cost of Goods Sold
              </h3>
              <div className="space-y-2 pl-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Purchases</span>
                  <span className="font-medium text-slate-800">{formatCurrency(totalCOGS)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-2">
                  <span className="text-slate-900">
                    Gross Profit
                    <span className="text-xs font-normal text-slate-500 ml-2">
                      ({grossMargin.toFixed(1)}% margin)
                    </span>
                  </span>
                  <span className={grossProfit >= 0 ? "text-emerald-700" : "text-red-600"}>
                    {formatCurrency(grossProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="py-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">
                Operating Expenses
              </h3>
              <div className="space-y-2 pl-4">
                {expenseByCategory.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No expenses in this period</p>
                ) : (
                  expenseByCategory.map((cat) => (
                    <div key={cat.name} className="flex justify-between text-sm">
                      <span className="text-slate-600">{cat.name}</span>
                      <span className="font-medium text-slate-800">
                        {formatCurrency(cat.value)}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-2">
                  <span className="text-slate-700">Total Operating Expenses</span>
                  <span className="text-slate-900">{formatCurrency(totalExpenses)}</span>
                </div>
              </div>
            </div>

            {/* Net Profit */}
            <div className="py-5">
              <div className="flex justify-between items-center px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-base font-bold text-slate-900">Net Profit / (Loss)</span>
                <span
                  className={`text-xl font-bold ${
                    netProfit >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit))})` : formatCurrency(netProfit)}
                </span>
              </div>
              <div className="flex justify-between items-center px-4 mt-2">
                <span className="text-sm font-semibold text-slate-600">Profit Margin</span>
                <span
                  className={`text-sm font-bold ${
                    netMargin >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {netMargin.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Monthly Revenue vs Expenses Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              Monthly Revenue vs Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-sm text-slate-400">
                No data for the selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                  />
                  <YAxis
                    tickFormatter={(v: number) => compactCurrency(v)}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#cbd5e1" }}
                    width={80}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#gradRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Expenses"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#gradExpenses)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Profit"
                    stroke="#2563EB"
                    strokeWidth={2}
                    fill="url(#gradProfit)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-600" />
              Expense Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-sm text-slate-400">
                No expenses for the selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: any) =>
                      `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value))}
                    contentStyle={{
                      fontSize: "12px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

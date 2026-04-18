"use client"

import { useState, useMemo, useEffect } from "react"
import {
  AreaChart,
  Area,
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
import { formatCurrency } from "@/lib/utils"
import { exportToCSV } from "@/lib/csv-export"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Receipt,
  Download,
  FileText,
  BarChart2,
  DollarSign,
} from "lucide-react"

const PIE_COLORS = [
  "#2563EB", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#f97316", "#14b8a6", "#6366f1", "#84cc16",
]

function compactCurrency(n: number): string {
  if (n >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `Rs ${(n / 1_000).toFixed(1)}K`
  return `Rs ${n.toLocaleString("en-PK")}`
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: {typeof p.value === "number" ? compactCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

function SectionCard({
  title,
  badge,
  children,
  className,
}: {
  title: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
  className?: string
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

type PeriodKey = "this-month" | "last-month" | "last-3" | "last-6" | "this-year" | "all"

function getPeriodRange(key: PeriodKey): { start: Date; end: Date } {
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  switch (key) {
    case "this-month": return { start: thisMonthStart, end: thisMonthEnd }
    case "last-month": {
      const lm = subMonths(now, 1)
      return { start: startOfMonth(lm), end: endOfMonth(lm) }
    }
    case "last-3": return { start: startOfMonth(subMonths(now, 2)), end: thisMonthEnd }
    case "last-6": return { start: startOfMonth(subMonths(now, 5)), end: thisMonthEnd }
    case "this-year": return { start: new Date(now.getFullYear(), 0, 1), end: thisMonthEnd }
    case "all": return { start: new Date(2000, 0, 1), end: new Date(2099, 11, 31) }
  }
}

export default function ProfitLossPage() {
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<Sale[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [returns, setReturns] = useState<Return[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [s, p, e, r] = await Promise.all([getSales(), getPurchases(), getExpenses(), getReturns()])
        setSales(s); setPurchases(p); setExpenses(e); setReturns(r)
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

  const inPeriod = (dateStr: string) => {
    try { return isWithinInterval(parseISO(dateStr), { start, end }) } catch { return false }
  }

  const filteredSales     = useMemo(() => sales.filter((s) => inPeriod(s.date)),     [start, end, sales])
  const filteredPurchases = useMemo(() => purchases.filter((p) => inPeriod(p.date)), [start, end, purchases])
  const filteredExpenses  = useMemo(() => expenses.filter((e) => inPeriod(e.date)),  [start, end, expenses])
  const filteredReturns   = useMemo(() => returns.filter((r) => inPeriod(r.date)),   [start, end, returns])

  const totalRevenue  = useMemo(() => filteredSales.reduce((s, x) => s + x.total, 0),         [filteredSales])
  const totalCOGS     = useMemo(() => filteredPurchases.reduce((s, x) => s + x.total, 0),     [filteredPurchases])
  const totalRefunds  = useMemo(() => filteredReturns.reduce((s, x) => s + x.refundAmount, 0),[filteredReturns])
  const totalExpenses = useMemo(() => filteredExpenses.reduce((s, x) => s + x.amount, 0),     [filteredExpenses])

  const netRevenue  = totalRevenue - totalRefunds
  const grossProfit = netRevenue - totalCOGS
  const netProfit   = grossProfit - totalExpenses
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0
  const netMargin   = netRevenue > 0 ? (netProfit   / netRevenue) * 100 : 0

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount })
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredExpenses])

  const monthlyTrend = useMemo(() => {
    const allDates = [
      ...filteredSales.map((s) => parseISO(s.date)),
      ...filteredPurchases.map((p) => parseISO(p.date)),
      ...filteredExpenses.map((e) => parseISO(e.date)),
      ...filteredReturns.map((r) => parseISO(r.date)),
    ]
    if (allDates.length === 0) return []
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())))
    return eachMonthOfInterval({ start: startOfMonth(minDate), end: startOfMonth(maxDate) }).map((ms) => {
      const me = endOfMonth(ms)
      const iv = { start: ms, end: me }
      const revenue  = filteredSales.filter((s) => isWithinInterval(parseISO(s.date), iv)).reduce((s, x) => s + x.total, 0)
      const refunds  = filteredReturns.filter((r) => isWithinInterval(parseISO(r.date), iv)).reduce((s, x) => s + x.refundAmount, 0)
      const cogs     = filteredPurchases.filter((p) => isWithinInterval(parseISO(p.date), iv)).reduce((s, x) => s + x.total, 0)
      const opex     = filteredExpenses.filter((e) => isWithinInterval(parseISO(e.date), iv)).reduce((s, x) => s + x.amount, 0)
      const totalExp = cogs + opex + refunds
      return { month: format(ms, "MMM yyyy"), Revenue: revenue, Expenses: totalExp, Profit: revenue - totalExp }
    })
  }, [filteredSales, filteredPurchases, filteredExpenses, filteredReturns])

  const handleExport = () => {
    const rows: Record<string, unknown>[] = [
      { "Line Item": "Sales Revenue",                  Amount: totalRevenue },
      { "Line Item": "Less: Returns/Refunds",          Amount: -totalRefunds },
      { "Line Item": "Net Revenue",                    Amount: netRevenue },
      { "Line Item": "",                               Amount: "" },
      { "Line Item": "Cost of Goods Sold (Purchases)", Amount: totalCOGS },
      { "Line Item": "Gross Profit",                   Amount: grossProfit },
      { "Line Item": "Gross Margin",                   Amount: `${grossMargin.toFixed(1)}%` },
      { "Line Item": "",                               Amount: "" },
      { "Line Item": "── Operating Expenses ──",       Amount: "" },
      ...expenseByCategory.map((c) => ({ "Line Item": `  ${c.name}`, Amount: c.value })),
      { "Line Item": "Total Operating Expenses",       Amount: totalExpenses },
      { "Line Item": "",                               Amount: "" },
      { "Line Item": "Net Profit / (Loss)",            Amount: netProfit },
      { "Line Item": "Net Profit Margin",              Amount: `${netMargin.toFixed(1)}%` },
    ]
    exportToCSV(rows, `Profit-Loss-Statement-${format(new Date(), "yyyy-MM-dd")}`, [
      { key: "Line Item", header: "Line Item" },
      { key: "Amount",    header: "Amount (PKR)" },
    ])
  }

  const periodLabel: Record<PeriodKey, string> = {
    "this-month": "This Month",
    "last-month": "Last Month",
    "last-3":     "Last 3 Months",
    "last-6":     "Last 6 Months",
    "this-year":  "This Year",
    all:          "All Time",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── stat card definitions ─────────────────────────────────────────────────
  const statCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(totalRevenue),
      sub: `${filteredSales.length} sales`,
      Icon: DollarSign,
      iconBg: "bg-emerald-500",
      valueColor: "text-emerald-600",
    },
    {
      title: "Cost of Goods",
      value: formatCurrency(totalCOGS),
      sub: `${filteredPurchases.length} purchases`,
      Icon: ShoppingCart,
      iconBg: "bg-red-500",
      valueColor: "text-red-600",
    },
    {
      title: "Gross Profit",
      value: grossProfit < 0
        ? `(${formatCurrency(Math.abs(grossProfit))})`
        : formatCurrency(grossProfit),
      sub: `${grossMargin.toFixed(1)}% margin`,
      Icon: grossProfit >= 0 ? TrendingUp : TrendingDown,
      iconBg: grossProfit >= 0 ? "bg-blue-500" : "bg-red-500",
      valueColor: grossProfit >= 0 ? "text-blue-600" : "text-red-600",
    },
    {
      title: "Operating Expenses",
      value: formatCurrency(totalExpenses),
      sub: `${expenseByCategory.length} categories`,
      Icon: Receipt,
      iconBg: "bg-amber-500",
      valueColor: "text-amber-600",
    },
    {
      title: "Net Profit",
      value: netProfit < 0
        ? `(${formatCurrency(Math.abs(netProfit))})`
        : formatCurrency(netProfit),
      sub: `${netMargin.toFixed(1)}% margin`,
      Icon: netProfit >= 0 ? TrendingUp : TrendingDown,
      iconBg: netProfit >= 0 ? "bg-emerald-500" : "bg-red-500",
      valueColor: netProfit >= 0 ? "text-emerald-600" : "text-red-600",
    },
  ]

  return (
    <div className="p-4 space-y-3">

      {/* ── Compact header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Profit &amp; Loss</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Financial overview of revenue, costs &amp; profitability</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="h-8 text-xs w-36">
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
          <Button onClick={handleExport} variant="outline" size="sm" className="h-8 text-xs gap-1.5 px-2.5">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── 5 stat cards in one row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-2.5">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl border border-slate-200 shadow-sm px-3 py-2.5 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none">
                {card.title}
              </p>
              <div className={`w-6 h-6 rounded-md ${card.iconBg} flex items-center justify-center shrink-0`}>
                <card.Icon className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <p className={`text-sm font-bold leading-none ${card.valueColor}`}>{card.value}</p>
            <p className="text-[10px] text-slate-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Formal P&L Statement ────────────────────────────────────────────── */}
      <SectionCard
        title={
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            Profit &amp; Loss Statement
          </span>
        }
        badge={
          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
            {periodLabel[period]}
          </span>
        }
      >
        {/* REVENUE */}
        <div className="px-3 pt-2 pb-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue</p>
        </div>
        <div className="flex justify-between items-center px-3 py-1.5">
          <span className="text-xs pl-3 text-slate-500">Sales Revenue</span>
          <span className="text-xs font-semibold text-slate-800">{formatCurrency(totalRevenue)}</span>
        </div>
        <div className="flex justify-between items-center px-3 py-1.5">
          <span className="text-xs pl-3 text-slate-500">Less: Returns / Refunds</span>
          <span className="text-xs font-semibold text-red-500">({formatCurrency(totalRefunds)})</span>
        </div>
        <div className="flex justify-between items-center px-3 py-2 bg-slate-50 border-y border-slate-100">
          <span className="text-xs font-semibold text-slate-700">Net Revenue</span>
          <span className="text-xs font-bold text-slate-900">{formatCurrency(netRevenue)}</span>
        </div>

        {/* COST OF GOODS SOLD */}
        <div className="px-3 pt-2.5 pb-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cost of Goods Sold</p>
        </div>
        <div className="flex justify-between items-center px-3 py-1.5">
          <span className="text-xs pl-3 text-slate-500">Purchases</span>
          <span className="text-xs font-semibold text-slate-800">{formatCurrency(totalCOGS)}</span>
        </div>
        <div className="flex justify-between items-center px-3 py-2 bg-slate-50 border-y border-slate-100">
          <span className="text-xs font-semibold text-slate-700">
            Gross Profit
            <span className="text-[10px] font-normal text-slate-400 ml-1.5">({grossMargin.toFixed(1)}% margin)</span>
          </span>
          <span className={`text-xs font-bold ${grossProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {grossProfit < 0 ? `(${formatCurrency(Math.abs(grossProfit))})` : formatCurrency(grossProfit)}
          </span>
        </div>

        {/* OPERATING EXPENSES */}
        <div className="px-3 pt-2.5 pb-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operating Expenses</p>
        </div>
        {expenseByCategory.length === 0 ? (
          <div className="px-3 py-1.5 pl-6">
            <span className="text-xs text-slate-400 italic">No expenses in this period</span>
          </div>
        ) : (
          expenseByCategory.map((cat) => (
            <div key={cat.name} className="flex justify-between items-center px-3 py-1.5">
              <span className="text-xs pl-3 text-slate-500">{cat.name}</span>
              <span className="text-xs font-semibold text-slate-800">{formatCurrency(cat.value)}</span>
            </div>
          ))
        )}
        <div className="flex justify-between items-center px-3 py-2 bg-slate-50 border-y border-slate-100">
          <span className="text-xs font-semibold text-slate-700">Total Operating Expenses</span>
          <span className="text-xs font-bold text-slate-900">{formatCurrency(totalExpenses)}</span>
        </div>

        {/* NET PROFIT */}
        <div className="px-3 py-2.5">
          <div
            className={`flex justify-between items-center px-3 py-2.5 rounded-lg border ${
              netProfit >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
            }`}
          >
            <span className="text-xs font-bold text-slate-800">Net Profit / (Loss)</span>
            <span className={`text-sm font-bold ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit))})` : formatCurrency(netProfit)}
            </span>
          </div>
          <div className="flex justify-between items-center px-3 mt-2">
            <span className="text-xs text-slate-500">Profit Margin</span>
            <span className={`text-xs font-bold ${netMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {netMargin.toFixed(1)}%
            </span>
          </div>
        </div>
      </SectionCard>

      {/* ── Charts ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Monthly Revenue vs Expenses */}
        <SectionCard
          title={
            <span className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
              Monthly Revenue vs Expenses
            </span>
          }
        >
          <div className="p-3">
            {monthlyTrend.length === 0 ? (
              <div className="flex items-center justify-center h-50 text-xs text-slate-400">
                No data for the selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={monthlyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="plGradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="plGradExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="plGradProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => compactCurrency(v)}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "4px" }} />
                  <Area type="monotone" dataKey="Revenue"  stroke="#10b981" strokeWidth={1.5} fill="url(#plGradRevenue)" />
                  <Area type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={1.5} fill="url(#plGradExpenses)" />
                  <Area type="monotone" dataKey="Profit"   stroke="#2563EB" strokeWidth={1.5} fill="url(#plGradProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        {/* Expense Breakdown */}
        <SectionCard
          title={
            <span className="flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-amber-600" />
              Expense Breakdown
            </span>
          }
        >
          <div className="p-3">
            {expenseByCategory.length === 0 ? (
              <div className="flex items-center justify-center h-50 text-xs text-slate-400">
                No expenses for the selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }: any) =>
                      `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => formatCurrency(Number(value))}
                    contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "4px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

    </div>
  )
}

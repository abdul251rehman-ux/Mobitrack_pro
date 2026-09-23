"use client"
import React, { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import {
  TrendingUp, ShoppingCart, Package, DollarSign, Wallet,
  ArrowRight, AlertTriangle, Plus, BarChart2, Smartphone,
  ShoppingBag, CheckCircle2, Users, Truck, Tag, ArrowUpRight,
  ArrowDownRight, ArrowDownLeft, Calendar, ChevronDown, Clock, CalendarDays, X,
  LayoutDashboard,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts"
import Link from "next/link"
import { toast } from "sonner"
import { getSales } from "@/lib/api/sales"
import { getPayments } from "@/lib/api/payments"
import { getPurchases } from "@/lib/api/purchases"
import { computeNetPaidBySupplier, computeNetReceivedByCustomer } from "@/lib/api/payment-sync"
import { getMobiles, getAccessories } from "@/lib/api/products"
import { getUsedPhones } from "@/lib/api/inventory"
import { getCustomers } from "@/lib/api/customers"
import { getSuppliers } from "@/lib/api/suppliers"
import { getExpenses } from "@/lib/api/expenses"
import { getPersons, getPersonTransactions, type Person, type PersonTransaction } from "@/lib/api/persons"
import type { Sale, Purchase, Mobile, Accessory, Customer, Supplier, Expense, Payment } from "@/data/types"
import type { UsedPhone } from "@/data/used-phones"
import { PageWrapper } from "@/components/layout/page-wrapper"
import { PageHeader } from "@/components/shared/page-header"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatCurrency, formatDate, todayPKT } from "@/lib/utils"
import { format, subMonths, subDays, startOfWeek, endOfWeek, subWeeks, addDays, parseISO, differenceInDays } from "date-fns"
import { useLanguage } from "@/context/language-context"

/* â"€â"€â"€ Custom Tooltips â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
const SparkTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/20 bg-white/20 backdrop-blur-sm px-2 py-1 shadow-xl text-xs text-white font-bold">
      {formatCurrency(payload[0].value)}
    </div>
  )
}

const RevenueTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-xl text-sm">
      <p className="font-semibold text-slate-600 mb-1.5 text-xs uppercase tracking-wide">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
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
      <p className="font-bold text-indigo-600">{payload[0].value} units sold</p>
    </div>
  )
}

const BAR_COLORS = ["#2563EB", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"]

type Period = "today" | "yesterday" | "thisWeek" | "lastWeek" | "month" | "lastMonth" | "year" | "range"

/* â"€â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */
export default function DashboardPage() {
  const { user, hasPermission } = useAuth()
  // Revenue/profit figures are sensitive - only shown to roles that can already
  // see them elsewhere (Reports/Finance). Everyone else still gets the full
  // dashboard, just without the money widgets.
  const canSeeFinancials = hasPermission("reports.view") || hasPermission("payments.view")
  const { t } = useLanguage()
  const TODAY = todayPKT()
  const [period, setPeriod] = useState<Period>("month")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [breakdownCard, setBreakdownCard] = useState<
    "payable" | "receivableCustomers" | "receivablePersons"
    | "sales" | "purchases" | "grossProfit" | "netProfit" | "inventory"
    | "collected" | "outstanding" | "cashIn"
    | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [sales, setSales] = useState<Sale[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [mobiles, setMobiles] = useState<Mobile[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [usedPhones, setUsedPhones] = useState<UsedPhone[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [persons, setPersons] = useState<Person[]>([])
  const [personTransactions, setPersonTransactions] = useState<PersonTransaction[]>([])
  const [shopName, setShopName] = useState("MobiTrack Pro")

  useEffect(() => {
    async function load() {
      try {
        const [s, pay, p, m, a, up, c, sup, exp, pers, persTx] = await Promise.all([
          getSales(),
          getPayments(),
          getPurchases(),
          getMobiles(),
          getAccessories(),
          getUsedPhones(),
          getCustomers(),
          getSuppliers(),
          getExpenses(),
          getPersons(),
          getPersonTransactions(),
        ])
        setSales(s)
        setPayments(pay)
        setPurchases(p)
        setMobiles(m)
        setAccessories(a)
        setUsedPhones(up)
        setCustomers(c)
        setSuppliers(sup)
        setExpenses(exp)
        setPersons(pers)
        setPersonTransactions(persTx)

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

  const filteredSales = useMemo(() => {
    const base = sales.filter(s => s.status !== "Refunded")
    if (period === "today") return base.filter(s => s.date === todayStr)
    if (period === "yesterday") return base.filter(s => s.date === yesterdayStr)
    if (period === "thisWeek") return base.filter(s => s.date >= thisWeekStart && s.date <= todayStr)
    if (period === "lastWeek") return base.filter(s => s.date >= lastWeekStartStr && s.date <= lastWeekEndStr)
    if (period === "month") return base.filter(s => s.date.startsWith(currentMonthKey))
    if (period === "lastMonth") return base.filter(s => s.date.startsWith(lastMonthKey))
    if (period === "year") return base.filter(s => s.date.startsWith(currentYearKey))
    if (period === "range" && dateFrom && dateTo) return base.filter(s => s.date >= dateFrom && s.date <= dateTo)
    return base.filter(s => s.date.startsWith(currentMonthKey))
  }, [period, sales, currentMonthKey, lastMonthKey, currentYearKey, yesterdayStr, thisWeekStart, todayStr, lastWeekStartStr, lastWeekEndStr, dateFrom, dateTo])

  // Payments actually received from customers within the selected period, by
  // the PAYMENT's own date - not the sale's date. This is different from
  // periodCollected below: a sale made yesterday but paid off today counts
  // its cash toward TODAY here, but toward YESTERDAY in periodCollected
  // (which follows the sale's date, matching the Sales page). Same period-
  // matching logic as filteredSales above, applied to Payment.date instead.
  const filteredCashInPayments = useMemo(() => {
    const base = payments.filter(p => p.entityType === "Customer" && p.type === "Received" && p.status === "Completed")
    if (period === "today") return base.filter(p => p.date === todayStr)
    if (period === "yesterday") return base.filter(p => p.date === yesterdayStr)
    if (period === "thisWeek") return base.filter(p => p.date >= thisWeekStart && p.date <= todayStr)
    if (period === "lastWeek") return base.filter(p => p.date >= lastWeekStartStr && p.date <= lastWeekEndStr)
    if (period === "month") return base.filter(p => p.date.startsWith(currentMonthKey))
    if (period === "lastMonth") return base.filter(p => p.date.startsWith(lastMonthKey))
    if (period === "year") return base.filter(p => p.date.startsWith(currentYearKey))
    if (period === "range" && dateFrom && dateTo) return base.filter(p => p.date >= dateFrom && p.date <= dateTo)
    return base.filter(p => p.date.startsWith(currentMonthKey))
  }, [period, payments, currentMonthKey, lastMonthKey, currentYearKey, yesterdayStr, thisWeekStart, todayStr, lastWeekStartStr, lastWeekEndStr, dateFrom, dateTo])

  const periodCashIn = useMemo(() => filteredCashInPayments.reduce((s, p) => s + p.amount, 0), [filteredCashInPayments])
  const cashInByPayment = useMemo(
    () => filteredCashInPayments
      .map(p => ({ name: `${p.entityName || "Walk-in"}${p.referenceNumber ? ` · ${p.referenceNumber}` : ""} · ${p.method}`, amount: p.amount, date: p.date }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [filteredCashInPayments]
  )

  const filteredPurchases = useMemo(() => {
    const base = purchases
    if (period === "today") return base.filter(p => p.date === todayStr)
    if (period === "yesterday") return base.filter(p => p.date === yesterdayStr)
    if (period === "thisWeek") return base.filter(p => p.date >= thisWeekStart && p.date <= todayStr)
    if (period === "lastWeek") return base.filter(p => p.date >= lastWeekStartStr && p.date <= lastWeekEndStr)
    if (period === "month") return base.filter(p => p.date.startsWith(currentMonthKey))
    if (period === "lastMonth") return base.filter(p => p.date.startsWith(lastMonthKey))
    if (period === "year") return base.filter(p => p.date.startsWith(currentYearKey))
    if (period === "range" && dateFrom && dateTo) return base.filter(p => p.date >= dateFrom && p.date <= dateTo)
    return base.filter(p => p.date.startsWith(currentMonthKey))
  }, [period, purchases, currentMonthKey, lastMonthKey, currentYearKey, yesterdayStr, thisWeekStart, todayStr, lastWeekStartStr, lastWeekEndStr, dateFrom, dateTo])

  // Only Paid expenses count against profit - a Pending expense hasn't
  // actually left the business yet.
  const filteredExpenses = useMemo(() => {
    const base = expenses.filter(e => e.status === "Paid")
    if (period === "today") return base.filter(e => e.date === todayStr)
    if (period === "yesterday") return base.filter(e => e.date === yesterdayStr)
    if (period === "thisWeek") return base.filter(e => e.date >= thisWeekStart && e.date <= todayStr)
    if (period === "lastWeek") return base.filter(e => e.date >= lastWeekStartStr && e.date <= lastWeekEndStr)
    if (period === "month") return base.filter(e => e.date.startsWith(currentMonthKey))
    if (period === "lastMonth") return base.filter(e => e.date.startsWith(lastMonthKey))
    if (period === "year") return base.filter(e => e.date.startsWith(currentYearKey))
    if (period === "range" && dateFrom && dateTo) return base.filter(e => e.date >= dateFrom && e.date <= dateTo)
    return base.filter(e => e.date.startsWith(currentMonthKey))
  }, [period, expenses, currentMonthKey, lastMonthKey, currentYearKey, yesterdayStr, thisWeekStart, todayStr, lastWeekStartStr, lastWeekEndStr, dateFrom, dateTo])

  const periodExpensesTotal = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses])

  const periodRevenue    = useMemo(() => filteredSales.reduce((s, x) => s + x.total, 0), [filteredSales])
  const periodPurchases  = useMemo(() => filteredPurchases.reduce((s, x) => s + x.total, 0), [filteredPurchases])

  // How much of this period's sales revenue has actually been collected vs is
  // still owed - amountReceived is written by fn_create_sale at checkout and
  // bumped every time a Collect Payment action runs (ledger/customers,
  // customers/[id]), so this updates the moment a payment is recorded, no
  // separate sync step. Same period filter and Sale[] source as periodRevenue
  // above, and the same math as the Sales page's "Selected Period Sales" card
  // (app/sales/page.tsx selectedPeriodStats), so both pages always agree.
  const periodCollected   = useMemo(() => filteredSales.reduce((s, x) => s + x.amountReceived, 0), [filteredSales])
  const periodOutstanding = useMemo(() => Math.max(0, periodRevenue - periodCollected), [periodRevenue, periodCollected])

  // Per-invoice / per-PO breakdowns for the Sales Revenue and Purchases cards -
  // built from the exact same filteredSales/filteredPurchases arrays the totals
  // above sum, so switching the period filter updates the card and its
  // breakdown dialog together and they can never show different periods.
  const revenueBySale = useMemo(
    () => filteredSales
      .map(s => ({ name: `${s.invoiceNumber} · ${s.customerName || "Walk-in"}`, amount: s.total, date: s.date }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [filteredSales]
  )
  const collectedBySale = useMemo(
    () => filteredSales
      .filter(s => s.amountReceived > 0)
      .map(s => ({ name: `${s.invoiceNumber} · ${s.customerName || "Walk-in"}`, amount: s.amountReceived, date: s.date }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [filteredSales]
  )
  const outstandingBySale = useMemo(
    () => filteredSales
      .filter(s => s.total - s.amountReceived > 0)
      .map(s => ({ name: `${s.invoiceNumber} · ${s.customerName || "Walk-in"}`, amount: s.total - s.amountReceived, date: s.date }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [filteredSales]
  )
  const purchasesByPO = useMemo(
    () => filteredPurchases
      .map(p => ({ name: `${p.poNumber} · ${p.supplierName || "Unknown"}`, amount: p.total, date: p.date }))
      .sort((a, b) => b.date.localeCompare(a.date)),
    [filteredPurchases]
  )

  const mobileMap    = useMemo(() => new Map(mobiles.map(m => [m.id, m.purchasePrice])), [mobiles])
  const accMap       = useMemo(() => new Map(accessories.map(a => [a.id, a.purchasePrice])), [accessories])
  const usedPhoneMap = useMemo(() => new Map(usedPhones.map(p => [p.id, p.purchase_price + p.refurbishment_cost])), [usedPhones])

  // Total money currently tied up in inventory on hand right now - not a period
  // figure like the cards above, this is a snapshot across mobiles + accessories
  // + used phones (excluding sold/returned ones, which are no longer held).
  const totalInventoryInvestment = useMemo(() => {
    const mobilesCost     = mobiles.reduce((s, m) => s + m.purchasePrice * m.stock, 0)
    const accessoriesCost = accessories.reduce((s, a) => s + a.purchasePrice * a.stock, 0)
    const usedPhonesCost  = usedPhones
      .filter(p => p.status !== "sold" && p.status !== "returned")
      .reduce((s, p) => s + p.purchase_price + p.refurbishment_cost, 0)
    return mobilesCost + accessoriesCost + usedPhonesCost
  }, [mobiles, accessories, usedPhones])

  // Per-product breakdown for the Inventory Investment card - same three
  // sources/filters as the total above (a live stock snapshot, not scoped to
  // the period filter, since "last month's inventory" isn't a meaningful
  // question for what's on the shelf right now).
  const inventoryByItem = useMemo(() => {
    const rows: { name: string; amount: number; date: string }[] = []
    mobiles.forEach(m => {
      if (m.stock > 0) rows.push({ name: `${m.brand} ${m.model} (${m.stock} in stock)`, amount: m.purchasePrice * m.stock, date: m.dateAdded })
    })
    accessories.forEach(a => {
      if (a.stock > 0) rows.push({ name: `${a.name} (${a.stock} in stock)`, amount: a.purchasePrice * a.stock, date: a.dateAdded })
    })
    usedPhones
      .filter(p => p.status !== "sold" && p.status !== "returned")
      .forEach(p => rows.push({ name: `${p.brand} ${p.model} · IMEI ${p.imei_number}`, amount: p.purchase_price + p.refurbishment_cost, date: p.purchased_date }))
    return rows.sort((a, b) => b.date.localeCompare(a.date))
  }, [mobiles, accessories, usedPhones])

  // Three running balances, not period figures - "how much do we currently owe /
  // get owed right now", same reasoning as Total Inventory Investment above.
  //
  // Payable/Receivable are computed straight from the `payments` table
  // (single source of truth) rather than from purchases.balance_due /
  // sales.amountReceived - those two fields are meant to be kept in sync by
  // settleSupplierPayment/settleCustomerPayment (lib/api/purchases.ts,
  // lib/api/sales.ts) every time a payment is recorded, but a real
  // production bug (Pay Supplier never touching purchases at all) let them
  // silently drift apart for weeks before anyone noticed the Dashboard and
  // Supplier Ledger disagreeing. Computing directly from `payments` here
  // means the Dashboard can never be wrong about how much has actually been
  // paid, even if that sync bug ever recurs. purchases.total/sales.total
  // (the amount OWED) still comes from those tables, not from `payments` -
  // that side is never wrong since it's set once at creation.
  // See lib/api/payment-sync.ts for the shared fold logic (also used by the
  // Supplier Ledger, Reports, and Purchases pages) - keeping this in one
  // place is what guarantees the Dashboard and Ledger can never drift apart
  // again the way they did before (see supabase/fix_purchase_payment_sync.sql).
  const paidToSupplierMap = useMemo(() => computeNetPaidBySupplier(payments), [payments])
  const receivedFromCustomerMap = useMemo(() => computeNetReceivedByCustomer(payments), [payments])

  const totalPayableToSuppliers = useMemo(() => {
    const owedPerSupplier = new Map<string, number>()
    purchases.forEach(p => {
      if (!p.supplierId) return
      owedPerSupplier.set(p.supplierId, (owedPerSupplier.get(p.supplierId) ?? 0) + p.total)
    })
    let total = 0
    owedPerSupplier.forEach((totalOwed, supplierId) => {
      total += Math.max(0, totalOwed - (paidToSupplierMap.get(supplierId) ?? 0))
    })
    return total
  }, [purchases, paidToSupplierMap])

  const totalReceivableFromCustomers = useMemo(() => {
    const billedPerCustomer = new Map<string, number>()
    sales.filter(s => s.status !== "Refunded" && s.customerId).forEach(s => {
      billedPerCustomer.set(s.customerId!, (billedPerCustomer.get(s.customerId!) ?? 0) + s.total)
    })
    let total = 0
    billedPerCustomer.forEach((totalBilled, customerId) => {
      total += Math.max(0, totalBilled - (receivedFromCustomerMap.get(customerId) ?? 0))
    })
    return total
  }, [sales, receivedFromCustomerMap])

  // Safety net: if purchases.balance_due / sales.amountReceived (the cached
  // fields settleSupplierPayment/settleCustomerPayment maintain, still used
  // elsewhere - e.g. the per-purchase breakdown dialogs) ever drift from
  // what `payments` says was actually paid, surface a visible warning
  // instead of a silent, slow-to-notice mismatch like last time.
  const paymentsSyncWarning = useMemo(() => {
    let supplierMismatch = 0
    const supplierIds = new Set(purchases.map(p => p.supplierId).filter(Boolean) as string[])
    supplierIds.forEach(supplierId => {
      const cachedBalance = purchases.filter(p => p.supplierId === supplierId).reduce((s, p) => s + p.balanceDue, 0)
      const totalOwed = purchases.filter(p => p.supplierId === supplierId).reduce((s, p) => s + p.total, 0)
      const recomputedBalance = Math.max(0, totalOwed - (paidToSupplierMap.get(supplierId) ?? 0))
      if (Math.abs(recomputedBalance - cachedBalance) > 1) supplierMismatch += Math.abs(recomputedBalance - cachedBalance)
    })

    let customerMismatch = 0
    const customerIds = new Set(sales.filter(s => s.status !== "Refunded" && s.customerId).map(s => s.customerId) as string[])
    customerIds.forEach(customerId => {
      const cachedReceived = sales.filter(s => s.customerId === customerId && s.status !== "Refunded").reduce((s, x) => s + x.amountReceived, 0)
      const recomputedReceived = receivedFromCustomerMap.get(customerId) ?? 0
      if (Math.abs(recomputedReceived - cachedReceived) > 1) customerMismatch += Math.abs(recomputedReceived - cachedReceived)
    })

    return supplierMismatch + customerMismatch > 1
      ? { supplierMismatch: Math.round(supplierMismatch), customerMismatch: Math.round(customerMismatch) }
      : null
  }, [purchases, sales, paidToSupplierMap, receivedFromCustomerMap])
  const totalReceivableFromPersons = useMemo(() => {
    const balances = new Map<string, number>(persons.map(p => [p.id, p.openingBalance]))
    for (const tx of personTransactions) {
      const delta = tx.type === "gave" ? tx.amount : -tx.amount
      balances.set(tx.personId, (balances.get(tx.personId) ?? 0) + delta)
    }
    // Only positive balances count as receivable - a negative one means we owe
    // that person, which is a separate liability and shouldn't offset this total.
    return [...balances.values()].reduce((s, bal) => s + Math.max(0, bal), 0)
  }, [persons, personTransactions])

  // Per-entity breakdowns for the click-through dialogs - built from the exact
  // same payments-based logic as totalPayableToSuppliers/totalReceivableFromCustomers
  // above, so the number on the card and the sum of the breakdown rows always agree.
  const payableBySupplier = useMemo(() => {
    // Purchases with no supplierId (used-phone "Walk-in: <name>" buybacks from
    // an individual, not a ledger supplier) never get a `payments` row - their
    // own balanceDue is already the only truth for them. Mixing them into the
    // payments-based map here (keyed by name) would double as "always unpaid"
    // since paidToSupplierMap can never have an entry for them, badly
    // overstating payable. Excluded here to match totalPayableToSuppliers exactly.
    const owedPerSupplier = new Map<string, { name: string; amount: number; date: string }>()
    purchases.forEach(p => {
      if (!p.supplierId) return
      const existing = owedPerSupplier.get(p.supplierId)
      if (existing) {
        existing.amount += p.total
        if (p.date > existing.date) existing.date = p.date
      } else {
        owedPerSupplier.set(p.supplierId, { name: p.supplierName || "Unknown Supplier", amount: p.total, date: p.date })
      }
    })
    return [...owedPerSupplier.entries()]
      .map(([supplierId, entry]) => ({
        name: entry.name,
        amount: Math.max(0, entry.amount - (paidToSupplierMap.get(supplierId) ?? 0)),
        date: entry.date,
      }))
      .filter(row => row.amount > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [purchases, paidToSupplierMap])

  const receivableByCustomer = useMemo(() => {
    // Same reasoning as payableBySupplier above - walk-in sales with no
    // customerId never get a `payments` row, so they're excluded here to
    // match totalReceivableFromCustomers (which also requires customerId).
    const billedPerCustomer = new Map<string, { name: string; amount: number; date: string }>()
    sales.filter(s => s.status !== "Refunded" && s.customerId).forEach(s => {
      const key = s.customerId!
      const existing = billedPerCustomer.get(key)
      if (existing) {
        existing.amount += s.total
        if (s.date > existing.date) existing.date = s.date
      } else {
        billedPerCustomer.set(key, { name: s.customerName || "Walk-in Customer", amount: s.total, date: s.date })
      }
    })
    return [...billedPerCustomer.entries()]
      .map(([customerId, entry]) => ({
        name: entry.name,
        amount: Math.max(0, entry.amount - (receivedFromCustomerMap.get(customerId) ?? 0)),
        date: entry.date,
      }))
      .filter(row => row.amount > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [sales, receivedFromCustomerMap])

  const receivableByPerson = useMemo(() => {
    const balances = new Map<string, number>(persons.map(p => [p.id, p.openingBalance]))
    const lastActivity = new Map<string, string>()
    for (const tx of personTransactions) {
      const delta = tx.type === "gave" ? tx.amount : -tx.amount
      balances.set(tx.personId, (balances.get(tx.personId) ?? 0) + delta)
      const prev = lastActivity.get(tx.personId)
      if (!prev || tx.date > prev) lastActivity.set(tx.personId, tx.date)
    }
    const nameById = new Map(persons.map(p => [p.id, p.name]))
    return [...balances.entries()]
      .filter(([, bal]) => bal > 0)
      .map(([id, bal]) => ({
        name: nameById.get(id) ?? "Unknown Person",
        amount: bal,
        // Persons with only an opening balance and no transactions yet have no
        // activity date to sort by - they sink to the bottom rather than
        // falsely claiming to be "latest".
        date: lastActivity.get(id) ?? "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [persons, personTransactions])

  // Items whose cost can't be found in the current catalog (deleted/replaced
  // product row, etc.) are excluded from both profit AND the revenue used for
  // the margin %, instead of silently costing 0 - a missing cost is not the
  // same as a free item, and the old behavior inflated margin toward 100%.
  // Also builds the per-sale profit breakdown used by the Gross Profit
  // dashboard card's click-through dialog, from this exact same loop, so the
  // card total and the breakdown rows can never drift apart from each other.
  const { periodProfit, periodProfitRevenue, periodProfitHasGaps, profitBySale } = useMemo(() => {
    let profit = 0
    let revenueCounted = 0
    let hasGaps = false
    const bySale: { name: string; amount: number; date: string }[] = []
    for (const sale of filteredSales) {
      let saleRevenueCounted = 0
      let itemProfit = 0
      for (const item of sale.items) {
        // fn_create_sale stores used-phone sale items with product_type='Mobile' too
        // (sale_items has no separate UsedPhone type) - "UsedPhone" here never
        // actually appears on a persisted item, so a plain "Mobile" lookup has to
        // check both cost tables since a real IMEI mobile and a used phone share
        // the same product_type but live in different tables/id-spaces.
        const cost = item.productType === "Accessory"
          ? accMap.get(item.productId)
          : mobileMap.get(item.productId) ?? usedPhoneMap.get(item.productId)
        if (cost === undefined) { hasGaps = true; continue }
        itemProfit += (item.unitPrice - cost) * item.quantity - (item.discount ?? 0)
        saleRevenueCounted += item.unitPrice * item.quantity
      }
      const saleProfit = itemProfit - (sale.discount ?? 0)
      profit += saleProfit
      revenueCounted += saleRevenueCounted
      bySale.push({ name: `${sale.invoiceNumber} · ${sale.customerName || "Walk-in"}`, amount: saleProfit, date: sale.date })
    }
    bySale.sort((a, b) => b.date.localeCompare(a.date))
    return { periodProfit: profit, periodProfitRevenue: revenueCounted, periodProfitHasGaps: hasGaps, profitBySale: bySale }
  }, [filteredSales, mobileMap, accMap, usedPhoneMap])

  // Net Profit = Gross Profit - operating expenses (rent, salaries, utilities,
  // etc. from the Expenses page) for the same period - what the owner actually
  // kept, as opposed to Gross Profit which only nets out cost of goods sold.
  const periodNetProfit = periodProfit - periodExpensesTotal

  // Net Profit breakdown: same per-sale profit rows as Gross Profit, plus each
  // period expense shown as a negative row - together they sum to exactly
  // periodNetProfit, the same subtraction the card itself does.
  const netProfitBreakdown = useMemo(
    () => [
      ...profitBySale,
      ...filteredExpenses.map(e => ({ name: `${e.title} (expense)`, amount: -e.amount, date: e.date })),
    ].sort((a, b) => b.date.localeCompare(a.date)),
    [profitBySale, filteredExpenses]
  )

  const salesSparkData = useMemo(() => {
    const base = (arr: typeof sales) => arr.filter(s => s.status !== "Refunded")
    if (period === "year") {
      return Array.from({ length: 12 }, (_, i) => {
        const monthKey = format(subMonths(todayParsed, 11 - i), "yyyy-MM")
        return { v: base(sales).filter(s => s.date.startsWith(monthKey)).reduce((s, x) => s + x.total, 0) }
      })
    }
    if (period === "today" || period === "yesterday") {
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
        const prev = i === 0 ? dateFrom : format(addDays(parseISO(dateFrom), Math.round((i - 1) * totalDays / (points - 1 || 1)) + 1), "yyyy-MM-dd")
        return { v: base(sales).filter(s => s.date >= prev && s.date <= d).reduce((s, x) => s + x.total, 0) }
      })
    }
    const baseMonth = period === "lastMonth" ? lastMonthKey : currentMonthKey
    return Array.from({ length: 10 }, (_, i) => {
      const dayStart = `${baseMonth}-${String((i * 3) + 1).padStart(2, "0")}`
      const dayEnd   = `${baseMonth}-${String((i + 1) * 3).padStart(2, "0")}`
      return { v: base(sales).filter(s => s.date >= dayStart && s.date <= dayEnd).reduce((s, x) => s + x.total, 0) }
    })
  }, [period, sales, currentMonthKey, lastMonthKey, thisWeekStart, lastWeekStartStr, dateFrom, dateTo])

  const purchaseSparkData = useMemo(() => {
    if (period === "year") {
      return Array.from({ length: 12 }, (_, i) => {
        const monthKey = format(subMonths(todayParsed, 11 - i), "yyyy-MM")
        return { v: purchases.filter(p => p.date.startsWith(monthKey)).reduce((s, x) => s + x.total, 0) }
      })
    }
    if (period === "today" || period === "yesterday") {
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
        const prev = i === 0 ? dateFrom : format(addDays(parseISO(dateFrom), Math.round((i - 1) * totalDays / (points - 1 || 1)) + 1), "yyyy-MM-dd")
        return { v: purchases.filter(p => p.date >= prev && p.date <= d).reduce((s, x) => s + x.total, 0) }
      })
    }
    const baseMonth = period === "lastMonth" ? lastMonthKey : currentMonthKey
    return Array.from({ length: 10 }, (_, i) => {
      const dayStart = `${baseMonth}-${String((i * 3) + 1).padStart(2, "0")}`
      const dayEnd   = `${baseMonth}-${String((i + 1) * 3).padStart(2, "0")}`
      return { v: purchases.filter(p => p.date >= dayStart && p.date <= dayEnd).reduce((s, x) => s + x.total, 0) }
    })
  }, [period, purchases, currentMonthKey, lastMonthKey, thisWeekStart, lastWeekStartStr, dateFrom, dateTo])

  const profitSparkData = useMemo(() =>
    salesSparkData.map((d, i) => ({ v: Math.max(0, d.v - (purchaseSparkData[i]?.v ?? 0) * 0.3) }))
  , [salesSparkData, purchaseSparkData])

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const monthDate  = subMonths(todayParsed, 6 - i)
      const monthKey   = format(monthDate, "yyyy-MM")
      const monthLabel = format(monthDate, "MMM ''yy")
      const monthSales = sales.filter(s => s.date.startsWith(monthKey) && s.status !== "Refunded")
      const revenue    = monthSales.reduce((s, x) => s + x.total, 0)
      const profit     = monthSales.reduce((total, sale) => {
        const itemProfit = sale.items.reduce((sub, item) => {
          const costMap = item.productType === "Mobile" ? mobileMap : item.productType === "UsedPhone" ? usedPhoneMap : accMap
          const cost = costMap.get(item.productId)
          if (cost === undefined) return sub
          return sub + (item.unitPrice - cost) * item.quantity - (item.discount ?? 0)
        }, 0)
        return total + itemProfit - (sale.discount ?? 0)
      }, 0)
      return { month: monthLabel, Revenue: revenue, Profit: Math.max(0, profit) }
    })
  }, [mobileMap, accMap, usedPhoneMap, sales])

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

  const lowStockItems = useMemo(() => {
    return accessories
      .filter(a => a.stock <= 5)
      .map(a => ({ id: a.id, name: a.name, stock: a.stock, type: "Accessory" as const }))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6)
  }, [accessories])

  const recentSales     = useMemo(() => [...sales].reverse().slice(0, 7), [sales])
  const recentPurchases = useMemo(() => [...purchases].reverse().slice(0, 7), [purchases])

  const totalProducts = mobiles.length + accessories.length
  const totalSalesCount = sales.length
  const totalPurchasesCount = purchases.length

  const periodLabel = {
    today: t("dash.Today"),
    yesterday: t("dash.Yesterday"),
    thisWeek: t("dash.This Week"),
    lastWeek: t("dash.Last Week"),
    month: t("dash.This Month"),
    lastMonth: t("dash.Last Month"),
    year: t("dash.This Year"),
    range: dateFrom && dateTo ? `${dateFrom} - ${dateTo}` : t("dash.Custom Range"),
  }[period]

  const FILTER_OPTIONS: { value: Period; label: string; icon: React.ElementType; desc: string }[] = [
    { value: "today",     label: t("dash.Today"),        icon: Clock,        desc: t("dash.Sales from today") },
    { value: "yesterday", label: t("dash.Yesterday"),    icon: Clock,        desc: t("dash.Sales from yesterday") },
    { value: "thisWeek",  label: t("dash.This Week"),    icon: CalendarDays, desc: t("dash.Mon to today") },
    { value: "lastWeek",  label: t("dash.Last Week"),    icon: CalendarDays, desc: t("dash.Mon to Sun prev") },
    { value: "month",     label: t("dash.This Month"),   icon: Calendar,     desc: format(todayParsed, "MMMM yyyy") },
    { value: "lastMonth", label: t("dash.Last Month"),   icon: Calendar,     desc: format(subMonths(todayParsed, 1), "MMMM yyyy") },
    { value: "year",      label: t("dash.This Year"),    icon: TrendingUp,   desc: currentYearKey },
    { value: "range",     label: t("dash.Custom Range"), icon: CalendarDays, desc: t("dash.Pick a date range") },
  ]

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading dashboard...</p>
          </div>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>

      {/* â"€â"€ Page Header â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <PageHeader
        title="Dashboard"
        icon={<LayoutDashboard />}
        iconBg="bg-indigo-600"
      />

      {/* â"€â"€ Quick Actions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
        {[
          { href: "/sales/new",            icon: Plus,        label: t("action.New Sale"),     bg: "from-indigo-500 to-indigo-600",       shadow: "shadow-indigo-200"   },
          { href: "/purchases/new",        icon: ShoppingBag, label: t("action.New Purchase"), bg: "from-violet-500 to-violet-600",   shadow: "shadow-violet-200" },
          { href: "/products/mobiles",     icon: Smartphone,  label: t("dash.Add Mobile"),   bg: "from-emerald-500 to-emerald-600", shadow: "shadow-emerald-200"},
          { href: "/products/accessories", icon: Package,     label: t("nav.Accessories"),  bg: "from-amber-500 to-amber-600",     shadow: "shadow-amber-200"  },
          { href: "/customers",            icon: Users,       label: t("nav.Customers"),    bg: "from-rose-500 to-rose-600",       shadow: "shadow-rose-200"   },
          { href: "/reports",              icon: BarChart2,   label: t("dash.Reports"),      bg: "from-cyan-500 to-cyan-600",       shadow: "shadow-cyan-200"   },
        ].map(({ href, icon: Icon, label, bg, shadow }) => (
          <Link key={href} href={href}>
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-100 p-2.5 sm:p-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer text-center group shadow-sm">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-linear-to-br ${bg} flex items-center justify-center shadow-sm ${shadow} group-hover:scale-110 transition-transform`}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
              <p className="text-[10px] font-semibold text-slate-600 leading-tight">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Visible only when purchases/sales payment totals disagree with the
          payments table they're supposed to stay in sync with - see
          paymentsSyncWarning above for why this exists: a real bug once let
          these drift apart silently for weeks. */}
      {canSeeFinancials && paymentsSyncWarning && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-800">
              Payment totals may be out of sync
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Purchases/Sales balances don't match the payments on record
              {paymentsSyncWarning.supplierMismatch > 0 && ` (suppliers off by ~${formatCurrency(paymentsSyncWarning.supplierMismatch)})`}
              {paymentsSyncWarning.supplierMismatch > 0 && paymentsSyncWarning.customerMismatch > 0 && ", "}
              {paymentsSyncWarning.customerMismatch > 0 && ` (customers off by ~${formatCurrency(paymentsSyncWarning.customerMismatch)})`}
              . Numbers below may be understated or overstated until this is reconciled.
            </p>
          </div>
        </div>
      )}

      {/* â"€â"€ Financial Overview - revenue/profit is sensitive, hidden from roles without reports/finance access â"€â"€ */}
      {canSeeFinancials && (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Financial Overview</h2>
            <p className="text-[11px] text-slate-400">Revenue, purchases & profit summary</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(v => !v)}
              className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all min-w-[130px]"
            >
              <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
              <span className="flex-1 text-left truncate">{periodLabel}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${showFilterMenu ? "rotate-180" : ""}`} />
            </button>

            {/* Desktop dropdown */}
            {showFilterMenu && (
              <div className="hidden sm:block absolute right-0 mt-1 z-50 bg-white border border-slate-100 rounded-xl shadow-xl py-1 min-w-[170px]">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setPeriod(opt.value); if (opt.value !== "range") setShowFilterMenu(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${
                      period === opt.value ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <opt.icon className={`w-3 h-3 ${period === opt.value ? "text-indigo-500" : "text-slate-400"}`} />
                    {opt.label}
                  </button>
                ))}
                {period === "range" && (
                  <div className="px-3 pb-2 pt-1 border-t border-slate-100 space-y-1.5">
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile bottom sheet */}
          {showFilterMenu && typeof document !== "undefined" && createPortal(
            <div className="sm:hidden fixed inset-0 z-[9999] flex flex-col justify-end" onClick={() => setShowFilterMenu(false)}>
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
              <div
                className="relative bg-white rounded-t-3xl shadow-2xl max-h-[85dvh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-slate-200" />
                </div>
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Select Period</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Filter financial overview data</p>
                  </div>
                  <button onClick={() => setShowFilterMenu(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                <div className="px-4 py-3 space-y-1">
                  {FILTER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setPeriod(opt.value); if (opt.value !== "range") setShowFilterMenu(false) }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all ${
                        period === opt.value
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        period === opt.value ? "bg-white/20" : "bg-white shadow-sm"
                      }`}>
                        <opt.icon className={`w-4 h-4 ${period === opt.value ? "text-white" : "text-indigo-500"}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-semibold leading-tight ${period === opt.value ? "text-white" : "text-slate-800"}`}>{opt.label}</p>
                        <p className={`text-[10px] mt-0.5 ${period === opt.value ? "text-indigo-100" : "text-slate-400"}`}>{opt.desc}</p>
                      </div>
                      {period === opt.value && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
                    </button>
                  ))}
                </div>
                {period === "range" && (
                  <div className="mx-4 mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Date Range</p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      </div>
                    </div>
                    <button
                      onClick={() => setShowFilterMenu(false)}
                      className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-indigo-200 active:scale-95 transition-transform"
                    >
                      Apply Range
                    </button>
                  </div>
                )}
                <div className="h-5" />
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* â"€â"€ MOBILE: gradient cards â"€â"€ */}
        <div className="sm:hidden space-y-2">
          {([
            {
              label: t("dash.Sales Revenue"), value: formatCurrency(periodRevenue),
              sub: `${filteredSales.length} ${t("dash.transactions")}`,
              icon: ShoppingCart, grad: "from-indigo-500 to-indigo-600",
              shadow: "shadow-indigo-200/60", card: "sales" as const,
            },
            {
              label: t("dash.Purchases"), value: formatCurrency(periodPurchases),
              sub: `${filteredPurchases.length} ${t("dash.orders")}`,
              icon: TrendingUp, grad: "from-violet-500 to-violet-600",
              shadow: "shadow-violet-200/60", card: "purchases" as const,
            },
            {
              label: t("dash.Gross Profit"), value: `${periodProfit < 0 ? "-" : ""}${formatCurrency(Math.round(Math.abs(periodProfit)))}`,
              sub: `${periodProfitRevenue > 0 ? Math.round((periodProfit / periodProfitRevenue) * 100) : 0}% ${t("dash.margin")}${periodProfitHasGaps ? " *" : ""}`,
              icon: DollarSign, grad: periodProfit < 0 ? "from-rose-500 to-rose-600" : "from-emerald-500 to-emerald-600",
              shadow: periodProfit < 0 ? "shadow-rose-200/60" : "shadow-emerald-200/60", card: "grossProfit" as const,
            },
            {
              label: t("dash.Net Profit"), value: `${periodNetProfit < 0 ? "-" : ""}${formatCurrency(Math.round(Math.abs(periodNetProfit)))}`,
              sub: `${t("dash.After expenses")} - ${formatCurrency(Math.round(periodExpensesTotal))}`,
              icon: ArrowUpRight, grad: periodNetProfit < 0 ? "from-rose-500 to-rose-600" : "from-cyan-500 to-cyan-600",
              shadow: periodNetProfit < 0 ? "shadow-rose-200/60" : "shadow-cyan-200/60", card: "netProfit" as const,
            },
          ] as const).map(({ label, value, sub, icon: Icon, grad, shadow, card }) => (
            <button key={label} type="button" onClick={() => setBreakdownCard(card)} className={`relative overflow-hidden rounded-xl bg-linear-to-r ${grad} px-4 py-3.5 shadow-md ${shadow} w-full text-left cursor-pointer active:scale-[0.98] transition-transform`}>
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-xs font-medium">{label}</p>
                  <p className="text-white text-xl font-bold tracking-tight leading-tight">{value}</p>
                  <p className="text-white/60 text-[11px] mt-0.5">{sub}</p>
                </div>
                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* â"€â"€ DESKTOP: gradient cards with sparklines â"€â"€ */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Sales Card */}
          <div role="button" tabIndex={0} onClick={() => setBreakdownCard("sales")} onKeyDown={e => e.key === "Enter" && setBreakdownCard("sales")} className="relative overflow-hidden rounded-xl bg-linear-to-br from-indigo-500 to-indigo-700 p-4 shadow-md shadow-indigo-200/50 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-indigo-200 text-xs font-medium">Sales Revenue</p>
                  <p className="text-indigo-100 text-[10px]">{periodLabel}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <ShoppingCart className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className="text-white text-xl font-bold tracking-tight leading-tight mb-0.5">{formatCurrency(periodRevenue)}</p>
              <p className="text-indigo-200 text-[11px]">{filteredSales.length} transactions</p>
              <div className="mt-2 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesSparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ffffff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip content={<SparkTooltip />} />
                    <Area type="monotone" dataKey="v" stroke="#ffffff" strokeWidth={1.5} fill="url(#salesSpark)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Purchases Card */}
          <div role="button" tabIndex={0} onClick={() => setBreakdownCard("purchases")} onKeyDown={e => e.key === "Enter" && setBreakdownCard("purchases")} className="relative overflow-hidden rounded-xl bg-linear-to-br from-violet-500 to-violet-700 p-4 shadow-md shadow-violet-200/50 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-violet-200 text-xs font-medium">Purchases</p>
                  <p className="text-violet-100 text-[10px]">{periodLabel}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className="text-white text-xl font-bold tracking-tight leading-tight mb-0.5">{formatCurrency(periodPurchases)}</p>
              <p className="text-violet-200 text-[11px]">{filteredPurchases.length} purchase orders</p>
              <div className="mt-2 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={purchaseSparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="purchaseSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ffffff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip content={<SparkTooltip />} />
                    <Area type="monotone" dataKey="v" stroke="#ffffff" strokeWidth={1.5} fill="url(#purchaseSpark)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Profit Card */}
          <div role="button" tabIndex={0} onClick={() => setBreakdownCard("grossProfit")} onKeyDown={e => e.key === "Enter" && setBreakdownCard("grossProfit")} className={`relative overflow-hidden rounded-xl bg-linear-to-br p-4 shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all ${periodProfit < 0 ? "from-rose-500 to-rose-700 shadow-rose-200/50" : "from-emerald-500 to-emerald-700 shadow-emerald-200/50"}`}>
            <div className="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={`text-xs font-medium ${periodProfit < 0 ? "text-rose-200" : "text-emerald-200"}`}>Gross Profit</p>
                  <p className={`text-[10px] ${periodProfit < 0 ? "text-rose-100" : "text-emerald-100"}`}>{periodLabel}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className="text-white text-xl font-bold tracking-tight leading-tight mb-0.5">{periodProfit < 0 ? "-" : ""}{formatCurrency(Math.round(Math.abs(periodProfit)))}</p>
              <p className={`text-[11px] ${periodProfit < 0 ? "text-rose-200" : "text-emerald-200"}`}>
                {periodProfitRevenue > 0 ? Math.round((periodProfit / periodProfitRevenue) * 100) : 0}% gross margin
                {periodProfitHasGaps && <span title="Some sold items are missing cost data and were excluded from this calculation"> *</span>}
              </p>
              <div className="mt-2 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitSparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="profitSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ffffff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip content={<SparkTooltip />} />
                    <Area type="monotone" dataKey="v" stroke="#ffffff" strokeWidth={1.5} fill="url(#profitSpark)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Net Profit Card - Gross Profit minus operating expenses for the period */}
          <div role="button" tabIndex={0} onClick={() => setBreakdownCard("netProfit")} onKeyDown={e => e.key === "Enter" && setBreakdownCard("netProfit")} className={`relative overflow-hidden rounded-xl bg-linear-to-br p-4 shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all ${periodNetProfit < 0 ? "from-rose-500 to-rose-700 shadow-rose-200/50" : "from-cyan-500 to-cyan-700 shadow-cyan-200/50"}`}>
            <div className="absolute -right-3 -top-3 w-20 h-20 rounded-full bg-white/10" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className={`text-xs font-medium ${periodNetProfit < 0 ? "text-rose-200" : "text-cyan-200"}`}>{t("dash.Net Profit")}</p>
                  <p className={`text-[10px] ${periodNetProfit < 0 ? "text-rose-100" : "text-cyan-100"}`}>{periodLabel}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <ArrowUpRight className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <p className="text-white text-xl font-bold tracking-tight leading-tight mb-0.5">
                {periodNetProfit < 0 ? "-" : ""}{formatCurrency(Math.round(Math.abs(periodNetProfit)))}
              </p>
              <p className={`text-[11px] ${periodNetProfit < 0 ? "text-rose-200" : "text-cyan-200"}`}>
                {t("dash.After expenses")} - {formatCurrency(Math.round(periodExpensesTotal))}
              </p>
            </div>
          </div>
        </div>

        {/* â"€â"€ Collected vs Outstanding - how much of this period's sales revenue
            actually came in as cash vs is still owed, same period filter as the
            cards above. Updates the moment a payment is collected (amountReceived
            is bumped by fn_create_sale and every Collect Payment action), no
            separate refresh step needed - the source data already moved. Cash In
            is a different question: how much money physically landed in an
            account during this period, from any sale regardless of when it
            happened - a sale from last month paid off today counts toward
            today's Cash In, but toward last month's Collected. â"€â"€ */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button" onClick={() => setBreakdownCard("cashIn")} className="flex items-center gap-3 rounded-xl bg-white border border-emerald-100 px-4 py-3 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-slate-800 leading-none">{formatCurrency(Math.round(periodCashIn))}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">Cash received - {periodLabel}</p>
            </div>
          </button>
          <button type="button" onClick={() => setBreakdownCard("collected")} className="flex items-center gap-3 rounded-xl bg-white border border-emerald-100 px-4 py-3 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-slate-800 leading-none">{formatCurrency(Math.round(periodCollected))}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">Collected this period - {periodLabel}</p>
            </div>
          </button>
          <button type="button" onClick={() => setBreakdownCard("outstanding")} className="flex items-center gap-3 rounded-xl bg-white border border-amber-100 px-4 py-3 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold text-slate-800 leading-none">{formatCurrency(Math.round(periodOutstanding))}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">Pending this period - {periodLabel}</p>
            </div>
          </button>
        </div>
      </div>
      )}

      {/* â"€â"€ Total Inventory Investment - a live snapshot of stock currently held,
          not scoped to the period filter above (it wouldn't make sense to say
          "last month's inventory investment" - what's on the shelf is what it is
          right now). Styled as a plain white stat card, same family as the Stat
          Counters row below, rather than a gradient banner - it's neutral
          snapshot data, not a period result, so it shouldn't compete visually
          with the Financial Overview cards above it â"€â"€ */}
      {canSeeFinancials && (
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button type="button" onClick={() => setBreakdownCard("inventory")} className="flex items-center gap-3 rounded-xl bg-white border border-cyan-100 px-4 py-3 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
          <div className="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-slate-800 leading-none">{formatCurrency(Math.round(totalInventoryInvestment))}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">Inventory Investment - stock on hand</p>
          </div>
        </button>

        <button type="button" onClick={() => setBreakdownCard("payable")} className="flex items-center gap-3 rounded-xl bg-white border border-rose-100 px-4 py-3 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
          <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-slate-800 leading-none">{formatCurrency(Math.round(totalPayableToSuppliers))}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">Payable to Suppliers - we owe</p>
          </div>
        </button>

        <button type="button" onClick={() => setBreakdownCard("receivableCustomers")} className="flex items-center gap-3 rounded-xl bg-white border border-rose-100 px-4 py-3 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
          <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-4 h-4 text-rose-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-slate-800 leading-none">{formatCurrency(Math.round(totalReceivableFromCustomers))}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">Receivable from Customers - owed to us</p>
          </div>
        </button>

        <button type="button" onClick={() => setBreakdownCard("receivablePersons")} className="flex items-center gap-3 rounded-xl bg-white border border-rose-100 px-4 py-3 shadow-sm text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
          <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-4 h-4 text-rose-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold text-slate-800 leading-none">{formatCurrency(Math.round(totalReceivableFromPersons))}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">Receivable from Persons - owed to us</p>
          </div>
        </button>
      </div>
      )}

      {/* â"€â"€ Stat Counters â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
        {([
          { label: t("dash.Total Products"),  value: totalProducts,       icon: Package,      color: "text-indigo-600",    bg: "bg-indigo-50",    border: "border-indigo-100",    href: "/products/mobiles" },
          { label: t("nav.Customers"),        value: customers.length,    icon: Users,        color: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-100",  href: "/customers"        },
          { label: t("dash.Suppliers"),       value: suppliers.length,    icon: Truck,        color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", href: "/suppliers"        },
          { label: t("dash.Total Sales"),     value: totalSalesCount,     icon: ShoppingCart, color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100",   href: "/sales"            },
          { label: t("fin.Total Purchases"),  value: totalPurchasesCount, icon: TrendingUp,   color: "text-rose-600",    bg: "bg-rose-50",    border: "border-rose-100",    href: "/purchases"        },
        ]).map(({ label, value, icon: Icon, color, bg, border, href }, idx) => (
          <Link key={href} href={href} className={idx === 4 ? "col-span-2 sm:col-span-1" : ""}>
            <div className={`flex items-center gap-3 rounded-xl bg-white border ${border} px-3 py-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer shadow-sm h-full ${idx === 4 ? "justify-center sm:justify-start" : ""}`}>
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className={`min-w-0 ${idx === 4 ? "text-center sm:text-left" : ""}`}>
                <p className="text-xl font-bold text-slate-800 leading-none">{value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">{label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* â"€â"€ Revenue Chart - same financial gate as the overview above â"€â"€ */}
      {canSeeFinancials && (
      <Card className="mb-4 border-slate-100 shadow-sm rounded-xl">
        <CardHeader className="pb-0 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800">Revenue & Profit Overview</CardTitle>
              <p className="text-[11px] text-slate-400 mt-0.5">Monthly revenue vs gross profit - last 7 months</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />Profit
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-3 px-2 pb-3">
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={chartData} margin={{ top: 5, right: 16, left: 8, bottom: 0 }}>
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
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}k`}
                width={44}
              />
              <Tooltip content={<RevenueTooltip />} />
              <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2}
                fill="url(#revGrad)" dot={{ r: 2.5, fill: "#3b82f6", strokeWidth: 0 }}
                activeDot={{ r: 4, fill: "#2563eb" }} />
              <Area type="monotone" dataKey="Profit" stroke="#10b981" strokeWidth={2}
                fill="url(#profGrad)" dot={{ r: 2.5, fill: "#10b981", strokeWidth: 0 }}
                activeDot={{ r: 4, fill: "#059669" }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      )}

      {/* â"€â"€ Recent Transactions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-4">

        {/* Recent Sales */}
        <Card className="border-slate-100 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="px-4 py-3 border-b border-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
                  <ShoppingCart className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">Recent Sales</CardTitle>
                  <p className="text-[10px] text-slate-400">Latest transactions</p>
                </div>
              </div>
              <Link href="/sales" className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile card list */}
            <div className="divide-y divide-slate-50 md:hidden">
              {recentSales.map(sale => (
                <Link key={sale.id} href={`/sales/${sale.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/70 active:bg-slate-100 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-indigo-700 text-xs font-bold">
                      {sale.customerName.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-800 text-sm truncate">{sale.customerName}</p>
                      <span className="font-bold text-slate-800 text-sm shrink-0">{formatCurrency(sale.total)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-mono text-[10px] text-slate-400 truncate">{sale.invoiceNumber}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400">{formatDate(sale.date)}</span>
                        <StatusBadge status={sale.status} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Invoice</th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Customer</th>
                    <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Total</th>
                    <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentSales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{sale.invoiceNumber}</span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-800 text-xs truncate max-w-28">{sale.customerName}</p>
                        <p className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(sale.date)}</p>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className="font-bold text-slate-800 text-xs">{formatCurrency(sale.total)}</span>
                      </td>
                      <td className="px-4 py-2">
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
        <Card className="border-slate-100 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="px-4 py-3 border-b border-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shadow-sm shadow-violet-200">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">Recent Purchases</CardTitle>
                  <p className="text-[10px] text-slate-400">Latest purchase orders</p>
                </div>
              </div>
              <Link href="/purchases" className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile card list */}
            <div className="divide-y divide-slate-50 md:hidden">
              {recentPurchases.map(p => (
                <Link key={p.id} href={`/purchases/${p.id}/edit`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/70 active:bg-slate-100 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-violet-700 text-xs font-bold">
                      {p.supplierName.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-800 text-sm truncate">{p.supplierName}</p>
                      <span className="font-bold text-slate-800 text-sm shrink-0">{formatCurrency(p.total)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-mono text-[10px] text-slate-400 truncate">{p.poNumber}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400">{formatDate(p.date)}</span>
                        <StatusBadge status={p.paymentStatus} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">PO #</th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Supplier</th>
                    <th className="text-right px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Total</th>
                    <th className="text-left px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentPurchases.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="font-mono text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{p.poNumber}</span>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-800 text-xs truncate max-w-28">{p.supplierName}</p>
                        <p className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(p.date)}</p>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className="font-bold text-slate-800 text-xs">{formatCurrency(p.total)}</span>
                      </td>
                      <td className="px-4 py-2">
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

      {/* â"€â"€ Bottom row: Top Products + Low Stock â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">

        {/* Top Selling Products */}
        <Card className="border-slate-100 shadow-sm rounded-xl">
          <CardHeader className="pb-1 px-5 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-800">Top Selling Products</CardTitle>
                <p className="text-[11px] text-slate-400">By units sold - all time</p>
              </div>
              <Link href="/products/mobiles" className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-5 pb-4 pt-1">
            <ResponsiveContainer width="100%" height={Math.max(100, topProducts.length * 32)}>
              <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
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
                  width={76}
                  tickFormatter={(v: string) => v.length > 11 ? v.substring(0, 10) + "..." : v}
                />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="units" radius={[0, 5, 5, 0]} maxBarSize={14}>
                  {topProducts.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1 border-t border-slate-50 pt-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
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
        <Card className="border-slate-100 shadow-sm rounded-xl">
          <CardHeader className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shadow-sm shadow-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800">Low Stock Alerts</CardTitle>
                  <p className="text-[10px] text-slate-400">Items needing restock</p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {lowStockItems.length} items
              </span>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-0 space-y-1.5">
            {lowStockItems.length === 0 ? (
              <div className="flex items-center gap-2 py-3 text-emerald-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                All stock levels are healthy
              </div>
            ) : (
              lowStockItems.map(item => (
                <div key={item.id} className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 hover:bg-amber-50/40 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${item.stock === 0 ? "bg-rose-100" : "bg-amber-100"}`}>
                    <Package className={`w-3.5 h-3.5 ${item.stock === 0 ? "text-rose-600" : "text-amber-600"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{item.type}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {item.stock === 0 ? (
                      <span className="text-[10px] font-bold text-white bg-rose-500 px-2 py-0.5 rounded-full">OUT</span>
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

      {breakdownCard && (
        <BreakdownDialog
          title={
            breakdownCard === "payable" ? "Payable to Suppliers"
            : breakdownCard === "receivableCustomers" ? "Receivable from Customers"
            : breakdownCard === "receivablePersons" ? "Receivable from Persons"
            : breakdownCard === "sales" ? "Sales Revenue"
            : breakdownCard === "purchases" ? "Purchases"
            : breakdownCard === "grossProfit" ? "Gross Profit"
            : breakdownCard === "netProfit" ? "Net Profit"
            : breakdownCard === "collected" ? "Collected This Period"
            : breakdownCard === "outstanding" ? "Pending This Period"
            : breakdownCard === "cashIn" ? "Cash Received"
            : "Inventory Investment"
          }
          entityLabel={
            breakdownCard === "payable" ? "Supplier"
            : breakdownCard === "receivableCustomers" ? "Customer"
            : breakdownCard === "receivablePersons" ? "Person"
            : breakdownCard === "sales" ? "Sale"
            : breakdownCard === "purchases" ? "Purchase"
            : breakdownCard === "grossProfit" ? "Sale"
            : breakdownCard === "netProfit" ? "Entry"
            : breakdownCard === "collected" ? "Sale"
            : breakdownCard === "outstanding" ? "Sale"
            : breakdownCard === "cashIn" ? "Payment"
            : "Item"
          }
          rows={
            breakdownCard === "payable" ? payableBySupplier
            : breakdownCard === "receivableCustomers" ? receivableByCustomer
            : breakdownCard === "receivablePersons" ? receivableByPerson
            : breakdownCard === "sales" ? revenueBySale
            : breakdownCard === "purchases" ? purchasesByPO
            : breakdownCard === "grossProfit" ? profitBySale
            : breakdownCard === "netProfit" ? netProfitBreakdown
            : breakdownCard === "collected" ? collectedBySale
            : breakdownCard === "outstanding" ? outstandingBySale
            : breakdownCard === "cashIn" ? cashInByPayment
            : inventoryByItem
          }
          total={
            breakdownCard === "payable" ? totalPayableToSuppliers
            : breakdownCard === "receivableCustomers" ? totalReceivableFromCustomers
            : breakdownCard === "receivablePersons" ? totalReceivableFromPersons
            : breakdownCard === "sales" ? periodRevenue
            : breakdownCard === "purchases" ? periodPurchases
            : breakdownCard === "grossProfit" ? periodProfit
            : breakdownCard === "netProfit" ? periodNetProfit
            : breakdownCard === "collected" ? periodCollected
            : breakdownCard === "outstanding" ? periodOutstanding
            : breakdownCard === "cashIn" ? periodCashIn
            : totalInventoryInvestment
          }
          periodLabel={
            ["sales", "purchases", "grossProfit", "netProfit", "collected", "outstanding", "cashIn"].includes(breakdownCard) ? periodLabel : undefined
          }
          emptyText={
            breakdownCard === "payable" || breakdownCard === "receivableCustomers" || breakdownCard === "receivablePersons"
              ? "Nothing outstanding right now."
              : undefined
          }
          onClose={() => setBreakdownCard(null)}
        />
      )}
    </PageWrapper>
  )
}

// ─── Dashboard breakdown dialog ──────────────────────────────────────────────
// Shows exactly which rows (suppliers, customers, invoices, POs, sale-profits,
// expenses...) make up one of the dashboard card totals, so every number on
// the dashboard can be verified against the individual rows that add up to
// it. periodLabel, when given, shows which date-range filter (This Month,
// This Year, custom range, etc.) the rows were pulled under, since several of
// these cards follow the dashboard's own period selector.
//
// Search and pagination only ever affect which rows are DISPLAYED - the
// header count and the Total footer always reflect the full, unfiltered
// `rows` array, so the verified number on the dashboard card never changes
// just because the user searched or paged.
const BREAKDOWN_PAGE_SIZE = 30

function BreakdownDialog({ title, entityLabel, rows, total, periodLabel, emptyText, onClose }: {
  title: string
  entityLabel: string
  rows: { name: string; amount: number; date?: string }[]
  total: number
  periodLabel?: string
  emptyText?: string
  onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => r.name.toLowerCase().includes(q))
  }, [rows, search])

  useEffect(() => { setPage(1) }, [search])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / BREAKDOWN_PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const paginatedRows = filteredRows.slice((pageSafe - 1) * BREAKDOWN_PAGE_SIZE, pageSafe * BREAKDOWN_PAGE_SIZE)

  if (typeof document === "undefined") return null

  // Portaled straight to document.body - PageWrapper (this page's parent)
  // wraps its children in a div with the animate-fade-in CSS class, which
  // runs a transform-based animation. Per the CSS spec, any transformed
  // ancestor becomes the containing block for position:fixed descendants,
  // so without the portal this dialog would center inside that scrolled
  // dashboard content instead of the actual viewport.
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85dvh] flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {rows.length} {entityLabel.toLowerCase()}{rows.length !== 1 ? "s" : ""} · {formatCurrency(Math.round(total))} total
                {periodLabel && <> · {periodLabel}</>}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {rows.length > 0 && (
            <div className="px-4 pt-3 pb-2 shrink-0 border-b border-slate-100">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${entityLabel.toLowerCase()}s...`}
                className="w-full h-8 text-xs rounded-lg border border-slate-200 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
            </div>
          )}
          <div className="overflow-y-auto flex-1 p-3">
            {rows.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">{emptyText ?? "Nothing to show for this period."}</p>
            ) : filteredRows.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-10">No matches for "{search}".</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {paginatedRows.map((r, idx) => (
                  <div key={`${r.name}-${idx}`} className="flex items-center justify-between px-3.5 py-3 rounded-lg border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors">
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-medium text-slate-700 truncate">{r.name}</p>
                      {r.date && <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(r.date)}</p>}
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${r.amount < 0 ? "text-rose-600" : "text-slate-900"}`}>
                      {r.amount < 0 ? "-" : ""}{formatCurrency(Math.round(Math.abs(r.amount)))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {filteredRows.length > BREAKDOWN_PAGE_SIZE && (
            <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
                className="text-xs font-medium text-slate-500 disabled:text-slate-300 hover:text-indigo-600 disabled:hover:text-slate-300 px-2 py-1"
              >
                ← Prev
              </button>
              <span className="text-[11px] text-slate-400">Page {pageSafe} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
                className="text-xs font-medium text-slate-500 disabled:text-slate-300 hover:text-indigo-600 disabled:hover:text-slate-300 px-2 py-1"
              >
                Next →
              </button>
            </div>
          )}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50 rounded-b-2xl">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</span>
            <span className={`text-base font-bold ${total < 0 ? "text-rose-600" : "text-slate-900"}`}>
              {total < 0 ? "-" : ""}{formatCurrency(Math.round(Math.abs(total)))}
            </span>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

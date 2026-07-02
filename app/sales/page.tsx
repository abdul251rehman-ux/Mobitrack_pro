"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Plus, Eye, Printer, RotateCcw, Search, Filter, ShoppingCart, TrendingUp, Calendar, AlertCircle, Download, FileText, Banknote, CreditCard, Smartphone, Building2, Wallet, BadgeCheck } from "lucide-react"

import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { startOfDay, startOfWeek, startOfMonth, isAfter, parseISO } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { getSales } from "@/lib/api/sales"
import { getTenant } from "@/lib/api/settings"
import { getFinanceAccounts } from "@/lib/api/finance"
import type { ShopInfo } from "@/lib/pdf/invoice"
import { Sale } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"
import { generateInvoicePDF } from "@/lib/pdf/invoice"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { formatCurrency, formatDatePKT, todayPKT } from "@/lib/utils"
import { PAYMENT_METHODS } from "@/lib/constants"

// ── Payment method icon map ───────────────────────────────────────────────────
const PAYMENT_ICONS: Record<string, React.ElementType> = {
  Cash: Banknote,
  Card: CreditCard,
  JazzCash: Smartphone,
  EasyPaisa: Wallet,
  "Bank Transfer": Building2,
}
function PaymentIcon({ method }: { method: string }) {
  const Icon = PAYMENT_ICONS[method] ?? CreditCard
  return <Icon className="w-3.5 h-3.5 text-slate-500" />
}

// ── Today reference (PKT) ─────────────────────────────────────────────────────
const TODAY = new Date()
const TODAY_STR = todayPKT()
const START_OF_TODAY = startOfDay(TODAY)
const START_OF_WEEK = startOfWeek(TODAY, { weekStartsOn: 1 })
const START_OF_MONTH = startOfMonth(TODAY)
const THIS_MONTH_PREFIX = TODAY_STR.substring(0, 7)

export default function SalesPage() {
  const router = useRouter()

  // ── Data state ──────────────────────────────────────────────────────────────
  const [salesList, setSalesList] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [shopInfo, setShopInfo] = useState<ShopInfo>({ shopName: "Mobile Shop", shopAddress: "", shopPhone: "" })

  useEffect(() => {
    async function fetchSales() {
      try {
        setLoading(true)
        const [data, tenant] = await Promise.all([getSales(), getTenant()])
        setSalesList(data)
        if (tenant) setShopInfo({ shopName: tenant.name, shopAddress: tenant.address ?? "", shopPhone: tenant.phone ?? "", shopLogo: tenant.logo ?? "" })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load sales")
      } finally {
        setLoading(false)
      }
    }
    fetchSales()
  }, [])

  // ── Filter state ────────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [customerSearch, setCustomerSearch] = useState("")
  const [modelSearch, setModelSearch] = useState("")
  const [salePriceMin, setSalePriceMin] = useState("")
  const [salePriceMax, setSalePriceMax] = useState("")
  // Universal search — matches invoice#, customer, IMEI, product name, color, price
  const [universalSearch, setUniversalSearch] = useState("")

  // ── Finance accounts for collect payment ────────────────────────────────────
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([])
  useEffect(() => {
    getFinanceAccounts().then(setFinanceAccounts).catch(() => {})
  }, [])

  // ── Collect Payment dialog state ─────────────────────────────────────────────
  const [collectTarget, setCollectTarget] = useState<Sale | null>(null)
  const [collectAccountId, setCollectAccountId] = useState("")
  const [collectAmount, setCollectAmount] = useState("")
  const [collectMethod, setCollectMethod] = useState("Cash")
  const [collecting, setCollecting] = useState(false)

  function openCollect(sale: Sale) {
    const outstanding = sale.total - sale.amountReceived
    setCollectTarget(sale)
    setCollectAmount(String(outstanding > 0 ? outstanding : ""))
    const defaultAcc = financeAccounts.find(a => a.isDefaultCash) ?? financeAccounts[0]
    setCollectAccountId(defaultAcc?.id ?? "")
    setCollectMethod("Cash")
    setCollecting(false)
  }

  async function handleCollectPayment() {
    if (!collectTarget || collecting) return
    const amount = parseFloat(collectAmount)
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }
    if (!collectAccountId) { toast.error("Select a finance account"); return }
    setCollecting(true)
    try {
      const tenantId = await getTenantId()
      const today = todayPKT()
      const outstanding = collectTarget.total - collectTarget.amountReceived
      const newReceived = collectTarget.amountReceived + amount
      const newStatus = newReceived >= collectTarget.total ? "Completed" : "Pending"

      // Update sale amountReceived + status
      await supabase.from("sales")
        .update({ amount_received: newReceived, status: newStatus })
        .eq("id", collectTarget.id)

      // Payment record
      await supabase.from("payments").insert({
        tenant_id: tenantId, date: today, type: "Received",
        entity_type: "Customer",
        entity_id: collectTarget.customerId || null,
        entity_name: collectTarget.customerName,
        reference_type: "Sale",
        reference_number: collectTarget.invoiceNumber,
        amount, method: collectMethod, status: "Completed",
        notes: `Udhaar collection for ${collectTarget.invoiceNumber}`,
      })

      // Finance transaction + update account balance
      await supabase.from("finance_transactions").insert({
        tenant_id: tenantId, date: today, type: "sale_receipt",
        account_id: collectAccountId, amount,
        reference_type: "Sale", reference_number: collectTarget.invoiceNumber,
        description: `Udhaar collected — ${collectTarget.invoiceNumber} (${collectTarget.customerName})`,
      })
      const { data: accRow } = await supabase.from("finance_accounts")
        .select("current_balance").eq("id", collectAccountId).single()
      if (accRow) {
        await supabase.from("finance_accounts")
          .update({ current_balance: (accRow as any).current_balance + amount })
          .eq("id", collectAccountId)
      }

      // Update local state — sale record and finance account balance
      setSalesList(prev => prev.map(s => s.id === collectTarget.id
        ? { ...s, amountReceived: newReceived, status: newStatus as any }
        : s
      ))
      setFinanceAccounts(prev => prev.map(a =>
        a.id === collectAccountId ? { ...a, currentBalance: a.currentBalance + amount } : a
      ))
      toast.success(
        newStatus === "Completed"
          ? `Payment collected — ${collectTarget.invoiceNumber} fully paid!`
          : `${formatCurrency(amount)} collected — ${formatCurrency(collectTarget.total - newReceived)} still outstanding`
      )
      setCollectTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to collect payment")
    } finally {
      setCollecting(false)
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const todaySales = salesList.filter((s) => s.date === TODAY_STR)
    const todayTotal = todaySales.reduce((acc, s) => acc + s.total, 0)

    const weekSales = salesList.filter((s) => {
      const d = parseISO(s.date)
      return isAfter(d, START_OF_WEEK) || d.getTime() === START_OF_WEEK.getTime()
    })
    const weekTotal = weekSales.reduce((acc, s) => acc + s.total, 0)

    const monthSales = salesList.filter((s) => s.date.startsWith(THIS_MONTH_PREFIX))
    const monthTotal = monthSales.reduce((acc, s) => acc + s.total, 0)

    const pendingSales = salesList.filter((s) => s.status === "Pending")
    const pendingTotal = pendingSales.reduce((acc, s) => acc + s.total, 0)

    const completedCount = salesList.filter((s) => s.status === "Completed").length
    const completionRate = salesList.length > 0
      ? Math.round((completedCount / salesList.length) * 100)
      : 0

    const totalRevenue = salesList.reduce((acc, s) => acc + s.total, 0)
    const collectedRevenue = salesList.reduce((acc, s) => acc + s.amountReceived, 0)
    const collectionRate = totalRevenue > 0
      ? Math.round((collectedRevenue / totalRevenue) * 100)
      : 0

    return {
      todayTotal,
      todayCount: todaySales.length,
      weekTotal,
      weekCount: weekSales.length,
      monthTotal,
      monthCount: monthSales.length,
      pendingTotal,
      pendingCount: pendingSales.length,
      completionRate,
      completedCount,
      collectionRate,
      totalRevenue,
      collectedRevenue,
    }
  }, [salesList])

  // ── Filtered data ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const priceMin = salePriceMin ? parseFloat(salePriceMin) : null
    const priceMax = salePriceMax ? parseFloat(salePriceMax) : null
    return salesList.filter((sale) => {
      if (customerSearch && !sale.customerName.toLowerCase().includes(customerSearch.toLowerCase())) return false
      if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) return false
      if (statusFilter !== "all" && sale.status !== statusFilter) return false
      if (dateFrom && sale.date < dateFrom) return false
      if (dateTo && sale.date > dateTo) return false
      if (priceMin !== null && sale.total < priceMin) return false
      if (priceMax !== null && sale.total > priceMax) return false
      if (modelSearch.trim()) {
        const mq = modelSearch.toLowerCase().trim()
        const hasModel = sale.items.some(item => item.productName.toLowerCase().includes(mq))
        if (!hasModel) return false
      }

      if (universalSearch.trim()) {
        const q = universalSearch.toLowerCase().trim()
        const totalStr = sale.total.toString()
        const matchesSale =
          sale.invoiceNumber.toLowerCase().includes(q) ||
          sale.customerName.toLowerCase().includes(q) ||
          (sale.customerPhone && sale.customerPhone.includes(q)) ||
          totalStr.includes(q)
        const matchesItem = sale.items.some(item =>
          item.productName.toLowerCase().includes(q) ||
          (item.productType && item.productType.toLowerCase().includes(q)) ||
          item.unitPrice.toString().includes(q) ||
          item.lineTotal.toString().includes(q)
        )
        if (!matchesSale && !matchesItem) return false
      }

      return true
    })
  }, [salesList, customerSearch, paymentFilter, statusFilter, dateFrom, dateTo, salePriceMin, salePriceMax, modelSearch, universalSearch])

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleReset() {
    setDateFrom("")
    setDateTo("")
    setPaymentFilter("all")
    setStatusFilter("all")
    setCustomerSearch("")
    setModelSearch("")
    setSalePriceMin("")
    setSalePriceMax("")
    setUniversalSearch("")
  }

  // ── Export Excel ─────────────────────────────────────────────────────────────
  async function handleExportExcel() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    const { exportToExcel } = await import("@/lib/excel-export")
    const totalAmount = filtered.reduce((s, sale) => s + sale.total, 0)
    exportToExcel(
      filtered.map((s, i) => ({
        "#": i + 1,
        invoiceNumber: s.invoiceNumber,
        date: s.date,
        customer: s.customerName,
        phone: s.customerPhone,
        items: s.items.length,
        total: s.total,
        payment: s.paymentMethod,
        status: s.status,
      })),
      `Sales-Report-${TODAY_STR}`,
      [
        { key: "#",            header: "#",             width: 5,  align: "center" },
        { key: "invoiceNumber",header: "Invoice #",     width: 18 },
        { key: "date",         header: "Date",          width: 14 },
        { key: "customer",     header: "Customer",      width: 22 },
        { key: "phone",        header: "Phone",         width: 16 },
        { key: "items",        header: "Items",         width: 8,  align: "center" },
        { key: "total",        header: "Total (Rs)",    width: 16, align: "right", numFmt: "#,##0" },
        { key: "payment",      header: "Payment Method",width: 18 },
        { key: "status",       header: "Status",        width: 12 },
      ],
      {
        sheetName: "Sales Report",
        title: "Sales Report — MobiTrack Pro",
        subtitle: `Exported on ${new Date().toLocaleDateString("en-PK")}  ·  ${filtered.length} records`,
        summaryRows: [
          { label: "Total Records", value: filtered.length },
          { label: "Grand Total", value: `Rs ${totalAmount.toLocaleString("en-PK")}` },
        ],
      }
    )
    toast.success(`Exported ${filtered.length} sales to Excel`)
  }

  // ── Export PDF (report) ───────────────────────────────────────────────────────
  async function handleExportPDF() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    const totalAmount = filtered.reduce((s, sale) => s + sale.total, 0)
    let shopName = "MobiTrack Pro", shopAddress = "", shopPhone = ""
    try {
      const { getTenant } = await import("@/lib/api/settings")
      const tenant = await getTenant()
      shopName = tenant.name || shopName
      shopAddress = [tenant.address, tenant.city].filter(Boolean).join(", ")
      shopPhone = tenant.phone || ""
    } catch { /* use defaults */ }
    const { generateReportPDF } = await import("@/lib/pdf/report")
    generateReportPDF({
      shopName, shopAddress, shopPhone,
      title: "Sales Report",
      subtitle: `${filtered.length} records  ·  Total: Rs ${totalAmount.toLocaleString("en-PK")}`,
      columns: [
        { header: "#",             dataKey: "idx",     width: 8,  halign: "center" },
        { header: "Invoice #",     dataKey: "invoice", width: 28 },
        { header: "Date",          dataKey: "date",    width: 24 },
        { header: "Customer",      dataKey: "customer",width: 36 },
        { header: "Items",         dataKey: "items",   width: 10, halign: "center" },
        { header: "Total (Rs)",    dataKey: "total",   width: 24, halign: "right", bold: true },
        { header: "Payment",       dataKey: "payment", width: 24 },
        { header: "Status",        dataKey: "status",  width: 18, halign: "center" },
      ],
      rows: filtered.map((s, i) => ({
        idx:      i + 1,
        invoice:  s.invoiceNumber,
        date:     s.date,
        customer: s.customerName,
        items:    s.items.length,
        total:    `Rs ${s.total.toLocaleString("en-PK")}`,
        payment:  s.paymentMethod,
        status:   s.status,
      })),
      summary: [
        { label: "Total Records", value: `${filtered.length}` },
        { label: "Grand Total",   value: `Rs ${totalAmount.toLocaleString("en-PK")}` },
      ],
      filename: `Sales-Report-${TODAY_STR}`,
      action: "save",
    })
    toast.success(`Sales report PDF downloaded`)
  }

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Sale>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => (
        <Link href={`/sales/${row.original.id}`} className="font-mono text-blue-600 text-sm font-semibold hover:underline">
          {row.original.invoiceNumber}
        </Link>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-slate-600 text-sm whitespace-nowrap">
          {formatDatePKT(row.original.date)}
        </span>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => {
        const name = row.original.customerName
        const phone = row.original.customerPhone
        const avatarColors = [
          "bg-blue-600","bg-violet-600","bg-emerald-600","bg-amber-600","bg-rose-600","bg-cyan-600",
        ]
        const initials = name.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
        const colorIdx = name.charCodeAt(0) % avatarColors.length
        return (
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColors[colorIdx]}`}>
              {initials}
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm leading-tight">{name}</p>
              <p className="text-xs text-slate-400">{phone}</p>
            </div>
          </div>
        )
      },
    },
    {
      id: "items",
      header: "Items",
      cell: ({ row }) => {
        const items = row.original.items
        return (
          <div className="group relative">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold cursor-default">
              {items.length}
            </span>
            {/* Tooltip */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover:block min-w-[200px]">
              <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl space-y-1.5">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between gap-4">
                    <span className="truncate max-w-[130px]">{item.productName}</span>
                    <span className="text-slate-300 whitespace-nowrap">×{item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-900" />
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-bold text-slate-900 text-sm whitespace-nowrap">
          {formatCurrency(row.original.total)}
        </span>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: "Payment",
      cell: ({ row }) => {
        const method = row.original.paymentMethod
        return (
          <span className="flex items-center gap-1.5 text-sm text-slate-700">
            <PaymentIcon method={method} />
            <span>{method}</span>
          </span>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const sale = row.original
        return (
          <div className="flex items-center gap-1">
            {/* View */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
              onClick={() => router.push(`/sales/${sale.id}`)}
              title="View details"
            >
              <Eye className="w-4 h-4" />
            </Button>

            {/* Download PDF */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
              onClick={async () => generateInvoicePDF(sale, shopInfo, "save")}
              title="Download invoice PDF"
            >
              <Download className="w-4 h-4" />
            </Button>
            {/* Print */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              onClick={async () => generateInvoicePDF(sale, shopInfo, "print")}
              title="Print invoice"
            >
              <Printer className="w-4 h-4" />
            </Button>

            {/* Collect Payment — only for Pending (credit/udhaar) */}
            {sale.status === "Pending" && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 text-amber-500 hover:text-emerald-600 hover:bg-emerald-50"
                onClick={() => openCollect(sale)}
                title={`Collect payment — ${formatCurrency(sale.total - sale.amountReceived)} outstanding`}
              >
                <BadgeCheck className="w-4 h-4" />
              </Button>
            )}

            {/* Return/Refund — links to returns page with invoice pre-filled */}
            {sale.status === "Completed" && (
              <Link href={`/returns?invoice=${encodeURIComponent(sale.invoiceNumber)}`}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                  title="Process return / refund"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        )
      },
    },
  ]

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Page Header */}
      <PageHeader
        title="Sales"
        description="Manage and track all sales transactions"
        icon={<ShoppingCart />}
        iconBg="bg-blue-600"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportExcel}>
              <Download className="w-3.5 h-3.5" /> Excel
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportPDF}>
              <FileText className="w-3.5 h-3.5" /> PDF
            </Button>
            <Link href="/sales/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Create New Sale
              </Button>
            </Link>
          </div>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <StatCard
          title="Today's Sales"
          value={formatCurrency(stats.todayTotal)}
          subtext={`${stats.todayCount} transaction${stats.todayCount !== 1 ? "s" : ""}`}
          icon={ShoppingCart}
          iconBg="bg-blue-100"
          gradient="from-blue-50 to-blue-100"
        />
        <StatCard
          title="This Week"
          value={formatCurrency(stats.weekTotal)}
          subtext={`${stats.weekCount} transaction${stats.weekCount !== 1 ? "s" : ""}`}
          icon={TrendingUp}
          iconBg="bg-emerald-100"
          gradient="from-emerald-50 to-emerald-100"
        />
        <StatCard
          title="This Month"
          value={formatCurrency(stats.monthTotal)}
          subtext={`${stats.monthCount} transaction${stats.monthCount !== 1 ? "s" : ""}`}
          icon={Calendar}
          iconBg="bg-purple-100"
          gradient="from-purple-50 to-purple-100"
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(stats.pendingTotal)}
          subtext={`${stats.pendingCount} pending`}
          icon={AlertCircle}
          iconBg="bg-amber-100"
          gradient="from-amber-50 to-amber-100"
        />
        {/* Completion rate */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Completion Rate</p>
          <div className="flex items-end gap-1.5">
            <span className={`text-2xl font-bold leading-none ${stats.completionRate >= 80 ? "text-emerald-600" : stats.completionRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
              {stats.completionRate}%
            </span>
            <span className="text-xs text-slate-400 mb-0.5">completed</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${stats.completionRate >= 80 ? "bg-emerald-500" : stats.completionRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{stats.completedCount} of {salesList.length} sales</p>
        </div>
        {/* Collection rate */}
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Collection Rate</p>
          <div className="flex items-end gap-1.5">
            <span className={`text-2xl font-bold leading-none ${stats.collectionRate >= 80 ? "text-emerald-600" : stats.collectionRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
              {stats.collectionRate}%
            </span>
            <span className="text-xs text-slate-400 mb-0.5">collected</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${stats.collectionRate >= 80 ? "bg-emerald-500" : stats.collectionRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${stats.collectionRate}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{formatCurrency(stats.collectedRevenue)} of {formatCurrency(stats.totalRevenue)}</p>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading sales...</div>
      ) : (
      <>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Filter className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Filters</span>
        </div>

        {/* Universal search */}
        <div className="mb-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Search by invoice #, customer, IMEI, product name, price, color..."
              value={universalSearch}
              onChange={(e) => setUniversalSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {/* Customer search */}
          <div className="flex flex-col gap-1 min-w-0 w-full sm:w-auto sm:min-w-[160px]">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Customer</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <Input
                placeholder="Customer name..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>

          {/* Model search */}
          <div className="flex flex-col gap-1 min-w-0 w-full sm:w-auto sm:min-w-[150px]">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Model / Product</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <Input
                placeholder="e.g. iPhone 15, Samsung..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>

          {/* Sale price range */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sale Amount (Rs)</label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                placeholder="Min"
                value={salePriceMin}
                onChange={(e) => setSalePriceMin(e.target.value)}
                className="h-8 text-xs w-20"
              />
              <span className="text-slate-300 text-xs">—</span>
              <Input
                type="number"
                min="0"
                placeholder="Max"
                value={salePriceMax}
                onChange={(e) => setSalePriceMax(e.target.value)}
                className="h-8 text-xs w-20"
              />
            </div>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date Range</label>
            <div className="flex items-center gap-1">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs w-32" />
              <span className="text-slate-300 text-xs">—</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs w-32" />
            </div>
          </div>

          {/* Payment method */}
          <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[140px]">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Payment</label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    <span className="flex items-center gap-1.5">
                      <PaymentIcon method={m} />
                      {m}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[120px]">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reset */}
          <Button variant="outline" size="sm" className="h-8 self-end text-xs text-slate-600 hover:text-red-600 hover:border-red-300" onClick={handleReset}>
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Mobile Cards (md:hidden) */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">No sales found</div>
        )}
        {filtered.map((sale) => {
          const accentColor =
            sale.status === "Completed"
              ? "bg-emerald-500"
              : sale.status === "Pending"
              ? "bg-amber-400"
              : "bg-red-400"

          const avatarColors = [
            "bg-blue-600","bg-violet-600","bg-emerald-600","bg-amber-600","bg-rose-600","bg-cyan-600",
          ]
          const initials = sale.customerName.split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()
          const colorIdx = sale.customerName.charCodeAt(0) % avatarColors.length

          return (
            <div
              key={sale.id}
              className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              {/* Left accent strip */}
              <div className={`w-1 shrink-0 ${accentColor}`} />

              {/* Card body */}
              <div className="flex-1 p-3 min-w-0">
                {/* Row 1: Invoice # + Status */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-blue-600 text-sm font-bold">{sale.invoiceNumber}</span>
                  <StatusBadge status={sale.status} />
                </div>

                {/* Row 2: Customer avatar + Name + Phone */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColors[colorIdx]}`}>
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate leading-tight">{sale.customerName}</p>
                    <p className="text-xs text-slate-400">{sale.customerPhone}</p>
                  </div>
                </div>

                {/* Row 3: Date + Payment */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {formatDatePKT(sale.date)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                    <PaymentIcon method={sale.paymentMethod} /> {sale.paymentMethod}
                  </span>
                </div>

                {/* Row 4: Total + Items count + outstanding */}
                <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                  <span className="text-base font-bold text-slate-900">{formatCurrency(sale.total)}</span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                    <ShoppingCart className="w-3 h-3" />
                    {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                  </span>
                  {sale.status === "Pending" && sale.total - sale.amountReceived > 0 && (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Udhaar: {formatCurrency(sale.total - sale.amountReceived)}
                    </span>
                  )}
                </div>

                {/* Row 5: Action buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => router.push(`/sales/${sale.id}`)}
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={async () => generateInvoicePDF(sale, shopInfo, "save")}
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50"
                    onClick={async () => generateInvoicePDF(sale, shopInfo, "print")}
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </Button>
                  {sale.status === "Pending" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 font-semibold"
                      onClick={() => openCollect(sale)}
                    >
                      <BadgeCheck className="w-3 h-3" />
                      Collect
                    </Button>
                  )}
                  {sale.status === "Completed" && (
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1.5 text-red-500 border-red-200 hover:bg-red-50" asChild>
                      <Link href={`/returns?invoice=${encodeURIComponent(sale.invoiceNumber)}`}>
                        <RotateCcw className="w-3 h-3" />
                        Refund
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop Table (hidden md:block) */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Quick search..."
        />
      </div>

      </>
      )}

      {/* ── Collect Payment (Udhaar) Dialog ─────────────────────────────────── */}
      <Dialog open={!!collectTarget} onOpenChange={v => { if (!v) setCollectTarget(null) }}>
        <DialogContent className="max-w-sm w-[95vw] p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Collect Payment</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {collectTarget?.invoiceNumber} · {collectTarget?.customerName}
            </DialogDescription>
          </DialogHeader>

          {collectTarget && (
            <div className="space-y-4 py-1">
              {/* Outstanding summary */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-amber-700">Total Bill</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(collectTarget.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-amber-700">Already Paid</span>
                  <span className="font-semibold text-emerald-700">{formatCurrency(collectTarget.amountReceived)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-amber-200 pt-1.5">
                  <span className="text-amber-800">Outstanding (Udhaar)</span>
                  <span className="text-amber-800">{formatCurrency(collectTarget.total - collectTarget.amountReceived)}</span>
                </div>
              </div>

              {/* Amount to collect */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Amount Collecting Now (Rs)</Label>
                <Input
                  type="number"
                  min={0}
                  max={collectTarget.total - collectTarget.amountReceived}
                  value={collectAmount}
                  onChange={e => setCollectAmount(e.target.value)}
                  className="h-9 text-sm font-semibold"
                  autoFocus
                />
                {parseFloat(collectAmount) > 0 && (
                  <p className="text-[11px] text-slate-500">
                    Remaining after this:{" "}
                    <span className={parseFloat(collectAmount) >= collectTarget.total - collectTarget.amountReceived ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                      {formatCurrency(Math.max(0, collectTarget.total - collectTarget.amountReceived - parseFloat(collectAmount)))}
                    </span>
                    {parseFloat(collectAmount) >= collectTarget.total - collectTarget.amountReceived && " — Fully Paid!"}
                  </p>
                )}
              </div>

              {/* Payment method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Payment Method</Label>
                <Select value={collectMethod} onValueChange={setCollectMethod}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Finance account */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Add to Account</Label>
                <Select value={collectAccountId} onValueChange={setCollectAccountId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select account..." /></SelectTrigger>
                  <SelectContent>
                    {financeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCollectTarget(null)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCollectPayment}
              disabled={collecting || !collectAmount || parseFloat(collectAmount) <= 0}
            >
              {collecting ? "Saving..." : "Collect Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

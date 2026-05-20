"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Plus, Eye, Printer, RotateCcw, Search, Filter, ShoppingCart, TrendingUp, Calendar, AlertCircle, Download, FileText, Banknote, CreditCard, Smartphone, Building2, Wallet } from "lucide-react"

import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { startOfDay, startOfWeek, startOfMonth, isAfter, parseISO } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { getSales, updateSaleStatus } from "@/lib/api/sales"
import { getTenant } from "@/lib/api/settings"
import type { ShopInfo } from "@/lib/pdf/invoice"
import { Sale } from "@/data/types"
import { generateInvoicePDF } from "@/lib/pdf/invoice"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select"
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
  // Universal search — matches invoice#, customer, IMEI, product name, color, price
  const [universalSearch, setUniversalSearch] = useState("")

  // ── Dialog state ────────────────────────────────────────────────────────────
  const [refundTarget, setRefundTarget] = useState<Sale | null>(null)

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

    return {
      todayTotal,
      todayCount: todaySales.length,
      weekTotal,
      weekCount: weekSales.length,
      monthTotal,
      monthCount: monthSales.length,
      pendingTotal,
      pendingCount: pendingSales.length,
    }
  }, [salesList])

  // ── Filtered data ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return salesList.filter((sale) => {
      if (customerSearch && !sale.customerName.toLowerCase().includes(customerSearch.toLowerCase())) return false
      if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) return false
      if (statusFilter !== "all" && sale.status !== statusFilter) return false
      if (dateFrom && sale.date < dateFrom) return false
      if (dateTo && sale.date > dateTo) return false

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
  }, [salesList, customerSearch, paymentFilter, statusFilter, dateFrom, dateTo, universalSearch])

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleReset() {
    setDateFrom("")
    setDateTo("")
    setPaymentFilter("all")
    setStatusFilter("all")
    setCustomerSearch("")
    setUniversalSearch("")
  }

  async function handleRefundConfirm() {
    if (!refundTarget) return
    try {
      await updateSaleStatus(refundTarget.id, "Refunded")
      setSalesList((prev) =>
        prev.map((s) => (s.id === refundTarget.id ? { ...s, status: "Refunded" } : s))
      )
      toast.success("Sale refunded successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refund sale")
    }
    setRefundTarget(null)
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
              onClick={() => generateInvoicePDF(sale, shopInfo, "save")}
              title="Download invoice PDF"
            >
              <Download className="w-4 h-4" />
            </Button>
            {/* Print */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => generateInvoicePDF(sale, shopInfo, "print")}
              title="Print invoice"
            >
              <Printer className="w-4 h-4" />
            </Button>

            {/* Refund — only for Completed */}
            {sale.status === "Completed" && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => setRefundTarget(sale)}
                title="Process refund"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
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

      {/* Summary Stat Cards — 4 in one row */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard
          title="Today's Sales"
          value={formatCurrency(stats.todayTotal)}
          subtext={`${stats.todayCount} transaction${stats.todayCount !== 1 ? "s" : ""}`}
          icon={ShoppingCart}
          iconBg="bg-blue-100"
          gradient="from-blue-50 to-blue-100"
        />
        <StatCard
          title="This Week's Sales"
          value={formatCurrency(stats.weekTotal)}
          subtext={`${stats.weekCount} transaction${stats.weekCount !== 1 ? "s" : ""}`}
          icon={TrendingUp}
          iconBg="bg-blue-100"
          gradient="from-emerald-50 to-emerald-100"
        />
        <StatCard
          title="This Month's Sales"
          value={formatCurrency(stats.monthTotal)}
          subtext={`${stats.monthCount} transaction${stats.monthCount !== 1 ? "s" : ""}`}
          icon={Calendar}
          iconBg="bg-blue-100"
          gradient="from-purple-50 to-purple-100"
        />
        <StatCard
          title="Outstanding (Pending)"
          value={formatCurrency(stats.pendingTotal)}
          subtext={`${stats.pendingCount} pending sale${stats.pendingCount !== 1 ? "s" : ""}`}
          icon={AlertCircle}
          iconBg="bg-blue-100"
          gradient="from-amber-50 to-amber-100"
        />
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
          <div className="flex flex-col gap-1 min-w-0 flex-1 w-full sm:w-auto">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Customer Name</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <Input
                placeholder="Filter by customer name..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-7 h-8 text-xs"
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

                {/* Row 4: Total + Items count */}
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-base font-bold text-slate-900">{formatCurrency(sale.total)}</span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                    <ShoppingCart className="w-3 h-3" />
                    {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                  </span>
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
                    onClick={() => generateInvoicePDF(sale, shopInfo, "save")}
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50"
                    onClick={() => generateInvoicePDF(sale, shopInfo, "print")}
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </Button>
                  {sale.status === "Completed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 text-xs gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => setRefundTarget(sale)}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Refund
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

      {/* ── Refund Confirm Dialog ────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!refundTarget}
        onOpenChange={(open) => !open && setRefundTarget(null)}
        title="Process Refund"
        description={`Are you sure you want to refund ${refundTarget?.invoiceNumber}? This will mark the sale as Refunded and cannot be undone.`}
        confirmLabel="Yes, Refund"
        cancelLabel="Cancel"
        onConfirm={handleRefundConfirm}
        variant="destructive"
      />
    </div>
  )
}

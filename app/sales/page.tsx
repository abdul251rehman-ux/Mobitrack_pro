"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Plus, Eye, Printer, RotateCcw, Search, Filter, ShoppingCart, TrendingUp, Calendar, AlertCircle, Download, FileText, Banknote, CreditCard, Smartphone, Building2, Wallet } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { startOfDay, startOfWeek, startOfMonth, isAfter, parseISO } from "date-fns"
import Link from "next/link"

import { getSales, updateSaleStatus } from "@/lib/api/sales"
import { Sale, SaleItem } from "@/data/types"
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDate } from "@/lib/utils"
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

// ── Today reference (dynamic) ─────────────────────────────────────────────────
const TODAY = new Date()
const TODAY_STR = TODAY.toISOString().split("T")[0]
const START_OF_TODAY = startOfDay(TODAY)
const START_OF_WEEK = startOfWeek(TODAY, { weekStartsOn: 1 })
const START_OF_MONTH = startOfMonth(TODAY)
const THIS_MONTH_PREFIX = TODAY_STR.substring(0, 7)

export default function SalesPage() {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [salesList, setSalesList] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSales() {
      try {
        setLoading(true)
        const data = await getSales()
        setSalesList(data)
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

  // ── Dialog state ────────────────────────────────────────────────────────────
  const [viewSale, setViewSale] = useState<Sale | null>(null)
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
      if (customerSearch && !sale.customerName.toLowerCase().includes(customerSearch.toLowerCase())) {
        return false
      }
      if (paymentFilter !== "all" && sale.paymentMethod !== paymentFilter) {
        return false
      }
      if (statusFilter !== "all" && sale.status !== statusFilter) {
        return false
      }
      if (dateFrom && sale.date < dateFrom) {
        return false
      }
      if (dateTo && sale.date > dateTo) {
        return false
      }
      return true
    })
  }, [salesList, customerSearch, paymentFilter, statusFilter, dateFrom, dateTo])

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleReset() {
    setDateFrom("")
    setDateTo("")
    setPaymentFilter("all")
    setStatusFilter("all")
    setCustomerSearch("")
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

  // ── Export CSV ──────────────────────────────────────────────────────────────
  function handleExportCSV() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    const headers = ["Invoice #", "Date", "Customer", "Phone", "Items", "Total", "Payment", "Status"]
    const rows = filtered.map(s => [
      s.invoiceNumber, s.date, s.customerName, s.customerPhone,
      s.items.length, s.total, s.paymentMethod, s.status,
    ])
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `sales-report-${TODAY_STR}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} sales to CSV`)
  }

  // ── Export PDF ──────────────────────────────────────────────────────────────
  function handleExportPDF() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    const totalAmount = filtered.reduce((s, sale) => s + sale.total, 0)
    const html = `<!DOCTYPE html><html><head><title>Sales Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .subtitle { color: #888; font-size: 13px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
        td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background: #f8fafc; }
        .text-right { text-align: right; }
        .total-row { font-weight: 700; background: #eff6ff !important; }
        .footer { margin-top: 20px; font-size: 11px; color: #999; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .completed { background: #dcfce7; color: #166534; }
        .pending { background: #fef9c3; color: #854d0e; }
        .refunded { background: #fee2e2; color: #991b1b; }
      </style></head><body>
      <h1>Sales Report</h1>
      <div class="subtitle">Generated: ${new Date().toLocaleDateString()} · ${filtered.length} transactions · Total: Rs ${totalAmount.toLocaleString()}</div>
      <table>
        <thead><tr><th>#</th><th>Invoice</th><th>Date</th><th>Customer</th><th>Items</th><th class="text-right">Total</th><th>Payment</th><th>Status</th></tr></thead>
        <tbody>
          ${filtered.map((s, i) => `<tr>
            <td>${i + 1}</td><td>${s.invoiceNumber}</td><td>${s.date}</td>
            <td>${s.customerName}</td><td>${s.items.length}</td>
            <td class="text-right">Rs ${s.total.toLocaleString()}</td>
            <td>${s.paymentMethod}</td>
            <td><span class="badge ${s.status.toLowerCase()}">${s.status}</span></td>
          </tr>`).join("")}
          <tr class="total-row"><td colspan="5">Total</td><td class="text-right">Rs ${totalAmount.toLocaleString()}</td><td colspan="2"></td></tr>
        </tbody>
      </table>
      <div class="footer">MobiTrack Pro · Sales Report · Printed on ${new Date().toLocaleString()}</div>
    </body></html>`
    const win = window.open("", "_blank")
    if (win) { win.document.write(html); win.document.close(); win.print() }
  }

  // ── Columns ─────────────────────────────────────────────────────────────────
  const columns: ColumnDef<Sale>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice #",
      cell: ({ row }) => (
        <span className="font-mono text-blue-600 text-sm font-semibold">
          {row.original.invoiceNumber}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-slate-600 text-sm whitespace-nowrap">
          {formatDate(row.original.date)}
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
              onClick={() => setViewSale(sale)}
              title="View details"
            >
              <Eye className="w-4 h-4" />
            </Button>

            {/* Print */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              onClick={() => window.print()}
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
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportCSV}>
              <Download className="w-3.5 h-3.5" /> CSV
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
        <div className="flex flex-wrap items-end gap-2">
          {/* Customer search */}
          <div className="flex flex-col gap-1 min-w-0 flex-1 w-full sm:w-auto">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Customer</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <Input
                placeholder="Search customer name..."
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
                    {formatDate(sale.date)}
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
                    onClick={() => setViewSale(sale)}
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50"
                    onClick={() => window.print()}
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

      {/* ── View Sale Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!viewSale} onOpenChange={(open) => !open && setViewSale(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-blue-600">{viewSale?.invoiceNumber}</span>
              {viewSale && <StatusBadge status={viewSale.status} />}
            </DialogTitle>
            <DialogDescription>
              Sale details — {viewSale ? formatDate(viewSale.date) : ""}
            </DialogDescription>
          </DialogHeader>

          {viewSale && (
            <div className="space-y-5 mt-2">
              {/* Customer info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Customer Name</p>
                  <p className="font-semibold text-slate-800">{viewSale.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Phone</p>
                  <p className="font-semibold text-slate-800">{viewSale.customerPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Date</p>
                  <p className="font-semibold text-slate-800">{formatDate(viewSale.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Payment Method</p>
                  <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <PaymentIcon method={viewSale.paymentMethod} /> {viewSale.paymentMethod}
                  </p>
                </div>
              </div>

              {/* Items table */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Items Sold</h3>

                {/* Mobile card layout */}
                <div className="sm:hidden space-y-2">
                  {viewSale.items.map((item: SaleItem, idx: number) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 text-sm">{item.productName}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{item.productType}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Qty: {item.quantity} × {formatCurrency(item.unitPrice)}</span>
                        {item.discount > 0 && (
                          <span className="text-red-500">− {formatCurrency(item.discount)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="text-xs text-slate-400">Line Total</span>
                        <span className="font-semibold text-sm text-slate-900">{formatCurrency(item.lineTotal)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table layout */}
                <div className="hidden sm:block rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">Product</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">Type</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">Qty</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">Unit Price</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">Discount</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewSale.items.map((item: SaleItem, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-medium text-slate-800">{item.productName}</td>
                          <td className="px-4 py-3 text-slate-500">{item.productType}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-3 text-right text-red-500">
                            {item.discount > 0 ? `− ${formatCurrency(item.discount)}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="rounded-lg border border-slate-200 p-3 sm:p-4 bg-slate-50 space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(viewSale.subtotal)}</span>
                </div>
                {viewSale.discount > 0 && (
                  <div className="flex justify-between text-sm text-red-500">
                    <span>Discount</span>
                    <span>− {formatCurrency(viewSale.discount)}</span>
                  </div>
                )}
                {viewSale.tax > 0 && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Tax</span>
                    <span>{formatCurrency(viewSale.tax)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-base font-bold text-slate-900">
                  <span>Total</span>
                  <span>{formatCurrency(viewSale.total)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Amount Received</span>
                  <span>{formatCurrency(viewSale.amountReceived)}</span>
                </div>
                {viewSale.changeDue > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Change Due</span>
                    <span>{formatCurrency(viewSale.changeDue)}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {viewSale.notes && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-600 mb-1">Notes</p>
                  <p className="text-sm text-slate-700">{viewSale.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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

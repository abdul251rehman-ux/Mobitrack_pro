"use client"

import { useState, useMemo, useEffect } from "react"
import { Printer, Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, FileText, Eye, X, ArrowUpRight, ArrowDownLeft, Hash, Calendar, AlignLeft, Wallet } from "lucide-react"
import { toast } from "sonner"
import { getCustomers } from "@/lib/api/customers"
import { getSales } from "@/lib/api/sales"
import { getPayments } from "@/lib/api/payments"
import type { Customer, Sale, Payment } from "@/data/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type LedgerEntry = {
  id: string
  date: string
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
  type: "sale" | "payment" | "opening"
  customerName?: string
}

const PAGE_SIZE = 15

export default function CustomerLedgerPage() {
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [c, s, p] = await Promise.all([
          getCustomers(),
          getSales(),
          getPayments(),
        ])
        setCustomers(c)
        setSales(s)
        // Filter payments to only customer-received payments
        setCustomerPayments(p.filter((pay) => pay.entityType === "Customer" && pay.type === "Received"))
      } catch (err) {
        toast.error("Failed to load ledger data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [openingBalance, setOpeningBalance] = useState(0)
  const [page, setPage] = useState(1)
  const [drawerEntry, setDrawerEntry] = useState<LedgerEntry | null>(null)

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId)

  // Build all ledger entries — works for all customers or filtered
  const allEntries = useMemo<LedgerEntry[]>(() => {
    const raw: Omit<LedgerEntry, "balance">[] = []

    // Sales → Debit (customer owes us)
    const filteredSales = selectedCustomerId
      ? sales.filter((s) => s.customerId === selectedCustomerId && s.status !== "Refunded")
      : sales.filter((s) => s.status !== "Refunded")

    filteredSales.forEach((s) =>
      raw.push({
        id: s.id, date: s.date, reference: s.invoiceNumber,
        description: `Sale — ${s.items.length} item(s) via ${s.paymentMethod}`,
        debit: s.total, credit: 0, type: "sale",
        customerName: s.customerName,
      })
    )

    // Refunded sales → Credit
    const refundedSales = selectedCustomerId
      ? sales.filter((s) => s.customerId === selectedCustomerId && s.status === "Refunded")
      : sales.filter((s) => s.status === "Refunded")

    refundedSales.forEach((s) =>
      raw.push({
        id: `${s.id}-ref`, date: s.date, reference: s.invoiceNumber,
        description: `Refund — ${s.invoiceNumber}`,
        debit: 0, credit: s.total, type: "payment",
        customerName: s.customerName,
      })
    )

    // Customer payments → Credit
    const filteredPayments = selectedCustomerId
      ? customerPayments.filter((p) => p.entityId === selectedCustomerId)
      : customerPayments

    filteredPayments.forEach((p) =>
      raw.push({
        id: p.id, date: p.date,
        reference: p.referenceNumber || p.id.slice(0, 8),
        description: `Payment Received — ${p.method}${p.notes ? ` (${p.notes})` : ""}`,
        debit: 0, credit: p.amount, type: "payment",
        customerName: p.entityName,
      })
    )

    raw.sort((a, b) => a.date.localeCompare(b.date))

    const result: LedgerEntry[] = []
    let balance = openingBalance

    if (openingBalance !== 0) {
      result.push({
        id: "opening", date: raw[0]?.date ?? "", reference: "—",
        description: "Opening Balance",
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: openingBalance, type: "opening",
      })
    }

    raw.forEach((e) => {
      balance += e.debit - e.credit
      result.push({ ...e, balance })
    })

    return result
  }, [selectedCustomerId, openingBalance, sales, customerPayments])

  // Apply date filter
  const filtered = useMemo(() => {
    return allEntries.filter((e) => {
      if (e.type === "opening") return true
      if (dateFrom && e.date < dateFrom) return false
      if (dateTo && e.date > dateTo) return false
      return true
    })
  }, [allEntries, dateFrom, dateTo])

  const txEntries = filtered.filter((e) => e.type !== "opening")
  const totalDebit = txEntries.reduce((s, e) => s + e.debit, 0)
  const totalCredit = txEntries.reduce((s, e) => s + e.credit, 0)
  const closingBalance = filtered.length > 0 ? filtered[filtered.length - 1].balance : openingBalance

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const accentColor = (type: LedgerEntry["type"]) => {
    if (type === "opening") return "bg-slate-400"
    if (type === "sale") return "bg-blue-500"
    return "bg-emerald-500"
  }

  function buildPrintHtml() {
    const custLabel = selectedCustomer ? selectedCustomer.name : "All Customers"
    const periodLine = dateFrom || dateTo ? "| Period: " + (dateFrom || "Start") + " to " + (dateTo || "Now") : ""
    const colCount = !selectedCustomerId ? 4 : 3
    const rows = filtered.map((e) => {
      const custCol = !selectedCustomerId ? "<td>" + (e.customerName || "—") + "</td>" : ""
      const debitCell = e.debit > 0 ? '<span class="debit">Rs ' + e.debit.toLocaleString() + "</span>" : '<span class="dim">—</span>'
      const creditCell = e.credit > 0 ? '<span class="credit">Rs ' + e.credit.toLocaleString() + "</span>" : '<span class="dim">—</span>'
      const balClass = e.balance > 0 ? "balance-dr" : "balance-cr"
      const balLabel = e.balance > 0 ? " Dr" : e.balance < 0 ? " Cr" : ""
      return "<tr><td>" + formatDate(e.date) + "</td>" + custCol + '<td style="font-family:monospace;color:#94a3b8">' + e.reference + "</td><td>" + e.description + '</td><td class="text-right">' + debitCell + '</td><td class="text-right">' + creditCell + '</td><td class="text-right ' + balClass + '">Rs ' + Math.abs(e.balance).toLocaleString() + balLabel + "</td></tr>"
    }).join("")
    const custHeader = !selectedCustomerId ? "<th>Customer</th>" : ""
    const totalBalClass = closingBalance > 0 ? "balance-dr" : "balance-cr"
    const totalBalLabel = closingBalance > 0 ? " Dr" : closingBalance < 0 ? " Cr" : ""
    return "<!DOCTYPE html><html><head><title>Customer Ledger — " + custLabel + "</title>"
      + "<style>body{font-family:Arial,sans-serif;padding:30px;color:#333;max-width:1100px;margin:0 auto}"
      + "h1{font-size:20px;margin-bottom:2px}.sub{color:#888;font-size:12px;margin-bottom:18px}"
      + ".stats{display:flex;gap:16px;margin-bottom:20px}.stat{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:12px;border-left:4px solid}"
      + ".stat-blue{border-left-color:#3b82f6}.stat-green{border-left-color:#10b981}.stat-amber{border-left-color:#f59e0b}"
      + ".stat-label{font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:700;letter-spacing:0.5px}"
      + ".stat-value{font-size:18px;font-weight:800;margin-top:4px}"
      + "table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}"
      + "th{background:#f1f5f9;padding:8px 10px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}"
      + "td{padding:7px 10px;border-bottom:1px solid #f1f5f9}tr:nth-child(even){background:#f8fafc}"
      + ".text-right{text-align:right}.debit{color:#3b82f6;font-weight:600}.credit{color:#10b981;font-weight:600}"
      + ".balance-dr{color:#f59e0b;font-weight:700}.balance-cr{color:#10b981;font-weight:700}"
      + ".total-row{font-weight:700;background:#eff6ff!important;border-top:2px solid #e2e8f0}"
      + ".footer{margin-top:16px;font-size:10px;color:#aaa}.dim{color:#cbd5e1}</style></head><body>"
      + "<h1>Customer Ledger — " + custLabel + "</h1>"
      + '<div class="sub">Generated: ' + new Date().toLocaleDateString() + " " + periodLine + "</div>"
      + '<div class="stats">'
      + '<div class="stat stat-blue"><div class="stat-label">Total Debit</div><div class="stat-value">Rs ' + totalDebit.toLocaleString() + "</div></div>"
      + '<div class="stat stat-green"><div class="stat-label">Total Credit</div><div class="stat-value">Rs ' + totalCredit.toLocaleString() + "</div></div>"
      + '<div class="stat stat-amber"><div class="stat-label">Net Balance</div><div class="stat-value">Rs ' + Math.abs(closingBalance).toLocaleString() + "</div></div>"
      + "</div>"
      + "<table><thead><tr><th>Date</th>" + custHeader + "<th>Reference</th><th>Description</th>"
      + '<th class="text-right">Debit</th><th class="text-right">Credit</th><th class="text-right">Balance</th></tr></thead>'
      + "<tbody>" + rows + "</tbody>"
      + '<tfoot><tr class="total-row"><td colspan="' + colCount + '" class="text-right">Totals</td>'
      + '<td class="text-right debit">Rs ' + totalDebit.toLocaleString() + "</td>"
      + '<td class="text-right credit">Rs ' + totalCredit.toLocaleString() + "</td>"
      + '<td class="text-right ' + totalBalClass + '">Rs ' + Math.abs(closingBalance).toLocaleString() + totalBalLabel + "</td>"
      + "</tr></tfoot></table>"
      + '<div class="footer">MobiTrack Pro · Customer Ledger · Printed on ' + new Date().toLocaleString() + "</div>"
      + "</body></html>"
  }

  function handlePrintLedger() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    const win = window.open("", "_blank")
    if (win) { win.document.write(buildPrintHtml()); win.document.close(); win.print() }
  }

  function handleExportCSV() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    const headers = ["Date", ...(selectedCustomerId ? [] : ["Customer"]), "Reference", "Description", "Debit", "Credit", "Balance"]
    const rows = filtered.map((e) => [
      e.date, ...(selectedCustomerId ? [] : [e.customerName || ""]),
      e.reference, e.description, e.debit, e.credit, e.balance,
    ])
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => '"' + v + '"').join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "customer-ledger-" + new Date().toISOString().split("T")[0] + ".csv"
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported " + filtered.length + " entries to CSV")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading customer ledger...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">Customer Ledger</h1>
          <p className="text-slate-500 text-xs mt-0.5">View financial records and running balance for any customer</p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handlePrintLedger}
            className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="px-3 py-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Select Customer</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => {
                  setSelectedCustomerId(e.target.value)
                  setPage(1)
                }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          {selectedCustomerId && (
            <div className="mt-2 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Opening Balance (₨)</label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => {
                  setOpeningBalance(Number(e.target.value))
                  setPage(1)
                }}
                className="w-32 h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <span className="text-[10px] text-slate-400">Positive = customer owes · Negative = advance</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Debit</p>
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-lg font-bold text-slate-900 leading-none">{formatCurrency(totalDebit)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Amount charged to customer</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Credit</p>
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-slate-900 leading-none">{formatCurrency(totalCredit)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Payments received</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${closingBalance > 0 ? "border-l-amber-500" : closingBalance < 0 ? "border-l-emerald-500" : "border-l-slate-300"}`}>
          <CardContent className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Net Balance</p>
              {closingBalance > 0 ? <TrendingUp className="w-3.5 h-3.5 text-amber-400" /> : closingBalance < 0 ? <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> : <Minus className="w-3.5 h-3.5 text-slate-400" />}
            </div>
            <p className={`text-lg font-bold leading-none ${closingBalance > 0 ? "text-amber-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
              {formatCurrency(Math.abs(closingBalance))}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {closingBalance > 0 ? "Receivable — customer owes" : closingBalance < 0 ? "Advance paid by customer" : "Account settled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger table / empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-xs text-slate-400">No transactions found for this customer in the selected period.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="px-3 py-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800">
                {selectedCustomer ? `${selectedCustomer.name} — Account Statement` : "All Customers — Account Statement"}
              </CardTitle>
              <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Sale (Dr)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Payment (Cr)
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* ── Mobile card list ──────────────────────────────────── */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginated.map((entry) => (
                <div key={entry.id} className="flex">
                  <div className={`w-1 flex-shrink-0 ${accentColor(entry.type)}`} />
                  <div className="flex-1 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-400">{formatDate(entry.date)}</p>
                        <p className={`text-xs font-medium mt-0.5 leading-snug ${entry.type === "opening" ? "text-slate-500 italic" : "text-slate-800"}`}>
                          {entry.description}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{entry.reference}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {entry.debit > 0 && <p className="text-xs font-semibold text-blue-600">Dr {formatCurrency(entry.debit)}</p>}
                        {entry.credit > 0 && <p className="text-xs font-semibold text-emerald-600">Cr {formatCurrency(entry.credit)}</p>}
                        <p className={`text-[10px] font-bold mt-0.5 ${entry.balance > 0 ? "text-amber-600" : entry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          Bal: {formatCurrency(Math.abs(entry.balance))}{entry.balance > 0 ? " Dr" : entry.balance < 0 ? " Cr" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="px-3 py-2 bg-slate-50 border-t-2 border-slate-200">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-600">Total Debit</span>
                  <span className="font-bold text-blue-700">{formatCurrency(totalDebit)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="font-semibold text-slate-600">Total Credit</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(totalCredit)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Closing Balance</span>
                  <span className={`font-bold ${closingBalance > 0 ? "text-amber-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {formatCurrency(Math.abs(closingBalance))}{closingBalance > 0 ? " Dr" : closingBalance < 0 ? " Cr" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Desktop table ─────────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                    {!selectedCustomerId && (
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Customer</th>
                    )}
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Reference</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-blue-500 uppercase tracking-wider whitespace-nowrap">Debit</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-emerald-500 uppercase tracking-wider whitespace-nowrap">Credit</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Balance</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((entry) => (
                    <tr key={entry.id} className={`hover:bg-slate-50/70 transition-colors ${entry.type === "opening" ? "bg-slate-50 italic" : ""}`}>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-xs">{formatDate(entry.date)}</td>
                      {!selectedCustomerId && (
                        <td className="px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">{entry.customerName || "—"}</td>
                      )}
                      <td className="px-3 py-2 font-mono text-xs text-slate-400 whitespace-nowrap">{entry.reference}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{entry.description}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-blue-600 whitespace-nowrap">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-emerald-600 whitespace-nowrap">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-right text-xs font-bold whitespace-nowrap ${entry.balance > 0 ? "text-amber-600" : entry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        {formatCurrency(Math.abs(entry.balance))}
                        <span className="font-medium ml-0.5">{entry.balance > 0 ? " Dr" : entry.balance < 0 ? " Cr" : ""}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => setDrawerEntry(entry)}
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                          title="View details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <td colSpan={!selectedCustomerId ? 4 : 3} className="px-3 py-2 text-xs text-slate-500 text-right">Totals</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-blue-700 whitespace-nowrap">{formatCurrency(totalDebit)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(totalCredit)}</td>
                    <td className={`px-3 py-2 text-right text-xs font-bold whitespace-nowrap ${closingBalance > 0 ? "text-amber-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                      {formatCurrency(Math.abs(closingBalance))}
                      <span className="font-medium ml-0.5">{closingBalance > 0 ? " Dr" : closingBalance < 0 ? " Cr" : ""}</span>
                    </td>
                    <td className="px-2 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100">
                <p className="text-[10px] text-slate-400">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <span className="text-xs text-slate-500">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* Side Drawer */}
      {drawerEntry && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
            onClick={() => setDrawerEntry(null)}
          />
          <div className="fixed top-0 right-0 h-full w-80 bg-white z-50 shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Drawer header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 ${drawerEntry.type === "sale" ? "bg-blue-50" : drawerEntry.type === "payment" ? "bg-emerald-50" : "bg-slate-50"}`}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${drawerEntry.type === "sale" ? "bg-blue-100" : drawerEntry.type === "payment" ? "bg-emerald-100" : "bg-slate-200"}`}>
                  {drawerEntry.type === "sale"
                    ? <ArrowUpRight className="w-4 h-4 text-blue-600" />
                    : drawerEntry.type === "payment"
                    ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    : <Wallet className="w-4 h-4 text-slate-500" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {drawerEntry.type === "sale" ? "Sale Transaction" : drawerEntry.type === "payment" ? "Payment Received" : "Opening Balance"}
                  </p>
                  <p className="text-[10px] text-slate-400">{drawerEntry.reference}</p>
                </div>
              </div>
              <button onClick={() => setDrawerEntry(null)} className="p-1 rounded-md hover:bg-white/60 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {/* Amount highlight */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                {drawerEntry.debit > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Debit (Dr)</span>
                    <span className="text-base font-bold text-blue-600">{formatCurrency(drawerEntry.debit)}</span>
                  </div>
                )}
                {drawerEntry.credit > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Credit (Cr)</span>
                    <span className="text-base font-bold text-emerald-600">{formatCurrency(drawerEntry.credit)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Running Balance</span>
                  <span className={`text-sm font-bold ${drawerEntry.balance > 0 ? "text-amber-600" : drawerEntry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {formatCurrency(Math.abs(drawerEntry.balance))}
                    <span className="text-xs ml-1">{drawerEntry.balance > 0 ? "Dr" : drawerEntry.balance < 0 ? "Cr" : ""}</span>
                  </span>
                </div>
              </div>

              {/* Details list */}
              <div className="space-y-0 rounded-xl border border-slate-100 overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-white border-b border-slate-100">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Date</p>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">{formatDate(drawerEntry.date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-3 py-2.5 bg-white border-b border-slate-100">
                  <Hash className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Reference</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">{drawerEntry.reference}</p>
                  </div>
                </div>
                {drawerEntry.customerName && (
                  <div className="flex items-start gap-3 px-3 py-2.5 bg-white border-b border-slate-100">
                    <Eye className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Customer</p>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">{drawerEntry.customerName}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 px-3 py-2.5 bg-white">
                  <AlignLeft className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Description</p>
                    <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{drawerEntry.description}</p>
                  </div>
                </div>
              </div>

              {/* Type badge */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Entry Type</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${drawerEntry.type === "sale" ? "bg-blue-100 text-blue-700" : drawerEntry.type === "payment" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {drawerEntry.type === "sale" ? "Sale (Dr)" : drawerEntry.type === "payment" ? "Payment (Cr)" : "Opening Balance"}
                </span>
              </div>
            </div>

            {/* Drawer footer */}
            <div className="px-4 py-3 border-t border-slate-100">
              <button
                onClick={() => setDrawerEntry(null)}
                className="w-full h-8 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

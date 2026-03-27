"use client"

import { useState, useMemo, useEffect } from "react"
import { BookOpen, Printer, Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, FileText } from "lucide-react"
import { toast } from "sonner"
import { getSuppliers } from "@/lib/api/suppliers"
import { getPurchases } from "@/lib/api/purchases"
import { getPayments } from "@/lib/api/payments"
import type { Supplier, Purchase, Payment } from "@/data/types"
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
  type: "purchase" | "payment" | "opening"
  supplierName?: string
}

const PAGE_SIZE = 15

export default function SupplierLedgerPage() {
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [supplierPayments, setSupplierPayments] = useState<Payment[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [sup, pur, pay] = await Promise.all([
          getSuppliers(),
          getPurchases(),
          getPayments(),
        ])
        setSuppliers(sup)
        setPurchases(pur)
        // Filter payments to only supplier-paid payments
        setSupplierPayments(pay.filter((p) => p.entityType === "Supplier" && p.type === "Paid"))
      } catch (err) {
        toast.error("Failed to load supplier ledger data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [openingBalance, setOpeningBalance] = useState(0)
  const [page, setPage] = useState(1)

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId)

  // Build all ledger entries — works for all suppliers or filtered
  const allEntries = useMemo<LedgerEntry[]>(() => {
    const raw: Omit<LedgerEntry, "balance">[] = []

    // Purchases → Credit (we owe supplier)
    const filteredPurchases = selectedSupplierId
      ? purchases.filter((p) => p.supplierId === selectedSupplierId)
      : purchases

    filteredPurchases.forEach((p) => {
      const supName = suppliers.find(s => s.id === p.supplierId)?.companyName || p.supplierName
      raw.push({
        id: p.id,
        date: p.date,
        reference: p.poNumber,
        description: `Purchase — ${p.items.length} item(s) via ${p.paymentMethod}`,
        debit: 0,
        credit: p.total,
        type: "purchase",
        supplierName: supName,
      })
    })

    // Supplier payments → Debit (we paid supplier)
    const filteredPayments = selectedSupplierId
      ? supplierPayments.filter((sp) => sp.entityId === selectedSupplierId)
      : supplierPayments

    filteredPayments.forEach((sp) =>
      raw.push({
        id: sp.id,
        date: sp.date,
        reference: sp.referenceNumber || sp.id.slice(0, 8),
        description: `Payment Made — ${sp.method}${sp.notes ? ` (${sp.notes})` : ""}`,
        debit: sp.amount,
        credit: 0,
        type: "payment",
        supplierName: sp.entityName,
      })
    )

    raw.sort((a, b) => a.date.localeCompare(b.date))

    const result: LedgerEntry[] = []
    let balance = openingBalance

    if (openingBalance !== 0) {
      result.push({
        id: "opening",
        date: raw[0]?.date ?? "",
        reference: "—",
        description: "Opening Balance",
        debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        credit: openingBalance > 0 ? openingBalance : 0,
        balance: openingBalance,
        type: "opening",
      })
    }

    raw.forEach((e) => {
      balance += e.credit - e.debit
      result.push({ ...e, balance })
    })

    return result
  }, [selectedSupplierId, openingBalance, purchases, supplierPayments, suppliers])

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
    if (type === "purchase") return "bg-orange-500"
    return "bg-emerald-500"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading supplier ledger...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Supplier Ledger</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            View financial records and outstanding payables for any supplier
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (filtered.length === 0) { toast.error("No data to export"); return }
              const supplierLabel = selectedSupplier ? selectedSupplier.companyName : "All Suppliers"
              const html = `<!DOCTYPE html><html><head><title>Supplier Ledger — ${supplierLabel}</title>
                <style>
                  body{font-family:Arial,sans-serif;padding:30px;color:#333;max-width:1100px;margin:0 auto}
                  h1{font-size:20px;margin-bottom:2px}
                  .sub{color:#888;font-size:12px;margin-bottom:18px}
                  .stats{display:flex;gap:16px;margin-bottom:20px}
                  .stat{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:12px;border-left:4px solid}
                  .stat-orange{border-left-color:#f97316}
                  .stat-green{border-left-color:#10b981}
                  .stat-red{border-left-color:#ef4444}
                  .stat-label{font-size:10px;text-transform:uppercase;color:#94a3b8;font-weight:700;letter-spacing:0.5px}
                  .stat-value{font-size:18px;font-weight:800;margin-top:4px}
                  table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
                  th{background:#f1f5f9;padding:8px 10px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
                  td{padding:7px 10px;border-bottom:1px solid #f1f5f9}
                  tr:nth-child(even){background:#f8fafc}
                  .text-right{text-align:right}
                  .debit{color:#10b981;font-weight:600}
                  .credit{color:#f97316;font-weight:600}
                  .balance-cr{color:#ef4444;font-weight:700}
                  .balance-dr{color:#10b981;font-weight:700}
                  .total-row{font-weight:700;background:#eff6ff!important;border-top:2px solid #e2e8f0}
                  .footer{margin-top:16px;font-size:10px;color:#aaa}
                  .dim{color:#cbd5e1}
                </style></head><body>
                <h1>Supplier Ledger — ${supplierLabel}</h1>
                <div class="sub">Generated: ${new Date().toLocaleDateString()} ${dateFrom || dateTo ? `| Period: ${dateFrom || "Start"} to ${dateTo || "Now"}` : ""}</div>
                <div class="stats">
                  <div class="stat stat-orange"><div class="stat-label">Total Purchases</div><div class="stat-value">Rs ${totalCredit.toLocaleString()}</div></div>
                  <div class="stat stat-green"><div class="stat-label">Total Paid</div><div class="stat-value">Rs ${totalDebit.toLocaleString()}</div></div>
                  <div class="stat stat-red"><div class="stat-label">Outstanding</div><div class="stat-value">Rs ${Math.abs(closingBalance).toLocaleString()}</div></div>
                </div>
                <table>
                  <thead><tr><th>Date</th>${!selectedSupplierId ? "<th>Supplier</th>" : ""}<th>Reference</th><th>Description</th><th class="text-right">Debit</th><th class="text-right">Credit</th><th class="text-right">Balance</th></tr></thead>
                  <tbody>
                    ${filtered.map(e => `<tr>
                      <td>${formatDate(e.date)}</td>
                      ${!selectedSupplierId ? `<td>${e.supplierName || "—"}</td>` : ""}
                      <td style="font-family:monospace;color:#94a3b8">${e.reference}</td>
                      <td>${e.description}</td>
                      <td class="text-right">${e.debit > 0 ? `<span class="debit">Rs ${e.debit.toLocaleString()}</span>` : '<span class="dim">—</span>'}</td>
                      <td class="text-right">${e.credit > 0 ? `<span class="credit">Rs ${e.credit.toLocaleString()}</span>` : '<span class="dim">—</span>'}</td>
                      <td class="text-right ${e.balance > 0 ? "balance-cr" : "balance-dr"}">Rs ${Math.abs(e.balance).toLocaleString()} ${e.balance > 0 ? "Cr" : e.balance < 0 ? "Dr" : ""}</td>
                    </tr>`).join("")}
                    <tr class="total-row">
                      <td colspan="${!selectedSupplierId ? 4 : 3}" class="text-right">Totals</td>
                      <td class="text-right debit">Rs ${totalDebit.toLocaleString()}</td>
                      <td class="text-right credit">Rs ${totalCredit.toLocaleString()}</td>
                      <td class="text-right ${closingBalance > 0 ? "balance-cr" : "balance-dr"}">Rs ${Math.abs(closingBalance).toLocaleString()} ${closingBalance > 0 ? "Cr" : closingBalance < 0 ? "Dr" : ""}</td>
                    </tr>
                  </tbody>
                </table>
                <div class="footer">MobiTrack Pro · Supplier Ledger · Printed on ${new Date().toLocaleString()}</div>
              </body></html>`
              const win = window.open("", "_blank")
              if (win) { win.document.write(html); win.document.close(); win.print() }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
          <button
            onClick={() => {
              if (filtered.length === 0) { toast.error("No data to export"); return }
              const headers = ["Date", ...(selectedSupplierId ? [] : ["Supplier"]), "Reference", "Description", "Debit", "Credit", "Balance"]
              const rows = filtered.map(e => [
                e.date, ...(selectedSupplierId ? [] : [e.supplierName || ""]),
                e.reference, e.description, e.debit, e.credit, e.balance
              ])
              const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n")
              const blob = new Blob([csv], { type: "text/csv" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url; a.download = `supplier-ledger-${new Date().toISOString().split("T")[0]}.csv`; a.click()
              URL.revokeObjectURL(url)
              toast.success(`Exported ${filtered.length} entries to CSV`)
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Select Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value)
                  setPage(1)
                }}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName} — {s.city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          {/* Opening balance row */}
          {selectedSupplierId && (
            <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
              <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Opening Balance (₨)</label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => {
                  setOpeningBalance(Number(e.target.value))
                  setPage(1)
                }}
                className="w-full sm:w-40 h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
              <span className="text-xs text-slate-400">Positive = we owe supplier, Negative = advance paid</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      {(
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Purchases</p>
                <TrendingUp className="w-4 h-4 text-orange-400" />
              </div>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalCredit)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Amount we owe supplier</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Paid</p>
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalDebit)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Payments made to supplier</p>
            </CardContent>
          </Card>
          <Card
            className={`border-l-4 ${
              closingBalance > 0
                ? "border-l-red-500"
                : closingBalance < 0
                ? "border-l-emerald-500"
                : "border-l-slate-300"
            }`}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding</p>
                {closingBalance > 0 ? (
                  <TrendingUp className="w-4 h-4 text-red-400" />
                ) : closingBalance < 0 ? (
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Minus className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <p
                className={`text-xl font-bold mt-1 ${
                  closingBalance > 0
                    ? "text-red-600"
                    : closingBalance < 0
                    ? "text-emerald-600"
                    : "text-slate-400"
                }`}
              >
                {formatCurrency(Math.abs(closingBalance))}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {closingBalance > 0
                  ? "Payable — we owe supplier"
                  : closingBalance < 0
                  ? "Advance paid to supplier"
                  : "Account settled"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ledger table / empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-slate-400 font-medium">No transactions found for this supplier in the selected period.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">
                {selectedSupplier ? `${selectedSupplier.companyName} — Account Statement` : "All Suppliers — Account Statement"}
              </CardTitle>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                  Purchase (Cr)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Payment (Dr)
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
                  <div className="flex-1 px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-400">{formatDate(entry.date)}</p>
                        <p
                          className={`text-sm font-medium mt-0.5 leading-snug ${
                            entry.type === "opening" ? "text-slate-500 italic" : "text-slate-900"
                          }`}
                        >
                          {entry.description}
                        </p>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">{entry.reference}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {entry.debit > 0 && (
                          <p className="text-sm font-semibold text-emerald-600">Dr {formatCurrency(entry.debit)}</p>
                        )}
                        {entry.credit > 0 && (
                          <p className="text-sm font-semibold text-orange-600">Cr {formatCurrency(entry.credit)}</p>
                        )}
                        <p
                          className={`text-xs font-bold mt-1 ${
                            entry.balance > 0
                              ? "text-red-600"
                              : entry.balance < 0
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }`}
                        >
                          Bal: {formatCurrency(Math.abs(entry.balance))}
                          {entry.balance > 0 ? " Cr" : entry.balance < 0 ? " Dr" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Mobile totals footer */}
              <div className="px-4 py-3 bg-slate-50 border-t-2 border-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-slate-600">Total Purchases</span>
                  <span className="font-bold text-orange-700">{formatCurrency(totalCredit)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="font-semibold text-slate-600">Total Paid</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(totalDebit)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Outstanding</span>
                  <span
                    className={`font-bold ${
                      closingBalance > 0 ? "text-red-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"
                    }`}
                  >
                    {formatCurrency(Math.abs(closingBalance))}
                    {closingBalance > 0 ? " Cr" : closingBalance < 0 ? " Dr" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Desktop table ─────────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    {!selectedSupplierId && (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Supplier
                      </th>
                    )}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-500 uppercase tracking-wider">
                      Debit
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-orange-500 uppercase tracking-wider">
                      Credit
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        entry.type === "opening" ? "bg-slate-50 italic text-slate-500" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {formatDate(entry.date)}
                      </td>
                      {!selectedSupplierId && (
                        <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                          {entry.supplierName || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                        {entry.reference}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{entry.description}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600 whitespace-nowrap">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-orange-600 whitespace-nowrap">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : <span className="text-slate-300">—</span>}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold whitespace-nowrap ${
                          entry.balance > 0
                            ? "text-red-600"
                            : entry.balance < 0
                            ? "text-emerald-600"
                            : "text-slate-400"
                        }`}
                      >
                        {formatCurrency(Math.abs(entry.balance))}
                        <span className="text-xs font-medium ml-1">
                          {entry.balance > 0 ? "Cr" : entry.balance < 0 ? "Dr" : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                    <td colSpan={3} className="px-4 py-3 text-slate-700">
                      Totals
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 whitespace-nowrap">
                      {formatCurrency(totalDebit)}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-700 whitespace-nowrap">
                      {formatCurrency(totalCredit)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right whitespace-nowrap ${
                        closingBalance > 0
                          ? "text-red-600"
                          : closingBalance < 0
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {formatCurrency(Math.abs(closingBalance))}
                      <span className="text-xs ml-1">
                        {closingBalance > 0 ? "Cr" : closingBalance < 0 ? "Dr" : ""}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                  {filtered.length} entries
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <span className="text-xs text-slate-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

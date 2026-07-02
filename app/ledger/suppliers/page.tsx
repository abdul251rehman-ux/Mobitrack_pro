"use client"

import { useState, useMemo, useEffect } from "react"
import { Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, FileText, Eye, X, ArrowUpRight, ArrowDownLeft, Hash, Calendar, AlignLeft, Wallet, Plus, Banknote } from "lucide-react"
import { toast } from "sonner"
import { getSuppliers } from "@/lib/api/suppliers"
import { getPurchases } from "@/lib/api/purchases"
import { getPayments } from "@/lib/api/payments"
import { getFinanceAccounts } from "@/lib/api/finance"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import type { Supplier, Purchase, Payment } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, formatDate, todayPKT } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])

  async function loadAll() {
    try {
      const [sup, pur, pay, accs] = await Promise.all([getSuppliers(), getPurchases(), getPayments(), getFinanceAccounts()])
      setSuppliers(sup)
      setPurchases(pur)
      setSupplierPayments(pay.filter((p) => p.entityType === "Supplier" && p.type === "Paid"))
      setAccounts(accs)
    } catch (err) {
      toast.error("Failed to load supplier ledger data")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  // ── Pay Supplier dialog state ─────────────────────────────────────────────
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("Cash")
  const [payAccountId, setPayAccountId] = useState("")
  const [payDate, setPayDate] = useState(todayPKT())
  const [payNotes, setPayNotes] = useState("")
  const [paying, setPaying] = useState(false)

  function openPayDialog() {
    if (!selectedSupplierId) { toast.error("Select a supplier first"); return }
    setPayAmount(closingBalance > 0 ? String(closingBalance) : "")
    setPayMethod(accounts[0]?.type === "bank" ? "Bank Transfer" : "Cash")
    setPayAccountId(accounts[0]?.id ?? "")
    setPayDate(todayPKT())
    setPayNotes("")
    setPayDialogOpen(true)
  }

  async function handlePaySupplier() {
    if (!selectedSupplierId || !payAmount || parseFloat(payAmount) <= 0) {
      toast.error("Enter a valid amount"); return
    }
    if (!payAccountId) { toast.error("Select a payment account"); return }
    setPaying(true)
    try {
      const tenantId = await getTenantId()
      const amount = parseFloat(payAmount)
      const selectedAccount = accounts.find(a => a.id === payAccountId)
      const refNum = "PAY-SUP-" + Date.now().toString().slice(-8)

      // 1. Insert payment record
      const { error: payErr } = await supabase.from("payments").insert({
        tenant_id: tenantId,
        entity_type: "Supplier",
        entity_id: selectedSupplierId,
        entity_name: selectedSupplier?.companyName ?? "",
        type: "Paid",
        amount,
        method: payMethod,
        account_id: payAccountId,
        reference_number: refNum,
        date: payDate,
        notes: payNotes.trim() || null,
        status: "Completed",
      })
      if (payErr) throw new Error(payErr.message)

      // 2. Deduct from finance account balance
      const { error: accErr } = await supabase
        .from("finance_accounts")
        .update({ current_balance: (selectedAccount?.currentBalance ?? 0) - amount })
        .eq("id", payAccountId)
      if (accErr) throw new Error(accErr.message)

      toast.success(`Payment of ${formatCurrency(amount)} recorded to ${selectedSupplier?.companyName}`)
      setPayDialogOpen(false)
      setLoading(true)
      await loadAll()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment")
    } finally {
      setPaying(false)
    }
  }

  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [openingBalance, setOpeningBalance] = useState(0)
  const [page, setPage] = useState(1)
  const [drawerEntry, setDrawerEntry] = useState<LedgerEntry | null>(null)

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId)

  // All suppliers who have at least one purchase recorded
  const activeSuppliers = useMemo(() => {
    const withPurchases = new Set(purchases.map(p => p.supplierId))
    return suppliers.filter(s => withPurchases.has(s.id))
  }, [suppliers, purchases])

  const allEntries = useMemo<LedgerEntry[]>(() => {
    const raw: Omit<LedgerEntry, "balance">[] = []

    const filteredPurchases = selectedSupplierId
      ? purchases.filter((p) => p.supplierId === selectedSupplierId)
      : purchases

    filteredPurchases.forEach((p) => {
      const supName = suppliers.find((s) => s.id === p.supplierId)?.companyName || p.supplierName
      raw.push({
        id: p.id, date: p.date, reference: p.poNumber,
        description: "Purchase — " + p.items.length + " item(s) via " + p.paymentMethod,
        debit: 0, credit: p.total, type: "purchase", supplierName: supName,
      })
    })

    const filteredPayments = selectedSupplierId
      ? supplierPayments.filter((sp) => sp.entityId === selectedSupplierId)
      : supplierPayments

    filteredPayments.forEach((sp) =>
      raw.push({
        id: sp.id, date: sp.date,
        reference: sp.referenceNumber || sp.id.slice(0, 8),
        description: "Payment Made — " + sp.method + (sp.notes ? " (" + sp.notes + ")" : ""),
        debit: sp.amount, credit: 0, type: "payment", supplierName: sp.entityName,
      })
    )

    const paymentRefNumbers = new Set(filteredPayments.map((sp) => sp.referenceNumber))
    filteredPurchases.forEach((p) => {
      if (p.amountPaid > 0 && !paymentRefNumbers.has(p.poNumber)) {
        const supName = suppliers.find((s) => s.id === p.supplierId)?.companyName || p.supplierName
        raw.push({
          id: "reconcile-" + p.id, date: p.date, reference: p.poNumber,
          description: "Payment Made — " + p.paymentMethod + " (Payment for " + p.poNumber + ")",
          debit: p.amountPaid, credit: 0, type: "payment", supplierName: supName,
        })
      }
    })

    raw.sort((a, b) => a.date.localeCompare(b.date))

    const result: LedgerEntry[] = []
    let balance = openingBalance

    if (openingBalance !== 0) {
      result.push({
        id: "opening", date: raw[0]?.date ?? "", reference: "—",
        description: "Opening Balance",
        debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        credit: openingBalance > 0 ? openingBalance : 0,
        balance: openingBalance, type: "opening",
      })
    }

    raw.forEach((e) => {
      balance += e.credit - e.debit
      result.push({ ...e, balance })
    })

    return result
  }, [selectedSupplierId, openingBalance, purchases, supplierPayments, suppliers])

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

  async function handleExportPDF() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    const [{ generateReportPDF }, { getTenant }] = await Promise.all([
      import("@/lib/pdf/report"),
      import("@/lib/api/settings"),
    ])
    const tenant = await getTenant()
    const supplierLabel = selectedSupplier ? selectedSupplier.companyName : "All Suppliers"
    const periodParts = [dateFrom && "From: " + dateFrom, dateTo && "To: " + dateTo].filter(Boolean)
    const subtitle = [supplierLabel, ...periodParts, filtered.length + " entries"].join(" | ")

    const columns: import("@/lib/pdf/report").ReportColumn[] = [
      { header: "Date",        dataKey: "date",         width: 22, halign: "left" },
      ...(selectedSupplierId ? [] : [{ header: "Supplier", dataKey: "supplierName", width: 32 } as import("@/lib/pdf/report").ReportColumn]),
      { header: "Reference",   dataKey: "reference",    width: 26, halign: "left" },
      { header: "Description", dataKey: "description" },
      { header: "Debit",       dataKey: "debitFmt",     width: 26, halign: "right" },
      { header: "Credit",      dataKey: "creditFmt",    width: 26, halign: "right" },
      { header: "Balance",     dataKey: "balanceFmt",   width: 30, halign: "right", bold: true },
    ]

    const rows = filtered.map((e) => ({
      date:         e.date,
      supplierName: e.supplierName || "—",
      reference:    e.reference,
      description:  e.description,
      debitFmt:     e.debit > 0 ? "Rs " + e.debit.toLocaleString() : "—",
      creditFmt:    e.credit > 0 ? "Rs " + e.credit.toLocaleString() : "—",
      balanceFmt:   "Rs " + Math.abs(e.balance).toLocaleString() + (e.balance > 0 ? " Cr" : e.balance < 0 ? " Dr" : ""),
    }))

    const balLabel = closingBalance > 0 ? " Cr" : closingBalance < 0 ? " Dr" : ""
    generateReportPDF({
      shopName:    tenant?.name    ?? "Mobile Shop",
      shopAddress: [tenant?.address, tenant?.city].filter(Boolean).join(", "),
      shopPhone:   tenant?.phone   ?? "",
      title:       "Supplier Ledger",
      subtitle,
      columns,
      rows,
      summary: [
        { label: "Total Purchases", value: "Rs " + totalCredit.toLocaleString() },
        { label: "Total Paid",      value: "Rs " + totalDebit.toLocaleString() },
        { label: "Outstanding",     value: "Rs " + Math.abs(closingBalance).toLocaleString() + balLabel },
      ],
      filename: "supplier-ledger-" + todayPKT(),
    })
    toast.success("PDF exported")
  }

  async function handleExportExcel() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    const { exportToExcel } = await import("@/lib/excel-export")
    const supplierLabel = selectedSupplier ? selectedSupplier.companyName : "All Suppliers"
    const periodParts = [dateFrom && "From: " + dateFrom, dateTo && "To: " + dateTo].filter(Boolean)
    const subtitle = [supplierLabel, ...periodParts].filter(Boolean).join(" | ")

    const columns: import("@/lib/excel-export").ExcelColumn[] = [
      { key: "date",         header: "Date",        width: 14 },
      ...(selectedSupplierId ? [] : [{ key: "supplierName", header: "Supplier", width: 24 } as import("@/lib/excel-export").ExcelColumn]),
      { key: "reference",    header: "Reference",   width: 18 },
      { key: "description",  header: "Description", width: 36 },
      { key: "debit",        header: "Debit (Rs)",  width: 16, numFmt: "#,##0", align: "right" },
      { key: "credit",       header: "Credit (Rs)", width: 16, numFmt: "#,##0", align: "right" },
      { key: "balance",      header: "Balance (Rs)",width: 18, numFmt: "#,##0", align: "right" },
    ]

    const rows = filtered.map((e) => ({
      date:         e.date,
      supplierName: e.supplierName || "—",
      reference:    e.reference,
      description:  e.description,
      debit:        e.debit || "",
      credit:       e.credit || "",
      balance:      e.balance,
    }))

    const balLabel = closingBalance > 0 ? " Cr" : closingBalance < 0 ? " Dr" : ""
    exportToExcel(rows, "supplier-ledger-" + todayPKT(), columns, {
      sheetName: "Supplier Ledger",
      title: "Supplier Ledger",
      subtitle: subtitle || undefined,
      summaryRows: [
        { label: "Total Purchases", value: totalCredit },
        { label: "Total Paid",      value: totalDebit },
        { label: "Outstanding",     value: "Rs " + Math.abs(closingBalance).toLocaleString() + balLabel },
      ],
    })
    toast.success("Excel exported — " + filtered.length + " entries")
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
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">Supplier Ledger</h1>
          <p className="text-slate-500 text-xs mt-0.5">View financial records and outstanding payables for any supplier</p>
        </div>
        <div className="flex gap-1.5">
          <Button onClick={openPayDialog} size="sm" className="h-8 text-xs gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700">
            <Banknote className="w-3.5 h-3.5" />Pay Supplier
          </Button>
          <button onClick={handleExportPDF} className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
            <FileText className="w-3.5 h-3.5" />PDF
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
            <Download className="w-3.5 h-3.5" />Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="px-3 py-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Select Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => { setSelectedSupplierId(e.target.value); setPage(1) }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Suppliers ({activeSuppliers.length})</option>
                {activeSuppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.companyName} — {s.city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">From Date</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">To Date</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
          </div>
          {selectedSupplierId && (
            <div className="mt-2 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Opening Balance (₨)</label>
              <input type="number" value={openingBalance} onChange={(e) => { setOpeningBalance(Number(e.target.value)); setPage(1) }}
                className="w-32 h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="0" />
              <span className="text-[10px] text-slate-400">Positive = we owe supplier · Negative = advance paid</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Purchases</p>
              <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <p className="text-lg font-bold text-slate-900 leading-none">{formatCurrency(totalCredit)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Amount we owe supplier</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Paid</p>
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-slate-900 leading-none">{formatCurrency(totalDebit)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Payments made to supplier</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${closingBalance > 0 ? "border-l-red-500" : closingBalance < 0 ? "border-l-emerald-500" : "border-l-slate-300"}`}>
          <CardContent className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Outstanding</p>
              {closingBalance > 0 ? <TrendingUp className="w-3.5 h-3.5 text-red-400" /> : closingBalance < 0 ? <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> : <Minus className="w-3.5 h-3.5 text-slate-400" />}
            </div>
            <p className={`text-lg font-bold leading-none ${closingBalance > 0 ? "text-red-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
              {formatCurrency(Math.abs(closingBalance))}
            </p>
            <p className="text-[10px] text-slate-400 mt-1">
              {closingBalance > 0 ? "Payable — we owe supplier" : closingBalance < 0 ? "Advance paid to supplier" : "Account settled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger table / empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-xs text-slate-400">No transactions found for this supplier in the selected period.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="px-3 py-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800">
                {selectedSupplier ? selectedSupplier.companyName + " — Account Statement" : "All Suppliers — Account Statement"}
              </CardTitle>
              <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />Purchase (Cr)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Payment (Dr)
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginated.map((entry) => (
                <div key={entry.id} className="flex">
                  <div className={`w-1 flex-shrink-0 ${accentColor(entry.type)}`} />
                  <div className="flex-1 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-400">{formatDate(entry.date)}</p>
                        <p className={`text-xs font-medium mt-0.5 leading-snug ${entry.type === "opening" ? "text-slate-500 italic" : "text-slate-800"}`}>{entry.description}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{entry.reference}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {entry.debit > 0 && <p className="text-xs font-semibold text-emerald-600">Dr {formatCurrency(entry.debit)}</p>}
                        {entry.credit > 0 && <p className="text-xs font-semibold text-orange-600">Cr {formatCurrency(entry.credit)}</p>}
                        <p className={`text-[10px] font-bold mt-0.5 ${entry.balance > 0 ? "text-red-600" : entry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                          Bal: {formatCurrency(Math.abs(entry.balance))}{entry.balance > 0 ? " Cr" : entry.balance < 0 ? " Dr" : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="px-3 py-2 bg-slate-50 border-t-2 border-slate-200">
                <div className="flex justify-between text-xs"><span className="font-semibold text-slate-600">Total Purchases</span><span className="font-bold text-orange-700">{formatCurrency(totalCredit)}</span></div>
                <div className="flex justify-between text-xs mt-1"><span className="font-semibold text-slate-600">Total Paid</span><span className="font-bold text-emerald-700">{formatCurrency(totalDebit)}</span></div>
                <div className="flex justify-between text-xs mt-1 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">Outstanding</span>
                  <span className={`font-bold ${closingBalance > 0 ? "text-red-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {formatCurrency(Math.abs(closingBalance))}{closingBalance > 0 ? " Cr" : closingBalance < 0 ? " Dr" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                    {!selectedSupplierId && <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Supplier</th>}
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Reference</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-emerald-500 uppercase tracking-wider whitespace-nowrap">Debit</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-orange-500 uppercase tracking-wider whitespace-nowrap">Credit</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Balance</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((entry) => (
                    <tr key={entry.id} className={`hover:bg-slate-50/70 transition-colors ${entry.type === "opening" ? "bg-slate-50 italic" : ""}`}>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-xs">{formatDate(entry.date)}</td>
                      {!selectedSupplierId && <td className="px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">{entry.supplierName || "—"}</td>}
                      <td className="px-3 py-2 font-mono text-xs text-slate-400 whitespace-nowrap">{entry.reference}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{entry.description}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-emerald-600 whitespace-nowrap">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-orange-600 whitespace-nowrap">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`px-3 py-2 text-right text-xs font-bold whitespace-nowrap ${entry.balance > 0 ? "text-red-600" : entry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        {formatCurrency(Math.abs(entry.balance))}
                        <span className="font-medium ml-0.5">{entry.balance > 0 ? " Cr" : entry.balance < 0 ? " Dr" : ""}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setDrawerEntry(entry)} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-orange-600 transition-colors" title="View details">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <td colSpan={!selectedSupplierId ? 4 : 3} className="px-3 py-2 text-xs text-slate-500 text-right">Totals</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(totalDebit)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-orange-700 whitespace-nowrap">{formatCurrency(totalCredit)}</td>
                    <td className={`px-3 py-2 text-right text-xs font-bold whitespace-nowrap ${closingBalance > 0 ? "text-red-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                      {formatCurrency(Math.abs(closingBalance))}
                      <span className="font-medium ml-0.5">{closingBalance > 0 ? " Cr" : closingBalance < 0 ? " Dr" : ""}</span>
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
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <span className="text-xs text-slate-500">{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pay Supplier Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-600" />
              Pay Supplier
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">Paying to</span>
              <span className="text-xs font-bold text-slate-800">{selectedSupplier?.companyName}</span>
            </div>
            {closingBalance > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-red-600">Outstanding balance</span>
                <span className="text-sm font-bold text-red-700">{formatCurrency(closingBalance)}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Amount (₨) <span className="text-red-500">*</span></Label>
              <Input
                type="number" min={1} placeholder="0"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="h-8 text-sm font-semibold"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Method</Label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full h-8 px-2 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                >
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                  <option>JazzCash</option>
                  <option>EasyPaisa</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pay From Account <span className="text-red-500">*</span></Label>
              <select
                value={payAccountId}
                onChange={e => setPayAccountId(e.target.value)}
                className="w-full h-8 px-2 rounded-md border border-slate-200 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="">Select account…</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {formatCurrency(a.currentBalance)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input placeholder="e.g. Cheque #1234, partial payment…" value={payNotes} onChange={e => setPayNotes(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handlePaySupplier} disabled={paying}>
              {paying ? "Recording…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Side Drawer */}
      {drawerEntry && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]" onClick={() => setDrawerEntry(null)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-white z-50 shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            <div className={`flex items-center justify-between px-4 py-3 border-b border-slate-100 ${drawerEntry.type === "purchase" ? "bg-orange-50" : drawerEntry.type === "payment" ? "bg-emerald-50" : "bg-slate-50"}`}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${drawerEntry.type === "purchase" ? "bg-orange-100" : drawerEntry.type === "payment" ? "bg-emerald-100" : "bg-slate-200"}`}>
                  {drawerEntry.type === "purchase"
                    ? <ArrowUpRight className="w-4 h-4 text-orange-600" />
                    : drawerEntry.type === "payment"
                    ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    : <Wallet className="w-4 h-4 text-slate-500" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {drawerEntry.type === "purchase" ? "Purchase Transaction" : drawerEntry.type === "payment" ? "Payment Made" : "Opening Balance"}
                  </p>
                  <p className="text-[10px] text-slate-400">{drawerEntry.reference}</p>
                </div>
              </div>
              <button onClick={() => setDrawerEntry(null)} className="p-1 rounded-md hover:bg-white/60 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                {drawerEntry.debit > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Debit (Dr)</span>
                    <span className="text-base font-bold text-emerald-600">{formatCurrency(drawerEntry.debit)}</span>
                  </div>
                )}
                {drawerEntry.credit > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Credit (Cr)</span>
                    <span className="text-base font-bold text-orange-600">{formatCurrency(drawerEntry.credit)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Running Balance</span>
                  <span className={`text-sm font-bold ${drawerEntry.balance > 0 ? "text-red-600" : drawerEntry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {formatCurrency(Math.abs(drawerEntry.balance))}
                    <span className="text-xs ml-1">{drawerEntry.balance > 0 ? "Cr" : drawerEntry.balance < 0 ? "Dr" : ""}</span>
                  </span>
                </div>
              </div>

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
                {drawerEntry.supplierName && (
                  <div className="flex items-start gap-3 px-3 py-2.5 bg-white border-b border-slate-100">
                    <Eye className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Supplier</p>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">{drawerEntry.supplierName}</p>
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

              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Entry Type</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${drawerEntry.type === "purchase" ? "bg-orange-100 text-orange-700" : drawerEntry.type === "payment" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {drawerEntry.type === "purchase" ? "Purchase (Cr)" : drawerEntry.type === "payment" ? "Payment (Dr)" : "Opening Balance"}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-100">
              <button onClick={() => setDrawerEntry(null)} className="w-full h-8 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

﻿"use client"

import { PermissionGate } from "@/components/shared/permission-gate"
import { useState, useMemo, useEffect } from "react"
import { Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, FileText, Eye, X, ArrowUpRight, ArrowDownLeft, Hash, Calendar, AlignLeft, Wallet, Plus, Banknote, Search } from "lucide-react"
import { toast } from "sonner"
import { getSuppliers } from "@/lib/api/suppliers"
import { getPurchases } from "@/lib/api/purchases"
import { getPayments } from "@/lib/api/payments"
import { getFinanceAccounts } from "@/lib/api/finance"
import { getRebateEntries } from "@/lib/api/rebate"
import type { RebateEntry } from "@/lib/api/rebate"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import type { Supplier, Purchase, Payment } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, formatDate, todayPKT } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/shared/page-header"
import { PageLoader } from "@/components/shared/page-loader"
import { StatCard } from "@/components/shared/stat-card"
import { DetailDrawer, DetailDrawerHeader, DetailDrawerBody, DetailDrawerFooter } from "@/components/shared/detail-drawer"
import { useLanguage } from "@/context/language-context"

type LedgerEntry = {
  id: string
  date: string
  reference: string
  description: string
  debit: number
  credit: number
  /** True purchase/payment amounts before same-day down-payment netting - used for stat totals, not balance */
  grossCredit: number
  grossDebit: number
  balance: number
  type: "purchase" | "payment" | "opening" | "rebate"
  supplierName?: string
  rebateEntry?: RebateEntry
  /** Fully Paid / Partial / Unpaid - purchase rows only, shown in the drawer, not the row text */
  payStatus?: string
  /** Line items - purchase rows only, shown as a proper itemized list in the drawer */
  items?: { name: string; qty: number; unitCost: number; total: number }[]
  /** Position in its source array (already newest-first from the API) - breaks same-date ties by true recency */
  recency: number
}

const PAGE_SIZE = 15

function SupplierLedgerPageInner() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [supplierPayments, setSupplierPayments] = useState<Payment[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [rebates, setRebates] = useState<RebateEntry[]>([])

  async function loadAll() {
    try {
      const [sup, pur, pay, accs, reb] = await Promise.all([getSuppliers(), getPurchases(), getPayments(), getFinanceAccounts(), getRebateEntries()])
      setSuppliers(sup)
      setPurchases(pur)
      setSupplierPayments(pay.filter((p) => p.entityType === "Supplier" && p.type === "Paid"))
      setAccounts(accs)
      setRebates(reb.filter(r => r.status === "posted"))
    } catch (err) {
      toast.error("Failed to load supplier ledger data")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  // â"€â"€ Pay Supplier dialog state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payAccountId, setPayAccountId] = useState("")
  const [payDate, setPayDate] = useState(todayPKT())
  const [payNotes, setPayNotes] = useState("")
  const [paying, setPaying] = useState(false)

  function openPayDialog() {
    if (!selectedSupplierId) { toast.error("Select a supplier first"); return }
    setPayAmount(closingBalance > 0 ? String(closingBalance) : "")
    setPayAccountId(accounts[0]?.id ?? "")
    setPayDate(todayPKT())
    setPayNotes("")
    setPayDialogOpen(true)
  }

  async function handlePaySupplier() {
    if (paying) return
    if (!selectedSupplierId || !payAmount || parseFloat(payAmount) <= 0) {
      toast.error("Enter a valid amount"); return
    }
    if (!payAccountId) { toast.error("Select a payment account"); return }
    setPaying(true)
    try {
      const tenantId = await getTenantId()
      const amount = parseFloat(payAmount)
      const selectedAccount = accounts.find(a => a.id === payAccountId)
      // Method is derived from the chosen account rather than asked separately -
      // the two were previously independent selects with no relation to each other.
      const payMethod = selectedAccount?.type === "bank" ? "Bank Transfer"
        : selectedAccount?.type === "mobile_wallet" ? "Mobile Wallet"
        : "Cash"
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

      // 2. Read FRESH balance from DB (never use stale React state)
      const { data: accRow, error: accReadErr } = await supabase
        .from("finance_accounts")
        .select("current_balance")
        .eq("id", payAccountId)
        .single()
      if (accReadErr || !accRow) throw new Error("Could not read account balance")
      const freshBalance = (accRow as any).current_balance as number
      const newBalance = Math.max(0, freshBalance - amount)

      const { error: accErr } = await supabase
        .from("finance_accounts")
        .update({ current_balance: newBalance })
        .eq("id", payAccountId)
      if (accErr) throw new Error(accErr.message)

      // 3. Write finance_transactions audit row so Finance page shows it
      const { error: ftErr } = await supabase.from("finance_transactions").insert({
        tenant_id: tenantId,
        date: payDate,
        type: "supplier_payment",
        account_id: payAccountId,
        amount,
        reference_type: "Purchase",
        reference_number: refNum,
        description: `Payment to ${selectedSupplier?.companyName ?? "Supplier"}${payNotes ? ` — ${payNotes}` : ""}`,
      })
      if (ftErr) throw new Error(`Finance audit failed: ${ftErr.message}`)

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
  const [search, setSearch] = useState("")
  const [openingBalance, setOpeningBalance] = useState(0)
  const [page, setPage] = useState(1)
  const [drawerEntry, setDrawerEntry] = useState<LedgerEntry | null>(null)

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId)

  // Auto-fill Opening Balance from the supplier's saved value when switching
  // suppliers - still a plain useState the user can type over for a one-off
  // view, same convention as app/ledger/customers/page.tsx.
  useEffect(() => {
    setOpeningBalance(selectedSupplier?.openingBalance ?? 0)
  }, [selectedSupplierId])

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

    const filteredPayments = selectedSupplierId
      ? supplierPayments.filter((sp) => sp.entityId === selectedSupplierId)
      : supplierPayments

    // Every payment against a PO (same-day or later) is folded into that purchase's row rather than
    // shown as its own line - the row then shows just what's paid so far (Dr) and what's still short (Cr),
    // not the full gross purchase value. Only payments with no matching PO keep their own row.
    const downPaymentIds = new Set<string>()
    filteredPurchases.forEach((p) => {
      filteredPayments.forEach((sp) => {
        if (sp.referenceNumber === p.poNumber && !downPaymentIds.has(sp.id)) downPaymentIds.add(sp.id)
      })
    })

    // filteredPurchases/Payments/Rebates are each already newest-first from the API (created_at desc).
    // Record each entry's position in its source array so same-date ties can be broken by true
    // creation recency instead of accidental array order (which .reverse() for display would corrupt).
    filteredPurchases.forEach((p, idx) => {
      const supName = suppliers.find((s) => s.id === p.supplierId)?.companyName || p.supplierName
      const names   = p.items.map(i => i.productName.trim()).filter(Boolean)
      const preview = names.length <= 2
        ? names.join(", ")
        : `${names[0]}, ${names[1]} +${names.length - 2} more`
      const payStatus = p.paymentStatus === "Paid" ? "Fully Paid"
        : p.paymentStatus === "Partial" ? "Partial"
        : "Unpaid"
      raw.push({
        id: p.id, date: p.date, reference: p.poNumber,
        description: preview || `${p.items.length} item(s)`,
        // Net effect on the balance: what's still owed, after every payment made against this PO
        debit: 0, credit: p.balanceDue,
        grossCredit: p.total, grossDebit: p.amountPaid,
        type: "purchase", supplierName: supName, payStatus, recency: -idx,
        items: p.items.map(i => ({ name: i.productName.trim(), qty: i.quantity, unitCost: i.unitCost, total: i.total })),
      })
    })

    filteredPayments.forEach((sp, idx) => {
      if (downPaymentIds.has(sp.id)) return // folded into its purchase row above (still counted in grossDebit there)
      const notes = (sp.notes ?? "")
        .replace(/^(Payment for|Outstanding for)\s+PO-[\w-]+\s*/i, "")
        .replace(/^\(|\)$/g, "")
        .trim()
      raw.push({
        id: sp.id, date: sp.date,
        reference: sp.referenceNumber || sp.id.slice(0, 8),
        description: `Payment to Supplier${notes ? `  ·  ${notes}` : ""}  ·  ${sp.method}`,
        debit: sp.amount, credit: 0,
        grossCredit: 0, grossDebit: sp.amount,
        type: "payment", supplierName: sp.entityName, recency: -idx,
      })
    })

    // Rebate & rate-diff credits (posted only) — reduce payable
    const filteredRebates = selectedSupplierId
      ? rebates.filter(r => r.supplierId === selectedSupplierId)
      : rebates
    filteredRebates.forEach((r, idx) => {
      raw.push({
        id: r.id,
        date: r.postedAt ? r.postedAt.slice(0, 10) : r.createdAt.slice(0, 10),
        reference: r.type === "rebate" ? "REBATE" : "RATE-DIFF",
        description: `${r.type === "rebate" ? "Rebate Credit" : "Rate Difference Credit"} — ${r.model} · ${r.units} units × ${formatCurrency(r.ratePerUnit)}${r.notes ? ` · ${r.notes}` : ""}`,
        debit: r.total, credit: 0,
        grossCredit: 0, grossDebit: r.total,
        type: "rebate" as const,
        supplierName: r.supplierName,
        rebateEntry: r, recency: -idx,
      })
    })

    // Ascending chronological order (oldest first) so the running balance accumulates correctly.
    // Same-date ties: purchases before payments/rebates, then by true creation recency (not array order).
    raw.sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      if (d !== 0) return d
      if (a.type === "purchase" && b.type !== "purchase") return -1
      if (a.type !== "purchase" && b.type === "purchase") return  1
      return a.recency - b.recency
    })

    const result: LedgerEntry[] = []
    let balance = openingBalance

    if (openingBalance !== 0) {
      result.push({
        id: "opening", date: raw[0]?.date ?? "", reference: "-",
        description: "Opening Balance",
        debit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        credit: openingBalance > 0 ? openingBalance : 0,
        grossCredit: 0, grossDebit: 0,
        balance: openingBalance, type: "opening", recency: 0,
      })
    }

    raw.forEach((e) => {
      balance += e.credit - e.debit
      result.push({ ...e, balance })
    })

    return result
  }, [selectedSupplierId, openingBalance, purchases, supplierPayments, suppliers, rebates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allEntries.filter((e) => {
      if (e.type === "opening") return true
      if (dateFrom && e.date < dateFrom) return false
      if (dateTo && e.date > dateTo) return false
      if (q) {
        const haystack = [e.description, e.reference, e.supplierName ?? "", e.date].join(" ").toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [allEntries, dateFrom, dateTo, search])

  const txEntries = filtered.filter((e) => e.type !== "opening")
  const totalDebit = txEntries.filter(e => e.type === "payment").reduce((s, e) => s + e.grossDebit, 0)
    + txEntries.filter(e => e.type === "purchase").reduce((s, e) => s + e.grossDebit, 0)
  const totalRebateCredit = txEntries.filter(e => e.type === "rebate").reduce((s, e) => s + e.debit, 0)
  const totalCredit = txEntries.reduce((s, e) => s + e.grossCredit, 0)
  const closingBalance = filtered.length > 0 ? filtered[filtered.length - 1].balance : openingBalance

  const displayEntries = [...filtered].reverse()
  const totalPages = Math.ceil(displayEntries.length / PAGE_SIZE)
  const paginated = displayEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const accentColor = (type: LedgerEntry["type"]) => {
    if (type === "opening") return "bg-slate-400"
    if (type === "purchase") return "bg-rose-500"
    if (type === "rebate") return "bg-emerald-600"
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
    const periodParts = [
      dateFrom && "From: " + dateFrom,
      dateTo && "To: " + dateTo,
      search && `Search: "${search}"`,
    ].filter(Boolean)
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
      supplierName: e.supplierName || "-",
      reference:    e.reference,
      description:  e.description,
      debitFmt:     e.debit > 0 ? "Rs " + e.debit.toLocaleString() : "-",
      creditFmt:    e.credit > 0 ? "Rs " + e.credit.toLocaleString() : "-",
      balanceFmt:   "Rs " + Math.abs(e.balance).toLocaleString() + (e.balance > 0 ? " Cr" : e.balance < 0 ? " Dr" : ""),
    }))

    const balLabel = closingBalance > 0 ? " Cr" : closingBalance < 0 ? " Dr" : ""
    generateReportPDF({
      shopName:    tenant?.name    ?? "Mobile Shop",
      shopAddress: [tenant?.address, tenant?.city].filter(Boolean).join(", "),
      shopPhone:   tenant?.phone   ?? "",
      shopLogo:    tenant?.logo    || undefined,
      title:       "Supplier Ledger",
      subtitle,
      orientation: "landscape",
      columns,
      rows,
      summary: [
        { label: "Total Purchases",      value: "Rs " + totalCredit.toLocaleString() },
        { label: "Total Paid",           value: "Rs " + totalDebit.toLocaleString() },
        ...(totalRebateCredit > 0 ? [{ label: "Rebates / Rate Diff", value: "Rs " + totalRebateCredit.toLocaleString() }] : []),
        { label: "Outstanding",          value: "Rs " + Math.abs(closingBalance).toLocaleString() + balLabel },
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
      supplierName: e.supplierName || "-",
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
    toast.success("Excel exported - " + filtered.length + " entries")
  }

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title={t("ledger.supplier.Title")}
        description={t("ledger.supplier.Description")}
        action={
          <div className="flex gap-1.5">
            <Button onClick={openPayDialog} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Banknote className="w-3.5 h-3.5" />{t("ledger.supplier.Pay Supplier")}
            </Button>
            <button onClick={handleExportPDF} className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
              <FileText className="w-3.5 h-3.5" />{t("ledger.supplier.PDF")}
            </button>
            <button onClick={handleExportExcel} className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
              <Download className="w-3.5 h-3.5" />{t("ledger.supplier.Excel")}
            </button>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="px-3 py-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              {/* Supplier selector — plain dropdown always visible; highlighted card overlays when selected */}
              <div className="relative">
                {selectedSupplier ? (
                  <div className="flex items-center gap-2.5 rounded-xl border-2 border-orange-400 bg-orange-50 px-3 py-2 shadow-sm shadow-orange-100">
                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center shrink-0 shadow text-white font-bold text-sm">
                      {selectedSupplier.companyName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-orange-900 truncate">{selectedSupplier.companyName}</p>
                      <p className="text-[10px] text-orange-500">{[selectedSupplier.city, selectedSupplier.phone].filter(Boolean).join(" · ")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedSupplierId(""); setPage(1) }}
                      className="shrink-0 p-1 rounded-full hover:bg-orange-200 text-orange-400 hover:text-orange-700 transition-colors"
                      title={t("ledger.supplier.Clear selection")}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border-2 border-orange-300 bg-orange-50/40 overflow-hidden shadow-sm shadow-orange-100">
                    <div className="flex items-center gap-2 px-2.5 py-1 border-b border-orange-100 bg-orange-100/60">
                      <div className="w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center shrink-0">
                        <span className="text-white text-[8px] font-bold">S</span>
                      </div>
                      <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">{t("ledger.supplier.Select Supplier")}</span>
                    </div>
                    <Select
                      value={selectedSupplierId || "__all"}
                      onValueChange={(v) => { setSelectedSupplierId(v === "__all" ? "" : v); setPage(1) }}
                    >
                      <SelectTrigger className="h-8 px-2.5 text-xs bg-transparent border-0 text-slate-700 font-medium focus:ring-0 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all">{t("ledger.supplier.All Suppliers")} ({activeSuppliers.length})</SelectItem>
                        {activeSuppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.companyName} - {s.city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.supplier.From Date")}</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  className="w-full h-8 pl-7 pr-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.supplier.To Date")}</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  className="w-full h-8 pl-7 pr-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
              </div>
            </div>
          </div>
          {/* Search */}
          <div className="mt-2 pt-2 border-t border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder={t("ledger.supplier.Search placeholder")}
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {selectedSupplierId && (
            <div className="mt-2 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{t("ledger.supplier.Opening Balance")}</label>
              <MoneyInput value={openingBalance} onChange={(v) => { setOpeningBalance(Number(v)); setPage(1) }}
                className="w-32 h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" placeholder="0" />
              <span className="text-[10px] text-slate-400">{t("ledger.supplier.Opening hint")}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
        <StatCard
          title={t("ledger.supplier.Total Purchases")} value={formatCurrency(totalCredit)}
          subtext={t("ledger.supplier.We bought")}
          icon={TrendingUp} iconBg="bg-rose-100"
        />
        <StatCard
          title={t("ledger.supplier.Total Paid")} value={formatCurrency(totalDebit)}
          subtext={t("ledger.supplier.Payments made")}
          icon={TrendingDown} iconBg="bg-emerald-100"
        />
        <StatCard
          title={t("ledger.supplier.Outstanding")} value={formatCurrency(Math.abs(closingBalance))}
          subtext={closingBalance > 0 ? t("ledger.supplier.We need to pay") : closingBalance < 0 ? t("ledger.supplier.We paid extra") : t("ledger.supplier.Account settled")}
          icon={closingBalance > 0 ? TrendingUp : closingBalance < 0 ? TrendingDown : Minus}
          iconBg={closingBalance > 0 ? "bg-rose-100" : closingBalance < 0 ? "bg-emerald-100" : "bg-slate-100"}
          valueClassName={closingBalance > 0 ? "text-rose-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}
        />
      </div>

      {/* Ledger table / empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-xs text-slate-400">{t("ledger.supplier.No tx")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="px-3 py-2 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-slate-800 truncate min-w-0">
                {selectedSupplier ? selectedSupplier.companyName + " - " + t("ledger.supplier.Account Statement") : t("ledger.supplier.All Suppliers Statement") + " - " + t("ledger.supplier.Account Statement")}
              </CardTitle>
              <div className="hidden sm:flex items-center gap-2.5 text-[10px] text-slate-400 shrink-0">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />{t("ledger.supplier.Purchase Cr")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{t("ledger.supplier.Payment Dr")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />{t("ledger.supplier.Rebate Dr")}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginated.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setDrawerEntry(entry)}
                  className="flex w-full text-left hover:bg-slate-50/70 active:bg-slate-100 transition-colors"
                >
                  <div className={`w-1 shrink-0 ${accentColor(entry.type)}`} />
                  <div className="flex-1 min-w-0 px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-400">{formatDate(entry.date)}</p>
                      {entry.payStatus && entry.payStatus !== "Fully Paid" && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {entry.payStatus === "Partial" ? t("status.Partial") : t("status.Unpaid")}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs font-medium leading-snug truncate ${entry.type === "opening" ? "text-slate-500 italic" : "text-slate-800"}`}>
                      {entry.description}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">{entry.reference}</p>
                    <div className="flex items-center justify-between gap-2 pt-1 mt-1 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {entry.debit > 0 && <span className="text-emerald-600">{t("ledger.supplier.Dr")} {formatCurrency(entry.debit)}</span>}
                        {entry.credit > 0 && <span className="text-rose-600">{t("ledger.supplier.Cr")} {formatCurrency(entry.credit)}</span>}
                      </div>
                      <p className={`text-xs font-bold shrink-0 ${entry.balance > 0 ? "text-rose-600" : entry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        {formatCurrency(Math.abs(entry.balance))}{entry.balance > 0 ? ` ${t("ledger.supplier.Cr")}` : entry.balance < 0 ? ` ${t("ledger.supplier.Dr")}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center pr-2 shrink-0">
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </button>
              ))}
              <div className="px-3 py-2 bg-slate-50 border-t-2 border-slate-200">
                <div className="flex justify-between text-xs"><span className="font-semibold text-slate-600">{t("ledger.supplier.Total Purchases")}</span><span className="font-bold text-rose-700">{formatCurrency(totalCredit)}</span></div>
                <div className="flex justify-between text-xs mt-1"><span className="font-semibold text-slate-600">{t("ledger.supplier.Total Paid")}</span><span className="font-bold text-emerald-700">{formatCurrency(totalDebit)}</span></div>
                {totalRebateCredit > 0 && <div className="flex justify-between text-xs mt-1"><span className="font-semibold text-slate-600">{t("ledger.supplier.Rebates")}</span><span className="font-bold text-emerald-700">{formatCurrency(totalRebateCredit)}</span></div>}
                <div className="flex justify-between text-xs mt-1 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">{t("ledger.supplier.Outstanding")}</span>
                  <span className={`font-bold ${closingBalance > 0 ? "text-rose-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {formatCurrency(Math.abs(closingBalance))}{closingBalance > 0 ? ` ${t("ledger.supplier.Cr")}` : closingBalance < 0 ? ` ${t("ledger.supplier.Dr")}` : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.supplier.Date")}</th>
                    {!selectedSupplierId && <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.supplier.Supplier col")}</th>}
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.supplier.Reference")}</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("ledger.supplier.Description col")}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-emerald-500 uppercase tracking-wider whitespace-nowrap">{t("ledger.supplier.Debit")}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-rose-500 uppercase tracking-wider whitespace-nowrap">{t("ledger.supplier.Credit")}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.supplier.Balance")}</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((entry) => (
                    <tr key={entry.id} className={`hover:bg-slate-50/70 transition-colors ${entry.type === "opening" ? "bg-slate-50 italic" : ""}`}>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-xs">{formatDate(entry.date)}</td>
                      {!selectedSupplierId && <td className="px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">{entry.supplierName || "-"}</td>}
                      <td className="px-3 py-2 font-mono text-xs text-slate-400 whitespace-nowrap">{entry.reference}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {entry.description}
                        {entry.payStatus && entry.payStatus !== "Fully Paid" && (
                          <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{entry.payStatus === "Partial" ? t("status.Partial") : t("status.Unpaid")}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium whitespace-nowrap">
                        {entry.debit > 0
                          ? <span className={entry.type === "rebate" ? "text-emerald-700 font-bold" : "text-emerald-600"}>{formatCurrency(entry.debit)}</span>
                          : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-rose-600 whitespace-nowrap">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className={`px-3 py-2 text-right text-xs font-bold whitespace-nowrap ${entry.balance > 0 ? "text-rose-600" : entry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        {formatCurrency(Math.abs(entry.balance))}
                        <span className="font-medium ml-0.5">{entry.balance > 0 ? ` ${t("ledger.supplier.Cr")}` : entry.balance < 0 ? ` ${t("ledger.supplier.Dr")}` : ""}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setDrawerEntry(entry)} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors" title={t("ledger.supplier.View details")}>
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {totalRebateCredit > 0 && (
                    <tr className="border-t border-slate-100 bg-emerald-50/60">
                      <td colSpan={!selectedSupplierId ? 4 : 3} className="px-3 py-1.5 text-xs text-emerald-600 text-right font-medium">{t("ledger.supplier.Rebates")}</td>
                      <td className="px-3 py-1.5 text-right text-xs font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(totalRebateCredit)}</td>
                      <td className="px-3 py-1.5 text-right text-xs text-slate-300">-</td>
                      <td colSpan={2} />
                    </tr>
                  )}
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <td colSpan={!selectedSupplierId ? 4 : 3} className="px-3 py-2 text-xs text-slate-500 text-right">{t("ledger.supplier.Totals")}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(totalDebit + totalRebateCredit)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-rose-700 whitespace-nowrap">{formatCurrency(totalCredit)}</td>
                    <td className={`px-3 py-2 text-right text-xs font-bold whitespace-nowrap ${closingBalance > 0 ? "text-rose-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                      {formatCurrency(Math.abs(closingBalance))}
                      <span className="font-medium ml-0.5">{closingBalance > 0 ? ` ${t("ledger.supplier.Cr")}` : closingBalance < 0 ? ` ${t("ledger.supplier.Dr")}` : ""}</span>
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
                  {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} {t("sale.list.of")} {filtered.length}
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
        <DialogContent className="w-[96vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Banknote className="w-4 h-4 text-emerald-600" />
              {t("ledger.supplier.Pay Supplier")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-slate-500">{t("ledger.supplier.Paying to")}</span>
              <span className="text-xs font-bold text-slate-800">{selectedSupplier?.companyName}</span>
            </div>
            {closingBalance > 0 && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-rose-600">{t("ledger.supplier.Outstanding balance")}</span>
                <span className="text-sm font-bold text-rose-700">{formatCurrency(closingBalance)}</span>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{t("ledger.supplier.Amount")}<span className="text-rose-500">*</span></Label>
              <MoneyInput
                min={1} placeholder="0"
                value={payAmount}
                onChange={v => setPayAmount(v)}
                className="h-8 text-sm font-semibold"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("ledger.supplier.Date")}</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("ledger.supplier.Payment Account")} <span className="text-rose-500">*</span></Label>
              <Select value={payAccountId} onValueChange={setPayAccountId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("ledger.supplier.Select account")} /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} - {formatCurrency(a.currentBalance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("ledger.supplier.Notes optional")}</Label>
              <Input placeholder={t("ledger.supplier.Notes placeholder")} value={payNotes} onChange={e => setPayNotes(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPayDialogOpen(false)}>{t("ledger.supplier.Cancel")}</Button>
            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={handlePaySupplier} disabled={paying}>
              {paying ? t("ledger.supplier.Recording") : t("ledger.supplier.Record Payment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Side Drawer */}
      <DetailDrawer open={!!drawerEntry} onOpenChange={(open) => !open && setDrawerEntry(null)}>
        {drawerEntry && (
          <>
            <DetailDrawerHeader
              icon={
                drawerEntry.type === "purchase" ? <ArrowUpRight />
                : drawerEntry.type === "payment" ? <ArrowDownLeft />
                : drawerEntry.type === "rebate" ? <TrendingDown />
                : <Wallet />
              }
              iconBg={drawerEntry.type === "purchase" ? "bg-rose-100" : drawerEntry.type === "payment" ? "bg-emerald-100" : drawerEntry.type === "rebate" ? "bg-emerald-100" : "bg-slate-200"}
              iconColor={drawerEntry.type === "purchase" ? "text-rose-600" : drawerEntry.type === "payment" ? "text-emerald-600" : drawerEntry.type === "rebate" ? "text-emerald-600" : "text-slate-500"}
              headerBg={drawerEntry.type === "purchase" ? "bg-rose-50" : drawerEntry.type === "payment" ? "bg-emerald-50" : drawerEntry.type === "rebate" ? "bg-emerald-50" : "bg-slate-50"}
              title={drawerEntry.type === "purchase" ? t("ledger.supplier.Purchase Transaction") : drawerEntry.type === "payment" ? t("ledger.supplier.Payment Made") : drawerEntry.type === "rebate" ? (drawerEntry.rebateEntry?.type === "rebate" ? t("ledger.supplier.Rebate Credit") : t("ledger.supplier.Rate Difference Credit")) : t("ledger.supplier.Opening Balance")}
              subtitle={drawerEntry.reference}
            />

            <DetailDrawerBody>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                {drawerEntry.type === "purchase" && drawerEntry.grossDebit > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t("ledger.supplier.Purchase Value")}</span>
                      <span className="text-sm font-semibold text-slate-600">{formatCurrency(drawerEntry.grossCredit)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t("ledger.supplier.Paid at Purchase")}</span>
                      <span className="text-sm font-semibold text-emerald-600">- {formatCurrency(drawerEntry.grossDebit)}</span>
                    </div>
                  </>
                )}
                {drawerEntry.debit > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      {drawerEntry.type === "rebate" ? t("ledger.supplier.Rebate Credit reduces") : t("ledger.supplier.Debit Dr")}
                    </span>
                    <span className="text-base font-bold text-emerald-600">{formatCurrency(drawerEntry.debit)}</span>
                  </div>
                )}
                {drawerEntry.credit > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                      {drawerEntry.type === "purchase" && drawerEntry.grossDebit > 0 ? t("ledger.supplier.Net Due Cr") : t("ledger.supplier.Credit Cr")}
                    </span>
                    <span className="text-base font-bold text-rose-600">{formatCurrency(drawerEntry.credit)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t("ledger.supplier.Running Balance")}</span>
                  <span className={`text-sm font-bold ${drawerEntry.balance > 0 ? "text-rose-600" : drawerEntry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {formatCurrency(Math.abs(drawerEntry.balance))}
                    <span className="text-xs ml-1">{drawerEntry.balance > 0 ? t("ledger.supplier.Cr") : drawerEntry.balance < 0 ? t("ledger.supplier.Dr") : ""}</span>
                  </span>
                </div>
              </div>

              <div className="space-y-0 rounded-xl border border-slate-100 overflow-hidden">
                <div className="flex items-start gap-3 px-3 py-2.5 bg-white border-b border-slate-100">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t("ledger.supplier.Date")}</p>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">{formatDate(drawerEntry.date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 px-3 py-2.5 bg-white border-b border-slate-100">
                  <Hash className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t("ledger.supplier.Reference")}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">{drawerEntry.reference}</p>
                  </div>
                </div>
                {drawerEntry.supplierName && (
                  <div className="flex items-start gap-3 px-3 py-2.5 bg-white border-b border-slate-100">
                    <Eye className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t("ledger.supplier.Supplier")}</p>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">{drawerEntry.supplierName}</p>
                    </div>
                  </div>
                )}
                <div className={`flex items-start gap-3 px-3 py-2.5 bg-white ${drawerEntry.payStatus ? "border-b border-slate-100" : ""}`}>
                  <AlignLeft className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t("ledger.supplier.Description col")}</p>
                    {drawerEntry.items && drawerEntry.items.length > 0 ? (
                      <div className="mt-1.5 rounded-lg border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                        {drawerEntry.items.map((it, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 px-2.5 py-1.5 bg-slate-50/60">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">{it.name}</p>
                              <p className="text-[10px] text-slate-400 tabular-nums">{it.qty} × {formatCurrency(it.unitCost)}</p>
                            </div>
                            <span className="text-xs font-semibold text-slate-600 tabular-nums shrink-0">{formatCurrency(it.total)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{drawerEntry.description}</p>
                    )}
                  </div>
                </div>
                {drawerEntry.payStatus && (
                  <div className="flex items-start gap-3 px-3 py-2.5 bg-white">
                    <Wallet className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t("ledger.supplier.Payment Status")}</p>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        drawerEntry.payStatus === "Fully Paid" ? "bg-emerald-100 text-emerald-700"
                        : drawerEntry.payStatus === "Partial" ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700"
                      }`}>{drawerEntry.payStatus === "Fully Paid" ? t("ledger.supplier.Fully Paid") : drawerEntry.payStatus === "Partial" ? t("ledger.supplier.Partial") : t("status.Unpaid")}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Rebate detail breakdown */}
              {drawerEntry.type === "rebate" && drawerEntry.rebateEntry && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-2">{t("ledger.supplier.Rebate Details")}</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">{t("ledger.supplier.Model")}</span>
                    <span className="font-semibold text-slate-700">{drawerEntry.rebateEntry.model}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">{t("ledger.supplier.Units")}</span>
                    <span className="font-semibold text-slate-700">{drawerEntry.rebateEntry.units}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">{t("ledger.supplier.Rate per Unit")}</span>
                    <span className="font-semibold text-slate-700">{formatCurrency(drawerEntry.rebateEntry.ratePerUnit)}</span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-emerald-200 pt-1.5 mt-1.5">
                    <span className="font-bold text-emerald-700">{t("ledger.supplier.Total Credit")}</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(drawerEntry.rebateEntry.total)}</span>
                  </div>
                  {drawerEntry.rebateEntry.notes && (
                    <p className="text-[10px] text-slate-400 pt-1">{drawerEntry.rebateEntry.notes}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{t("ledger.supplier.Entry Type")}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${drawerEntry.type === "purchase" ? "bg-rose-100 text-rose-700" : drawerEntry.type === "payment" ? "bg-emerald-100 text-emerald-700" : drawerEntry.type === "rebate" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                  {drawerEntry.type === "purchase" ? t("ledger.supplier.Purchase Cr") : drawerEntry.type === "payment" ? t("ledger.supplier.Payment Dr") : drawerEntry.type === "rebate" ? t("ledger.supplier.Rebate Dr") : t("ledger.supplier.Opening Balance")}
                </span>
              </div>
            </DetailDrawerBody>

            <DetailDrawerFooter>
              <button onClick={() => setDrawerEntry(null)} className="w-full h-8 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                {t("btn.Close")}
              </button>
            </DetailDrawerFooter>
          </>
        )}
      </DetailDrawer>
    </div>
  )
}

export default function SupplierLedgerPage() {
  return (
    <PermissionGate permission="ledger.view">
      <SupplierLedgerPageInner />
    </PermissionGate>
  )
}

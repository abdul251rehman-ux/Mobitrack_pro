﻿"use client"

import { PermissionGate } from "@/components/shared/permission-gate"
import { useState, useMemo, useEffect } from "react"
import { Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, FileText, Eye, X, ArrowUpRight, ArrowDownLeft, Hash, Calendar, AlignLeft, Wallet, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getPersons, getPersonTransactions, createPersonTransaction, deletePersonTransaction } from "@/lib/api/persons"
import type { Person, PersonTransaction } from "@/lib/api/persons"
import { getFinanceAccounts } from "@/lib/api/finance"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, formatDate, todayPKT } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MoneyInput } from "@/components/ui/money-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/shared/page-header"
import { PageLoader } from "@/components/shared/page-loader"
import { StatCard } from "@/components/shared/stat-card"
import { DetailDrawer, DetailDrawerHeader, DetailDrawerBody, DetailDrawerFooter } from "@/components/shared/detail-drawer"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useLanguage } from "@/context/language-context"

type LedgerEntry = {
  id: string
  date: string
  reference: string
  description: string
  debit: number
  credit: number
  balance: number
  type: "gave" | "took" | "opening"
  personName?: string
  txId?: string
}

const PAGE_SIZE = 15

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Easypaisa", "JazzCash", "Cheque", "Other"]

function PersonLedgerPageInner() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [persons, setPersons] = useState<Person[]>([])
  const [transactions, setTransactions] = useState<PersonTransaction[]>([])
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([])

  const [selectedPersonId, setSelectedPersonId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [drawerEntry, setDrawerEntry] = useState<LedgerEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LedgerEntry | null>(null)

  // Add transaction form
  const [showAddTx, setShowAddTx] = useState(false)
  const [txForm, setTxForm] = useState({
    type: "gave" as "gave" | "took",
    amount: "",
    date: todayPKT(),
    method: "Cash",
    accountId: "",
    notes: "",
  })
  const [savingTx, setSavingTx] = useState(false)
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [p, t, fa] = await Promise.all([getPersons(), getPersonTransactions(), getFinanceAccounts()])
        setPersons(p)
        setTransactions(t)
        const defaultAcc = fa.find(a => a.isDefaultCash) ?? fa[0]
        setFinanceAccounts(fa)
        setTxForm(f => ({ ...f, accountId: defaultAcc?.id ?? "" }))
      } catch (err) {
        toast.error("Failed to load person ledger")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const selectedPerson = persons.find(p => p.id === selectedPersonId)

  const allEntries = useMemo<LedgerEntry[]>(() => {
    const raw: Omit<LedgerEntry, "balance">[] = []

    const filteredTx = selectedPersonId
      ? transactions.filter(t => t.personId === selectedPersonId)
      : transactions

    filteredTx.forEach(t => {
      const personName = persons.find(p => p.id === t.personId)?.name
      raw.push({
        id: t.id,
        date: t.date,
        reference: t.id.slice(0, 8).toUpperCase(),
        description: `${t.type === "gave" ? "Gave Money" : "Took Money"} - ${t.method}${t.notes ? ` (${t.notes})` : ""}`,
        debit: t.type === "gave" ? t.amount : 0,
        credit: t.type === "took" ? t.amount : 0,
        type: t.type,
        personName,
        txId: t.id,
      })
    })

    raw.sort((a, b) => a.date.localeCompare(b.date))

    const result: LedgerEntry[] = []

    // Opening balance per selected person
    const openingBalance = selectedPerson?.openingBalance ?? 0
    let balance = openingBalance

    if (openingBalance !== 0) {
      result.push({
        id: "opening",
        date: raw[0]?.date ?? todayPKT(),
        reference: "-",
        description: "Opening Balance",
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: openingBalance,
        type: "opening",
      })
    }

    raw.forEach(e => {
      balance += e.debit - e.credit
      result.push({ ...e, balance })
    })

    return result
  }, [selectedPersonId, transactions, persons, selectedPerson])

  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      if (e.type === "opening") return true
      if (dateFrom && e.date < dateFrom) return false
      if (dateTo && e.date > dateTo) return false
      return true
    })
  }, [allEntries, dateFrom, dateTo])

  const txEntries = filtered.filter(e => e.type !== "opening")
  const totalDebit = txEntries.reduce((s, e) => s + e.debit, 0)
  const totalCredit = txEntries.reduce((s, e) => s + e.credit, 0)
  const closingBalance = filtered.length > 0 ? filtered[filtered.length - 1].balance : (selectedPerson?.openingBalance ?? 0)

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const displayOrder = useMemo(() => [...filtered].reverse(), [filtered])
  const paginated = displayOrder.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const accentColor = (type: LedgerEntry["type"]) => {
    if (type === "opening") return "bg-slate-400"
    if (type === "gave") return "bg-rose-500"
    return "bg-emerald-500"
  }

  async function handleAddTransaction() {
    if (savingTx) return
    if (!selectedPersonId) { toast.error("Select a person first"); return }
    const amount = parseFloat(txForm.amount)
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }
    if (!txForm.accountId) { toast.error("Select a finance account"); return }
    setSavingTx(true)
    try {
      const created = await createPersonTransaction({
        personId: selectedPersonId,
        date: txForm.date,
        type: txForm.type,
        amount,
        method: txForm.method,
        accountId: txForm.accountId,
        notes: txForm.notes,
      })
      setTransactions(prev => [...prev, created])

      // Refresh account balances to reflect the change made in the API
      const freshAccounts = await getFinanceAccounts()
      setFinanceAccounts(freshAccounts)

      const defaultAcc = freshAccounts.find(a => a.isDefaultCash) ?? freshAccounts[0]
      setTxForm({ type: "gave", amount: "", date: todayPKT(), method: "Cash", accountId: defaultAcc?.id ?? "", notes: "" })
      setShowAddTx(false)
      toast.success(`${txForm.type === "gave" ? "Gave" : "Took"} ${formatCurrency(amount)} recorded`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save transaction")
    } finally {
      setSavingTx(false)
    }
  }

  async function handleDeleteTx(txId: string) {
    if (deletingTxId) return
    setDeletingTxId(txId)
    try {
      const tx = transactions.find(t => t.id === txId)
      await deletePersonTransaction(txId, tx ? {
        reverseAccountId: tx.accountId ?? undefined,
        reverseAmount: tx.amount,
        reverseType: tx.type,
      } : undefined)
      setTransactions(prev => prev.filter(t => t.id !== txId))
      setDrawerEntry(null)
      toast.success("Transaction deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeletingTxId(null)
    }
  }

  async function handleExportPDF() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    let shopName = "MobiTrack Pro", shopAddress = "", shopPhone = "", shopLogo: string | undefined
    try {
      const { getTenant } = await import("@/lib/api/settings")
      const tenant = await getTenant()
      shopName = tenant.name || shopName
      shopAddress = [tenant.address, tenant.city].filter(Boolean).join(", ")
      shopPhone = tenant.phone || ""
      shopLogo = tenant.logo || undefined
    } catch { /* defaults */ }
    const personLabel = selectedPerson ? selectedPerson.name : "All Persons"
    const periodLine = dateFrom || dateTo ? `  -  Period: ${dateFrom || "Start"} to ${dateTo || "Now"}` : ""
    const { generateReportPDF } = await import("@/lib/pdf/report")
    generateReportPDF({
      shopName, shopAddress, shopPhone, shopLogo,
      title: "Person Ledger",
      subtitle: personLabel + periodLine + `  -  ${filtered.length} entries`,
      orientation: "landscape",
      columns: [
        { header: "Date",        dataKey: "date",    width: 24 },
        ...(!selectedPersonId ? [{ header: "Person", dataKey: "person", width: 32 }] : []),
        { header: "Reference",   dataKey: "ref",     width: 28 },
        { header: "Description", dataKey: "desc" },
        { header: "Gave (Rs)",   dataKey: "debit",   width: 28, halign: "right" as const },
        { header: "Took (Rs)",   dataKey: "credit",  width: 28, halign: "right" as const },
        { header: "Balance",     dataKey: "balance", width: 32, halign: "right" as const, bold: true },
      ],
      rows: filtered.map(e => ({
        date:    e.date,
        person:  e.personName || "-",
        ref:     e.reference,
        desc:    e.description,
        debit:   e.debit > 0 ? `Rs ${e.debit.toLocaleString("en-PK")}` : "-",
        credit:  e.credit > 0 ? `Rs ${e.credit.toLocaleString("en-PK")}` : "-",
        balance: `Rs ${Math.abs(e.balance).toLocaleString("en-PK")} ${e.balance > 0 ? "Dr" : e.balance < 0 ? "Cr" : ""}`.trim(),
      })),
      summary: [
        { label: "Total Gave",      value: `Rs ${totalDebit.toLocaleString("en-PK")}` },
        { label: "Total Took",      value: `Rs ${totalCredit.toLocaleString("en-PK")}` },
        { label: "Closing Balance", value: `Rs ${Math.abs(closingBalance).toLocaleString("en-PK")} ${closingBalance > 0 ? "Dr" : "Cr"}` },
      ],
      filename: `Person-Ledger-${todayPKT()}`,
      action: "save",
    })
    toast.success("Person ledger PDF downloaded")
  }

  async function handleExportExcel() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    const { exportToExcel } = await import("@/lib/excel-export")
    exportToExcel(
      filtered.map(e => ({
        date:    e.date,
        person:  e.personName || "-",
        ref:     e.reference,
        desc:    e.description,
        gave:    e.debit || 0,
        took:    e.credit || 0,
        balance: `Rs ${Math.abs(e.balance).toLocaleString("en-PK")} ${e.balance > 0 ? "Dr" : e.balance < 0 ? "Cr" : ""}`.trim(),
      })),
      `Person-Ledger-${todayPKT()}`,
      [
        { key: "date",    header: "Date",        width: 14 },
        ...(!selectedPersonId ? [{ key: "person", header: "Person", width: 22 }] : []),
        { key: "ref",     header: "Reference",   width: 18 },
        { key: "desc",    header: "Description", width: 40 },
        { key: "gave",    header: "Gave (Rs)",   width: 16, align: "right" as const, numFmt: "#,##0" },
        { key: "took",    header: "Took (Rs)",   width: 16, align: "right" as const, numFmt: "#,##0" },
        { key: "balance", header: "Balance",     width: 20, align: "right" as const },
      ],
      {
        sheetName: "Person Ledger",
        title: `Person Ledger - ${selectedPerson?.name ?? "All Persons"}`,
        subtitle: `Exported on ${new Date().toLocaleDateString("en-PK")}  -  ${filtered.length} entries`,
        summaryRows: [
          { label: "Total Gave", value: totalDebit },
          { label: "Total Took", value: totalCredit },
        ],
      }
    )
    toast.success(`Exported ${filtered.length} entries to Excel`)
  }

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title={t("ledger.person.Title")}
        description={t("ledger.person.Description")}
        action={
          <div className="flex gap-1.5">
            {selectedPersonId && (
              <>
                <button
                  onClick={() => { const def = financeAccounts.find(a => a.isDefaultCash) ?? financeAccounts[0]; setTxForm(f => ({ ...f, type: "gave", amount: "", notes: "", accountId: def?.id ?? f.accountId })); setShowAddTx(true) }}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors font-semibold"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {t("ledger.person.Money Out")}
                </button>
                <button
                  onClick={() => { const def = financeAccounts.find(a => a.isDefaultCash) ?? financeAccounts[0]; setTxForm(f => ({ ...f, type: "took", amount: "", notes: "", accountId: def?.id ?? f.accountId })); setShowAddTx(true) }}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  {t("ledger.person.Money In")}
                </button>
              </>
            )}
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              {t("ledger.person.PDF")}
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {t("ledger.person.Excel")}
            </button>
          </div>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="px-3 py-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.person.Select Person")}</label>
              <Select
                value={selectedPersonId || "__all"}
                onValueChange={v => { setSelectedPersonId(v === "__all" ? "" : v); setPage(1) }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t("ledger.person.All Persons")} ({persons.length})</SelectItem>
                  {persons.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.phone ? ` - ${p.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.person.From Date")}</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                  className="w-full h-8 pl-7 pr-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.person.To Date")}</label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1) }}
                  className="w-full h-8 pl-7 pr-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
          {persons.length === 0 && (
            <p className="mt-2 text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
              {t("ledger.person.No persons")} <a href="/persons" className="underline font-semibold">{t("ledger.person.No persons link")}</a> {t("ledger.person.No persons suffix")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard
          title={t("ledger.person.Total Gave")} value={formatCurrency(totalDebit)}
          subtext={t("ledger.person.Money we gave out")}
          icon={TrendingUp} iconBg="bg-rose-100" subtextOnMobile
        />
        <StatCard
          title={t("ledger.person.Total Took")} value={formatCurrency(totalCredit)}
          subtext={t("ledger.person.Money we received")}
          icon={TrendingDown} iconBg="bg-emerald-100" subtextOnMobile
        />
        <StatCard
          title={t("ledger.person.Net Balance")} value={formatCurrency(Math.abs(closingBalance))}
          subtext={closingBalance > 0 ? t("ledger.person.They need to pay us") : closingBalance < 0 ? t("ledger.person.We need to pay them") : t("ledger.person.Settled")}
          icon={closingBalance > 0 ? TrendingUp : closingBalance < 0 ? TrendingDown : Minus}
          iconBg={closingBalance > 0 ? "bg-rose-100" : closingBalance < 0 ? "bg-emerald-100" : "bg-slate-100"}
          valueClassName={closingBalance > 0 ? "text-rose-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}
          subtextOnMobile
        />
      </div>

      {/* Ledger table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-xs text-slate-400">
              {selectedPersonId ? t("ledger.person.No tx selected") : t("ledger.person.No tx period")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="px-3 py-2 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-slate-800 truncate min-w-0">
                {selectedPerson ? `${selectedPerson.name} - ${t("ledger.person.Account Statement")}` : `${t("ledger.person.All Persons Statement")} - ${t("ledger.person.Account Statement")}`}
              </CardTitle>
              <div className="hidden sm:flex items-center gap-2.5 text-[10px] text-slate-400 shrink-0">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  {t("ledger.person.Gave Dr")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  {t("ledger.person.Took Cr")}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginated.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => setDrawerEntry(entry)}
                  className="flex w-full text-left hover:bg-slate-50/70 active:bg-slate-100 transition-colors"
                >
                  <div className={`w-1 shrink-0 ${accentColor(entry.type)}`} />
                  <div className="flex-1 min-w-0 px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-400">{formatDate(entry.date)}</p>
                      {!selectedPersonId && entry.personName && (
                        <p className="text-[10px] text-indigo-600 font-medium truncate">{entry.personName}</p>
                      )}
                    </div>
                    <p className={`text-xs font-medium leading-snug truncate ${entry.type === "opening" ? "text-slate-500 italic" : "text-slate-800"}`}>
                      {entry.description}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-1 mt-1 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {entry.debit > 0 && <span className="text-rose-600">{t("ledger.person.Gave")} {formatCurrency(entry.debit)}</span>}
                        {entry.credit > 0 && <span className="text-emerald-600">{t("ledger.person.Took")} {formatCurrency(entry.credit)}</span>}
                      </div>
                      <p className={`text-xs font-bold shrink-0 ${entry.balance > 0 ? "text-rose-600" : entry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        {formatCurrency(Math.abs(entry.balance))}{entry.balance > 0 ? ` ${t("ledger.person.Dr")}` : entry.balance < 0 ? ` ${t("ledger.person.Cr")}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center pr-2 shrink-0">
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </button>
              ))}
              <div className="px-3 py-2 bg-slate-50 border-t-2 border-slate-200">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-600">{t("ledger.person.Total Gave")}</span>
                  <span className="font-bold text-rose-700">{formatCurrency(totalDebit)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="font-semibold text-slate-600">{t("ledger.person.Total Took")}</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(totalCredit)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">{t("ledger.person.Closing Balance")}</span>
                  <span className={`font-bold ${closingBalance > 0 ? "text-rose-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {formatCurrency(Math.abs(closingBalance))}{closingBalance > 0 ? ` ${t("ledger.person.Dr")}` : closingBalance < 0 ? ` ${t("ledger.person.Cr")}` : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.person.Date")}</th>
                    {!selectedPersonId && (
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.person.Person")}</th>
                    )}
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("ledger.person.Description col")}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-rose-500 uppercase tracking-wider whitespace-nowrap">{t("ledger.person.Gave Dr")}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-emerald-500 uppercase tracking-wider whitespace-nowrap">{t("ledger.person.Took Cr")}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.person.Balance")}</th>
                    <th className="px-3 py-2 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map(entry => (
                    <tr key={entry.id} className={`hover:bg-slate-50/70 transition-colors ${entry.type === "opening" ? "bg-slate-50 italic" : ""}`}>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-xs">{formatDate(entry.date)}</td>
                      {!selectedPersonId && (
                        <td className="px-3 py-2 text-xs font-medium text-indigo-700 whitespace-nowrap">{entry.personName || "-"}</td>
                      )}
                      <td className="px-3 py-2 text-xs text-slate-700">{entry.description}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-rose-600 whitespace-nowrap">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-emerald-600 whitespace-nowrap">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className={`px-3 py-2 text-right text-xs font-bold whitespace-nowrap ${entry.balance > 0 ? "text-rose-600" : entry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        {formatCurrency(Math.abs(entry.balance))}
                        <span className="font-medium ml-0.5">{entry.balance > 0 ? " Dr" : entry.balance < 0 ? " Cr" : ""}</span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => setDrawerEntry(entry)}
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
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
                    <td colSpan={!selectedPersonId ? 3 : 2} className="px-3 py-2 text-xs text-slate-500 text-right">{t("ledger.person.Totals")}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-rose-700 whitespace-nowrap">{formatCurrency(totalDebit)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(totalCredit)}</td>
                    <td className={`px-3 py-2 text-right text-xs font-bold whitespace-nowrap ${closingBalance > 0 ? "text-rose-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                      {formatCurrency(Math.abs(closingBalance))}
                      <span className="font-medium ml-0.5">{closingBalance > 0 ? ` ${t("ledger.person.Dr")}` : closingBalance < 0 ? ` ${t("ledger.person.Cr")}` : ""}</span>
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
                  {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <span className="text-xs text-slate-500">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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

      {/* Add Transaction Modal */}
      {showAddTx && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]" onClick={() => setShowAddTx(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">{t("ledger.person.Add Transaction")}</h2>
                <button onClick={() => setShowAddTx(false)} className="p-1 rounded-md hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">
                {/* Type toggle */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.person.Transaction Type")}</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setTxForm(f => ({ ...f, type: "gave" }))}
                      className={`flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors border ${txForm.type === "gave" ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      {t("ledger.person.Gave Money")}
                    </button>
                    <button
                      onClick={() => setTxForm(f => ({ ...f, type: "took" }))}
                      className={`flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors border ${txForm.type === "took" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      {t("ledger.person.Took Money")}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {txForm.type === "gave" ? t("ledger.person.Gave hint") : t("ledger.person.Took hint")}
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.person.Amount")} <span className="text-rose-500">*</span></label>
                  <MoneyInput
                    value={txForm.amount}
                    onChange={v => setTxForm(f => ({ ...f, amount: v }))}
                    placeholder="0"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.person.Date")}</label>
                  <input
                    type="date"
                    value={txForm.date}
                    onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    {txForm.type === "gave" ? t("ledger.person.Pay From Account") : t("ledger.person.Deposit to Account")}
                  </label>
                  <select
                    value={txForm.accountId}
                    onChange={e => setTxForm(f => ({ ...f, accountId: e.target.value }))}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t("ledger.person.Select account")}</option>
                    {financeAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {formatCurrency(a.currentBalance)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.person.Payment Method")}</label>
                  <select
                    value={txForm.method}
                    onChange={e => setTxForm(f => ({ ...f, method: e.target.value }))}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.person.Notes")}</label>
                  <input
                    type="text"
                    value={txForm.notes}
                    onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder={t("ledger.person.Notes placeholder")}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => setShowAddTx(false)}
                  className="flex-1 h-8 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {t("ledger.person.Cancel")}
                </button>
                <button
                  onClick={handleAddTransaction}
                  disabled={savingTx}
                  className={`flex-1 h-8 text-xs disabled:opacity-60 text-white rounded-lg transition-colors font-medium ${txForm.type === "gave" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                >
                  {savingTx ? t("ledger.person.Saving") : txForm.type === "gave" ? t("ledger.person.Record Gave") : t("ledger.person.Record Took")}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transaction Detail Drawer */}
      <DetailDrawer open={!!drawerEntry} onOpenChange={(open) => !open && setDrawerEntry(null)}>
        {drawerEntry && (
          <>
            <DetailDrawerHeader
              icon={drawerEntry.type === "gave" ? <ArrowUpRight /> : drawerEntry.type === "took" ? <ArrowDownLeft /> : <Wallet />}
              iconBg={drawerEntry.type === "gave" ? "bg-rose-100" : drawerEntry.type === "took" ? "bg-emerald-100" : "bg-slate-200"}
              iconColor={drawerEntry.type === "gave" ? "text-rose-600" : drawerEntry.type === "took" ? "text-emerald-600" : "text-slate-500"}
              headerBg={drawerEntry.type === "gave" ? "bg-rose-50" : drawerEntry.type === "took" ? "bg-emerald-50" : "bg-slate-50"}
              title={drawerEntry.type === "gave" ? t("ledger.person.Gave Money") : drawerEntry.type === "took" ? t("ledger.person.Took Money") : t("ledger.person.Opening Balance")}
              subtitle={drawerEntry.personName}
            />

            <DetailDrawerBody>
              {/* Amount */}
              <div className="flex gap-3">
                {drawerEntry.debit > 0 && (
                  <div className="flex-1 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide mb-0.5">{t("ledger.person.Gave")}</p>
                    <p className="text-lg font-bold text-rose-700">{formatCurrency(drawerEntry.debit)}</p>
                  </div>
                )}
                {drawerEntry.credit > 0 && (
                  <div className="flex-1 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mb-0.5">{t("ledger.person.Took")}</p>
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(drawerEntry.credit)}</p>
                  </div>
                )}
                <div className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{t("ledger.person.Balance")}</p>
                  <p className={`text-lg font-bold ${drawerEntry.balance > 0 ? "text-rose-600" : drawerEntry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                    {formatCurrency(Math.abs(drawerEntry.balance))}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t("ledger.person.Date")}</p>
                  <p className="text-xs font-medium text-slate-700 mt-0.5">{formatDate(drawerEntry.date)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t("ledger.person.Reference")}</p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">{drawerEntry.reference}</p>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">{t("ledger.person.Description col")}</p>
                <p className="text-xs text-slate-700 mt-0.5">{drawerEntry.description}</p>
              </div>
            </DetailDrawerBody>

            <DetailDrawerFooter>
              <div className="flex gap-2">
                {drawerEntry.txId && drawerEntry.type !== "opening" && (
                  <button
                    onClick={() => setDeleteTarget(drawerEntry)}
                    disabled={deletingTxId === drawerEntry.txId}
                    className="flex-1 h-9 text-xs font-medium rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingTxId === drawerEntry.txId ? t("ledger.person.Deleting") : t("btn.Delete")}
                  </button>
                )}
                <button
                  onClick={() => setDrawerEntry(null)}
                  className="flex-1 h-9 text-xs font-medium rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {t("btn.Close")}
                </button>
              </div>
            </DetailDrawerFooter>
          </>
        )}
      </DetailDrawer>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("ledger.person.Delete Transaction")}
        description={`${t("ledger.person.Delete Transaction")}: ${deleteTarget?.type === "gave" ? t("ledger.person.Gave") : t("ledger.person.Took")} ${t("ledger.person.Delete desc suffix")} ${deleteTarget ? formatCurrency(deleteTarget.debit || deleteTarget.credit) : ""}? ${t("ledger.person.Delete desc end")}`}
        confirmLabel={t("btn.Delete")}
        cancelLabel={t("btn.Cancel")}
        variant="destructive"
        onConfirm={() => { if (deleteTarget?.txId) handleDeleteTx(deleteTarget.txId); setDeleteTarget(null) }}
        loading={!!deletingTxId}
      />
    </div>
  )
}

export default function PersonLedgerPage() {
  return (
    <PermissionGate permission="ledger.view">
      <PersonLedgerPageInner />
    </PermissionGate>
  )
}

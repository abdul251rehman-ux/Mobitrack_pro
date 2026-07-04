﻿"use client"

import { useState, useMemo, useEffect } from "react"
import { Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, FileText, Eye, X, ArrowUpRight, ArrowDownLeft, Hash, Calendar, AlignLeft, Wallet, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getPersons, getPersonTransactions, createPersonTransaction, deletePersonTransaction } from "@/lib/api/persons"
import type { Person, PersonTransaction } from "@/lib/api/persons"
import { getFinanceAccounts } from "@/lib/api/finance"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, formatDate, todayPKT } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

export default function PersonLedgerPage() {
  const [loading, setLoading] = useState(true)
  const [persons, setPersons] = useState<Person[]>([])
  const [transactions, setTransactions] = useState<PersonTransaction[]>([])
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([])

  const [selectedPersonId, setSelectedPersonId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [drawerEntry, setDrawerEntry] = useState<LedgerEntry | null>(null)

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
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const accentColor = (type: LedgerEntry["type"]) => {
    if (type === "opening") return "bg-slate-400"
    if (type === "gave") return "bg-blue-500"
    return "bg-emerald-500"
  }

  async function handleAddTransaction() {
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
    setDeletingTxId(txId)
    try {
      await deletePersonTransaction(txId)
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
    let shopName = "MobiTrack Pro", shopAddress = "", shopPhone = ""
    try {
      const { getTenant } = await import("@/lib/api/settings")
      const tenant = await getTenant()
      shopName = tenant.name || shopName
      shopAddress = [tenant.address, tenant.city].filter(Boolean).join(", ")
      shopPhone = tenant.phone || ""
    } catch { /* defaults */ }
    const personLabel = selectedPerson ? selectedPerson.name : "All Persons"
    const periodLine = dateFrom || dateTo ? `  -  Period: ${dateFrom || "Start"} to ${dateTo || "Now"}` : ""
    const { generateReportPDF } = await import("@/lib/pdf/report")
    generateReportPDF({
      shopName, shopAddress, shopPhone,
      title: "Person Ledger",
      subtitle: personLabel + periodLine + `  -  ${filtered.length} entries`,
      columns: [
        { header: "Date",        dataKey: "date",    width: 22 },
        ...(!selectedPersonId ? [{ header: "Person", dataKey: "person", width: 30 }] : []),
        { header: "Reference",   dataKey: "ref",     width: 24 },
        { header: "Description", dataKey: "desc",    width: 55 },
        { header: "Gave (Rs)",   dataKey: "debit",   width: 24, halign: "right" as const },
        { header: "Took (Rs)",   dataKey: "credit",  width: 24, halign: "right" as const },
        { header: "Balance",     dataKey: "balance", width: 26, halign: "right" as const, bold: true },
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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading person ledger...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">Person Ledger</h1>
          <p className="text-slate-500 text-xs mt-0.5">Track money given to or taken from individuals</p>
        </div>
        <div className="flex gap-1.5">
          {selectedPersonId && (
            <>
              <button
                onClick={() => { const def = financeAccounts.find(a => a.isDefaultCash) ?? financeAccounts[0]; setTxForm(f => ({ ...f, type: "gave", amount: "", notes: "", accountId: def?.id ?? f.accountId })); setShowAddTx(true) }}
                className="flex items-center gap-1.5 h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Money Out
              </button>
              <button
                onClick={() => { const def = financeAccounts.find(a => a.isDefaultCash) ?? financeAccounts[0]; setTxForm(f => ({ ...f, type: "took", amount: "", notes: "", accountId: def?.id ?? f.accountId })); setShowAddTx(true) }}
                className="flex items-center gap-1.5 h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Money In
              </button>
            </>
          )}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="px-3 py-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Select Person</label>
              <select
                value={selectedPersonId}
                onChange={e => { setSelectedPersonId(e.target.value); setPage(1) }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Persons ({persons.length})</option>
                {persons.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.phone ? ` - ${p.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1) }}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          {persons.length === 0 && (
            <p className="mt-2 text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
              No persons added yet. Go to <a href="/persons" className="underline font-semibold">Persons</a> page to add people first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2.5">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Gave</p>
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <p className="text-lg font-bold text-slate-900 leading-none">{formatCurrency(totalDebit)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Money we gave out</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="px-3 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Took</p>
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-slate-900 leading-none">{formatCurrency(totalCredit)}</p>
            <p className="text-[10px] text-slate-400 mt-1">Money we received</p>
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
              {closingBalance > 0 ? "They owe us (Dr)" : closingBalance < 0 ? "We owe them (Cr)" : "Settled"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-xs text-slate-400">
              {selectedPersonId ? "No transactions found. Click \"Add Transaction\" to record one." : "No transactions found for the selected period."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="px-3 py-2 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800">
                {selectedPerson ? `${selectedPerson.name} - Account Statement` : "All Persons - Account Statement"}
              </CardTitle>
              <div className="flex items-center gap-2.5 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  Gave (Dr)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Took (Cr)
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobile */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginated.map(entry => (
                <div key={entry.id} className="flex">
                  <div className={`w-1 flex-shrink-0 ${accentColor(entry.type)}`} />
                  <div className="flex-1 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-slate-400">{formatDate(entry.date)}</p>
                        <p className={`text-xs font-medium mt-0.5 leading-snug ${entry.type === "opening" ? "text-slate-500 italic" : "text-slate-800"}`}>
                          {entry.description}
                        </p>
                        {!selectedPersonId && entry.personName && (
                          <p className="text-[10px] text-violet-600 font-medium mt-0.5">{entry.personName}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {entry.debit > 0 && <p className="text-xs font-semibold text-blue-600">Gave {formatCurrency(entry.debit)}</p>}
                        {entry.credit > 0 && <p className="text-xs font-semibold text-emerald-600">Took {formatCurrency(entry.credit)}</p>}
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
                  <span className="font-semibold text-slate-600">Total Gave</span>
                  <span className="font-bold text-blue-700">{formatCurrency(totalDebit)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="font-semibold text-slate-600">Total Took</span>
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

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                    {!selectedPersonId && (
                      <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Person</th>
                    )}
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-blue-500 uppercase tracking-wider whitespace-nowrap">Gave (Dr)</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-emerald-500 uppercase tracking-wider whitespace-nowrap">Took (Cr)</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">Balance</th>
                    <th className="px-3 py-2 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map(entry => (
                    <tr key={entry.id} className={`hover:bg-slate-50/70 transition-colors ${entry.type === "opening" ? "bg-slate-50 italic" : ""}`}>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-xs">{formatDate(entry.date)}</td>
                      {!selectedPersonId && (
                        <td className="px-3 py-2 text-xs font-medium text-violet-700 whitespace-nowrap">{entry.personName || "-"}</td>
                      )}
                      <td className="px-3 py-2 text-xs text-slate-700">{entry.description}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-blue-600 whitespace-nowrap">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-emerald-600 whitespace-nowrap">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : <span className="text-slate-300">-</span>}
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
                    <td colSpan={!selectedPersonId ? 3 : 2} className="px-3 py-2 text-xs text-slate-500 text-right">Totals</td>
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
                <h2 className="text-sm font-bold text-slate-800">Add Transaction</h2>
                <button onClick={() => setShowAddTx(false)} className="p-1 rounded-md hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">
                {/* Type toggle */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Transaction Type</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setTxForm(f => ({ ...f, type: "gave" }))}
                      className={`flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors border ${txForm.type === "gave" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Gave Money
                    </button>
                    <button
                      onClick={() => setTxForm(f => ({ ...f, type: "took" }))}
                      className={`flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-colors border ${txForm.type === "took" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                    >
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      Took Money
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {txForm.type === "gave" ? "We gave money to them — their balance increases (Dr)" : "They gave money to us — their balance decreases (Cr)"}
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Amount (Rs) <span className="text-red-400">*</span></label>
                  <input
                    type="number" onWheel={e => e.currentTarget.blur()}
                    value={txForm.amount}
                    onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Date</label>
                  <input
                    type="date"
                    value={txForm.date}
                    onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    {txForm.type === "gave" ? "Pay From Account" : "Deposit to Account"}
                  </label>
                  <select
                    value={txForm.accountId}
                    onChange={e => setTxForm(f => ({ ...f, accountId: e.target.value }))}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select account</option>
                    {financeAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {formatCurrency(a.currentBalance)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Payment Method</label>
                  <select
                    value={txForm.method}
                    onChange={e => setTxForm(f => ({ ...f, method: e.target.value }))}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</label>
                  <input
                    type="text"
                    value={txForm.notes}
                    onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional description"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => setShowAddTx(false)}
                  className="flex-1 h-8 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTransaction}
                  disabled={savingTx}
                  className={`flex-1 h-8 text-xs disabled:opacity-60 text-white rounded-lg transition-colors font-medium ${txForm.type === "gave" ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                >
                  {savingTx ? "Saving..." : txForm.type === "gave" ? "Record Gave" : "Record Took"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transaction Detail Dialog */}
      {drawerEntry && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDrawerEntry(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-t-2xl ${drawerEntry.type === "gave" ? "bg-blue-50" : drawerEntry.type === "took" ? "bg-emerald-50" : "bg-slate-50"}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${drawerEntry.type === "gave" ? "bg-blue-100" : drawerEntry.type === "took" ? "bg-emerald-100" : "bg-slate-200"}`}>
                  {drawerEntry.type === "gave"
                    ? <ArrowUpRight className="w-4 h-4 text-blue-600" />
                    : drawerEntry.type === "took"
                    ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    : <Wallet className="w-4 h-4 text-slate-500" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {drawerEntry.type === "gave" ? "Gave Money" : drawerEntry.type === "took" ? "Took Money" : "Opening Balance"}
                  </p>
                  {drawerEntry.personName && <p className="text-xs text-slate-500">{drawerEntry.personName}</p>}
                </div>
              </div>
              <button onClick={() => setDrawerEntry(null)} className="p-1.5 rounded-lg hover:bg-white/70 transition-colors">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Amount */}
            <div className="px-4 pt-4 pb-3 flex gap-3">
              {drawerEntry.debit > 0 && (
                <div className="flex-1 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-0.5">Gave</p>
                  <p className="text-lg font-bold text-blue-700">{formatCurrency(drawerEntry.debit)}</p>
                </div>
              )}
              {drawerEntry.credit > 0 && (
                <div className="flex-1 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide mb-0.5">Took</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(drawerEntry.credit)}</p>
                </div>
              )}
              <div className="flex-1 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-center">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Balance</p>
                <p className={`text-lg font-bold ${drawerEntry.balance > 0 ? "text-amber-600" : drawerEntry.balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                  {formatCurrency(Math.abs(drawerEntry.balance))}
                </p>
              </div>
            </div>

            {/* Details */}
            <div className="px-4 pb-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Date</p>
                  <p className="text-xs font-medium text-slate-700 mt-0.5">{formatDate(drawerEntry.date)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Reference</p>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 truncate">{drawerEntry.reference}</p>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Description</p>
                <p className="text-xs text-slate-700 mt-0.5">{drawerEntry.description}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 flex gap-2">
              {drawerEntry.txId && drawerEntry.type !== "opening" && (
                <button
                  onClick={() => drawerEntry.txId && handleDeleteTx(drawerEntry.txId)}
                  disabled={deletingTxId === drawerEntry.txId}
                  className="flex-1 h-9 text-xs font-medium rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingTxId === drawerEntry.txId ? "Deleting..." : "Delete"}
                </button>
              )}
              <button
                onClick={() => setDrawerEntry(null)}
                className="flex-1 h-9 text-xs font-medium rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Phone, StickyNote, Wallet, Plus, Minus,
  TrendingUp, TrendingDown, CircleDollarSign, CalendarDays,
  Trash2, X, Check, AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import {
  getPersons, getPersonTransactions, createPersonTransaction, deletePersonTransaction,
  type Person, type PersonTransaction,
} from "@/lib/api/persons"
import { getFinanceAccounts } from "@/lib/api/finance"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, formatDate, todayPKT } from "@/lib/utils"

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "JazzCash", "EasyPaisa", "Card"]

// ── Avatar ────────────────────────────────────────────────────────────────────
const avatarColors = [
  "bg-violet-600", "bg-blue-600", "bg-emerald-600", "bg-amber-600",
  "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-teal-600",
]
function PersonAvatar({ name, id, size = "lg" }: { name: string; id: string; size?: "sm" | "lg" }) {
  const idx = parseInt(id.replace(/\D/g, ""), 10) % avatarColors.length
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
  const cls = size === "lg" ? "w-12 h-12 text-sm" : "w-8 h-8 text-xs"
  return (
    <div className={`${cls} rounded-xl flex items-center justify-center text-white font-bold shrink-0 ${avatarColors[idx]}`}>
      {initials}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, Icon }: {
  label: string; value: string; sub?: string; color: string; Icon: React.ElementType
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
      <p className="text-base font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [person, setPerson] = useState<Person | null>(null)
  const [transactions, setTransactions] = useState<PersonTransaction[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [loading, setLoading] = useState(true)

  // dialog state
  const [dialogType, setDialogType] = useState<"gave" | "took" | null>(null)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("Cash")
  const [accountId, setAccountId] = useState("")
  const [date, setDate] = useState(todayPKT())
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<PersonTransaction | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [allPersons, txns, accs] = await Promise.all([
          getPersons(),
          getPersonTransactions(id),
          getFinanceAccounts(),
        ])
        const found = allPersons.find(p => p.id === id)
        if (!found) { toast.error("Person not found"); router.push("/persons"); return }
        setPerson(found)
        setTransactions(txns.sort((a, b) => a.date.localeCompare(b.date)))
        setAccounts(accs)
        if (accs.length > 0) setAccountId(accs[0].id)
      } catch {
        toast.error("Failed to load person")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  // ── Balance calculations ──────────────────────────────────────────────────
  const { totalGave, totalTook, balance, isTheyOwe } = useMemo(() => {
    const opening = person?.openingBalance ?? 0
    const gave = transactions.filter(t => t.type === "gave").reduce((s, t) => s + t.amount, 0)
    const took = transactions.filter(t => t.type === "took").reduce((s, t) => s + t.amount, 0)
    // opening > 0 means they owed us at start; opening < 0 means we owed them
    const net = opening + gave - took  // positive = they owe us, negative = we owe them
    return {
      totalGave: gave,
      totalTook: took,
      balance: Math.abs(net),
      isTheyOwe: net >= 0,
    }
  }, [person, transactions])

  // ── Running balance for ledger ────────────────────────────────────────────
  const ledgerRows = useMemo(() => {
    let running = person?.openingBalance ?? 0
    return transactions.map(t => {
      if (t.type === "gave") running += t.amount
      else running -= t.amount
      return { ...t, runningBalance: running }
    })
  }, [person, transactions])

  function openDialog(type: "gave" | "took") {
    setDialogType(type)
    setAmount("")
    setMethod("Cash")
    setAccountId(accounts[0]?.id ?? "")
    setDate(todayPKT())
    setNotes("")
  }

  async function handleSave() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return }
    if (!accountId) { toast.error("Select a finance account"); return }
    setSaving(true)
    try {
      const txn = await createPersonTransaction({
        personId: id,
        date,
        type: dialogType!,
        amount: amt,
        method,
        accountId,
        notes,
      })
      setTransactions(prev => [...prev, txn].sort((a, b) => a.date.localeCompare(b.date)))
      setDialogType(null)
      toast.success(dialogType === "gave" ? `Gave ${formatCurrency(amt)} recorded` : `Received ${formatCurrency(amt)} recorded`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePersonTransaction(deleteTarget.id)
      setTransactions(prev => prev.filter(t => t.id !== deleteTarget.id))
      setDeleteTarget(null)
      toast.success("Transaction deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!person) return null

  return (
    <div className="space-y-4 pb-10">

      {/* ── Back + Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/persons")}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <PersonAvatar name={person.name} id={person.id} />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-slate-900 truncate">{person.name}</h1>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {person.phone && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Phone className="w-3 h-3" />{person.phone}
              </span>
            )}
            {person.notes && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <StickyNote className="w-3 h-3" />{person.notes}
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${person.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {person.status}
            </span>
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          <button onClick={() => openDialog("gave")}
            className="flex items-center gap-1.5 h-8 px-3 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
            <Minus className="w-3.5 h-3.5" />Give Money
          </button>
          <button onClick={() => openDialog("took")}
            className="flex items-center gap-1.5 h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" />Receive Money
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard label="Total Given" value={formatCurrency(totalGave)} sub="Money lent out" color="bg-red-500" Icon={TrendingDown} />
        <StatCard label="Total Received" value={formatCurrency(totalTook)} sub="Money taken back" color="bg-emerald-500" Icon={TrendingUp} />
        <StatCard label="Transactions" value={String(transactions.length)} sub="All time" color="bg-blue-500" Icon={CircleDollarSign} />
        <div className={`bg-white rounded-xl border px-3 py-2.5 flex flex-col gap-1 ${isTheyOwe ? "border-amber-200" : "border-emerald-200"}`}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              {isTheyOwe ? "They Need to Pay Us" : "We Need to Pay Them"}
            </p>
            <Wallet className={`w-4 h-4 ${isTheyOwe ? "text-amber-500" : "text-emerald-500"}`} />
          </div>
          <p className={`text-base font-bold leading-tight ${isTheyOwe ? "text-amber-600" : "text-emerald-600"}`}>
            {formatCurrency(balance)}
          </p>
          <p className="text-[10px] text-slate-400">{isTheyOwe ? "They need to pay us" : "We need to pay them"}</p>
        </div>
      </div>

      {/* ── Balance banner ── */}
      {balance > 0 && (
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${isTheyOwe ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
          <AlertCircle className={`w-4 h-4 shrink-0 ${isTheyOwe ? "text-amber-500" : "text-emerald-500"}`} />
          <p className={`text-sm font-medium ${isTheyOwe ? "text-amber-700" : "text-emerald-700"}`}>
            {isTheyOwe
              ? `${person.name} needs to pay you ${formatCurrency(balance)}`
              : `You need to pay ${person.name} ${formatCurrency(balance)}`}
          </p>
        </div>
      )}

      {/* ── Ledger table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Transaction Ledger</h2>
          <span className="text-[10px] text-slate-400">{transactions.length} entries</span>
        </div>

        {ledgerRows.length === 0 ? (
          <div className="py-12 text-center">
            <Wallet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">No transactions yet</p>
            <p className="text-xs text-slate-400 mt-1">Use Give Money / Receive Money to record entries</p>
          </div>
        ) : (
          <>
            {/* Opening balance row */}
            {(person.openingBalance !== 0) && (
              <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                  <Wallet className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-600">Opening Balance</p>
                  <p className="text-[10px] text-slate-400">Starting balance</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-bold ${person.openingBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {person.openingBalance > 0 ? "+" : ""}{formatCurrency(Math.abs(person.openingBalance))}
                  </p>
                  <p className={`text-[10px] font-semibold ${person.openingBalance > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                    {formatCurrency(Math.abs(person.openingBalance))} {person.openingBalance > 0 ? "Dr" : "Cr"}
                  </p>
                </div>
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {ledgerRows.map(txn => {
                const isGave = txn.type === "gave"
                const theyOweNow = txn.runningBalance >= 0
                return (
                  <div key={txn.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${isGave ? "bg-red-50" : "bg-emerald-50"}`}>
                      {isGave
                        ? <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                        : <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800">
                        {isGave ? "Gave" : "Received"} - {txn.method}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <CalendarDays className="w-2.5 h-2.5" />{formatDate(txn.date)}
                        </span>
                        {txn.notes && (
                          <span className="text-[10px] text-slate-400 truncate max-w-[180px]">- {txn.notes}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isGave ? "text-red-600" : "text-emerald-600"}`}>
                        {isGave ? "−" : "+"}{formatCurrency(txn.amount)}
                      </p>
                      <p className={`text-[10px] font-semibold ${theyOweNow ? "text-amber-500" : "text-emerald-500"}`}>
                        {formatCurrency(Math.abs(txn.runningBalance))} {theyOweNow ? "Dr" : "Cr"}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(txn)}
                      className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all ml-1 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Footer balance */}
            <div className={`px-4 py-3 border-t flex items-center justify-between ${isTheyOwe ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"}`}>
              <span className={`text-sm font-bold ${isTheyOwe ? "text-amber-700" : "text-emerald-700"}`}>
                Current Balance
              </span>
              <span className={`text-sm font-bold ${isTheyOwe ? "text-amber-700" : "text-emerald-700"}`}>
                {formatCurrency(balance)} {isTheyOwe ? "Dr" : "Cr"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Give / Receive Dialog ── */}
      {dialogType && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]" onClick={() => setDialogType(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dialogType === "gave" ? "bg-red-100" : "bg-emerald-100"}`}>
                    {dialogType === "gave"
                      ? <Minus className="w-4 h-4 text-red-600" />
                      : <Plus className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">
                    {dialogType === "gave" ? `Give Money to ${person.name}` : `Receive Money from ${person.name}`}
                  </h2>
                </div>
                <button onClick={() => setDialogType(null)} className="p-1 rounded-md hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>

              <div className="px-4 py-4 space-y-3">
                {/* Amount */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Amount (Rs) *
                  </label>
                  <input
                    type="number" onWheel={e => e.currentTarget.blur()}
                    min={1}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    autoFocus
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Finance Account */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Finance Account *
                  </label>
                  {accounts.length === 0 ? (
                    <p className="text-xs text-red-500">No finance accounts found. Add one in Finance first.</p>
                  ) : (
                    <select
                      value={accountId}
                      onChange={e => setAccountId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} - {formatCurrency(a.currentBalance ?? 0)}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Payment method */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Method</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_METHODS.map(m => (
                      <button key={m} onClick={() => setMethod(m)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${method === m ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-600 hover:border-blue-300"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Reason, reference..."
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Summary */}
                {amount && parseFloat(amount) > 0 && (
                  <div className={`rounded-lg px-3 py-2.5 border ${dialogType === "gave" ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
                    <p className={`text-xs font-semibold ${dialogType === "gave" ? "text-red-700" : "text-emerald-700"}`}>
                      {dialogType === "gave"
                        ? `Rs ${parseFloat(amount).toLocaleString()} will be deducted from ${accounts.find(a => a.id === accountId)?.name ?? "account"}`
                        : `Rs ${parseFloat(amount).toLocaleString()} will be added to ${accounts.find(a => a.id === accountId)?.name ?? "account"}`}
                    </p>
                  </div>
                )}
              </div>

              <div className="px-4 pb-4 flex gap-2">
                <button onClick={() => setDialogType(null)}
                  className="flex-1 h-9 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className={`flex-1 h-9 text-xs text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 ${dialogType === "gave" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                  {saving
                    ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <Check className="w-3.5 h-3.5" />}
                  {saving ? "Saving..." : dialogType === "gave" ? "Record Give" : "Record Receive"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 text-center">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">Delete Transaction?</h3>
              <p className="text-xs text-slate-500 mb-4">
                {deleteTarget.type === "gave" ? "Gave" : "Received"} {formatCurrency(deleteTarget.amount)} on {formatDate(deleteTarget.date)}.
                This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 h-8 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg transition-colors font-medium">
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

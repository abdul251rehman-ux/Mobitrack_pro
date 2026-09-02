"use client"

import { Banknote, Landmark, Wallet, Check, AlertCircle } from "lucide-react"
import { MoneyInput } from "@/components/ui/money-input"
import { formatCurrency, cn } from "@/lib/utils"
import type { FinanceAccount } from "@/lib/api/types"

export interface SplitEntry { accountId: string; amount: string }

function AccountIcon({ type }: { type: string }) {
  if (type === "bank") return <Landmark className="w-4 h-4" />
  if (type === "mobile_wallet") return <Wallet className="w-4 h-4" />
  return <Banknote className="w-4 h-4" />
}

/** Sum of all split entries' typed amounts. */
export function splitTotal(splits: SplitEntry[]): number {
  return splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
}

/** Account ids whose typed split amount exceeds that account's current balance. */
export function splitInsufficientMap(splits: SplitEntry[], accounts: FinanceAccount[]): Record<string, boolean> {
  const map: Record<string, boolean> = {}
  for (const s of splits) {
    const acc = accounts.find(a => a.id === s.accountId)
    if (acc && (parseFloat(s.amount) || 0) > acc.currentBalance) map[s.accountId] = true
  }
  return map
}

/**
 * Multi-account payment picker: select one or more finance accounts and type
 * an amount against each (a "split payment"). Shows each account's live
 * balance and flags any entry whose typed amount exceeds it.
 *
 * Reused across Purchases / Used Phones wherever a payment needs to be able
 * to draw from more than one account at once.
 */
export function SplitPaymentPicker({ accounts, splits, onChange, targetAmount }: {
  accounts: FinanceAccount[]
  splits: SplitEntry[]
  onChange: (next: SplitEntry[]) => void
  /** Optional total to auto-fill the remaining amount for via the "Fill" button. */
  targetAmount?: number
}) {
  const insufficientMap = splitInsufficientMap(splits, accounts)
  const totalPaid = splitTotal(splits)

  function toggleAccount(accId: string) {
    onChange(splits.find(e => e.accountId === accId)
      ? splits.filter(e => e.accountId !== accId)
      : [...splits, { accountId: accId, amount: "" }])
  }
  function setAmount(accId: string, val: string) {
    onChange(splits.map(e => e.accountId === accId ? { ...e, amount: val } : e))
  }

  if (accounts.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
        <p className="text-xs text-amber-700">No finance accounts found. Set up accounts first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {accounts.map(acc => {
        const entry = splits.find(e => e.accountId === acc.id)
        const sel = !!entry
        const bad = insufficientMap[acc.id]
        const type = acc.type ?? "cash"
        const ring = { cash: sel ? "border-emerald-400 bg-emerald-50" : "border-slate-200", bank: sel ? "border-indigo-400 bg-indigo-50" : "border-slate-200", mobile_wallet: sel ? "border-indigo-400 bg-indigo-50" : "border-slate-200" }
        const iconBg = { cash: sel ? "bg-emerald-200 text-emerald-700" : "bg-slate-100 text-slate-500", bank: sel ? "bg-indigo-200 text-indigo-700" : "bg-slate-100 text-slate-500", mobile_wallet: sel ? "bg-indigo-200 text-indigo-700" : "bg-slate-100 text-slate-500" }
        return (
          <div key={acc.id} className={cn("rounded-xl border transition-all", ring[type as keyof typeof ring] ?? ring.cash)}>
            <button type="button" onClick={() => toggleAccount(acc.id)} className="w-full p-3 flex items-center gap-3 text-left">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconBg[type as keyof typeof iconBg] ?? iconBg.cash)}>
                <AccountIcon type={type} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{acc.name}</p>
                <p className="text-[11px] text-slate-500">Balance: <span className="font-semibold text-slate-700 tabular-nums">{formatCurrency(acc.currentBalance)}</span></p>
              </div>
              <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", sel ? "bg-indigo-600 border-indigo-600" : "border-slate-300")}>
                {sel && <Check className="w-3 h-3 text-white" />}
              </div>
            </button>
            {sel && (
              <div className="px-3 pb-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <MoneyInput min={0}
                      placeholder="Amount paid (Rs)"
                      value={entry?.amount ?? ""}
                      onChange={v => setAmount(acc.id, v)}
                      className={cn("h-9 text-sm", bad && "border-rose-400")}
                      autoFocus
                    />
                    {bad && <p className="text-[10px] text-rose-500 mt-0.5">Exceeds account balance of {formatCurrency(acc.currentBalance)}</p>}
                  </div>
                  {targetAmount !== undefined && (
                    <button type="button"
                      onClick={() => setAmount(acc.id, String(Math.min(acc.currentBalance, Math.max(0, targetAmount - (totalPaid - (parseFloat(entry?.amount ?? "0") || 0))))))}
                      className="self-start text-[10px] text-indigo-600 font-semibold border border-indigo-200 rounded-lg px-2.5 py-2.5 hover:bg-indigo-50 whitespace-nowrap">
                      Fill
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

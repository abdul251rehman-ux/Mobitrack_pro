"use client"

import { PermissionGate } from "@/components/shared/permission-gate"
import { useState, useMemo, useEffect } from "react"
import {
  Download, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,
  FileText, Eye, CheckCircle, AlertTriangle, PlusCircle, Scale,
  Smartphone, Headphones,
} from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { getCustomers } from "@/lib/api/customers"
import { getSales } from "@/lib/api/sales"
import { getPayments } from "@/lib/api/payments"
import { getFinanceAccounts } from "@/lib/api/finance"
import type { Customer, Sale, Payment } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, formatDate, todayPKT, cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/page-header"
import { PageLoader } from "@/components/shared/page-loader"
import { StatCard } from "@/components/shared/stat-card"
import { useLanguage } from "@/context/language-context"

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
  // Rich detail refs for drawer
  saleId?: string
  paymentId?: string
}

/** IDs of payments folded into their sale's row (same day, same invoice) - excluded from the flat payment list */
function computeDownPaymentIds(sales: import("@/data/types").Sale[], payments: import("@/data/types").Payment[]): Set<string> {
  const ids = new Set<string>()
  sales.forEach(s => {
    const match = payments.find(p => p.referenceNumber === s.invoiceNumber && p.date === s.date && p.status === "Completed" && !ids.has(p.id))
    if (match) ids.add(match.id)
  })
  return ids
}

type AccountStatus = "all" | "outstanding" | "cleared" | "advance"
type PeriodPreset = "custom" | "this_week" | "last_week" | "this_month" | "last_month" | "this_quarter" | "this_year" | "all_time"

const PAGE_SIZE = 15

function getPeriodDates(preset: PeriodPreset): { from: string; to: string } {
  const now   = new Date()
  const today = todayPKT()
  const pad   = (n: number) => String(n).padStart(2, "0")
  const fmt   = (d: Date)   => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  switch (preset) {
    case "this_week": {
      const day = now.getDay()
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      return { from: fmt(mon), to: today }
    }
    case "last_week": {
      const day = now.getDay()
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return { from: fmt(mon), to: fmt(sun) }
    }
    case "this_month":
      return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: today }
    case "last_month": {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const l = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: fmt(f), to: fmt(l) }
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3)
      return { from: `${now.getFullYear()}-${pad(q * 3 + 1)}-01`, to: today }
    }
    case "this_year":
      return { from: `${now.getFullYear()}-01-01`, to: today }
    case "all_time":
      return { from: "", to: "" }
    default:
      return { from: "", to: "" }
  }
}

// ── Entry detail modal ────────────────────────────────────────────────────────
function EntryDetailModal({
  entry, sales, payments, onClose,
}: {
  entry: LedgerEntry | null
  sales: import("@/data/types").Sale[]
  payments: import("@/data/types").Payment[]
  onClose: () => void
}) {
  const { t } = useLanguage()
  if (!entry) return null

  const sale    = entry.saleId    ? sales.find(s => s.id === entry.saleId)       : undefined
  const payment = entry.paymentId ? payments.find(p => p.id === entry.paymentId) : undefined
  const isSale  = entry.type === "sale"

  const saleOutstanding = sale ? Math.max(0, sale.total - sale.amountReceived) : 0
  const payStatus = !sale ? null
    : sale.amountReceived >= sale.total ? "Paid in Full"
    : sale.amountReceived > 0           ? "Partial Payment"
    : "Unpaid"

  const subtotal = sale ? sale.items.reduce((s, i) => s + i.lineTotal, 0) : 0

  return (
    <Dialog open={!!entry} onOpenChange={onClose}>
      <DialogContent className="w-[96vw] max-w-3xl max-h-[85dvh] overflow-y-auto p-0">
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-4 sm:px-6 pt-5 pb-4 border-b border-slate-100">
          <div>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {isSale ? t("ledger.customer.Sale Details") : t("ledger.customer.Payment Details")}
              </DialogTitle>
              <DialogDescription className="font-mono text-indigo-600 text-sm font-semibold mt-0.5">
                {entry.reference}
              </DialogDescription>
            </DialogHeader>
            {entry.customerName && (
              <p className="text-xs text-slate-500 mt-1">{entry.customerName}</p>
            )}
          </div>
          {/* Status badge */}
          <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
            {payStatus && (
              <Badge className={cn(
                "text-[10px] font-bold px-2 py-0.5",
                payStatus === "Paid in Full"   ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : payStatus === "Partial Payment" ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-rose-100 text-rose-700 border-rose-200"
              )}>
                {payStatus === "Paid in Full" ? t("ledger.customer.Paid in Full") : payStatus === "Partial Payment" ? t("ledger.customer.Partial Payment") : t("status.Unpaid")}
              </Badge>
            )}
            {!isSale && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold px-2 py-0.5">
                {t("ledger.customer.Payment Received")}
              </Badge>
            )}
          </div>
        </div>

        {/* ── Meta grid ── */}
        <div className="mx-4 sm:mx-6 mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: t("ledger.customer.Date"),           value: formatDate(entry.date) },
            { label: t("ledger.customer.Reference"),      value: entry.reference, mono: true },
            ...(sale?.paymentMethod   ? [{ label: t("ledger.customer.Payment Method meta"), value: sale.paymentMethod }] : []),
            ...(payment?.method       ? [{ label: t("ledger.customer.Payment Method meta"), value: payment.method }] : []),
            ...(payment?.notes && !payment.notes.match(/^(Payment for|Outstanding for)/i)
              ? [{ label: t("ledger.customer.Notes"), value: payment.notes }] : []),
          ].map((row, i) => (
            <div key={i} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{row.label}</p>
              <p className={cn("text-xs font-semibold text-slate-800 truncate", (row as any).mono && "font-mono text-slate-600")}>
                {row.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Sale items table ── */}
        {sale && sale.items.length > 0 && (
          <div className="mx-4 sm:mx-6 mt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{t("ledger.customer.Items Sold")}</p>

            {/* Mobile cards */}
            <div className="md:hidden rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {sale.items.map((item, i) => {
                const unitPrice = item.quantity > 0 ? item.lineTotal / item.quantity : 0
                return (
                  <div key={i} className="px-3 py-2.5 flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      {(item as any).category === "Accessory"
                        ? <Headphones className="w-3.5 h-3.5 text-indigo-600" />
                        : <Smartphone className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 leading-tight truncate">{item.productName}</p>
                      {item.imei && <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">{t("ledger.customer.IMEI")} {item.imei}</p>}
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                        <span>{t("ledger.customer.Qty")}: {item.quantity}</span>
                        <span>·</span>
                        <span>{formatCurrency(unitPrice)} {t("sale.each")}</span>
                      </div>
                      {item.discount > 0 && <p className="text-[10px] text-amber-600 mt-0.5">{t("ledger.customer.Disc")} -{formatCurrency(item.discount)}</p>}
                    </div>
                    <span className="text-xs font-bold text-slate-800 shrink-0 whitespace-nowrap">{formatCurrency(item.lineTotal)}</span>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-lg border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t("ledger.customer.Product")}</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t("ledger.customer.Type")}</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t("ledger.customer.Qty")}</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t("ledger.customer.Unit Price")}</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t("ledger.customer.Total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sale.items.map((item, i) => {
                    const unitPrice = item.quantity > 0 ? item.lineTotal / item.quantity : 0
                    return (
                      <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 leading-tight">{item.productName}</p>
                          {item.imei && (
                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{t("ledger.customer.IMEI")} {item.imei}</p>
                          )}
                          {item.discount > 0 && (
                            <p className="text-[10px] text-amber-600 mt-0.5">{t("ledger.customer.Disc")} -{formatCurrency(item.discount)}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-semibold text-slate-600 border-slate-200">
                            {(item as any).category ?? "Mobile"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-center text-slate-600 font-medium">{item.quantity}</td>
                        <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(item.lineTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Financial summary ── */}
            <div className="mt-3 flex justify-end">
              <div className="w-full sm:w-64 rounded-lg border border-slate-200 overflow-hidden text-xs">
                <div className="flex justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="text-slate-500">{t("ledger.customer.Subtotal")}</span>
                  <span className="font-medium text-slate-700">{formatCurrency(subtotal)}</span>
                </div>
                {sale.discount > 0 && (
                  <div className="flex justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-slate-500">{t("ledger.customer.Discount")}</span>
                    <span className="font-medium text-amber-600">-{formatCurrency(sale.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-2.5 bg-slate-800">
                  <span className="font-bold text-white">{t("ledger.customer.Total")}</span>
                  <span className="font-bold text-white">{formatCurrency(sale.total)}</span>
                </div>
                <div className="flex justify-between px-4 py-2 bg-white border-b border-slate-100">
                  <span className="text-slate-500">{t("ledger.customer.Amount Received")}</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(sale.amountReceived)}</span>
                </div>
                <div className={cn(
                  "flex justify-between px-4 py-2",
                  saleOutstanding > 0 ? "bg-rose-50" : "bg-emerald-50"
                )}>
                  <span className={cn("font-semibold", saleOutstanding > 0 ? "text-rose-700" : "text-emerald-700")}>
                    {saleOutstanding > 0 ? t("ledger.customer.Balance Due") : t("ledger.customer.Settled")}
                  </span>
                  <span className={cn("font-bold", saleOutstanding > 0 ? "text-rose-700" : "text-emerald-700")}>
                    {saleOutstanding > 0 ? formatCurrency(saleOutstanding) : t("ledger.customer.Paid in Full")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Payment details (non-sale entry) ── */}
        {payment && !isSale && (
          <div className="mx-4 sm:mx-6 mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 sm:px-5 py-4">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">{t("ledger.customer.Payment Info")}</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">{t("ledger.customer.Amount")}</span>
                <span className="font-bold text-emerald-700">{formatCurrency(payment.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("ledger.customer.Method")}</span>
                <span className="font-semibold text-slate-700">{payment.method}</span>
              </div>
              {payment.notes && !payment.notes.match(/^(Payment for|Outstanding for)/i) && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t("ledger.customer.Notes")}</span>
                  <span className="font-medium text-slate-700 text-right max-w-[60%]">{payment.notes}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="h-5" />
      </DialogContent>
    </Dialog>
  )
}

function CustomerLedgerPageInner() {
  const { t } = useLanguage()
  const [loading, setLoading]     = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales]         = useState<Sale[]>([])
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([])
  const [financeAccounts, setFinanceAccounts]   = useState<FinanceAccount[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [c, s, p, fa] = await Promise.all([getCustomers(), getSales(), getPayments(), getFinanceAccounts()])
        setCustomers(c)
        setSales(s)
        setCustomerPayments(p.filter(pay => pay.entityType === "Customer" && pay.type === "Received"))
        setFinanceAccounts(fa)
      } catch {
        toast.error("Failed to load ledger data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [accountStatus, setAccountStatus]           = useState<AccountStatus>("all")
  const [periodPreset, setPeriodPreset]             = useState<PeriodPreset>("all_time")
  const [dateFrom, setDateFrom]                     = useState("")
  const [dateTo, setDateTo]                         = useState("")
  const [openingBalance, setOpeningBalance]         = useState(0)
  const [page, setPage]                             = useState(1)
  const [drawerEntry, setDrawerEntry]               = useState<LedgerEntry | null>(null)

  // ── Collect Payment dialog ───────────────────────────────────────────────────
  const [collectOpen, setCollectOpen]           = useState(false)
  const [collectAmount, setCollectAmount]       = useState("")
  const [collectMethod, setCollectMethod]       = useState("Cash")
  const [collectAccountId, setCollectAccountId] = useState("")
  const [collecting, setCollecting]             = useState(false)

  function openCollectDialog() {
    const defaultAcc = financeAccounts.find(a => a.isDefaultCash) ?? financeAccounts[0]
    setCollectAccountId(defaultAcc?.id ?? "")
    setCollectAmount("")
    setCollectMethod("Cash")
    setCollectOpen(true)
  }

  async function handleCollectPayment() {
    if (!selectedCustomer || collecting) return
    const amount = parseFloat(collectAmount)
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }
    if (!collectAccountId)      { toast.error("Select a finance account"); return }
    setCollecting(true)
    try {
      const tenantId = await getTenantId()
      const today    = todayPKT()

      await supabase.from("payments").insert({
        tenant_id: tenantId, date: today, type: "Received",
        entity_type: "Customer", entity_id: selectedCustomer.id,
        entity_name: selectedCustomer.name,
        reference_type: "Advance", amount, method: collectMethod, status: "Completed",
        notes: `Payment from ${selectedCustomer.name}`,
      })

      // Finance transaction
      await supabase.from("finance_transactions").insert({
        tenant_id: tenantId, date: today, type: "sale_receipt",
        account_id: collectAccountId, amount,
        reference_type: "Sale",
        description: `Payment collected from ${selectedCustomer.name}`,
      })
      const { data: accRow } = await supabase.from("finance_accounts")
        .select("current_balance").eq("id", collectAccountId).single()
      if (accRow) {
        await supabase.from("finance_accounts")
          .update({ current_balance: (accRow as any).current_balance + amount })
          .eq("id", collectAccountId)
        setFinanceAccounts(prev => prev.map(a =>
          a.id === collectAccountId ? { ...a, currentBalance: a.currentBalance + amount } : a
        ))
      }

      // Refresh payments
      const fresh = await getPayments()
      setCustomerPayments(fresh.filter(pay => pay.entityType === "Customer" && pay.type === "Received"))

      toast.success(`${formatCurrency(amount)} collected from ${selectedCustomer.name}`)
      setCollectOpen(false)
      setPage(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment")
    } finally {
      setCollecting(false)
    }
  }

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  // Auto-fill Opening Balance from the customer's saved value when switching
  // customers - still a plain useState the user can type over for a one-off
  // view, same convention as app/ledger/suppliers/page.tsx.
  useEffect(() => {
    setOpeningBalance(selectedCustomer?.openingBalance ?? 0)
  }, [selectedCustomerId])

  // Compute net balance per customer for filtering & status badge
  const customerBalanceMap = useMemo(() => {
    const map = new Map<string, number>()
    customers.forEach(c => {
      const custSales    = sales.filter(s => s.customerId === c.id && s.status !== "Refunded")
      const totalBilled  = custSales.reduce((s, sl) => s + sl.total, 0)
      // Only Completed payments count as actual money received
      const totalPaid    = customerPayments
        .filter(p => p.entityId === c.id && p.status === "Completed")
        .reduce((s, p) => s + p.amount, 0)
      map.set(c.id, totalBilled - totalPaid)
    })
    return map
  }, [customers, sales, customerPayments])

  // Filter customer list by account status
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const bal = customerBalanceMap.get(c.id) ?? 0
      if (accountStatus === "outstanding") return bal > 0
      if (accountStatus === "cleared")     return bal === 0
      if (accountStatus === "advance")     return bal < 0
      return true
    })
  }, [customers, customerBalanceMap, accountStatus])

  // Build all ledger entries
  const allEntries = useMemo<LedgerEntry[]>(() => {
    const raw: Omit<LedgerEntry, "balance">[] = []

    const custIds = selectedCustomerId
      ? new Set([selectedCustomerId])
      : new Set(filteredCustomers.map(c => c.id))

    // A payment made on the same day as (and referencing) its sale is that sale's down-payment,
    // not a separate event - fold it into the sale row instead of a second line. Payments made
    // later against the same invoice are genuinely separate events and keep their own row.
    const downPaymentIds = computeDownPaymentIds(sales, customerPayments)

    sales
      .filter(s => s.customerId && custIds.has(s.customerId) && s.status !== "Refunded")
      .forEach(s => {
        const payStatus = s.amountReceived >= s.total ? "Paid in Full"
          : s.amountReceived > 0 ? "Partial Payment"
          : "Unpaid"
        const downPayment = customerPayments.find(p => downPaymentIds.has(p.id) && p.referenceNumber === s.invoiceNumber)
        raw.push({
          id: s.id, date: s.date, reference: s.invoiceNumber,
          description: `Sale Invoice  ·  ${s.items.length} item${s.items.length !== 1 ? "s" : ""}  ·  ${payStatus}`,
          // Net effect on the balance: full sale value minus any down-payment made at the same time
          debit: s.total - (downPayment?.amount ?? 0), credit: 0, type: "sale", customerName: s.customerName,
          saleId: s.id,
        })
      })

    sales
      .filter(s => s.customerId && custIds.has(s.customerId) && s.status === "Refunded")
      .forEach(s => raw.push({
        id: `${s.id}-ref`, date: s.date, reference: s.invoiceNumber,
        description: `Sale Refund  ·  ${s.items.length} item${s.items.length !== 1 ? "s" : ""}`,
        debit: 0, credit: s.total, type: "payment", customerName: s.customerName,
        saleId: s.id,
      }))

    // Only count Completed payments — Pending rows are "outstanding IOUs", not actual money received.
    // Down-payments folded into their sale row above are excluded here to avoid double-counting.
    customerPayments
      .filter(p => custIds.has(p.entityId) && p.status === "Completed" && !downPaymentIds.has(p.id))
      .forEach(p => raw.push({
        id: p.id, date: p.date,
        reference: p.referenceNumber || p.id.slice(0, 8),
        description: `Payment Received  ·  ${p.method}`,
        debit: 0, credit: p.amount, type: "payment", customerName: p.entityName,
        paymentId: p.id,
      }))

    // Ascending by date so running balance is computed correctly (oldest → newest)
    // Same-date: sales (debits) before payments (credits)
    raw.sort((a, b) => {
      const d = a.date.localeCompare(b.date)
      if (d !== 0) return d
      if (a.type === "sale" && b.type !== "sale") return -1
      if (a.type !== "sale" && b.type === "sale") return  1
      return 0
    })

    const result: LedgerEntry[] = []
    let balance = openingBalance

    if (openingBalance !== 0) {
      result.push({
        id: "opening", date: raw[0]?.date ?? "", reference: "-",
        description: "Opening Balance",
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: openingBalance, type: "opening",
      })
    }

    raw.forEach(e => {
      balance += e.debit - e.credit
      result.push({ ...e, balance })
    })

    return result
  }, [selectedCustomerId, openingBalance, sales, customerPayments, filteredCustomers])

  // Apply date filter
  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      if (e.type === "opening") return true
      if (dateFrom && e.date < dateFrom) return false
      if (dateTo   && e.date > dateTo)   return false
      return true
    })
  }, [allEntries, dateFrom, dateTo])

  const txEntries      = filtered.filter(e => e.type !== "opening")
  const totalDebit     = txEntries.reduce((s, e) => s + e.debit,  0)
  const totalCredit    = txEntries.reduce((s, e) => s + e.credit, 0)
  const closingBalance = filtered.length > 0 ? filtered[filtered.length - 1].balance : openingBalance

  // Display newest first (balance already computed oldest→newest above)
  const displayEntries = [...filtered].reverse()
  const totalPages = Math.ceil(displayEntries.length / PAGE_SIZE)
  const paginated  = displayEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Scenario badge
  const scenario = closingBalance > 0
    ? { label: "Outstanding Due",    color: "bg-rose-50 text-rose-700 border-rose-200",     icon: <AlertTriangle className="w-3 h-3" /> }
    : closingBalance < 0
    ? { label: "Advance / Overpaid", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <TrendingDown className="w-3 h-3" /> }
    : { label: "Account Settled",    color: "bg-slate-50 text-slate-600 border-slate-200",        icon: <CheckCircle className="w-3 h-3" /> }

  function handlePresetChange(preset: PeriodPreset) {
    setPeriodPreset(preset)
    if (preset !== "custom") {
      const { from, to } = getPeriodDates(preset)
      setDateFrom(from)
      setDateTo(to)
    }
    setPage(1)
  }

  const accentColor = (type: LedgerEntry["type"]) => {
    if (type === "opening") return "bg-slate-400"
    if (type === "sale")    return "bg-rose-500"
    return "bg-emerald-500"
  }

  async function handlePDFExport() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    let shopName = "MobiTrack Pro", shopAddress = "", shopPhone = "", shopLogo: string | undefined
    try {
      const { getTenant } = await import("@/lib/api/settings")
      const tenant = await getTenant()
      shopName    = tenant.name    || shopName
      shopAddress = [tenant.address, tenant.city].filter(Boolean).join(", ")
      shopPhone   = tenant.phone   || ""
      shopLogo    = tenant.logo    || undefined
    } catch { /* defaults */ }

    const custLabel  = selectedCustomer ? selectedCustomer.name : "All Customers"
    const periodLine = dateFrom || dateTo
      ? `Period: ${dateFrom || "Start"} to ${dateTo || "Now"}`
      : "All Time"
    const statusLabel = accountStatus !== "all"
      ? `Status: ${accountStatus.charAt(0).toUpperCase()}${accountStatus.slice(1)}`
      : null

    const balLabel = closingBalance > 0 ? "Dr (Outstanding)"
      : closingBalance < 0 ? "Cr (Advance)"
      : "Settled"

    const { generateReportPDF } = await import("@/lib/pdf/report")
    const subtitle = [custLabel, statusLabel, periodLine, `${filtered.length} entries`].filter(Boolean).join("  |  ")
    generateReportPDF({
      shopName, shopAddress, shopPhone, shopLogo,
      title: "Customer Ledger",
      subtitle,
      columns: [
        { header: "Date",        dataKey: "date",    width: 24, halign: "center" },
        ...(!selectedCustomerId ? [{ header: "Customer", dataKey: "customer", width: 34 }] : []),
        { header: "Reference",   dataKey: "ref",     width: 28 },
        { header: "Description", dataKey: "desc" },
        { header: "Debit (Rs)",  dataKey: "debit",   width: 26, halign: "right" as const },
        { header: "Credit (Rs)", dataKey: "credit",  width: 26, halign: "right" as const },
        { header: "Balance",     dataKey: "balance", width: 30, halign: "right" as const, bold: true },
      ],
      rows: filtered.map(e => ({
        date:     e.date,
        customer: e.customerName || "-",
        ref:      e.reference,
        desc:     e.description,
        debit:    e.debit  > 0 ? `Rs ${e.debit.toLocaleString("en-PK")}`  : "-",
        credit:   e.credit > 0 ? `Rs ${e.credit.toLocaleString("en-PK")}` : "-",
        balance:  `Rs ${Math.abs(e.balance).toLocaleString("en-PK")} ${e.balance > 0 ? "Dr" : e.balance < 0 ? "Cr" : ""}`.trim(),
      })),
      summary: [
        { label: "Total Debit",      value: `Rs ${totalDebit.toLocaleString("en-PK")}` },
        { label: "Total Credit",     value: `Rs ${totalCredit.toLocaleString("en-PK")}` },
        { label: `Closing Balance (${balLabel})`, value: `Rs ${Math.abs(closingBalance).toLocaleString("en-PK")}` },
      ],
      orientation: "landscape",
      filename: `Customer-Ledger-${selectedCustomer?.name?.replace(/\s+/g, "-") ?? "All"}-${todayPKT()}`,
      action: "save",
    })
    toast.success("Customer ledger PDF downloaded")
  }

  async function handleExportCSV() {
    if (filtered.length === 0) { toast.error("No data to export"); return }
    const { exportToExcel } = await import("@/lib/excel-export")
    const cols = [
      { key: "date",     header: "Date",         width: 14 },
      ...(!selectedCustomerId ? [{ key: "customer", header: "Customer", width: 22 }] : []),
      { key: "ref",      header: "Reference",    width: 18 },
      { key: "desc",     header: "Description",  width: 40 },
      { key: "debit",    header: "Debit (Rs)",   width: 16, align: "right" as const, numFmt: "#,##0" },
      { key: "credit",   header: "Credit (Rs)",  width: 16, align: "right" as const, numFmt: "#,##0" },
      { key: "balance",  header: "Balance",      width: 20, align: "right" as const },
      { key: "status",   header: "Status",       width: 16 },
    ]
    exportToExcel(
      filtered.map(e => ({
        date:     e.date,
        customer: e.customerName || "-",
        ref:      e.reference,
        desc:     e.description,
        debit:    e.debit  || 0,
        credit:   e.credit || 0,
        balance:  `Rs ${Math.abs(e.balance).toLocaleString("en-PK")} ${e.balance > 0 ? "Dr" : e.balance < 0 ? "Cr" : ""}`.trim(),
        status:   e.balance > 0 ? "Due" : e.balance < 0 ? "Advance" : "Settled",
      })),
      `Customer-Ledger-${selectedCustomer?.name?.replace(/\s+/g, "-") ?? "All"}-${todayPKT()}`,
      cols,
      {
        sheetName: "Customer Ledger",
        title: `Customer Ledger - ${selectedCustomer?.name ?? "All Customers"}`,
        subtitle: `${dateFrom || dateTo ? `Period: ${dateFrom || "Start"} to ${dateTo || "Now"}  |  ` : ""}${filtered.length} entries`,
        summaryRows: [
          { label: "Total Debit",  value: totalDebit },
          { label: "Total Credit", value: totalCredit },
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

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <PageHeader
        title={t("ledger.customer.Title")}
        description={t("ledger.customer.Description")}
        action={
          <div className="flex gap-1.5">
            {selectedCustomerId && (
              <button
                onClick={openCollectDialog}
                className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" /> {t("ledger.customer.Collect Payment")}
              </button>
            )}
            <button
              onClick={handlePDFExport}
              className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> {t("ledger.customer.PDF")}
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> {t("ledger.customer.Excel")}
            </button>
          </div>
        }
      />

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="px-3 py-2.5 space-y-2.5">

          {/* Row 1: Customer selector + account status filter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.customer.Customer")}</label>
              <Select
                value={selectedCustomerId || "__all"}
                onValueChange={v => { setSelectedCustomerId(v === "__all" ? "" : v); setPage(1) }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">{t("ledger.customer.All Customers")} ({filteredCustomers.length})</SelectItem>
                  {filteredCustomers.map(c => {
                    const bal = customerBalanceMap.get(c.id) ?? 0
                    const tag = bal > 0 ? ` • ${t("ledger.customer.Due")} ${bal.toLocaleString("en-PK")}` : bal < 0 ? ` • ${t("ledger.customer.Advance")}` : ` • ${t("ledger.customer.Settled")}`
                    return <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone}){tag}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.customer.Account Status")}</label>
              <Select
                value={accountStatus}
                onValueChange={v => { setAccountStatus(v as AccountStatus); setSelectedCustomerId(""); setPage(1) }}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("ledger.customer.All Accounts")}</SelectItem>
                  <SelectItem value="outstanding">{t("ledger.customer.Outstanding Only")}</SelectItem>
                  <SelectItem value="cleared">{t("ledger.customer.Cleared Only")}</SelectItem>
                  <SelectItem value="advance">{t("ledger.customer.Advance Only")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Period preset + custom date range */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.customer.Period")}</label>
              <Select value={periodPreset} onValueChange={v => handlePresetChange(v as PeriodPreset)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_time">{t("ledger.customer.All Time")}</SelectItem>
                  <SelectItem value="this_week">{t("ledger.customer.This Week")}</SelectItem>
                  <SelectItem value="last_week">{t("ledger.customer.Last Week")}</SelectItem>
                  <SelectItem value="this_month">{t("ledger.customer.This Month")}</SelectItem>
                  <SelectItem value="last_month">{t("ledger.customer.Last Month")}</SelectItem>
                  <SelectItem value="this_quarter">{t("ledger.customer.This Quarter")}</SelectItem>
                  <SelectItem value="this_year">{t("ledger.customer.This Year")}</SelectItem>
                  <SelectItem value="custom">{t("ledger.customer.Custom Range")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.customer.From Date")}</label>
              <Input
                type="date" value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPeriodPreset("custom"); setPage(1) }}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.customer.To Date")}</label>
              <Input
                type="date" value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPeriodPreset("custom"); setPage(1) }}
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{t("ledger.customer.Opening Balance")}</label>
              <MoneyInput
                value={openingBalance}
                onChange={v => { setOpeningBalance(Number(v)); setPage(1) }}
                className="h-8 text-xs"
                placeholder={t("ledger.customer.Opening hint")}
              />
            </div>
          </div>

          {/* Quick clear */}
          {(dateFrom || dateTo || selectedCustomerId || accountStatus !== "all") && (
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setPeriodPreset("all_time"); setSelectedCustomerId(""); setAccountStatus("all"); setOpeningBalance(0); setPage(1) }}
                className="text-[10px] text-indigo-600 hover:underline"
              >
                {t("ledger.customer.Clear all filters")}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <StatCard
          title={t("ledger.customer.Total Debit")} value={formatCurrency(totalDebit)}
          subtext={t("ledger.customer.Charged to customer")}
          icon={TrendingUp} iconBg="bg-rose-100" subtextOnMobile
        />
        <StatCard
          title={t("ledger.customer.Total Credit")} value={formatCurrency(totalCredit)}
          subtext={t("ledger.customer.Payments received")}
          icon={TrendingDown} iconBg="bg-emerald-100" subtextOnMobile
        />
        <div className={cn(
          "relative overflow-hidden rounded-xl bg-white px-2.5 py-2 sm:px-4 sm:py-3 min-w-0",
          "border border-slate-100 border-t-2",
          "shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
          scenario.color.includes("rose") ? "border-t-rose-500" : scenario.color.includes("emerald") ? "border-t-emerald-500" : "border-t-slate-400"
        )}>
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shadow-sm shrink-0",
              scenario.color.includes("rose") ? "bg-rose-600" : scenario.color.includes("emerald") ? "bg-emerald-600" : "bg-slate-600")}>
              <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <div className={cn("inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full border shrink-0", scenario.color)}>
              {scenario.icon}
              {scenario.label === "Outstanding Due" ? t("ledger.customer.Outstanding Due") : scenario.label === "Advance / Overpaid" ? t("ledger.customer.Advance Overpaid") : t("ledger.customer.Account Settled")}
            </div>
          </div>
          <p className={cn(
            "font-bold text-slate-900 leading-none tracking-tight mb-1 truncate",
            formatCurrency(Math.abs(closingBalance)).length > 14 ? "text-xs sm:text-sm" : formatCurrency(Math.abs(closingBalance)).length > 10 ? "text-sm sm:text-base" : "text-base sm:text-xl"
          )}>
            {formatCurrency(Math.abs(closingBalance))}
          </p>
          <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">{t("ledger.customer.Net Balance")}</p>
        </div>
      </div>

      {/* ── Ledger table ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">{t("ledger.customer.No tx filters")}</p>
            <p className="text-[10px] text-slate-300 mt-1">{t("ledger.customer.Try changing")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="px-3 py-2 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-slate-800 truncate min-w-0">
                {selectedCustomer ? `${selectedCustomer.name} — ${t("ledger.customer.Account Statement")}` : `${t("ledger.customer.All Customers Statement")} — ${t("ledger.customer.Account Statement")}`}
                {(dateFrom || dateTo) && (
                  <span className="ml-2 text-[10px] font-normal text-slate-400">
                    {dateFrom || t("ledger.customer.Start")} → {dateTo || t("ledger.customer.Now")}
                  </span>
                )}
              </CardTitle>
              <div className="hidden sm:flex items-center gap-2.5 text-[10px] text-slate-400 shrink-0">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />{t("ledger.customer.Sale Dr")}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{t("ledger.customer.Payment Cr")}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">

            {/* Mobile cards */}
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
                      {!selectedCustomerId && entry.customerName && (
                        <p className="text-[10px] font-medium text-slate-500 truncate">{entry.customerName}</p>
                      )}
                    </div>
                    <p className={cn("text-xs font-medium leading-snug truncate", entry.type === "opening" ? "text-slate-500 italic" : "text-slate-800")}>
                      {entry.description}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">{entry.reference}</p>
                    <div className="flex items-center justify-between gap-2 pt-1 mt-1 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {entry.debit > 0 && <span className="text-rose-600">{t("ledger.customer.Dr")} {formatCurrency(entry.debit)}</span>}
                        {entry.credit > 0 && <span className="text-emerald-600">{t("ledger.customer.Cr")} {formatCurrency(entry.credit)}</span>}
                      </div>
                      <p className={cn("text-xs font-bold shrink-0", entry.balance > 0 ? "text-rose-600" : entry.balance < 0 ? "text-emerald-600" : "text-slate-400")}>
                        {formatCurrency(Math.abs(entry.balance))}{entry.balance > 0 ? ` ${t("ledger.customer.Dr")}` : entry.balance < 0 ? ` ${t("ledger.customer.Cr")}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center pr-2 shrink-0">
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </button>
              ))}
              <div className="px-3 py-2 bg-slate-50 border-t-2 border-slate-200">
                <div className="flex justify-between text-xs"><span className="font-semibold text-slate-600">{t("ledger.customer.Totals")}</span></div>
                <div className="flex justify-between text-xs mt-1"><span className="text-slate-500">{t("ledger.customer.Debit")}</span><span className="font-bold text-rose-700">{formatCurrency(totalDebit)}</span></div>
                <div className="flex justify-between text-xs mt-1"><span className="text-slate-500">{t("ledger.customer.Credit")}</span><span className="font-bold text-emerald-700">{formatCurrency(totalCredit)}</span></div>
                <div className="flex justify-between text-xs mt-1 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-700">{t("ledger.customer.Balance")}</span>
                  <span className={cn("font-bold", closingBalance > 0 ? "text-rose-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400")}>
                    {formatCurrency(Math.abs(closingBalance))}{closingBalance > 0 ? ` ${t("ledger.customer.Dr")}` : closingBalance < 0 ? ` ${t("ledger.customer.Cr")}` : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.customer.Date")}</th>
                    {!selectedCustomerId && <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.customer.Customer")}</th>}
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.customer.Reference")}</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t("ledger.customer.Description col")}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-rose-500 uppercase tracking-wider whitespace-nowrap">{t("ledger.customer.Debit")}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-emerald-500 uppercase tracking-wider whitespace-nowrap">{t("ledger.customer.Credit")}</th>
                    <th className="text-right px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{t("ledger.customer.Balance")}</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map(entry => (
                    <tr key={entry.id} className={cn("hover:bg-slate-50/70 transition-colors", entry.type === "opening" && "bg-slate-50 italic")}>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-xs">{formatDate(entry.date)}</td>
                      {!selectedCustomerId && <td className="px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">{entry.customerName || "-"}</td>}
                      <td className="px-3 py-2 font-mono text-xs text-slate-400 whitespace-nowrap">{entry.reference}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{entry.description}</td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-rose-600 whitespace-nowrap">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-medium text-emerald-600 whitespace-nowrap">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : <span className="text-slate-300">-</span>}
                      </td>
                      <td className={cn("px-3 py-2 text-right text-xs font-bold whitespace-nowrap",
                        entry.balance > 0 ? "text-rose-600" : entry.balance < 0 ? "text-emerald-600" : "text-slate-400")}>
                        {formatCurrency(Math.abs(entry.balance))}
                        <span className="font-medium ml-0.5 text-[10px]">
                          {entry.balance > 0 ? ` ${t("ledger.customer.Dr")}` : entry.balance < 0 ? ` ${t("ledger.customer.Cr")}` : ""}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => setDrawerEntry(entry)}
                          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <td colSpan={!selectedCustomerId ? 4 : 3} className="px-3 py-2 text-xs text-slate-500 text-right">{t("ledger.customer.Totals")}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-rose-700 whitespace-nowrap">{formatCurrency(totalDebit)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(totalCredit)}</td>
                    <td className={cn("px-3 py-2 text-right text-xs font-bold whitespace-nowrap",
                      closingBalance > 0 ? "text-rose-600" : closingBalance < 0 ? "text-emerald-600" : "text-slate-400")}>
                      {formatCurrency(Math.abs(closingBalance))}
                      <span className="font-medium ml-0.5 text-[10px]">{closingBalance > 0 ? ` ${t("ledger.customer.Dr")}` : closingBalance < 0 ? ` ${t("ledger.customer.Cr")}` : ""}</span>
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
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} {t("ledger.customer.of")} {filtered.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <span className="text-xs text-slate-500">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Entry detail modal ─────────────────────────────────────────────── */}
      <EntryDetailModal
        entry={drawerEntry}
        sales={sales}
        payments={customerPayments}
        onClose={() => setDrawerEntry(null)}
      />

      {/* ── Collect Payment dialog ──────────────────────────────────────────── */}
      <Dialog open={collectOpen} onOpenChange={v => { if (!v) setCollectOpen(false) }}>
        <DialogContent className="w-[96vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">{t("ledger.customer.Collect Payment")}</DialogTitle>
            <DialogDescription className="text-slate-500 text-sm">
              {selectedCustomer?.name} — {t("ledger.customer.record a payment")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Running balance banner */}
            {(() => {
              const netDue = customerBalanceMap.get(selectedCustomerId) ?? 0
              const amt    = parseFloat(collectAmount) || 0
              const after  = netDue - amt
              return (
                <div className={cn(
                  "rounded-xl px-4 py-3.5 border",
                  netDue > 0 ? "bg-rose-50 border-rose-200" : netDue < 0 ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        {netDue > 0 ? t("ledger.customer.Running Balance Due") : netDue < 0 ? t("ledger.customer.Advance on Account") : t("ledger.customer.Settled")}
                      </p>
                      <p className={cn("text-2xl font-extrabold tabular-nums", netDue > 0 ? "text-rose-700" : netDue < 0 ? "text-emerald-700" : "text-slate-400")}>
                        {formatCurrency(Math.abs(netDue))}
                      </p>
                    </div>
                    {amt > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{t("ledger.customer.After Collection")}</p>
                        <p className={cn("text-lg font-bold tabular-nums", after > 0 ? "text-rose-600" : after < 0 ? "text-emerald-600" : "text-emerald-600")}>
                          {formatCurrency(Math.abs(after))}
                          <span className="text-xs font-medium ml-1">{after > 0 ? t("ledger.customer.Dr") : after <= 0 ? t("ledger.customer.Cr Settled") : ""}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Amount */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                {t("ledger.customer.Amount Received Field")}
              </label>
              <MoneyInput
                min="1" placeholder={t("ledger.customer.Enter amount")}
                value={collectAmount}
                onChange={v => setCollectAmount(v)}
                className="text-sm"
                autoFocus
              />
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                {t("ledger.customer.Payment Method Field")}
              </label>
              <Select value={collectMethod} onValueChange={setCollectMethod}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cash", "Bank Transfer", "JazzCash", "EasyPaisa", "Other"].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Finance account */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                {t("ledger.customer.Deposit Account")}
              </label>
              <Select value={collectAccountId} onValueChange={setCollectAccountId}>
                <SelectTrigger className="text-sm"><SelectValue placeholder={t("ledger.customer.Select account")} /></SelectTrigger>
                <SelectContent>
                  {financeAccounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — {formatCurrency(a.currentBalance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCollectPayment}
              disabled={collecting || !collectAmount || parseFloat(collectAmount) <= 0 || !collectAccountId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {collecting ? t("ledger.customer.Saving") : `${t("ledger.customer.Collect")} ${parseFloat(collectAmount) > 0 ? formatCurrency(parseFloat(collectAmount)) : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function CustomerLedgerPage() {
  return (
    <PermissionGate permission="ledger.view">
      <CustomerLedgerPageInner />
    </PermissionGate>
  )
}

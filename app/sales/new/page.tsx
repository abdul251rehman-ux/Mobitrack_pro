"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Search, Trash2, Plus, Minus, ShoppingCart, Smartphone,
  User, UserPlus, ChevronLeft, Headphones, X, CheckCircle, AlertCircle,
  Banknote, Wallet, Landmark, Check, Receipt, FileText, Printer, Eye,
} from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { getCustomers, createCustomer } from "@/lib/api/customers"
import { getMobiles, getAccessories } from "@/lib/api/products"
import { getUsedPhones } from "@/lib/api/inventory"
import { createSale, generateNextInvoiceNumber } from "@/lib/api/sales"
import { getTenant } from "@/lib/api/settings"
import type { ShopInfo } from "@/lib/pdf/invoice"
import { getFinanceAccounts } from "@/lib/api/finance"
import type { Customer, Mobile, Accessory, Sale } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"
import type { UsedPhone } from "@/data/used-phones"
import { formatCurrency, cn, todayPKT } from "@/lib/utils"

import { PageWrapper } from "@/components/layout/page-wrapper"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SplitPayment {
  accountId: string
  amount: string // string for controlled input
}

interface CartItem {
  id: string
  productId: string
  productName: string
  productType: "Mobile" | "Accessory" | "UsedPhone"
  quantity: number
  unitPrice: number
  costPrice: number
  discount: number
  lineTotal: number
  imei?: string
  color?: string
  storage?: string
  maxStock: number
}

type ProductResult = {
  id: string
  name: string
  type: "Mobile" | "Accessory" | "UsedPhone"
  price: number
  costPrice: number
  stock: number
  imei?: string
  color?: string
  storage?: string
  category?: string
}

function uid() {
  return `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Finance account icon ──────────────────────────────────────────────────────

function AccountIcon({ type }: { type: string }) {
  if (type === "bank") return <Landmark className="w-4 h-4" />
  if (type === "wallet") return <Wallet className="w-4 h-4" />
  return <Banknote className="w-4 h-4" />
}

// ─── Review Sale Modal ─────────────────────────────────────────────────────────

function ReviewSaleModal({
  open,
  onClose,
  cart,
  onQtyChange,
  onRemove,
  onImeiChange,
  accounts,
  customer,
  customerMode,
  onConfirm,
  submitting,
}: {
  open: boolean
  onClose: () => void
  cart: CartItem[]
  onQtyChange: (id: string, delta: number) => void
  onRemove: (id: string) => void
  onImeiChange: (id: string, imei: string) => void
  accounts: FinanceAccount[]
  customer: Customer | undefined
  customerMode: "walkin" | "existing"
  onConfirm: (opts: { discount: number; tax: number; splitPayments: SplitPayment[]; notes: string }) => void
  submitting: boolean
}) {
  const [discount, setDiscount] = useState("0")
  const [tax, setTax] = useState("0")
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([])
  const [notes, setNotes] = useState("")

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [cart])
  const discountNum = parseFloat(discount) || 0
  const taxNum = parseFloat(tax) || 0
  const grandTotal = Math.max(0, subtotal - discountNum + taxNum)

  const totalReceived = splitPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const changeDue = totalReceived - grandTotal
  const outstanding = Math.max(0, grandTotal - totalReceived)

  const belowCostItems = cart.filter(i => i.costPrice > 0 && i.unitPrice < i.costPrice)
  const custLabel = customerMode === "walkin" ? "Walk-in Customer" : customer?.name ?? "Unknown"

  function isSelected(accId: string) {
    return splitPayments.some(p => p.accountId === accId)
  }

  function toggleAccount(accId: string) {
    if (isSelected(accId)) {
      setSplitPayments(prev => prev.filter(p => p.accountId !== accId))
    } else {
      setSplitPayments(prev => [...prev, { accountId: accId, amount: "" }])
    }
  }

  function setAmount(accId: string, val: string) {
    setSplitPayments(prev => prev.map(p => p.accountId === accId ? { ...p, amount: val } : p))
  }

  const typeColors = {
    cash:   { selected: "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300", idle: "border-slate-200 hover:border-emerald-200 bg-white", icon: { on: "bg-emerald-200 text-emerald-700", off: "bg-slate-100 text-slate-500" } },
    bank:   { selected: "border-blue-400 bg-blue-50 ring-1 ring-blue-300",           idle: "border-slate-200 hover:border-blue-200 bg-white",    icon: { on: "bg-blue-200 text-blue-700",    off: "bg-slate-100 text-slate-500" } },
    wallet: { selected: "border-violet-400 bg-violet-50 ring-1 ring-violet-300",     idle: "border-slate-200 hover:border-violet-200 bg-white",  icon: { on: "bg-violet-200 text-violet-700", off: "bg-slate-100 text-slate-500" } },
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !submitting) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">Review Sale</DialogTitle>

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 pt-5 pb-4 rounded-t-2xl pr-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Review Sale</h2>
              <p className="text-xs text-white/70 mt-0.5">{custLabel} · {cart.length} item type(s)</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* ── Items ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
              <ShoppingCart className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Cart Items</span>
            </div>
            <div className="divide-y divide-slate-100">
              {cart.map(item => (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    item.productType === "Mobile" ? "bg-blue-100" :
                    item.productType === "UsedPhone" ? "bg-amber-100" : "bg-emerald-100"
                  )}>
                    {item.productType === "Accessory"
                      ? <Headphones className="w-4 h-4 text-emerald-600" />
                      : item.productType === "UsedPhone"
                        ? <Smartphone className="w-4 h-4 text-amber-600" />
                        : <Smartphone className="w-4 h-4 text-blue-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.productName}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {[item.color, item.storage, item.imei ? `IMEI: ${item.imei}` : ""].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-[10px] font-semibold text-emerald-600">{formatCurrency(item.unitPrice)} each</p>
                    {/* IMEI field: pre-filled for UsedPhone, editable for Mobile, hidden for Accessory */}
                    {item.productType !== "Accessory" && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={15}
                          placeholder={item.productType === "UsedPhone" ? "IMEI (pre-filled)" : "IMEI (optional — add at sale)"}
                          value={item.imei ?? ""}
                          readOnly={item.productType === "UsedPhone"}
                          onChange={e => onImeiChange(item.id, e.target.value.replace(/\D/g, "").slice(0, 15))}
                          className={cn(
                            "h-7 text-[11px] font-mono rounded-md border px-2 w-full outline-none",
                            item.productType === "UsedPhone"
                              ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                              : "bg-white border-slate-200 focus:border-blue-400 text-slate-700"
                          )}
                        />
                        {item.imei && item.imei.length === 15 && (
                          <span className="text-[9px] text-emerald-600 font-bold shrink-0">✓</span>
                        )}
                        {item.imei && item.imei.length > 0 && item.imei.length < 15 && (
                          <span className="text-[9px] text-amber-500 font-bold shrink-0">{15 - item.imei.length} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  {(item.productType === "Accessory" || (item.productType === "Mobile" && !item.imei)) ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => onQtyChange(item.id, -1)} disabled={item.quantity <= 1}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center transition-colors">
                        <Minus className="w-3 h-3 text-slate-600" />
                      </button>
                      <span className="w-7 text-center text-sm font-bold text-slate-800">{item.quantity}</span>
                      <button type="button" onClick={() => onQtyChange(item.id, +1)} disabled={item.quantity >= item.maxStock}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-emerald-100 disabled:opacity-40 flex items-center justify-center transition-colors">
                        <Plus className="w-3 h-3 text-slate-600" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 shrink-0 w-16 text-center">Qty: 1</span>
                  )}
                  <div className="w-20 text-right shrink-0">
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </div>
                  <button type="button" onClick={() => onRemove(item.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Totals ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
              <Receipt className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Order Totals</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Discount (Rs)</Label>
                  <Input type="number" min={0} value={discount} onChange={e => setDiscount(e.target.value)} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Tax / Other (Rs)</Label>
                  <Input type="number" min={0} value={tax} onChange={e => setTax(e.target.value)} className="h-9 text-sm" placeholder="0" />
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-slate-500">Subtotal</span>
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(subtotal)}</span>
                </div>
                {discountNum > 0 && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Discount</span>
                    <span className="text-sm text-red-600">−{formatCurrency(discountNum)}</span>
                  </div>
                )}
                {taxNum > 0 && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Tax</span>
                    <span className="text-sm text-slate-600">+{formatCurrency(taxNum)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-50">
                  <span className="text-sm font-bold text-emerald-700">Grand Total</span>
                  <span className="text-lg font-extrabold text-emerald-700">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
              {belowCostItems.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">
                    <span className="font-semibold">Selling below cost: </span>
                    {belowCostItems.map(i => i.productName).join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Split Payment ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
              <Banknote className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Payment — Select Accounts</span>
              <span className="ml-auto text-[10px] text-slate-400 font-normal">Select one or more accounts</span>
            </div>
            <div className="p-4 space-y-3">
              {accounts.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">No finance accounts found. Set up accounts in Finance first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.map(acc => {
                    const selected = isSelected(acc.id)
                    const type = (acc.type ?? "cash") as "cash" | "bank" | "wallet"
                    const colors = typeColors[type] ?? typeColors.cash
                    const split = splitPayments.find(p => p.accountId === acc.id)
                    return (
                      <div key={acc.id} className="space-y-2">
                        {/* Account toggle card */}
                        <button type="button" onClick={() => toggleAccount(acc.id)}
                          className={cn("w-full rounded-xl border p-3 text-left transition-all duration-150 flex items-center gap-3", selected ? colors.selected : colors.idle)}>
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", selected ? colors.icon.on : colors.icon.off)}>
                            <AccountIcon type={type} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{acc.name}</p>
                            {acc.bankName && <p className="text-[10px] text-slate-400 truncate">{acc.bankName}{acc.accountTitle ? ` · ${acc.accountTitle}` : ""}</p>}
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(acc.currentBalance)}</p>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                            selected ? "border-emerald-500 bg-emerald-500" : "border-slate-300 bg-white"
                          )}>
                            {selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </button>

                        {/* Amount input — only when selected */}
                        {selected && (
                          <div className="ml-3 pl-9 flex items-center gap-2">
                            <div className="flex-1 space-y-0.5">
                              <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                Amount received via {acc.name}
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={split?.amount ?? ""}
                                onChange={e => setAmount(acc.id, e.target.value)}
                                className="h-8 text-sm font-semibold"
                                autoFocus
                              />
                            </div>
                            {split?.amount && parseFloat(split.amount) > 0 && (
                              <span className="text-xs font-bold text-emerald-600 mt-4 shrink-0">
                                {formatCurrency(parseFloat(split.amount))}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Summary row */}
              {splitPayments.length > 0 && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-100 mt-1">
                  {splitPayments.map(p => {
                    const acc = accounts.find(a => a.id === p.accountId)
                    const amt = parseFloat(p.amount) || 0
                    if (!acc || amt === 0) return null
                    return (
                      <div key={p.accountId} className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-xs text-slate-500">{acc.name}</span>
                        <span className="text-xs font-semibold text-slate-700">{formatCurrency(amt)}</span>
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-bold text-slate-700">Total Received</span>
                    <span className={cn("text-sm font-extrabold tabular-nums", totalReceived >= grandTotal ? "text-emerald-700" : "text-amber-600")}>
                      {formatCurrency(totalReceived)}
                    </span>
                  </div>
                  {changeDue > 0 && (
                    <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50">
                      <span className="text-xs text-emerald-700">Change to Return</span>
                      <span className="text-xs font-bold text-emerald-700">{formatCurrency(changeDue)}</span>
                    </div>
                  )}
                  {outstanding > 0 && (
                    <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50">
                      <span className="text-xs text-amber-700">Outstanding Balance</span>
                      <span className="text-xs font-bold text-amber-700">{formatCurrency(outstanding)} due</span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment status */}
              {splitPayments.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Payment Status:</span>
                  <span className={cn(
                    "text-xs font-bold px-2.5 py-0.5 rounded-full border",
                    totalReceived >= grandTotal ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    totalReceived > 0           ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                  "bg-red-50 text-red-700 border-red-200"
                  )}>
                    {totalReceived >= grandTotal ? "Paid in Full" : totalReceived > 0 ? "Partial Payment" : "Unpaid"}
                  </span>
                  {splitPayments.filter(p => parseFloat(p.amount) > 0).length > 1 && (
                    <span className="text-[10px] text-slate-400 font-medium">Split across {splitPayments.filter(p => parseFloat(p.amount) > 0).length} accounts</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Warranty 6 months, customer requested gift wrap..." className="h-9 text-sm" />
          </div>

          <Separator />

          {/* ── Confirm ── */}
          <Button type="button"
            disabled={submitting || cart.length === 0}
            onClick={() => onConfirm({ discount: discountNum, tax: taxNum, splitPayments, notes })}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm gap-2">
            <CheckCircle className="w-4 h-4" />
            {submitting ? "Processing..." : `Complete Sale — ${formatCurrency(grandTotal)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewSalePage() {
  const router = useRouter()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [mobiles, setMobiles] = useState<Mobile[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [usedPhones, setUsedPhones] = useState<UsedPhone[]>([])
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [shopInfo, setShopInfo] = useState<ShopInfo>({ shopName: "Mobile Shop", shopAddress: "", shopPhone: "" })
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [c, m, a, u, accs, tenant] = await Promise.all([
          getCustomers(), getMobiles(), getAccessories(), getUsedPhones(), getFinanceAccounts(), getTenant(),
        ])
        setCustomers(c); setMobiles(m); setAccessories(a); setUsedPhones(u)
        setAccounts(accs)
        if (tenant) setShopInfo({ shopName: tenant.name, shopAddress: tenant.address ?? "", shopPhone: tenant.phone ?? "", shopLogo: tenant.logo ?? "" })
      } catch { toast.error("Failed to load data") }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // ── Customer ──────────────────────────────────────────────────────────────
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing">("walkin")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim()
    if (!q) return customers.slice(0, 10)
    return customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 10)
  }, [customerSearch, customers])

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [selectedCustomerId, customers]
  )

  async function handleCreateCustomer() {
    if (!newName.trim() || !newPhone.trim()) { toast.error("Name and phone required"); return }
    try {
      const created = await createCustomer({
        name: newName.trim(), phone: newPhone.trim(), email: "", address: "",
        totalPurchases: 0, totalSpent: 0, lastPurchaseDate: todayPKT(), loyaltyTier: "Bronze",
      } as any)
      setCustomers(prev => [created, ...prev])
      setSelectedCustomerId(created.id)
      setCustomerMode("existing")
      setCustomerSearch(created.name)
      setShowNewCustomer(false)
      setNewName(""); setNewPhone("")
      toast.success(`Customer "${created.name}" created!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create customer")
    }
  }

  // ── Product search ────────────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState("")
  const [productDropdownOpen, setProductDropdownOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState<"All" | "Mobile" | "Accessory" | "UsedPhone">("All")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [priceFilter, setPriceFilter] = useState<"" | "under5k" | "5k-15k" | "15k-40k" | "over40k">("")

  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    if (typeFilter === "All" || typeFilter === "Mobile") mobiles.forEach(m => m.category && cats.add(m.category))
    if (typeFilter === "All" || typeFilter === "Accessory") accessories.forEach(a => a.category && cats.add(a.category))
    return [...cats].sort()
  }, [typeFilter, mobiles, accessories])

  const productResults = useMemo((): ProductResult[] => {
    const q = productSearch.toLowerCase().trim()
    function matchesPrice(price: number) {
      if (!priceFilter) return true
      if (priceFilter === "under5k") return price < 5000
      if (priceFilter === "5k-15k") return price >= 5000 && price <= 15000
      if (priceFilter === "15k-40k") return price > 15000 && price <= 40000
      return price > 40000
    }
    const mResults: ProductResult[] = (typeFilter === "All" || typeFilter === "Mobile") ? mobiles
      .filter(m => m.stock > 0 && matchesPrice(m.sellingPrice)
        && (!categoryFilter || m.category === categoryFilter)
        && (!q || `${m.brand} ${m.model} ${m.color} ${m.storage} ${m.ram} ${m.imei} ${m.category}`.toLowerCase().includes(q)))
      .map(m => ({ id: m.id, name: `${m.brand} ${m.model}`, type: "Mobile" as const, price: m.sellingPrice, costPrice: m.purchasePrice, stock: m.stock, imei: m.imei, color: m.color, storage: m.storage, category: m.category }))
    : []
    const aResults: ProductResult[] = (typeFilter === "All" || typeFilter === "Accessory") ? accessories
      .filter(a => a.stock > 0 && matchesPrice(a.sellingPrice)
        && (!categoryFilter || a.category === categoryFilter)
        && (!q || `${a.name} ${a.brand} ${a.category} ${a.sku} ${(a.compatibleModels || []).join(" ")} ${a.description || ""}`.toLowerCase().includes(q)))
      .map(a => ({ id: a.id, name: `${a.name} — ${a.brand}`, type: "Accessory" as const, price: a.sellingPrice, costPrice: a.purchasePrice, stock: a.stock, category: a.category }))
    : []
    const uResults: ProductResult[] = (typeFilter === "All" || typeFilter === "UsedPhone") ? usedPhones
      .filter(u => u.status === "in_stock" && matchesPrice(u.selling_price)
        && (!q || `${u.brand} ${u.model} ${u.color} ${u.storage} ${u.imei_number}`.toLowerCase().includes(q)))
      .map(u => ({ id: u.id, name: `${u.brand} ${u.model} (Used · ${u.condition_grade})`, type: "UsedPhone" as const, price: u.selling_price, costPrice: (u.purchase_price || 0) + (u.refurbishment_cost || 0), stock: 1, imei: u.imei_number, color: u.color, storage: u.storage }))
    : []
    return [...mResults, ...aResults, ...uResults].slice(0, 30)
  }, [productSearch, mobiles, accessories, usedPhones, typeFilter, categoryFilter, priceFilter])

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  function addToCart(p: ProductResult) {
    if (p.type === "UsedPhone" || (p.type === "Mobile" && p.imei)) {
      if (cartItems.some(c => c.productId === p.id)) { toast.error("Already in cart"); return }
      setCartItems(prev => [...prev, { id: uid(), productId: p.id, productName: p.name, productType: p.type, quantity: 1, unitPrice: p.price, costPrice: p.costPrice, discount: 0, lineTotal: p.price, imei: p.imei, color: p.color, storage: p.storage, maxStock: 1 }])
    } else {
      const existing = cartItems.find(c => c.productId === p.id)
      if (existing) {
        if (existing.quantity >= p.stock) { toast.error(`Max stock reached (${p.stock})`); return }
        setCartItems(prev => prev.map(c => c.id === existing.id ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * c.unitPrice } : c))
      } else {
        setCartItems(prev => [...prev, { id: uid(), productId: p.id, productName: p.name, productType: p.type as "Mobile" | "Accessory", quantity: 1, unitPrice: p.price, costPrice: p.costPrice, discount: 0, lineTotal: p.price, color: p.color, storage: p.storage, maxStock: p.stock }])
      }
    }
    setProductSearch("")
    setProductDropdownOpen(false)
    toast.success(`${p.name} added`)
  }

  function removeFromCart(id: string) { setCartItems(prev => prev.filter(c => c.id !== id)) }

  function updateCartImei(id: string, imei: string) {
    setCartItems(prev => prev.map(c => c.id === id ? { ...c, imei } : c))
  }

  function adjustCartQty(id: string, delta: number) {
    setCartItems(prev => prev.map(c => {
      if (c.id !== id) return c
      const newQty = Math.max(1, Math.min(c.maxStock, c.quantity + delta))
      return { ...c, quantity: newQty, lineTotal: newQty * c.unitPrice }
    }))
  }

  // ── Review modal ──────────────────────────────────────────────────────────
  const [reviewOpen, setReviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleOpenReview() {
    if (cartItems.length === 0) { toast.error("Add items to cart first"); return }
    if (customerMode === "existing" && !selectedCustomerId) { toast.error("Select a customer"); return }
    setReviewOpen(true)
  }

  async function handleConfirmSale({ discount, tax, splitPayments, notes }: {
    discount: number; tax: number; splitPayments: SplitPayment[]; notes: string
  }) {
    if (submitting) return
    setSubmitting(true)

    try {
      const tenantId = await getTenantId()
      const subtotal = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
      const grandTotal = Math.max(0, subtotal - discount + tax)

      // Resolved split payments — only those with a positive amount
      const activeSplits = splitPayments
        .map(p => ({ accountId: p.accountId, amount: parseFloat(p.amount) || 0 }))
        .filter(p => p.amount > 0)
      const totalReceived = activeSplits.reduce((s, p) => s + p.amount, 0)
      const changeDue = Math.max(0, totalReceived - grandTotal)

      // Derive a primary payment method label for the sale record
      const primaryAccount = activeSplits.length > 0 ? accounts.find(a => a.id === activeSplits[0].accountId) : undefined
      const paymentMethod = activeSplits.length > 1
        ? "Split Payment"
        : primaryAccount
          ? (primaryAccount.type === "cash" ? "Cash" : primaryAccount.type === "bank" ? "Bank Transfer" : primaryAccount.bankName || "Mobile Wallet")
          : "Cash"

      // Stock re-check
      for (const item of cartItems) {
        if (item.productType === "UsedPhone") {
          const { data } = await supabase.from("used_phones").select("status").eq("id", item.productId).single()
          if (!data || data.status !== "in_stock") { toast.error(`"${item.productName}" no longer available`); setSubmitting(false); return }
        } else if (item.productType === "Mobile") {
          const { data } = await supabase.from("mobiles").select("stock").eq("id", item.productId).single()
          if (!data || data.stock < item.quantity) { toast.error(`"${item.productName}" — only ${data?.stock ?? 0} left`); setSubmitting(false); return }
        } else {
          const { data } = await supabase.from("accessories").select("stock").eq("id", item.productId).single()
          if (!data || data.stock < item.quantity) { toast.error(`"${item.productName}" — only ${data?.stock ?? 0} left`); setSubmitting(false); return }
        }
      }

      const invoiceNumber = await generateNextInvoiceNumber(tenantId)
      const custName = customerMode === "walkin" ? "Walk-in Customer" : selectedCustomer?.name ?? ""
      const custPhone = customerMode === "walkin" ? "" : selectedCustomer?.phone ?? ""
      const today = todayPKT()

      const createdSaleRecord = await createSale({
        invoiceNumber, date: today,
        customerId: customerMode === "walkin" ? "" : selectedCustomerId,
        customerName: custName, customerPhone: custPhone,
        subtotal, discount, tax, total: grandTotal,
        paymentMethod, amountReceived: totalReceived, changeDue, status: "Completed",
        notes: notes || undefined, items: [],
      } as any, cartItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productType: item.productType === "UsedPhone" ? "Mobile" : item.productType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        lineTotal: item.unitPrice * item.quantity,
      })) as any)

      // Update inventory
      for (const item of cartItems) {
        if (item.productType === "Mobile" && item.imei) {
          await supabase.from("imei_records")
            .update({ device_status: "sold", sold_date: today, customer_name: custName, customer_phone: custPhone })
            .eq("imei_number", item.imei).eq("tenant_id", tenantId)
        } else if (item.productType === "UsedPhone") {
          await supabase.from("used_phones")
            .update({ status: "sold", sold_date: today, customer_name: custName })
            .eq("id", item.productId).eq("tenant_id", tenantId)
        }
      }

      // Payment records — one per split account
      const entityId = customerMode === "existing" && selectedCustomerId ? selectedCustomerId : null
      for (const split of activeSplits) {
        const acc = accounts.find(a => a.id === split.accountId)
        const method = acc ? (acc.type === "cash" ? "Cash" : acc.type === "bank" ? "Bank Transfer" : acc.bankName || "Mobile Wallet") : "Cash"
        await supabase.from("payments").insert({
          tenant_id: tenantId, date: today, type: "Received", entity_type: "Customer",
          entity_id: entityId, entity_name: custName, reference_type: "Sale",
          reference_number: invoiceNumber, amount: split.amount, method, status: "Completed",
          notes: `Payment for ${invoiceNumber}${activeSplits.length > 1 ? ` (${acc?.name ?? method})` : ""}`,
        })
      }
      // Outstanding balance if partial
      const pending = grandTotal - totalReceived
      if (pending > 0) {
        await supabase.from("payments").insert({
          tenant_id: tenantId, date: today, type: "Received", entity_type: "Customer",
          entity_id: entityId, entity_name: custName, reference_type: "Sale",
          reference_number: invoiceNumber, amount: pending, method: paymentMethod,
          status: "Pending", notes: `Outstanding for ${invoiceNumber}`,
        })
      }

      // Finance transactions — one per split account, update each balance
      for (const split of activeSplits) {
        await supabase.from("finance_transactions").insert({
          tenant_id: tenantId, date: today, type: "sale_receipt",
          account_id: split.accountId, amount: split.amount,
          reference_type: "Sale", reference_number: invoiceNumber,
          description: `Sale received — ${invoiceNumber}`,
        })
        const { data: accRow } = await supabase.from("finance_accounts").select("current_balance").eq("id", split.accountId).single()
        if (accRow) {
          await supabase.from("finance_accounts").update({ current_balance: (accRow as any).current_balance + split.amount }).eq("id", split.accountId)
        }
      }
      // Link primary account on the sale record
      if (activeSplits.length > 0) {
        await supabase.from("sales").update({ account_id: activeSplits[0].accountId }).eq("invoice_number", invoiceNumber).eq("tenant_id", tenantId)
      }

      toast.success(`Sale ${invoiceNumber} completed!`, { description: `${cartItems.length} item(s) · ${formatCurrency(grandTotal)}`, duration: 4000 })
      setCompletedSale(createdSaleRecord)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create sale")
      setSubmitting(false)
    }
  }

  if (loading) {
    return <PageWrapper><div className="text-center py-20 text-slate-500 text-sm">Loading...</div></PageWrapper>
  }

  // ── Post-sale success screen ──────────────────────────────────────────────
  if (completedSale) {
    return (
      <PageWrapper>
        <div className="max-w-lg mx-auto mt-16 flex flex-col items-center gap-6">
          {/* Success icon */}
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-600" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">Sale Complete!</h1>
            <p className="text-slate-500 text-sm mt-1">Invoice {completedSale.invoiceNumber} — {completedSale.customerName}</p>
          </div>

          {/* Summary card */}
          <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Order Summary</span>
              <span className="text-xs font-mono text-slate-500">{completedSale.invoiceNumber}</span>
            </div>
            <div className="px-5 py-4 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-700">{formatCurrency(completedSale.subtotal)}</span>
              </div>
              {completedSale.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <span className="font-medium text-red-600">− {formatCurrency(completedSale.discount)}</span>
                </div>
              )}
              {completedSale.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tax</span>
                  <span className="font-medium text-slate-700">+ {formatCurrency(completedSale.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-slate-100 pt-2.5">
                <span className="text-slate-800">Total</span>
                <span className="text-slate-900">{formatCurrency(completedSale.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount Received</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(completedSale.amountReceived)}</span>
              </div>
              {completedSale.changeDue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Change Returned</span>
                  <span className="font-semibold text-emerald-700">{formatCurrency(completedSale.changeDue)}</span>
                </div>
              )}
              {completedSale.total - completedSale.amountReceived > 0 && (
                <div className="flex justify-between text-sm rounded-lg bg-amber-50 px-3 py-2 -mx-1">
                  <span className="text-amber-700 font-medium">Outstanding Balance</span>
                  <span className="font-bold text-amber-700">{formatCurrency(completedSale.total - completedSale.amountReceived)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="w-full grid grid-cols-3 gap-2.5">
            {(["save", "print", "preview"] as const).map((action) => {
              const meta = {
                save:    { label: "Save PDF", Icon: FileText,  hover: "hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700" },
                print:   { label: "Print",    Icon: Printer,   hover: "hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700" },
                preview: { label: "Preview",  Icon: Eye,       hover: "hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700" },
              }[action]
              return (
                <button key={action}
                  onClick={async () => { const { generateInvoicePDF } = await import("@/lib/pdf/invoice"); generateInvoicePDF(completedSale!, shopInfo, action) }}
                  className={`flex flex-col items-center gap-2 py-4 px-3 rounded-xl border border-slate-200 bg-white ${meta.hover} text-slate-600 transition-all group`}
                >
                  <meta.Icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-semibold">{meta.label}</span>
                </button>
              )
            })}
          </div>

          <div className="w-full flex gap-2.5">
            <button
              onClick={() => { setCompletedSale(null); setCartItems([]); setSelectedCustomerId(""); setCustomerMode("walkin") }}
              className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              + New Sale
            </button>
            <button
              onClick={() => router.push("/sales")}
              className="flex-1 h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              View All Sales
            </button>
          </div>
        </div>
      </PageWrapper>
    )
  }

  const subtotalPreview = cartItems.reduce((s, i) => s + i.lineTotal, 0)

  return (
    <PageWrapper>
      <PageHeader title="New Sale" description="Build cart, then review and complete" icon={<ShoppingCart />} iconBg="bg-blue-600"
        action={<Link href="/sales"><Button variant="outline" className="gap-2"><ChevronLeft className="w-4 h-4" /> Back</Button></Link>} />

      <div className="space-y-4">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-[13px] font-semibold text-slate-900">Point of Sale</CardTitle>
                <CardDescription className="text-[11px] text-slate-400">Select customer, search and add products to cart</CardDescription>
              </div>
              {cartItems.length > 0 && (
                <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-100 rounded-full px-2.5 py-0.5">
                  {cartItems.length} item{cartItems.length !== 1 ? "s" : ""} · {formatCurrency(subtotalPreview)}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">

            {/* ── Customer ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">Customer Type</Label>
                <Select value={customerMode} onValueChange={(v: "walkin" | "existing") => { setCustomerMode(v); if (v === "walkin") { setSelectedCustomerId(""); setCustomerSearch("") } }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walkin">Walk-in Customer</SelectItem>
                    <SelectItem value="existing">Existing Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {customerMode === "existing" && (
                <div className="space-y-1.5 sm:col-span-2 relative">
                  <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><User className="w-3 h-3" /> Customer <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <Input placeholder="Search by name or phone..." value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); if (!e.target.value) setSelectedCustomerId("") }}
                      onFocus={() => setCustomerDropdownOpen(true)} className="h-9 text-sm pl-9" />
                    {customerDropdownOpen && customerSearch.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {filteredCustomers.length === 0
                          ? <div className="px-3 py-2 text-xs text-slate-400 text-center">No customers found</div>
                          : filteredCustomers.map(c => (
                            <button key={c.id} type="button"
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${c.id === selectedCustomerId ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
                              onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); setCustomerDropdownOpen(false) }}>
                              <span className="font-medium">{c.name}</span>
                              <span className="text-slate-400 ml-2">{c.phone}</span>
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                  {customerDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setCustomerDropdownOpen(false)} />}
                </div>
              )}

              {customerMode === "existing" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">&nbsp;</Label>
                  {!showNewCustomer ? (
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs w-full" onClick={() => setShowNewCustomer(true)}>
                      <UserPlus className="w-3.5 h-3.5" /> New Customer
                    </Button>
                  ) : (
                    <div className="flex gap-1.5">
                      <Input placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} className="h-9 text-xs flex-1" />
                      <Input placeholder="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="h-9 text-xs w-28" />
                      <Button size="sm" className="h-9 px-2 text-[10px]" onClick={handleCreateCustomer}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-9 px-1.5" onClick={() => setShowNewCustomer(false)}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  )}
                </div>
              )}

              {selectedCustomer && (
                <div className="sm:col-span-4 flex items-center gap-3 text-xs text-slate-500 bg-blue-50 rounded-lg px-3 py-2">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-slate-800">{selectedCustomer.name}</span>
                  <span>{selectedCustomer.phone}</span>
                  <Badge variant="outline" className="text-[10px]">{selectedCustomer.loyaltyTier}</Badge>
                  <span>Total Spent: {formatCurrency(selectedCustomer.totalSpent)}</span>
                </div>
              )}
            </div>

            {/* ── Product search ── */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5"><Search className="w-3 h-3" /> Add Products</Label>

              {/* Type filter chips */}
              <div className="flex flex-wrap gap-1.5">
                {(["All", "Mobile", "Accessory", "UsedPhone"] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => { setTypeFilter(t); setCategoryFilter(""); setProductDropdownOpen(true) }}
                    className={cn("h-7 px-3 rounded-full text-[11px] font-semibold border transition-all",
                      typeFilter === t
                        ? t === "Mobile" ? "bg-blue-600 text-white border-blue-600"
                          : t === "Accessory" ? "bg-emerald-600 text-white border-emerald-600"
                          : t === "UsedPhone" ? "bg-amber-500 text-white border-amber-500"
                          : "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400")}>
                    {t === "UsedPhone" ? "Used Phones" : t === "All" ? `All (${mobiles.filter(m=>m.stock>0).length + accessories.filter(a=>a.stock>0).length + usedPhones.filter(u=>u.status==="in_stock").length})` : t === "Mobile" ? `Mobiles (${mobiles.filter(m=>m.stock>0).length})` : `Accessories (${accessories.filter(a=>a.stock>0).length})`}
                  </button>
                ))}
              </div>

              {/* Category + Price filters */}
              <div className="flex gap-2">
                {allCategories.length > 0 && (
                  <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v === "__all" ? "" : v); setProductDropdownOpen(true) }}>
                    <SelectTrigger className="h-8 text-xs flex-1 max-w-[180px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All Categories</SelectItem>
                      {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex gap-1 flex-wrap">
                  {([["", "Any Price"], ["under5k", "< 5K"], ["5k-15k", "5K–15K"], ["15k-40k", "15K–40K"], ["over40k", "40K+"]] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => { setPriceFilter(val); setProductDropdownOpen(true) }}
                      className={cn("h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition-all",
                        priceFilter === val ? "bg-blue-50 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search input + dropdown */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <Input placeholder="Search by name, brand, model, color, IMEI, category, RAM…" value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setProductDropdownOpen(true) }}
                  onFocus={() => setProductDropdownOpen(true)} className="h-9 pl-9 pr-8 text-sm" />
                {productSearch && (
                  <button type="button" onClick={() => { setProductSearch(""); setProductDropdownOpen(true) }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {productDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
                    {productResults.length === 0 ? (
                      <div className="px-4 py-5 text-center">
                        <Search className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                        <p className="text-sm text-slate-400">No in-stock products match your filters</p>
                        <p className="text-[11px] text-slate-300 mt-0.5">Try adjusting the type, category, or price filter</p>
                      </div>
                    ) : (
                      <>
                        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            {productSearch.trim() ? `${productResults.length} result(s)` : `${productResults.length} in-stock`}
                          </span>
                          {(typeFilter !== "All" || categoryFilter || priceFilter) && (
                            <button type="button" onClick={() => { setTypeFilter("All"); setCategoryFilter(""); setPriceFilter("") }}
                              className="text-[10px] text-blue-600 hover:underline font-medium">Clear filters</button>
                          )}
                        </div>
                        {productResults.map(p => (
                          <button key={p.id + (p.imei || "")} type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                            onClick={() => addToCart(p)}>
                            <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                              p.type === "Mobile" ? "bg-blue-100" : p.type === "UsedPhone" ? "bg-amber-100" : "bg-emerald-100")}>
                              {p.type === "Accessory" ? <Headphones className="w-4 h-4 text-emerald-600" /> : <Smartphone className={cn("w-4 h-4", p.type === "UsedPhone" ? "text-amber-600" : "text-blue-600")} />}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="font-semibold text-slate-800 block truncate text-sm">{p.name}</span>
                              <span className="text-[11px] text-slate-400 flex flex-wrap gap-x-2 mt-0.5">
                                {(p as any).category && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{(p as any).category}</span>}
                                {p.color && <span className="flex items-center gap-1">🎨 {p.color}</span>}
                                {p.storage && <span>💾 {p.storage}</span>}
                                {p.imei && <span className="font-mono text-slate-500">IMEI: {p.imei}</span>}
                                <span className="text-slate-400">Qty: {p.stock}</span>
                              </span>
                            </span>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-extrabold text-slate-800">{formatCurrency(p.price)}</p>
                              <span className={cn("text-[10px] font-semibold",
                                p.type === "UsedPhone" ? "text-amber-600" : p.type === "Mobile" ? "text-blue-600" : "text-emerald-600")}>
                                {p.type === "UsedPhone" ? "Used" : p.type}
                              </span>
                            </div>
                            <Plus className="w-5 h-5 text-blue-500 shrink-0" />
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              {productDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setProductDropdownOpen(false)} />}
            </div>

            {/* ── Cart ── */}
            {cartItems.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cart ({cartItems.length} item{cartItems.length !== 1 ? "s" : ""})</p>
                {cartItems.map(item => (
                  <div key={item.id} className={cn(
                    "rounded-lg border px-3 py-2 flex items-center gap-3",
                    item.productType === "UsedPhone" ? "border-amber-200 bg-amber-50/30" :
                    item.productType === "Mobile" ? "border-blue-100 bg-blue-50/20" : "border-slate-200 bg-white"
                  )}>
                    <div className={cn("w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                      item.productType === "UsedPhone" ? "bg-amber-100" : item.productType === "Mobile" ? "bg-blue-100" : "bg-emerald-100")}>
                      {item.productType === "Accessory" ? <Headphones className="w-3.5 h-3.5 text-emerald-600" /> : <Smartphone className={cn("w-3.5 h-3.5", item.productType === "UsedPhone" ? "text-amber-600" : "text-blue-600")} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.productName}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {[item.color, item.storage, item.imei ? `IMEI: ${item.imei}` : ""].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {(item.productType === "Accessory" || (item.productType === "Mobile" && !item.imei)) && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => adjustCartQty(item.id, -1)} disabled={item.quantity <= 1}
                          className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                        <button onClick={() => adjustCartQty(item.id, +1)} disabled={item.quantity >= item.maxStock}
                          className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <span className="text-sm font-bold text-slate-800 shrink-0 w-20 text-right">{formatCurrency(item.unitPrice * item.quantity)}</span>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0" onClick={() => removeFromCart(item.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}

                {/* Review button */}
                <div className="pt-1">
                  <Button type="button" onClick={handleOpenReview}
                    className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm gap-2">
                    <Receipt className="w-4 h-4" />
                    Review &amp; Complete Sale · {formatCurrency(subtotalPreview)}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-6 flex flex-col items-center justify-center gap-1.5">
                <ShoppingCart className="w-6 h-6 text-slate-300" />
                <p className="text-xs font-medium text-slate-400">Cart is empty — search and add products above</p>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      <ReviewSaleModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        cart={cartItems}
        onQtyChange={adjustCartQty}
        onRemove={removeFromCart}
        onImeiChange={updateCartImei}
        accounts={accounts}
        customer={selectedCustomer}
        customerMode={customerMode}
        onConfirm={handleConfirmSale}
        submitting={submitting}
      />
    </PageWrapper>
  )
}

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
import { getAccessories } from "@/lib/api/products"
import { getUsedPhones } from "@/lib/api/inventory"
import { createSale, generateNextInvoiceNumber } from "@/lib/api/sales"
import { getTenant } from "@/lib/api/settings"
import type { ShopInfo } from "@/lib/pdf/invoice"
import { getFinanceAccounts } from "@/lib/api/finance"
import type { Customer, Accessory, Sale } from "@/data/types"
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
  productId: string       // imei_records.id for Mobile, used_phones.id for UsedPhone, accessories.id for Accessory
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
  category?: string
  batteryHealth?: number | null
  maxStock: number
}

type ProductResult = {
  id: string              // imei_records.id for Mobile
  productId: string       // mobiles catalog id (for stock decrement)
  name: string
  type: "Mobile" | "Accessory" | "UsedPhone"
  price: number
  costPrice: number
  stock: number
  imei?: string
  color?: string
  storage?: string
  category?: string
  ram?: string
  batteryHealth?: number | null
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
  accounts: FinanceAccount[]
  customer: Customer | undefined
  customerMode: "walkin" | "existing"
  onConfirm: (opts: { discount: number; tax: number; splitPayments: SplitPayment[]; notes: string; warrantyDays: number }) => void
  submitting: boolean
}) {
  const [discount, setDiscount] = useState("0")
  const [tax, setTax] = useState("0")
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([])
  const [warrantyDays, setWarrantyDays] = useState("7")
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
                      {[item.color, item.storage, item.category].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-[10px] font-semibold text-emerald-600">{formatCurrency(item.unitPrice)} each</p>
                    {item.productType !== "Accessory" && item.imei && (
                      <div className="mt-1.5">
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-100 rounded px-2 py-0.5 tracking-wider select-all">{item.imei}</span>
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

          {/* ── Warranty ── */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">Warranty</Label>
            <div className="flex gap-1.5 flex-wrap">
              {[["0","No Warranty"],["3","3 Days"],["7","7 Days"],["15","15 Days"],["30","1 Month"],["90","3 Months"]].map(([val, label]) => (
                <button key={val} type="button"
                  onClick={() => setWarrantyDays(val)}
                  className={cn("h-7 px-2.5 rounded-lg text-[11px] font-semibold border transition-all",
                    warrantyDays === val ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300")}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. customer requested gift wrap..." className="h-9 text-sm" />
          </div>

          <Separator />

          {/* ── Confirm ── */}
          <Button type="button"
            disabled={submitting || cart.length === 0}
            onClick={() => onConfirm({ discount: discountNum, tax: taxNum, splitPayments, notes, warrantyDays: parseInt(warrantyDays) || 0 })}
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
  const [imeiResults, setImeiResults] = useState<ProductResult[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [usedPhones, setUsedPhones] = useState<UsedPhone[]>([])
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [shopInfo, setShopInfo] = useState<ShopInfo>({ shopName: "Mobile Shop", shopAddress: "", shopPhone: "" })
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const tenantId = await getTenantId()

        // Load each source independently so one failure doesn't block the rest
        const [c, a, u, accs] = await Promise.all([
          getCustomers().catch(() => []),
          getAccessories().catch(() => []),
          getUsedPhones().catch(() => []),
          getFinanceAccounts().catch(() => []),
        ])
        setCustomers(c); setAccessories(a); setUsedPhones(u); setAccounts(accs)

        // Shop info — non-critical, fail silently
        getTenant().then(tenant => {
          if (tenant) setShopInfo({ shopName: tenant.name, shopAddress: tenant.address ?? "", shopPhone: tenant.phone ?? "", shopLogo: tenant.logo ?? "" })
        }).catch(() => {})

        // Load all in-stock IMEI records (one per physical phone).
        // Exclude placeholder rows (no real IMEI yet) and orphan rows
        // (no product_id = phantom from old used-phone bulk-add bug).
        const { data: imeiRows, error: imeiErr } = await supabase
          .from("imei_records")
          .select("id, imei_number, brand, model, color, storage_capacity, category, pta_status, device_status, selling_price, purchase_price, battery_health, product_id")
          .eq("tenant_id", tenantId)
          .eq("device_status", "in_stock")
          .not("product_id", "is", null)          // exclude phantoms (no catalog link)
          .order("created_at", { ascending: false })

        if (imeiErr) {
          console.error("imei_records load error:", imeiErr.message)
          toast.error(`Could not load phones: ${imeiErr.message}`)
        } else if (imeiRows) {
          setImeiResults((imeiRows as any[])
            .filter(r => /^\d{15}$/.test(r.imei_number ?? "")) // only real 15-digit IMEIs
            .map(r => ({
              id: r.id,
              productId: r.product_id ?? r.id,
              name: `${r.brand ?? ""} ${r.model ?? ""}`.trim(),
              type: "Mobile" as const,
              price: r.selling_price ?? 0,
              costPrice: r.purchase_price ?? 0,
              stock: 1,
              imei: r.imei_number ?? "",
              color: r.color ?? "",
              storage: r.storage_capacity ?? "",
              category: r.category ?? (r.pta_status === "approved" ? "PTA Approved" : r.pta_status === "jv" ? "JV" : "Non-PTA"),
              batteryHealth: r.battery_health ?? null,
            })))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("NewSalePage load error:", msg)
        toast.error(`Failed to load data: ${msg}`)
      }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // ── Customer ──────────────────────────────────────────────────────────────
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing">("existing")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [newCnic, setNewCnic] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [newCreditLimit, setNewCreditLimit] = useState("")

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim().replace(/-/g, "")
    if (!q) return customers.slice(0, 10)
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.cnic ?? "").replace(/-/g, "").includes(q)
    ).slice(0, 10)
  }, [customerSearch, customers])

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [selectedCustomerId, customers]
  )

  const [customerOutstanding, setCustomerOutstanding] = useState(0)
  useEffect(() => {
    if (!selectedCustomerId) { setCustomerOutstanding(0); return }
    getTenantId().then(tenantId =>
      supabase.from("sales").select("total, amount_received")
        .eq("tenant_id", tenantId).eq("customer_id", selectedCustomerId).eq("status", "Pending")
    ).then(({ data }) => {
      const total = (data ?? []).reduce((s: number, r: any) => s + Math.max(0, (r.total ?? 0) - (r.amount_received ?? 0)), 0)
      setCustomerOutstanding(total)
    }).catch(() => {})
  }, [selectedCustomerId])

  async function handleCreateCustomer() {
    if (!newName.trim() || !newPhone.trim()) { toast.error("Name and phone required"); return }
    try {
      const created = await createCustomer({
        name: newName.trim(),
        phone: newPhone.trim(),
        cnic: newCnic.trim() || undefined,
        address: newAddress.trim() || undefined,
        creditLimit: newCreditLimit ? parseFloat(newCreditLimit) : undefined,
        totalPurchases: 0, totalSpent: 0, loyaltyTier: "Bronze",
      } as any)
      setCustomers(prev => [created, ...prev])
      setSelectedCustomerId(created.id)
      setCustomerMode("existing")
      setCustomerSearch(created.name)
      setShowNewCustomer(false)
      setNewName(""); setNewPhone(""); setNewCnic(""); setNewAddress(""); setNewCreditLimit("")
      toast.success(`Customer "${created.name}" saved!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create customer")
    }
  }

  // ── Product search ────────────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"All" | "Mobile" | "Accessory" | "UsedPhone">("All")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [priceFilter, setPriceFilter] = useState<"" | "under5k" | "5k-15k" | "15k-40k" | "over40k">("")
  const [storageFilter, setStorageFilter] = useState("")

  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    if (typeFilter === "All" || typeFilter === "Mobile") imeiResults.forEach(r => r.category && cats.add(r.category))
    if (typeFilter === "All" || typeFilter === "Accessory") accessories.forEach(a => a.category && cats.add(a.category))
    if (typeFilter === "All" || typeFilter === "UsedPhone") usedPhones.filter(u => u.status === "in_stock").forEach(u => {
      if (u.pta_status) cats.add(u.pta_status === "approved" ? "PTA Approved" : u.pta_status === "pending" ? "PTA Pending" : "PTA Blocked")
    })
    return [...cats].sort()
  }, [typeFilter, imeiResults, accessories, usedPhones])

  const allStorages = useMemo(() => {
    const storages = new Set<string>()
    if (typeFilter === "All" || typeFilter === "Mobile") imeiResults.forEach(r => r.storage && storages.add(r.storage))
    if (typeFilter === "All" || typeFilter === "UsedPhone") usedPhones.filter(u => u.status === "in_stock").forEach(u => u.storage && storages.add(u.storage))
    const order = ["32GB","64GB","128GB","256GB","512GB","1TB"]
    return [...storages].sort((a, b) => {
      const ai = order.findIndex(o => a.toLowerCase().includes(o.toLowerCase()))
      const bi = order.findIndex(o => b.toLowerCase().includes(o.toLowerCase()))
      if (ai !== -1 && bi !== -1) return ai - bi
      return a.localeCompare(b)
    })
  }, [typeFilter, imeiResults, usedPhones])

  const productResults = useMemo((): ProductResult[] => {
    const q = productSearch.toLowerCase().trim()
    function matchesPrice(price: number) {
      if (!priceFilter) return true
      if (priceFilter === "under5k") return price < 5000
      if (priceFilter === "5k-15k") return price >= 5000 && price <= 15000
      if (priceFilter === "15k-40k") return price > 15000 && price <= 40000
      return price > 40000
    }
    // Mobiles — one result per physical phone from imei_records
    const mResults: ProductResult[] = (typeFilter === "All" || typeFilter === "Mobile") ? imeiResults
      .filter(r => matchesPrice(r.price)
        && (!categoryFilter || r.category === categoryFilter)
        && (!storageFilter || (r.storage ?? "").toLowerCase() === storageFilter.toLowerCase())
        && (!q || `${r.name} ${r.color} ${r.storage} ${r.imei} ${r.category} ${r.ram ?? ""}`.toLowerCase().includes(q)))
    : []
    // Accessories
    const aResults: ProductResult[] = (typeFilter === "All" || typeFilter === "Accessory") ? accessories
      .filter(a => a.stock > 0 && matchesPrice(a.sellingPrice)
        && (!categoryFilter || a.category === categoryFilter)
        && (!q || `${a.name} ${a.brand} ${a.category} ${a.sku} ${(a.compatibleModels || []).join(" ")} ${a.description || ""}`.toLowerCase().includes(q)))
      .map(a => ({ id: a.id, productId: a.id, name: `${a.name} — ${a.brand}`, type: "Accessory" as const, price: a.sellingPrice, costPrice: a.purchasePrice, stock: a.stock, category: a.category }))
    : []
    // Used phones
    const ptaLabel = (s: string) => s === "approved" ? "PTA Approved" : s === "pending" ? "PTA Pending" : "PTA Blocked"
    const uResults: ProductResult[] = (typeFilter === "All" || typeFilter === "UsedPhone") ? usedPhones
      .filter(u => u.status === "in_stock" && matchesPrice(u.selling_price)
        && (!categoryFilter || ptaLabel(u.pta_status) === categoryFilter)
        && (!storageFilter || (u.storage || "").toLowerCase() === storageFilter.toLowerCase())
        && (!q || `${u.brand} ${u.model} ${u.color} ${u.storage} ${u.imei_number} ${u.pta_status}`.toLowerCase().includes(q)))
      .map(u => ({ id: u.id, productId: u.id, name: `${u.brand} ${u.model} (Used · ${u.condition_grade})`, type: "UsedPhone" as const, price: u.selling_price, costPrice: (u.purchase_price || 0) + (u.refurbishment_cost || 0), stock: 1, imei: u.imei_number, color: u.color, storage: u.storage }))
    : []
    return [...mResults, ...aResults, ...uResults].slice(0, 50)
  }, [productSearch, imeiResults, accessories, usedPhones, typeFilter, categoryFilter, priceFilter, storageFilter])

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  function addToCart(p: ProductResult) {
    // Mobiles from imei_records and used phones are unique per unit — block duplicates
    if (p.type === "UsedPhone" || p.type === "Mobile") {
      if (cartItems.some(c => c.productId === p.id)) { toast.error("Already in cart"); return }
      setCartItems(prev => [...prev, {
        id: uid(), productId: p.id, productName: p.name, productType: p.type,
        quantity: 1, unitPrice: p.price, costPrice: p.costPrice, discount: 0, lineTotal: p.price,
        imei: p.imei, color: p.color, storage: p.storage, category: p.category, batteryHealth: p.batteryHealth, maxStock: 1,
      }])
    } else {
      // Accessories — stackable
      const existing = cartItems.find(c => c.productId === p.id)
      if (existing) {
        if (existing.quantity >= p.stock) { toast.error(`Max stock reached (${p.stock})`); return }
        setCartItems(prev => prev.map(c => c.id === existing.id ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * c.unitPrice } : c))
      } else {
        setCartItems(prev => [...prev, {
          id: uid(), productId: p.id, productName: p.name, productType: p.type as "Accessory",
          quantity: 1, unitPrice: p.price, costPrice: p.costPrice, discount: 0, lineTotal: p.price,
          color: p.color, storage: p.storage, category: p.category, maxStock: p.stock,
        }])
      }
    }
    setProductSearch("")
    toast.success(`${p.name} added`)
  }

  function removeFromCart(id: string) { setCartItems(prev => prev.filter(c => c.id !== id)) }


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

  async function handleConfirmSale({ discount, tax, splitPayments, notes, warrantyDays }: {
    discount: number; tax: number; splitPayments: SplitPayment[]; notes: string; warrantyDays: number
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

      // Credit limit check — sum pending sales for this customer vs their credit limit
      if (customerMode === "existing" && selectedCustomerId && selectedCustomer) {
        const creditLimit = selectedCustomer.creditLimit ?? 0
        if (creditLimit > 0) {
          const amountOnCredit = grandTotal - totalReceived   // how much of this sale is on credit
          if (amountOnCredit > 0) {
            const { data: pendingSales, error: creditErr } = await supabase
              .from("sales")
              .select("total, amount_received")
              .eq("tenant_id", tenantId)
              .eq("customer_id", selectedCustomerId)
              .eq("status", "Pending")
            if (creditErr) {
              toast.error("Could not verify credit limit — please try again")
              setSubmitting(false)
              return
            }
            const currentOutstanding = (pendingSales ?? []).reduce(
              (s: number, r: any) => s + Math.max(0, (r.total ?? 0) - (r.amount_received ?? 0)), 0
            )
            if (currentOutstanding + amountOnCredit > creditLimit) {
              toast.error(
                `Credit limit exceeded! ${selectedCustomer.name} already owes ${formatCurrency(currentOutstanding)}. ` +
                `Limit is ${formatCurrency(creditLimit)}. Collect payment first or receive full amount now.`
              )
              setSubmitting(false)
              return
            }
          }
        }
      }

      // Stock re-check
      for (const item of cartItems) {
        if (item.productType === "UsedPhone") {
          const { data } = await supabase.from("used_phones").select("status").eq("id", item.productId).single()
          if (!data || data.status !== "in_stock") { toast.error(`"${item.productName}" no longer available`); setSubmitting(false); return }
        } else if (item.productType === "Mobile") {
          // item.productId is imei_records.id — verify it is still in_stock
          const { data } = await supabase.from("imei_records").select("device_status").eq("id", item.productId).single()
          if (!data || (data as any).device_status !== "in_stock") { toast.error(`"${item.productName}" (IMEI: ${item.imei}) no longer available`); setSubmitting(false); return }
        } else {
          const { data } = await supabase.from("accessories").select("stock").eq("id", item.productId).single()
          if (!data || data.stock < item.quantity) { toast.error(`"${item.productName}" — only ${data?.stock ?? 0} left`); setSubmitting(false); return }
        }
      }

      const invoiceNumber = await generateNextInvoiceNumber(tenantId)
      const custName = customerMode === "walkin" ? "Walk-in Customer" : selectedCustomer?.name ?? ""
      const custPhone = customerMode === "walkin" ? "" : selectedCustomer?.phone ?? ""
      const today = todayPKT()

      const saleStatus = totalReceived >= grandTotal ? "Completed" : "Pending"

      const createdSaleRecord = await createSale({
        invoiceNumber, date: today,
        customerId: customerMode === "walkin" ? "" : selectedCustomerId,
        customerName: custName, customerPhone: custPhone,
        subtotal, discount, tax, total: grandTotal,
        paymentMethod, amountReceived: totalReceived, changeDue, status: saleStatus,
        warrantyDays: warrantyDays > 0 ? warrantyDays : undefined,
        notes: notes || undefined, items: [],
      } as any, cartItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productType: item.productType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        lineTotal: item.unitPrice * item.quantity,
        imei: item.imei ?? null,
      })) as any)

      // Update inventory
      for (const item of cartItems) {
        if (item.productType === "Mobile") {
          // Mark this specific imei_records row as sold (item.productId = imei_records.id)
          const custId = customerMode === "existing" && selectedCustomerId ? selectedCustomerId : null
          const { data: imeiRow } = await supabase
            .from("imei_records").select("product_id")
            .eq("id", item.productId).single()
          await supabase.from("imei_records")
            .update({ device_status: "sold", sold_date: today, customer_name: custName, customer_phone: custPhone, customer_id: custId })
            .eq("id", item.productId)
          // Decrement catalog stock via product_id stored on imei_records
          const catalogId = (imeiRow as any)?.product_id
          if (catalogId) {
            const { data: mobRow } = await supabase.from("mobiles").select("stock").eq("id", catalogId).single()
            if (mobRow) {
              await supabase.from("mobiles").update({ stock: Math.max(0, (mobRow as any).stock - 1) }).eq("id", catalogId)
            }
          }
        } else if (item.productType === "Accessory") {
          // Decrement accessory stock
          const { data: accRow } = await supabase.from("accessories").select("stock").eq("id", item.productId).single()
          if (accRow) {
            await supabase.from("accessories").update({ stock: Math.max(0, (accRow as any).stock - item.quantity) }).eq("id", item.productId)
          }
        } else if (item.productType === "UsedPhone") {
          await supabase.from("used_phones")
            .update({ status: "sold", sold_date: today, source_customer_name: custName })
            .eq("id", item.productId).eq("tenant_id", tenantId)
          // Defensively mark any phantom imei_records row sold (created by old bulk-add bug)
          if (item.imei) {
            await supabase.from("imei_records")
              .update({ device_status: "sold", sold_date: today, customer_name: custName })
              .eq("imei_number", item.imei).eq("tenant_id", tenantId)
              .is("product_id", null)
          }
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

          {/* Customer details — only for existing customers */}
          {completedSale.customerId && (
            <div className="w-full rounded-2xl border border-blue-100 bg-blue-50/60 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-blue-600 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <span className="text-white text-[10px] font-bold">
                    {completedSale.customerName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs font-bold text-white">Customer Details</span>
              </div>
              <div className="px-5 py-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Name</span>
                  <span className="font-semibold text-slate-800">{completedSale.customerName}</span>
                </div>
                {completedSale.customerPhone && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Phone</span>
                    <span className="font-medium text-slate-700">{completedSale.customerPhone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

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
                              {c.cnic && <span className="text-slate-300 ml-2 font-mono text-[10px]">{c.cnic}</span>}
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
                  ) : null}
                </div>
              )}

              {customerMode === "existing" && showNewCustomer && (
                <div className="sm:col-span-4 rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" /> New Customer</span>
                    <button type="button" onClick={() => { setShowNewCustomer(false); setNewName(""); setNewPhone(""); setNewCnic(""); setNewAddress(""); setNewCreditLimit("") }}
                      className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Full Name <span className="text-red-500">*</span></Label>
                      <Input placeholder="Ahmed Khan" value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Phone <span className="text-red-500">*</span></Label>
                      <Input placeholder="+92 300 1234567" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">CNIC (ID Card)</Label>
                      <Input placeholder="42101-1234567-1" value={newCnic} onChange={e => setNewCnic(e.target.value)} className="h-8 text-xs font-mono" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Address</Label>
                      <Input placeholder="Street, Area, City" value={newAddress} onChange={e => setNewAddress(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div className="space-y-0.5 col-span-2">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Credit Limit (max udhaar)</Label>
                      <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">Rs</span>
                          <Input type="number" min={0} placeholder="e.g. 50000" value={newCreditLimit} onChange={e => setNewCreditLimit(e.target.value)} className="h-8 text-xs pl-7" />
                        </div>
                        <Button size="sm" className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleCreateCustomer}>Save Customer</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedCustomer && (
                <div className="sm:col-span-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 bg-blue-50 rounded-lg px-3 py-2">
                  <User className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="font-semibold text-slate-800">{selectedCustomer.name}</span>
                  <span>{selectedCustomer.phone}</span>
                  {selectedCustomer.cnic && (
                    <span className="font-mono text-slate-600 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px]">
                      CNIC: {selectedCustomer.cnic}
                    </span>
                  )}
                  {selectedCustomer.address && <span className="text-slate-500">{selectedCustomer.address}</span>}
                  <Badge variant="outline" className="text-[10px]">{selectedCustomer.loyaltyTier}</Badge>
                  <span>Spent: {formatCurrency(selectedCustomer.totalSpent)}</span>
                  {customerOutstanding > 0 && (
                    <span className="text-red-700 font-semibold bg-red-50 border border-red-200 rounded px-1.5 py-0.5 text-[10px]">
                      Udhaar: {formatCurrency(customerOutstanding)}
                    </span>
                  )}
                  {(selectedCustomer.creditLimit ?? 0) > 0 && (
                    <span className={cn(
                      "font-semibold rounded px-1.5 py-0.5 text-[10px] border",
                      customerOutstanding >= (selectedCustomer.creditLimit ?? 0)
                        ? "text-red-700 bg-red-50 border-red-200"
                        : "text-amber-700 bg-amber-50 border-amber-200"
                    )}>
                      Limit: {formatCurrency(selectedCustomer.creditLimit!)}
                      {customerOutstanding > 0 && ` (${formatCurrency(Math.max(0, (selectedCustomer.creditLimit ?? 0) - customerOutstanding))} left)`}
                    </span>
                  )}
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
                    onClick={() => { setTypeFilter(t); setCategoryFilter("") }}
                    className={cn("h-7 px-3 rounded-full text-[11px] font-semibold border transition-all",
                      typeFilter === t
                        ? t === "Mobile" ? "bg-blue-600 text-white border-blue-600"
                          : t === "Accessory" ? "bg-emerald-600 text-white border-emerald-600"
                          : t === "UsedPhone" ? "bg-amber-500 text-white border-amber-500"
                          : "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400")}>
                    {t === "UsedPhone" ? `Used (${usedPhones.filter(u=>u.status==="in_stock").length})` : t === "All" ? `All (${imeiResults.length + accessories.filter(a=>a.stock>0).length + usedPhones.filter(u=>u.status==="in_stock").length})` : t === "Mobile" ? `Mobiles (${imeiResults.length})` : `Accessories (${accessories.filter(a=>a.stock>0).length})`}
                  </button>
                ))}
              </div>

              {/* Category + Price + Storage filters */}
              <div className="flex gap-2 flex-wrap">
                {allCategories.length > 0 && (
                  <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v === "__all" ? "" : v) }}>
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
                      onClick={() => { setPriceFilter(val) }}
                      className={cn("h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition-all",
                        priceFilter === val ? "bg-blue-50 border-blue-400 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-400")}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Storage filter chips */}
              {allStorages.length > 0 && (
                <div className="flex gap-1 flex-wrap items-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Storage:</span>
                  <button type="button"
                    onClick={() => { setStorageFilter("") }}
                    className={cn("h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-all",
                      !storageFilter ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-400")}>
                    All
                  </button>
                  {allStorages.map(s => (
                    <button key={s} type="button"
                      onClick={() => { setStorageFilter(s === storageFilter ? "" : s) }}
                      className={cn("h-7 px-2.5 rounded-full text-[11px] font-semibold border transition-all",
                        storageFilter === s ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:border-violet-300")}>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <Input placeholder="Search by name, brand, model, color, IMEI, category, RAM…" value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="h-9 pl-9 pr-8 text-sm" />
                {productSearch && (
                  <button type="button" onClick={() => setProductSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Product list — always visible */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Header row */}
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {productSearch.trim() ? `${productResults.length} result${productResults.length !== 1 ? "s" : ""}` : `${productResults.length} in-stock`}
                  </span>
                  {(typeFilter !== "All" || categoryFilter || priceFilter || storageFilter) && (
                    <button type="button" onClick={() => { setTypeFilter("All"); setCategoryFilter(""); setPriceFilter(""); setStorageFilter("") }}
                      className="text-[10px] text-blue-600 hover:underline font-medium">Clear filters</button>
                  )}
                </div>

                {productResults.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Search className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-sm text-slate-400">No in-stock products match your filters</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">Try adjusting the type, category, or price filter</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                    {productResults.map(p => (
                      <button key={p.id + (p.imei || "")} type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-center gap-3"
                        onClick={() => addToCart(p)}>
                        <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          p.type === "Mobile" ? "bg-blue-100" : p.type === "UsedPhone" ? "bg-amber-100" : "bg-emerald-100")}>
                          {p.type === "Accessory" ? <Headphones className="w-4 h-4 text-emerald-600" /> : <Smartphone className={cn("w-4 h-4", p.type === "UsedPhone" ? "text-amber-600" : "text-blue-600")} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="font-semibold text-slate-800 block truncate text-sm">{p.name}</span>
                          <span className="text-[11px] text-slate-400 flex flex-wrap gap-x-2 mt-0.5">
                            {(p as any).category && <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{(p as any).category}</span>}
                            {p.color && <span className="text-slate-500">Color: <span className="font-medium text-slate-700">{p.color}</span></span>}
                            {p.storage && <span className="text-slate-500">Storage: <span className="font-medium text-slate-700">{p.storage}</span></span>}
                            {p.batteryHealth != null && <span className="text-slate-500">Battery: <span className={cn("font-medium", p.batteryHealth >= 80 ? "text-emerald-600" : p.batteryHealth >= 60 ? "text-amber-600" : "text-red-500")}>{p.batteryHealth}%</span></span>}
                            {p.imei && <span className="font-mono text-slate-500">IMEI: {p.imei}</span>}
                            {p.type !== "Mobile" && p.type !== "UsedPhone" && <span className="text-slate-400">Qty: {p.stock}</span>}
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
                  </div>
                )}
              </div>
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
                      {item.batteryHealth != null && (
                        <p className="text-[10px] mt-0.5">
                          Battery: <span className={cn("font-semibold", item.batteryHealth >= 80 ? "text-emerald-600" : item.batteryHealth >= 60 ? "text-amber-600" : "text-red-500")}>{item.batteryHealth}%</span>
                        </p>
                      )}
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
        accounts={accounts}
        customer={selectedCustomer}
        customerMode={customerMode}
        onConfirm={handleConfirmSale}
        submitting={submitting}
      />
    </PageWrapper>
  )
}

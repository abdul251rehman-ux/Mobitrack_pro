"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Minus, Trash2, Search, Package, Smartphone, Building2, ShoppingCart, ShoppingBag,
  ChevronLeft, CreditCard, Headphones, Hash, Check, Banknote, Wallet, Landmark,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { getSuppliers } from "@/lib/api/suppliers"
import { createPurchase } from "@/lib/api/purchases"
import { getFinanceAccounts } from "@/lib/api/finance"
import type { Supplier } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"

import { PageWrapper } from "@/components/layout/page-wrapper"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, cn, todayPKT } from "@/lib/utils"
import Link from "next/link"

// ─── Catalog types ─────────────────────────────────────────────────────────────

interface CatalogMobile {
  id: string
  brand: string
  model: string
  color: string
  storage: string
  ram: string
  condition: string
  category: string
  imageUrl: string | null
  deviceType: "android" | "iphone"
}

interface CatalogAccessory {
  id: string
  name: string
  brand: string
  category: string
  sku: string
  imageUrl: string | null
}

// ─── Cart item ─────────────────────────────────────────────────────────────────

interface CartItem {
  uid: string
  type: "Mobile" | "Accessory"
  catalogId: string
  label: string
  sub: string
  deviceType?: "android" | "iphone"
  brand: string
  model?: string
  color?: string
  storage?: string
  ram?: string
  condition?: string
  name?: string
  sku?: string
  buyPrice: string
  sellPrice: string
  qty: string
  imei: string
}

function mkUid() {
  return `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Finance account icon ──────────────────────────────────────────────────────

function AccountIcon({ type }: { type: string }) {
  if (type === "bank") return <Landmark className="w-4 h-4" />
  if (type === "wallet") return <Wallet className="w-4 h-4" />
  return <Banknote className="w-4 h-4" />
}

// ─── Review Order Modal ────────────────────────────────────────────────────────

// split payment entry
interface SplitEntry { accountId: string; amount: string }

function ReviewOrderModal({
  open,
  onClose,
  cart,
  onQtyChange,
  onRemove,
  accounts,
  supplier,
  onConfirm,
  submitting,
}: {
  open: boolean
  onClose: () => void
  cart: CartItem[]
  onQtyChange: (uid: string, delta: number) => void
  onRemove: (uid: string) => void
  accounts: FinanceAccount[]
  supplier: Supplier | undefined
  onConfirm: (opts: { shipping: number; tax: number; splits: SplitEntry[]; dueDate: string; notes: string }) => void
  submitting: boolean
}) {
  const [shipping, setShipping] = useState("0")
  const [tax, setTax] = useState("0")
  const [splits, setSplits] = useState<SplitEntry[]>([])
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")

  const subtotal = useMemo(() =>
    cart.reduce((s, c) => s + (parseFloat(c.buyPrice) || 0) * (parseInt(c.qty) || 1), 0)
  , [cart])

  const shippingNum = parseFloat(shipping) || 0
  const taxNum = parseFloat(tax) || 0
  const grandTotal = subtotal + shippingNum + taxNum
  const totalPaid = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const balanceDue = Math.max(0, grandTotal - totalPaid)
  const payStatus = totalPaid <= 0 ? "Unpaid" : totalPaid >= grandTotal ? "Paid" : "Partial"

  // toggle account in/out of splits
  function toggleAccount(accId: string) {
    setSplits(prev => {
      const exists = prev.find(e => e.accountId === accId)
      if (exists) return prev.filter(e => e.accountId !== accId)
      return [...prev, { accountId: accId, amount: "" }]
    })
  }

  function setAmount(accId: string, val: string) {
    setSplits(prev => prev.map(e => e.accountId === accId ? { ...e, amount: val } : e))
  }

  // check each split for insufficient funds
  const insufficientMap: Record<string, boolean> = {}
  for (const s of splits) {
    const acc = accounts.find(a => a.id === s.accountId)
    if (acc && (parseFloat(s.amount) || 0) > acc.currentBalance) insufficientMap[s.accountId] = true
  }
  const anyInsufficient = Object.keys(insufficientMap).length > 0

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !submitting) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">Review Purchase Order</DialogTitle>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 pt-5 pb-4 rounded-t-2xl pr-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Review Purchase Order</h2>
              <p className="text-xs text-white/70 mt-0.5">
                {supplier?.companyName ?? "No supplier"} · {cart.length} item type(s)
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* ── Items with +/− qty ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Items</span>
            </div>
            <div className="divide-y divide-slate-100">
              {cart.map(item => {
                const rowTotal = (parseFloat(item.buyPrice) || 0) * (parseInt(item.qty) || 1)
                return (
                  <div key={item.uid} className="px-4 py-3 flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      item.type === "Mobile" ? "bg-blue-100" : "bg-emerald-100"
                    )}>
                      {item.type === "Mobile"
                        ? <Smartphone className="w-4 h-4 text-blue-600" />
                        : <Headphones className="w-4 h-4 text-emerald-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.label}</p>
                      <p className="text-[10px] text-slate-400 truncate">{item.sub}</p>
                      {item.imei && (
                        <p className="text-[10px] text-slate-400 font-mono">IMEI: {item.imei}</p>
                      )}
                    </div>
                    {/* Prices */}
                    <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-[10px] text-slate-400">
                        Buy: <span className="font-semibold text-slate-600">{formatCurrency(parseFloat(item.buyPrice) || 0)}</span>
                      </span>
                      {item.sellPrice && parseFloat(item.sellPrice) > 0 && (
                        <span className="text-[10px] text-emerald-500">
                          Sell: {formatCurrency(parseFloat(item.sellPrice))}
                        </span>
                      )}
                    </div>
                    {/* +/− qty */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button"
                        onClick={() => onQtyChange(item.uid, -1)}
                        disabled={(parseInt(item.qty) || 1) <= 1}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center transition-colors">
                        <Minus className="w-3 h-3 text-slate-600" />
                      </button>
                      <span className="w-7 text-center text-sm font-bold text-slate-800">{parseInt(item.qty) || 1}</span>
                      <button type="button"
                        onClick={() => onQtyChange(item.uid, +1)}
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 flex items-center justify-center transition-colors">
                        <Plus className="w-3 h-3 text-slate-600" />
                      </button>
                    </div>
                    {/* Row total */}
                    <div className="w-20 text-right shrink-0">
                      <span className="text-sm font-bold text-slate-800">{formatCurrency(rowTotal)}</span>
                    </div>
                    <button type="button" onClick={() => onRemove(item.uid)}
                      className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Totals ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Order Totals</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Shipping (Rs)</Label>
                  <Input type="number" min={0} value={shipping} onChange={e => setShipping(e.target.value)} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Tax / Other (Rs)</Label>
                  <Input type="number" min={0} value={tax} onChange={e => setTax(e.target.value)} className="h-9 text-sm" placeholder="0" />
                </div>
              </div>
              {/* Summary rows */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-slate-500">Subtotal</span>
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(subtotal)}</span>
                </div>
                {shippingNum > 0 && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Shipping</span>
                    <span className="text-sm text-slate-600">+{formatCurrency(shippingNum)}</span>
                  </div>
                )}
                {taxNum > 0 && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500">Tax / Other</span>
                    <span className="text-sm text-slate-600">+{formatCurrency(taxNum)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2.5 bg-blue-50">
                  <span className="text-sm font-bold text-blue-700">Grand Total</span>
                  <span className="text-lg font-extrabold text-blue-700">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Split Payment ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Banknote className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Pay From Account(s)</span>
              </div>
              <span className="text-[10px] text-slate-400">Select one or more accounts</span>
            </div>
            <div className="p-4 space-y-3">
              {accounts.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">No finance accounts found. Set up accounts in the Finance page first.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.map(acc => {
                    const splitEntry = splits.find(e => e.accountId === acc.id)
                    const isSelected = !!splitEntry
                    const insufficient = insufficientMap[acc.id]
                    const type = acc.type ?? "cash"
                    const colorMap: Record<string, string> = {
                      cash:   isSelected ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300" : "border-slate-200 bg-white hover:border-emerald-200",
                      bank:   isSelected ? "border-blue-400 bg-blue-50 ring-1 ring-blue-300"         : "border-slate-200 bg-white hover:border-blue-200",
                      wallet: isSelected ? "border-violet-400 bg-violet-50 ring-1 ring-violet-300"   : "border-slate-200 bg-white hover:border-violet-200",
                    }
                    const iconColor: Record<string, string> = {
                      cash:   isSelected ? "bg-emerald-200 text-emerald-700" : "bg-slate-100 text-slate-500",
                      bank:   isSelected ? "bg-blue-200 text-blue-700"       : "bg-slate-100 text-slate-500",
                      wallet: isSelected ? "bg-violet-200 text-violet-700"   : "bg-slate-100 text-slate-500",
                    }
                    return (
                      <div key={acc.id} className={cn("rounded-xl border transition-all duration-150", colorMap[type] ?? colorMap.cash)}>
                        {/* Account header row — click to toggle */}
                        <button
                          type="button"
                          onClick={() => toggleAccount(acc.id)}
                          className="w-full p-3 flex items-center gap-3 text-left"
                        >
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", iconColor[type] ?? iconColor.cash)}>
                            <AccountIcon type={type} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{acc.name}</p>
                            {acc.bankName && <p className="text-[10px] text-slate-400 truncate">{acc.bankName}{acc.accountTitle ? ` · ${acc.accountTitle}` : ""}</p>}
                            <p className="text-sm font-extrabold text-slate-900 mt-0.5 tabular-nums">{formatCurrency(acc.currentBalance)}</p>
                          </div>
                          <div className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300"
                          )}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </button>
                        {/* Amount input — shown only when selected */}
                        {isSelected && (
                          <div className="px-3 pb-3">
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 space-y-1">
                                <Label className="text-[11px] font-medium text-slate-600">Amount from {acc.name} (Rs)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={acc.currentBalance}
                                  placeholder="Enter amount..."
                                  value={splitEntry?.amount ?? ""}
                                  onChange={e => setAmount(acc.id, e.target.value)}
                                  className={cn("h-9 text-sm", insufficient && "border-red-400")}
                                  autoFocus
                                />
                                {insufficient && (
                                  <p className="text-[10px] text-red-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Exceeds balance of {formatCurrency(acc.currentBalance)}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setAmount(acc.id, String(Math.min(acc.currentBalance, Math.max(0, grandTotal - (totalPaid - (parseFloat(splitEntry?.amount ?? "0") || 0))))))}
                                className="mt-5 text-[10px] text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                              >
                                Fill remaining
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Payment summary */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200">
                {splits.filter(e => parseFloat(e.amount) > 0).map(e => {
                  const acc = accounts.find(a => a.id === e.accountId)
                  return acc ? (
                    <div key={e.accountId} className="flex items-center justify-between px-3 py-2">
                      <span className="text-xs text-slate-600">{acc.name}</span>
                      <span className="text-xs font-semibold text-slate-700">−{formatCurrency(parseFloat(e.amount) || 0)}</span>
                    </div>
                  ) : null
                })}
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs text-slate-500">Total Paid Now</span>
                  <span className="text-sm font-bold text-slate-800">{formatCurrency(totalPaid)}</span>
                </div>
                <div className={cn("flex items-center justify-between px-3 py-2.5", balanceDue > 0 ? "bg-red-50" : "bg-emerald-50")}>
                  <span className={cn("text-sm font-bold", balanceDue > 0 ? "text-red-700" : "text-emerald-700")}>
                    {balanceDue > 0 ? "Balance Due (Supplier Ledger)" : "Fully Paid"}
                  </span>
                  {balanceDue > 0 && (
                    <span className="text-sm font-extrabold text-red-700">{formatCurrency(balanceDue)}</span>
                  )}
                </div>
              </div>

              {balanceDue > 0 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  The remaining {formatCurrency(balanceDue)} will be recorded as payable to the supplier in the ledger.
                </div>
              )}

              {balanceDue > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-600">Payment Due Date</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm max-w-xs" />
                </div>
              )}

              {/* Payment status badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Payment Status:</span>
                <span className={cn(
                  "text-xs font-bold px-2.5 py-0.5 rounded-full border",
                  payStatus === "Paid"    && "bg-emerald-50 text-emerald-700 border-emerald-200",
                  payStatus === "Partial" && "bg-amber-50 text-amber-700 border-amber-200",
                  payStatus === "Unpaid"  && "bg-red-50 text-red-700 border-red-200",
                )}>{payStatus}</span>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="space-y-1">
            <Label className="text-xs font-medium text-slate-600">Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Delivery expected Friday, partial stock..." className="h-9 text-sm" />
          </div>

          <Separator />

          {/* ── Confirm button ── */}
          <Button
            type="button"
            disabled={submitting || cart.length === 0 || anyInsufficient}
            onClick={() => onConfirm({ shipping: shippingNum, tax: taxNum, splits, dueDate, notes })}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            {submitting ? "Recording..." : `Confirm & Record Purchase — ${formatCurrency(grandTotal)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewPurchasePage() {
  const router = useRouter()

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])

  const [dataLoading, setDataLoading] = useState(true)

  const [mobileCatalog, setMobileCatalog] = useState<CatalogMobile[]>([])
  const [accessoryCatalog, setAccessoryCatalog] = useState<CatalogAccessory[]>([])

  useEffect(() => {
    async function load() {
      try {
        setDataLoading(true)
        const tenantId = await getTenantId()
        const [suppData, mobilesRes, accessoriesRes, accsFinance] = await Promise.all([
          getSuppliers(),
          supabase.from("mobiles").select("id, brand, model, color, storage, ram, condition, category, image_url, device_type").eq("tenant_id", tenantId).order("brand").order("model"),
          supabase.from("accessories").select("id, name, brand, category, sku, image_url").eq("tenant_id", tenantId).order("name"),
          getFinanceAccounts(),
        ])
        setSuppliers(suppData)
        if (mobilesRes.data) {
          setMobileCatalog(mobilesRes.data.map(m => ({
            id: m.id, brand: m.brand, model: m.model, color: m.color ?? "",
            storage: m.storage ?? "", ram: m.ram ?? "", condition: m.condition ?? "New",
            category: m.category ?? "", imageUrl: m.image_url ?? null,
            deviceType: (m.device_type === "iphone" ? "iphone" : "android") as "android" | "iphone",
          })))
        }
        if (accessoriesRes.data) {
          setAccessoryCatalog(accessoriesRes.data.map(a => ({
            id: a.id, name: a.name, brand: a.brand ?? "", category: a.category ?? "",
            sku: a.sku ?? "", imageUrl: a.image_url ?? null,
          })))
        }
        setAccounts(accsFinance)
        const defaultAcc = accsFinance.find(a => a.isDefaultCash) ?? accsFinance[0]
        // default account pre-selection is now handled inside ReviewOrderModal
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setDataLoading(false)
      }
    }
    load()
  }, [])

  // ── Supplier ──────────────────────────────────────────────────────────────
  const [supplierSearch, setSupplierSearch] = useState("")
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false)

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.toLowerCase().trim()
    if (!q) return suppliers
    return suppliers.filter(s =>
      s.companyName.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q)
    )
  }, [supplierSearch, suppliers])

  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === selectedSupplierId),
    [selectedSupplierId, suppliers]
  )

  // ── Catalog tabs & search ─────────────────────────────────────────────────
  const [catalogTab, setCatalogTab] = useState<"android" | "iphone" | "accessory">("android")
  const [catalogSearch, setCatalogSearch] = useState("")

  const filteredMobiles = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim()
    const byType = mobileCatalog.filter(m => m.deviceType === (catalogTab === "iphone" ? "iphone" : "android"))
    if (!q) return byType
    return byType.filter(m =>
      m.brand.toLowerCase().includes(q) ||
      m.model.toLowerCase().includes(q) ||
      m.color.toLowerCase().includes(q) ||
      m.storage.toLowerCase().includes(q)
    )
  }, [catalogSearch, mobileCatalog, catalogTab])

  const filteredAccessories = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim()
    if (!q) return accessoryCatalog
    return accessoryCatalog.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.brand.toLowerCase().includes(q) ||
      a.sku.toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q)
    )
  }, [catalogSearch, accessoryCatalog])

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([])
  const inCartIds = useMemo(() => new Set(cart.map(c => c.catalogId)), [cart])

  function toggleMobile(m: CatalogMobile) {
    if (inCartIds.has(m.id)) {
      setCart(prev => prev.filter(c => c.catalogId !== m.id))
    } else {
      const sub = [m.color, m.storage, m.ram ? `${m.ram} RAM` : "", m.condition].filter(Boolean).join(" · ")
      setCart(prev => [...prev, {
        uid: mkUid(), type: "Mobile", catalogId: m.id,
        label: `${m.brand} ${m.model}`, sub, deviceType: m.deviceType,
        brand: m.brand, model: m.model, color: m.color,
        storage: m.storage, ram: m.ram, condition: m.condition,
        buyPrice: "", sellPrice: "", qty: "", imei: "",
      }])
    }
  }

  function toggleAccessory(a: CatalogAccessory) {
    if (inCartIds.has(a.id)) {
      setCart(prev => prev.filter(c => c.catalogId !== a.id))
    } else {
      setCart(prev => [...prev, {
        uid: mkUid(), type: "Accessory", catalogId: a.id,
        label: a.name, sub: `${a.brand} · ${a.category} · ${a.sku}`,
        brand: a.brand, name: a.name, sku: a.sku,
        buyPrice: "", sellPrice: "", qty: "", imei: "",
      }])
    }
  }

  function updateCart(uid: string, field: keyof CartItem, value: string) {
    setCart(prev => prev.map(c => c.uid === uid ? { ...c, [field]: value } : c))
  }

  function adjustQty(uid: string, delta: number) {
    setCart(prev => prev.map(c =>
      c.uid === uid ? { ...c, qty: String(Math.max(1, (parseInt(c.qty) || 1) + delta)) } : c
    ))
  }

  function removeFromCart(uid: string) {
    setCart(prev => prev.filter(c => c.uid !== uid))
  }

  // ── Review modal ──────────────────────────────────────────────────────────
  const [reviewOpen, setReviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleOpenReview() {
    if (!selectedSupplierId) { toast.error("Please select a supplier first"); return }
    if (cart.length === 0) { toast.error("Add at least one item from the catalog"); return }
    // Validate prices entered
    for (const c of cart) {
      if (!c.buyPrice || parseFloat(c.buyPrice) <= 0) {
        toast.error(`Enter buy price for ${c.label}`); return
      }
    }
    setReviewOpen(true)
  }

  async function handleConfirmPurchase({ shipping, tax, splits, dueDate, notes }: {
    shipping: number; tax: number; splits: SplitEntry[]; dueDate: string; notes: string
  }) {
    if (submitting) return

    // Final validation
    for (const c of cart) {
      if (c.imei && !/^\d{15}$/.test(c.imei)) {
        toast.error(`IMEI for ${c.label} must be exactly 15 digits`); return
      }
    }
    const imeis = cart.map(c => c.imei).filter(Boolean)
    if (new Set(imeis).size !== imeis.length) {
      toast.error("Duplicate IMEI numbers in the list"); return
    }

    setSubmitting(true)

    const subtotal = cart.reduce((s, c) => s + (parseFloat(c.buyPrice) || 0) * (parseInt(c.qty) || 1), 0)
    const grandTotal = subtotal + shipping + tax
    const amountPaid = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
    const balanceDue = Math.max(0, grandTotal - amountPaid)
    const paymentStatus = amountPaid <= 0 ? "Unpaid" : amountPaid >= grandTotal ? "Paid" : "Partial"

    // determine primary payment method label from first split with an amount
    const firstSplit = splits.find(e => parseFloat(e.amount) > 0)
    const firstAccount = firstSplit ? accounts.find(a => a.id === firstSplit.accountId) : undefined
    const paymentMethod = firstAccount
      ? (firstAccount.type === "cash" ? "Cash"
        : firstAccount.type === "bank" ? "Bank Transfer"
        : firstAccount.bankName || "Mobile Wallet")
      : splits.length > 1 ? "Split Payment" : "Cash"

    const originalMobileStocks: Record<string, number> = {}
    const originalAccessoryStocks: Record<string, number> = {}
    const updatedMobileIds: string[] = []
    const updatedAccessoryIds: string[] = []
    const insertedImeiNumbers: string[] = []
    let purchaseId: string | null = null

    try {
      const tenantId = await getTenantId()
      const today = todayPKT()
      const dateTag = today.replace(/-/g, "")

      const { data: poRows } = await supabase
        .from("purchases")
        .select("po_number")
        .eq("tenant_id", tenantId)
        .eq("date", today)
        .like("po_number", `PO-${dateTag}-%`)

      let maxPoSeq = 0
      for (const row of (poRows ?? [])) {
        const parts = (row.po_number as string).split("-")
        const n = parseInt(parts[parts.length - 1], 10)
        if (!isNaN(n) && n > maxPoSeq) maxPoSeq = n
      }
      const poNumber = `PO-${dateTag}-${String(maxPoSeq + 1).padStart(3, "0")}`

      const purchaseItems: { productId: string; productName: string; productType: string; quantity: number; unitCost: number; total: number; imeis: string[] }[] = []

      for (const item of cart) {
        const buy = parseFloat(item.buyPrice)
        const sell = parseFloat(item.sellPrice) || 0

        if (item.type === "Mobile") {
          const { data: cur } = await supabase.from("mobiles").select("stock").eq("id", item.catalogId).single()
          originalMobileStocks[item.catalogId] = cur?.stock ?? 0

          const { error } = await supabase.from("mobiles").update({
            purchase_price: buy, selling_price: sell,
            stock: originalMobileStocks[item.catalogId] + (parseInt(item.qty) || 1),
            supplier_id: selectedSupplierId,
          }).eq("id", item.catalogId)
          if (error) throw new Error(`Failed to update ${item.label}: ${error.message}`)
          updatedMobileIds.push(item.catalogId)

          if (item.imei) {
            const { error: imeiErr } = await supabase.from("imei_records").insert({
              tenant_id: tenantId, imei_number: item.imei, brand: item.brand,
              model: item.model ?? "", color: item.color ?? "", storage_capacity: item.storage ?? "",
              pta_status: "pending", device_status: "in_stock",
              purchase_price: buy, selling_price: sell,
              supplier_id: selectedSupplierId, supplier_name: selectedSupplier?.companyName ?? "",
              purchase_date: today,
            })
            if (imeiErr) throw new Error(`IMEI insert failed: ${imeiErr.message}`)
            insertedImeiNumbers.push(item.imei)
          }

          purchaseItems.push({ productId: item.catalogId, productName: item.label, productType: "Mobile", quantity: parseInt(item.qty) || 1, unitCost: buy, total: buy * (parseInt(item.qty) || 1), imeis: item.imei ? [item.imei] : [] })
        } else {
          const { data: cur } = await supabase.from("accessories").select("stock").eq("id", item.catalogId).single()
          originalAccessoryStocks[item.catalogId] = cur?.stock ?? 0

          const { error } = await supabase.from("accessories").update({
            purchase_price: buy, selling_price: sell,
            stock: originalAccessoryStocks[item.catalogId] + (parseInt(item.qty) || 1),
            supplier_id: selectedSupplierId,
          }).eq("id", item.catalogId)
          if (error) throw new Error(`Failed to update ${item.label}: ${error.message}`)
          updatedAccessoryIds.push(item.catalogId)

          purchaseItems.push({ productId: item.catalogId, productName: item.label, productType: "Accessory", quantity: parseInt(item.qty) || 1, unitCost: buy, total: buy * (parseInt(item.qty) || 1), imeis: [] })
        }
      }

      const created = await createPurchase({
        poNumber, date: today,
        supplierId: selectedSupplierId, supplierName: selectedSupplier?.companyName ?? "",
        subtotal, shippingCost: shipping, tax, total: grandTotal,
        amountPaid, balanceDue, paymentMethod, paymentStatus,
        deliveryStatus: "Received", dueDate: dueDate || null, notes: notes || null,
        items: [],
      } as any, purchaseItems as any)
      purchaseId = (created as any).id

      if (amountPaid > 0) {
        await supabase.from("payments").insert({
          tenant_id: tenantId, date: today, type: "Paid",
          entity_type: "Supplier", entity_id: selectedSupplierId,
          entity_name: selectedSupplier?.companyName ?? "",
          reference_type: "Purchase", reference_number: poNumber,
          amount: amountPaid, method: paymentMethod, status: "Completed",
          notes: `Payment for ${poNumber}`,
        })
      }

      // record finance transactions for each split and deduct from each account
      const activeSplits = splits.filter(e => parseFloat(e.amount) > 0)
      for (const splitEntry of activeSplits) {
        const splitAmt = parseFloat(splitEntry.amount)
        await supabase.from("finance_transactions").insert({
          tenant_id: tenantId, date: today, type: "purchase_payment",
          account_id: splitEntry.accountId, amount: splitAmt,
          reference_type: "Purchase", reference_number: poNumber,
          description: `Purchase paid — ${poNumber}`,
        })
        const { data: accRow } = await supabase.from("finance_accounts").select("current_balance").eq("id", splitEntry.accountId).single()
        if (accRow) {
          await supabase.from("finance_accounts").update({
            current_balance: Math.max(0, (accRow as any).current_balance - splitAmt),
          }).eq("id", splitEntry.accountId)
        }
      }
      if (activeSplits.length > 0) {
        await supabase.from("purchases").update({ account_id: activeSplits[0].accountId })
          .eq("po_number", poNumber).eq("tenant_id", tenantId)
      }

      toast.success(`Purchase order ${poNumber} recorded!`, {
        description: `${cart.length} item(s) · ${formatCurrency(grandTotal)} · ${paymentStatus}`,
        duration: 5000,
      })
      router.push("/purchases")
    } catch (err) {
      if (purchaseId) await supabase.from("purchases").delete().eq("id", purchaseId)
      for (const id of updatedMobileIds) await supabase.from("mobiles").update({ stock: originalMobileStocks[id] ?? 0 }).eq("id", id)
      for (const id of updatedAccessoryIds) await supabase.from("accessories").update({ stock: originalAccessoryStocks[id] ?? 0 }).eq("id", id)
      if (insertedImeiNumbers.length) await supabase.from("imei_records").delete().in("imei_number", insertedImeiNumbers)
      toast.error(err instanceof Error ? err.message : "Purchase failed — changes rolled back")
      setSubmitting(false)
    }
  }

  if (dataLoading) {
    return <PageWrapper><div className="text-center py-20 text-slate-500 text-sm">Loading catalog...</div></PageWrapper>
  }

  const cartCount = cart.length
  const allPricesSet = cart.length > 0 && cart.every(c => parseFloat(c.buyPrice) > 0)

  return (
    <PageWrapper>
      <PageHeader title="Create New Purchase" description="Select items from catalog, set prices, then review and pay"
        icon={<ShoppingBag />} iconBg="bg-violet-600"
        action={<Link href="/purchases"><Button variant="outline" className="gap-2"><ChevronLeft className="w-4 h-4" /> Back</Button></Link>} />

      <div className="space-y-3">

        {/* ═══ Step 1: Supplier ══════════════════════════════════════════════ */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <CardTitle className="text-sm font-semibold text-slate-900">Step 1 — Supplier <span className="text-red-500">*</span></CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="max-w-sm relative">
              <Input placeholder="Search supplier..." value={supplierSearch}
                onChange={e => { setSupplierSearch(e.target.value); setSupplierDropdownOpen(true); if (!e.target.value) setSelectedSupplierId("") }}
                onFocus={() => setSupplierDropdownOpen(true)} className="h-9 text-sm" />
              {selectedSupplier && !supplierDropdownOpen && (
                <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {selectedSupplier.companyName}
                  {selectedSupplier.city && <span className="text-slate-400 font-normal">· {selectedSupplier.city}</span>}
                </p>
              )}
              {supplierDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredSuppliers.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400 text-center">No suppliers found</div>
                  ) : filteredSuppliers.map(s => (
                    <button key={s.id} type="button" disabled={s.status === "Inactive"}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${s.id === selectedSupplierId ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
                      onClick={() => { setSelectedSupplierId(s.id); setSupplierSearch(s.companyName); setSupplierDropdownOpen(false) }}>
                      <span className="font-medium">{s.companyName}</span>
                      <span className="text-slate-400 ml-1">{s.city}</span>
                    </button>
                  ))}
                </div>
              )}
              {supplierDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setSupplierDropdownOpen(false)} />}
            </div>
          </CardContent>
        </Card>

        {/* ═══ Step 2: Browse Catalog ════════════════════════════════════════ */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-slate-900">Step 2 — Select Items</CardTitle>
                <CardDescription className="text-xs text-slate-500">Browse Android, iPhone, and Accessories — tap + to add</CardDescription>
              </div>
              {cartCount > 0 && (
                <span className="ml-auto text-xs font-bold text-blue-700 bg-blue-100 rounded-full px-2.5 py-0.5">
                  {cartCount} selected
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">

            {/* Tabs */}
            <div className="flex rounded-lg bg-slate-100 p-0.5 gap-0.5">
              {(["android", "iphone", "accessory"] as const).map(tab => (
                <button key={tab} type="button"
                  onClick={() => { setCatalogTab(tab); setCatalogSearch("") }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                    catalogTab === tab ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800"
                  )}>
                  {tab === "android" && <Smartphone className="w-3.5 h-3.5" />}
                  {tab === "iphone" && (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                  )}
                  {tab === "accessory" && <Headphones className="w-3.5 h-3.5" />}
                  {tab === "android" ? "Android" : tab === "iphone" ? "iPhone" : "Accessories"}
                  <span className={cn(
                    "text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none",
                    catalogTab === tab ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                  )}>
                    {tab === "android" ? mobileCatalog.filter(m => m.deviceType === "android").length
                      : tab === "iphone" ? mobileCatalog.filter(m => m.deviceType === "iphone").length
                      : accessoryCatalog.length}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <Input
                placeholder={catalogTab !== "accessory" ? "Brand, model, color, storage..." : "Name, brand, SKU..."}
                value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Catalog grid */}
            {catalogTab !== "accessory" ? (
              filteredMobiles.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {mobileCatalog.filter(m => m.deviceType === (catalogTab === "android" ? "android" : "iphone")).length === 0
                    ? `No ${catalogTab === "android" ? "Android phones" : "iPhones"} in catalog. Add them from Mobile Phones page first.`
                    : "No results."}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {filteredMobiles.map(m => {
                    const added = inCartIds.has(m.id)
                    return (
                      <div key={m.id} className={cn(
                        "rounded-xl border bg-white p-3 transition-all duration-150",
                        added ? "border-blue-400 ring-1 ring-blue-300 bg-blue-50/40" : "border-slate-200 hover:border-slate-300"
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900 leading-snug truncate">{m.brand} {m.model}</p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{[m.color, m.storage, m.ram].filter(Boolean).join(" · ")}</p>
                            <span className="inline-block mt-1 text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full">{m.condition}</span>
                          </div>
                          <button type="button" onClick={() => toggleMobile(m)}
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                              added ? "bg-blue-600 text-white hover:bg-red-500" : "bg-slate-100 text-slate-500 hover:bg-blue-600 hover:text-white"
                            )}>
                            {added ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              filteredAccessories.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {accessoryCatalog.length === 0
                    ? "No accessories in catalog. Add from Accessories page first."
                    : "No results."}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {filteredAccessories.map(a => {
                    const added = inCartIds.has(a.id)
                    return (
                      <div key={a.id} className={cn(
                        "rounded-xl border bg-white p-3 transition-all duration-150",
                        added ? "border-emerald-400 ring-1 ring-emerald-300 bg-emerald-50/40" : "border-slate-200 hover:border-slate-300"
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900 leading-snug truncate">{a.name}</p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{a.brand} · {a.category}</p>
                            <span className="inline-block mt-1 text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full font-mono">{a.sku}</span>
                          </div>
                          <button type="button" onClick={() => toggleAccessory(a)}
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all",
                              added ? "bg-emerald-600 text-white hover:bg-red-500" : "bg-slate-100 text-slate-500 hover:bg-emerald-600 hover:text-white"
                            )}>
                            {added ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* ═══ Step 3: Set Prices ════════════════════════════════════════════ */}
        {cart.length > 0 && (
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-900">Step 3 — Set Prices</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Enter buy price (required), sell price, and quantity for each item</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {cart.map(item => (
                <div key={item.uid} className={cn(
                  "rounded-xl border px-3 py-2.5",
                  item.type === "Mobile" ? "border-blue-100 bg-blue-50/30" : "border-emerald-100 bg-emerald-50/30"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-5 h-5 rounded-md flex items-center justify-center shrink-0",
                      item.type === "Mobile" ? "bg-blue-200" : "bg-emerald-200")}>
                      {item.type === "Mobile"
                        ? <Smartphone className="w-3 h-3 text-blue-700" />
                        : <Headphones className="w-3 h-3 text-emerald-700" />}
                    </div>
                    <p className="text-xs font-semibold text-slate-800 truncate flex-1">{item.label}</p>
                    <p className="text-[10px] text-slate-400 truncate hidden sm:block">{item.sub}</p>
                    <button type="button" onClick={() => removeFromCart(item.uid)}
                      className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Buy Price (Rs) *</Label>
                      <Input type="number" min={0} placeholder="0"
                        value={item.buyPrice} onChange={e => updateCart(item.uid, "buyPrice", e.target.value)}
                        className={cn("h-7 text-xs bg-white", !item.buyPrice && "border-amber-300")} />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Sell Price (Rs)</Label>
                      <Input type="number" min={0} placeholder="0"
                        value={item.sellPrice} onChange={e => updateCart(item.uid, "sellPrice", e.target.value)}
                        className="h-7 text-xs bg-white" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                        <Hash className="w-2.5 h-2.5" /> Qty
                      </Label>
                      <Input type="number" min={1} placeholder="1"
                        value={item.qty}
                        onChange={e => setCart(prev => prev.map(c => c.uid === item.uid ? { ...c, qty: e.target.value } : c))}
                        onBlur={e => { if (!e.target.value || parseInt(e.target.value) < 1) setCart(prev => prev.map(c => c.uid === item.uid ? { ...c, qty: "1" } : c)) }}
                        className="h-7 text-xs bg-white" />
                    </div>
                  </div>
                </div>
              ))}

              {/* Review Order button */}
              <div className="pt-1">
                <Button type="button" onClick={handleOpenReview}
                  disabled={!allPricesSet}
                  className={cn(
                    "w-full h-10 font-bold text-sm gap-2 transition-all",
                    allPricesSet
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  )}>
                  <ShoppingCart className="w-4 h-4" />
                  Review Order & Pay ({cartCount} item{cartCount !== 1 ? "s" : ""})
                </Button>
                {!allPricesSet && (
                  <p className="text-center text-[11px] text-amber-600 mt-1.5 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Enter buy price for all items to proceed
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* ═══ Review Order Modal ════════════════════════════════════════════ */}
      <ReviewOrderModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        cart={cart}
        onQtyChange={adjustQty}
        onRemove={removeFromCart}
        accounts={accounts}
        supplier={selectedSupplier}
        onConfirm={handleConfirmPurchase}
        submitting={submitting}
      />
    </PageWrapper>
  )
}

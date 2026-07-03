﻿"use client"

import { useState, useMemo, useEffect } from "react"
import {
  getShops, createShop, updateShop, deleteShop,
  getReservedSales, getConsignments,
  createConsignment, recordConsignmentSale, recordConsignmentReturn,
  confirmReservedSale, cancelReservedSale,
} from "@/lib/api/shops"
import { Shop, ReservedSale, Consignment, ConsignmentTransaction } from "@/data/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format, isPast, parseISO } from "date-fns"
import {
  Store, Plus, Search, Phone, MapPin, Edit2, Trash2, CheckCircle2,
  Clock, XCircle, AlertTriangle, TrendingUp, Package,
  Building2, ShoppingBag, X, BadgeCheck, MoreVertical,
  CreditCard, Banknote, Smartphone, Ban, ArrowLeftRight,
  DollarSign, Send, History, ChevronDown, ChevronUp,
  Layers, RotateCcw, Filter, Printer, Hash, Cpu,
} from "lucide-react"

// â"€â"€â"€ Constants & Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const fmt = (n: number) => "Rs " + n.toLocaleString("en-PK")

const SHOP_TYPES = ["Retailer", "Dealer", "Wholesaler", "Repair Shop"] as const
const PAYMENT_METHODS = ["Cash", "Bank Transfer", "JazzCash", "EasyPaisa", "Card"] as const

const TYPE_META: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  Retailer:     { color: "text-blue-400",   bg: "bg-blue-500/15",   border: "border-blue-500/30",   dot: "bg-blue-400" },
  Dealer:       { color: "text-violet-400", bg: "bg-violet-500/15", border: "border-violet-500/30", dot: "bg-violet-400" },
  Wholesaler:   { color: "text-amber-400",  bg: "bg-amber-500/15",  border: "border-amber-500/30",  dot: "bg-amber-400" },
  "Repair Shop":{ color: "text-emerald-400",bg: "bg-emerald-500/15",border: "border-emerald-500/30",dot: "bg-emerald-400" },
}

const SHOP_AVATAR_COLORS: Record<string, string> = {
  Retailer: "from-blue-600 to-blue-700",
  Dealer: "from-violet-600 to-violet-700",
  Wholesaler: "from-amber-600 to-amber-700",
  "Repair Shop": "from-emerald-600 to-emerald-700",
}

const RES_STATUS: Record<string, { color: string; bg: string; border: string }> = {
  Reserved:  { color: "text-amber-400",  bg: "bg-amber-500/15",  border: "border-amber-500/30" },
  Confirmed: { color: "text-emerald-400",bg: "bg-emerald-500/15",border: "border-emerald-500/30" },
  Cancelled: { color: "text-red-400",    bg: "bg-red-500/15",    border: "border-red-500/30" },
}

const CON_STATUS: Record<string, { color: string; bg: string; border: string }> = {
  Active:             { color: "text-blue-400",   bg: "bg-blue-500/15",   border: "border-blue-500/30" },
  "Partially Settled":{ color: "text-amber-400",  bg: "bg-amber-500/15",  border: "border-amber-500/30" },
  "Fully Settled":    { color: "text-emerald-400",bg: "bg-emerald-500/15",border: "border-emerald-500/30" },
  Returned:           { color: "text-slate-400",  bg: "bg-slate-500/15",  border: "border-slate-500/30" },
}

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  Cash: <Banknote className="w-3.5 h-3.5" />,
  "Bank Transfer": <Building2 className="w-3.5 h-3.5" />,
  JazzCash: <Smartphone className="w-3.5 h-3.5" />,
  EasyPaisa: <Smartphone className="w-3.5 h-3.5" />,
  Card: <CreditCard className="w-3.5 h-3.5" />,
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

// â"€â"€â"€ Shared Input / Select / Label â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const inputCls = "w-full bg-[#0d1829] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
const selectCls = "bg-[#0d1829] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-blue-500/60 transition-all"

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1.5 block">{children}</label>
}
function FieldErr({ msg }: { msg?: string }) {
  return msg ? <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-400 inline-block" />{msg}</p> : null
}

// â"€â"€â"€ Stat Card â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function StatCard({
  label, value, sub, Icon, color, accent,
}: {
  label: string; value: string | number; sub: string
  Icon: React.ElementType; color: string; accent: string
}) {
  return (
    <div className={cn("relative rounded-2xl p-5 overflow-hidden border", accent)}>
      {/* glow blob */}
      <div className={cn("absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-2xl", color)} />
      <div className="relative flex items-start justify-between mb-4">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color.replace("bg-", "bg-") + " bg-opacity-20")}>
          <Icon className={cn("w-4.5 h-4.5")} style={{ color: "inherit" }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-slate-500 text-xs mt-1">{sub}</p>
    </div>
  )
}

// â"€â"€â"€ Shop Drawer â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

type ShopForm = {
  name: string; ownerName: string; phone: string; email: string; address: string
  city: string; shopType: typeof SHOP_TYPES[number]; status: "Active" | "Inactive"
  outstandingBalance: number; notes: string
}

const emptyShop = (): ShopForm => ({
  name: "", ownerName: "", phone: "", email: "", address: "",
  city: "", shopType: "Retailer", status: "Active",
  outstandingBalance: 0, notes: "",
})

function ShopDrawer({ open, onClose, editing, onSave }: {
  open: boolean; onClose: () => void; editing: Shop | null; onSave: (s: Shop) => void
}) {
  const [form, setForm] = useState<ShopForm>(emptyShop())
  const [errors, setErrors] = useState<Record<string, string>>({})

  useMemo(() => {
    setForm(editing ? {
      name: editing.name, ownerName: editing.ownerName, phone: editing.phone,
      email: editing.email ?? "", address: editing.address, city: editing.city,
      shopType: editing.shopType, status: editing.status,
      outstandingBalance: editing.outstandingBalance, notes: editing.notes ?? "",
    } : emptyShop())
    setErrors({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, open])

  const set = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "Shop name is required"
    if (!form.ownerName.trim()) e.ownerName = "Owner name is required"
    if (!form.phone.trim()) e.phone = "Phone number is required"
    if (!form.city.trim()) e.city = "City is required"
    setErrors(e); return !Object.keys(e).length
  }

  const handleSubmit = () => {
    if (!validate()) return
    const shop: Shop = editing
      ? { ...editing, ...form, email: form.email || undefined, notes: form.notes || undefined }
      : { id: `shop-${Date.now()}`, totalOrders: 0, totalSpent: 0, dateAdded: new Date().toISOString().split("T")[0], ...form, email: form.email || undefined, notes: form.notes || undefined }
    onSave(shop); onClose()
  }

  const meta = TYPE_META[form.shopType]

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40" onClick={onClose} />}
      <div className={cn("fixed top-0 right-0 h-full w-full sm:w-[500px] z-50 flex flex-col transition-all duration-300 ease-out shadow-2xl", open ? "translate-x-0 opacity-100" : "translate-x-full opacity-0")}
        style={{ background: "linear-gradient(180deg, #0d1829 0%, #080f1a 100%)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Header */}
        <div className="relative px-4 sm:px-6 pt-6 pb-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-4">
            <div className={cn("w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0", SHOP_AVATAR_COLORS[form.shopType] || "from-blue-600 to-blue-700")}>
              <Store className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{editing ? "Edit Shop" : "Add New Shop"}</h2>
              <p className="text-slate-500 text-xs mt-0.5">{editing ? "Update shop information" : "Register a new shop or dealer"}</p>
            </div>
            <button onClick={onClose} className="ml-auto p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/8 transition-all">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Section: Shop */}
          <div>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.15em] mb-4">Shop Details</p>
            <div className="space-y-4">
              <div>
                <Label>Shop Name *</Label>
                <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. City Mobile Hub" className={inputCls} />
                <FieldErr msg={errors.name} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Shop Type</Label>
                  <select value={form.shopType} onChange={e => set("shopType", e.target.value)} className={"w-full " + selectCls}>
                    {SHOP_TYPES.map(t => <option key={t} value={t} style={{ background: "#0d1829" }}>{t}</option>)}
                  </select>
                  {form.shopType && (
                    <div className={cn("mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border", meta.bg, meta.color, meta.border)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />{form.shopType}
                    </div>
                  )}
                </div>
                <div>
                  <Label>Status</Label>
                  <select value={form.status} onChange={e => set("status", e.target.value)} className={"w-full " + selectCls}>
                    <option value="Active" style={{ background: "#0d1829" }}>Active</option>
                    <option value="Inactive" style={{ background: "#0d1829" }}>Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Owner */}
          <div>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.15em] mb-4">Owner & Contact</p>
            <div className="space-y-4">
              <div>
                <Label>Owner Name *</Label>
                <input value={form.ownerName} onChange={e => set("ownerName", e.target.value)} placeholder="e.g. Raza Hussain" className={inputCls} />
                <FieldErr msg={errors.ownerName} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone *</Label>
                  <input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+92 300 1234567" className={inputCls} />
                  <FieldErr msg={errors.phone} />
                </div>
                <div>
                  <Label>Email</Label>
                  <input value={form.email} onChange={e => set("email", e.target.value)} placeholder="shop@email.pk" className={inputCls} />
                </div>
              </div>
            </div>
          </div>

          {/* Section: Location */}
          <div>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.15em] mb-4">Location</p>
            <div className="space-y-4">
              <div>
                <Label>Address</Label>
                <input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street / shop number" className={inputCls} />
              </div>
              <div>
                <Label>City *</Label>
                <input value={form.city} onChange={e => set("city", e.target.value)} placeholder="e.g. Lahore" className={inputCls} />
                <FieldErr msg={errors.city} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} placeholder="Any additional information..."
              className={inputCls + " resize-none"} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 shrink-0 flex gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold hover:bg-white/5 hover:text-white transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-bold hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-900/40 active:scale-[0.98]">
            {editing ? "Save Changes" : "Add Shop"}
          </button>
        </div>
      </div>
    </>
  )
}

// â"€â"€â"€ IMEI Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function getOutstandingImeis(it: { imeis?: string[]; soldImeis?: string[]; returnedImeis?: string[] }): string[] {
  if (!it.imeis || it.imeis.length === 0) return []
  return it.imeis.filter(imei => !it.soldImeis?.includes(imei) && !it.returnedImeis?.includes(imei))
}

function printReceipt(con: Consignment) {
  const html = `<!DOCTYPE html><html><head><title>Dispatch Receipt - ${con.dispatchNumber}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:720px;margin:0 auto}
    h1{font-size:20px;margin-bottom:4px}p{margin:4px 0;font-size:13px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#f3f4f6;text-align:left;padding:8px 10px;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
    td{padding:8px 10px;font-size:13px;border-bottom:1px solid #e5e7eb;vertical-align:top}
    .imei{font-family:monospace;font-size:11px;color:#374151;margin:1px 0}
    .badge{display:inline-block;padding:1px 8px;border-radius:99px;font-size:11px;font-weight:600}
    .sold{background:#d1fae5;color:#065f46}.returned{background:#e5e7eb;color:#374151}.out{background:#dbeafe;color:#1e40af}
    .footer{margin-top:40px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px}
    .sig{border-top:1px solid #d1d5db;padding-top:8px;font-size:12px;color:#6b7280}
    @media print{body{padding:16px}}
  </style></head><body>
  <h1>MobiTrack Pro - Dispatch Receipt</h1>
  <p style="color:#6b7280;font-size:12px;margin-bottom:16px">Official consignment document</p>
  <table style="width:auto;margin:0;border:none"><tbody>
    <tr><td style="border:none;padding:2px 16px 2px 0;font-size:12px;color:#6b7280;font-weight:600">DISPATCH #</td><td style="border:none;padding:2px 0;font-size:13px;font-weight:700">${con.dispatchNumber}</td></tr>
    <tr><td style="border:none;padding:2px 16px 2px 0;font-size:12px;color:#6b7280;font-weight:600">DATE</td><td style="border:none;padding:2px 0;font-size:13px">${con.date}</td></tr>
    <tr><td style="border:none;padding:2px 16px 2px 0;font-size:12px;color:#6b7280;font-weight:600">SHOP</td><td style="border:none;padding:2px 0;font-size:13px;font-weight:600">${con.shopName}</td></tr>
    <tr><td style="border:none;padding:2px 16px 2px 0;font-size:12px;color:#6b7280;font-weight:600">PHONE</td><td style="border:none;padding:2px 0;font-size:13px">${con.shopPhone}</td></tr>
    ${con.dueDate ? `<tr><td style="border:none;padding:2px 16px 2px 0;font-size:12px;color:#6b7280;font-weight:600">DUE DATE</td><td style="border:none;padding:2px 0;font-size:13px;color:#b45309;font-weight:600">${con.dueDate}</td></tr>` : ""}
  </tbody></table>
  <table><thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th><th>IMEI Numbers</th></tr></thead><tbody>
  ${con.items.map(it => `<tr>
    <td><strong>${it.productName}</strong></td>
    <td>${it.dispatched}</td>
    <td>Rs ${it.unitPrice.toLocaleString("en-PK")}</td>
    <td><strong>Rs ${(it.dispatched * it.unitPrice).toLocaleString("en-PK")}</strong></td>
    <td>${it.imeis ? it.imeis.map(imei => {
      const isSold = it.soldImeis?.includes(imei)
      const isRet = it.returnedImeis?.includes(imei)
      return `<div class="imei">${imei} <span class="badge ${isSold ? "sold" : isRet ? "returned" : "out"}">${isSold ? "Sold" : isRet ? "Returned" : "With Shop"}</span></div>`
    }).join("") : "-"}</td>
  </tr>`).join("")}
  </tbody></table>
  <p style="margin-top:12px;font-weight:700;font-size:14px">Total Value: Rs ${con.totalValue.toLocaleString("en-PK")}</p>
  ${con.notes ? `<p style="color:#6b7280;font-size:12px;margin-top:4px">Note: ${con.notes}</p>` : ""}
  <div class="footer">
    <div class="sig">Dispatched by<br><br></div>
    <div class="sig">Received by (Shop)<br><br></div>
    <div class="sig">Date &amp; Signature<br><br></div>
  </div></body></html>`
  const w = window.open("", "_blank")
  if (w) { w.document.write(html); w.document.close(); w.print() }
}

// â"€â"€â"€ New Consignment Drawer â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

type ConFormItem = {
  id: string; productName: string; productType: "Mobile" | "Accessory"
  quantity: number; unitPrice: number; imeis: string[]
}

const emptyConItem = (): ConFormItem => ({ id: String(Date.now() + Math.random()), productName: "", productType: "Mobile", quantity: 1, unitPrice: 0, imeis: [""] })

function NewConsignmentDrawer({ open, onClose, shops, onSave }: {
  open: boolean; onClose: () => void; shops: Shop[]; onSave: (con: Consignment) => void
}) {
  const [shopId, setShopId] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<ConFormItem[]>([emptyConItem()])
  const [errors, setErrors] = useState<string[]>([])

  useMemo(() => {
    if (!open) return
    setShopId(""); setDueDate(""); setNotes(""); setItems([emptyConItem()]); setErrors([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedShop = shops.find(s => s.id === shopId)

  const updateItem = (id: string, key: keyof ConFormItem, val: string | number | string[]) => {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      if (key === "quantity" && it.productType === "Mobile") {
        const qty = Number(val)
        const imeis = Array.from({ length: qty }, (_, i) => it.imeis[i] ?? "")
        return { ...it, quantity: qty, imeis }
      }
      if (key === "productType") {
        return { ...it, productType: val as "Mobile" | "Accessory", imeis: val === "Mobile" ? Array.from({ length: it.quantity }, () => "") : [] }
      }
      return { ...it, [key]: val }
    }))
  }

  const updateImei = (itemId: string, idx: number, val: string) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it
      const imeis = [...it.imeis]; imeis[idx] = val; return { ...it, imeis }
    }))
  }

  const validate = () => {
    const errs: string[] = []
    if (!shopId) errs.push("Select a shop")
    items.forEach((it, i) => {
      if (!it.productName.trim()) errs.push(`Item ${i + 1}: product name required`)
      if (it.unitPrice <= 0) errs.push(`Item ${i + 1}: price required`)
      if (it.productType === "Mobile") {
        it.imeis.forEach((imei, j) => {
          if (!imei.trim()) errs.push(`Item ${i + 1} unit ${j + 1}: IMEI required`)
          else if (!/^\d{15}$/.test(imei.trim())) errs.push(`Item ${i + 1} unit ${j + 1}: IMEI must be 15 digits`)
        })
      }
    })
    setErrors(errs)
    return errs.length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const shop = shops.find(s => s.id === shopId)!
    const conItems = items.map(it => ({
      productId: `prod-${Date.now()}-${it.id}`,
      productName: it.productName,
      productType: it.productType,
      dispatched: it.productType === "Mobile" ? it.imeis.length : it.quantity,
      returned: 0, sold: 0,
      unitPrice: it.unitPrice,
      ...(it.productType === "Mobile" && it.imeis.length > 0 ? { imeis: it.imeis.map(i => i.trim()) } : {}),
    }))
    const totalValue = conItems.reduce((s, it) => s + it.dispatched * it.unitPrice, 0)
    const con: Consignment = {
      id: `con-${Date.now()}`,
      dispatchNumber: `DSP-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
      date: new Date().toISOString().split("T")[0],
      shopId: shop.id, shopName: shop.name, shopPhone: shop.phone,
      items: conItems, totalValue, amountCollected: 0,
      status: "Active",
      ...(dueDate ? { dueDate } : {}),
      ...(notes ? { notes } : {}),
      transactions: [],
    }
    onSave(con); onClose()
  }

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40" onClick={onClose} />}
      <div className={cn("fixed top-0 right-0 h-full w-full sm:w-[560px] z-50 flex flex-col transition-all duration-300 ease-out shadow-2xl", open ? "translate-x-0 opacity-100" : "translate-x-full opacity-0")}
        style={{ background: "linear-gradient(180deg, #0d1829 0%, #080f1a 100%)", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-5 shrink-0 flex items-center gap-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shrink-0">
            <Send className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">New Dispatch</h2>
            <p className="text-slate-500 text-xs mt-0.5">Send items to another shop on consignment</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/8 transition-all"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Shop + Due date */}
          <div>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.15em] mb-4">Dispatch To</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Shop *</Label>
                <select value={shopId} onChange={e => setShopId(e.target.value)} className={"w-full " + selectCls}>
                  <option value="" style={{ background: "#0d1829" }}>Select a shop...</option>
                  {shops.filter(s => s.status === "Active").map(s => (
                    <option key={s.id} value={s.id} style={{ background: "#0d1829" }}>{s.name} - {s.city}</option>
                  ))}
                </select>
                {selectedShop && (
                  <div className="mt-2 flex items-center gap-2 text-slate-400 text-xs">
                    <Phone className="w-3.5 h-3.5" />{selectedShop.phone}
                    <span className="text-slate-700">-</span>
                    <MapPin className="w-3.5 h-3.5" />{selectedShop.city}
                  </div>
                )}
              </div>
              <div>
                <Label>Due / Return Date</Label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <Label>Notes</Label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Agreement details..." className={inputCls} />
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.15em]">Items Being Dispatched</p>
              <button onClick={() => setItems(p => [...p, emptyConItem()])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-blue-400 text-xs font-semibold border border-blue-500/25 hover:bg-blue-500/10 transition-all">
                <Plus className="w-3.5 h-3.5" />Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((it, idx) => (
                <div key={it.id} className="rounded-2xl border border-white/[0.07] overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
                  {/* Item header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.05]">
                    <span className="text-slate-600 text-[10px] font-bold uppercase tracking-wider">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => setItems(p => p.filter(i => i.id !== it.id))}
                        className="ml-auto text-red-400/60 hover:text-red-400 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <Label>Product Name *</Label>
                      <input value={it.productName} onChange={e => updateItem(it.id, "productName", e.target.value)}
                        placeholder="e.g. iPhone 15 Pro - 256GB Black" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Type</Label>
                        <select value={it.productType} onChange={e => updateItem(it.id, "productType", e.target.value)} className={"w-full " + selectCls}>
                          <option value="Mobile" style={{ background: "#0d1829" }}>Mobile</option>
                          <option value="Accessory" style={{ background: "#0d1829" }}>Accessory</option>
                        </select>
                      </div>
                      {it.productType === "Accessory" && (
                        <div>
                          <Label>Qty</Label>
                          <input type="number" onWheel={e => e.currentTarget.blur()} min={1} value={it.quantity} onChange={e => updateItem(it.id, "quantity", Number(e.target.value))} className={inputCls} />
                        </div>
                      )}
                      {it.productType === "Mobile" && (
                        <div>
                          <Label>Units</Label>
                          <input type="number" onWheel={e => e.currentTarget.blur()} min={1} max={20} value={it.imeis.length}
                            onChange={e => updateItem(it.id, "quantity", Number(e.target.value))} className={inputCls} />
                        </div>
                      )}
                      <div>
                        <Label>Unit Price (Rs) *</Label>
                        <input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={it.unitPrice || ""} onChange={e => updateItem(it.id, "unitPrice", Number(e.target.value))}
                          placeholder="0" className={inputCls} />
                      </div>
                    </div>

                    {/* IMEI inputs for mobile */}
                    {it.productType === "Mobile" && it.imeis.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Cpu className="w-3.5 h-3.5 text-blue-400" />
                          <p className="text-blue-400 text-xs font-semibold">IMEI Numbers ({it.imeis.length} unit{it.imeis.length !== 1 ? "s" : ""})</p>
                        </div>
                        <div className="space-y-2">
                          {it.imeis.map((imei, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-slate-700 text-[10px] font-mono w-5 shrink-0 text-right">{i + 1}</span>
                              <input
                                value={imei}
                                onChange={e => updateImei(it.id, i, e.target.value)}
                                placeholder="15-digit IMEI"
                                maxLength={15}
                                className={inputCls + " font-mono text-xs py-2"}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-slate-700 text-[10px] mt-2">Dial *#06# on the phone to get its IMEI</p>
                      </div>
                    )}

                    {/* Line total */}
                    {it.unitPrice > 0 && (
                      <div className="flex justify-between items-center bg-white/3 rounded-xl px-3 py-2">
                        <span className="text-slate-500 text-xs">Subtotal</span>
                        <span className="text-white text-sm font-bold">
                          Rs {((it.productType === "Mobile" ? it.imeis.length : it.quantity) * it.unitPrice).toLocaleString("en-PK")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 space-y-1">
              {errors.map((e, i) => <p key={i} className="text-red-400 text-xs flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{e}</p>)}
            </div>
          )}

          {/* Grand total */}
          {items.some(it => it.unitPrice > 0) && (
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl px-5 py-4 flex justify-between items-center">
              <div>
                <p className="text-violet-400 text-xs font-semibold uppercase tracking-wider">Total Dispatch Value</p>
                <p className="text-white font-bold text-2xl mt-0.5">
                  Rs {items.reduce((s, it) => s + (it.productType === "Mobile" ? it.imeis.length : it.quantity) * it.unitPrice, 0).toLocaleString("en-PK")}
                </p>
              </div>
              <Send className="w-6 h-6 text-violet-400" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 flex gap-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold hover:bg-white/5 transition-all">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-bold hover:from-violet-500 hover:to-indigo-500 transition-all shadow-lg shadow-violet-900/40 active:scale-[0.98] flex items-center justify-center gap-2">
            <Send className="w-4 h-4" />Create Dispatch
          </button>
        </div>
      </div>
    </>
  )
}

// â"€â"€â"€ Record Sale Dialog â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function RecordSaleDialog({ con, onClose, onSave }: {
  con: Consignment | null; onClose: () => void
  onSave: (conId: string, txn: ConsignmentTransaction) => void
}) {
  const available = (con?.items ?? []).filter(it => it.dispatched - it.returned - it.sold > 0)
  const [selectedImeis, setSelectedImeis] = useState<Record<string, string[]>>({})
  const [qtys, setQtys] = useState<Record<string, number>>({})
  const [method, setMethod] = useState("Cash")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  useMemo(() => {
    setSelectedImeis({}); setQtys(Object.fromEntries((con?.items ?? []).map(it => [it.productId, 0])))
    setMethod("Cash"); setNotes(""); setError("")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [con])

  if (!con) return null

  const toggleImei = (productId: string, imei: string) =>
    setSelectedImeis(p => {
      const cur = p[productId] ?? []
      return { ...p, [productId]: cur.includes(imei) ? cur.filter(i => i !== imei) : [...cur, imei] }
    })

  const total = available.reduce((s, it) => {
    const outImeis = getOutstandingImeis(it)
    if (outImeis.length > 0) return s + (selectedImeis[it.productId]?.length ?? 0) * it.unitPrice
    return s + (qtys[it.productId] ?? 0) * it.unitPrice
  }, 0)

  const anySelected = available.some(it => {
    const outImeis = getOutstandingImeis(it)
    return outImeis.length > 0 ? (selectedImeis[it.productId]?.length ?? 0) > 0 : (qtys[it.productId] ?? 0) > 0
  })

  const handleSubmit = () => {
    if (!anySelected) { setError("Select at least one item"); return }
    const txnItems = available
      .filter(it => {
        const outImeis = getOutstandingImeis(it)
        return outImeis.length > 0 ? (selectedImeis[it.productId]?.length ?? 0) > 0 : (qtys[it.productId] ?? 0) > 0
      })
      .map(it => {
        const outImeis = getOutstandingImeis(it)
        if (outImeis.length > 0) {
          const selImeis = selectedImeis[it.productId] ?? []
          return { productId: it.productId, productName: it.productName, quantity: selImeis.length, unitPrice: it.unitPrice, imeis: selImeis }
        }
        return { productId: it.productId, productName: it.productName, quantity: qtys[it.productId], unitPrice: it.unitPrice }
      })
    onSave(con.id, { id: `txn-${Date.now()}`, date: new Date().toISOString().split("T")[0], type: "Sale", items: txnItems, amount: total, paymentMethod: method, notes: notes || undefined })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh]"
        style={{ background: "linear-gradient(180deg, #0d1829 0%, #080f1a 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="px-6 pt-6 pb-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/40">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Record Sale</h2>
                <p className="text-slate-500 text-xs mt-0.5">{con.shopName} - {con.dispatchNumber}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/8 transition-all"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.15em] mb-3">Select sold items</p>
            {available.length === 0 ? (
              <div className="text-center py-8 text-slate-600"><Package className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>No items left</p></div>
            ) : (
              <div className="space-y-3">
                {available.map(it => {
                  const outImeis = getOutstandingImeis(it)
                  const hasImeis = outImeis.length > 0
                  const selImeis = selectedImeis[it.productId] ?? []
                  const qty = qtys[it.productId] ?? 0
                  const remaining = it.dispatched - it.returned - it.sold
                  const isActive = hasImeis ? selImeis.length > 0 : qty > 0

                  return (
                    <div key={it.productId} className={cn("rounded-2xl border overflow-hidden transition-all", isActive ? "border-emerald-500/25" : "border-white/[0.06]")}>
                      {/* Item header */}
                      <div className={cn("px-4 py-3 flex items-center justify-between", isActive ? "bg-emerald-500/8" : "bg-white/3")}>
                        <div>
                          <p className="text-white text-sm font-semibold">{it.productName}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{remaining} with shop - {fmt(it.unitPrice)} each</p>
                        </div>
                        {!hasImeis && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => setQtys(p => ({ ...p, [it.productId]: Math.max(0, (p[it.productId] ?? 0) - 1) }))}
                              className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 text-white flex items-center justify-center text-base font-bold">âˆ'</button>
                            <span className={cn("w-8 text-center text-sm font-bold tabular-nums", qty > 0 ? "text-emerald-400" : "text-slate-500")}>{qty}</span>
                            <button onClick={() => setQtys(p => ({ ...p, [it.productId]: Math.min(remaining, (p[it.productId] ?? 0) + 1) }))}
                              className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 text-white flex items-center justify-center text-base font-bold">+</button>
                          </div>
                        )}
                        {hasImeis && selImeis.length > 0 && (
                          <span className="text-emerald-400 text-sm font-bold">{fmt(selImeis.length * it.unitPrice)}</span>
                        )}
                      </div>

                      {/* IMEI selector */}
                      {hasImeis && (
                        <div className="px-4 py-3 border-t border-white/[0.05]">
                          <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Hash className="w-3 h-3" />Select IMEI(s) sold
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {outImeis.map(imei => {
                              const picked = selImeis.includes(imei)
                              return (
                                <button key={imei} onClick={() => toggleImei(it.productId, imei)}
                                  className={cn("font-mono text-[11px] px-2.5 py-1.5 rounded-lg border transition-all", picked
                                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm"
                                    : "bg-white/3 border-white/10 text-slate-400 hover:border-blue-500/30 hover:text-slate-200")}>
                                  {picked ? <CheckCircle2 className="w-3 h-3 inline mr-1 text-emerald-400" /> : null}
                                  {imei}
                                </button>
                              )
                            })}
                          </div>
                          {selImeis.length > 0 && (
                            <p className="text-emerald-400 text-xs mt-2 font-semibold">{selImeis.length} unit{selImeis.length !== 1 ? "s" : ""} selected</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {total > 0 && (
            <div className="bg-gradient-to-r from-emerald-600/20 to-emerald-500/10 border border-emerald-500/25 rounded-2xl px-5 py-4 flex justify-between items-center">
              <div>
                <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Amount to Collect</p>
                <p className="text-emerald-300 font-bold text-2xl mt-0.5">{fmt(total)}</p>
              </div>
              <DollarSign className="w-6 h-6 text-emerald-400" />
            </div>
          )}

          <div>
            <Label>Payment Method</Label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all",
                    method === m ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30" : "border-white/[0.08] text-slate-400 hover:border-white/20 bg-white/3")}>
                  {PAYMENT_ICONS[m]}{m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Who came, what was discussed..." className={inputCls + " resize-none"} />
          </div>
          {error && <p className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</p>}
        </div>

        <div className="px-6 py-5 flex gap-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold hover:bg-white/5 transition-all">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-bold hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-900/40 active:scale-[0.98] flex items-center justify-center gap-2">
            <DollarSign className="w-4 h-4" />Record Payment
          </button>
        </div>
      </div>
    </div>
  )
}

// â"€â"€â"€ Record Return Dialog â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function RecordReturnDialog({ con, onClose, onSave }: {
  con: Consignment | null; onClose: () => void
  onSave: (conId: string, txn: ConsignmentTransaction) => void
}) {
  const available = (con?.items ?? []).filter(it => it.dispatched - it.returned - it.sold > 0)
  const [selectedImeis, setSelectedImeis] = useState<Record<string, string[]>>({})
  const [qtys, setQtys] = useState<Record<string, number>>(() => Object.fromEntries((con?.items ?? []).map(it => [it.productId, 0])))
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  useMemo(() => {
    setSelectedImeis({})
    setQtys(Object.fromEntries((con?.items ?? []).map(it => [it.productId, 0])))
    setNotes(""); setError("")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [con])

  if (!con) return null

  const toggleImei = (productId: string, imei: string) =>
    setSelectedImeis(p => {
      const cur = p[productId] ?? []
      return { ...p, [productId]: cur.includes(imei) ? cur.filter(i => i !== imei) : [...cur, imei] }
    })

  const totalItems = available.reduce((s, it) => {
    const outImeis = getOutstandingImeis(it)
    return s + (outImeis.length > 0 ? (selectedImeis[it.productId]?.length ?? 0) : (qtys[it.productId] ?? 0))
  }, 0)

  const handleSubmit = () => {
    if (!totalItems) { setError("Select at least one item to return"); return }
    const txnItems = available
      .filter(it => {
        const outImeis = getOutstandingImeis(it)
        return outImeis.length > 0 ? (selectedImeis[it.productId]?.length ?? 0) > 0 : (qtys[it.productId] ?? 0) > 0
      })
      .map(it => {
        const outImeis = getOutstandingImeis(it)
        if (outImeis.length > 0) {
          const selImeis = selectedImeis[it.productId] ?? []
          return { productId: it.productId, productName: it.productName, quantity: selImeis.length, unitPrice: it.unitPrice, imeis: selImeis }
        }
        return { productId: it.productId, productName: it.productName, quantity: qtys[it.productId], unitPrice: it.unitPrice }
      })
    onSave(con.id, { id: `txn-${Date.now()}`, date: new Date().toISOString().split("T")[0], type: "Return", items: txnItems, amount: 0, notes: notes || undefined })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh]"
        style={{ background: "linear-gradient(180deg, #0d1829 0%, #080f1a 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="px-6 pt-6 pb-5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Record Return</h2>
                <p className="text-slate-500 text-xs mt-0.5">{con.shopName} - {con.dispatchNumber}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/8 transition-all"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="flex items-start gap-3 bg-blue-500/8 border border-blue-500/20 rounded-2xl px-4 py-3">
            <Package className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-blue-300/80 text-sm">Returned items will be restored to your inventory stock automatically.</p>
          </div>

          <div>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.15em] mb-3">Select items being returned</p>
            {available.length === 0 ? (
              <div className="text-center py-8 text-slate-600"><Package className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>No outstanding items</p></div>
            ) : (
              <div className="space-y-3">
                {available.map(it => {
                  const outImeis = getOutstandingImeis(it)
                  const hasImeis = outImeis.length > 0
                  const selImeis = selectedImeis[it.productId] ?? []
                  const qty = qtys[it.productId] ?? 0
                  const remaining = it.dispatched - it.returned - it.sold
                  const isActive = hasImeis ? selImeis.length > 0 : qty > 0

                  return (
                    <div key={it.productId} className={cn("rounded-2xl border overflow-hidden transition-all", isActive ? "border-blue-500/25" : "border-white/[0.06]")}>
                      <div className={cn("px-4 py-3.5 flex items-center gap-3", isActive ? "bg-blue-500/8" : "bg-white/3")}>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{it.productName}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{remaining} outstanding - {fmt(it.unitPrice)} each</p>
                        </div>
                        {!hasImeis && (
                          <>
                            <button onClick={() => setQtys(p => ({ ...p, [it.productId]: remaining }))} className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold transition-colors shrink-0">All</button>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => setQtys(p => ({ ...p, [it.productId]: Math.max(0, (p[it.productId] ?? 0) - 1) }))}
                                className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 text-white flex items-center justify-center text-base font-bold transition-all">âˆ'</button>
                              <span className={cn("w-8 text-center text-sm font-bold tabular-nums", qty > 0 ? "text-blue-400" : "text-slate-500")}>{qty}</span>
                              <button onClick={() => setQtys(p => ({ ...p, [it.productId]: Math.min(remaining, (p[it.productId] ?? 0) + 1) }))}
                                className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 text-white flex items-center justify-center text-base font-bold transition-all">+</button>
                            </div>
                          </>
                        )}
                        {hasImeis && selImeis.length > 0 && (
                          <span className="text-blue-400 text-sm font-bold shrink-0">{selImeis.length} selected</span>
                        )}
                      </div>

                      {/* IMEI selector for returns */}
                      {hasImeis && (
                        <div className="px-4 py-3 border-t border-white/[0.05]">
                          <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Hash className="w-3 h-3" />Select IMEI(s) being returned
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {outImeis.map(imei => {
                              const picked = selImeis.includes(imei)
                              return (
                                <button key={imei} onClick={() => toggleImei(it.productId, imei)}
                                  className={cn("font-mono text-[11px] px-2.5 py-1.5 rounded-lg border transition-all", picked
                                    ? "bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-sm"
                                    : "bg-white/3 border-white/10 text-slate-400 hover:border-blue-500/30 hover:text-slate-200")}>
                                  {picked ? <CheckCircle2 className="w-3 h-3 inline mr-1 text-blue-400" /> : null}
                                  {imei}
                                </button>
                              )
                            })}
                          </div>
                          {selImeis.length > 0 && (
                            <p className="text-blue-400 text-xs mt-2 font-semibold">{selImeis.length} unit{selImeis.length !== 1 ? "s" : ""} selected for return</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {totalItems > 0 && (
            <div className="bg-white/4 border border-white/[0.08] rounded-2xl px-5 py-3.5 flex justify-between items-center">
              <span className="text-slate-400 text-sm font-medium">Returning to stock</span>
              <span className="text-white font-bold text-lg">{totalItems} unit{totalItems !== 1 ? "s" : ""}</span>
            </div>
          )}

          <div>
            <Label>Notes (optional)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Reason for return, condition..."
              className={inputCls + " resize-none"} />
          </div>
          {error && <p className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</p>}
        </div>

        <div className="px-6 py-5 flex gap-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold hover:bg-white/5 transition-all">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-900/40 active:scale-[0.98] flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" />Confirm Return
          </button>
        </div>
      </div>
    </div>
  )
}

// â"€â"€â"€ Confirm Sale Dialog â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ConfirmSaleDialog({ reservation: res, onClose, onConfirm }: {
  reservation: ReservedSale | null; onClose: () => void
  onConfirm: (id: string, paymentMethod: string, notes: string) => void
}) {
  const [method, setMethod] = useState("Cash")
  const [notes, setNotes] = useState("")
  if (!res) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl z-10"
        style={{ background: "linear-gradient(180deg, #0d1829 0%, #080f1a 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Confirm Sale</h2>
              <p className="text-slate-500 text-xs mt-0.5">{res.reservationNumber}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-2xl overflow-hidden border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.15em]">Order Summary</p>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              {res.items.map((item, i) => (
                <div key={i} className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{item.productName}</p>
                    <p className="text-slate-500 text-xs">{item.quantity} Ã- {fmt(item.unitPrice)}</p>
                  </div>
                  <p className="text-white text-sm font-bold shrink-0">{fmt(item.lineTotal)}</p>
                </div>
              ))}
              <div className="pt-2.5 mt-1 border-t border-white/[0.06] space-y-1.5">
                {res.discount > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Discount</span><span className="text-red-400">âˆ'{fmt(res.discount)}</span></div>
                )}
                <div className="flex justify-between"><span className="text-slate-300 font-semibold text-sm">Total</span><span className="text-white font-bold">{fmt(res.total)}</span></div>
                {res.advancePaid > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Advance</span><span className="text-emerald-400">âˆ'{fmt(res.advancePaid)}</span></div>
                )}
              </div>
            </div>
            <div className="bg-amber-500/10 border-t border-amber-500/20 px-4 py-3 flex justify-between items-center">
              <span className="text-amber-300 font-semibold text-sm">Balance Due</span>
              <span className="text-amber-300 font-bold text-lg">{fmt(res.balanceDue)}</span>
            </div>
          </div>

          <div>
            <Label>Payment Method</Label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all",
                    method === m ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30" : "border-white/[0.08] text-slate-400 hover:border-white/20 bg-white/3")}>
                  {PAYMENT_ICONS[m]}{m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls + " resize-none"} />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold hover:bg-white/5 transition-all">Cancel</button>
          <button onClick={() => { onConfirm(res.id, method, notes); onClose() }}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-sm font-bold hover:from-emerald-500 hover:to-emerald-400 transition-all shadow-lg shadow-emerald-900/40 active:scale-[0.98] flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />Confirm Sale
          </button>
        </div>
      </div>
    </div>
  )
}

// â"€â"€â"€ Delete / Cancel Dialogs â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function MiniDialog({ icon: Icon, iconBg, title, body, cancelLabel, confirmLabel, confirmBg, onClose, onConfirm }: {
  icon: React.ElementType; iconBg: string; title: string; body: React.ReactNode
  cancelLabel?: string; confirmLabel: string; confirmBg: string
  onClose: () => void; onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl z-10 p-7 text-center"
        style={{ background: "linear-gradient(180deg, #0d1829 0%, #080f1a 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5", iconBg)}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-white font-bold text-xl mb-2">{title}</h2>
        <div className="text-slate-400 text-sm mb-7 leading-relaxed">{body}</div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-slate-400 text-sm font-semibold hover:bg-white/5 transition-all">{cancelLabel ?? "Cancel"}</button>
          <button onClick={() => { onConfirm(); onClose() }} className={cn("flex-1 py-3 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.98]", confirmBg)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// â"€â"€â"€ Consignment Card â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ConsignmentCard({ con, onRecordSale, onRecordReturn, onPrint }: {
  con: Consignment; onRecordSale: (c: Consignment) => void; onRecordReturn: (c: Consignment) => void; onPrint: (c: Consignment) => void
}) {
  const [showHistory, setShowHistory] = useState(false)
  const outstanding = con.items.reduce((s, it) => s + (it.dispatched - it.returned - it.sold), 0)
  const pendingValue = con.items.reduce((s, it) => s + (it.dispatched - it.returned - it.sold) * it.unitPrice, 0)
  const isSettled = con.status === "Fully Settled" || con.status === "Returned"
  let expired = false
  try { if (con.dueDate) expired = isPast(parseISO(con.dueDate)) } catch {}

  const st = CON_STATUS[con.status]

  return (
    <div className={cn(
      "rounded-2xl border overflow-hidden transition-all bg-white",
      isSettled ? "border-slate-100 opacity-65" :
      expired ? "border-amber-300" : "border-slate-200 shadow-sm"
    )} style={{ background: isSettled ? "#ffffff" : expired ? "#fffbeb" : "#ffffff" }}>

      {/* Top accent bar */}
      {!isSettled && (
        <div className={cn("h-0.5 w-full", con.status === "Active" ? "bg-gradient-to-r from-blue-500 to-transparent" : con.status === "Partially Settled" ? "bg-gradient-to-r from-amber-500 to-transparent" : "")} />
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1 space-y-3">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-900 font-bold text-base tracking-tight">{con.dispatchNumber}</span>
              <span className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full border", st.bg, st.color, st.border)}>{con.status}</span>
              {!isSettled && expired && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />Overdue
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              <span className="flex items-center gap-1.5 text-slate-700 text-xs font-medium">
                <div className="w-5 h-5 rounded-md bg-slate-50 flex items-center justify-center shrink-0"><Store className="w-3 h-3 text-slate-400" /></div>
                {con.shopName}
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 text-xs">
                <Phone className="w-3 h-3" />{con.shopPhone}
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 text-xs">
                <Send className="w-3 h-3" />{format(parseISO(con.date), "dd MMM yyyy")}
              </span>
              {con.dueDate && (
                <span className={cn("flex items-center gap-1.5 text-xs", expired && !isSettled ? "text-red-400 font-semibold" : "text-slate-500")}>
                  <Clock className="w-3 h-3" />Due {format(parseISO(con.dueDate), "dd MMM yyyy")}
                </span>
              )}
            </div>

            {/* Per-item progress */}
            <div className="space-y-3">
              {con.items.map(it => {
                const out = it.dispatched - it.returned - it.sold
                const soldPct = Math.round((it.sold / it.dispatched) * 100)
                const returnedPct = Math.round((it.returned / it.dispatched) * 100)
                const outPct = Math.round((out / it.dispatched) * 100)
                return (
                  <div key={it.productId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-slate-700 text-xs font-semibold">{it.productName}</p>
                      <p className="text-slate-500 text-[11px]">{it.dispatched} dispatched</p>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-px">
                      {soldPct > 0 && <div className="bg-emerald-500 h-full rounded-l-full transition-all" style={{ width: `${soldPct}%` }} />}
                      {returnedPct > 0 && <div className="bg-slate-500 h-full transition-all" style={{ width: `${returnedPct}%` }} />}
                      {outPct > 0 && <div className="bg-blue-500/50 h-full rounded-r-full transition-all" style={{ width: `${outPct}%` }} />}
                    </div>
                    <div className="flex gap-4 mt-1.5">
                      {it.sold > 0 && <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />{it.sold} sold</span>}
                      {it.returned > 0 && <span className="flex items-center gap-1 text-slate-500 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />{it.returned} returned</span>}
                      {out > 0 && <span className="flex items-center gap-1 text-blue-400 text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 inline-block" />{out} with shop</span>}
                    </div>

                    {/* IMEI status chips */}
                    {it.imeis && it.imeis.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {it.imeis.map(imei => {
                          const isSold = it.soldImeis?.includes(imei)
                          const isRet = it.returnedImeis?.includes(imei)
                          return (
                            <span key={imei} className={cn(
                              "font-mono text-[10px] px-2 py-0.5 rounded-md border inline-flex items-center gap-1",
                              isSold ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
                              isRet ? "bg-slate-500/15 border-slate-500/30 text-slate-500 line-through" :
                              "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            )}>
                              {isSold ? <CheckCircle2 className="w-2.5 h-2.5" /> : isRet ? <RotateCcw className="w-2.5 h-2.5" /> : <Cpu className="w-2.5 h-2.5" />}
                              {imei}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {con.notes && <p className="text-slate-400 text-xs italic">{con.notes}</p>}
          </div>

          {/* Right financial panel */}
          <div className="sm:text-right shrink-0 sm:pl-4 sm:border-l sm:border-slate-200 space-y-3 min-w-[130px]">
            <div>
              <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Total Dispatched</p>
              <p className="text-slate-900 font-bold text-xl mt-0.5">{fmt(con.totalValue)}</p>
            </div>
            {con.amountCollected > 0 && (
              <div>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Collected</p>
                <p className="text-emerald-600 font-bold text-base mt-0.5">{fmt(con.amountCollected)}</p>
              </div>
            )}
            {pendingValue > 0 && (
              <div>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Pending</p>
                <p className="text-amber-600 font-bold text-base mt-0.5">{fmt(pendingValue)}</p>
              </div>
            )}
            <p className="text-slate-400 text-[11px]">{outstanding} unit{outstanding !== 1 ? "s" : ""} out</p>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: "1px solid #f1f5f9" }}>
          {!isSettled ? (
            <>
              <button onClick={() => onRecordSale(con)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/30">
                <DollarSign className="w-3.5 h-3.5" />Record Sale
              </button>
              <button onClick={() => onRecordReturn(con)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-400/40 text-xs font-semibold transition-all">
                <RotateCcw className="w-3.5 h-3.5" />Record Return
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-400 text-xs">
              {con.status === "Fully Settled" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <RotateCcw className="w-3.5 h-3.5 text-slate-400" />}
              {con.status === "Fully Settled" ? "Fully settled" : "All items returned"}
            </div>
          )}
          <button onClick={() => onPrint(con)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 text-xs font-medium transition-all ml-auto">
            <Printer className="w-3.5 h-3.5" />Print
          </button>
          {con.transactions.length > 0 && (
            <button onClick={() => setShowHistory(p => !p)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors">
              <History className="w-3.5 h-3.5" />History
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Transaction history */}
        {showHistory && (
          <div className="mt-4 space-y-2 pt-4" style={{ borderTop: "1px solid #f1f5f9" }}>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.15em] mb-3">Transaction History</p>
            {con.transactions.map(txn => (
              <div key={txn.id} className={cn("flex items-start gap-3 rounded-xl px-4 py-3 border",
                txn.type === "Sale" ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100")}>
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                  txn.type === "Sale" ? "bg-emerald-500/20" : "bg-blue-500/20")}>
                  {txn.type === "Sale" ? <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> : <RotateCcw className="w-3.5 h-3.5 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-xs font-bold", txn.type === "Sale" ? "text-emerald-400" : "text-blue-400")}>
                      {txn.type === "Sale" ? "Sale Reported" : "Items Returned"}
                    </span>
                    <span className="text-slate-400 text-xs">{format(parseISO(txn.date), "dd MMM yyyy")}</span>
                  </div>
                  {txn.items.map((it, i) => (
                    <p key={i} className="text-slate-500 text-xs mt-0.5">{it.productName} Ã-{it.quantity}{txn.type === "Sale" && <span className="text-slate-400"> - {fmt(it.quantity * it.unitPrice)}</span>}</p>
                  ))}
                  {txn.notes && <p className="text-slate-400 text-xs italic mt-1">{txn.notes}</p>}
                  {txn.type === "Sale" && txn.paymentMethod && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-slate-400">{PAYMENT_ICONS[txn.paymentMethod]}</span>
                      <span className="text-slate-400 text-xs">{txn.paymentMethod}</span>
                      <span className="ml-auto text-emerald-400 text-xs font-bold">{fmt(txn.amount)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// â"€â"€â"€ Main Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function ShopsPage() {
  const [activeTab, setActiveTab] = useState<"shops" | "reservations" | "consignments">("shops")
  const [loading, setLoading] = useState(true)

  const [shopList, setShopList] = useState<Shop[]>([])
  const [shopSearch, setShopSearch] = useState("")
  const [shopTypeFilter, setShopTypeFilter] = useState("All")
  const [shopStatusFilter, setShopStatusFilter] = useState("All")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingShop, setEditingShop] = useState<Shop | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Shop | null>(null)
  const [openShopMenu, setOpenShopMenu] = useState<string | null>(null)

  const [reservations, setReservations] = useState<ReservedSale[]>([])
  const [resSearch, setResSearch] = useState("")
  const [resStatusFilter, setResStatusFilter] = useState("Reserved")
  const [confirmTarget, setConfirmTarget] = useState<ReservedSale | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ReservedSale | null>(null)

  const [consignmentList, setConsignmentList] = useState<Consignment[]>([])
  const [conSearch, setConSearch] = useState("")
  const [conStatusFilter, setConStatusFilter] = useState("Active")
  const [saleTarget, setSaleTarget] = useState<Consignment | null>(null)
  const [returnTarget, setReturnTarget] = useState<Consignment | null>(null)
  const [newConDrawerOpen, setNewConDrawerOpen] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [shops, reserved, consignments] = await Promise.all([
          getShops(),
          getReservedSales(),
          getConsignments(),
        ])
        setShopList(shops)
        setReservations(reserved)
        setConsignmentList(consignments)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch shops data")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredShops = useMemo(() => shopList.filter(s => {
    const q = shopSearch.toLowerCase()
    return (!q || s.name.toLowerCase().includes(q) || s.ownerName.toLowerCase().includes(q) || s.city.toLowerCase().includes(q) || s.phone.includes(q))
      && (shopTypeFilter === "All" || s.shopType === shopTypeFilter)
      && (shopStatusFilter === "All" || s.status === shopStatusFilter)
  }), [shopList, shopSearch, shopTypeFilter, shopStatusFilter])

  const shopStats = useMemo(() => ({
    total: shopList.length,
    active: shopList.filter(s => s.status === "Active").length,
    totalRevenue: shopList.reduce((a, s) => a + s.totalSpent, 0),
    outstanding: shopList.reduce((a, s) => a + s.outstandingBalance, 0),
  }), [shopList])

  const filteredRes = useMemo(() => reservations.filter(r => {
    const q = resSearch.toLowerCase()
    return (!q || r.shopName.toLowerCase().includes(q) || r.reservationNumber.toLowerCase().includes(q))
      && (resStatusFilter === "All" || r.status === resStatusFilter)
  }), [reservations, resSearch, resStatusFilter])

  const resStats = useMemo(() => {
    const active = reservations.filter(r => r.status === "Reserved")
    const expiring = active.filter(r => { try { return isPast(parseISO(r.reservedUntil)) } catch { return false } })
    return { active: active.length, totalValue: active.reduce((a, r) => a + r.total, 0), totalAdvance: active.reduce((a, r) => a + r.advancePaid, 0), totalBalance: active.reduce((a, r) => a + r.balanceDue, 0), expiring: expiring.length }
  }, [reservations])

  const filteredCon = useMemo(() => consignmentList.filter(c => {
    const q = conSearch.toLowerCase()
    return (!q || c.shopName.toLowerCase().includes(q) || c.dispatchNumber.toLowerCase().includes(q))
      && (conStatusFilter === "All" || c.status === conStatusFilter)
  }), [consignmentList, conSearch, conStatusFilter])

  const conStats = useMemo(() => {
    const active = consignmentList.filter(c => c.status === "Active" || c.status === "Partially Settled")
    return {
      active: active.length,
      totalOut: active.reduce((s, c) => s + c.items.reduce((a, it) => a + (it.dispatched - it.returned - it.sold), 0), 0),
      pendingValue: active.reduce((s, c) => s + c.items.reduce((a, it) => a + (it.dispatched - it.returned - it.sold) * it.unitPrice, 0), 0),
      collected: consignmentList.reduce((s, c) => s + c.amountCollected, 0),
    }
  }, [consignmentList])

  const recomputeStatus = (items: Consignment["items"]): Consignment["status"] => {
    const totalOut = items.reduce((s, it) => s + (it.dispatched - it.returned - it.sold), 0)
    if (items.every(it => it.returned === it.dispatched)) return "Returned"
    if (items.every(it => it.sold + it.returned === it.dispatched)) return "Fully Settled"
    if (totalOut < items.reduce((s, it) => s + it.dispatched, 0)) return "Partially Settled"
    return "Active"
  }

  const handleSaveShop = async (shop: Shop) => {
    try {
      const existing = shopList.some(s => s.id === shop.id)
      if (existing) {
        const updated = await updateShop(shop.id, shop)
        setShopList(prev => prev.map(s => s.id === shop.id ? updated : s))
      } else {
        const { id: _, ...rest } = shop
        const created = await createShop(rest as Omit<Shop, 'id'>)
        setShopList(prev => [...prev, created])
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shop")
    }
  }
  const handleDeleteShop = async (id: string) => {
    try {
      await deleteShop(id)
      setShopList(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete shop")
    }
  }
  const handleConfirmSale = async (id: string, pm: string, notes: string) => {
    try {
      await confirmReservedSale(id, pm, notes)
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: "Confirmed" as const, paymentMethod: pm, notes: notes || r.notes } : r))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to confirm reservation")
    }
  }

  const handleCancelReservation = async (id: string) => {
    try {
      await cancelReservedSale(id)
      setReservations(prev => prev.map(r => r.id === id ? { ...r, status: "Cancelled" as const } : r))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel reservation")
    }
  }

  const handleRecordSale = async (conId: string, txn: ConsignmentTransaction) => {
    try {
      const updated = await recordConsignmentSale(conId, txn)
      setConsignmentList(prev => prev.map(c => c.id === conId ? updated : c))
      toast.success("Sale recorded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record sale")
    }
  }

  const handleRecordReturn = async (conId: string, txn: ConsignmentTransaction) => {
    try {
      const updated = await recordConsignmentReturn(conId, txn)
      setConsignmentList(prev => prev.map(c => c.id === conId ? updated : c))
      toast.success("Return recorded - stock restored")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record return")
    }
  }

  const handleAddConsignment = async (con: Consignment) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, transactions: _txns, dispatchNumber: _dn, ...rest } = con
      const saved = await createConsignment(rest as Omit<Consignment, "id" | "transactions">)
      setConsignmentList(prev => [saved, ...prev])
      toast.success(`Dispatch ${saved.dispatchNumber} created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create dispatch")
    }
  }

  // â"€â"€ Tab config â"€â"€
  const tabs = [
    { id: "shops" as const, label: "Shops", Icon: Store, badge: null },
    { id: "reservations" as const, label: "Reservations", Icon: Clock, badge: resStats.active > 0 ? resStats.active : null },
    { id: "consignments" as const, label: "Consignments", Icon: ArrowLeftRight, badge: conStats.active > 0 ? conStats.active : null },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* â"€â"€ Hero header â"€â"€ */}
      <div className="relative overflow-hidden bg-white border-b border-slate-200">
        <div className="relative px-6 pt-8 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
                  <Store className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Shops & Stock</h1>
              </div>
              <p className="text-slate-500 text-sm ml-13">Manage dealer accounts, reservations, and consignment stock</p>
            </div>
            {activeTab === "shops" && (
              <button onClick={() => { setEditingShop(null); setDrawerOpen(true) }}
                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-bold transition-all active:scale-95 shadow-xl shadow-blue-900/40 shrink-0">
                <Plus className="w-4 h-4" />Add Shop
              </button>
            )}
          </div>

          {/* â"€â"€ Mini stat strip â"€â"€ */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {activeTab === "shops" && [
              { label: "Total Shops", value: shopStats.total, Icon: Store, color: "text-blue-400", glow: "#3b82f6", border: "border-blue-500/15" },
              { label: "Active", value: shopStats.active, Icon: BadgeCheck, color: "text-emerald-400", glow: "#10b981", border: "border-emerald-500/15" },
              { label: "Revenue", value: fmt(shopStats.totalRevenue), Icon: TrendingUp, color: "text-violet-400", glow: "#8b5cf6", border: "border-violet-500/15" },
              { label: "Outstanding", value: fmt(shopStats.outstanding), Icon: AlertTriangle, color: "text-amber-400", glow: "#f59e0b", border: "border-amber-500/15" },
            ].map(({ label, value, Icon, color, border }) => (
              <div key={label} className={cn("rounded-2xl border bg-white px-4 py-3.5 flex items-center gap-3 shadow-sm", border)}>
                <Icon className={cn("w-5 h-5 shrink-0", color)} />
                <div className="min-w-0">
                  <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider truncate">{label}</p>
                  <p className="text-slate-900 font-bold text-base leading-tight mt-0.5 truncate">{value}</p>
                </div>
              </div>
            ))}
            {activeTab === "reservations" && [
              { label: "Active", value: resStats.active, Icon: Clock, color: "text-amber-400", border: "border-amber-500/15" },
              { label: "Stock Value", value: fmt(resStats.totalValue), Icon: ShoppingBag, color: "text-blue-400", border: "border-blue-500/15" },
              { label: "Advance", value: fmt(resStats.totalAdvance), Icon: CheckCircle2, color: "text-emerald-400", border: "border-emerald-500/15" },
              { label: "Balance Due", value: fmt(resStats.totalBalance), Icon: AlertTriangle, color: "text-red-400", border: "border-red-500/15" },
            ].map(({ label, value, Icon, color, border }) => (
              <div key={label} className={cn("rounded-2xl border bg-white px-4 py-3.5 flex items-center gap-3 shadow-sm", border)}>
                <Icon className={cn("w-5 h-5 shrink-0", color)} />
                <div className="min-w-0">
                  <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider truncate">{label}</p>
                  <p className="text-slate-900 font-bold text-base leading-tight mt-0.5 truncate">{value}</p>
                </div>
              </div>
            ))}
            {activeTab === "consignments" && [
              { label: "Active Dispatches", value: conStats.active, Icon: Send, color: "text-blue-400", border: "border-blue-500/15" },
              { label: "Items Out", value: `${conStats.totalOut} units`, Icon: Layers, color: "text-violet-400", border: "border-violet-500/15" },
              { label: "Pending Collection", value: fmt(conStats.pendingValue), Icon: AlertTriangle, color: "text-amber-400", border: "border-amber-500/15" },
              { label: "Total Collected", value: fmt(conStats.collected), Icon: CheckCircle2, color: "text-emerald-400", border: "border-emerald-500/15" },
            ].map(({ label, value, Icon, color, border }) => (
              <div key={label} className={cn("rounded-2xl border bg-white px-4 py-3.5 flex items-center gap-3 shadow-sm", border)}>
                <Icon className={cn("w-5 h-5 shrink-0", color)} />
                <div className="min-w-0">
                  <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider truncate">{label}</p>
                  <p className="text-slate-900 font-bold text-base leading-tight mt-0.5 truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* â"€â"€ Tab bar â"€â"€ */}
          <div className="mt-5 flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
            {tabs.map(({ id, label, Icon, badge }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={cn("relative flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all rounded-t-xl",
                  activeTab === id ? "text-blue-600" : "text-slate-500 hover:text-slate-700")}>
                <Icon className="w-4 h-4" />
                {label}
                {badge !== null && (
                  <span className="bg-amber-500 text-[10px] text-white font-bold px-1.5 py-0.5 rounded-full leading-none">{badge}</span>
                )}
                {activeTab === id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* â"€â"€ Content area â"€â"€ */}
      <div className="px-4 sm:px-6 py-6 space-y-5">

        {/* â•â•â•â• TAB: SHOPS â•â•â•â• */}
        {activeTab === "shops" && (
          <>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input value={shopSearch} onChange={e => setShopSearch(e.target.value)} placeholder="Search shops, owners, city..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all"
                  style={{ background: "#ffffff", border: "1px solid #e2e8f0" }} />
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                  <select value={shopTypeFilter} onChange={e => setShopTypeFilter(e.target.value)}
                    className="pl-8 pr-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all appearance-none"
                    style={{ background: "#ffffff", border: "1px solid #e2e8f0", color: "#475569" }}>
                    <option value="All">All Types</option>
                    {SHOP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <select value={shopStatusFilter} onChange={e => setShopStatusFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
                  style={{ background: "#ffffff", border: "1px solid #e2e8f0", color: "#475569" }}>
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>

            {/* Shops grid */}
            {filteredShops.length === 0 ? (
              <div className="rounded-3xl py-24 text-center bg-white border border-slate-200">
                <Store className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500 font-medium">No shops found</p>
                <p className="text-slate-400 text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      {["Shop & Owner", "Type", "Contact", "Orders", "Revenue", "Outstanding", "Status", ""].map(h => (
                        <th key={h} className="text-left text-slate-500 text-[10px] font-bold uppercase tracking-[0.12em] px-5 py-3.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShops.map((shop, idx) => {
                      const meta = TYPE_META[shop.shopType]
                      return (
                        <tr key={shop.id}
                          className="group transition-colors"
                          style={{ borderBottom: idx < filteredShops.length - 1 ? "1px solid #f1f5f9" : "none",
                            background: "#ffffff" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#ffffff")}>
                          {/* Shop */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-10 h-10 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-lg", SHOP_AVATAR_COLORS[shop.shopType])}>
                                <span className="text-white text-xs font-bold">{getInitials(shop.name)}</span>
                              </div>
                              <div>
                                <p className="text-slate-900 font-bold text-sm leading-tight">{shop.name}</p>
                                <p className="text-slate-400 text-xs mt-0.5">{shop.ownerName}</p>
                              </div>
                            </div>
                          </td>
                          {/* Type */}
                          <td className="px-5 py-4">
                            <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border", meta.bg, meta.color, meta.border)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />{shop.shopType}
                            </span>
                          </td>
                          {/* Contact */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-slate-700 text-xs font-medium"><Phone className="w-3.5 h-3.5 text-slate-400" />{shop.phone}</div>
                            <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1"><MapPin className="w-3.5 h-3.5" />{shop.city}</div>
                          </td>
                          {/* Orders */}
                          <td className="px-5 py-4">
                            <p className="text-slate-900 text-sm font-bold">{shop.totalOrders}</p>
                            {shop.lastOrderDate && <p className="text-slate-400 text-[11px] mt-0.5">Last: {format(parseISO(shop.lastOrderDate), "dd MMM")}</p>}
                          </td>
                          {/* Revenue */}
                          <td className="px-5 py-4">
                            <p className="text-emerald-600 text-sm font-bold">{fmt(shop.totalSpent)}</p>
                          </td>
                          {/* Outstanding */}
                          <td className="px-5 py-4">
                            {shop.outstandingBalance > 0
                              ? <span className="text-amber-600 text-sm font-bold">{fmt(shop.outstandingBalance)}</span>
                              : <span className="text-slate-300 text-sm">-</span>}
                          </td>
                          {/* Status */}
                          <td className="px-5 py-4">
                            <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl",
                              shop.status === "Active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-slate-500 border border-white/10")}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", shop.status === "Active" ? "bg-emerald-400" : "bg-slate-600")} />
                              {shop.status}
                            </span>
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="relative">
                              <button onClick={() => setOpenShopMenu(openShopMenu === shop.id ? null : shop.id)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all opacity-0 group-hover:opacity-100">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              {openShopMenu === shop.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setOpenShopMenu(null)} />
                                  <div className="absolute right-0 top-9 z-20 w-40 rounded-2xl shadow-2xl overflow-hidden py-1"
                                    style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}>
                                    <button onClick={() => { setEditingShop(shop); setDrawerOpen(true); setOpenShopMenu(null) }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-slate-700 text-sm hover:bg-slate-50 transition-colors">
                                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />Edit Shop
                                    </button>
                                    <button onClick={() => { setDeleteTarget(shop); setOpenShopMenu(null) }}
                                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 text-sm hover:bg-red-50 transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" />Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
                  <p className="text-slate-500 text-xs">{filteredShops.length} of {shopList.length} shops</p>
                  <p className="text-slate-500 text-xs">Outstanding: <span className="text-amber-600 font-bold">{fmt(filteredShops.reduce((a, s) => a + s.outstandingBalance, 0))}</span></p>
                </div>
              </div>
            )}
          </>
        )}

        {/* â•â•â•â• TAB: RESERVATIONS â•â•â•â• */}
        {activeTab === "reservations" && (
          <>
            {/* Alerts */}
            {resStats.expiring > 0 && (
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border border-amber-500/25 bg-amber-500/5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-amber-300 text-sm"><span className="font-bold">{resStats.expiring}</span> reservation{resStats.expiring > 1 ? "s" : ""} past due date - action required</p>
              </div>
            )}
            <div className="flex items-center gap-2.5 rounded-2xl px-4 py-3 border border-blue-200 bg-blue-50">
              <Package className="w-4 h-4 text-blue-400 shrink-0" />
              <p className="text-blue-600 text-sm">Reserved items are <span className="font-semibold text-blue-700">not counted in sales reports</span> until you click Confirm Sale.</p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input value={resSearch} onChange={e => setResSearch(e.target.value)} placeholder="Search shop or reservation number..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all"
                  style={{ background: "#ffffff", border: "1px solid #e2e8f0" }} />
              </div>
              <div className="flex gap-1.5 shrink-0 flex-wrap p-1 rounded-xl" style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                {(["All", "Reserved", "Confirmed", "Cancelled"] as const).map(s => (
                  <button key={s} onClick={() => setResStatusFilter(s)}
                    className={cn("px-4 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      resStatusFilter === s ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" : "text-slate-500 hover:text-slate-700")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Reservation cards */}
            {filteredRes.length === 0 ? (
              <div className="rounded-3xl py-24 text-center bg-white border border-slate-200">
                <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500 font-medium">No reservations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRes.map(res => {
                  let expired = false; try { expired = isPast(parseISO(res.reservedUntil)) } catch {}
                  const isReserved = res.status === "Reserved"
                  const st = RES_STATUS[res.status]
                  return (
                    <div key={res.id} className={cn("rounded-2xl border overflow-hidden transition-all",
                      isReserved && expired ? "border-amber-300" : res.status === "Confirmed" ? "border-emerald-300" : res.status === "Cancelled" ? "border-red-200 opacity-60" : "border-slate-200")}>
                      {isReserved && <div className={cn("h-0.5", expired ? "bg-gradient-to-r from-red-500 to-transparent" : "bg-gradient-to-r from-amber-500 to-transparent")} />}
                      {res.status === "Confirmed" && <div className="h-0.5 bg-gradient-to-r from-emerald-500 to-transparent" />}
                      <div className="p-5" style={{ background: isReserved && expired ? "#fffbeb" : res.status === "Confirmed" ? "#f0fdf4" : "#ffffff" }}>
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-slate-900 font-bold text-base">{res.reservationNumber}</span>
                              <span className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1", st.bg, st.color, st.border)}>
                                {res.status === "Reserved" && <Clock className="w-3 h-3" />}
                                {res.status === "Confirmed" && <CheckCircle2 className="w-3 h-3" />}
                                {res.status === "Cancelled" && <Ban className="w-3 h-3" />}
                                {res.status}
                              </span>
                              {isReserved && expired && (
                                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />Expired
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                              <span className="flex items-center gap-1.5 text-slate-700 text-xs font-medium"><Store className="w-3 h-3 text-slate-400" />{res.shopName}</span>
                              <span className="flex items-center gap-1.5 text-slate-500 text-xs"><Phone className="w-3 h-3" />{res.shopPhone}</span>
                              <span className={cn("flex items-center gap-1.5 text-xs", isReserved && expired ? "text-red-400 font-semibold" : "text-slate-500")}>
                                <Clock className="w-3 h-3" />Until {format(parseISO(res.reservedUntil), "dd MMM yyyy")}
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              {res.items.map((item, i) => (
                                <div key={i} className="flex items-center gap-2.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                                  <span className="text-slate-700 text-xs font-medium">{item.productName}</span>
                                  <span className="text-slate-400 text-xs">Ã-{item.quantity}</span>
                                  <span className="text-slate-500 text-xs">{fmt(item.lineTotal)}</span>
                                </div>
                              ))}
                            </div>
                            {res.notes && <p className="text-slate-400 text-xs italic">{res.notes}</p>}
                          </div>
                          <div className="sm:text-right shrink-0 sm:pl-4 sm:border-l sm:border-slate-200 space-y-2.5 min-w-[120px]">
                            <div><p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Total</p><p className="text-slate-900 font-bold text-xl mt-0.5">{fmt(res.total)}</p></div>
                            {res.advancePaid > 0 && <div><p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Advance</p><p className="text-emerald-600 font-bold text-base mt-0.5">{fmt(res.advancePaid)}</p></div>}
                            {res.balanceDue > 0 && <div><p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider">Balance</p><p className="text-amber-600 font-bold text-base mt-0.5">{fmt(res.balanceDue)}</p></div>}
                          </div>
                        </div>
                        {isReserved && (
                          <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: "1px solid #f1f5f9" }}>
                            <button onClick={() => setConfirmTarget(res)}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/30">
                              <CheckCircle2 className="w-3.5 h-3.5" />Confirm Sale
                            </button>
                            <button onClick={() => setCancelTarget(res)}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-red-500/25 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-all">
                              <XCircle className="w-3.5 h-3.5" />Cancel
                            </button>
                            <span className="ml-auto text-slate-400 text-xs">{format(parseISO(res.date), "dd MMM yyyy")}</span>
                          </div>
                        )}
                        {res.status === "Confirmed" && (
                          <div className="flex items-center gap-2 mt-4 pt-3.5" style={{ borderTop: "1px solid #d1fae5" }}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <p className="text-emerald-600 text-xs font-semibold">Confirmed - counted in sales reports</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* â•â•â•â• TAB: CONSIGNMENTS â•â•â•â• */}
        {activeTab === "consignments" && (
          <>
            <div className="flex items-start gap-3 rounded-2xl px-4 py-3.5 border border-blue-200 bg-blue-50">
              <ArrowLeftRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-blue-700 text-sm leading-relaxed">
                Items dispatched to other shops on consignment. They can <span className="text-emerald-600 font-semibold">sell them and pay you</span>, or <span className="text-blue-600 font-semibold">return them</span> to your stock. Sales are counted only after you record the payment.
              </p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input value={conSearch} onChange={e => setConSearch(e.target.value)} placeholder="Search shop or dispatch number..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all"
                  style={{ background: "#ffffff", border: "1px solid #e2e8f0" }} />
              </div>
              <div className="flex gap-1.5 shrink-0 flex-wrap p-1 rounded-xl" style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                {(["All", "Active", "Partially Settled", "Fully Settled", "Returned"] as const).map(s => (
                  <button key={s} onClick={() => setConStatusFilter(s)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                      conStatusFilter === s ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30" : "text-slate-500 hover:text-slate-700")}>
                    {s}
                  </button>
                ))}
              </div>
              <button onClick={() => setNewConDrawerOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-violet-900/30 shrink-0">
                <Send className="w-4 h-4" />New Dispatch
              </button>
            </div>

            {filteredCon.length === 0 ? (
              <div className="rounded-3xl py-24 text-center bg-white border border-slate-200">
                <ArrowLeftRight className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500 font-medium">No consignments found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCon.map(con => <ConsignmentCard key={con.id} con={con} onRecordSale={setSaleTarget} onRecordReturn={setReturnTarget} onPrint={printReceipt} />)}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-slate-400 text-xs">{filteredCon.length} dispatch{filteredCon.length !== 1 ? "es" : ""} shown</p>
              <p className="text-slate-500 text-xs">Pending collection:
                <span className="text-amber-600 font-bold ml-1">
                  {fmt(filteredCon.filter(c => c.status === "Active" || c.status === "Partially Settled").reduce((s, c) => s + c.items.reduce((a, it) => a + (it.dispatched - it.returned - it.sold) * it.unitPrice, 0), 0))}
                </span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* â"€â"€ Drawers & Dialogs â"€â"€ */}
      <ShopDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} editing={editingShop} onSave={handleSaveShop} />

      {deleteTarget && (
        <MiniDialog
          icon={Trash2} iconBg="bg-gradient-to-br from-red-600 to-red-700"
          title="Delete Shop" body={<>Remove <span className="text-white font-semibold">{deleteTarget.name}</span>? This cannot be undone.</>}
          confirmLabel="Delete" confirmBg="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-lg shadow-red-900/40"
          onClose={() => setDeleteTarget(null)} onConfirm={() => handleDeleteShop(deleteTarget.id)} />
      )}

      {cancelTarget && (
        <MiniDialog
          icon={XCircle} iconBg="bg-gradient-to-br from-amber-600 to-amber-700"
          title="Cancel Reservation"
          body={<>Cancel <span className="text-white font-semibold">{cancelTarget.reservationNumber}</span> for <span className="text-white font-semibold">{cancelTarget.shopName}</span>?</>}
          cancelLabel="Keep" confirmLabel="Cancel It" confirmBg="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-900/30"
          onClose={() => setCancelTarget(null)} onConfirm={() => handleCancelReservation(cancelTarget.id)} />
      )}

      <ConfirmSaleDialog reservation={confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={handleConfirmSale} />
      <RecordSaleDialog con={saleTarget} onClose={() => setSaleTarget(null)} onSave={handleRecordSale} />
      <RecordReturnDialog con={returnTarget} onClose={() => setReturnTarget(null)} onSave={handleRecordReturn} />
      <NewConsignmentDrawer open={newConDrawerOpen} onClose={() => setNewConDrawerOpen(false)} shops={shopList} onSave={handleAddConsignment} />
    </div>
  )
}

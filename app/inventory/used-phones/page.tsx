"use client"
import React, { useState, useMemo, useRef, useEffect } from "react"
import {
  Search, SlidersHorizontal, LayoutGrid, List, Plus, Calculator, Eye, Edit2,
  CheckCircle2, ChevronLeft, ChevronRight, X, BatteryMedium, Smartphone, Tag,
  TrendingUp, Package, Battery, Star, MoreVertical, Camera, Upload,
  ArrowUpRight, ArrowDownRight, Minus, Info, User, Calendar, DollarSign,
  ShoppingBag, Wrench, Shield, ChevronDown,
} from "lucide-react"
import {
  FUNCTIONAL_ISSUES,
  ACCESSORIES_LIST,
  type UsedPhone,
  type ConditionGrade,
  type ScreenCondition,
  type BodyCondition,
  type SourceType,
  type PhoneStatus,
  type UsedPTAStatus,
} from "@/data/used-phones"
import { getUsedPhones, createUsedPhone, updateUsedPhone } from "@/lib/api/inventory"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Grade / Status Meta ──────────────────────────────────────────────────────

const GRADE_META: Record<ConditionGrade, { bg: string; text: string; border: string; ring: string; label: string }> = {
  "A+": { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", ring: "ring-emerald-400", label: "A+" },
  "A":  { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200",   ring: "ring-green-400",   label: "A"  },
  "B+": { bg: "bg-lime-100",    text: "text-lime-700",    border: "border-lime-200",    ring: "ring-lime-400",    label: "B+" },
  "B":  { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200",   ring: "ring-amber-400",   label: "B"  },
  "C":  { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-200",  ring: "ring-orange-400",  label: "C"  },
  "D":  { bg: "bg-red-100",     text: "text-red-700",     border: "border-red-200",     ring: "ring-red-400",     label: "D"  },
}

const GRADE_MULTIPLIER: Record<ConditionGrade, number> = {
  "A+": 0.85, "A": 0.75, "B+": 0.65, "B": 0.55, "C": 0.40, "D": 0.25,
}

const STATUS_META: Record<PhoneStatus, { bg: string; text: string; label: string }> = {
  in_stock:      { bg: "bg-green-100",  text: "text-green-700",  label: "In Stock"      },
  under_repair:  { bg: "bg-amber-100",  text: "text-amber-700",  label: "Under Repair"  },
  sold:          { bg: "bg-slate-100",  text: "text-slate-600",  label: "Sold"          },
  listed_online: { bg: "bg-blue-100",   text: "text-blue-700",   label: "Listed Online" },
}

const PTA_META: Record<UsedPTAStatus, { bg: string; text: string; label: string }> = {
  approved: { bg: "bg-emerald-100", text: "text-emerald-700", label: "PTA Approved" },
  pending:  { bg: "bg-amber-100",   text: "text-amber-700",   label: "PTA Pending"  },
  blocked:  { bg: "bg-red-100",     text: "text-red-700",     label: "PTA Blocked"  },
}

const SCREEN_LABEL: Record<ScreenCondition, string> = {
  perfect:         "Perfect",
  minor_scratches: "Minor Scratches",
  cracked:         "Cracked",
  replaced:        "Screen Replaced",
}

const BODY_LABEL: Record<BodyCondition, string> = {
  perfect:      "Perfect",
  minor_wear:   "Minor Wear",
  dents:        "Dents / Cracks",
  heavy_damage: "Heavy Damage",
}

const SOURCE_LABEL: Record<SourceType, string> = {
  customer_trade_in:    "Customer Trade-In",
  purchased:            "Purchased",
  refurbished_in_house: "Refurbished In-House",
  auction:              "Auction",
}

const PAGE_SIZE = 12

// ─── Badge Components ─────────────────────────────────────────────────────────

function GradeBadge({ grade, size = "sm" }: { grade: ConditionGrade; size?: "sm" | "lg" }) {
  const m = GRADE_META[grade]
  return (
    <span className={cn(
      "inline-flex items-center justify-center font-bold rounded-md border",
      m.bg, m.text, m.border,
      size === "lg" ? "w-12 h-12 text-xl" : "px-2 py-0.5 text-xs"
    )}>
      {grade}
    </span>
  )
}

function StatusBadge({ status }: { status: PhoneStatus }) {
  const m = STATUS_META[status]
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", m.bg, m.text)}>{m.label}</span>
}

function PtaBadge({ pta }: { pta: UsedPTAStatus }) {
  const m = PTA_META[pta]
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", m.bg, m.text)}>{m.label}</span>
}

function BatteryBar({ value }: { value?: number }) {
  if (!value) return <span className="text-slate-400 text-xs">N/A</span>
  const color = value >= 85 ? "bg-emerald-500" : value >= 70 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-600 font-medium">{value}%</span>
    </div>
  )
}

// ─── Phone Card (Grid View) ───────────────────────────────────────────────────

function PhoneCard({
  phone,
  onView,
  onEdit,
  onSell,
}: {
  phone: UsedPhone
  onView: (p: UsedPhone) => void
  onEdit: (p: UsedPhone) => void
  onSell: (p: UsedPhone) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const profit = phone.selling_price - phone.purchase_price - phone.refurbishment_cost
  const margin = phone.selling_price > 0 ? ((profit / phone.selling_price) * 100).toFixed(0) : "0"
  const m = GRADE_META[phone.condition_grade]

  return (
    <div className={cn(
      "bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow relative group",
      m.border
    )}>
      {/* Grade ribbon */}
      <div className={cn("absolute top-3 left-3 z-10")}>
        <GradeBadge grade={phone.condition_grade} />
      </div>

      {/* Status */}
      <div className="absolute top-3 right-3 z-10">
        <StatusBadge status={phone.status} />
      </div>

      {/* Photo */}
      <div className={cn("h-40 flex items-center justify-center", m.bg)}>
        {phone.photos.length > 0 ? (
          <img src={phone.photos[0]} alt={phone.model} className="h-full w-full object-cover" />
        ) : (
          <Smartphone className={cn("w-16 h-16 opacity-30", m.text)} />
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs text-slate-400 font-medium">{phone.brand}</p>
          <h3 className="text-sm font-semibold text-slate-900 leading-tight">{phone.model}</h3>
          <p className="text-xs text-slate-400">{phone.storage} · {phone.color}</p>
        </div>

        {/* Battery */}
        <BatteryBar value={phone.battery_health} />

        {/* Pricing */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-slate-400">Selling</p>
            <p className="text-base font-bold text-slate-900">{formatCurrency(phone.selling_price)}</p>
          </div>
          <div className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-full",
            profit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          )}>
            {profit >= 0 ? "+" : ""}{margin}%
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-1 border-t border-slate-100">
          <button
            onClick={() => onView(phone)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </button>
          <button
            onClick={() => onEdit(phone)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          {phone.status === "in_stock" && (
            <button
              onClick={() => onSell(phone)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Sell
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Phone Row (List View) ────────────────────────────────────────────────────

function PhoneRow({ phone, onView, onEdit, onSell }: {
  phone: UsedPhone
  onView: (p: UsedPhone) => void
  onEdit: (p: UsedPhone) => void
  onSell: (p: UsedPhone) => void
}) {
  const profit = phone.selling_price - phone.purchase_price - phone.refurbishment_cost
  const margin = phone.selling_price > 0 ? ((profit / phone.selling_price) * 100).toFixed(0) : "0"

  return (
    <tr className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <GradeBadge grade={phone.condition_grade} />
          <div>
            <p className="text-sm font-semibold text-slate-900">{phone.model}</p>
            <p className="text-xs text-slate-400">{phone.brand} · {phone.storage} · {phone.color}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <BatteryBar value={phone.battery_health} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <PtaBadge pta={phone.pta_status} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell text-sm text-slate-600">
        {formatCurrency(phone.purchase_price + phone.refurbishment_cost)}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{formatCurrency(phone.selling_price)}</p>
        <p className={cn(
          "text-xs font-medium",
          profit >= 0 ? "text-emerald-600" : "text-red-600"
        )}>
          {profit >= 0 ? "+" : ""}{formatCurrency(profit)} ({margin}%)
        </p>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={phone.status} />
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-400">
        {formatDate(phone.purchased_date)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={() => onView(phone)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors" title="View">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onEdit(phone)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors" title="Edit">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {phone.status === "in_stock" && (
            <button onClick={() => onSell(phone)} className="p-1.5 hover:bg-emerald-50 rounded-lg text-slate-500 hover:text-emerald-700 transition-colors" title="Mark as Sold">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Details Slide-Over ───────────────────────────────────────────────────────

function DetailsSlideOver({ phone, onClose, onEdit, onSell }: {
  phone: UsedPhone
  onClose: () => void
  onEdit: (p: UsedPhone) => void
  onSell: (p: UsedPhone) => void
}) {
  const totalCost = phone.purchase_price + phone.refurbishment_cost
  const profit = phone.selling_price - totalCost
  const margin = phone.selling_price > 0 ? ((profit / phone.selling_price) * 100).toFixed(1) : "0"

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[520px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <GradeBadge grade={phone.condition_grade} size="lg" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">{phone.model}</h2>
              <p className="text-sm text-slate-500">{phone.brand} · {phone.storage} · {phone.color}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Photo */}
          {phone.photos.length > 0 && (
            <div className="rounded-xl overflow-hidden border border-slate-200 h-48">
              <img src={phone.photos[0]} alt={phone.model} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Profit Analysis */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Total Cost</p>
              <p className="text-sm font-bold text-slate-900">{formatCurrency(totalCost)}</p>
              <p className="text-[10px] text-slate-400">Purchase + Refurb</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Sell Price</p>
              <p className="text-sm font-bold text-slate-900">{formatCurrency(phone.selling_price)}</p>
              <p className="text-[10px] text-slate-400">Listed at</p>
            </div>
            <div className={cn("rounded-xl p-3", profit >= 0 ? "bg-emerald-50" : "bg-red-50")}>
              <p className="text-xs text-slate-400 mb-1">Profit</p>
              <p className={cn("text-sm font-bold", profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                {profit >= 0 ? "+" : ""}{formatCurrency(profit)}
              </p>
              <p className="text-[10px] text-slate-400">{margin}% margin</p>
            </div>
          </div>

          {/* Condition */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Condition Assessment</h3>
            <div className="space-y-2">
              {[
                { label: "Screen", value: SCREEN_LABEL[phone.screen_condition] },
                { label: "Body",   value: BODY_LABEL[phone.body_condition]     },
                { label: "Battery Health", value: phone.battery_health ? `${phone.battery_health}%` : "Not checked" },
                { label: "PTA Status", value: PTA_META[phone.pta_status].label },
                { label: "Warranty",   value: `${phone.warranty_days} days`    },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800">{value}</span>
                </div>
              ))}
              {phone.battery_health && (
                <div className="pt-1">
                  <BatteryBar value={phone.battery_health} />
                </div>
              )}
            </div>
          </div>

          {/* Functional Issues */}
          {phone.functional_issues.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Known Issues</h3>
              <div className="flex flex-wrap gap-1.5">
                {phone.functional_issues.map(id => {
                  const issue = FUNCTIONAL_ISSUES.find(f => f.id === id)
                  return issue ? (
                    <span key={id} className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded-full border border-red-100">
                      {issue.label}
                    </span>
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* Accessories */}
          {phone.accessories_included.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Included Accessories</h3>
              <div className="flex flex-wrap gap-1.5">
                {phone.accessories_included.map(id => {
                  const acc = ACCESSORIES_LIST.find(a => a.id === id)
                  return acc ? (
                    <span key={id} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                      {acc.label}
                    </span>
                  ) : null
                })}
              </div>
            </div>
          )}

          {/* Device Details */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Device Details</h3>
            <div className="space-y-2">
              {[
                { label: "IMEI",        value: phone.imei_number },
                { label: "RAM",         value: phone.ram },
                { label: "Source",      value: SOURCE_LABEL[phone.source_type] },
                { label: "Acquired",    value: formatDate(phone.purchased_date) },
                phone.source_customer_name && { label: "From Customer", value: phone.source_customer_name },
                phone.sold_date && { label: "Sold On", value: formatDate(phone.sold_date) },
              ].filter(Boolean).map(({ label, value }: any) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800 text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {phone.condition_notes && (
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Condition Notes</h3>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 leading-relaxed">{phone.condition_notes}</p>
            </div>
          )}

          {/* Cost Breakdown */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Pricing Breakdown</h3>
            <div className="space-y-2 bg-slate-50 rounded-xl p-3">
              {[
                { label: "Purchase Price",    value: formatCurrency(phone.purchase_price)     },
                { label: "Refurbishment Cost",value: formatCurrency(phone.refurbishment_cost) },
                { label: "Total Cost",        value: formatCurrency(totalCost), bold: true     },
                { label: "Selling Price",     value: formatCurrency(phone.selling_price), bold: true },
              ].map(({ label, value, bold }) => (
                <div key={label} className={cn("flex justify-between text-sm", bold && "border-t border-slate-200 pt-2 mt-1")}>
                  <span className={bold ? "font-semibold text-slate-700" : "text-slate-500"}>{label}</span>
                  <span className={bold ? "font-bold text-slate-900" : "font-medium text-slate-700"}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 flex gap-2 flex-shrink-0">
          <button
            onClick={() => onEdit(phone)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>
          {phone.status === "in_stock" && (
            <button
              onClick={() => onSell(phone)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> Mark as Sold
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Mark as Sold Dialog ──────────────────────────────────────────────────────

function MarkAsSoldDialog({ phone, onClose, onSold }: {
  phone: UsedPhone
  onClose: () => void
  onSold: (id: string, customerName: string, price: number) => void
}) {
  const [customerName, setCustomerName] = useState("")
  const [finalPrice, setFinalPrice] = useState(phone.selling_price.toString())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const price = Number(finalPrice)
    if (!price || price <= 0) { toast.error("Enter a valid sale price"); return }
    onSold(phone.id, customerName || "Walk-In Customer", price)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Mark as Sold</h2>
            <p className="text-sm text-slate-500 mt-0.5">{phone.brand} {phone.model} · Grade {phone.condition_grade}</p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name (optional)</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Walk-In Customer"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Final Sale Price (₨)</label>
              <input
                type="number"
                value={finalPrice}
                onChange={e => setFinalPrice(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={1}
                required
              />
              <p className="text-xs text-slate-400 mt-1">Listed price: {formatCurrency(phone.selling_price)}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
                Confirm Sale
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── Trade-In Calculator ──────────────────────────────────────────────────────

function TradeInCalculatorDialog({ onClose, brands }: { onClose: () => void; brands: string[] }) {
  const [brand, setBrand] = useState("")
  const [model, setModel] = useState("")
  const [grade, setGrade] = useState<ConditionGrade>("B")
  const [battery, setBattery] = useState("80")
  const [marketPrice, setMarketPrice] = useState("")
  const [result, setResult] = useState<{ buyPrice: number; sellPrice: number; profit: number } | null>(null)

  const calculate = (e: React.FormEvent) => {
    e.preventDefault()
    const market = Number(marketPrice)
    if (!market || market <= 0) { toast.error("Enter estimated market price"); return }
    const batt = Math.min(Math.max(Number(battery) || 80, 0), 100)
    const battFactor = 0.5 + (batt / 100) * 0.5
    const buyPrice  = Math.round(market * GRADE_MULTIPLIER[grade] * battFactor / 500) * 500
    const margin    = grade === "A+" ? 1.15 : grade === "A" ? 1.18 : grade === "B+" ? 1.20 : grade === "B" ? 1.22 : grade === "C" ? 1.25 : 1.30
    const sellPrice = Math.round(buyPrice * margin / 500) * 500
    setResult({ buyPrice, sellPrice, profit: sellPrice - buyPrice })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">Trade-In Calculator</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={calculate} className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                <select
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select brand</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  placeholder="e.g. Galaxy A54"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Condition Grade</label>
                <div className="flex gap-1.5 flex-wrap">
                  {(["A+","A","B+","B","C","D"] as ConditionGrade[]).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGrade(g)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-sm font-bold border transition-all",
                        grade === g
                          ? cn(GRADE_META[g].bg, GRADE_META[g].text, GRADE_META[g].border)
                          : "border-slate-200 text-slate-400 hover:border-slate-300"
                      )}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Battery Health (%)</label>
                <input
                  type="number"
                  value={battery}
                  onChange={e => setBattery(e.target.value)}
                  min={0} max={100}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Market Price (New / Avg Used) — ₨</label>
              <input
                type="number"
                value={marketPrice}
                onChange={e => setMarketPrice(e.target.value)}
                placeholder="e.g. 80000"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Result */}
            {result && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Suggested Prices</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Buy From Customer</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(result.buyPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Sell Price</p>
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(result.sellPrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Expected Profit</p>
                    <p className="text-lg font-bold text-emerald-700">+{formatCurrency(result.profit)}</p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Formula: Market × {GRADE_MULTIPLIER[grade]} (grade) × battery factor. Prices rounded to nearest ₨500.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
                Close
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                <Calculator className="w-4 h-4" /> Calculate
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ─── Add / Edit Dialog (5-step) ───────────────────────────────────────────────

type FormData = {
  brand: string; model: string; color: string; storage: string; ram: string
  imei_number: string; source_type: SourceType; source_customer_name: string
  purchased_date: string; purchase_price: string
  condition_grade: ConditionGrade; screen_condition: ScreenCondition
  body_condition: BodyCondition; battery_health: string
  functional_issues: string[]; accessories_included: string[]; condition_notes: string
  refurbishment_cost: string; selling_price: string
  warranty_days: string; pta_status: UsedPTAStatus; status: PhoneStatus
  photos: string[]
}

const EMPTY_FORM: FormData = {
  brand: "", model: "", color: "", storage: "128GB", ram: "4GB",
  imei_number: "", source_type: "customer_trade_in", source_customer_name: "",
  purchased_date: new Date().toISOString().split("T")[0], purchase_price: "",
  condition_grade: "B", screen_condition: "perfect", body_condition: "minor_wear",
  battery_health: "", functional_issues: [], accessories_included: [], condition_notes: "",
  refurbishment_cost: "0", selling_price: "",
  warranty_days: "7", pta_status: "approved", status: "in_stock",
  photos: [],
}

const STEPS = ["Basic Info", "Condition", "Pricing", "Photos", "Review"]

function AddEditDialog({ editPhone, onClose, onSave, brands, colors, storageOptions, ramOptions, onAddBrand, onAddColor, onAddStorage, onAddRam }: {
  editPhone: UsedPhone | null
  onClose: () => void
  onSave: (data: Partial<UsedPhone>) => void
  brands: string[]
  colors: string[]
  storageOptions: string[]
  ramOptions: string[]
  onAddBrand: (name: string) => Promise<boolean>
  onAddColor: (name: string) => Promise<boolean>
  onAddStorage: (name: string) => Promise<boolean>
  onAddRam: (name: string) => Promise<boolean>
}) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(() => {
    if (!editPhone) return EMPTY_FORM
    return {
      brand: editPhone.brand, model: editPhone.model, color: editPhone.color,
      storage: editPhone.storage, ram: editPhone.ram,
      imei_number: editPhone.imei_number,
      source_type: editPhone.source_type,
      source_customer_name: editPhone.source_customer_name ?? "",
      purchased_date: editPhone.purchased_date,
      purchase_price: editPhone.purchase_price.toString(),
      condition_grade: editPhone.condition_grade,
      screen_condition: editPhone.screen_condition,
      body_condition: editPhone.body_condition,
      battery_health: editPhone.battery_health?.toString() ?? "",
      functional_issues: editPhone.functional_issues,
      accessories_included: editPhone.accessories_included,
      condition_notes: editPhone.condition_notes ?? "",
      refurbishment_cost: editPhone.refurbishment_cost.toString(),
      selling_price: editPhone.selling_price.toString(),
      warranty_days: editPhone.warranty_days.toString(),
      pta_status: editPhone.pta_status,
      status: editPhone.status,
      photos: editPhone.photos,
    }
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // "Add New" inline form states
  const [showNewBrand, setShowNewBrand] = useState(false)
  const [newBrandName, setNewBrandName] = useState("")
  const [addingBrand, setAddingBrand] = useState(false)

  const [showNewColor, setShowNewColor] = useState(false)
  const [newColorName, setNewColorName] = useState("")
  const [addingColor, setAddingColor] = useState(false)

  const [showNewStorage, setShowNewStorage] = useState(false)
  const [newStorageName, setNewStorageName] = useState("")
  const [addingStorage, setAddingStorage] = useState(false)

  const [showNewRam, setShowNewRam] = useState(false)
  const [newRamName, setNewRamName] = useState("")
  const [addingRam, setAddingRam] = useState(false)

  const set = (key: keyof FormData, val: any) => setForm(prev => ({ ...prev, [key]: val }))
  const toggleCheck = (key: "functional_issues" | "accessories_included", id: string) => {
    setForm(prev => {
      const arr = prev[key]
      return { ...prev, [key]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] }
    })
  }

  const validateStep = () => {
    if (step === 0) {
      if (!form.brand || !form.model || !form.imei_number)
        return "Fill in brand, model, and IMEI"
      if (!/^\d{15}$/.test(form.imei_number))
        return "IMEI must be exactly 15 digits"
      if (!form.purchase_price || isNaN(Number(form.purchase_price)) || Number(form.purchase_price) <= 0)
        return "Enter a valid purchase price"
    }
    if (step === 2) {
      if (!form.selling_price || isNaN(Number(form.selling_price)) || Number(form.selling_price) <= 0)
        return "Enter a valid selling price"
    }
    return null
  }

  const next = () => {
    const err = validateStep()
    if (err) { toast.error(err); return }
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }
  const back = () => setStep(s => Math.max(s - 1, 0))

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const urls = files.map(f => URL.createObjectURL(f))
    setForm(prev => ({ ...prev, photos: [...prev.photos, ...urls] }))
  }

  const handleSubmit = () => {
    const err = validateStep()
    if (err) { toast.error(err); return }
    onSave({
      brand: form.brand, model: form.model, color: form.color,
      storage: form.storage, ram: form.ram,
      imei_number: form.imei_number,
      source_type: form.source_type,
      source_customer_name: form.source_customer_name || undefined,
      purchased_date: form.purchased_date,
      purchase_price: Number(form.purchase_price),
      condition_grade: form.condition_grade,
      screen_condition: form.screen_condition,
      body_condition: form.body_condition,
      battery_health: form.battery_health ? Number(form.battery_health) : undefined,
      functional_issues: form.functional_issues,
      accessories_included: form.accessories_included,
      condition_notes: form.condition_notes || undefined,
      refurbishment_cost: Number(form.refurbishment_cost) || 0,
      selling_price: Number(form.selling_price),
      warranty_days: Number(form.warranty_days) || 7,
      pta_status: form.pta_status,
      status: form.status,
      photos: form.photos,
    })
  }

  const totalCost = (Number(form.purchase_price) || 0) + (Number(form.refurbishment_cost) || 0)
  const profit    = (Number(form.selling_price) || 0) - totalCost
  const margin    = form.selling_price && Number(form.selling_price) > 0
    ? ((profit / Number(form.selling_price)) * 100).toFixed(0)
    : "0"

  const F = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const selectCls = inputCls

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl h-[95vh] sm:h-auto sm:max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">{editPhone ? "Edit Used Phone" : "Add Used Phone"}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
          </div>

          {/* Step indicators */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-100 flex-shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1 min-w-max">
              {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  <div className={cn(
                    "flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 py-1 rounded-full transition-all whitespace-nowrap",
                    i === step ? "bg-blue-100 text-blue-700" :
                    i < step  ? "bg-emerald-100 text-emerald-700" :
                    "text-slate-400"
                  )}>
                    <span className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0",
                      i === step ? "bg-blue-600 text-white" :
                      i < step  ? "bg-emerald-500 text-white" :
                      "bg-slate-200"
                    )}>
                      {i < step ? "✓" : i + 1}
                    </span>
                    <span className="hidden sm:inline">{s}</span>
                    <span className="sm:hidden">{s.split(" ")[0]}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200 min-w-1 sm:min-w-2" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:p-6">
            {/* Step 1: Basic Info */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Brand" required>
                    {!showNewBrand ? (
                      <>
                        <select value={form.brand} onChange={e => set("brand", e.target.value)} className={selectCls}>
                          <option value="">Select brand</option>
                          {brands.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <button type="button" onClick={() => setShowNewBrand(true)}
                          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1">
                          <Plus className="w-3 h-3" /> Add New Brand
                        </button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <input placeholder="e.g. Huawei" value={newBrandName} onChange={e => setNewBrandName(e.target.value)}
                          className={inputCls + " flex-1"} autoFocus
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              if (!newBrandName.trim()) return
                              setAddingBrand(true)
                              const ok = await onAddBrand(newBrandName.trim())
                              setAddingBrand(false)
                              if (ok) { set("brand", newBrandName.trim()); setNewBrandName(""); setShowNewBrand(false) }
                            }
                          }} />
                        <button type="button" disabled={!newBrandName.trim() || addingBrand}
                          className="h-9 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                          onClick={async () => {
                            if (!newBrandName.trim()) return
                            setAddingBrand(true)
                            const ok = await onAddBrand(newBrandName.trim())
                            setAddingBrand(false)
                            if (ok) { set("brand", newBrandName.trim()); setNewBrandName(""); setShowNewBrand(false) }
                          }}>
                          {addingBrand ? "..." : "Save"}
                        </button>
                        <button type="button" onClick={() => { setShowNewBrand(false); setNewBrandName("") }}
                          className="h-9 px-2 text-slate-400 hover:text-slate-600">&#x2715;</button>
                      </div>
                    )}
                  </F>
                  <F label="Model" required>
                    <input type="text" value={form.model} onChange={e => set("model", e.target.value)} placeholder="e.g. Galaxy A54" className={inputCls} />
                  </F>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <F label="Color">
                    {!showNewColor ? (
                      <>
                        <select value={form.color} onChange={e => set("color", e.target.value)} className={selectCls}>
                          <option value="">Select</option>
                          {colors.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" onClick={() => setShowNewColor(true)}
                          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1">
                          <Plus className="w-3 h-3" /> Add New Color
                        </button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <input placeholder="e.g. Rose Gold" value={newColorName} onChange={e => setNewColorName(e.target.value)}
                          className={inputCls + " flex-1"} autoFocus
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              if (!newColorName.trim()) return
                              setAddingColor(true)
                              const ok = await onAddColor(newColorName.trim())
                              setAddingColor(false)
                              if (ok) { set("color", newColorName.trim()); setNewColorName(""); setShowNewColor(false) }
                            }
                          }} />
                        <button type="button" disabled={!newColorName.trim() || addingColor}
                          className="h-9 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                          onClick={async () => {
                            if (!newColorName.trim()) return
                            setAddingColor(true)
                            const ok = await onAddColor(newColorName.trim())
                            setAddingColor(false)
                            if (ok) { set("color", newColorName.trim()); setNewColorName(""); setShowNewColor(false) }
                          }}>
                          {addingColor ? "..." : "Save"}
                        </button>
                        <button type="button" onClick={() => { setShowNewColor(false); setNewColorName("") }}
                          className="h-9 px-2 text-slate-400 hover:text-slate-600">&#x2715;</button>
                      </div>
                    )}
                  </F>
                  <F label="Storage">
                    {!showNewStorage ? (
                      <>
                        <select value={form.storage} onChange={e => set("storage", e.target.value)} className={selectCls}>
                          {storageOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button type="button" onClick={() => setShowNewStorage(true)}
                          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1">
                          <Plus className="w-3 h-3" /> Add New Storage
                        </button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <input placeholder="e.g. 512GB" value={newStorageName} onChange={e => setNewStorageName(e.target.value)}
                          className={inputCls + " flex-1"} autoFocus
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              if (!newStorageName.trim()) return
                              setAddingStorage(true)
                              const ok = await onAddStorage(newStorageName.trim())
                              setAddingStorage(false)
                              if (ok) { set("storage", newStorageName.trim()); setNewStorageName(""); setShowNewStorage(false) }
                            }
                          }} />
                        <button type="button" disabled={!newStorageName.trim() || addingStorage}
                          className="h-9 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                          onClick={async () => {
                            if (!newStorageName.trim()) return
                            setAddingStorage(true)
                            const ok = await onAddStorage(newStorageName.trim())
                            setAddingStorage(false)
                            if (ok) { set("storage", newStorageName.trim()); setNewStorageName(""); setShowNewStorage(false) }
                          }}>
                          {addingStorage ? "..." : "Save"}
                        </button>
                        <button type="button" onClick={() => { setShowNewStorage(false); setNewStorageName("") }}
                          className="h-9 px-2 text-slate-400 hover:text-slate-600">&#x2715;</button>
                      </div>
                    )}
                  </F>
                  <F label="RAM">
                    {!showNewRam ? (
                      <>
                        <select value={form.ram} onChange={e => set("ram", e.target.value)} className={selectCls}>
                          {ramOptions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button type="button" onClick={() => setShowNewRam(true)}
                          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1">
                          <Plus className="w-3 h-3" /> Add New RAM
                        </button>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <input placeholder="e.g. 12GB" value={newRamName} onChange={e => setNewRamName(e.target.value)}
                          className={inputCls + " flex-1"} autoFocus
                          onKeyDown={async (e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              if (!newRamName.trim()) return
                              setAddingRam(true)
                              const ok = await onAddRam(newRamName.trim())
                              setAddingRam(false)
                              if (ok) { set("ram", newRamName.trim()); setNewRamName(""); setShowNewRam(false) }
                            }
                          }} />
                        <button type="button" disabled={!newRamName.trim() || addingRam}
                          className="h-9 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                          onClick={async () => {
                            if (!newRamName.trim()) return
                            setAddingRam(true)
                            const ok = await onAddRam(newRamName.trim())
                            setAddingRam(false)
                            if (ok) { set("ram", newRamName.trim()); setNewRamName(""); setShowNewRam(false) }
                          }}>
                          {addingRam ? "..." : "Save"}
                        </button>
                        <button type="button" onClick={() => { setShowNewRam(false); setNewRamName("") }}
                          className="h-9 px-2 text-slate-400 hover:text-slate-600">&#x2715;</button>
                      </div>
                    )}
                  </F>
                </div>
                <F label="IMEI Number" required>
                  <input type="text" value={form.imei_number} onChange={e => set("imei_number", e.target.value.replace(/\D/g,"").slice(0,15))} placeholder="15-digit IMEI" maxLength={15} className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">{form.imei_number.length}/15 digits</p>
                </F>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Source Type">
                    <select value={form.source_type} onChange={e => set("source_type", e.target.value as SourceType)} className={selectCls}>
                      {(Object.entries(SOURCE_LABEL) as [SourceType, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </F>
                  <F label="Customer / Source Name">
                    <input type="text" value={form.source_customer_name} onChange={e => set("source_customer_name", e.target.value)} placeholder="Optional" className={inputCls} />
                  </F>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Date Acquired">
                    <input type="date" value={form.purchased_date} onChange={e => set("purchased_date", e.target.value)} className={inputCls} />
                  </F>
                  <F label="Purchase Price (₨)" required>
                    <input type="number" value={form.purchase_price} onChange={e => set("purchase_price", e.target.value)} placeholder="0" min={0} className={inputCls} />
                  </F>
                </div>
              </div>
            )}

            {/* Step 2: Condition */}
            {step === 1 && (
              <div className="space-y-5">
                <F label="Condition Grade">
                  <div className="flex gap-2 flex-wrap mt-1">
                    {(["A+","A","B+","B","C","D"] as ConditionGrade[]).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => set("condition_grade", g)}
                        className={cn(
                          "px-4 py-2 rounded-xl font-bold border-2 transition-all text-sm",
                          form.condition_grade === g
                            ? cn(GRADE_META[g].bg, GRADE_META[g].text, GRADE_META[g].border)
                            : "border-slate-200 text-slate-400 hover:border-slate-300"
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {form.condition_grade === "A+" ? "Like new — no visible wear" :
                     form.condition_grade === "A"  ? "Excellent — very minor wear" :
                     form.condition_grade === "B+" ? "Good — light scratches, minor issues" :
                     form.condition_grade === "B"  ? "Moderate wear, functional" :
                     form.condition_grade === "C"  ? "Heavy wear, multiple issues" :
                     "Poor — significant damage"}
                  </p>
                </F>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Screen Condition">
                    <select value={form.screen_condition} onChange={e => set("screen_condition", e.target.value as ScreenCondition)} className={selectCls}>
                      {(Object.entries(SCREEN_LABEL) as [ScreenCondition, string][]).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </F>
                  <F label="Body Condition">
                    <select value={form.body_condition} onChange={e => set("body_condition", e.target.value as BodyCondition)} className={selectCls}>
                      {(Object.entries(BODY_LABEL) as [BodyCondition, string][]).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </F>
                </div>
                <F label="Battery Health (%)">
                  <input type="number" value={form.battery_health} onChange={e => set("battery_health", e.target.value)} placeholder="e.g. 85" min={0} max={100} className={inputCls} />
                  {form.battery_health && <BatteryBar value={Number(form.battery_health)} />}
                </F>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Functional Issues</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FUNCTIONAL_ISSUES.map(fi => (
                      <label key={fi.id} className={cn(
                        "flex items-center gap-2 p-2 border rounded-lg cursor-pointer text-xs transition-all",
                        form.functional_issues.includes(fi.id) ? "bg-red-50 border-red-300 text-red-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}>
                        <input
                          type="checkbox"
                          checked={form.functional_issues.includes(fi.id)}
                          onChange={() => toggleCheck("functional_issues", fi.id)}
                          className="w-3.5 h-3.5 accent-red-600"
                        />
                        {fi.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Accessories Included</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {ACCESSORIES_LIST.map(acc => (
                      <label key={acc.id} className={cn(
                        "flex items-center gap-2 p-2 border rounded-lg cursor-pointer text-xs transition-all",
                        form.accessories_included.includes(acc.id) ? "bg-blue-50 border-blue-300 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}>
                        <input
                          type="checkbox"
                          checked={form.accessories_included.includes(acc.id)}
                          onChange={() => toggleCheck("accessories_included", acc.id)}
                          className="w-3.5 h-3.5 accent-blue-600"
                        />
                        {acc.label}
                      </label>
                    ))}
                  </div>
                </div>
                <F label="Condition Notes">
                  <textarea
                    value={form.condition_notes}
                    onChange={e => set("condition_notes", e.target.value)}
                    rows={3}
                    placeholder="Describe the condition in detail..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </F>
              </div>
            )}

            {/* Step 3: Pricing */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Refurbishment Cost (₨)">
                    <input type="number" value={form.refurbishment_cost} onChange={e => set("refurbishment_cost", e.target.value)} placeholder="0" min={0} className={inputCls} />
                  </F>
                  <F label="Selling Price (₨)" required>
                    <input type="number" value={form.selling_price} onChange={e => set("selling_price", e.target.value)} placeholder="0" min={0} className={inputCls} />
                  </F>
                </div>
                {/* Profit preview */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400">Total Cost</p>
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(totalCost)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400">Sell Price</p>
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(Number(form.selling_price) || 0)}</p>
                  </div>
                  <div className={cn("rounded-xl p-3", profit >= 0 ? "bg-emerald-50" : "bg-red-50")}>
                    <p className="text-xs text-slate-400">Profit</p>
                    <p className={cn("text-sm font-bold", profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                      {profit >= 0 ? "+" : ""}{formatCurrency(profit)} ({margin}%)
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <F label="PTA Status">
                    <select value={form.pta_status} onChange={e => set("pta_status", e.target.value as UsedPTAStatus)} className={selectCls}>
                      <option value="approved">PTA Approved</option>
                      <option value="pending">PTA Pending</option>
                      <option value="blocked">PTA Blocked</option>
                    </select>
                  </F>
                  <F label="Status">
                    <select value={form.status} onChange={e => set("status", e.target.value as PhoneStatus)} className={selectCls}>
                      <option value="in_stock">In Stock</option>
                      <option value="under_repair">Under Repair</option>
                      <option value="listed_online">Listed Online</option>
                    </select>
                  </F>
                  <F label="Warranty (days)">
                    <select value={form.warranty_days} onChange={e => set("warranty_days", e.target.value)} className={selectCls}>
                      {["0","3","7","10","14","30"].map(d => <option key={d} value={d}>{d === "0" ? "No Warranty" : `${d} days`}</option>)}
                    </select>
                  </F>
                </div>
              </div>
            )}

            {/* Step 4: Photos */}
            {step === 3 && (
              <div className="space-y-4">
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-3 text-slate-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-500 transition-all"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-sm font-medium">Click to upload photos</span>
                  <span className="text-xs">PNG, JPG, JPEG supported</span>
                </button>
                {form.photos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {form.photos.map((url, i) => (
                      <div key={i} className="relative rounded-xl overflow-hidden border border-slate-200 aspect-square">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, photos: prev.photos.filter((_,j) => j !== i) }))}
                          className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-red-500 hover:bg-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm text-slate-400">No photos added yet. Photos are optional.</p>
                )}
              </div>
            )}

            {/* Step 5: Review */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Device</p>
                    {[
                      { l: "Brand/Model", v: `${form.brand} ${form.model}` },
                      { l: "Color/Storage", v: `${form.color} · ${form.storage}` },
                      { l: "RAM", v: form.ram },
                      { l: "IMEI", v: form.imei_number },
                      { l: "Source", v: SOURCE_LABEL[form.source_type] },
                      { l: "Date", v: formatDate(form.purchased_date) },
                    ].map(({l,v}) => (
                      <div key={l} className="flex justify-between text-sm">
                        <span className="text-slate-500">{l}</span>
                        <span className="font-medium text-slate-800 text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Condition</p>
                    {[
                      { l: "Grade",   v: form.condition_grade },
                      { l: "Screen",  v: SCREEN_LABEL[form.screen_condition] },
                      { l: "Body",    v: BODY_LABEL[form.body_condition] },
                      { l: "Battery", v: form.battery_health ? `${form.battery_health}%` : "Not checked" },
                      { l: "Issues",  v: form.functional_issues.length === 0 ? "None" : `${form.functional_issues.length} issue(s)` },
                    ].map(({l,v}) => (
                      <div key={l} className="flex justify-between text-sm">
                        <span className="text-slate-500">{l}</span>
                        <span className="font-medium text-slate-800">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={cn("rounded-xl p-4 border-2", profit >= 0 ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Financials</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-slate-400">Total Cost</p>
                      <p className="text-base font-bold text-slate-900">{formatCurrency(totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Sell Price</p>
                      <p className="text-base font-bold text-slate-900">{formatCurrency(Number(form.selling_price) || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Profit ({margin}%)</p>
                      <p className={cn("text-base font-bold", profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                        {profit >= 0 ? "+" : ""}{formatCurrency(profit)}
                      </p>
                    </div>
                  </div>
                </div>
                {form.photos.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Photos ({form.photos.length})</p>
                    <div className="flex gap-2">
                      {form.photos.slice(0,4).map((url, i) => (
                        <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex items-center justify-between flex-shrink-0 gap-2">
            <button
              type="button"
              onClick={step === 0 ? onClose : back}
              className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 border border-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {step === 0 ? "Cancel" : "Back"}
            </button>
            <span className="text-[10px] sm:text-xs text-slate-400 flex-shrink-0">Step {step + 1} of {STEPS.length}</span>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 text-white text-xs sm:text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {editPhone ? "Save" : "Add"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsedPhonesPage() {
  const [phones, setPhones] = useState<UsedPhone[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]             = useState("")
  const [gradeFilter, setGradeFilter]   = useState<ConditionGrade | "">("")
  const [brandFilter, setBrandFilter]   = useState("")
  const [statusFilter, setStatusFilter] = useState<PhoneStatus | "">("")
  const [ptaFilter, setPtaFilter]       = useState<UsedPTAStatus | "">("")
  const [minPrice, setMinPrice]         = useState("")
  const [maxPrice, setMaxPrice]         = useState("")
  const [minBattery, setMinBattery]     = useState("")
  const [showFilters, setShowFilters]   = useState(false)
  const [viewMode, setViewMode]         = useState<"grid" | "list">("grid")
  const [page, setPage]                 = useState(1)

  const [selectedPhone, setSelectedPhone] = useState<UsedPhone | null>(null)
  const [showDetails, setShowDetails]     = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editPhone, setEditPhone]         = useState<UsedPhone | null>(null)
  const [showCalculator, setShowCalculator] = useState(false)
  const [sellPhone, setSellPhone]         = useState<UsedPhone | null>(null)

  // ── Dynamic dropdown data ─────────────────────────────────────────────────
  const [brands, setBrands] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [storageOptions, setStorageOptions] = useState<string[]>([])
  const [ramOptions, setRamOptions] = useState<string[]>([])

  async function fetchBrands() {
    const tenantId = await getTenantId()
    const { data } = await supabase.from("brands").select("name").eq("tenant_id", tenantId).eq("status", "Active").order("name")
    if (data) setBrands(data.map(d => d.name))
  }

  async function fetchColors() {
    const tenantId = await getTenantId()
    const { data } = await supabase.from("colors").select("name").eq("tenant_id", tenantId).order("name")
    if (data) setColors(data.map(d => d.name))
  }

  async function fetchStorageOptions() {
    const tenantId = await getTenantId()
    const { data } = await supabase.from("storage_options").select("name").eq("tenant_id", tenantId).order("name")
    if (data) setStorageOptions(data.map(d => d.name))
  }

  async function fetchRamOptions() {
    const tenantId = await getTenantId()
    const { data } = await supabase.from("ram_options").select("name").eq("tenant_id", tenantId).order("name")
    if (data) setRamOptions(data.map(d => d.name))
  }

  async function handleAddBrand(name: string): Promise<boolean> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("brands").insert({ tenant_id: tenantId, name: name.trim(), logo_initials: name.trim().substring(0, 2).toUpperCase(), status: "Active" })
    if (error) { toast.error("Failed: " + error.message); return false }
    setBrands(prev => [...new Set([...prev, name.trim()])].sort())
    toast.success(`Brand "${name.trim()}" added!`)
    return true
  }

  async function handleAddColor(name: string): Promise<boolean> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("colors").insert({ tenant_id: tenantId, name: name.trim() })
    if (error) { toast.error("Failed: " + error.message); return false }
    setColors(prev => [...new Set([...prev, name.trim()])].sort())
    toast.success(`Color "${name.trim()}" added!`)
    return true
  }

  async function handleAddStorage(name: string): Promise<boolean> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("storage_options").insert({ tenant_id: tenantId, name: name.trim() })
    if (error) { toast.error("Failed: " + error.message); return false }
    setStorageOptions(prev => [...new Set([...prev, name.trim()])].sort())
    toast.success(`Storage "${name.trim()}" added!`)
    return true
  }

  async function handleAddRam(name: string): Promise<boolean> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("ram_options").insert({ tenant_id: tenantId, name: name.trim() })
    if (error) { toast.error("Failed: " + error.message); return false }
    setRamOptions(prev => [...new Set([...prev, name.trim()])].sort())
    toast.success(`RAM "${name.trim()}" added!`)
    return true
  }

  // ── Fetch data from Supabase ──────────────────────────────────────────────
  async function fetchPhones() {
    try {
      const data = await getUsedPhones()
      setPhones(data as unknown as UsedPhone[])
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch used phones")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPhones()
    fetchBrands()
    fetchColors()
    fetchStorageOptions()
    fetchRamOptions()
  }, [])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalInvested = phones.reduce((s, p) => s + p.purchase_price + p.refurbishment_cost, 0)
    const revenueSold   = phones.filter(p => p.status === "sold").reduce((s, p) => s + p.selling_price, 0)
    const gradeCount    = (["A+","A","B+","B","C","D"] as ConditionGrade[]).reduce((acc, g) => {
      acc[g] = phones.filter(p => p.condition_grade === g).length
      return acc
    }, {} as Record<ConditionGrade, number>)
    const profitSold    = phones.filter(p => p.status === "sold").reduce((s, p) => s + p.selling_price - p.purchase_price - p.refurbishment_cost, 0)
    return { total: phones.length, totalInvested, revenueSold, gradeCount, profitSold }
  }, [phones])

  // ── Filtered ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let res = [...phones]
    if (search)     res = res.filter(p => `${p.brand} ${p.model} ${p.color} ${p.imei_number}`.toLowerCase().includes(search.toLowerCase()))
    if (gradeFilter) res = res.filter(p => p.condition_grade === gradeFilter)
    if (brandFilter) res = res.filter(p => p.brand === brandFilter)
    if (statusFilter) res = res.filter(p => p.status === statusFilter)
    if (ptaFilter)   res = res.filter(p => p.pta_status === ptaFilter)
    if (minPrice)    res = res.filter(p => p.selling_price >= Number(minPrice))
    if (maxPrice)    res = res.filter(p => p.selling_price <= Number(maxPrice))
    if (minBattery)  res = res.filter(p => (p.battery_health ?? 0) >= Number(minBattery))
    return res
  }, [phones, search, gradeFilter, brandFilter, statusFilter, ptaFilter, minPrice, maxPrice, minBattery])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const resetPage = () => setPage(1)

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleView = (p: UsedPhone) => { setSelectedPhone(p); setShowDetails(true) }
  const handleEdit = (p: UsedPhone) => { setEditPhone(p); setShowAddDialog(true); setShowDetails(false) }
  const handleSell = (p: UsedPhone) => { setSellPhone(p); setShowDetails(false) }

  const handleSave = async (data: Partial<UsedPhone>) => {
    try {
      if (editPhone) {
        // Optimistic local update
        setPhones(prev => prev.map(p => p.id === editPhone.id ? { ...p, ...data } : p))
        // Persist to Supabase
        await updateUsedPhone(editPhone.id, data as Record<string, unknown>).catch(() => {})
        toast.success("Phone updated successfully")
      } else {
        const newPhone: UsedPhone = {
          id: `used-${Date.now()}`,
          imei_number: "", brand: "", model: "", color: "", storage: "", ram: "",
          condition_grade: "B", screen_condition: "perfect", body_condition: "minor_wear",
          functional_issues: [], accessories_included: [],
          source_type: "customer_trade_in", purchase_price: 0, refurbishment_cost: 0,
          selling_price: 0, pta_status: "approved", status: "in_stock", warranty_days: 7,
          photos: [], purchased_date: new Date().toISOString().split("T")[0],
          created_at: new Date().toISOString(),
          ...data,
        }
        setPhones(prev => [newPhone, ...prev])
        // Persist to Supabase
        await createUsedPhone({
          brand: newPhone.brand,
          model: newPhone.model,
          imei: newPhone.imei_number,
          color: newPhone.color,
          storage: newPhone.storage,
          ram: newPhone.ram,
          condition: newPhone.condition_grade,
          grade: newPhone.condition_grade as 'A' | 'B' | 'C' | 'D',
          purchasePrice: newPhone.purchase_price,
          sellingPrice: newPhone.selling_price,
          status: 'In Stock',
          dateAdded: newPhone.purchased_date,
          notes: '',
        }).catch(() => {})
        toast.success("Phone added successfully")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save phone")
    }
    setShowAddDialog(false)
    setEditPhone(null)
  }

  const handleSoldConfirm = async (id: string, customerName: string, price: number) => {
    setPhones(prev => prev.map(p => p.id === id ? {
      ...p,
      status: "sold",
      selling_price: price,
      sold_date: new Date().toISOString().split("T")[0],
      source_customer_name: customerName,
    } : p))
    // Persist to Supabase
    await updateUsedPhone(id, { status: 'Sold', sellingPrice: price } as Record<string, unknown>).catch(() => {})
    setSellPhone(null)
    toast.success("Phone marked as sold!")
  }

  const hasFilters = gradeFilter || brandFilter || statusFilter || ptaFilter || minPrice || maxPrice || minBattery

  const clearFilters = () => {
    setGradeFilter(""); setBrandFilter(""); setStatusFilter(""); setPtaFilter("")
    setMinPrice(""); setMaxPrice(""); setMinBattery(""); setSearch(""); resetPage()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Loading used phones...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Used / Refurbished Phones</h1>
          <p className="text-slate-500 text-sm mt-0.5">{phones.length} phones · {phones.filter(p => p.status === "in_stock").length} available</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowCalculator(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Calculator className="w-3.5 h-3.5" /> Trade-In Calc
          </button>
          <button
            onClick={() => { setEditPhone(null); setShowAddDialog(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Phone
          </button>
        </div>
      </div>

      {/* Stats — Row 1: Inventory summary + 6 grades */}
      <div className="space-y-2">
        <div className="grid grid-cols-8 gap-2">
          {/* Inventory Summary */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Inventory</p>
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <p className="text-xl font-bold text-slate-900 leading-none">{stats.total}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Total devices</p>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-0.5 text-[10px]">
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium text-center">
                  {phones.filter(p=>p.status==="in_stock").length} in stock
                </span>
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium text-center">
                  {phones.filter(p=>p.status==="under_repair").length} repair
                </span>
                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium text-center">
                  {phones.filter(p=>p.status==="sold").length} sold
                </span>
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium text-center">
                  {phones.filter(p=>p.status==="listed_online").length} online
                </span>
              </div>
            </div>
          </div>

          {/* Grade breakdown — 6 cards */}
          {(["A+","A","B+","B","C","D"] as ConditionGrade[]).map(g => {
            const m = GRADE_META[g]
            const count = stats.gradeCount[g]
            return (
              <div
                key={g}
                onClick={() => { setGradeFilter(gradeFilter === g ? "" : g); resetPage() }}
                className={cn(
                  "bg-white rounded-xl border px-2.5 py-2.5 cursor-pointer transition-all hover:shadow-sm",
                  gradeFilter === g ? cn(m.border, "ring-2", m.ring) : "border-slate-200"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <GradeBadge grade={g} />
                  <span className="text-[9px] text-slate-400">Grade</span>
                </div>
                <p className="text-lg font-bold text-slate-900 leading-none">{count}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {phones.filter(p => p.condition_grade === g && p.status === "in_stock").length} avail.
                </p>
              </div>
            )
          })}
        </div>

        {/* Row 2: Financial summary — 3 cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Invested</p>
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-900 leading-none">{formatCurrency(stats.totalInvested)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Purchase + refurb</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Revenue</p>
              <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-900 leading-none">{formatCurrency(stats.revenueSold)}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{phones.filter(p=>p.status==="sold").length} sold</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Profit</p>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <p className={cn("text-base font-bold leading-none", stats.profitSold >= 0 ? "text-emerald-700" : "text-red-700")}>
              {stats.profitSold >= 0 ? "+" : ""}{formatCurrency(stats.profitSold)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Completed sales</p>
          </div>
        </div>
      </div>

      {/* Search + controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage() }}
              placeholder="Search by brand, model, color, IMEI..."
              className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium transition-colors",
              showFilters || hasFilters
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {hasFilters && (
              <span className="bg-blue-600 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                !
              </span>
            )}
          </button>
          {/* View toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-50")}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Grade</label>
              <select
                value={gradeFilter}
                onChange={e => { setGradeFilter(e.target.value as ConditionGrade | ""); resetPage() }}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Grades</option>
                {(["A+","A","B+","B","C","D"] as ConditionGrade[]).map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Brand</label>
              <select
                value={brandFilter}
                onChange={e => { setBrandFilter(e.target.value); resetPage() }}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Brands</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as PhoneStatus | ""); resetPage() }}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                {(Object.entries(STATUS_META) as [PhoneStatus, typeof STATUS_META[PhoneStatus]][]).map(([k,v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">PTA Status</label>
              <select
                value={ptaFilter}
                onChange={e => { setPtaFilter(e.target.value as UsedPTAStatus | ""); resetPage() }}
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All PTA</option>
                <option value="approved">PTA Approved</option>
                <option value="pending">PTA Pending</option>
                <option value="blocked">PTA Blocked</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Min Price (₨)</label>
              <input type="number" value={minPrice} onChange={e => { setMinPrice(e.target.value); resetPage() }} placeholder="0" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Max Price (₨)</label>
              <input type="number" value={maxPrice} onChange={e => { setMaxPrice(e.target.value); resetPage() }} placeholder="Any" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Min Battery %</label>
              <input type="number" value={minBattery} onChange={e => { setMinBattery(e.target.value); resetPage() }} placeholder="0" min={0} max={100} className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {hasFilters && (
              <div className="flex items-end">
                <button onClick={clearFilters} className="w-full py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results info */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>
            {filtered.length === phones.length
              ? `Showing all ${phones.length} phones`
              : `Showing ${filtered.length} of ${phones.length} phones`}
          </span>
          {hasFilters && (
            <button onClick={clearFilters} className="text-blue-600 hover:underline font-medium">Clear filters</button>
          )}
        </div>
      </div>

      {/* Grid / List view */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No phones found</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or add a new phone.</p>
          <button onClick={clearFilters} className="mt-4 text-blue-600 text-sm hover:underline">Clear filters</button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
          {paginated.map(phone => (
            <PhoneCard key={phone.id} phone={phone} onView={handleView} onEdit={handleEdit} onSell={handleSell} />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Device</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Battery</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">PTA</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Total Cost</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sell / Profit</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {paginated.map(phone => (
                <PhoneRow key={phone.id} phone={phone} onView={handleView} onEdit={handleEdit} onSell={handleSell} />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} · {filtered.length} phones
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pg = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
              if (pg < 1 || pg > totalPages) return null
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                    pg === page ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {pg}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Dialogs & Panels */}
      {showDetails && selectedPhone && (
        <DetailsSlideOver
          phone={selectedPhone}
          onClose={() => setShowDetails(false)}
          onEdit={(p) => { handleEdit(p); setShowDetails(false) }}
          onSell={(p) => { handleSell(p); setShowDetails(false) }}
        />
      )}
      {showAddDialog && (
        <AddEditDialog
          editPhone={editPhone}
          onClose={() => { setShowAddDialog(false); setEditPhone(null) }}
          onSave={handleSave}
          brands={brands}
          colors={colors}
          storageOptions={storageOptions}
          ramOptions={ramOptions}
          onAddBrand={handleAddBrand}
          onAddColor={handleAddColor}
          onAddStorage={handleAddStorage}
          onAddRam={handleAddRam}
        />
      )}
      {showCalculator && <TradeInCalculatorDialog onClose={() => setShowCalculator(false)} brands={brands} />}
      {sellPhone && (
        <MarkAsSoldDialog
          phone={sellPhone}
          onClose={() => setSellPhone(null)}
          onSold={handleSoldConfirm}
        />
      )}
    </div>
  )
}

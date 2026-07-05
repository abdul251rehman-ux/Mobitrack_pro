﻿"use client"
import React, { useState, useMemo, useRef, useEffect } from "react"
import {
  Search, SlidersHorizontal, LayoutGrid, List, Plus, Calculator, Eye, Edit2,
  CheckCircle2, ChevronLeft, ChevronRight, X, BatteryMedium, Smartphone, Tag,
  TrendingUp, Package, Battery, Star, MoreVertical, Camera, Upload,
  ArrowUpRight, ArrowDownRight, Minus, Info, User, Calendar, DollarSign,
  ShoppingBag, Wrench, Shield, ChevronDown, ChevronUp, Lock, Unlock, Trash2, Copy,
  Pencil, Check, Banknote, Landmark, Wallet,
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
import { MASTER_BRANDS, MASTER_BRAND_NAMES, APPLE_MODELS } from "@/data/brands"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { getSuppliers } from "@/lib/api/suppliers"
import { getCustomers } from "@/lib/api/customers"
import { getFinanceAccounts, createWithdrawal } from "@/lib/api/finance"
import type { Supplier, Customer } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, formatDate, cn, todayPKT } from "@/lib/utils"
import { toast } from "sonner"

// --Ã¢"â‚¬ Grade / Status Meta ------------------------------------------------------

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
  customer_trade_in:    "Existing Customer",
  walk_in:              "Walk-in Seller",
  purchased:            "Supplier",
  refurbished_in_house: "Refurbished In-House",
  auction:              "Auction",
}

const PAGE_SIZE = 12

// --Ã¢"â‚¬ Badge Components --------------------------------------------------------Ã¢"â‚¬

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

// --Ã¢"â‚¬ Phone Card (Grid View) --------------------------------------------------Ã¢"â‚¬

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
          <p className="text-xs text-slate-400">{phone.storage} - {phone.color}</p>
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

// --Ã¢"â‚¬ Phone Row (List View) ----------------------------------------------------

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

// --Ã¢"â‚¬ Details Slide-Over ------------------------------------------------------Ã¢"â‚¬

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
                ...(phone.brand.toLowerCase() === "apple" ? [{ label: "Battery Health", value: phone.battery_health ? `${phone.battery_health}%` : "Not checked" }] : []),
                { label: "PTA Status", value: PTA_META[phone.pta_status].label },
                { label: "Warranty",   value: `${phone.warranty_days} days`    },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800">{value}</span>
                </div>
              ))}
              {phone.brand.toLowerCase() === "apple" && phone.battery_health && (
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
                { label: "IMEI",     value: phone.imei_number },
                phone.brand.toLowerCase() !== "apple" && phone.ram && { label: "RAM", value: phone.ram },
                { label: "Source",   value: SOURCE_LABEL[phone.source_type] },
                { label: "Acquired", value: formatDate(phone.purchased_date) },
                phone.sold_date && { label: "Sold On", value: formatDate(phone.sold_date) },
              ].filter(Boolean).map(({ label, value }: any) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-medium text-slate-800 text-right">{value}</span>
                </div>
              ))}

              {/* Source person / supplier details */}
              {(phone.source_type === "walk_in" || phone.source_type === "customer_trade_in") && (phone.source_customer_name || (phone as any).source_phone || (phone as any).source_cnic) && (
                <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 space-y-1">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">
                    {phone.source_type === "walk_in" ? "Seller Details" : "Customer Details"}
                  </p>
                  {phone.source_customer_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Name</span>
                      <span className="font-medium text-slate-800">{phone.source_customer_name}</span>
                    </div>
                  )}
                  {(phone as any).source_phone && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Phone</span>
                      <span className="font-medium text-slate-800">{(phone as any).source_phone}</span>
                    </div>
                  )}
                  {(phone as any).source_cnic && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">CNIC</span>
                      <span className="font-medium text-slate-800">{(phone as any).source_cnic}</span>
                    </div>
                  )}
                  {(phone as any).source_address && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Address</span>
                      <span className="font-medium text-slate-800 text-right max-w-[60%]">{(phone as any).source_address}</span>
                    </div>
                  )}
                </div>
              )}
              {phone.source_type === "purchased" && ((phone as any).supplier_name) && (
                <div className="mt-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wide mb-1">Supplier</p>
                  <span className="text-sm font-medium text-slate-800">{(phone as any).supplier_name}</span>
                </div>
              )}
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

// --Ã¢"â‚¬ Mark as Sold Dialog ------------------------------------------------------

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
            <p className="text-sm text-slate-500 mt-0.5">{phone.brand} {phone.model}  ·  Grade {phone.condition_grade}</p>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Final Sale Price (Rs)</label>
              <input
                type="number" onWheel={e => e.currentTarget.blur()}
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

// --Ã¢"â‚¬ Trade-In Calculator ------------------------------------------------------

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
                  {Array.from(new Set([...MASTER_BRAND_NAMES, ...brands])).sort().map(b => <option key={b} value={b}>{b}</option>)}
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
                  type="number" onWheel={e => e.currentTarget.blur()}
                  value={battery}
                  onChange={e => setBattery(e.target.value)}
                  min={0} max={100}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Market Price (New / Avg Used) — Rs</label>
              <input
                type="number" onWheel={e => e.currentTarget.blur()}
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
                  Formula: Market × {GRADE_MULTIPLIER[grade]} (grade) × battery factor. Prices rounded to nearest Rs500.
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

// --Ã¢"â‚¬ Bulk Add Dialog ----------------------------------------------------------

type BulkRow = {
  id: string
  brand: string; model: string; color: string; storage: string; ram: string
  pta_status: UsedPTAStatus; condition_grade: ConditionGrade
  screen_condition: ScreenCondition; body_condition: BodyCondition
  imei_number: string; purchase_price: string; selling_price: string
  warranty_days: string; battery_health: string; condition_notes: string
  expanded: boolean
  rowError?: string
}

type LockState = {
  brand: boolean; model: boolean; color: boolean; storage: boolean; ram: boolean
  pta_status: boolean; condition_grade: boolean; screen_condition: boolean
  body_condition: boolean; purchase_price: boolean; selling_price: boolean; warranty_days: boolean
}

const BULK_EMPTY_ROW: Omit<BulkRow, "id"> = {
  brand: "", model: "", color: "", storage: "128GB", ram: "4GB",
  pta_status: "approved", condition_grade: "B",
  screen_condition: "perfect", body_condition: "minor_wear",
  imei_number: "", purchase_price: "", selling_price: "",
  warranty_days: "7", battery_health: "", condition_notes: "",
  expanded: false,
}

function makeBulkRow(expanded = true): BulkRow {
  return { ...BULK_EMPTY_ROW, id: Math.random().toString(36).slice(2, 9), expanded }
}

// â"€â"€â"€ CatalogCombo: searchable dropdown with always-visible "+ Add New" footer â"€â"€
// Lock icon lives INSIDE the trigger (left side).
// Footer always shows "+ Add New [label]" - clicking opens inline input row.

function CatalogCombo({
  value, onChange, options, onAdd, onEdit, onDelete,
  placeholder, label, error, locked, onToggleLock, disabled,
}: {
  value: string; onChange: (v: string) => void
  options: string[]; onAdd?: (v: string) => Promise<void>
  onEdit?: (old: string, nw: string) => Promise<void>
  onDelete?: (v: string) => Promise<void>
  placeholder?: string; label?: string
  error?: boolean; locked?: boolean
  onToggleLock?: () => void; disabled?: boolean
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [managing, setManaging] = useState(false)
  const [addingNew, setAddingNew] = useState(false)   // "Add New" footer expanded
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingVal, setEditingVal] = useState<string | null>(null)
  const [editInput, setEditInput] = useState("")
  const [deletingVal, setDeletingVal] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  const q = query.trim().toLowerCase()
  const unique = Array.from(new Set(options.map(o => o.trim()).filter(Boolean)))
  const filtered = q ? unique.filter(o => o.toLowerCase().includes(q)) : unique

  function close() {
    setOpen(false); setManaging(false); setAddingNew(false)
    setQuery(""); setNewName(""); setEditingVal(null); setDeletingVal(null)
  }

  async function handleSaveNew() {
    if (!onAdd || !newName.trim() || saving) return
    setSaving(true)
    try { await onAdd(newName.trim()); onChange(newName.trim()); close() }
    catch { toast.error("Failed to add") }
    finally { setSaving(false) }
  }
  async function handleEdit(oldVal: string) {
    if (!onEdit || !editInput.trim() || saving) return
    setSaving(true)
    try { await onEdit(oldVal, editInput.trim()); setEditingVal(null); setEditInput("") } catch { }
    finally { setSaving(false) }
  }
  async function handleDelete(val: string) {
    if (!onDelete || saving) return
    setSaving(true)
    try { await onDelete(val); setDeletingVal(null) } catch { }
    finally { setSaving(false) }
  }

  return (
    <div className="relative">
      {/* Trigger */}
      <div className={cn(
        "flex items-center h-9 rounded-lg border bg-white transition-colors",
        "focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500",
        disabled ? "opacity-50 pointer-events-none bg-slate-50"
        : error ? "border-red-400 bg-red-50"
        : locked ? "border-blue-400 bg-blue-50"
        : "border-slate-300 hover:border-slate-400"
      )}>
        {/* Lock icon - left side, only when lockable */}
        {onToggleLock !== undefined && (
          <button type="button" onClick={e => { e.stopPropagation(); onToggleLock() }}
            title={locked ? "Locked - next card inherits this value" : "Click to lock for next card"}
            className={cn(
              "flex items-center justify-center w-7 h-full rounded-l-lg border-r shrink-0 transition-colors",
              locked ? "border-blue-300 bg-blue-100 text-blue-600 hover:bg-blue-200"
                     : "border-slate-200 text-slate-300 hover:text-blue-500 hover:bg-blue-50 hover:border-blue-200"
            )}>
            {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
        )}
        <div className="flex-1 flex items-center px-2.5 gap-1 min-w-0">
          {value && !open ? (
            <>
              <span className="text-sm text-slate-800 flex-1 truncate font-medium">{value}</span>
              <button type="button" onClick={() => { onChange(""); setQuery("") }}
                className="text-slate-300 hover:text-red-400 shrink-0 p-0.5"><X className="w-3 h-3" /></button>
            </>
          ) : (
            <input ref={inputRef} value={open ? query : ""}
              onChange={e => { setQuery(e.target.value); setOpen(true); setManaging(false); setAddingNew(false) }}
              onFocus={() => setOpen(true)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (filtered[0] && !managing && !addingNew) { onChange(filtered[0]); close() }
                }
                if (e.key === "Escape") close()
              }}
              placeholder={value || placeholder || "Type to search..."}
              className="flex-1 text-sm bg-transparent outline-none min-w-0 placeholder:text-slate-400" />
          )}
          <button type="button" onClick={() => { setOpen(v => !v); if (!open) setTimeout(() => inputRef.current?.focus(), 40) }}
            className="shrink-0 p-0.5">
            <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Dropdown panel */}
      {open && (
        <>
          <div className="absolute mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden" style={{ minWidth: 260, width: "max-content", maxWidth: 360, left: 0, zIndex: 9999 }}>
            {!managing ? (
              <>
                {/* Option list - onWheel stops propagation so page doesn't scroll while hovering list */}
                <div className="max-h-44 overflow-y-auto" onWheel={e => e.stopPropagation()}>
                  {filtered.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-slate-400 text-center">
                      {q ? `No results for "${query}"` : "No options yet"}
                    </div>
                  ) : filtered.map((opt, i) => (
                    <button key={`${opt}-${i}`} type="button"
                      onClick={() => { onChange(opt); close() }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors hover:bg-slate-50",
                        opt === value && "bg-blue-50 text-blue-700 font-semibold"
                      )}>
                      {opt === value
                        ? <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        : <span className="w-3.5 shrink-0" />}
                      <span className="truncate">{opt}</span>
                    </button>
                  ))}
                </div>

                {/* â"€â"€ Always-visible "Add New" footer â"€â"€ */}
                {onAdd && (
                  <div className="border-t border-slate-100">
                    {!addingNew ? (
                      <button type="button"
                        onClick={() => { setAddingNew(true); setTimeout(() => newInputRef.current?.focus(), 40) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <Plus className="w-3 h-3 text-blue-600" />
                        </div>
                        Add New {label ?? ""}
                      </button>
                    ) : (
                      <div className="p-2.5 space-y-2 bg-blue-50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-700">New {label ?? "item"}</span>
                          <button type="button" onClick={() => { setAddingNew(false); setNewName("") }}
                            className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                        </div>
                        <input
                          ref={newInputRef}
                          value={newName}
                          onChange={e => setNewName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") { e.preventDefault(); handleSaveNew() }
                            if (e.key === "Escape") { setAddingNew(false); setNewName("") }
                          }}
                          placeholder={`e.g. ${label === "Brand" ? "OnePlus" : label === "Color" ? "Midnight Blue" : label === "Storage" ? "256GB" : label === "RAM" ? "6GB" : "Name..."}`}
                          className="w-full h-8 text-sm border border-blue-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <button type="button" onClick={handleSaveNew} disabled={!newName.trim() || saving}
                          className="w-full h-8 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
                          {saving ? "Adding..." : `Add ${newName.trim() ? `"${newName.trim()}"` : label ?? "item"}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* Manage panel */
              <>
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                  <button type="button" onClick={() => setManaging(false)} className="text-slate-400 hover:text-slate-700">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-semibold text-slate-600 flex-1">Manage list</span>
                  <button type="button" onClick={close} className="text-slate-300 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-50" onWheel={e => e.stopPropagation()}>
                  {unique.length === 0 && <div className="px-3 py-3 text-xs text-slate-400 text-center">No items yet</div>}
                  {unique.map(item => (
                    <div key={item} className="flex items-center gap-1.5 px-3 py-1.5 group hover:bg-slate-50">
                      {editingVal === item ? (
                        <>
                          <input autoFocus value={editInput} onChange={e => setEditInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleEdit(item); if (e.key === "Escape") { setEditingVal(null); setEditInput("") } }}
                            className="flex-1 h-6 text-xs rounded-md border border-blue-300 px-2 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          <button type="button" onClick={() => handleEdit(item)} disabled={saving}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 px-1 shrink-0">Save</button>
                          <button type="button" onClick={() => { setEditingVal(null); setEditInput("") }}
                            className="text-[10px] text-slate-400 hover:text-slate-600 px-0.5 shrink-0">x</button>
                        </>
                      ) : deletingVal === item ? (
                        <>
                          <span className="flex-1 text-xs text-red-600 truncate">{item}</span>
                          <button type="button" onClick={() => handleDelete(item)} disabled={saving}
                            className="text-[10px] font-bold text-red-600 hover:text-red-700 px-1 shrink-0">Delete?</button>
                          <button type="button" onClick={() => setDeletingVal(null)}
                            className="text-[10px] text-slate-400 hover:text-slate-600 px-0.5 shrink-0">No</button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-xs text-slate-700 truncate">{item}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onEdit && <button type="button" onClick={() => { setEditingVal(item); setEditInput(item) }}
                              className="p-1 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-500 transition-colors">
                              <Pencil className="w-3 h-3" /></button>}
                            {onDelete && <button type="button" onClick={() => setDeletingVal(item)}
                              className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3 h-3" /></button>}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="fixed inset-0 z-40" onClick={close} />
        </>
      )}
    </div>
  )
}


function BulkAddDialog({ onClose, onSaved, brands, models, colors, storageOptions, ramOptions, suppliers, accounts,
  onAddBrand, onEditBrand, onDeleteBrand,
  onAddModel, onEditModel, onDeleteModel,
  onAddColor, onEditColor, onDeleteColor,
  onAddStorage, onEditStorage, onDeleteStorage,
  onAddRam, onEditRam, onDeleteRam,
}: {
  onClose: () => void
  onSaved: (phones: UsedPhone[]) => void
  brands: string[]
  models: { name: string; brandName: string; deviceType: "iphone" | "android" }[]
  colors: string[]
  storageOptions: string[]
  ramOptions: string[]
  suppliers: Supplier[]
  accounts: FinanceAccount[]
  onAddBrand: (v: string) => Promise<void>
  onEditBrand: (old: string, nw: string) => Promise<void>
  onDeleteBrand: (v: string) => Promise<void>
  onAddModel: (brand: string, v: string) => Promise<void>
  onEditModel: (old: string, nw: string) => Promise<void>
  onDeleteModel: (v: string) => Promise<void>
  onAddColor: (v: string) => Promise<void>
  onEditColor: (old: string, nw: string) => Promise<void>
  onDeleteColor: (v: string) => Promise<void>
  onAddStorage: (v: string) => Promise<void>
  onEditStorage: (old: string, nw: string) => Promise<void>
  onDeleteStorage: (v: string) => Promise<void>
  onAddRam: (v: string) => Promise<void>
  onEditRam: (old: string, nw: string) => Promise<void>
  onDeleteRam: (v: string) => Promise<void>
}) {
  const [supplierId, setSupplierId] = useState("")
  const [supplierErr, setSupplierErr] = useState(false)
  const [amountPaid, setAmountPaid] = useState("")
  const [accountId, setAccountId] = useState("")
  const [purchaseDate, setPurchaseDate] = useState(todayPKT())
  const [rows, setRows] = useState<BulkRow[]>([makeBulkRow()])
  const [locks, setLocks] = useState<LockState>({
    brand: false, model: false, color: false, storage: false, ram: false,
    pta_status: false, condition_grade: false, screen_condition: false,
    body_condition: false, purchase_price: false, selling_price: false, warranty_days: false,
  })
  const [saving, setSaving] = useState(false)
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null)
  const [dirty, setDirty] = useState(false)

  // Re-fetch suppliers directly inside the dialog — parent prop may arrive empty
  // if the page-level fetch hadn't finished when the user clicked Bulk Add
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers)
  const [suppliersLoading, setSuppliersLoading] = useState(suppliers.length === 0)
  useEffect(() => {
    if (suppliers.length > 0) { setSuppliersLoading(false); return }
    async function loadSuppliers() {
      try {
        // getTenantId() also calls set_tenant_context RPC which is required for RLS
        const tenantId = await getTenantId()
        const { data, error } = await supabase
          .from("suppliers")
          .select("id, company_name, contact_person, phone, email, address, city, outstanding_balance")
          .eq("tenant_id", tenantId)
          .order("company_name")
        if (!error && data) {
          setLocalSuppliers(data.map((r: any) => ({
            id: r.id,
            companyName: r.company_name ?? "",
            contactPerson: r.contact_person ?? "",
            phone: r.phone ?? "",
            email: r.email ?? "",
            address: r.address ?? "",
            city: r.city ?? "",
            totalPurchases: 0,
            outstandingBalance: r.outstanding_balance ?? 0,
            rating: 0,
            status: "Active",
            createdAt: "",
          })))
        }
      } catch (err) {
        console.error("BulkAddDialog: failed to load suppliers", err)
      } finally {
        setSuppliersLoading(false)
      }
    }
    loadSuppliers()
  }, [])

  // Source type state
  const [sourceType, setSourceType] = useState<SourceType>("purchased")
  const [walkinName, setWalkinName] = useState("")
  const [walkinPhone, setWalkinPhone] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [selectedCustomerName, setSelectedCustomerName] = useState("")
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([])
  useEffect(() => {
    if (sourceType !== "customer_trade_in") return
    if (localCustomers.length > 0) return
    async function loadCustomers() {
      try {
        const tenantId = await getTenantId()
        const { data } = await supabase
          .from("customers")
          .select("id, name, phone")
          .eq("tenant_id", tenantId)
          .order("name")
        if (data) setLocalCustomers(data.map((r: any) => ({ id: r.id, name: r.name, phone: r.phone ?? "" } as any)))
      } catch { /* non-fatal */ }
    }
    loadCustomers()
  }, [sourceType])

  const toggleLock = (key: keyof LockState) =>
    setLocks(prev => ({ ...prev, [key]: !prev[key] }))

  const updateRow = (id: string, key: keyof BulkRow, val: string) => {
    setDirty(true)
    setRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val, rowError: undefined } : r))
  }

  const addRow = () => {
    setDirty(true)
    const last = rows[rows.length - 1]
    const next = makeBulkRow()
    const lockKeys = Object.keys(locks) as (keyof LockState)[]
    lockKeys.forEach(k => { if (locks[k]) (next as any)[k] = (last as any)[k] })
    setRows(prev => [...prev, next])
  }

  const duplicateRow = (id: string) => {
    setDirty(true)
    const src = rows.find(r => r.id === id)
    if (!src) return
    const next: BulkRow = { ...src, id: Math.random().toString(36).slice(2, 9), imei_number: "", rowError: undefined, expanded: true }
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === id)
      const copy = [...prev]
      copy.splice(idx + 1, 0, next)
      return copy
    })
  }

  const removeRow = (id: string) => {
    if (rows.length === 1) return
    setRows(prev => prev.filter(r => r.id !== id))
  }

  const handleClose = () => {
    if (dirty && rows.some(r => r.brand || r.model || r.imei_number || r.purchase_price)) {
      if (!window.confirm("Discard all unsaved phones?")) return
    }
    onClose()
  }

  const validate = (): boolean => {
    let ok = true
    if (sourceType === "purchased" && !supplierId) { setSupplierErr(true); ok = false }
    if (sourceType === "walk_in" && !walkinName.trim()) { toast.error("Enter walk-in seller name"); ok = false }
    if (sourceType === "customer_trade_in" && !selectedCustomerId) { toast.error("Select a customer"); ok = false }
    if (!purchaseDate) { toast.error("Select a purchase date"); ok = false }

    const imeisSeen = new Set<string>()
    const updatedRows = rows.map((r, i) => {
      const n = i + 1
      if (!r.brand) return { ...r, rowError: `Row ${n}: brand required` }
      if (!r.model.trim()) return { ...r, rowError: `Row ${n}: model required` }
      if (!r.imei_number) return { ...r, rowError: `Row ${n}: IMEI required` }
      if (!/^\d{15}$/.test(r.imei_number)) return { ...r, rowError: `Row ${n}: IMEI must be 15 digits` }
      if (imeisSeen.has(r.imei_number)) return { ...r, rowError: `Row ${n}: duplicate IMEI in this batch` }
      imeisSeen.add(r.imei_number)
      if (!r.purchase_price || isNaN(Number(r.purchase_price)) || Number(r.purchase_price) <= 0)
        return { ...r, rowError: `Row ${n}: enter a valid buy price` }
      if (!r.selling_price || isNaN(Number(r.selling_price)) || Number(r.selling_price) <= 0)
        return { ...r, rowError: `Row ${n}: enter a valid sell price` }
      return { ...r, rowError: undefined }
    })

    const firstErr = updatedRows.find(r => r.rowError)
    if (firstErr) { ok = false; setRows(updatedRows) }
    return ok
  }

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Fix the highlighted errors before saving")
      return
    }
    setSaving(true)
    setSaveProgress({ done: 0, total: rows.length })
    const tenantId = await getTenantId()
    const selectedSupplier = localSuppliers.find(s => s.id === supplierId)
    const supplierName = selectedSupplier?.companyName ?? ""
    const resolvedSourceName =
      sourceType === "purchased" ? supplierName :
      sourceType === "walk_in" ? walkinName.trim() :
      sourceType === "customer_trade_in" ? selectedCustomerName : ""
    const resolvedSupplierId = sourceType === "purchased" ? supplierId : undefined
    const resolvedCustomerId = sourceType === "customer_trade_in" ? selectedCustomerId : undefined

    // Pre-flight: check for IMEI duplicates already in DB
    const imeiList = rows.map(r => r.imei_number)
    const { data: existing } = await supabase
      .from("used_phones")
      .select("id, imei_number, status, brand, model, sold_date, source_customer_name")
      .eq("tenant_id", tenantId)
      .in("imei_number", imeiList)
    if (existing && existing.length > 0) {
      const soldPhones = existing.filter((e: any) => e.status === "sold")
      const activePhones = existing.filter((e: any) => e.status !== "sold")
      if (activePhones.length > 0) {
        const dupes = activePhones.map((e: any) => e.imei_number).join(", ")
        toast.error(`Already in stock: IMEI ${dupes}`)
        setSaving(false)
        setSaveProgress(null)
        return
      }
      if (soldPhones.length > 0) {
        const msg = soldPhones.map((e: any) => `${e.imei_number} (${e.brand} ${e.model}, sold ${e.sold_date ?? "previously"})`).join("\n")
        const ok = window.confirm(
          `${soldPhones.length} phone(s) were previously in your system as sold:\n\n${msg}\n\nReactivate and update with new purchase details?`
        )
        if (!ok) { setSaving(false); setSaveProgress(null); return }
        for (const sold of soldPhones) {
          const row = rows.find(r => r.imei_number === (sold as any).imei_number)
          if (!row) continue
          await supabase.from("used_phones").update({
            status: "in_stock",
            purchase_price: Number(row.purchase_price),
            selling_price: Number(row.selling_price),
            condition_grade: row.condition_grade,
            screen_condition: row.screen_condition,
            body_condition: row.body_condition,
            battery_health: row.battery_health ? Number(row.battery_health) : null,
            condition_notes: row.condition_notes.trim() || null,
            pta_status: row.pta_status,
            purchased_date: purchaseDate,
            source_type: "purchased",
            source_customer_name: supplierName,
            sold_date: null,
            warranty_days: Number(row.warranty_days) || 7,
          }).eq("id", (sold as any).id).eq("tenant_id", tenantId)
        }
        const soldImeis = new Set(soldPhones.map((e: any) => e.imei_number))
        rows.splice(0, rows.length, ...rows.filter(r => !soldImeis.has(r.imei_number)))
        if (rows.length === 0) {
          toast.success(`${soldPhones.length} phone(s) reactivated successfully`)
          setSaving(false)
          setSaveProgress(null)
          const { data: refreshed } = await supabase.from("used_phones").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(soldPhones.length)
          if (refreshed) onSaved(refreshed as UsedPhone[])
          return
        }
      }
    }

    const insertPayload = rows.map(r => ({
      tenant_id: tenantId,
      brand: r.brand, model: r.model.trim(), color: r.color,
      storage: r.storage, ram: r.ram,
      imei_number: r.imei_number,
      source_type: sourceType,
      source_customer_name: resolvedSourceName,
      source_customer_id: resolvedCustomerId ?? null,
      source_phone: sourceType === "walk_in" ? walkinPhone.trim() || null : null,
      supplier_id: resolvedSupplierId ?? null,
      supplier_name: sourceType === "purchased" ? supplierName : null,
      purchased_date: purchaseDate,
      purchase_price: Number(r.purchase_price),
      selling_price: Number(r.selling_price),
      refurbishment_cost: 0,
      condition_grade: r.condition_grade,
      screen_condition: r.screen_condition,
      body_condition: r.body_condition,
      battery_health: r.battery_health ? Number(r.battery_health) : null,
      functional_issues: [] as string[],
      accessories_included: [] as string[],
      condition_notes: r.condition_notes.trim() || null,
      pta_status: r.pta_status,
      status: "in_stock" as const,
      warranty_days: Number(r.warranty_days) || 7,
      photos: [] as string[],
    }))

    try {
      const { data: inserted, error } = await supabase
        .from("used_phones")
        .insert(insertPayload)
        .select()
      if (error) throw new Error(error.message)

      // Record purchase in purchases table + finance
      const grandTotal = rows.reduce((s, r) => s + Number(r.purchase_price), 0)
      const paid = parseFloat(amountPaid) || 0
      const balanceDue = Math.max(0, grandTotal - paid)
      const payStatus = paid <= 0 ? "Unpaid" : paid >= grandTotal ? "Paid" : "Partial"
      const dateTag = purchaseDate.replace(/-/g, "")
      const { data: poRows } = await supabase.from("purchases").select("po_number")
        .eq("tenant_id", tenantId).eq("date", purchaseDate).like("po_number", `PO-${dateTag}-%`)
      let maxSeq = 0
      for (const row of (poRows ?? [])) {
        const parts = (row.po_number as string).split("-")
        const n = parseInt(parts[parts.length - 1], 10)
        if (!isNaN(n) && n > maxSeq) maxSeq = n
      }
      const poNumber = `PO-${dateTag}-${String(maxSeq + 1).padStart(3, "0")}`
      const purchaseItems = rows.map(r => ({
        productId: r.imei_number,
        productName: `${r.brand} ${r.model.trim()}`,
        productType: "UsedPhone",
        quantity: 1,
        unitCost: Number(r.purchase_price),
        total: Number(r.purchase_price),
        imeis: [r.imei_number],
      }))
      const { data: purchaseRecord } = await supabase.from("purchases").insert({
        tenant_id: tenantId,
        po_number: poNumber,
        date: purchaseDate,
        supplier_id: supplierId,
        supplier_name: supplierName,
        subtotal: grandTotal,
        shipping_cost: 0,
        tax_amount: 0,
        grand_total: grandTotal,
        amount_paid: paid,
        balance_due: balanceDue,
        payment_status: payStatus,
        payment_method: accountId ? (accounts.find(a => a.id === accountId)?.type === "cash" ? "Cash" : "Bank Transfer") : "Cash",
        items: purchaseItems,
        notes: null,
      }).select("id").single()

      // Finance: debit account if payment made
      if (paid > 0 && accountId && purchaseRecord) {
        await supabase.from("finance_transactions").insert({
          tenant_id: tenantId, date: purchaseDate, type: "purchase_payment",
          account_id: accountId, amount: paid,
          reference_type: "Purchase", reference_number: poNumber,
          description: `Used phones purchase ${poNumber} - ${supplierName}`,
        })
        const { data: accRow } = await supabase.from("finance_accounts").select("current_balance").eq("id", accountId).single()
        if (accRow) {
          await supabase.from("finance_accounts").update({
            current_balance: (accRow as any).current_balance - paid,
          }).eq("id", accountId)
        }
      }
      // Update supplier outstanding balance if partial/unpaid
      if (balanceDue > 0) {
        const { data: supRow } = await supabase.from("suppliers").select("outstanding_balance").eq("id", supplierId).single()
        if (supRow) {
          await supabase.from("suppliers").update({
            outstanding_balance: ((supRow as any).outstanding_balance ?? 0) + balanceDue,
          }).eq("id", supplierId)
        }
      }

      const saved = (inserted as any[]).map(row => ({
        ...BULK_EMPTY_ROW,
        id: row.id,
        imei_number: row.imei_number ?? "",
        brand: row.brand ?? "",
        model: row.model ?? "",
        color: row.color ?? "",
        storage: row.storage ?? "",
        ram: row.ram ?? "",
        condition_grade: (row.condition_grade ?? "B") as ConditionGrade,
        screen_condition: (row.screen_condition ?? "perfect") as ScreenCondition,
        body_condition: (row.body_condition ?? "minor_wear") as BodyCondition,
        battery_health: row.battery_health ?? undefined,
        functional_issues: row.functional_issues ?? [],
        accessories_included: row.accessories_included ?? [],
        source_type: (row.source_type ?? "purchased") as SourceType,
        source_customer_name: row.source_customer_name ?? undefined,
        purchase_price: row.purchase_price ?? 0,
        refurbishment_cost: row.refurbishment_cost ?? 0,
        selling_price: row.selling_price ?? 0,
        pta_status: (row.pta_status ?? "pending") as UsedPTAStatus,
        status: "in_stock" as PhoneStatus,
        warranty_days: row.warranty_days ?? 7,
        condition_notes: row.condition_notes ?? undefined,
        photos: row.photos ?? [],
        purchased_date: row.purchased_date ?? purchaseDate,
        sold_date: undefined,
        created_at: row.created_at ?? new Date().toISOString(),
      } as UsedPhone))

      toast.success(`${saved.length} phone${saved.length !== 1 ? "s" : ""} added - ${poNumber}`)
      onSaved(saved)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save - no phones were added")
    } finally {
      setSaving(false)
      setSaveProgress(null)
    }
  }

  const grandTotal  = rows.reduce((s, r) => s + (Number(r.purchase_price) || 0), 0)
  const totalProfit = rows.reduce((s, r) => s + ((Number(r.selling_price) || 0) - (Number(r.purchase_price) || 0)), 0)
  const allExpanded = rows.every(r => r.expanded)
  const completedCount = rows.filter(r => r.brand && r.model && r.imei_number.length === 15 && Number(r.purchase_price) > 0 && Number(r.selling_price) > 0).length

  const toggleExpandAll = () =>
    setRows(prev => prev.map(r => ({ ...r, expanded: !allExpanded })))

  return (
    <div className="-m-3 sm:-m-4 md:-m-6 bg-slate-100 flex flex-col" style={{ minHeight: "calc(100vh - 64px)" }}>

      {/* â"€â"€ Fixed top bar â"€â"€ */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-shrink-0 sticky top-0 z-30">
        <button onClick={handleClose}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium shrink-0">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="w-px h-4 bg-slate-200" />
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-slate-900">Bulk Add Used Phones</h1>
          <p className="text-xs text-slate-400">
            {rows.length} phone{rows.length !== 1 ? "s" : ""}
            {completedCount > 0 && <span className="text-emerald-600"> - {completedCount} ready</span>}
            {saveProgress && <span className="text-blue-600 font-medium"> - Saving {saveProgress.done}/{saveProgress.total}...</span>}
          </p>
        </div>
        <button onClick={toggleExpandAll}
          className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0">
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-2 shrink-0">
          {saving
            ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <CheckCircle2 className="w-4 h-4" />}
          Save {rows.length} Phone{rows.length !== 1 ? "s" : ""}
        </button>
      </div>

      {/* â"€â"€ Scrollable page body â"€â"€ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">

          {/* â"€â"€ Purchase Order Header card â"€â"€ */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Purchase Details</h2>
                <p className="text-xs text-slate-400 mt-0.5">Who did you buy from and when</p>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">Step 1</span>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-end gap-4 flex-wrap">

                {/* Source Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Source <span className="text-red-500">*</span></label>
                  <div className="flex gap-1.5">
                    {([
                      { val: "purchased",         label: "Supplier"   },
                      { val: "customer_trade_in", label: "Customer"   },
                      { val: "walk_in",           label: "Walk-in"    },
                    ] as { val: SourceType; label: string }[]).map(opt => (
                      <button key={opt.val} type="button"
                        onClick={() => { setSourceType(opt.val); setSupplierId(""); setSupplierErr(false); setWalkinName(""); setWalkinPhone(""); setSelectedCustomerId(""); setSelectedCustomerName("") }}
                        className={cn(
                          "px-3 h-9 rounded-lg text-xs font-semibold border transition-colors",
                          sourceType === opt.val
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-600 border-slate-300 hover:border-blue-400"
                        )}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Supplier (when source = purchased) */}
                {sourceType === "purchased" && (
                  <div className="w-64">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Supplier <span className="text-red-500">*</span></label>
                    <CatalogCombo
                      value={localSuppliers.find(s => s.id === supplierId)?.companyName ?? ""}
                      onChange={v => { const s = localSuppliers.find(x => x.companyName === v); setSupplierId(s?.id ?? ""); setSupplierErr(false) }}
                      options={localSuppliers.map(s => s.companyName)}
                      placeholder={suppliersLoading ? "Loading..." : "Select supplier..."}
                      error={supplierErr}
                      disabled={suppliersLoading}
                    />
                    {supplierErr && <p className="text-xs text-red-500 mt-1">Supplier is required</p>}
                  </div>
                )}

                {/* Customer (when source = customer_trade_in) */}
                {sourceType === "customer_trade_in" && (
                  <div className="w-64">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer <span className="text-red-500">*</span></label>
                    <CatalogCombo
                      value={selectedCustomerName}
                      onChange={v => { setSelectedCustomerName(v); const c = localCustomers.find((x: any) => x.name === v); setSelectedCustomerId((c as any)?.id ?? "") }}
                      options={localCustomers.map((c: any) => c.name)}
                      placeholder="Select customer..."
                    />
                  </div>
                )}

                {/* Walk-in fields */}
                {sourceType === "walk_in" && (
                  <div className="flex gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Seller Name <span className="text-red-500">*</span></label>
                      <input value={walkinName} onChange={e => setWalkinName(e.target.value)}
                        placeholder="e.g. Muhammad Ali"
                        className="h-9 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-44" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
                      <input value={walkinPhone} onChange={e => setWalkinPhone(e.target.value)}
                        placeholder="03001234567"
                        className="h-9 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-36" />
                    </div>
                  </div>
                )}

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Purchase Date <span className="text-red-500">*</span></label>
                  <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                    className={cn(
                      "h-9 border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-white",
                      !purchaseDate ? "border-red-400 bg-red-50" : "border-slate-300"
                    )} />
                </div>

                {/* Lock hint */}
                <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pb-1">
                  <Lock className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>Lock <Lock className="w-2.5 h-2.5 inline text-blue-400" /> any field on a phone card to copy it to the next</span>
                </div>
              </div>
            </div>
          </div>

          {/* â"€â"€ Phone cards â"€â"€ */}
          <div className="space-y-3">

          {rows.map((row, idx) => {
            const isApple    = row.brand.toLowerCase() === "apple"
            const hasError   = !!row.rowError
            const isComplete = !!(row.brand && row.model && row.imei_number.length === 15 && Number(row.purchase_price) > 0 && Number(row.selling_price) > 0)
            const rowProfit  = (Number(row.selling_price) || 0) - (Number(row.purchase_price) || 0)
            const gradeMeta  = GRADE_META[row.condition_grade]
            return (
              <div key={row.id} className={cn(
                "rounded-xl border bg-white shadow-sm transition-all",
                hasError ? "border-red-400 ring-1 ring-red-200" : isComplete ? "border-emerald-400" : "border-slate-200"
              )}>
                {/* Card header */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer select-none"
                  onClick={() => setRows(prev => prev.map(r => r.id === row.id ? { ...r, expanded: !r.expanded } : r))}>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                    isComplete ? "bg-emerald-100 text-emerald-700" : hasError ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"
                  )}>
                    {isComplete ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                    {row.brand || row.model ? (
                      <span className="text-sm font-semibold text-slate-800">
                        {[row.brand, row.model].filter(Boolean).join(" ")}
                        {row.color && <span className="text-slate-400 font-normal"> · {row.color}</span>}
                        {row.storage && <span className="text-slate-400 font-normal"> · {row.storage}</span>}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Phone {idx + 1} - click to fill details</span>
                    )}
                    {row.imei_number && (
                      <span className={cn("text-[10px] font-mono", row.imei_number.length === 15 ? "text-emerald-600" : "text-amber-500")}>
                        {row.imei_number.length === 15 ? row.imei_number : `${15 - row.imei_number.length} left`}
                      </span>
                    )}
                    {row.condition_grade && <span className={cn("text-[10px] font-bold px-1 py-0.5 rounded", gradeMeta.bg, gradeMeta.text)}>{row.condition_grade}</span>}
                    {Number(row.purchase_price) > 0 && <span className="text-[10px] text-slate-400">Buy {formatCurrency(Number(row.purchase_price))}</span>}
                    {Number(row.selling_price) > 0 && <span className="text-[10px] text-slate-400">Sell {formatCurrency(Number(row.selling_price))}</span>}
                    {Number(row.purchase_price) > 0 && Number(row.selling_price) > 0 && (
                      <span className={cn("text-[10px] font-semibold", rowProfit >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {rowProfit >= 0 ? "+" : ""}{formatCurrency(rowProfit)}
                      </span>
                    )}
                    {hasError && <span className="text-[10px] text-red-500 font-medium">{row.rowError}</span>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => duplicateRow(row.id)} title="Duplicate"
                      className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeRow(row.id)} disabled={rows.length === 1}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-20">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {row.expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />}
                  </div>
                </div>

                {/* Form body */}
                {row.expanded && (() => {
                  const brandModels = models.filter(m => m.brandName.toLowerCase() === row.brand.toLowerCase()).map(m => m.name)
                  return (
                  <div className="border-t border-slate-100">

                    {/* â"€â"€ Row 1: Brand - Model - Color - Storage / RAM â"€â"€ */}
                    <div className="px-4 pt-4 pb-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Device Info</p>
                      <div className="grid grid-cols-12 gap-3">

                        {/* Brand - col 2 */}
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Brand <span className="text-red-500">*</span>
                          </label>
                          <CatalogCombo
                            label="Brand"
                            value={row.brand}
                            onChange={v => { updateRow(row.id, "brand", v); updateRow(row.id, "model", "") }}
                            options={brands}
                            onAdd={onAddBrand} onEdit={onEditBrand} onDelete={onDeleteBrand}
                            placeholder="e.g. Samsung"
                            error={!row.brand && hasError}
                            locked={locks.brand}
                            onToggleLock={() => toggleLock("brand")}
                          />
                        </div>

                        {/* Model - col 4 */}
                        <div className="col-span-4">
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Model <span className="text-red-500">*</span>
                          </label>
                          <CatalogCombo
                            label="Model"
                            value={row.model}
                            onChange={v => updateRow(row.id, "model", v)}
                            options={brandModels}
                            onAdd={row.brand ? v => onAddModel(row.brand, v) : undefined}
                            onEdit={row.brand ? onEditModel : undefined}
                            onDelete={row.brand ? onDeleteModel : undefined}
                            placeholder={row.brand ? "e.g. Galaxy S24" : "Select brand first"}
                            error={!row.model.trim() && hasError}
                            disabled={!row.brand}
                          />
                        </div>

                        {/* Color - col 2 */}
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Color</label>
                          <CatalogCombo
                            label="Color"
                            value={row.color}
                            onChange={v => updateRow(row.id, "color", v)}
                            options={colors}
                            onAdd={onAddColor} onEdit={onEditColor} onDelete={onDeleteColor}
                            placeholder="e.g. Black"
                            locked={locks.color}
                            onToggleLock={() => toggleLock("color")}
                          />
                        </div>

                        {/* Storage - col 2 */}
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Storage</label>
                          <CatalogCombo
                            label="Storage"
                            value={row.storage}
                            onChange={v => updateRow(row.id, "storage", v)}
                            options={storageOptions}
                            onAdd={onAddStorage} onEdit={onEditStorage} onDelete={onDeleteStorage}
                            placeholder="e.g. 128GB"
                            locked={locks.storage}
                            onToggleLock={() => toggleLock("storage")}
                          />
                        </div>

                        {/* RAM (android) or Battery % (apple) - col 2 */}
                        <div className="col-span-2">
                          {isApple ? (
                            <>
                              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Battery %</label>
                              <div className="relative">
                                <input type="number" onWheel={e => e.currentTarget.blur()} value={row.battery_health}
                                  onChange={e => updateRow(row.id, "battery_health", e.target.value)}
                                  placeholder="91" min="1" max="100"
                                  className="w-full h-9 border border-slate-300 rounded-lg px-2.5 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-slate-400 transition-colors" />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">%</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <label className="block text-xs font-semibold text-slate-600 mb-1.5">RAM</label>
                              <CatalogCombo
                                label="RAM"
                                value={row.ram}
                                onChange={v => updateRow(row.id, "ram", v)}
                                options={ramOptions}
                                onAdd={onAddRam} onEdit={onEditRam} onDelete={onDeleteRam}
                                placeholder="e.g. 8GB"
                                locked={locks.ram}
                                onToggleLock={() => toggleLock("ram")}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* â"€â"€ Divider â"€â"€ */}
                    <div className="border-t border-dashed border-slate-100" />

                    {/* â"€â"€ Row 2: IMEI - Battery% (android only) - Grade - Screen - Body â"€â"€ */}
                    <div className="px-4 pt-3 pb-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Condition</p>
                      <div className="grid grid-cols-12 gap-3 items-start">

                        {/* IMEI - col 3 */}
                        <div className="col-span-3">
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">IMEI <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <input value={row.imei_number}
                              onChange={e => updateRow(row.id, "imei_number", e.target.value.replace(/\D/g, "").slice(0, 15))}
                              placeholder="15-digit IMEI" maxLength={15}
                              className={cn(
                                "w-full h-9 border rounded-lg px-2.5 pr-8 text-sm font-mono focus:outline-none focus:ring-2 transition-colors",
                                row.imei_number.length === 15 ? "border-emerald-400 bg-emerald-50 focus:ring-emerald-400"
                                : row.imei_number.length > 0 ? "border-amber-400 focus:ring-amber-400"
                                : hasError ? "border-red-400 bg-red-50 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
                              )} />
                            {row.imei_number.length > 0 && row.imei_number.length < 15 && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-amber-500 font-bold pointer-events-none">{15 - row.imei_number.length}</span>
                            )}
                            {row.imei_number.length === 15 && <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />}
                          </div>
                        </div>

                        {/* Battery % - col 1 (android only) */}
                        {!isApple && (
                          <div className="col-span-1">
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Bat %</label>
                            <div className="relative">
                              <input type="number" onWheel={e => e.currentTarget.blur()} value={row.battery_health}
                                onChange={e => updateRow(row.id, "battery_health", e.target.value)}
                                placeholder="85" min="1" max="100"
                                className="w-full h-9 border border-slate-300 rounded-lg px-2.5 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-slate-400 transition-colors" />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">%</span>
                            </div>
                          </div>
                        )}

                        {/* Grade pills - col 3 */}
                        <div className={cn(isApple ? "col-span-4" : "col-span-3")}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <button type="button" onClick={() => toggleLock("condition_grade")}
                              title={locks.condition_grade ? "Locked" : "Click to lock grade"}
                              className={cn("flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0",
                                locks.condition_grade ? "bg-blue-100 border-blue-400 text-blue-600" : "border-slate-300 text-slate-300 hover:border-blue-300 hover:text-blue-400")}>
                              {locks.condition_grade ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            </button>
                            <label className="text-xs font-semibold text-slate-600">Grade</label>
                          </div>
                          <div className="flex gap-1">
                            {(["A+","A","B+","B","C","D"] as ConditionGrade[]).map(g => {
                              const m = GRADE_META[g]
                              return (
                                <button key={g} type="button" onClick={() => updateRow(row.id, "condition_grade", g)}
                                  className={cn(
                                    "flex-1 h-9 rounded-lg text-xs font-bold border-2 transition-all",
                                    row.condition_grade === g
                                      ? cn(m.bg, m.text, m.border, "shadow-sm")
                                      : "border-slate-200 text-slate-400 hover:border-slate-300 bg-white"
                                  )}>
                                  {g}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Screen - col 2 */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <button type="button" onClick={() => toggleLock("screen_condition")}
                              title={locks.screen_condition ? "Locked" : "Click to lock"}
                              className={cn("flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0",
                                locks.screen_condition ? "bg-blue-100 border-blue-400 text-blue-600" : "border-slate-300 text-slate-300 hover:border-blue-300 hover:text-blue-400")}>
                              {locks.screen_condition ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            </button>
                            <label className="text-xs font-semibold text-slate-600">Screen</label>
                          </div>
                          <select value={row.screen_condition} onChange={e => updateRow(row.id, "screen_condition", e.target.value as ScreenCondition)}
                            className={cn("w-full h-9 border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-colors",
                              locks.screen_condition ? "border-blue-400 bg-blue-50" : "border-slate-300")}>
                            <option value="perfect">Perfect</option>
                            <option value="minor_scratches">Scratches</option>
                            <option value="cracked">Cracked</option>
                            <option value="replaced">Replaced</option>
                          </select>
                        </div>

                        {/* Body - col 2 */}
                        <div className={cn(isApple ? "col-span-2" : "col-span-2")}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <button type="button" onClick={() => toggleLock("body_condition")}
                              title={locks.body_condition ? "Locked" : "Click to lock"}
                              className={cn("flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0",
                                locks.body_condition ? "bg-blue-100 border-blue-400 text-blue-600" : "border-slate-300 text-slate-300 hover:border-blue-300 hover:text-blue-400")}>
                              {locks.body_condition ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            </button>
                            <label className="text-xs font-semibold text-slate-600">Body</label>
                          </div>
                          <select value={row.body_condition} onChange={e => updateRow(row.id, "body_condition", e.target.value as BodyCondition)}
                            className={cn("w-full h-9 border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-colors",
                              locks.body_condition ? "border-blue-400 bg-blue-50" : "border-slate-300")}>
                            <option value="perfect">Perfect</option>
                            <option value="minor_wear">Minor Wear</option>
                            <option value="dents">Dents</option>
                            <option value="heavy_damage">Heavy</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* â"€â"€ Divider â"€â"€ */}
                    <div className="border-t border-dashed border-slate-100" />

                    {/* â"€â"€ Row 3: Pricing - BUY - SELL - Warranty - PTA - Notes â"€â"€ */}
                    <div className="px-4 pt-3 pb-4">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Pricing</p>
                      <div className="grid grid-cols-12 gap-3 items-start">

                        {/* Buy Price - col 2 */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <button type="button" onClick={() => toggleLock("purchase_price")}
                              title={locks.purchase_price ? "Locked" : "Click to lock buy price"}
                              className={cn("flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0",
                                locks.purchase_price ? "bg-blue-100 border-blue-400 text-blue-600" : "border-slate-300 text-slate-300 hover:border-blue-300 hover:text-blue-400")}>
                              {locks.purchase_price ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            </button>
                            <label className="text-xs font-semibold text-slate-600">Buy Price <span className="text-red-500">*</span></label>
                          </div>
                          <input type="number" onWheel={e => e.currentTarget.blur()} value={row.purchase_price}
                            onChange={e => updateRow(row.id, "purchase_price", e.target.value)}
                            placeholder="0" min="0"
                            className={cn("w-full h-9 border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 bg-white placeholder:text-slate-400 transition-colors",
                              (!row.purchase_price || Number(row.purchase_price) <= 0) && hasError
                                ? "border-red-400 bg-red-50 focus:ring-red-400"
                                : locks.purchase_price ? "border-blue-400 bg-blue-50 focus:ring-blue-500" : "border-slate-300 focus:ring-blue-500")} />
                        </div>

                        {/* Sell Price - col 2 */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <button type="button" onClick={() => toggleLock("selling_price")}
                              title={locks.selling_price ? "Locked" : "Click to lock sell price"}
                              className={cn("flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0",
                                locks.selling_price ? "bg-blue-100 border-blue-400 text-blue-600" : "border-slate-300 text-slate-300 hover:border-blue-300 hover:text-blue-400")}>
                              {locks.selling_price ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            </button>
                            <label className="text-xs font-semibold text-slate-600">Sell Price <span className="text-red-500">*</span></label>
                          </div>
                          <input type="number" onWheel={e => e.currentTarget.blur()} value={row.selling_price}
                            onChange={e => updateRow(row.id, "selling_price", e.target.value)}
                            placeholder="0" min="0"
                            className={cn("w-full h-9 border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 bg-white placeholder:text-slate-400 transition-colors",
                              (!row.selling_price || Number(row.selling_price) <= 0) && hasError
                                ? "border-red-400 bg-red-50 focus:ring-red-400"
                                : locks.selling_price ? "border-blue-400 bg-blue-50 focus:ring-blue-500" : "border-slate-300 focus:ring-blue-500")} />
                        </div>

                        {/* Profit display - col 2 */}
                        {Number(row.purchase_price) > 0 && Number(row.selling_price) > 0 ? (
                          <div className="col-span-2 flex flex-col justify-end">
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Margin</label>
                            <div className={cn("h-9 flex items-center px-3 rounded-lg text-sm font-bold border",
                              rowProfit >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200")}>
                              {rowProfit >= 0 ? "+" : ""}{formatCurrency(rowProfit)}
                              <span className={cn("ml-1.5 text-xs font-medium",
                                rowProfit >= 0 ? "text-emerald-500" : "text-red-400")}>
                                ({Number(row.selling_price) > 0 ? Math.round((rowProfit / Number(row.selling_price)) * 100) : 0}%)
                              </span>
                            </div>
                          </div>
                        ) : <div className="col-span-2" />}

                        {/* Warranty - col 2 */}
                        <div className="col-span-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <button type="button" onClick={() => toggleLock("warranty_days")}
                              title={locks.warranty_days ? "Locked" : "Click to lock warranty"}
                              className={cn("flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0",
                                locks.warranty_days ? "bg-blue-100 border-blue-400 text-blue-600" : "border-slate-300 text-slate-300 hover:border-blue-300 hover:text-blue-400")}>
                              {locks.warranty_days ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            </button>
                            <label className="text-xs font-semibold text-slate-600">Warranty</label>
                          </div>
                          <select value={row.warranty_days} onChange={e => updateRow(row.id, "warranty_days", e.target.value)}
                            className={cn("w-full h-9 border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-colors",
                              locks.warranty_days ? "border-blue-400 bg-blue-50" : "border-slate-300")}>
                            <option value="0">No warranty</option>
                            <option value="3">3 days</option>
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30">1 month</option>
                            <option value="90">3 months</option>
                          </select>
                        </div>

                        {/* PTA - col 1 */}
                        <div className="col-span-1">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <button type="button" onClick={() => toggleLock("pta_status")}
                              title={locks.pta_status ? "Locked" : "Click to lock PTA"}
                              className={cn("flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0",
                                locks.pta_status ? "bg-blue-100 border-blue-400 text-blue-600" : "border-slate-300 text-slate-300 hover:border-blue-300 hover:text-blue-400")}>
                              {locks.pta_status ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            </button>
                            <label className="text-xs font-semibold text-slate-600">PTA</label>
                          </div>
                          <select value={row.pta_status} onChange={e => updateRow(row.id, "pta_status", e.target.value as UsedPTAStatus)}
                            className={cn("w-full h-9 border rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-colors",
                              locks.pta_status ? "border-blue-400 bg-blue-50" : "border-slate-300")}>
                            <option value="approved">PTA Approved</option>
                            <option value="pending">PTA Pending</option>
                            <option value="blocked">PTA Blocked</option>
                          </select>
                        </div>

                        {/* Notes - fills remaining cols */}
                        <div className="col-span-3">
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                          <input value={row.condition_notes} onChange={e => updateRow(row.id, "condition_notes", e.target.value)}
                            placeholder="Accessories, issues, remarks..."
                            className="w-full h-9 border border-slate-300 rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-slate-400 transition-colors" />
                        </div>
                      </div>
                    </div>

                  </div>
                  )
                })()}
              </div>
            )
          })}

          {/* Add phone button */}
          <button onClick={addRow}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 text-sm font-semibold hover:bg-blue-50 hover:border-blue-400 transition-all">
            <Plus className="w-4 h-4" /> Add Another Phone
          </button>
          </div>{/* end phone cards */}

          {/* â"€â"€ Order Summary card - bottom of page â"€â"€ */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Order Summary</h2>
                <p className="text-xs text-slate-400 mt-0.5">Total cost - payment - ledger entry</p>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">Step 3</span>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-3 gap-6">

                {/* Items breakdown */}
                <div className="col-span-2 space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items</p>
                  {rows.filter(r => r.brand || r.model || Number(r.purchase_price) > 0).length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No phones added yet</p>
                  ) : rows.map((r, i) => (
                    <div key={r.id} className="flex items-center gap-2 text-sm py-1 border-b border-slate-50 last:border-0">
                      <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">{i + 1}</span>
                      <span className="flex-1 text-slate-700 truncate">
                        {r.brand || r.model ? `${r.brand} ${r.model}`.trim() : <span className="text-slate-300 italic">Unnamed phone</span>}
                        {r.color && <span className="text-slate-400"> - {r.color}</span>}
                        {r.storage && <span className="text-slate-400"> - {r.storage}</span>}
                      </span>
                      <span className="text-xs text-slate-400 font-mono shrink-0">
                        {r.imei_number.length === 15 ? r.imei_number : '-'}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 shrink-0 w-24 text-right">
                        {Number(r.purchase_price) > 0 ? formatCurrency(Number(r.purchase_price)) : <span className="text-slate-300">-</span>}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Payment + Totals */}
                <div className="space-y-4">

                  {/* Payment inputs */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Payment</p>
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount Paid (Rs)</label>
                        <input type="number" onWheel={e => e.currentTarget.blur()} min={0} placeholder="0" value={amountPaid}
                          onChange={e => setAmountPaid(e.target.value)}
                          className="w-full h-9 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-slate-400 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Payment Account</label>
                        <select value={accountId} onChange={e => setAccountId(e.target.value)}
                          className="w-full h-9 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-colors">
                          <option value="">No account</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="border-t border-slate-100 pt-4 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>{rows.length} phone{rows.length !== 1 ? "s" : ""} subtotal</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(grandTotal)}</span>
                    </div>
                    {parseFloat(amountPaid) > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>Amount paid</span>
                        <span className="text-emerald-600 font-semibold">- {formatCurrency(parseFloat(amountPaid))}</span>
                      </div>
                    )}
                    <div className={cn(
                      "flex justify-between font-bold pt-2 border-t border-slate-200 text-base",
                      Math.max(0, grandTotal - parseFloat(amountPaid || "0")) === 0 && grandTotal > 0
                        ? "text-emerald-600" : "text-slate-800"
                    )}>
                      <span>Balance Due</span>
                      <span>{formatCurrency(Math.max(0, grandTotal - parseFloat(amountPaid || "0")))}</span>
                    </div>
                  </div>

                  {/* Est. profit */}
                  {totalProfit > 0 && (
                    <div className="border-t border-dashed border-slate-200 pt-3 text-xs text-slate-500 space-y-1.5">
                      <div className="flex justify-between">
                        <span>Est. sell revenue</span>
                        <span className="font-medium text-slate-700">{formatCurrency(rows.reduce((s, r) => s + (Number(r.selling_price) || 0), 0))}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Est. profit</span>
                        <span>+{formatCurrency(totalProfit)}</span>
                      </div>
                    </div>
                  )}

                  {parseFloat(amountPaid) >= grandTotal && grandTotal > 0 && (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Fully paid
                    </div>
                  )}

                  <button onClick={handleSave} disabled={saving}
                    className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                    {saving
                      ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <CheckCircle2 className="w-4 h-4" />}
                    Save {rows.length} Phone{rows.length !== 1 ? "s" : ""}
                  </button>
                  <p className="text-center text-[11px] text-slate-400">{completedCount}/{rows.length} ready to save</p>
                </div>
              </div>
            </div>
          </div>

          <div className="h-6" />
        </div>{/* end max-w container */}
      </div>{/* end scrollable body */}
    </div>
  )
}


// --Ã¢"â‚¬ Add / Edit Dialog (5-step) ----------------------------------------------Ã¢"â‚¬

type FormData = {
  brand: string; model: string; color: string; storage: string; ram: string
  imei_number: string; source_type: SourceType
  // Existing customer source
  source_customer_id: string; source_customer_name: string
  // Walk-in seller source
  walkin_name: string; walkin_phone: string; walkin_cnic: string; walkin_address: string
  // Supplier source
  supplier_id: string; supplier_name: string
  purchased_date: string; purchase_price: string
  condition_grade: ConditionGrade; screen_condition: ScreenCondition
  body_condition: BodyCondition; battery_health: string
  functional_issues: string[]; accessories_included: string[]; condition_notes: string
  refurbishment_cost: string; selling_price: string
  warranty_days: string; pta_status: UsedPTAStatus; status: PhoneStatus
  photos: string[]
  // Payment
  payment_amount: string; payment_account_id: string
}

const EMPTY_FORM: FormData = {
  brand: "", model: "", color: "", storage: "128GB", ram: "4GB",
  imei_number: "", source_type: "walk_in",
  source_customer_id: "", source_customer_name: "",
  walkin_name: "", walkin_phone: "", walkin_cnic: "", walkin_address: "",
  supplier_id: "", supplier_name: "",
  purchased_date: todayPKT(), purchase_price: "",
  condition_grade: "B", screen_condition: "perfect", body_condition: "minor_wear",
  battery_health: "", functional_issues: [], accessories_included: [], condition_notes: "",
  refurbishment_cost: "0", selling_price: "",
  warranty_days: "7", pta_status: "approved", status: "in_stock",
  photos: [],
  payment_amount: "", payment_account_id: "",
}

const STEPS = ["Basic Info", "Condition", "Pricing", "Photos", "Review"]

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function AddEditDialog({ editPhone, onClose, onSave, brands, colors, storageOptions, ramOptions, suppliers, customers, accounts, onAddBrand, onAddColor, onAddStorage, onAddRam }: {
  editPhone: UsedPhone | null
  onClose: () => void
  onSave: (data: Partial<UsedPhone> & { _paymentAmount?: number; _paymentAccountId?: string }) => void
  brands: string[]
  colors: string[]
  storageOptions: string[]
  ramOptions: string[]
  suppliers: Supplier[]
  customers: Customer[]
  accounts: FinanceAccount[]
  onAddBrand: (name: string) => Promise<void>
  onAddColor: (name: string) => Promise<void>
  onAddStorage: (name: string) => Promise<void>
  onAddRam: (name: string) => Promise<void>
}) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(() => {
    if (!editPhone) return EMPTY_FORM
    return {
      brand: editPhone.brand, model: editPhone.model, color: editPhone.color,
      storage: editPhone.storage, ram: editPhone.ram,
      imei_number: editPhone.imei_number,
      source_type: editPhone.source_type,
      source_customer_id: editPhone.source_customer_id ?? "",
      source_customer_name: editPhone.source_customer_name ?? "",
      walkin_name: editPhone.source_type === "walk_in" ? (editPhone.source_customer_name ?? "") : "",
      walkin_phone: editPhone.source_phone ?? "",
      walkin_cnic: editPhone.source_cnic ?? "",
      walkin_address: editPhone.source_address ?? "",
      supplier_id: editPhone.supplier_id ?? "",
      supplier_name: editPhone.supplier_name ?? "",
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
      payment_amount: "", payment_account_id: "",
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
      if (form.source_type === "walk_in" && !form.walkin_name.trim())
        return "Enter the seller's name"
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
    // Resolve source fields based on type
    const isExistingCustomer = form.source_type === "customer_trade_in"
    const isWalkIn           = form.source_type === "walk_in"
    const isSupplier         = form.source_type === "purchased"

    const paid = Number(form.payment_amount) || 0
    onSave({
      brand: form.brand, model: form.model, color: form.color,
      storage: form.storage, ram: form.ram,
      imei_number: form.imei_number,
      source_type: form.source_type,
      source_customer_id:   isExistingCustomer ? (form.source_customer_id || undefined) : undefined,
      source_customer_name: isExistingCustomer ? (form.source_customer_name || undefined)
                          : isWalkIn           ? (form.walkin_name || undefined)
                          : undefined,
      source_phone:   isWalkIn ? (form.walkin_phone || undefined) : undefined,
      source_cnic:    isWalkIn ? (form.walkin_cnic  || undefined) : undefined,
      source_address: isWalkIn ? (form.walkin_address || undefined) : undefined,
      supplier_id:   isSupplier ? (form.supplier_id   || undefined) : undefined,
      supplier_name: isSupplier ? (form.supplier_name || undefined) : undefined,
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
      _paymentAmount: paid > 0 ? paid : undefined,
      _paymentAccountId: paid > 0 && form.payment_account_id ? form.payment_account_id : undefined,
    })
  }

  const totalCost = (Number(form.purchase_price) || 0) + (Number(form.refurbishment_cost) || 0)
  const profit    = (Number(form.selling_price) || 0) - totalCost
  const margin    = form.selling_price && Number(form.selling_price) > 0
    ? ((profit / Number(form.selling_price)) * 100).toFixed(0)
    : "0"

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
                      {i < step ? <span>&#10003;</span> : i + 1}
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
                  <Field label="Brand" required>
                    {(() => {
                      const allBrands = Array.from(new Set([...MASTER_BRAND_NAMES, ...brands])).sort()
                      return (
                        <SearchableSelect
                          value={form.brand}
                          onChange={val => { set("brand", val); set("model", "") }}
                          options={allBrands}
                          placeholder="Search brand..."
                          allowCustom
                          customWarning="This brand is not in the standard list. It will be saved as entered."
                          onAddNew={async (name) => { await onAddBrand(name) }}
                        />
                      )
                    })()}
                  </Field>
                  <Field label="Model" required>
                    {(() => {
                      const brandEntry = MASTER_BRANDS.find(b => b.name.toLowerCase() === form.brand.toLowerCase())
                      const isApple = form.brand.toLowerCase() === "apple"
                      const modelOptions = isApple ? APPLE_MODELS : (brandEntry?.models ?? [])
                      return (
                        <SearchableSelect
                          value={form.model}
                          onChange={val => set("model", val)}
                          options={modelOptions}
                          placeholder={form.brand ? `Search ${form.brand} model...` : "Select brand first"}
                          disabled={!form.brand}
                          allowCustom
                          customWarning="This model is not in the standard list. Double-check spelling."
                        />
                      )
                    })()}
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Color">
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
                              try { await onAddColor(newColorName.trim()); set("color", newColorName.trim()); setNewColorName(""); setShowNewColor(false) } finally { setAddingColor(false) }
                            }
                          }} />
                        <button type="button" disabled={!newColorName.trim() || addingColor}
                          className="h-9 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                          onClick={async () => {
                            if (!newColorName.trim()) return
                            setAddingColor(true)
                            try { await onAddColor(newColorName.trim()); set("color", newColorName.trim()); setNewColorName(""); setShowNewColor(false) } finally { setAddingColor(false) }
                          }}>
                          {addingColor ? "..." : "Save"}
                        </button>
                        <button type="button" onClick={() => { setShowNewColor(false); setNewColorName("") }}
                          className="h-9 px-2 text-slate-400 hover:text-slate-600">&#x2715;</button>
                      </div>
                    )}
                  </Field>
                  <Field label="Storage">
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
                              try { await onAddStorage(newStorageName.trim()); set("storage", newStorageName.trim()); setNewStorageName(""); setShowNewStorage(false) } finally { setAddingStorage(false) }
                            }
                          }} />
                        <button type="button" disabled={!newStorageName.trim() || addingStorage}
                          className="h-9 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                          onClick={async () => {
                            if (!newStorageName.trim()) return
                            setAddingStorage(true)
                            try { await onAddStorage(newStorageName.trim()); set("storage", newStorageName.trim()); setNewStorageName(""); setShowNewStorage(false) } finally { setAddingStorage(false) }
                          }}>
                          {addingStorage ? "..." : "Save"}
                        </button>
                        <button type="button" onClick={() => { setShowNewStorage(false); setNewStorageName("") }}
                          className="h-9 px-2 text-slate-400 hover:text-slate-600">&#x2715;</button>
                      </div>
                    )}
                  </Field>
                  <Field label="RAM">
                    {form.brand.toLowerCase() === "apple" ? (
                      <span className="block text-sm text-slate-400 italic py-2">Not applicable for iPhone</span>
                    ) : !showNewRam ? (
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
                              try { await onAddRam(newRamName.trim()); set("ram", newRamName.trim()); setNewRamName(""); setShowNewRam(false) } finally { setAddingRam(false) }
                            }
                          }} />
                        <button type="button" disabled={!newRamName.trim() || addingRam}
                          className="h-9 px-3 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                          onClick={async () => {
                            if (!newRamName.trim()) return
                            setAddingRam(true)
                            try { await onAddRam(newRamName.trim()); set("ram", newRamName.trim()); setNewRamName(""); setShowNewRam(false) } finally { setAddingRam(false) }
                          }}>
                          {addingRam ? "..." : "Save"}
                        </button>
                        <button type="button" onClick={() => { setShowNewRam(false); setNewRamName("") }}
                          className="h-9 px-2 text-slate-400 hover:text-slate-600">&#x2715;</button>
                      </div>
                    )}
                  </Field>
                </div>
                <Field label="IMEI Number" required>
                  <input type="text" value={form.imei_number} onChange={e => set("imei_number", e.target.value.replace(/\D/g,"").slice(0,15))} placeholder="15-digit IMEI" maxLength={15} className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">{form.imei_number.length}/15 digits</p>
                </Field>
                {/* -- Source -- */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Where did this phone come from?<span className="text-red-500 ml-0.5">*</span></label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {([
                      { type: "walk_in"           as SourceType, label: "Walk-in Seller", icon: "🚶", desc: "Person off the street" },
                      { type: "customer_trade_in" as SourceType, label: "Our Customer",   icon: "🤝", desc: "Existing customer" },
                      { type: "purchased"         as SourceType, label: "Supplier",       icon: "Ã°Å¸ÂÂª", desc: "Wholesaler / dealer" },
                    ]).map(opt => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => set("source_type", opt.type)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all",
                          form.source_type === opt.type
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        )}
                      >
                        <span className="text-xl">{opt.icon}</span>
                        <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                        <span className="text-[10px] text-slate-400 leading-tight">{opt.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Walk-in seller details */}
                  {form.source_type === "walk_in" && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Seller Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                          <input type="text" value={form.walkin_name} onChange={e => set("walkin_name", e.target.value)} placeholder="e.g. Ali Raza" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
                          <input type="tel" value={form.walkin_phone} onChange={e => set("walkin_phone", e.target.value)} placeholder="e.g. 0300-1234567" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">CNIC</label>
                          <input type="text" value={form.walkin_cnic} onChange={e => set("walkin_cnic", e.target.value)} placeholder="Optional" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                          <input type="text" value={form.walkin_address} onChange={e => set("walkin_address", e.target.value)} placeholder="Optional" className={inputCls} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Existing customer picker */}
                  {form.source_type === "customer_trade_in" && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Customer</p>
                      <select
                        value={form.source_customer_id}
                        onChange={e => {
                          const c = customers.find(c => c.id === e.target.value)
                          set("source_customer_id", e.target.value)
                          set("source_customer_name", c?.name ?? "")
                        }}
                        className={selectCls}
                      >
                        <option value="">-- Select customer --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}{c.phone ? `  ·  ${c.phone}` : ""}</option>
                        ))}
                      </select>
                      {form.source_customer_id && (() => {
                        const c = customers.find(x => x.id === form.source_customer_id)
                        return c ? (
                          <div className="flex items-center gap-2 mt-1 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                            <span className="font-semibold">{c.name}</span>
                            {c.phone && <span className="text-slate-500"> ·  {c.phone}</span>}
                          </div>
                        ) : null
                      })()}
                    </div>
                  )}

                  {/* Supplier picker */}
                  {form.source_type === "purchased" && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Supplier</p>
                      <select
                        value={form.supplier_id}
                        onChange={e => {
                          const s = suppliers.find(s => s.id === e.target.value)
                          set("supplier_id", e.target.value)
                          set("supplier_name", s?.companyName ?? "")
                        }}
                        className={selectCls}
                      >
                        <option value="">-- Select supplier --</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.companyName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Date Acquired">
                    <input type="date" value={form.purchased_date} onChange={e => set("purchased_date", e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Purchase Price (Rs)" required>
                    <input type="number" onWheel={e => e.currentTarget.blur()} value={form.purchase_price} onChange={e => set("purchase_price", e.target.value)} placeholder="0" min={0} className={inputCls} />
                  </Field>
                </div>
              </div>
            )}

            {/* Step 2: Condition */}
            {step === 1 && (
              <div className="space-y-5">
                <Field label="Condition Grade">
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
                    {form.condition_grade === "A+" ? "Like new - no visible wear" :
                     form.condition_grade === "A"  ? "Excellent - very minor wear" :
                     form.condition_grade === "B+" ? "Good - light scratches, minor issues" :
                     form.condition_grade === "B"  ? "Moderate wear, functional" :
                     form.condition_grade === "C"  ? "Heavy wear, multiple issues" :
                     "Poor - significant damage"}
                  </p>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Screen Condition">
                    <select value={form.screen_condition} onChange={e => set("screen_condition", e.target.value as ScreenCondition)} className={selectCls}>
                      {(Object.entries(SCREEN_LABEL) as [ScreenCondition, string][]).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Body Condition">
                    <select value={form.body_condition} onChange={e => set("body_condition", e.target.value as BodyCondition)} className={selectCls}>
                      {(Object.entries(BODY_LABEL) as [BodyCondition, string][]).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                </div>
                {form.brand.toLowerCase() === "apple" && (
                  <Field label="Battery Health (%)">
                    <input type="number" onWheel={e => e.currentTarget.blur()} value={form.battery_health} onChange={e => set("battery_health", e.target.value)} placeholder="e.g. 85" min={0} max={100} className={inputCls} />
                    {form.battery_health && <BatteryBar value={Number(form.battery_health)} />}
                  </Field>
                )}
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
                <Field label="Condition Notes">
                  <textarea
                    value={form.condition_notes}
                    onChange={e => set("condition_notes", e.target.value)}
                    rows={3}
                    placeholder="Describe the condition in detail..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </Field>
              </div>
            )}

            {/* Step 3: Pricing */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Refurbishment Cost (Rs)">
                    <input type="number" onWheel={e => e.currentTarget.blur()} value={form.refurbishment_cost} onChange={e => set("refurbishment_cost", e.target.value)} placeholder="0" min={0} className={inputCls} />
                  </Field>
                  <Field label="Selling Price (Rs)" required>
                    <input type="number" onWheel={e => e.currentTarget.blur()} value={form.selling_price} onChange={e => set("selling_price", e.target.value)} placeholder="0" min={0} className={inputCls} />
                  </Field>
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
                  <Field label="PTA Status">
                    <select value={form.pta_status} onChange={e => set("pta_status", e.target.value as UsedPTAStatus)} className={selectCls}>
                      <option value="approved">PTA Approved</option>
                      <option value="pending">PTA Pending</option>
                      <option value="blocked">PTA Blocked</option>
                    </select>
                  </Field>
                  <Field label="Status">
                    <select value={form.status} onChange={e => set("status", e.target.value as PhoneStatus)} className={selectCls}>
                      <option value="in_stock">In Stock</option>
                      <option value="under_repair">Under Repair</option>
                      <option value="listed_online">Listed Online</option>
                    </select>
                  </Field>
                  <Field label="Warranty (days)">
                    <select value={form.warranty_days} onChange={e => set("warranty_days", e.target.value)} className={selectCls}>
                      {["0","3","7","10","14","30"].map(d => <option key={d} value={d}>{d === "0" ? "No Warranty" : `${d} days`}</option>)}
                    </select>
                  </Field>
                </div>
                {/* Payment - only for new phones */}
                {!editPhone && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Amount Paid (â‚¨)">
                        <input
                          type="number" onWheel={e => e.currentTarget.blur()}
                          value={form.payment_amount}
                          onChange={e => set("payment_amount", e.target.value)}
                          placeholder={`0 of ${form.purchase_price || "?"}`}
                          min={0}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Pay From Account">
                        <select value={form.payment_account_id} onChange={e => set("payment_account_id", e.target.value)} className={selectCls}>
                          <option value="">-- Select account --</option>
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({a.type === "cash" ? "Cash" : a.type === "bank" ? "Bank" : "Mobile Wallet"}) - â‚¨{a.currentBalance.toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    {form.payment_amount && Number(form.payment_amount) > 0 && !form.payment_account_id && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" /> Select an account to record the payment
                      </p>
                    )}
                    {form.payment_amount && Number(form.payment_amount) > 0 && form.payment_account_id && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        â‚¨{Number(form.payment_amount).toLocaleString()} will be deducted from your account on save
                      </p>
                    )}
                  </div>
                )}
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
                      ...(form.brand.toLowerCase() !== "apple" ? [{ l: "RAM", v: form.ram }] : []),
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
                      ...(form.brand.toLowerCase() === "apple" ? [{ l: "Battery", v: form.battery_health ? `${form.battery_health}%` : "Not checked" }] : []),
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

// --Ã¢"â‚¬ Main Page ----------------------------------------------------------------

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
  const [showBulkDialog, setShowBulkDialog] = useState(false)
  const [editPhone, setEditPhone]         = useState<UsedPhone | null>(null)
  const [showCalculator, setShowCalculator] = useState(false)
  const [sellPhone, setSellPhone]         = useState<UsedPhone | null>(null)

  // -- Dynamic dropdown data ------------------------------------------------Ã¢"â‚¬
  const [brands, setBrands] = useState<string[]>([])
  const [models, setModels] = useState<{ name: string; brandName: string; deviceType: "iphone" | "android"; dbId: string; table: "iphone_models" | "android_models" }[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [storageOptions, setStorageOptions] = useState<string[]>([])
  const [ramOptions, setRamOptions] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([])

  async function fetchBrands() {
    const tenantId = await getTenantId()
    const { data } = await supabase.from("brands").select("name").eq("tenant_id", tenantId).eq("status", "Active").order("name")
    if (data) setBrands(data.map(d => d.name))
  }

  async function fetchModels() {
    const tenantId = await getTenantId()
    const [iRes, aRes] = await Promise.all([
      supabase.from("iphone_models").select("id, name, brand_name").eq("tenant_id", tenantId).order("name"),
      supabase.from("android_models").select("id, name, brand_name").eq("tenant_id", tenantId).order("name"),
    ])
    const iphones = (iRes.data ?? []).map((m: any) => ({ name: m.name, brandName: m.brand_name || "Apple", deviceType: "iphone" as const, dbId: m.id, table: "iphone_models" as const }))
    const androids = (aRes.data ?? []).map((m: any) => ({ name: m.name, brandName: m.brand_name || "", deviceType: "android" as const, dbId: m.id, table: "android_models" as const }))
    setModels([...iphones, ...androids])
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

  // All handlers return Promise<void> to match CreatableCombobox / QuickCatPopover signatures
  async function handleAddBrand(name: string): Promise<void> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("brands").insert({ tenant_id: tenantId, name: name.trim(), logo_initials: name.trim().substring(0, 2).toUpperCase(), status: "Active" })
    if (error) throw new Error(error.message)
    setBrands(prev => [...new Set([...prev, name.trim()])].sort())
    toast.success(`Brand "${name.trim()}" added`)
  }
  async function handleEditBrand(oldVal: string, newVal: string): Promise<void> {
    const { error } = await supabase.from("brands").update({ name: newVal }).eq("name", oldVal)
    if (error) throw new Error(error.message)
    setBrands(prev => prev.map(b => b === oldVal ? newVal : b).sort())
    toast.success("Brand updated")
  }
  async function handleDeleteBrand(val: string): Promise<void> {
    const { error } = await supabase.from("brands").delete().eq("name", val)
    if (error) throw new Error(error.message)
    setBrands(prev => prev.filter(b => b !== val))
    toast.success(`"${val}" deleted`)
  }

  async function handleAddModel(brand: string, name: string): Promise<void> {
    const tenantId = await getTenantId()
    const isApple = brand.toLowerCase() === "apple"
    const table = isApple ? "iphone_models" : "android_models"
    const { data, error } = await supabase.from(table).insert({ tenant_id: tenantId, name: name.trim(), brand_name: brand, is_system: false }).select("id").single()
    if (error) throw new Error(error.message)
    setModels(prev => [...prev, { name: name.trim(), brandName: brand, deviceType: isApple ? "iphone" : "android", dbId: (data as any).id, table }])
    toast.success(`Model "${name.trim()}" added`)
  }
  async function handleEditModel(oldVal: string, newVal: string): Promise<void> {
    const m = models.find(x => x.name === oldVal)
    if (!m) return
    const { error } = await supabase.from(m.table).update({ name: newVal }).eq("id", m.dbId)
    if (error) throw new Error(error.message)
    setModels(prev => prev.map(x => x.dbId === m.dbId ? { ...x, name: newVal } : x))
    toast.success("Model updated")
  }
  async function handleDeleteModel(val: string): Promise<void> {
    const m = models.find(x => x.name === val)
    if (!m) return
    const { error } = await supabase.from(m.table).delete().eq("id", m.dbId)
    if (error) throw new Error(error.message)
    setModels(prev => prev.filter(x => x.dbId !== m.dbId))
    toast.success(`"${val}" deleted`)
  }

  async function handleAddColor(name: string): Promise<void> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("colors").insert({ tenant_id: tenantId, name: name.trim() })
    if (error) throw new Error(error.message)
    setColors(prev => [...new Set([...prev, name.trim()])].sort())
    toast.success(`Color "${name.trim()}" added`)
  }
  async function handleEditColor(oldVal: string, newVal: string): Promise<void> {
    const { error } = await supabase.from("colors").update({ name: newVal }).eq("name", oldVal)
    if (error) throw new Error(error.message)
    setColors(prev => prev.map(c => c === oldVal ? newVal : c).sort())
    toast.success("Color updated")
  }
  async function handleDeleteColor(val: string): Promise<void> {
    const { error } = await supabase.from("colors").delete().eq("name", val)
    if (error) throw new Error(error.message)
    setColors(prev => prev.filter(c => c !== val))
    toast.success(`"${val}" deleted`)
  }

  async function handleAddStorage(name: string): Promise<void> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("storage_options").insert({ tenant_id: tenantId, name: name.trim() })
    if (error) throw new Error(error.message)
    setStorageOptions(prev => [...new Set([...prev, name.trim()])].sort())
    toast.success(`Storage "${name.trim()}" added`)
  }
  async function handleEditStorage(oldVal: string, newVal: string): Promise<void> {
    const { error } = await supabase.from("storage_options").update({ name: newVal }).eq("name", oldVal)
    if (error) throw new Error(error.message)
    setStorageOptions(prev => prev.map(s => s === oldVal ? newVal : s).sort())
    toast.success("Storage updated")
  }
  async function handleDeleteStorage(val: string): Promise<void> {
    const { error } = await supabase.from("storage_options").delete().eq("name", val)
    if (error) throw new Error(error.message)
    setStorageOptions(prev => prev.filter(s => s !== val))
    toast.success(`"${val}" deleted`)
  }

  async function handleAddRam(name: string): Promise<void> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("ram_options").insert({ tenant_id: tenantId, name: name.trim() })
    if (error) throw new Error(error.message)
    setRamOptions(prev => [...new Set([...prev, name.trim()])].sort())
    toast.success(`RAM "${name.trim()}" added`)
  }
  async function handleEditRam(oldVal: string, newVal: string): Promise<void> {
    const { error } = await supabase.from("ram_options").update({ name: newVal }).eq("name", oldVal)
    if (error) throw new Error(error.message)
    setRamOptions(prev => prev.map(r => r === oldVal ? newVal : r).sort())
    toast.success("RAM updated")
  }
  async function handleDeleteRam(val: string): Promise<void> {
    const { error } = await supabase.from("ram_options").delete().eq("name", val)
    if (error) throw new Error(error.message)
    setRamOptions(prev => prev.filter(r => r !== val))
    toast.success(`"${val}" deleted`)
  }

  // -- Fetch data from Supabase ----------------------------------------------
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
    fetchModels()
    fetchColors()
    fetchStorageOptions()
    fetchRamOptions()
    // Suppliers: fall back to direct query if getSuppliers throws (e.g. RLS timing)
    getSuppliers()
      .then(setSuppliers)
      .catch(async () => {
        try {
          const tenantId = await getTenantId()
          const { data } = await supabase
            .from("suppliers")
            .select("id, company_name, contact_person, phone, email, address, city, outstanding_balance")
            .eq("tenant_id", tenantId)
            .order("company_name")
          if (data) {
            setSuppliers(data.map((r: any) => ({
              id: r.id,
              companyName: r.company_name ?? "",
              contactPerson: r.contact_person ?? "",
              phone: r.phone ?? "",
              email: r.email ?? "",
              address: r.address ?? "",
              city: r.city ?? "",
              totalPurchases: 0,
              outstandingBalance: r.outstanding_balance ?? 0,
              rating: 0,
              status: "Active",
              createdAt: "",
            })))
          }
        } catch { /* non-fatal */ }
      })
    getCustomers().then(setCustomers).catch(() => {})
    getFinanceAccounts().then(setFinanceAccounts).catch(() => {})
  }, [])

  // -- Stats ------------------------------------------------------------------
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

  // -- Filtered --------------------------------------------------------------Ã¢"â‚¬
  const filtered = useMemo(() => {
    let res = [...phones]
    if (search)     res = res.filter(p => `${p.brand} ${p.model} ${p.color} ${p.imei_number}`.toLowerCase().includes(search.toLowerCase()))
    if (gradeFilter) res = res.filter(p => p.condition_grade === gradeFilter)
    if (brandFilter) res = res.filter(p => p.brand.toLowerCase() === brandFilter.toLowerCase())
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

  // -- Handlers --------------------------------------------------------------Ã¢"â‚¬
  const handleView = (p: UsedPhone) => { setSelectedPhone(p); setShowDetails(true) }
  const handleEdit = (p: UsedPhone) => { setEditPhone(p); setShowAddDialog(true); setShowDetails(false) }
  const handleSell = (p: UsedPhone) => { setSellPhone(p); setShowDetails(false) }

  const handleSave = async (data: Partial<UsedPhone> & { _paymentAmount?: number; _paymentAccountId?: string }) => {
    const { _paymentAmount, _paymentAccountId, ...phoneData } = data
    try {
      if (editPhone) {
        const updated = await updateUsedPhone(editPhone.id, phoneData)
        setPhones(prev => prev.map(p => p.id === editPhone.id ? updated : p))
        toast.success("Phone updated successfully")
      } else {
        const created = await createUsedPhone({
          brand: phoneData.brand ?? "",
          model: phoneData.model ?? "",
          imei_number: phoneData.imei_number ?? "",
          color: phoneData.color ?? "",
          storage: phoneData.storage ?? "",
          ram: phoneData.ram ?? "",
          condition_grade: phoneData.condition_grade ?? "B",
          screen_condition: phoneData.screen_condition ?? "perfect",
          body_condition: phoneData.body_condition ?? "perfect",
          battery_health: phoneData.battery_health,
          functional_issues: phoneData.functional_issues ?? [],
          accessories_included: phoneData.accessories_included ?? [],
          source_type: phoneData.source_type ?? "walk_in",
          source_customer_id: phoneData.source_customer_id,
          source_customer_name: phoneData.source_customer_name,
          source_phone: (phoneData as any).source_phone,
          source_cnic: (phoneData as any).source_cnic,
          source_address: (phoneData as any).source_address,
          supplier_id: (phoneData as any).supplier_id,
          supplier_name: (phoneData as any).supplier_name,
          purchase_price: phoneData.purchase_price ?? 0,
          refurbishment_cost: phoneData.refurbishment_cost ?? 0,
          selling_price: phoneData.selling_price ?? 0,
          pta_status: phoneData.pta_status ?? "pending",
          status: "in_stock",
          warranty_days: phoneData.warranty_days ?? 7,
          condition_notes: phoneData.condition_notes,
          photos: phoneData.photos ?? [],
          purchased_date: phoneData.purchased_date ?? todayPKT(),
          sold_date: undefined,
        })
        // Deduct from finance account if payment was made
        if (_paymentAmount && _paymentAmount > 0 && _paymentAccountId) {
          try {
            await createWithdrawal({
              accountId: _paymentAccountId,
              amount: _paymentAmount,
              date: phoneData.purchased_date ?? todayPKT(),
              description: `Used phone purchase: ${phoneData.brand ?? ""} ${phoneData.model ?? ""} (IMEI: ${phoneData.imei_number ?? ""})`,
            })
            // Refresh finance accounts list so balances stay current
            getFinanceAccounts().then(setFinanceAccounts).catch(() => {})
          } catch (finErr) {
            toast.error(`Phone saved but payment recording failed: ${finErr instanceof Error ? finErr.message : "Unknown error"}`)
          }
        }
        setPhones(prev => [created, ...prev])
        toast.success("Phone added successfully")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save phone")
      return
    }
    setShowAddDialog(false)
    setEditPhone(null)
  }

  const handleSoldConfirm = async (id: string, customerName: string, price: number) => {
    try {
      const updated = await updateUsedPhone(id, {
        status: "sold",
        selling_price: price,
        sold_date: todayPKT(),
        source_customer_name: customerName,
      })
      setPhones(prev => prev.map(p => p.id === id ? updated : p))
      toast.success("Phone marked as sold!")
    } catch {
      toast.error("Failed to mark as sold")
    }
    setSellPhone(null)
  }

  const handleBulkSaved = (saved: UsedPhone[]) => {
    setPhones(prev => [...saved, ...prev])
    setShowBulkDialog(false)
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

  // Full-page bulk add — renders instead of the list page
  if (showBulkDialog) {
    return (
      <BulkAddDialog
        onClose={() => setShowBulkDialog(false)}
        onSaved={handleBulkSaved}
        brands={brands}
        models={models}
        colors={colors}
        storageOptions={storageOptions}
        ramOptions={ramOptions}
        suppliers={suppliers}
        accounts={financeAccounts}
        onAddBrand={handleAddBrand}
        onEditBrand={handleEditBrand}
        onDeleteBrand={handleDeleteBrand}
        onAddModel={handleAddModel}
        onEditModel={handleEditModel}
        onDeleteModel={handleDeleteModel}
        onAddColor={handleAddColor}
        onEditColor={handleEditColor}
        onDeleteColor={handleDeleteColor}
        onAddStorage={handleAddStorage}
        onEditStorage={handleEditStorage}
        onDeleteStorage={handleDeleteStorage}
        onAddRam={handleAddRam}
        onEditRam={handleEditRam}
        onDeleteRam={handleDeleteRam}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Used / Refurbished Phones</h1>
          <p className="text-slate-500 text-sm mt-0.5">{phones.length} phones  ·  {phones.filter(p => p.status === "in_stock").length} available</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowCalculator(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Calculator className="w-3.5 h-3.5" /> Trade-In Calc
          </button>
          <button
            onClick={() => setShowBulkDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Phone(s)
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
                {Array.from(new Set([...MASTER_BRAND_NAMES, ...brands])).sort().map(b => <option key={b} value={b}>{b}</option>)}
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
              <label className="block text-xs font-medium text-slate-500 mb-1">Min Price (Rs)</label>
              <input type="number" onWheel={e => e.currentTarget.blur()} value={minPrice} onChange={e => { setMinPrice(e.target.value); resetPage() }} placeholder="0" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Max Price (Rs)</label>
              <input type="number" onWheel={e => e.currentTarget.blur()} value={maxPrice} onChange={e => { setMaxPrice(e.target.value); resetPage() }} placeholder="Any" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Min Battery %</label>
              <input type="number" onWheel={e => e.currentTarget.blur()} value={minBattery} onChange={e => { setMinBattery(e.target.value); resetPage() }} placeholder="0" min={0} max={100} className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
            Page {page} of {totalPages}  ·  {filtered.length} phones
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
          suppliers={suppliers}
          customers={customers}
          accounts={financeAccounts}
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

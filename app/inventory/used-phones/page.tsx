﻿"use client"
import { PermissionGate } from "@/components/shared/permission-gate"
import React, { useState, useMemo, useRef, useEffect } from "react"
import {
  Search, SlidersHorizontal, LayoutGrid, List, Plus, Calculator, Eye, Edit2,
  CheckCircle2, ChevronLeft, ChevronRight, X, BatteryMedium, Smartphone, Tag,
  TrendingUp, Package, Battery, Star, MoreVertical, Camera, Upload,
  ArrowUpRight, ArrowDownRight, Minus, Info, User, Calendar, DollarSign,
  ShoppingBag, Shield, ChevronDown, ChevronUp, Lock, Unlock, Trash2, Copy,
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
import { StatCard } from "@/components/shared/stat-card"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { SplitPaymentPicker, splitTotal, splitInsufficientMap, type SplitEntry } from "@/components/shared/split-payment-picker"
import { MoneyInput } from "@/components/ui/money-input"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { getSuppliers } from "@/lib/api/suppliers"
import { getCustomers } from "@/lib/api/customers"
import { getFinanceAccounts } from "@/lib/api/finance"
import type { Supplier, Customer } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, formatDate, cn, todayPKT } from "@/lib/utils"
import { useLanguage } from "@/context/language-context"
import { toast } from "sonner"

// --Ã¢"â‚¬ Grade / Status Meta ------------------------------------------------------

const GRADE_META: Record<ConditionGrade, { bg: string; text: string; border: string; ring: string; label: string }> = {
  "A+": { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", ring: "ring-emerald-400", label: "A+" },
  "A":  { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-200",   ring: "ring-green-400",   label: "A"  },
  "B+": { bg: "bg-lime-100",    text: "text-lime-700",    border: "border-lime-200",    ring: "ring-lime-400",    label: "B+" },
  "B":  { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200",   ring: "ring-amber-400",   label: "B"  },
  "C":  { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-200",  ring: "ring-orange-400",  label: "C"  },
  "D":  { bg: "bg-rose-100",     text: "text-rose-700",     border: "border-rose-200",     ring: "ring-rose-400",     label: "D"  },
}

const GRADE_MULTIPLIER: Record<ConditionGrade, number> = {
  "A+": 0.85, "A": 0.75, "B+": 0.65, "B": 0.55, "C": 0.40, "D": 0.25,
}

const STATUS_META: Record<PhoneStatus, { bg: string; text: string; label: string }> = {
  in_stock:      { bg: "bg-green-100",  text: "text-green-700",  label: "In Stock"      },
  under_repair:  { bg: "bg-amber-100",  text: "text-amber-700",  label: "Under Repair"  },
  sold:          { bg: "bg-slate-100",  text: "text-slate-600",  label: "Sold"          },
  listed_online: { bg: "bg-indigo-100",   text: "text-indigo-700",   label: "Listed Online" },
  returned:      { bg: "bg-rose-100",   text: "text-rose-700",   label: "Returned"      },
}

const PTA_META: Record<UsedPTAStatus, { bg: string; text: string; label: string }> = {
  approved:      { bg: "bg-emerald-100", text: "text-emerald-700", label: "PTA Approved"  },
  non_pta:       { bg: "bg-rose-100",     text: "text-rose-700",     label: "Non-PTA"       },
  jv:            { bg: "bg-violet-100",  text: "text-violet-700",  label: "JV"            },
  mdm:           { bg: "bg-amber-100",   text: "text-amber-700",   label: "MDM"           },
  cpid_approved: { bg: "bg-emerald-100", text: "text-emerald-700", label: "CPID Approved" },
  pending:       { bg: "bg-amber-100",   text: "text-amber-700",   label: "PTA Pending"   },
  blocked:       { bg: "bg-slate-100",   text: "text-slate-600",   label: "PTA Blocked"   },
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
  const color = value >= 85 ? "bg-emerald-500" : value >= 70 ? "bg-amber-500" : "bg-rose-500"
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
      "bg-white rounded-xl border overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative group",
      m.border
    )}>
      {/* Photo */}
      <div className={cn("relative h-24 flex items-center justify-center", m.bg)}>
        {phone.photos.length > 0 ? (
          <img src={phone.photos[0]} alt={phone.model} className="h-full w-full object-cover" />
        ) : (
          <Smartphone className={cn("w-9 h-9 opacity-30", m.text)} />
        )}
        <div className="absolute top-2 left-2 z-10">
          <GradeBadge grade={phone.condition_grade} />
        </div>
        <div className="absolute top-2 right-2 z-10">
          <StatusBadge status={phone.status} />
        </div>
      </div>

      {/* Content */}
      <div className="p-2.5 space-y-2">
        <div>
          <p className="text-[10px] text-slate-400 font-medium tracking-wide">{phone.brand}</p>
          <h3 className="text-[13px] font-bold text-slate-900 leading-snug truncate">{phone.model}</h3>
          <p className="text-[10px] text-slate-400 truncate">{phone.storage} · {phone.color}</p>
        </div>

        {/* Battery */}
        <BatteryBar value={phone.battery_health} />

        {/* Pricing */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Selling</p>
            <p className="text-[13px] font-bold text-slate-900">{formatCurrency(phone.selling_price)}</p>
          </div>
          <div className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0",
            profit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
          )}>
            {profit >= 0 ? "+" : ""}{margin}%
          </div>
        </div>

        {/* Actions */}
        <div className={cn("grid gap-1 pt-1.5 border-t border-slate-100", phone.status === "in_stock" ? "grid-cols-3" : "grid-cols-2")}>
          <button
            onClick={() => onView(phone)}
            className="h-7 flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
          >
            <Eye className="w-3 h-3" /> View
          </button>
          <button
            onClick={() => onEdit(phone)}
            className="h-7 flex items-center justify-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          {phone.status === "in_stock" && (
            <button
              onClick={() => onSell(phone)}
              className="h-7 flex items-center justify-center gap-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" /> Sell
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
          profit >= 0 ? "text-emerald-600" : "text-rose-600"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between sm:block">
              <div>
                <p className="text-xs text-slate-400 sm:mb-1">Total Cost</p>
                <p className="text-[10px] text-slate-400 sm:hidden">Purchase + Refurb</p>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-base sm:text-sm font-bold text-slate-900 whitespace-nowrap">{formatCurrency(totalCost)}</p>
                <p className="hidden sm:block text-[10px] text-slate-400">Purchase + Refurb</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between sm:block">
              <div>
                <p className="text-xs text-slate-400 sm:mb-1">Sell Price</p>
                <p className="text-[10px] text-slate-400 sm:hidden">Listed at</p>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-base sm:text-sm font-bold text-slate-900 whitespace-nowrap">{formatCurrency(phone.selling_price)}</p>
                <p className="hidden sm:block text-[10px] text-slate-400">Listed at</p>
              </div>
            </div>
            <div className={cn("rounded-xl p-3 flex items-center justify-between sm:block", profit >= 0 ? "bg-emerald-50" : "bg-rose-50")}>
              <div>
                <p className="text-xs text-slate-400 sm:mb-1">Profit</p>
                <p className="text-[10px] text-slate-400 sm:hidden">{margin}% margin</p>
              </div>
              <div className="text-right sm:text-left">
                <p className={cn("text-base sm:text-sm font-bold whitespace-nowrap", profit >= 0 ? "text-emerald-700" : "text-rose-700")}>
                  {profit >= 0 ? "+" : ""}{formatCurrency(profit)}
                </p>
                <p className="hidden sm:block text-[10px] text-slate-400">{margin}% margin</p>
              </div>
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
                    <span key={id} className="text-xs px-2 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-100">
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
                    <span key={id} className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
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
                <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 space-y-1">
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">
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
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Final Sale Price (Rs)</label>
              <MoneyInput
                value={finalPrice}
                onChange={v => setFinalPrice(v)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <Calculator className="w-5 h-5 text-indigo-600" />
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
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estimated Market Price (New / Avg Used) — Rs</label>
              <MoneyInput
                value={marketPrice}
                onChange={v => setMarketPrice(v)}
                placeholder="e.g. 80000"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Result */}
            {result && (
              <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">Suggested Prices</p>
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
              <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
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
  const [saving, setSaving] = useState(false)
  const [editingVal, setEditingVal] = useState<string | null>(null)
  const [editInput, setEditInput] = useState("")
  const [deletingVal, setDeletingVal] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = query.trim().toLowerCase()
  const unique = Array.from(new Set(options.map(o => o.trim()).filter(Boolean)))
  const filtered = q ? unique.filter(o => o.toLowerCase().includes(q)) : unique
  const exactMatch = unique.some(o => o.toLowerCase() === q)
  const canCreate = !!onAdd && q.length > 0 && !exactMatch

  function close() {
    setOpen(false); setManaging(false)
    setQuery(""); setEditingVal(null); setDeletingVal(null)
  }

  async function handleSaveNew() {
    if (!onAdd || !query.trim() || saving) return
    const name = query.trim()
    setSaving(true)
    try { await onAdd(name); onChange(name); close() }
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
        "focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500",
        disabled ? "opacity-50 pointer-events-none bg-slate-50"
        : error ? "border-rose-400 bg-rose-50"
        : locked ? "border-indigo-400 bg-indigo-50"
        : "border-slate-300 hover:border-slate-400"
      )}>
        {/* Lock icon - left side, only when lockable */}
        {onToggleLock !== undefined && (
          <button type="button" onClick={e => { e.stopPropagation(); onToggleLock() }}
            title={locked ? "Locked - next card inherits this value" : "Click to lock for next card"}
            className={cn(
              "flex items-center justify-center w-7 h-full rounded-l-lg border-r shrink-0 transition-colors",
              locked ? "border-indigo-300 bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                     : "border-slate-200 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 hover:border-indigo-200"
            )}>
            {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
        )}
        <div className="flex-1 flex items-center px-2.5 gap-1 min-w-0">
          {value && !open ? (
            <>
              <span className="text-sm text-slate-800 flex-1 truncate font-medium">{value}</span>
              <button type="button" onClick={() => { onChange(""); setQuery("") }}
                className="text-slate-300 hover:text-rose-400 shrink-0 p-0.5"><X className="w-3 h-3" /></button>
            </>
          ) : (
            <input ref={inputRef} value={open ? query : ""}
              onChange={e => { setQuery(e.target.value); setOpen(true); setManaging(false) }}
              onFocus={() => setOpen(true)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (managing) { /* no-op - managing has its own controls */ }
                  else if (filtered[0]) { onChange(filtered[0]); close() }
                  else if (canCreate) { handleSaveNew() }
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
                        opt === value && "bg-indigo-50 text-indigo-700 font-semibold"
                      )}>
                      {opt === value
                        ? <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        : <span className="w-3.5 shrink-0" />}
                      <span className="truncate">{opt}</span>
                    </button>
                  ))}
                </div>

                {/* â"€â"€ Inline "Add" row - the query already typed above becomes the new value,
                    no separate box to retype it in. Only shown once it doesn't match an
                    existing option, same pattern as the purchase form's combobox. â"€â"€ */}
                {canCreate && (
                  <button type="button"
                    onClick={handleSaveNew}
                    disabled={saving}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 border-t border-indigo-100 bg-indigo-50/60 transition-colors disabled:opacity-60">
                    <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <Plus className="w-3 h-3 text-indigo-600" />
                    </div>
                    {saving ? "Adding..." : `Add "${query.trim()}"${label ? ` as new ${label}` : ""}`}
                  </button>
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
                            className="flex-1 h-6 text-xs rounded-md border border-indigo-300 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                          <button type="button" onClick={() => handleEdit(item)} disabled={saving}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 px-1 shrink-0">Save</button>
                          <button type="button" onClick={() => { setEditingVal(null); setEditInput("") }}
                            className="text-[10px] text-slate-400 hover:text-slate-600 px-0.5 shrink-0">x</button>
                        </>
                      ) : deletingVal === item ? (
                        <>
                          <span className="flex-1 text-xs text-rose-600 truncate">{item}</span>
                          <button type="button" onClick={() => handleDelete(item)} disabled={saving}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 px-1 shrink-0">Delete?</button>
                          <button type="button" onClick={() => setDeletingVal(null)}
                            className="text-[10px] text-slate-400 hover:text-slate-600 px-0.5 shrink-0">No</button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-xs text-slate-700 truncate">{item}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {onEdit && <button type="button" onClick={() => { setEditingVal(item); setEditInput(item) }}
                              className="p-1 rounded hover:bg-indigo-50 text-slate-300 hover:text-indigo-500 transition-colors">
                              <Pencil className="w-3 h-3" /></button>}
                            {onDelete && <button type="button" onClick={() => setDeletingVal(item)}
                              className="p-1 rounded hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors">
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
  const { language } = useLanguage()
  const [supplierId, setSupplierId] = useState("")
  const [supplierErr, setSupplierErr] = useState(false)
  const [splits, setSplits] = useState<SplitEntry[]>([])
  const [accountErr, setAccountErr] = useState(false)
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
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmReactivate, setConfirmReactivate] = useState<{
    soldPhones: any[]
    tenantId: string
    supplierName: string
  } | null>(null)

  // Default the payment account to the shop's cash account once accounts load,
  // so the common case (paying cash) doesn't require an extra manual selection.
  useEffect(() => {
    if (splits.length > 0 || accounts.length === 0) return
    const cashAccount = accounts.find(a => a.isDefaultCash) ?? accounts.find(a => a.type === "cash")
    if (cashAccount) setSplits([{ accountId: cashAccount.id, amount: "" }])
  }, [accounts])

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
  const [walkinCnic, setWalkinCnic] = useState("")
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
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  const validate = (): boolean => {
    let ok = true
    setSupplierErr(false)
    setAccountErr(false)
    if (sourceType === "purchased" && !supplierId) { setSupplierErr(true); ok = false }
    if (sourceType === "walk_in" && !walkinName.trim()) { toast.error("Enter walk-in seller name"); ok = false }
    if (sourceType === "customer_trade_in" && !selectedCustomerId) { toast.error("Select a customer"); ok = false }
    if (!purchaseDate) { toast.error("Select a purchase date"); ok = false }

    const paidTotal = splitTotal(splits)
    const insufficient = splitInsufficientMap(splits, accounts)
    if (Object.keys(insufficient).length > 0) {
      toast.error("One or more accounts don't have enough balance for the amount entered")
      setAccountErr(true)
      ok = false
    }
    // Walk-in / trade-in purchases have no supplier ledger to track a debt
    // against, so they must be paid in full at the time of purchase.
    if (sourceType !== "purchased") {
      const grandTotalForValidation = rows.reduce((s, r) => s + (Number(r.purchase_price) || 0), 0)
      if (paidTotal < grandTotalForValidation) {
        toast.error(`${sourceType === "walk_in" ? "Walk-in" : "Customer trade-in"} purchases must be paid in full`)
        setAccountErr(true)
        ok = false
      }
    }

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
    if (saving) return
    if (!validate()) {
      toast.error("Fix the highlighted errors before saving")
      return
    }
    setSaving(true)
    setSaveProgress({ done: 0, total: rows.length })
    const tenantId = await getTenantId()
    const selectedSupplier = localSuppliers.find(s => s.id === supplierId)
    const supplierName = selectedSupplier?.companyName ?? ""

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
        setSaving(false)
        setSaveProgress(null)
        setConfirmReactivate({ soldPhones, tenantId, supplierName })
        return
      }
    }

    await proceedSave(tenantId, supplierName, [])
  }

  // Runs the reactivate-sold-phones step (if any) then inserts the batch.
  // Split out of handleSave so the "reactivate previously sold phones?"
  // confirmation can pause the flow via a dialog instead of window.confirm.
  const proceedSave = async (tenantId: string, supplierName: string, soldPhones: any[]) => {
    setSaving(true)
    setSaveProgress({ done: 0, total: rows.length })
    const resolvedSourceName =
      sourceType === "purchased" ? supplierName :
      sourceType === "walk_in" ? walkinName.trim() :
      sourceType === "customer_trade_in" ? selectedCustomerName : ""
    const resolvedSupplierId = sourceType === "purchased" ? supplierId : undefined
    const resolvedCustomerId = sourceType === "customer_trade_in" ? selectedCustomerId : undefined

    if (soldPhones.length > 0) {
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

    const insertPayload = rows.map(r => ({
      tenant_id: tenantId,
      brand: r.brand, model: r.model.trim(), color: r.color,
      storage: r.storage, ram: r.ram,
      imei_number: r.imei_number,
      source_type: sourceType,
      source_customer_name: resolvedSourceName,
      source_customer_id: resolvedCustomerId ?? null,
      source_phone: sourceType === "walk_in" ? walkinPhone.trim() || null : null,
      source_cnic:  sourceType === "walk_in" ? walkinCnic.trim() || null : null,
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
      const activeSplits = splits.filter(e => (parseFloat(e.amount) || 0) > 0)
      const paid = splitTotal(activeSplits)
      const balanceDue = Math.max(0, grandTotal - paid)
      const firstAccount = activeSplits[0] ? accounts.find(a => a.id === activeSplits[0].accountId) : undefined
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
      const purchaseItems = rows.map((r, i) => ({
        productId: (inserted as any)?.[i]?.id as string | undefined,
        productName: `${r.brand} ${r.model.trim()}`,
        productType: "UsedPhone",
        quantity: 1,
        unitCost: Number(r.purchase_price),
        total: Number(r.purchase_price),
        imeis: [r.imei_number],
      }))
      const purchaseSourceLabel =
        sourceType === "purchased" ? resolvedSourceName :
        sourceType === "walk_in" ? `Walk-in: ${resolvedSourceName}` :
        `Customer: ${resolvedSourceName}`
      const { data: purchaseRecord, error: purchaseErr } = await supabase.from("purchases").insert({
        tenant_id: tenantId,
        po_number: poNumber,
        date: purchaseDate,
        supplier_id: resolvedSupplierId || null,
        supplier_name: purchaseSourceLabel,
        subtotal: grandTotal,
        shipping_cost: 0,
        tax: 0,
        total: grandTotal,
        amount_paid: paid,
        balance_due: balanceDue,
        payment_status: payStatus,
        delivery_status: "Received",
        payment_method: firstAccount
          ? (firstAccount.type === "cash" ? "Cash" : firstAccount.type === "bank" ? "Bank Transfer" : firstAccount.bankName || "Mobile Wallet")
          : activeSplits.length > 1 ? "Split Payment" : "Cash",
        account_id: activeSplits[0]?.accountId || null,
        notes: null,
      }).select("id").single()
      if (purchaseErr) throw new Error(`Failed to record purchase: ${purchaseErr.message}`)

      // purchase_items rows so this purchase shows up correctly (item
      // count, totals) on the main Purchases list.
      if (purchaseRecord) {
        const dbItems = purchaseItems.map(item => ({
          tenant_id: tenantId,
          purchase_id: (purchaseRecord as any).id,
          product_id: item.productId,
          product_name: item.productName,
          product_type: "UsedPhone",
          quantity: item.quantity,
          returned_qty: 0,
          unit_cost: item.unitCost,
          total: item.total,
          imeis: item.imeis,
        }))
        const { error: itemsErr } = await supabase.from("purchase_items").insert(dbItems)
        if (itemsErr) throw new Error(`Failed to record purchase items: ${itemsErr.message}`)
      }

      // Finance: debit each selected account for its share of the payment
      if (purchaseRecord) {
        for (const se of activeSplits) {
          const amt = parseFloat(se.amount) || 0
          if (amt <= 0) continue
          await supabase.from("finance_transactions").insert({
            tenant_id: tenantId, date: purchaseDate, type: "purchase_payment",
            account_id: se.accountId, amount: amt,
            reference_type: "Purchase", reference_number: poNumber,
            description: `Used phones purchase ${poNumber} - ${purchaseSourceLabel}`,
          })
          const { data: accRow } = await supabase.from("finance_accounts").select("current_balance").eq("id", se.accountId).single()
          if (accRow) {
            await supabase.from("finance_accounts").update({
              current_balance: (accRow as any).current_balance - amt,
            }).eq("id", se.accountId)
          }
        }
      }
      // Update supplier outstanding balance if partial/unpaid - only
      // applies to real supplier purchases; walk-in/trade-in must be
      // paid in full (enforced in validate()), so balanceDue is always 0 there.
      if (sourceType === "purchased" && balanceDue > 0 && resolvedSupplierId) {
        const { data: supRow } = await supabase.from("suppliers").select("outstanding_balance").eq("id", resolvedSupplierId).single()
        if (supRow) {
          await supabase.from("suppliers").update({
            outstanding_balance: ((supRow as any).outstanding_balance ?? 0) + balanceDue,
          }).eq("id", resolvedSupplierId)
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

  // Who this batch is being bought from - shown in the Order Summary so it's
  // clear at a glance without scrolling back up to the Purchase Details card.
  const sourceLabel =
    sourceType === "purchased" ? (localSuppliers.find(s => s.id === supplierId)?.companyName ?? "")
    : sourceType === "walk_in" ? walkinName.trim()
    : sourceType === "customer_trade_in" ? selectedCustomerName
    : ""
  const allExpanded = rows.every(r => r.expanded)
  const completedCount = rows.filter(r => r.brand && r.model && r.imei_number.length === 15 && Number(r.purchase_price) > 0 && Number(r.selling_price) > 0).length

  // Walk-in / trade-in purchases must be paid in full - keep Amount Paid
  // locked to the running total so the UI can't drift into a partial payment.
  const requiresFullPayment = sourceType !== "purchased"
  // Walk-in / trade-in purchases must be paid in full. When exactly one
  // account is selected, auto-fill its amount to the grand total so the
  // common case (single account) needs no manual typing; with multiple
  // accounts selected the user splits the total across them manually.
  useEffect(() => {
    if (!requiresFullPayment || splits.length !== 1) return
    const only = splits[0]
    const filled = grandTotal > 0 ? String(grandTotal) : ""
    if (only.amount !== filled) setSplits([{ ...only, amount: filled }])
  }, [requiresFullPayment, grandTotal, splits])

  const toggleExpandAll = () =>
    setRows(prev => prev.map(r => ({ ...r, expanded: !allExpanded })))

  return (
    <div className="-m-3 sm:-m-4 md:-m-6 bg-slate-100 flex flex-col" style={{ minHeight: "calc(100vh - 64px)" }}>

      {/* â"€â"€ Fixed top bar â"€â"€ */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={handleClose}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium shrink-0">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="hidden sm:block w-px h-4 bg-slate-200" />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate">Bulk Add Used Phones</h1>
            <p className="text-xs text-slate-400 truncate">
              {rows.length} phone{rows.length !== 1 ? "s" : ""}
              {completedCount > 0 && <span className="text-emerald-600"> - {completedCount} ready</span>}
              {saveProgress && <span className="text-indigo-600 font-medium"> - Saving {saveProgress.done}/{saveProgress.total}...</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
          <button onClick={toggleExpandAll}
            className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shrink-0">
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 sm:flex-none justify-center px-4 sm:px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center gap-2 shrink-0">
            {saving
              ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CheckCircle2 className="w-4 h-4" />}
            Save {rows.length} Phone{rows.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>

      {/* â"€â"€ Scrollable page body â"€â"€ */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4">

          {/* â"€â"€ Purchase Order Header card â"€â"€ */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Purchase Details</h2>
                <p className="text-xs text-slate-400 mt-0.5">{language === "ur" ? "کس سے اور کب خریدا" : "Who did you buy from and when"}</p>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">Step 1</span>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 sm:flex sm:items-end gap-3 sm:gap-4 sm:flex-wrap">

                {/* Source Type */}
                <div className="col-span-2 sm:col-auto">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Source <span className="text-rose-500">*</span></label>
                  <div className="flex gap-1.5">
                    {([
                      { val: "purchased",         label: "Supplier"   },
                      { val: "customer_trade_in", label: "Customer"   },
                      { val: "walk_in",           label: "Walk-in"    },
                    ] as { val: SourceType; label: string }[]).map(opt => (
                      <button key={opt.val} type="button"
                        onClick={() => { setSourceType(opt.val); setSupplierId(""); setSupplierErr(false); setWalkinName(""); setWalkinPhone(""); setWalkinCnic(""); setSelectedCustomerId(""); setSelectedCustomerName("") }}
                        className={cn(
                          "flex-1 sm:flex-initial px-3 h-9 rounded-lg text-xs font-semibold border transition-colors",
                          sourceType === opt.val
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"
                        )}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Supplier (when source = purchased) */}
                {sourceType === "purchased" && (
                  <div className="col-span-2 sm:col-auto sm:w-64">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Supplier <span className="text-rose-500">*</span></label>
                    <CatalogCombo
                      value={localSuppliers.find(s => s.id === supplierId)?.companyName ?? ""}
                      onChange={v => { const s = localSuppliers.find(x => x.companyName === v); setSupplierId(s?.id ?? ""); setSupplierErr(false) }}
                      options={localSuppliers.map(s => s.companyName)}
                      placeholder={suppliersLoading ? "Loading..." : "Select supplier..."}
                      error={supplierErr}
                      disabled={suppliersLoading}
                    />
                    {supplierErr && <p className="text-xs text-rose-500 mt-1">Supplier is required</p>}
                  </div>
                )}

                {/* Customer (when source = customer_trade_in) */}
                {sourceType === "customer_trade_in" && (
                  <div className="col-span-2 sm:col-auto sm:w-64">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Customer <span className="text-rose-500">*</span></label>
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
                  <div className="col-span-2 grid grid-cols-2 sm:flex sm:flex-wrap gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Seller Name <span className="text-rose-500">*</span></label>
                      <input value={walkinName} onChange={e => setWalkinName(e.target.value)}
                        placeholder="e.g. Muhammad Ali"
                        className="w-full h-9 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white sm:w-44" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone</label>
                      <input value={walkinPhone} onChange={e => setWalkinPhone(e.target.value)}
                        placeholder="03001234567"
                        className="w-full h-9 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white sm:w-36" />
                    </div>
                    <div className="col-span-2 sm:col-auto">
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">CNIC <span className="text-slate-400 font-normal">(optional)</span></label>
                      <input value={walkinCnic} onChange={e => setWalkinCnic(e.target.value.replace(/[^0-9-]/g, "").slice(0, 15))}
                        placeholder="42101-1234567-1"
                        className="w-full h-9 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white sm:w-40" />
                    </div>
                  </div>
                )}

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Purchase Date <span className="text-rose-500">*</span></label>
                  <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)}
                    className={cn(
                      "w-full h-9 border rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors bg-white",
                      !purchaseDate ? "border-rose-400 bg-rose-50" : "border-slate-300"
                    )} />
                </div>

                {/* Lock hint */}
                <div className="col-span-2 sm:col-auto text-[11px] text-slate-400 flex items-center gap-1.5 sm:pb-1">
                  <Lock className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>{language === "ur" ? <>لاک <Lock className="w-2.5 h-2.5 inline text-indigo-400" /> کریں کوئی بھی خانہ — اگلے فون میں خود کاپی ہو گا</> : <>Lock <Lock className="w-2.5 h-2.5 inline text-indigo-400" /> any field on a phone card to copy it to the next</>}</span>
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
                hasError ? "border-rose-400 ring-1 ring-rose-200" : isComplete ? "border-emerald-400" : "border-slate-200"
              )}>
                {/* Card header */}
                <div className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer select-none"
                  onClick={() => setRows(prev => prev.map(r => r.id === row.id ? { ...r, expanded: !r.expanded } : r))}>
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                    isComplete ? "bg-emerald-100 text-emerald-700" : hasError ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-500"
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
                      <span className={cn("text-[10px] font-semibold", rowProfit >= 0 ? "text-emerald-600" : "text-rose-500")}>
                        {rowProfit >= 0 ? "+" : ""}{formatCurrency(rowProfit)}
                      </span>
                    )}
                    {hasError && <span className="text-[10px] text-rose-500 font-medium">{row.rowError}</span>}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => duplicateRow(row.id)} title="Duplicate"
                      className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-md transition-colors">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeRow(row.id)} disabled={rows.length === 1}
                      className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-20">
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
                    <div className="px-3 sm:px-4 pt-4 pb-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Device Info</p>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">

                        {/* Brand - full width on mobile */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Brand <span className="text-rose-500">*</span>
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

                        {/* Model - full width on mobile, most important field */}
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                            Model <span className="text-rose-500">*</span>
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

                        {/* Color / Storage / RAM - paired 2-up on mobile, equal thirds on desktop */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 sm:col-span-7 gap-3">
                          <div>
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

                          <div>
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

                          {/* RAM (android) or Battery % (apple) */}
                          <div className="col-span-2 sm:col-span-1">
                            {isApple ? (
                              <>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Battery %</label>
                                <div className="relative">
                                  <input type="number" onWheel={e => e.currentTarget.blur()} value={row.battery_health}
                                    onChange={e => updateRow(row.id, "battery_health", e.target.value)}
                                    placeholder="91" min="1" max="100"
                                    className="w-full h-9 border border-slate-300 rounded-lg px-2.5 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400 transition-colors" />
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
                    </div>

                    {/* â"€â"€ Divider â"€â"€ */}
                    <div className="border-t border-dashed border-slate-100" />

                    {/* â"€â"€ Row 2: IMEI - Battery% (android only) - Grade - Screen - Body â"€â"€ */}
                    <div className="px-3 sm:px-4 pt-3 pb-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Condition</p>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">

                        {/* IMEI - full width */}
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">IMEI <span className="text-rose-500">*</span></label>
                          <div className="relative">
                            <input value={row.imei_number}
                              onChange={e => updateRow(row.id, "imei_number", e.target.value.replace(/\D/g, "").slice(0, 15))}
                              placeholder="15-digit IMEI" maxLength={15}
                              className={cn(
                                "w-full h-9 border rounded-lg px-2.5 pr-8 text-sm font-mono focus:outline-none focus:ring-2 transition-colors",
                                row.imei_number.length === 15 ? "border-emerald-400 bg-emerald-50 focus:ring-emerald-400"
                                : row.imei_number.length > 0 ? "border-amber-400 focus:ring-amber-400"
                                : hasError ? "border-rose-400 bg-rose-50 focus:ring-rose-400" : "border-slate-300 focus:ring-indigo-500"
                              )} />
                            {row.imei_number.length > 0 && row.imei_number.length < 15 && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-amber-500 font-bold pointer-events-none">{15 - row.imei_number.length}</span>
                            )}
                            {row.imei_number.length === 15 && <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500" />}
                          </div>
                        </div>

                        {/* Grade - 2 rows of 3 so each pill stays comfortably tappable */}
                        <div className="sm:col-span-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <button type="button" onClick={() => toggleLock("condition_grade")}
                              title={locks.condition_grade ? "Locked" : "Click to lock grade"}
                              className={cn("flex items-center justify-center w-5 h-5 rounded-md border transition-colors shrink-0",
                                locks.condition_grade ? "bg-indigo-100 border-indigo-400 text-indigo-600" : "border-slate-300 text-slate-300 hover:border-indigo-300 hover:text-indigo-400")}>
                              {locks.condition_grade ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            </button>
                            <label className="text-xs font-semibold text-slate-600">Grade</label>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(["A+","A","B+","B","C","D"] as ConditionGrade[]).map(g => {
                              const m = GRADE_META[g]
                              return (
                                <button key={g} type="button" onClick={() => updateRow(row.id, "condition_grade", g)}
                                  className={cn(
                                    "h-9 rounded-lg text-xs font-bold border-2 transition-all",
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

                        {/* Screen + Body - paired on mobile */}
                        <div className="grid grid-cols-2 gap-3 sm:col-span-4 sm:grid-cols-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <button type="button" onClick={() => toggleLock("screen_condition")}
                                title={locks.screen_condition ? "Locked" : "Click to lock"}
                                className={cn("flex items-center justify-center w-5 h-5 rounded-md border transition-colors shrink-0",
                                  locks.screen_condition ? "bg-indigo-100 border-indigo-400 text-indigo-600" : "border-slate-300 text-slate-300 hover:border-indigo-300 hover:text-indigo-400")}>
                                {locks.screen_condition ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </button>
                              <label className="text-xs font-semibold text-slate-600">Screen</label>
                            </div>
                            <select value={row.screen_condition} onChange={e => updateRow(row.id, "screen_condition", e.target.value as ScreenCondition)}
                              className={cn("w-full h-9 border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-colors",
                                locks.screen_condition ? "border-indigo-400 bg-indigo-50" : "border-slate-300")}>
                              <option value="perfect">Perfect</option>
                              <option value="minor_scratches">Scratches</option>
                              <option value="cracked">Cracked</option>
                              <option value="replaced">Replaced</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <button type="button" onClick={() => toggleLock("body_condition")}
                                title={locks.body_condition ? "Locked" : "Click to lock"}
                                className={cn("flex items-center justify-center w-5 h-5 rounded-md border transition-colors shrink-0",
                                  locks.body_condition ? "bg-indigo-100 border-indigo-400 text-indigo-600" : "border-slate-300 text-slate-300 hover:border-indigo-300 hover:text-indigo-400")}>
                                {locks.body_condition ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </button>
                              <label className="text-xs font-semibold text-slate-600">Body</label>
                            </div>
                            <select value={row.body_condition} onChange={e => updateRow(row.id, "body_condition", e.target.value as BodyCondition)}
                              className={cn("w-full h-9 border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-colors",
                                locks.body_condition ? "border-indigo-400 bg-indigo-50" : "border-slate-300")}>
                              <option value="perfect">Perfect</option>
                              <option value="minor_wear">Minor Wear</option>
                              <option value="dents">Dents</option>
                              <option value="heavy_damage">Heavy</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* â"€â"€ Divider â"€â"€ */}
                    <div className="border-t border-dashed border-slate-100" />

                    {/* â"€â"€ Row 3: Pricing - BUY - SELL - Warranty - PTA - Notes â"€â"€ */}
                    <div className="px-3 sm:px-4 pt-3 pb-4">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Pricing</p>
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">

                        {/* Buy Price + Sell Price - paired on mobile, natural pair */}
                        <div className="grid grid-cols-2 gap-3 sm:col-span-4 sm:grid-cols-2">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <button type="button" onClick={() => toggleLock("purchase_price")}
                                title={locks.purchase_price ? "Locked" : "Click to lock buy price"}
                                className={cn("flex items-center justify-center w-5 h-5 rounded-md border transition-colors shrink-0",
                                  locks.purchase_price ? "bg-indigo-100 border-indigo-400 text-indigo-600" : "border-slate-300 text-slate-300 hover:border-indigo-300 hover:text-indigo-400")}>
                                {locks.purchase_price ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </button>
                              <label className="text-xs font-semibold text-slate-600">Buy Price <span className="text-rose-500">*</span></label>
                            </div>
                            <MoneyInput value={row.purchase_price}
                              onChange={v => updateRow(row.id, "purchase_price", v)}
                              placeholder="0" min="0"
                              className={cn("w-full h-9 border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 bg-white placeholder:text-slate-400 transition-colors",
                                (!row.purchase_price || Number(row.purchase_price) <= 0) && hasError
                                  ? "border-rose-400 bg-rose-50 focus:ring-rose-400"
                                  : locks.purchase_price ? "border-indigo-400 bg-indigo-50 focus:ring-indigo-500" : "border-slate-300 focus:ring-indigo-500")} />
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <button type="button" onClick={() => toggleLock("selling_price")}
                                title={locks.selling_price ? "Locked" : "Click to lock sell price"}
                                className={cn("flex items-center justify-center w-5 h-5 rounded-md border transition-colors shrink-0",
                                  locks.selling_price ? "bg-indigo-100 border-indigo-400 text-indigo-600" : "border-slate-300 text-slate-300 hover:border-indigo-300 hover:text-indigo-400")}>
                                {locks.selling_price ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </button>
                              <label className="text-xs font-semibold text-slate-600">Sell Price <span className="text-rose-500">*</span></label>
                            </div>
                            <MoneyInput value={row.selling_price}
                              onChange={v => updateRow(row.id, "selling_price", v)}
                              placeholder="0" min="0"
                              className={cn("w-full h-9 border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 bg-white placeholder:text-slate-400 transition-colors",
                                (!row.selling_price || Number(row.selling_price) <= 0) && hasError
                                  ? "border-rose-400 bg-rose-50 focus:ring-rose-400"
                                  : locks.selling_price ? "border-indigo-400 bg-indigo-50 focus:ring-indigo-500" : "border-slate-300 focus:ring-indigo-500")} />
                          </div>
                        </div>

                        {/* Margin - full width on mobile when shown */}
                        {Number(row.purchase_price) > 0 && Number(row.selling_price) > 0 && (
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Margin</label>
                            <div className={cn("h-9 flex items-center px-3 rounded-lg text-sm font-bold border",
                              rowProfit >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200")}>
                              {rowProfit >= 0 ? "+" : ""}{formatCurrency(rowProfit)}
                              <span className={cn("ml-1.5 text-xs font-medium",
                                rowProfit >= 0 ? "text-emerald-500" : "text-rose-400")}>
                                ({Number(row.selling_price) > 0 ? Math.round((rowProfit / Number(row.selling_price)) * 100) : 0}%)
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Warranty + PTA - paired on mobile */}
                        <div className={cn("grid grid-cols-2 gap-3", Number(row.purchase_price) > 0 && Number(row.selling_price) > 0 ? "sm:col-span-3" : "sm:col-span-5")}>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <button type="button" onClick={() => toggleLock("warranty_days")}
                                title={locks.warranty_days ? "Locked" : "Click to lock warranty"}
                                className={cn("flex items-center justify-center w-5 h-5 rounded-md border transition-colors shrink-0",
                                  locks.warranty_days ? "bg-indigo-100 border-indigo-400 text-indigo-600" : "border-slate-300 text-slate-300 hover:border-indigo-300 hover:text-indigo-400")}>
                                {locks.warranty_days ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </button>
                              <label className="text-xs font-semibold text-slate-600">Warranty</label>
                            </div>
                            <select value={row.warranty_days} onChange={e => updateRow(row.id, "warranty_days", e.target.value)}
                              className={cn("w-full h-9 border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-colors",
                                locks.warranty_days ? "border-indigo-400 bg-indigo-50" : "border-slate-300")}>
                              <option value="0">No warranty</option>
                              <option value="3">3 days</option>
                              <option value="7">7 days</option>
                              <option value="14">14 days</option>
                              <option value="30">1 month</option>
                              <option value="90">3 months</option>
                            </select>
                          </div>

                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <button type="button" onClick={() => toggleLock("pta_status")}
                                title={locks.pta_status ? "Locked" : "Click to lock PTA"}
                                className={cn("flex items-center justify-center w-5 h-5 rounded-md border transition-colors shrink-0",
                                  locks.pta_status ? "bg-indigo-100 border-indigo-400 text-indigo-600" : "border-slate-300 text-slate-300 hover:border-indigo-300 hover:text-indigo-400")}>
                                {locks.pta_status ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              </button>
                              <label className="text-xs font-semibold text-slate-600">PTA</label>
                            </div>
                            <select value={row.pta_status} onChange={e => updateRow(row.id, "pta_status", e.target.value as UsedPTAStatus)}
                              className={cn("w-full h-9 border rounded-lg px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-colors",
                                locks.pta_status ? "border-indigo-400 bg-indigo-50" : "border-slate-300")}>
                              <option value="approved">PTA Approved</option>
                              <option value="non_pta">Non-PTA</option>
                              {row.brand.toLowerCase() === "apple" && <option value="jv">JV</option>}
                              {row.brand.toLowerCase() === "apple" && <option value="mdm">MDM</option>}
                              {row.brand.toLowerCase() !== "apple" && <option value="cpid_approved">CPID Approved</option>}
                            </select>
                          </div>
                        </div>

                        {/* Notes - full width */}
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                          <input value={row.condition_notes} onChange={e => updateRow(row.id, "condition_notes", e.target.value)}
                            placeholder="Accessories, issues, remarks..."
                            className="w-full h-9 border border-slate-300 rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400 transition-colors" />
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
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-semibold hover:bg-indigo-50 hover:border-indigo-400 transition-all">
            <Plus className="w-4 h-4" /> Add Another Phone
          </button>
          </div>{/* end phone cards */}

          {/* â"€â"€ Order Summary card - bottom of page â"€â"€ */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-800">Order Summary</h2>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  {sourceLabel ? (
                    <>Buying from <span className="font-semibold text-slate-600">{sourceLabel}</span></>
                  ) : (
                    "Total cost - payment - ledger entry"
                  )}
                </p>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md shrink-0">Step 3</span>
            </div>
            <div className="px-4 sm:px-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

                {/* Items breakdown */}
                <div className="sm:col-span-2 space-y-1">
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
                      <span className="hidden sm:inline text-xs text-slate-400 font-mono shrink-0">
                        {r.imei_number.length === 15 ? r.imei_number : '-'}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 shrink-0 w-20 sm:w-24 text-right">
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
                    {requiresFullPayment && (
                      <p className="text-[11px] text-slate-400 mb-2">
                        {sourceType === "walk_in" ? "Walk-in" : "Customer trade-in"} purchases must be paid in full - no partial/unpaid balance is tracked for these. Select one account, or split the total across several.
                      </p>
                    )}
                    <SplitPaymentPicker accounts={accounts} splits={splits} onChange={setSplits} targetAmount={grandTotal} />
                    {accountErr && <p className="text-xs text-rose-500 mt-1.5">Select a payment account and enter a valid amount to record this payment</p>}
                  </div>

                  {/* Totals */}
                  <div className="border-t border-slate-100 pt-4 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>{rows.length} phone{rows.length !== 1 ? "s" : ""} subtotal</span>
                      <span className="font-semibold text-slate-800">{formatCurrency(grandTotal)}</span>
                    </div>
                    {splitTotal(splits) > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>Amount paid</span>
                        <span className="text-emerald-600 font-semibold">- {formatCurrency(splitTotal(splits))}</span>
                      </div>
                    )}
                    <div className={cn(
                      "flex justify-between font-bold pt-2 border-t border-slate-200 text-base",
                      Math.max(0, grandTotal - splitTotal(splits)) === 0 && grandTotal > 0
                        ? "text-emerald-600" : "text-slate-800"
                    )}>
                      <span>Balance Due</span>
                      <span>{formatCurrency(Math.max(0, grandTotal - splitTotal(splits)))}</span>
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

                  {splitTotal(splits) >= grandTotal && grandTotal > 0 && (
                    <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Fully paid
                    </div>
                  )}

                  <button onClick={handleSave} disabled={saving}
                    className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
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

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard unsaved phones?"
        description="You have unsaved phone details on this screen. Leaving now will discard them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="destructive"
        onConfirm={() => { setConfirmDiscard(false); onClose() }}
      />

      <ConfirmDialog
        open={!!confirmReactivate}
        onOpenChange={(open) => { if (!open) setConfirmReactivate(null) }}
        title="Reactivate previously sold phones?"
        description={
          confirmReactivate
            ? `${confirmReactivate.soldPhones.length} phone(s) were previously in your system as sold: ${confirmReactivate.soldPhones.map((e: any) => `${e.imei_number} (${e.brand} ${e.model}, sold ${e.sold_date ?? "previously"})`).join(", ")}. Reactivate and update with new purchase details?`
            : ""
        }
        confirmLabel="Reactivate"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (!confirmReactivate) return
          const { soldPhones, tenantId, supplierName } = confirmReactivate
          setConfirmReactivate(null)
          proceedSave(tenantId, supplierName, soldPhones)
        }}
      />
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
}

const STEPS = ["Basic Info", "Condition", "Pricing", "Photos", "Review"]

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function AddEditDialog({ editPhone, onClose, onSave, brands, colors, storageOptions, ramOptions, suppliers, customers, accounts, onAddBrand, onAddColor, onAddStorage, onAddRam }: {
  editPhone: UsedPhone | null
  onClose: () => void
  onSave: (data: Partial<UsedPhone> & { _paymentSplits?: SplitEntry[] }) => void
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

  const [submitting, setSubmitting] = useState(false)
  const [accountErr, setAccountErr] = useState(false)
  const [splits, setSplits] = useState<SplitEntry[]>([])
  const set = (key: keyof FormData, val: any) => setForm(prev => ({ ...prev, [key]: val }))

  // Default the payment account to the shop's cash account once accounts load,
  // so the common case (paying cash) doesn't require an extra manual selection.
  useEffect(() => {
    if (editPhone || splits.length > 0 || accounts.length === 0) return
    const cashAccount = accounts.find(a => a.isDefaultCash) ?? accounts.find(a => a.type === "cash")
    if (cashAccount) setSplits([{ accountId: cashAccount.id, amount: "" }])
  }, [accounts])
  const toggleCheck = (key: "functional_issues" | "accessories_included", id: string) => {
    setForm(prev => {
      const arr = prev[key]
      return { ...prev, [key]: arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id] }
    })
  }

  // Walk-in / trade-in purchases must be paid in full. When exactly one
  // account is selected, auto-fill its amount to the purchase price so the
  // common case (single account) needs no manual typing; with multiple
  // accounts selected the user splits the total across them manually.
  const requiresFullPayment = !editPhone && form.source_type !== "purchased"
  useEffect(() => {
    if (!requiresFullPayment || splits.length !== 1) return
    const only = splits[0]
    const filled = form.purchase_price || ""
    if (only.amount !== filled) setSplits([{ ...only, amount: filled }])
  }, [requiresFullPayment, form.purchase_price, splits])

  const validateStep = () => {
    setAccountErr(false)
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
    // Not step-specific: catches the case even if Submit is clicked from a later step
    const insufficient = splitInsufficientMap(splits, accounts)
    if (Object.keys(insufficient).length > 0) {
      setAccountErr(true)
      return "One or more accounts don't have enough balance for the amount entered"
    }
    // Walk-in / trade-in purchases have no supplier ledger to track a debt
    // against, so they must be paid in full at the time of purchase.
    if (!editPhone && form.source_type !== "purchased") {
      const total = (Number(form.purchase_price) || 0)
      if (splitTotal(splits) < total) {
        return `${form.source_type === "walk_in" ? "Walk-in" : "Customer trade-in"} purchases must be paid in full`
      }
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

  const handleSubmit = async () => {
    if (submitting) return
    const err = validateStep()
    if (err) { toast.error(err); return }
    // Resolve source fields based on type
    const isExistingCustomer = form.source_type === "customer_trade_in"
    const isWalkIn           = form.source_type === "walk_in"
    const isSupplier         = form.source_type === "purchased"

    setSubmitting(true)
    try {
      await onSave({
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
        _paymentSplits: splits.filter(e => (parseFloat(e.amount) || 0) > 0),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const totalCost = (Number(form.purchase_price) || 0) + (Number(form.refurbishment_cost) || 0)
  const profit    = (Number(form.selling_price) || 0) - totalCost
  const margin    = form.selling_price && Number(form.selling_price) > 0
    ? ((profit / Number(form.selling_price)) * 100).toFixed(0)
    : "0"

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
  const selectCls = inputCls

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl h-[95dvh] sm:h-auto sm:max-h-[90dvh] flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">{editPhone ? "Edit Used Phone" : "Add Used Phone"}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><X className="w-4 h-4" /></button>
          </div>

          {/* Step indicators — compact progress bar on mobile, full pill row from sm: up */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-100 flex-shrink-0">
            {/* Mobile: progress bar + current step label */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-indigo-700">Step {step + 1} of {STEPS.length} · {STEPS[step]}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
            </div>

            {/* sm and up: full pill row with labels */}
            <div className="hidden sm:flex items-center gap-1">
              {STEPS.map((s, i) => (
                <React.Fragment key={s}>
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all whitespace-nowrap",
                    i === step ? "bg-indigo-100 text-indigo-700" :
                    i < step  ? "bg-emerald-100 text-emerald-700" :
                    "text-slate-400"
                  )}>
                    <span className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0",
                      i === step ? "bg-indigo-600 text-white" :
                      i < step  ? "bg-emerald-500 text-white" :
                      "bg-slate-200"
                    )}>
                      {i < step ? <span>&#10003;</span> : i + 1}
                    </span>
                    <span>{s}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-200 min-w-2" />}
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
                          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium mt-1">
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
                          className="h-9 px-3 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
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
                          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium mt-1">
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
                          className="h-9 px-3 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
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
                          className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium mt-1">
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
                          className="h-9 px-3 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50"
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">Where did this phone come from?<span className="text-rose-500 ml-0.5">*</span></label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {([
                      { type: "walk_in"           as SourceType, label: "Walk-in Seller", icon: "🚶", desc: "Person off the street" },
                      { type: "customer_trade_in" as SourceType, label: "Our Customer",   icon: "🤝", desc: "Existing customer" },
                      { type: "purchased"         as SourceType, label: "Supplier",       icon: "🏪", desc: "Wholesaler / dealer" },
                    ]).map(opt => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => set("source_type", opt.type)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all",
                          form.source_type === opt.type
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
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
                          <label className="block text-xs font-medium text-slate-600 mb-1">Full Name <span className="text-rose-500">*</span></label>
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
                          <div className="flex items-center gap-2 mt-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
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
                    <MoneyInput value={form.purchase_price} onChange={v => set("purchase_price", v)} placeholder="0" min={0} className={inputCls} />
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
                        form.functional_issues.includes(fi.id) ? "bg-rose-50 border-rose-300 text-rose-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}>
                        <input
                          type="checkbox"
                          checked={form.functional_issues.includes(fi.id)}
                          onChange={() => toggleCheck("functional_issues", fi.id)}
                          className="w-3.5 h-3.5 accent-rose-600"
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
                        form.accessories_included.includes(acc.id) ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}>
                        <input
                          type="checkbox"
                          checked={form.accessories_included.includes(acc.id)}
                          onChange={() => toggleCheck("accessories_included", acc.id)}
                          className="w-3.5 h-3.5 accent-indigo-600"
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
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </Field>
              </div>
            )}

            {/* Step 3: Pricing */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Refurbishment Cost (Rs)">
                    <MoneyInput value={form.refurbishment_cost} onChange={v => set("refurbishment_cost", v)} placeholder="0" min={0} className={inputCls} />
                  </Field>
                  <Field label="Selling Price (Rs)" required>
                    <MoneyInput value={form.selling_price} onChange={v => set("selling_price", v)} placeholder="0" min={0} className={inputCls} />
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
                  <div className={cn("rounded-xl p-3", profit >= 0 ? "bg-emerald-50" : "bg-rose-50")}>
                    <p className="text-xs text-slate-400">Profit</p>
                    <p className={cn("text-sm font-bold", profit >= 0 ? "text-emerald-700" : "text-rose-700")}>
                      {profit >= 0 ? "+" : ""}{formatCurrency(profit)} ({margin}%)
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="PTA Status">
                    <select value={form.pta_status} onChange={e => set("pta_status", e.target.value as UsedPTAStatus)} className={selectCls}>
                      <option value="approved">PTA Approved</option>
                      <option value="non_pta">Non-PTA</option>
                      {form.brand.toLowerCase() === "apple" && <option value="jv">JV</option>}
                      {form.brand.toLowerCase() === "apple" && <option value="mdm">MDM</option>}
                      {form.brand.toLowerCase() !== "apple" && <option value="cpid_approved">CPID Approved</option>}
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
                    {requiresFullPayment && (
                      <p className="text-[11px] text-slate-400">
                        {form.source_type === "walk_in" ? "Walk-in" : "Customer trade-in"} purchases must be paid in full. Select one account, or split the total across several.
                      </p>
                    )}
                    <SplitPaymentPicker accounts={accounts} splits={splits} onChange={setSplits} targetAmount={Number(form.purchase_price) || undefined} />
                    {accountErr && (
                      <p className="text-xs text-rose-500 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5" /> Select a payment account and enter a valid amount to record this payment
                      </p>
                    )}
                    {splitTotal(splits) > 0 && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Rs{splitTotal(splits).toLocaleString()} will be deducted from your account(s) on save
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
                  className="w-full border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center gap-3 text-slate-400 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-500 transition-all"
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
                          className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-rose-500 hover:bg-white transition-colors"
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
                <div className={cn("rounded-xl p-4 border-2", profit >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")}>
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
                      <p className={cn("text-base font-bold", profit >= 0 ? "text-emerald-700" : "text-rose-700")}>
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
                className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-indigo-600 text-white text-xs sm:text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-600 text-white text-xs sm:text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {submitting ? "Saving..." : editPhone ? "Save" : "Add"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// --Ã¢"â‚¬ Main Page ----------------------------------------------------------------

function UsedPhonesPageInner() {
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

  const handleSave = async (data: Partial<UsedPhone> & { _paymentSplits?: SplitEntry[] }) => {
    const { _paymentSplits, ...phoneData } = data
    const activeSplits = (_paymentSplits ?? []).filter(e => (parseFloat(e.amount) || 0) > 0)
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

        // Record purchase in purchases table so it shows up on the main
        // Purchases list, same as Bulk Add - one PO per phone here.
        try {
          const tenantId = await getTenantId()
          const purchaseDate = phoneData.purchased_date ?? todayPKT()
          const sourceType = phoneData.source_type ?? "walk_in"
          const purchasePrice = phoneData.purchase_price ?? 0
          const paid = splitTotal(activeSplits)
          const balanceDue = Math.max(0, purchasePrice - paid)
          const payStatus = paid <= 0 ? "Unpaid" : paid >= purchasePrice ? "Paid" : "Partial"
          const firstAccount = activeSplits[0] ? financeAccounts.find(a => a.id === activeSplits[0].accountId) : undefined
          const supplierId = (phoneData as any).supplier_id as string | undefined
          const sourceLabel =
            sourceType === "purchased" ? ((phoneData as any).supplier_name || "") :
            sourceType === "walk_in" ? `Walk-in: ${phoneData.source_customer_name ?? ""}` :
            `Customer: ${phoneData.source_customer_name ?? ""}`

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

          const { data: purchaseRecord, error: purchaseErr } = await supabase.from("purchases").insert({
            tenant_id: tenantId,
            po_number: poNumber,
            date: purchaseDate,
            supplier_id: sourceType === "purchased" ? (supplierId || null) : null,
            supplier_name: sourceLabel,
            subtotal: purchasePrice,
            shipping_cost: 0,
            tax: 0,
            total: purchasePrice,
            amount_paid: paid,
            balance_due: balanceDue,
            payment_status: payStatus,
            delivery_status: "Received",
            payment_method: firstAccount
              ? (firstAccount.type === "cash" ? "Cash" : firstAccount.type === "bank" ? "Bank Transfer" : firstAccount.bankName || "Mobile Wallet")
              : activeSplits.length > 1 ? "Split Payment" : "Cash",
            account_id: activeSplits[0]?.accountId || null,
            notes: null,
          }).select("id").single()
          if (purchaseErr) throw new Error(purchaseErr.message)

          if (purchaseRecord) {
            const { error: itemErr } = await supabase.from("purchase_items").insert({
              tenant_id: tenantId,
              purchase_id: (purchaseRecord as any).id,
              product_id: created.id,
              product_name: `${phoneData.brand ?? ""} ${phoneData.model ?? ""}`.trim(),
              product_type: "UsedPhone",
              quantity: 1,
              returned_qty: 0,
              unit_cost: purchasePrice,
              total: purchasePrice,
              imeis: [phoneData.imei_number ?? ""],
            })
            if (itemErr) throw new Error(itemErr.message)
          }

          // Deduct from each selected finance account for its share of the payment
          if (activeSplits.length > 0) {
            for (const se of activeSplits) {
              const amt = parseFloat(se.amount) || 0
              if (amt <= 0) continue
              await supabase.from("finance_transactions").insert({
                tenant_id: tenantId, date: purchaseDate, type: "purchase_payment",
                account_id: se.accountId, amount: amt,
                reference_type: "Purchase", reference_number: poNumber,
                description: `Used phone purchase ${poNumber} - ${sourceLabel}`,
              })
              const { data: accRow } = await supabase.from("finance_accounts").select("current_balance").eq("id", se.accountId).single()
              if (accRow) {
                await supabase.from("finance_accounts").update({
                  current_balance: (accRow as any).current_balance - amt,
                }).eq("id", se.accountId)
              }
            }
            // Refresh finance accounts list so balances stay current
            getFinanceAccounts().then(setFinanceAccounts).catch(() => {})
          }
          // Update supplier outstanding balance if partial/unpaid - supplier purchases only
          if (sourceType === "purchased" && balanceDue > 0 && supplierId) {
            const { data: supRow } = await supabase.from("suppliers").select("outstanding_balance").eq("id", supplierId).single()
            if (supRow) {
              await supabase.from("suppliers").update({
                outstanding_balance: ((supRow as any).outstanding_balance ?? 0) + balanceDue,
              }).eq("id", supplierId)
            }
          }
        } catch (purchaseRecordErr) {
          toast.error(`Phone saved but purchase record failed: ${purchaseRecordErr instanceof Error ? purchaseRecordErr.message : "Unknown error"}`)
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
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Phone(s)
          </button>
        </div>
      </div>

      {/* Stats — core KPIs, same grid pattern as the rest of the app (no horizontal scroll) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard
          title="Total Devices"
          value={String(stats.total)}
          icon={Smartphone}
          iconBg="bg-indigo-100"
          subtext={`${phones.filter(p => p.status === "in_stock").length} in stock`}
        />
        <StatCard
          title="Invested"
          value={formatCurrency(stats.totalInvested)}
          icon={DollarSign}
          iconBg="bg-slate-100"
          subtext="purchase + refurb"
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(stats.revenueSold)}
          icon={TrendingUp}
          iconBg="bg-cyan-100"
          subtext={`${phones.filter(p => p.status === "sold").length} sold`}
        />
        <StatCard
          title="Profit"
          value={`${stats.profitSold >= 0 ? "+" : ""}${formatCurrency(stats.profitSold)}`}
          icon={ArrowUpRight}
          iconBg="bg-emerald-100"
          subtext="completed sales"
        />
      </div>

      {/* Grade filter — 2 rows of 3 on mobile for breathing room, single row from sm: up */}
      <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 sm:gap-1.5 sm:overflow-x-auto sm:scrollbar-none">
        {(["A+","A","B+","B","C","D"] as ConditionGrade[]).map(g => {
          const m = GRADE_META[g]
          const count = stats.gradeCount[g]
          const active = gradeFilter === g
          return (
            <button
              key={g}
              onClick={() => { setGradeFilter(active ? "" : g); resetPage() }}
              className={cn(
                "flex items-center justify-center gap-1.5 sm:justify-start sm:shrink-0 rounded-full border py-1.5 sm:py-1 pl-1 pr-2.5 text-xs font-medium transition-all",
                active ? cn(m.bg, m.text, m.border, "ring-1", m.ring) : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold", m.bg, m.text)}>
                {g}
              </span>
              {count}
            </button>
          )
        })}
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
              className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-medium transition-colors",
              showFilters || hasFilters
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
            {hasFilters && (
              <span className="bg-indigo-600 text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                !
              </span>
            )}
          </button>
          {/* View toggle - list view needs table width, so only offer it from sm up; phones always get cards */}
          <div className="hidden sm:flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50")}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50")}
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
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All PTA</option>
                <option value="approved">PTA Approved</option>
                <option value="non_pta">Non-PTA</option>
                <option value="jv">JV (iPhone only)</option>
                <option value="mdm">MDM (iPhone only)</option>
                <option value="cpid_approved">CPID Approved (Android only)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Min Price (Rs)</label>
              <MoneyInput value={minPrice} onChange={v => { setMinPrice(v); resetPage() }} placeholder="0" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Max Price (Rs)</label>
              <MoneyInput value={maxPrice} onChange={v => { setMaxPrice(v); resetPage() }} placeholder="Any" className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Min Battery %</label>
              <input type="number" onWheel={e => e.currentTarget.blur()} value={minBattery} onChange={e => { setMinBattery(e.target.value); resetPage() }} placeholder="0" min={0} max={100} className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {hasFilters && (
              <div className="flex items-end">
                <button onClick={clearFilters} className="w-full py-2 text-sm font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors">
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
            <button onClick={clearFilters} className="text-indigo-600 hover:underline font-medium">Clear filters</button>
          )}
        </div>
      </div>

      {/* Grid / List view */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No phones found</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or add a new phone.</p>
          <button onClick={clearFilters} className="mt-4 text-indigo-600 text-sm hover:underline">Clear filters</button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
          {paginated.map(phone => (
            <PhoneCard key={phone.id} phone={phone} onView={handleView} onEdit={handleEdit} onSell={handleSell} />
          ))}
        </div>
      ) : (
        <>
          {/* List view needs table width - phones always get cards regardless of the saved view mode */}
          <div className="sm:hidden grid grid-cols-2 gap-3">
            {paginated.map(phone => (
              <PhoneCard key={phone.id} phone={phone} onView={handleView} onEdit={handleEdit} onSell={handleSell} />
            ))}
          </div>
          <div className="hidden sm:block bg-white rounded-xl border border-slate-200 overflow-hidden">
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
        </>
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
                    pg === page ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
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


export default function UsedPhonesPage() {
  return (
    <PermissionGate permission="inventory.view">
      <UsedPhonesPageInner />
    </PermissionGate>
  )
}


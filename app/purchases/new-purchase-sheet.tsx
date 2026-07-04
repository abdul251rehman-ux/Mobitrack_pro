﻿"use client"

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react"
import {
  Plus, Trash2, Search, Package, Smartphone, Building2, ShoppingCart, ShoppingBag,
  Headphones, Check, Banknote, Wallet, Landmark, CreditCard,
  AlertCircle, ChevronDown, ChevronRight, Battery, Copy, X as XIcon,
  Image as ImageIcon, Fingerprint, Settings2, Pencil, ExternalLink,
  Lock, Unlock,
} from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { getSuppliers } from "@/lib/api/suppliers"
import { createPurchase } from "@/lib/api/purchases"
import { getFinanceAccounts } from "@/lib/api/finance"
import type { Supplier } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, cn, todayPKT } from "@/lib/utils"

// â"€â"€â"€ Types â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface CatalogAccessory {
  id: string; name: string; brand: string; category: string; sku: string; imageUrl: string | null
}

interface MobileUnit {
  imei: string
  batteryHealth: string
  color: string
  imeiError?: string   // "duplicate_db" | "duplicate_local" | undefined
  imeiChecking?: boolean
  soldLocked?: boolean  // true = this unit already sold, cannot edit
}

interface MobileRow {
  uid: string
  brand: string
  model: string
  storage: string
  ram: string
  category: string
  deviceType: "android" | "iphone"
  condition: string
  buyPrice: string
  sellPrice: string
  qty: string
  units: MobileUnit[]
  expanded: boolean
  imageFile: File | null
  imagePreview: string | null
  rowError?: string
}

interface AccessoryItem {
  uid: string; catalogId: string; name: string; brand: string
  category: string; sku: string; buyPrice: string; sellPrice: string; qty: string
}

interface SplitEntry { accountId: string; amount: string }

function mkUid() { return `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
function makeUnit(color = ""): MobileUnit { return { imei: "", batteryHealth: "", color } }

const IPHONE_CATEGORIES = ["PTA Approved", "Non-PTA", "JV"]
const ANDROID_CATEGORIES = ["PTA Approved", "Non-PTA"]

function getCategories(
  deviceType: "android" | "iphone",
  extraIphone: string[] = [],
  extraAndroid: string[] = [],
) {
  if (deviceType === "iphone") return Array.from(new Set([...IPHONE_CATEGORIES, ...extraIphone]))
  return Array.from(new Set([...ANDROID_CATEGORIES, ...extraAndroid]))
}

function resizeUnits(units: MobileUnit[], n: number): MobileUnit[] {
  if (n <= 0) return [makeUnit()]
  if (n > units.length) {
    const lastColor = units[units.length - 1]?.color ?? ""
    return [...units, ...Array.from({ length: n - units.length }, () => makeUnit(lastColor))]
  }
  return units.slice(0, n)
}

function makeMobileRow(): MobileRow {
  return {
    uid: mkUid(), brand: "", model: "", storage: "", ram: "",
    category: "PTA Approved", deviceType: "android", condition: "New",
    buyPrice: "", sellPrice: "", qty: "1", units: [makeUnit()],
    expanded: true, imageFile: null, imagePreview: null,
  }
}

// â"€â"€â"€ Lock state (shared across phone cards - locks a field so next card inherits it) â"€â"€â"€

type PhoneLockState = {
  brand: boolean; storage: boolean; ram: boolean
  category: boolean; condition: boolean; buyPrice: boolean; sellPrice: boolean
}

function PurchaseLockBtn({
  locked, onToggle, label,
}: { locked: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={locked ? `${label} locked - next card copies this value. Click to unlock.` : `Click to lock ${label} - next card will inherit it`}
      className={cn(
        "inline-flex items-center justify-center w-3.5 h-3.5 rounded border transition-all shrink-0",
        locked
          ? "text-violet-600 bg-violet-100 border-violet-400 hover:bg-violet-200"
          : "text-slate-400 bg-white border-slate-300 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50"
      )}
    >
      {locked ? <Lock className="w-2 h-2" /> : <Unlock className="w-2 h-2" />}
    </button>
  )
}

// â"€â"€â"€ Step indicator â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function StepDot({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all",
        done  ? "bg-white/30 border-white/50 text-white"
              : active ? "bg-white border-white text-violet-600"
              : "bg-white/10 border-white/20 text-white/40"
      )}>
        {done ? <Check className="w-3 h-3" /> : n}
      </div>
      <span className={cn("text-[9px] font-medium hidden sm:block", active || done ? "text-white/80" : "text-white/30")}>{label}</span>
    </div>
  )
}

// â"€â"€â"€ Field wrapper â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  )
}

// â"€â"€â"€ Select wrapper â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function Sel({ value, onChange, children, className, error }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string; error?: boolean }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        "w-full h-7 rounded-md border bg-white px-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-400 transition-colors appearance-none",
        error ? "border-red-400 bg-red-50" : "border-slate-200 hover:border-slate-300",
        className
      )}
    >
      {children}
    </select>
  )
}

// â"€â"€â"€ CreatableCombobox â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Type to search, Enter / "+ Add" to create inline and persist to DB

function CreatableCombobox({
  value, onChange, options, onAdd, placeholder, className, error,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  onAdd?: (v: string) => Promise<void>
  placeholder?: string
  className?: string
  error?: boolean
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = query.trim().toLowerCase()
  const unique = Array.from(new Set(options.map(o => o.trim()).filter(Boolean)))
  const filtered = q ? unique.filter(o => o.toLowerCase().includes(q)) : unique
  const exactMatch = unique.some(o => o.toLowerCase() === q)
  const canCreate = !!onAdd && q.length > 0 && !exactMatch

  async function handleAdd() {
    if (!onAdd || !query.trim() || adding) return
    setAdding(true)
    try {
      await onAdd(query.trim())
      onChange(query.trim())
      setQuery("")
      setOpen(false)
    } catch {
      toast.error("Failed to add")
    } finally {
      setAdding(false)
    }
  }

  function handleSelect(opt: string) {
    onChange(opt)
    setQuery("")
    setOpen(false)
    inputRef.current?.blur()
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onChange("")
    setQuery("")
    setOpen(false)
  }

  return (
    <div className={cn("relative", className)}>
      <div className={cn(
        "flex items-center h-7 rounded-md border bg-white px-2 gap-1 transition-colors focus-within:ring-1 focus-within:ring-violet-400",
        error ? "border-red-400 bg-red-50" : value ? "border-violet-300 bg-violet-50/30" : "border-slate-200",
      )}>
        <input
          ref={inputRef}
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(""); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); if (filtered[0]) handleSelect(filtered[0]); else if (canCreate) handleAdd() }
            if (e.key === "Escape") { setOpen(false); setQuery("") }
          }}
          placeholder={open ? (value || placeholder || "Type or select...") : (placeholder || "Type or select...")}
          className="flex-1 text-xs bg-transparent outline-none min-w-0 text-slate-800 font-medium placeholder:text-slate-400"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
        {value && !open && (
          <button type="button" onMouseDown={handleClear} className="text-slate-300 hover:text-red-400 shrink-0">
            <XIcon className="w-3 h-3" />
          </button>
        )}
        <ChevronDown
          className={cn("w-3 h-3 text-slate-400 shrink-0 transition-transform cursor-pointer", open && "rotate-180")}
          onMouseDown={e => {
            e.preventDefault()
            if (open) { setOpen(false); setQuery(""); inputRef.current?.blur() }
            else { setOpen(true); setQuery(""); inputRef.current?.focus() }
          }}
        />
      </div>

      {open && (
        <div className="absolute z-[9999] mt-0.5 w-full min-w-[140px] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 && !canCreate && (
              <div className="px-3 py-2 text-[10px] text-slate-400 text-center">No options</div>
            )}
            {filtered.map((opt, i) => (
              <button
                key={`${opt}-${i}`}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(opt) }}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 text-xs hover:bg-violet-50 flex items-center gap-2 transition-colors",
                  opt === value && "bg-violet-50 text-violet-700 font-semibold"
                )}
              >
                {opt === value && <Check className="w-3 h-3 text-violet-600 shrink-0" />}
                <span className="truncate">{opt}</span>
              </button>
            ))}
          </div>
          {canCreate && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); handleAdd() }}
              disabled={adding}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-violet-600 font-semibold bg-violet-50 hover:bg-violet-100 border-t border-violet-100 transition-colors"
            >
              <Plus className="w-3 h-3" />
              {adding ? "Adding..." : `Add "${query.trim()}"`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// â"€â"€â"€ QuickCat Popover â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Inline add/edit/delete for catalog items (brands, colors, storage, RAM)

function QuickCatPopover({
  label, items, onAdd, onEdit, onDelete, catalogHref,
}: {
  label: string
  items: string[]
  onAdd: (v: string) => Promise<void>
  onEdit: (oldVal: string, newVal: string) => Promise<void>
  onDelete: (v: string) => Promise<void>
  catalogHref: string
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [editingVal, setEditingVal] = useState<string | null>(null)
  const [editInput, setEditInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [deletingVal, setDeletingVal] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  async function handleAdd() {
    if (!input.trim() || saving) return
    setSaving(true)
    try { await onAdd(input.trim()); setInput("") }
    catch { /* toast handled in caller */ }
    finally { setSaving(false) }
  }

  async function handleEdit(oldVal: string) {
    if (!editInput.trim() || saving) return
    setSaving(true)
    try { await onEdit(oldVal, editInput.trim()); setEditingVal(null); setEditInput("") }
    catch { }
    finally { setSaving(false) }
  }

  async function handleDelete(val: string) {
    if (saving) return
    setSaving(true)
    try { await onDelete(val); setDeletingVal(null) }
    catch { }
    finally { setSaving(false) }
  }

  if (!open) {
    return (
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(true)}
        title={`Manage ${label}`}
        className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold text-violet-500 hover:text-white hover:bg-violet-500 border border-violet-200 hover:border-violet-500 transition-all leading-none"
      >
        <Plus className="w-2.5 h-2.5" />
        <span>Manage</span>
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      {/* Popover */}
      <div className="absolute z-50 left-0 top-5 w-52 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-violet-600">
          <span className="text-[10px] font-bold text-white">Manage {label}</span>
          <div className="flex items-center gap-1">
            <a href={catalogHref} target="_blank" rel="noreferrer"
              className="text-white/70 hover:text-white transition-colors" title="Open catalog page">
              <ExternalLink className="w-3 h-3" />
            </a>
            <button type="button" onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <XIcon className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Add new */}
        <div className="flex gap-1 p-2 border-b border-slate-100">
          <input
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd() }}
            placeholder={`Add ${label.toLowerCase()}...`}
            className="flex-1 h-6 text-[11px] rounded border border-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-violet-400"
          />
          <button type="button" onClick={handleAdd} disabled={!input.trim() || saving}
            className="h-6 px-2 text-[10px] font-bold bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-40 transition-colors">
            {saving ? "..." : "Add"}
          </button>
        </div>

        {/* Existing items */}
        <div className="max-h-44 overflow-y-auto divide-y divide-slate-50">
          {items.length === 0 && (
            <div className="px-3 py-3 text-[10px] text-slate-400 text-center">No items yet</div>
          )}
          {items.map(item => (
            <div key={item} className="flex items-center gap-1 px-2 py-1 group hover:bg-slate-50">
              {editingVal === item ? (
                <>
                  <input
                    autoFocus
                    value={editInput}
                    onChange={e => setEditInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleEdit(item); if (e.key === "Escape") { setEditingVal(null); setEditInput("") } }}
                    className="flex-1 h-5 text-[11px] rounded border border-violet-300 px-1.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
                  />
                  <button type="button" onClick={() => handleEdit(item)} disabled={saving}
                    className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 px-1">Save</button>
                  <button type="button" onClick={() => { setEditingVal(null); setEditInput("") }}
                    className="text-[9px] text-slate-400 hover:text-slate-600 px-0.5">âœ•</button>
                </>
              ) : deletingVal === item ? (
                <>
                  <span className="flex-1 text-[11px] text-red-600 truncate">{item}</span>
                  <button type="button" onClick={() => handleDelete(item)} disabled={saving}
                    className="text-[9px] font-bold text-red-600 hover:text-red-700 px-1">Delete?</button>
                  <button type="button" onClick={() => setDeletingVal(null)}
                    className="text-[9px] text-slate-400 hover:text-slate-600 px-0.5">No</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-[11px] text-slate-700 truncate">{item}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => { setEditingVal(item); setEditInput(item) }}
                      className="p-0.5 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-500 transition-colors" title="Edit">
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    <button type="button" onClick={() => setDeletingVal(item)}
                      className="p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// â"€â"€â"€ Mobile phone card â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function PhoneCard({
  row, idx, brands, models, colors, storageOptions, ramOptions,
  extraIphoneCategories, extraAndroidCategories,
  locks, onToggleLock,
  onChange, onUnit, onRemove, onDuplicate, onSplitQty, onImageUpload,
  onAddBrand, onEditBrand, onDeleteBrand,
  onAddModel, onEditModel, onDeleteModel,
  onAddColor, onEditColor, onDeleteColor,
  onAddStorage, onEditStorage, onDeleteStorage,
  onAddRam, onEditRam, onDeleteRam,
  onCheckImei,
}: {
  row: MobileRow; idx: number
  brands: string[]
  models: { name: string; brandName: string; deviceType: "iphone" | "android" }[]
  colors: string[]; storageOptions: string[]; ramOptions: string[]
  extraIphoneCategories: string[]; extraAndroidCategories: string[]
  locks: PhoneLockState
  onToggleLock: (k: keyof PhoneLockState) => void
  onChange: (key: keyof MobileRow, val: any) => void
  onUnit: (unitIdx: number, field: keyof MobileUnit, val: string) => void
  onRemove: () => void
  onDuplicate: () => void
  onSplitQty: () => void
  onImageUpload: (file: File) => void
  onAddBrand: (v: string) => Promise<void>
  onEditBrand: (old: string, nw: string) => Promise<void>
  onDeleteBrand: (v: string) => Promise<void>
  onAddModel: (v: string) => Promise<void>
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
  onCheckImei: (unitIdx: number, imei: string) => void
}) {
  const imgRef = useRef<HTMLInputElement | null>(null)
  const qty = parseInt(row.qty) || 1
  const cats = getCategories(row.deviceType, extraIphoneCategories, extraAndroidCategories)
  const imeiDone = row.units.filter(u => u.imei.length === 15 && !u.imeiError && !u.imeiChecking).length

  // Filter models to the currently selected brand
  const brandModels = useMemo(() => {
    if (!row.brand) return []
    return models
      .filter(m => m.brandName.toLowerCase() === row.brand.toLowerCase())
      .map(m => m.name)
  }, [models, row.brand])

  return (
    <div className={cn(
      "rounded-lg border bg-white shadow-sm transition-all",
      row.rowError ? "border-red-300 bg-red-50/20" : "border-slate-200 hover:border-violet-300"
    )}>
      {/* Card header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-slate-100 bg-slate-50/60 rounded-t-lg">
        <Smartphone className="w-3 h-3 text-violet-500 shrink-0" />
        <span className="text-[11px] font-bold text-slate-600">
          #{idx + 1}
          {row.brand && row.model && <span className="font-normal text-slate-400 ml-1">{row.brand} {row.model}</span>}
        </span>
        {row.buyPrice && parseFloat(row.buyPrice) > 0 && (
          <span className="ml-auto text-[10px] font-bold text-emerald-600">
            {formatCurrency(parseFloat(row.buyPrice) * qty)}
          </span>
        )}
        <div className="flex items-center gap-0 ml-1">
          <button onClick={onDuplicate} title="Duplicate" className="p-1 text-slate-300 hover:text-violet-500 transition-colors">
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={onRemove} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="p-2 space-y-1.5">
        {/* Row 1: Brand + Model + Type */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 relative">
              <PurchaseLockBtn locked={locks.brand} onToggle={() => onToggleLock("brand")} label="Brand" />
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Brand<span className="text-red-500 ml-0.5">*</span>
              </Label>
              <QuickCatPopover
                label="Brands" items={brands}
                onAdd={onAddBrand}
                onEdit={onEditBrand}
                onDelete={onDeleteBrand}
                catalogHref="/catalog/brands"
              />
            </div>
            <CreatableCombobox
              value={row.brand} onChange={v => {
                onChange("brand", v)
                onChange("model", "") // reset model when brand changes
                const isApple = v.trim().toLowerCase() === "apple"
                const newType = isApple ? "iphone" : "android"
                if (newType !== row.deviceType) {
                  onChange("deviceType", newType)
                  if (isApple) onChange("ram", "")
                  const opts = getCategories(newType, extraIphoneCategories, extraAndroidCategories)
                  if (!opts.includes(row.category)) onChange("category", opts[0])
                }
              }}
              options={brands} onAdd={onAddBrand}
              placeholder="Samsung, Apple..." error={!!row.rowError && !row.brand}
            />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 relative">
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Model<span className="text-red-500 ml-0.5">*</span>
              </Label>
              {row.brand ? (
                <QuickCatPopover
                  label={`${row.brand} Models`} items={brandModels}
                  onAdd={onAddModel}
                  onEdit={onEditModel}
                  onDelete={onDeleteModel}
                  catalogHref="/catalog/models"
                />
              ) : (
                <span title="Select a brand first to manage models"
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold text-slate-300 border border-slate-200 cursor-not-allowed leading-none">
                  <Plus className="w-2.5 h-2.5" /><span>Manage</span>
                </span>
              )}
            </div>
            <CreatableCombobox
              value={row.model}
              onChange={v => onChange("model", v)}
              options={brandModels}
              onAdd={row.brand ? onAddModel : undefined}
              placeholder={row.brand ? "Select or add model..." : "Choose brand first"}
              error={!!row.rowError && !row.model.trim()}
            />
          </div>
          <Field label="Type">
            <Sel value={row.deviceType} onChange={v => {
              const dt = v as "android" | "iphone"
              onChange("deviceType", dt)
              if (dt === "iphone") onChange("ram", "")
              const opts = getCategories(dt, extraIphoneCategories, extraAndroidCategories)
              if (!opts.includes(row.category)) onChange("category", opts[0])
            }}>
              <option value="android">Android</option>
              <option value="iphone">iPhone</option>
            </Sel>
          </Field>
        </div>

        {/* Row 2: Storage + RAM + PTA + Condition */}
        <div className={cn("grid gap-1.5", row.deviceType === "android" ? "grid-cols-4" : "grid-cols-3")}>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 relative">
              <PurchaseLockBtn locked={locks.storage} onToggle={() => onToggleLock("storage")} label="Storage" />
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Storage</Label>
              <QuickCatPopover
                label="Storage" items={storageOptions}
                onAdd={onAddStorage} onEdit={onEditStorage} onDelete={onDeleteStorage}
                catalogHref="/catalog/storage"
              />
            </div>
            <CreatableCombobox value={row.storage} onChange={v => onChange("storage", v)} options={storageOptions} onAdd={onAddStorage} placeholder="128GB..." />
          </div>
          {row.deviceType === "android" && (
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 relative">
                <PurchaseLockBtn locked={locks.ram} onToggle={() => onToggleLock("ram")} label="RAM" />
                <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">RAM</Label>
                <QuickCatPopover
                  label="RAM" items={ramOptions}
                  onAdd={onAddRam} onEdit={onEditRam} onDelete={onDeleteRam}
                  catalogHref="/catalog/ram"
                />
              </div>
              <CreatableCombobox value={row.ram} onChange={v => onChange("ram", v)} options={ramOptions} onAdd={onAddRam} placeholder="8GB..." />
            </div>
          )}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <PurchaseLockBtn locked={locks.category} onToggle={() => onToggleLock("category")} label="Category" />
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Category</Label>
            </div>
            <Sel value={row.category} onChange={v => onChange("category", v)}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </Sel>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <PurchaseLockBtn locked={locks.condition} onToggle={() => onToggleLock("condition")} label="Condition" />
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Condition</Label>
            </div>
            <Sel value={row.condition} onChange={v => onChange("condition", v)}>
              <option value="New">New</option>
              <option value="Refurbished">Refurb</option>
              <option value="Used">Used</option>
            </Sel>
          </div>
        </div>

        {/* Row 3: Buy + Sell + Qty + Photo */}
        <div className="grid grid-cols-4 gap-1.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <PurchaseLockBtn locked={locks.buyPrice} onToggle={() => onToggleLock("buyPrice")} label="Buy price" />
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Buy Rs<span className="text-red-500 ml-0.5">*</span></Label>
            </div>
            <input
              type="number" onWheel={e => e.currentTarget.blur()} min={0} placeholder="0"
              value={row.buyPrice}
              onChange={e => onChange("buyPrice", e.target.value)}
              className={cn(
                "w-full h-7 rounded-md border px-2 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-violet-400",
                !!row.rowError && (!row.buyPrice || parseFloat(row.buyPrice) <= 0) ? "border-red-400 bg-red-50" : "border-slate-200"
              )}
            />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <PurchaseLockBtn locked={locks.sellPrice} onToggle={() => onToggleLock("sellPrice")} label="Sell price" />
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Sell Rs</Label>
            </div>
            <input
              type="number" onWheel={e => e.currentTarget.blur()} min={0} placeholder="0"
              value={row.sellPrice}
              onChange={e => onChange("sellPrice", e.target.value)}
              className="w-full h-7 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
          </div>
          <Field label="Qty">
            <div className="relative">
              <input
                type="number" onWheel={e => e.currentTarget.blur()} min={1} value={row.qty}
                onChange={e => onChange("qty", e.target.value)}
                className="w-full h-7 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 pr-14"
              />
              {parseInt(row.qty) > 1 && (
                <button
                  type="button"
                  onClick={() => onSplitQty()}
                  title="Split into separate cards (each unit gets its own color, storage, IMEI)"
                  className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-violet-600 text-white text-[9px] font-bold rounded hover:bg-violet-700 transition-colors leading-none"
                >
                  Split
                </button>
              )}
            </div>
          </Field>
          <Field label="Photo">
            <input ref={imgRef} type="file" accept="image/*" className="hidden"
              onChange={e => { if (e.target.files?.[0]) onImageUpload(e.target.files[0]) }} />
            {row.imagePreview ? (
              <div className="relative w-7 h-7">
                <img src={row.imagePreview} alt="" className="w-7 h-7 rounded object-cover border border-slate-200" />
                <button onClick={() => onChange("imagePreview", null)}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full flex items-center justify-center">
                  <XIcon className="w-2 h-2" />
                </button>
              </div>
            ) : (
              <button onClick={() => imgRef.current?.click()}
                className="h-7 w-full rounded-md border border-dashed border-slate-200 flex items-center justify-center text-slate-300 hover:border-violet-400 hover:text-violet-400 transition-colors">
                <ImageIcon className="w-3 h-3" />
              </button>
            )}
          </Field>
        </div>

        {/* Row error */}
        {row.rowError && (
          <div className="flex items-center gap-1 text-[10px] text-red-600 bg-red-50 rounded px-2 py-1 border border-red-200">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {row.rowError}
          </div>
        )}

        {/* IMEI section */}
        <div className="rounded-md border border-slate-200">
          <button
            type="button"
            onClick={() => onChange("expanded", !row.expanded)}
            className="w-full flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left rounded-t-md"
          >
            <Fingerprint className="w-3 h-3 text-violet-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-600 flex-1">
              IMEI - Color{row.deviceType === "iphone" ? " - Battery" : ""}
            </span>
            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.5 rounded-full",
              imeiDone === qty ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            )}>
              {imeiDone}/{qty}
            </span>
            <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform shrink-0", row.expanded && "rotate-180")} />
          </button>

          {row.expanded && (
            <div className="divide-y divide-slate-100">
              {row.units.map((unit, ui) => {
                const isDuplicate = !!unit.imeiError
                const isChecking = !!unit.imeiChecking
                const isOk = unit.imei.length === 15 && !isDuplicate && !isChecking
                const isSoldLocked = !!unit.soldLocked
                return (
                  <div key={ui} className={cn("px-2.5 py-1.5 space-y-1", isSoldLocked && "opacity-60")}>
                    {isSoldLocked && (
                      <div className="flex items-center gap-1 mb-0.5">
                        <Lock className="w-2.5 h-2.5 text-red-500" />
                        <span className="text-[9px] font-bold text-red-500 uppercase tracking-wide">Sold - cannot edit</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-slate-400 w-4 shrink-0">#{ui + 1}</span>
                      <div className="relative flex-1">
                        <input
                          value={unit.imei}
                          readOnly={isSoldLocked}
                          onChange={isSoldLocked ? undefined : e => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 15)
                            onUnit(ui, "imei", val)
                            if (val.length === 15) onCheckImei(ui, val)
                          }}
                          placeholder="15-digit IMEI"
                          maxLength={15}
                          className={cn(
                            "w-full h-7 rounded-md border px-2 pr-10 text-xs font-mono bg-white focus:outline-none focus:ring-1",
                            isSoldLocked ? "border-slate-200 bg-slate-50 cursor-not-allowed text-slate-500"
                            : isDuplicate ? "border-red-400 bg-red-50 focus:ring-red-400"
                            : isOk ? "border-emerald-400 bg-emerald-50 focus:ring-emerald-400"
                            : unit.imei.length > 0 ? "border-amber-300 bg-amber-50/40 focus:ring-amber-300"
                            : "border-slate-200 focus:ring-violet-400"
                          )}
                        />
                        {isChecking && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin pointer-events-none" />
                        )}
                        {!isChecking && unit.imei.length > 0 && unit.imei.length < 15 && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-amber-500 font-bold pointer-events-none">
                            {15 - unit.imei.length}
                          </span>
                        )}
                        {!isChecking && isOk && (
                          <Check className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-emerald-500 pointer-events-none" />
                        )}
                        {!isChecking && isDuplicate && (
                          <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-red-500 pointer-events-none" />
                        )}
                      </div>
                      {/* Color per unit */}
                      <div className="w-28 shrink-0">
                        {isSoldLocked
                          ? <span className="flex h-7 items-center px-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md">{unit.color || "-"}</span>
                          : <CreatableCombobox value={unit.color} onChange={v => onUnit(ui, "color", v)} options={colors} onAdd={onAddColor} placeholder="Color..." />
                        }
                      </div>
                      {row.deviceType === "iphone" && (
                        <div className="flex items-center gap-1 w-20 shrink-0">
                          <Battery className="w-3 h-3 text-slate-400 shrink-0" />
                          <input
                            type="number" onWheel={e => e.currentTarget.blur()} min="1" max="100"
                            value={unit.batteryHealth}
                            readOnly={isSoldLocked}
                            onChange={isSoldLocked ? undefined : e => onUnit(ui, "batteryHealth", e.target.value)}
                            placeholder="%"
                            className={cn("w-full h-7 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400", isSoldLocked && "bg-slate-50 cursor-not-allowed")}
                          />
                        </div>
                      )}
                    </div>
                    {isDuplicate && (
                      <p className="text-[10px] text-red-600 font-semibold pl-5">
                        {unit.imeiError === "duplicate_local"
                          ? "Already entered in this purchase"
                          : "This IMEI is already in stock - sold or returned it first"}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// â"€â"€â"€ Finance account icon â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function AccountIcon({ type }: { type: string }) {
  if (type === "bank") return <Landmark className="w-4 h-4" />
  if (type === "mobile_wallet") return <Wallet className="w-4 h-4" />
  return <Banknote className="w-4 h-4" />
}

// â"€â"€â"€ Review Order Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ReviewOrderModal({ open, onClose, mobileRows, accessoryItems, onConfirm, submitting, accounts, supplier }: {
  open: boolean; onClose: () => void
  mobileRows: MobileRow[]; accessoryItems: AccessoryItem[]
  onConfirm: (opts: { shipping: number; tax: number; splits: SplitEntry[]; dueDate: string; notes: string }) => void
  submitting: boolean; accounts: FinanceAccount[]; supplier: Supplier | undefined
}) {
  const [shipping, setShipping] = useState("0")
  const [tax, setTax] = useState("0")
  const [splits, setSplits] = useState<SplitEntry[]>([])
  const [notes, setNotes] = useState("")
  const confirmingRef = useRef(false)
  useEffect(() => { if (!submitting) confirmingRef.current = false }, [submitting])

  const subtotal = useMemo(() => {
    return mobileRows.reduce((s, r) => s + (parseFloat(r.buyPrice) || 0) * (parseInt(r.qty) || 1), 0)
      + accessoryItems.reduce((s, a) => s + (parseFloat(a.buyPrice) || 0) * (parseInt(a.qty) || 1), 0)
  }, [mobileRows, accessoryItems])

  const shippingNum = parseFloat(shipping) || 0
  const taxNum = parseFloat(tax) || 0
  const grandTotal = subtotal + shippingNum + taxNum
  const totalPaid = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  const balanceDue = Math.max(0, grandTotal - totalPaid)
  const overpaid = totalPaid > grandTotal ? totalPaid - grandTotal : 0
  const payStatus = totalPaid <= 0 ? "Unpaid" : totalPaid >= grandTotal ? "Paid" : "Partial"

  const insufficientMap: Record<string, boolean> = {}
  for (const s of splits) {
    const acc = accounts.find(a => a.id === s.accountId)
    if (acc && (parseFloat(s.amount) || 0) > acc.currentBalance) insufficientMap[s.accountId] = true
  }
  const anyInsufficient = Object.keys(insufficientMap).length > 0

  function toggleAccount(accId: string) {
    setSplits(prev => prev.find(e => e.accountId === accId)
      ? prev.filter(e => e.accountId !== accId)
      : [...prev, { accountId: accId, amount: "" }])
  }
  function setAmount(accId: string, val: string) {
    setSplits(prev => prev.map(e => e.accountId === accId ? { ...e, amount: val } : e))
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !submitting) onClose() }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-0 gap-0">
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
                {supplier?.companyName ?? "No supplier"} — {mobileRows.length + accessoryItems.length} item(s)
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">

          {/* Items summary */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Items</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
              {mobileRows.map(r => (
                <div key={r.uid} className="px-3 py-2.5 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{r.brand} {r.model}</p>
                    <p className="text-[10px] text-slate-400">{[r.storage, r.category].filter(Boolean).join(" - ")} — qty {parseInt(r.qty) || 1}</p>
                    {r.units.filter(u => u.imei.length === 15).map((u, i) => (
                      <p key={i} className="text-[10px] text-slate-400 font-mono">IMEI: {u.imei}{u.color ? ` - ${u.color}` : ""}</p>
                    ))}
                  </div>
                  <span className="text-sm font-bold text-slate-700 shrink-0">
                    {formatCurrency((parseFloat(r.buyPrice) || 0) * (parseInt(r.qty) || 1))}
                  </span>
                </div>
              ))}
              {accessoryItems.map(a => (
                <div key={a.uid} className="px-3 py-2.5 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <Headphones className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{a.name}</p>
                    <p className="text-[10px] text-slate-400">{a.brand} — qty {parseInt(a.qty) || 1}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-700 shrink-0">
                    {formatCurrency((parseFloat(a.buyPrice) || 0) * (parseInt(a.qty) || 1))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping + Tax */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shipping (Rs)">
              <Input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={shipping} onChange={e => setShipping(e.target.value)} className="h-9 text-sm" placeholder="0" />
            </Field>
            <Field label="Tax / Other (Rs)">
              <Input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={tax} onChange={e => setTax(e.target.value)} className="h-9 text-sm" placeholder="0" />
            </Field>
          </div>

          {/* Cost breakdown */}
          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden text-sm">
            <div className="flex justify-between px-3 py-2 bg-slate-50">
              <span className="text-slate-500 text-xs">Subtotal</span>
              <span className="font-semibold text-slate-700">{formatCurrency(subtotal)}</span>
            </div>
            {shippingNum > 0 && (
              <div className="flex justify-between px-3 py-2">
                <span className="text-slate-500 text-xs">Shipping</span>
                <span className="text-slate-600">+ {formatCurrency(shippingNum)}</span>
              </div>
            )}
            {taxNum > 0 && (
              <div className="flex justify-between px-3 py-2">
                <span className="text-slate-500 text-xs">Tax / Other</span>
                <span className="text-slate-600">+ {formatCurrency(taxNum)}</span>
              </div>
            )}
            <div className="flex justify-between px-3 py-3 bg-blue-50">
              <span className="text-sm font-bold text-blue-700">Grand Total</span>
              <span className="text-lg font-extrabold text-blue-700 tabular-nums">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* ── PAYMENT SECTION ── */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Amount Paid</span>
              </div>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                payStatus === "Paid"    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : payStatus === "Partial" ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
              )}>{payStatus}</span>
            </div>

            <div className="p-3 space-y-2">
              {accounts.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">No finance accounts found. Set up accounts first.</p>
                </div>
              ) : accounts.map(acc => {
                const entry = splits.find(e => e.accountId === acc.id)
                const sel = !!entry
                const bad = insufficientMap[acc.id]
                const type = acc.type ?? "cash"
                const ring = { cash: sel ? "border-emerald-400 bg-emerald-50" : "border-slate-200", bank: sel ? "border-blue-400 bg-blue-50" : "border-slate-200", mobile_wallet: sel ? "border-violet-400 bg-violet-50" : "border-slate-200" }
                const iconBg = { cash: sel ? "bg-emerald-200 text-emerald-700" : "bg-slate-100 text-slate-500", bank: sel ? "bg-blue-200 text-blue-700" : "bg-slate-100 text-slate-500", mobile_wallet: sel ? "bg-violet-200 text-violet-700" : "bg-slate-100 text-slate-500" }
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
                      <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors", sel ? "bg-blue-600 border-blue-600" : "border-slate-300")}>
                        {sel && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                    {sel && (
                      <div className="px-3 pb-3">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Input type="number" onWheel={e => e.currentTarget.blur()} min={0}
                              placeholder="Amount paid (Rs)"
                              value={entry?.amount ?? ""}
                              onChange={e => setAmount(acc.id, e.target.value)}
                              className={cn("h-9 text-sm", bad && "border-red-400")}
                              autoFocus
                            />
                            {bad && <p className="text-[10px] text-red-500 mt-0.5">Exceeds account balance of {formatCurrency(acc.currentBalance)}</p>}
                          </div>
                          <button type="button"
                            onClick={() => setAmount(acc.id, String(Math.min(acc.currentBalance, Math.max(0, grandTotal - (totalPaid - (parseFloat(entry?.amount ?? "0") || 0))))))}
                            className="self-start text-[10px] text-blue-600 font-semibold border border-blue-200 rounded-lg px-2.5 py-2.5 hover:bg-blue-50 whitespace-nowrap">
                            Fill
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Running payment summary */}
              {totalPaid > 0 && (
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden mt-1">
                  <div className="flex justify-between px-3 py-2 text-xs">
                    <span className="text-slate-500">Amount Paid</span>
                    <span className="font-bold text-slate-800 tabular-nums">{formatCurrency(totalPaid)}</span>
                  </div>
                  {overpaid > 0 ? (
                    <div className="flex justify-between px-3 py-2 text-xs bg-blue-50">
                      <span className="font-bold text-blue-700">Advance / Overpaid</span>
                      <span className="font-extrabold text-blue-700 tabular-nums">+ {formatCurrency(overpaid)}</span>
                    </div>
                  ) : balanceDue > 0 ? (
                    <div className="flex justify-between px-3 py-2 text-xs bg-amber-50">
                      <span className="font-bold text-amber-700">Remaining Payable</span>
                      <span className="font-extrabold text-amber-700 tabular-nums">{formatCurrency(balanceDue)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 text-xs bg-emerald-50">
                      <span className="font-bold text-emerald-700">Fully Paid</span>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  )}
                </div>
              )}

              {/* Zero paid hint */}
              {totalPaid === 0 && (
                <p className="text-[11px] text-slate-400 text-center py-1">
                  Leave all unselected to record as unpaid (credit purchase)
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <Field label="Notes (optional)">
            <Input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Delivery Friday, partial batch..." className="h-9 text-sm" />
          </Field>

          <Separator />

          <Button type="button"
            disabled={submitting || (mobileRows.length === 0 && accessoryItems.length === 0) || anyInsufficient}
            onClick={() => {
              if (confirmingRef.current) return
              confirmingRef.current = true
              onConfirm({ shipping: shippingNum, tax: taxNum, splits, dueDate: "", notes })
            }}
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm gap-2 shadow-md">
            <ShoppingCart className="w-4 h-4" />
            {submitting ? "Recording..." : `Confirm Purchase - ${formatCurrency(grandTotal)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// â"€â"€â"€ Main Sheet â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export function NewPurchaseSheet({ open, onClose, onCreated, editPurchaseId }: {
  open: boolean; onClose: () => void; onCreated?: () => void; editPurchaseId?: string | null
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [accessoryCatalog, setAccessoryCatalog] = useState<CatalogAccessory[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  const [brands, setBrands] = useState<string[]>([])
  const [models, setModels] = useState<{ name: string; brandName: string; deviceType: "iphone" | "android"; dbId: string; table: "iphone_models" | "android_models" }[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [storageOptions, setStorageOptions] = useState<string[]>([])
  const [ramOptions, setRamOptions] = useState<string[]>([])
  const [extraIphoneCategories, setExtraIphoneCategories] = useState<string[]>([])
  const [extraAndroidCategories, setExtraAndroidCategories] = useState<string[]>([])
  const [newCategoryInput, setNewCategoryInput] = useState("")
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [addCategoryTarget, setAddCategoryTarget] = useState<"iphone" | "android">("android")

  useEffect(() => {
    async function load() {
      try {
        setDataLoading(true)
        const tenantId = await getTenantId()
        const [suppData, accessoriesRes, accsFinance, brandsRes, colorsRes, storageRes, ramRes, iphoneModelsRes, androidModelsRes] = await Promise.all([
          getSuppliers(),
          supabase.from("accessories").select("id, name, brand, category, sku, image_url").eq("tenant_id", tenantId).order("name"),
          getFinanceAccounts(),
          supabase.from("brands").select("name").eq("tenant_id", tenantId).eq("status", "Active").order("name"),
          supabase.from("colors").select("name").eq("tenant_id", tenantId).order("name"),
          supabase.from("storage_options").select("name").eq("tenant_id", tenantId).order("name"),
          supabase.from("ram_options").select("name").eq("tenant_id", tenantId).order("name"),
          supabase.from("iphone_models").select("id, name, brand_name").eq("tenant_id", tenantId).order("name"),
          supabase.from("android_models").select("id, name, brand_name").eq("tenant_id", tenantId).order("name"),
        ])
        setSuppliers(suppData)
        if (accessoriesRes.data) {
          setAccessoryCatalog(accessoriesRes.data.map((a: any) => ({
            id: a.id, name: a.name, brand: a.brand ?? "", category: a.category ?? "", sku: a.sku ?? "", imageUrl: a.image_url ?? null,
          })))
        }
        setAccounts(accsFinance)
        if (brandsRes.data) setBrands(brandsRes.data.map((d: any) => d.name))
        if (colorsRes.data) setColors(colorsRes.data.map((d: any) => d.name))
        if (storageRes.data) setStorageOptions(storageRes.data.map((d: any) => d.name))
        if (ramRes.data) setRamOptions(ramRes.data.map((d: any) => d.name))
        const iphones = (iphoneModelsRes.data ?? []).map((m: any) => ({ name: m.name, brandName: m.brand_name || "Apple", deviceType: "iphone" as const, dbId: m.id, table: "iphone_models" as const }))
        const androids = (androidModelsRes.data ?? []).map((m: any) => ({ name: m.name, brandName: m.brand_name || "", deviceType: "android" as const, dbId: m.id, table: "android_models" as const }))
        setModels([...iphones, ...androids])
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setDataLoading(false)
      }
    }
    load()
  }, [])

  // â"€â"€ Edit mode: pre-fill from existing purchase â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [editMode, setEditMode] = useState(false)
  const [editPoNumber, setEditPoNumber] = useState<string | null>(null)

  useEffect(() => {
    if (!editPurchaseId || dataLoading) return
    async function prefill() {
      try {
        const tenantId = await getTenantId()
        // Load purchase header + items
        const { data: pur } = await supabase.from("purchases").select("*").eq("id", editPurchaseId).single()
        if (!pur) return
        const { data: purItems } = await supabase.from("purchase_items").select("*").eq("purchase_id", editPurchaseId)
        if (!purItems) return

        setEditMode(true)
        setEditPoNumber((pur as any).po_number)
        setSelectedSupplierId((pur as any).supplier_id ?? "")
        const sup = suppliers.find(s => s.id === (pur as any).supplier_id)
        if (sup) setSupplierSearch(sup.companyName)

        const newMobileRows: MobileRow[] = []
        const newAccessoryItems: AccessoryItem[] = []

        for (const item of (purItems as any[])) {
          if (item.product_type === "Mobile") {
            // Load imei_records for this product
            const { data: imeiRows } = await supabase
              .from("imei_records")
              .select("imei_number, color, battery_health, device_status")
              .eq("product_id", item.product_id)
              .eq("tenant_id", tenantId)

            // Load mobile catalog info
            const { data: mob } = await supabase
              .from("mobiles")
              .select("brand, model, storage, ram, category, device_type, condition, color")
              .eq("id", item.product_id)
              .single()

            const units: MobileUnit[] = (imeiRows ?? []).map((ir: any) => ({
              imei: ir.imei_number ?? "",
              batteryHealth: ir.battery_health ? String(ir.battery_health) : "",
              color: ir.color ?? (mob as any)?.color ?? "",
              soldLocked: ir.device_status === "sold",
            }))
            if (units.length === 0) units.push(makeUnit((mob as any)?.color ?? ""))

            newMobileRows.push({
              uid: mkUid(),
              brand: (mob as any)?.brand ?? "",
              model: (mob as any)?.model ?? "",
              storage: (mob as any)?.storage ?? "",
              ram: (mob as any)?.ram ?? "",
              category: (mob as any)?.category ?? "PTA Approved",
              deviceType: ((mob as any)?.device_type ?? "android") as "android" | "iphone",
              condition: (mob as any)?.condition ?? "New",
              buyPrice: String(item.unit_cost ?? ""),
              sellPrice: String((mob as any)?.selling_price ?? ""),
              qty: String(units.length),
              units,
              expanded: true,
              imageFile: null,
              imagePreview: null,
            })
          } else if (item.product_type === "Accessory") {
            newAccessoryItems.push({
              uid: mkUid(),
              catalogId: item.product_id,
              name: item.product_name,
              brand: "",
              category: "",
              sku: "",
              buyPrice: String(item.unit_cost ?? ""),
              sellPrice: "",
              qty: String(item.quantity ?? 1),
            })
          }
        }

        setMobileRows(newMobileRows)
        setAccessoryItems(newAccessoryItems)
      } catch {
        toast.error("Failed to load purchase for editing")
      }
    }
    prefill()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPurchaseId, dataLoading])

  // â"€â"€ Catalog: Add handlers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const handleAddBrand = async (v: string) => {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("brands").insert({ tenant_id: tenantId, name: v, logo_initials: v.slice(0, 2).toUpperCase(), status: "Active", is_system: false })
    if (error) throw new Error(error.message)
    setBrands(p => Array.from(new Set([...p, v])).sort())
    toast.success(`Brand "${v}" added`)
  }
  const handleEditBrand = async (oldVal: string, newVal: string) => {
    const { error } = await supabase.from("brands").update({ name: newVal }).eq("name", oldVal)
    if (error) throw new Error(error.message)
    setBrands(p => p.map(b => b === oldVal ? newVal : b).sort())
    toast.success("Brand updated")
  }
  const handleDeleteBrand = async (v: string) => {
    const { error } = await supabase.from("brands").delete().eq("name", v)
    if (error) throw new Error(error.message)
    setBrands(p => p.filter(b => b !== v))
    toast.success(`"${v}" deleted`)
  }

  const makeHandleAddModel = useCallback((brand: string) => async (v: string) => {
    const tenantId = await getTenantId()
    const isApple = brand.toLowerCase() === "apple"
    const table = isApple ? "iphone_models" : "android_models"
    const { data, error } = await supabase.from(table).insert({ tenant_id: tenantId, name: v, brand_name: brand, is_system: false }).select("id").single()
    if (error) throw new Error(error.message)
    setModels(p => [...p, { name: v, brandName: brand, deviceType: isApple ? "iphone" : "android", dbId: (data as any).id, table }])
    toast.success(`Model "${v}" added`)
  }, [])

  const handleEditModel = async (oldVal: string, newVal: string) => {
    const m = models.find(m => m.name === oldVal)
    if (!m) return
    const { error } = await supabase.from(m.table).update({ name: newVal }).eq("id", m.dbId)
    if (error) throw new Error(error.message)
    setModels(p => p.map(x => x.dbId === m.dbId ? { ...x, name: newVal } : x))
    toast.success("Model updated")
  }
  const handleDeleteModel = async (v: string) => {
    const m = models.find(m => m.name === v)
    if (!m) return
    const { error } = await supabase.from(m.table).delete().eq("id", m.dbId)
    if (error) throw new Error(error.message)
    setModels(p => p.filter(x => x.dbId !== m.dbId))
    toast.success(`"${v}" deleted`)
  }

  const handleAddColor = async (v: string) => {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("colors").insert({ tenant_id: tenantId, name: v, is_system: false })
    if (error) throw new Error(error.message)
    setColors(p => Array.from(new Set([...p, v])).sort())
    toast.success(`Color "${v}" added`)
  }
  const handleEditColor = async (oldVal: string, newVal: string) => {
    const { error } = await supabase.from("colors").update({ name: newVal }).eq("name", oldVal)
    if (error) throw new Error(error.message)
    setColors(p => p.map(c => c === oldVal ? newVal : c).sort())
    toast.success("Color updated")
  }
  const handleDeleteColor = async (v: string) => {
    const { error } = await supabase.from("colors").delete().eq("name", v)
    if (error) throw new Error(error.message)
    setColors(p => p.filter(c => c !== v))
    toast.success(`"${v}" deleted`)
  }

  const handleAddStorage = async (v: string) => {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("storage_options").insert({ tenant_id: tenantId, name: v, is_system: false })
    if (error) throw new Error(error.message)
    setStorageOptions(p => Array.from(new Set([...p, v])))
    toast.success(`Storage "${v}" added`)
  }
  const handleEditStorage = async (oldVal: string, newVal: string) => {
    const { error } = await supabase.from("storage_options").update({ name: newVal }).eq("name", oldVal)
    if (error) throw new Error(error.message)
    setStorageOptions(p => p.map(s => s === oldVal ? newVal : s))
    toast.success("Storage updated")
  }
  const handleDeleteStorage = async (v: string) => {
    const { error } = await supabase.from("storage_options").delete().eq("name", v)
    if (error) throw new Error(error.message)
    setStorageOptions(p => p.filter(s => s !== v))
    toast.success(`"${v}" deleted`)
  }

  const handleAddRam = async (v: string) => {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("ram_options").insert({ tenant_id: tenantId, name: v, is_system: false })
    if (error) throw new Error(error.message)
    setRamOptions(p => Array.from(new Set([...p, v])))
    toast.success(`RAM "${v}" added`)
  }
  const handleEditRam = async (oldVal: string, newVal: string) => {
    const { error } = await supabase.from("ram_options").update({ name: newVal }).eq("name", oldVal)
    if (error) throw new Error(error.message)
    setRamOptions(p => p.map(r => r === oldVal ? newVal : r))
    toast.success("RAM updated")
  }
  const handleDeleteRam = async (v: string) => {
    const { error } = await supabase.from("ram_options").delete().eq("name", v)
    if (error) throw new Error(error.message)
    setRamOptions(p => p.filter(r => r !== v))
    toast.success(`"${v}" deleted`)
  }

  // â"€â"€ Supplier â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [supplierSearch, setSupplierSearch] = useState("")
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [dropOpen, setDropOpen] = useState(false)
  const [showQuickSupplier, setShowQuickSupplier] = useState(false)
  const [quickSupplierName, setQuickSupplierName] = useState("")
  const [quickSupplierPhone, setQuickSupplierPhone] = useState("")
  const [quickSupplierCity, setQuickSupplierCity] = useState("")
  const [quickSupplierBalance, setQuickSupplierBalance] = useState("")
  const [savingSupplier, setSavingSupplier] = useState(false)

  async function handleQuickAddSupplier() {
    if (!quickSupplierName.trim() || savingSupplier) return
    setSavingSupplier(true)
    try {
      const tenantId = await getTenantId()
      const { data, error } = await supabase.from("suppliers").insert({
        tenant_id: tenantId,
        company_name: quickSupplierName.trim(),
        contact_person: quickSupplierName.trim(),
        phone: quickSupplierPhone.trim(),
        city: quickSupplierCity.trim(),
        email: "",
        address: "",
        status: "Active",
        outstanding_balance: parseFloat(quickSupplierBalance) || 0,
      }).select("id, company_name").single()
      if (error) throw new Error(error.message)
      const newS = await getSuppliers()
      setSuppliers(newS)
      setSelectedSupplierId((data as any).id)
      setSupplierSearch((data as any).company_name)
      setShowQuickSupplier(false)
      setQuickSupplierName(""); setQuickSupplierPhone(""); setQuickSupplierCity(""); setQuickSupplierBalance("")
      toast.success(`Supplier "${(data as any).company_name}" added`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add supplier")
    } finally {
      setSavingSupplier(false)
    }
  }

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.toLowerCase().trim()
    if (!q) return suppliers
    return suppliers.filter(s =>
      s.companyName.toLowerCase().includes(q) ||
      s.city?.toLowerCase().includes(q) ||
      s.contactPerson?.toLowerCase().includes(q)
    )
  }, [supplierSearch, suppliers])

  const selectedSupplier = useMemo(() => suppliers.find(s => s.id === selectedSupplierId), [selectedSupplierId, suppliers])

  // â"€â"€ Mobile rows â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [mobileRows, setMobileRows] = useState<MobileRow[]>([])
  const [phoneLocks, setPhoneLocks] = useState<PhoneLockState>({
    brand: false, storage: false, ram: false,
    category: false, condition: false, buyPrice: false, sellPrice: false,
  })
  const togglePhoneLock = (k: keyof PhoneLockState) =>
    setPhoneLocks(prev => ({ ...prev, [k]: !prev[k] }))

  const updateRow = (uid: string, key: keyof MobileRow, val: any) =>
    setMobileRows(prev => prev.map(r => {
      if (r.uid !== uid) return r
      const updated: MobileRow = { ...r, [key]: val, rowError: undefined }
      if (key === "qty") {
        const n = parseInt(val) || 1
        updated.units = resizeUnits(r.units, n)
        if (n > 1) updated.expanded = true
      }
      return updated
    }))

  const updateUnit = (uid: string, unitIdx: number, field: keyof MobileUnit, val: string) =>
    setMobileRows(prev => prev.map(r =>
      r.uid !== uid ? r : { ...r, units: r.units.map((u, i) => i === unitIdx ? { ...u, [field]: val, ...(field === "imei" ? { imeiError: undefined, imeiChecking: false } : {}) } : u) }
    ))

  const checkImei = async (uid: string, unitIdx: number, imei: string) => {
    // Mark as checking
    setMobileRows(prev => prev.map(r =>
      r.uid !== uid ? r : { ...r, units: r.units.map((u, i) => i === unitIdx ? { ...u, imeiChecking: true, imeiError: undefined } : u) }
    ))

    // Check duplicate within current purchase (other rows + other units in same row)
    const allImeis = mobileRows.flatMap(r =>
      r.units.map((u, i) => ({ uid: r.uid, unitIdx: i, imei: u.imei }))
    ).filter(x => !(x.uid === uid && x.unitIdx === unitIdx))
    const localDupe = allImeis.some(x => x.imei === imei)

    if (localDupe) {
      setMobileRows(prev => prev.map(r =>
        r.uid !== uid ? r : { ...r, units: r.units.map((u, i) => i === unitIdx ? { ...u, imeiChecking: false, imeiError: "duplicate_local" } : u) }
      ))
      return
    }

    // Check against DB - imei_records table
    try {
      const tenantId = await getTenantId()
      const { data } = await supabase
        .from("imei_records")
        .select("imei_number, device_status")
        .eq("tenant_id", tenantId)
        .eq("imei_number", imei)
        .maybeSingle()

      const existsInStock = data && data.device_status !== "sold" && data.device_status !== "returned"
      setMobileRows(prev => prev.map(r =>
        r.uid !== uid ? r : { ...r, units: r.units.map((u, i) =>
          i === unitIdx ? { ...u, imeiChecking: false, imeiError: existsInStock ? "duplicate_db" : undefined } : u
        )}
      ))
    } catch {
      // On DB error, don't block - just clear checking state
      setMobileRows(prev => prev.map(r =>
        r.uid !== uid ? r : { ...r, units: r.units.map((u, i) => i === unitIdx ? { ...u, imeiChecking: false } : u) }
      ))
    }
  }

  const addRow = () => setMobileRows(prev => {
    const last = prev[prev.length - 1]
    const next = makeMobileRow()
    if (last) {
      if (phoneLocks.brand)     { next.brand = last.brand; next.deviceType = last.deviceType }
      if (phoneLocks.storage)   next.storage = last.storage
      if (phoneLocks.ram)       next.ram = last.ram
      if (phoneLocks.category)  next.category = last.category
      if (phoneLocks.condition) next.condition = last.condition
      if (phoneLocks.buyPrice)  next.buyPrice = last.buyPrice
      if (phoneLocks.sellPrice) next.sellPrice = last.sellPrice
    }
    return [...prev, next]
  })

  const splitRow = (uid: string) => {
    setMobileRows(prev => {
      const idx = prev.findIndex(r => r.uid === uid)
      if (idx === -1) return prev
      const src = prev[idx]
      const n = parseInt(src.qty) || 1
      if (n <= 1) return prev
      // Replace the single card with n cards, each qty=1, same specs but blank IMEI
      const cards: MobileRow[] = Array.from({ length: n }, () => ({
        ...src,
        uid: mkUid(),
        qty: "1",
        units: [makeUnit()],
        rowError: undefined,
        expanded: true,
      }))
      const copy = [...prev]
      copy.splice(idx, 1, ...cards)
      return copy
    })
  }

  const duplicateRow = (uid: string) => {
    const src = mobileRows.find(r => r.uid === uid)
    if (!src) return
    const next: MobileRow = { ...src, uid: mkUid(), units: src.units.map(() => makeUnit()), rowError: undefined }
    setMobileRows(prev => {
      const idx = prev.findIndex(r => r.uid === uid)
      const copy = [...prev]; copy.splice(idx + 1, 0, next); return copy
    })
  }

  const removeRow = (uid: string) => {
    setMobileRows(prev => prev.filter(r => r.uid !== uid))
  }

  // â"€â"€ Accessories â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [accessoryItems, setAccessoryItems] = useState<AccessoryItem[]>([])
  const [accessorySearch, setAccessorySearch] = useState("")
  const [showCatalog, setShowCatalog] = useState(false)

  const filteredAccessories = useMemo(() => {
    const q = accessorySearch.toLowerCase().trim()
    if (!q) return accessoryCatalog
    return accessoryCatalog.filter(a =>
      a.name.toLowerCase().includes(q) || a.brand.toLowerCase().includes(q) || a.sku.toLowerCase().includes(q)
    )
  }, [accessorySearch, accessoryCatalog])

  const accessoryInCart = useMemo(() => new Set(accessoryItems.map(a => a.catalogId)), [accessoryItems])

  function toggleAccessory(a: CatalogAccessory) {
    if (accessoryInCart.has(a.id)) {
      setAccessoryItems(prev => prev.filter(x => x.catalogId !== a.id))
    } else {
      setAccessoryItems(prev => [...prev, { uid: mkUid(), catalogId: a.id, name: a.name, brand: a.brand, category: a.category, sku: a.sku, buyPrice: "", sellPrice: "", qty: "1" }])
    }
  }

  // â"€â"€ Validation â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  function validateRows(): boolean {
    const seen = new Set<string>()
    // Drop rows that are completely blank (user added a row but didn't fill anything)
    const filledRows = mobileRows.filter(r => r.brand || r.model.trim() || r.buyPrice || r.units.some(u => u.imei))
    const updated = filledRows.map((r, i) => {
      const n = i + 1
      if (!r.brand) return { ...r, rowError: `Phone ${n}: brand required` }
      if (!r.model.trim()) return { ...r, rowError: `Phone ${n}: model required` }
      if (!r.buyPrice || parseFloat(r.buyPrice) <= 0) return { ...r, rowError: `Phone ${n}: buy price required` }
      for (const [ui, unit] of r.units.entries()) {
        if (!unit.imei) return { ...r, expanded: true, rowError: `Phone ${n} unit ${ui + 1}: IMEI required` }
        if (!/^\d{15}$/.test(unit.imei)) return { ...r, expanded: true, rowError: `Phone ${n} unit ${ui + 1}: IMEI must be 15 digits` }
        if (unit.imeiChecking) return { ...r, expanded: true, rowError: `Phone ${n} unit ${ui + 1}: IMEI check in progress, wait a moment` }
        if (unit.imeiError === "duplicate_local") return { ...r, expanded: true, rowError: `Phone ${n} unit ${ui + 1}: duplicate IMEI in this purchase` }
        if (unit.imeiError === "duplicate_db") return { ...r, expanded: true, rowError: `Phone ${n} unit ${ui + 1}: IMEI already in stock - sell or return it first` }
        if (seen.has(unit.imei)) return { ...r, expanded: true, rowError: `Phone ${n} unit ${ui + 1}: duplicate IMEI` }
        seen.add(unit.imei)
      }
      return { ...r, rowError: undefined }
    })
    const firstError = updated.find(r => r.rowError)
    if (firstError) {
      setMobileRows(updated)
      toast.error(firstError.rowError ?? "Fix errors before continuing")
      return false
    }
    setMobileRows(updated)
    return true
  }

  // â"€â"€ Submit â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [reviewOpen, setReviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleOpenReview() {
    if (!selectedSupplierId) { toast.error("Select a supplier first"); return }
    if (!validateRows()) return
    const filledMobiles = mobileRows.filter(r => r.brand || r.model.trim() || r.buyPrice || r.units.some(u => u.imei))
    if (filledMobiles.length === 0 && accessoryItems.length === 0) { toast.error("Add at least one item"); return }
    for (const a of accessoryItems) {
      if (!a.buyPrice || parseFloat(a.buyPrice) <= 0) { toast.error(`Enter buy price for ${a.name}`); return }
    }
    setReviewOpen(true)
  }

  async function handleConfirmPurchase({ shipping, tax, splits, dueDate, notes }: {
    shipping: number; tax: number; splits: SplitEntry[]; dueDate: string; notes: string
  }) {
    if (submitting) return
    setSubmitting(true)

    const mSub = mobileRows.reduce((s, r) => s + (parseFloat(r.buyPrice) || 0) * (parseInt(r.qty) || 1), 0)
    const aSub = accessoryItems.reduce((s, a) => s + (parseFloat(a.buyPrice) || 0) * (parseInt(a.qty) || 1), 0)
    const subtotal = mSub + aSub
    const grandTotal = subtotal + shipping + tax
    const amountPaid = splits.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
    const balanceDue = Math.max(0, grandTotal - amountPaid)
    const overpaidAmt = amountPaid > grandTotal ? amountPaid - grandTotal : 0
    const paymentStatus = amountPaid <= 0 ? "Unpaid" : amountPaid >= grandTotal ? "Paid" : "Partial"

    const firstSplit = splits.find(e => parseFloat(e.amount) > 0)
    const firstAccount = firstSplit ? accounts.find(a => a.id === firstSplit.accountId) : undefined
    const paymentMethod = firstAccount
      ? (firstAccount.type === "cash" ? "Cash" : firstAccount.type === "bank" ? "Bank Transfer" : firstAccount.bankName || "Mobile Wallet")
      : splits.length > 1 ? "Split Payment" : "Cash"

    const createdMobileIds: string[] = []
    const updatedMobileIds: string[] = []
    const origMobileStocks: Record<string, number> = {}
    const updatedAccessoryIds: string[] = []
    const origAccessoryStocks: Record<string, number> = {}
    const insertedImeis: string[] = []
    let purchaseId: string | null = null

    try {
      const tenantId = await getTenantId()
      const today = todayPKT()
      const dateTag = today.replace(/-/g, "")
      const { count: poCount } = await supabase.from("purchases").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId)
      const poNumber = `PO-${dateTag}-${String((poCount ?? 0) + 1).padStart(3, "0")}`
      const purchaseItems: any[] = []

      for (const row of mobileRows) {
        const buy = parseFloat(row.buyPrice), sell = parseFloat(row.sellPrice) || 0
        let imageUrl: string | null = null
        if (row.imageFile) {
          const ext = row.imageFile.name.split(".").pop() ?? "jpg"
          const path = `mobiles/${tenantId}/${Date.now()}.${ext}`
          const { error: upErr } = await supabase.storage.from("product-images").upload(path, row.imageFile, { upsert: true })
          if (!upErr) { const { data: u } = supabase.storage.from("product-images").getPublicUrl(path); imageUrl = u.publicUrl }
        }

        // Group units by color - each color becomes a separate inventory record
        const colorGroups = new Map<string, MobileUnit[]>()
        for (const unit of row.units) {
          const c = unit.color.trim() || "Unknown"
          if (!colorGroups.has(c)) colorGroups.set(c, [])
          colorGroups.get(c)!.push(unit)
        }

        for (const [color, units] of colorGroups) {
          const qty = units.length
          const { data: existing } = await supabase.from("mobiles").select("id, stock")
            .eq("tenant_id", tenantId).eq("brand", row.brand).eq("model", row.model.trim())
            .eq("color", color).eq("storage", row.storage).maybeSingle()
          const firstImei = units.find(u => u.imei)?.imei ?? null
          let catalogId: string
          if (existing) {
            catalogId = existing.id; origMobileStocks[catalogId] = existing.stock
            const payload: any = { purchase_price: buy, selling_price: sell, supplier_id: selectedSupplierId, ram: row.ram, condition: row.condition, category: row.category, device_type: row.deviceType, stock: existing.stock + qty }
            if (imageUrl) payload.image_url = imageUrl
            if (firstImei) payload.imei = firstImei
            const { error } = await supabase.from("mobiles").update(payload).eq("id", catalogId)
            if (error) throw new Error(`Failed to update ${row.brand} ${row.model} (${color}): ${error.message}`)
            updatedMobileIds.push(catalogId)
          } else {
            const { data: created, error } = await supabase.from("mobiles").insert({ tenant_id: tenantId, brand: row.brand, model: row.model.trim(), color, storage: row.storage, ram: row.ram, condition: row.condition, category: row.category, device_type: row.deviceType, imei: firstImei, purchase_price: buy, selling_price: sell, stock: qty, supplier_id: selectedSupplierId, image_url: imageUrl, date_added: today }).select("id").single()
            if (error) throw new Error(`Failed to create ${row.brand} ${row.model} (${color}): ${error.message}`)
            catalogId = (created as any).id; createdMobileIds.push(catalogId)
          }
          const rowImeis: string[] = []
          for (let ui = 0; ui < units.length; ui++) {
            const unit = units[ui]
            // In edit mode: skip units that are already in DB (sold-locked or existing in_stock)
            if (editMode && unit.soldLocked) {
              if (unit.imei) rowImeis.push(unit.imei)
              continue
            }
            if (editMode && unit.imei.length === 15) {
              // Check if this IMEI already exists in imei_records - skip if so
              const { data: existing } = await supabase
                .from("imei_records").select("id").eq("imei_number", unit.imei).eq("tenant_id", tenantId).maybeSingle()
              if (existing) {
                // Update price/supplier info on existing record instead of inserting
                await supabase.from("imei_records").update({
                  purchase_price: buy, selling_price: sell,
                  supplier_id: selectedSupplierId, supplier_name: selectedSupplier?.companyName ?? "",
                  battery_health: unit.batteryHealth ? parseInt(unit.batteryHealth) : null,
                }).eq("id", (existing as any).id)
                rowImeis.push(unit.imei)
                continue
              }
            }
            const hasRealImei = unit.imei.length === 15
            const imeiValue = hasRealImei
              ? unit.imei
              : `PO-${dateTag}-${catalogId.slice(0, 8)}-${ui}`
            const { error: ie } = await supabase.from("imei_records").insert({
              tenant_id: tenantId,
              product_id: catalogId,
              imei_number: imeiValue,
              brand: row.brand,
              model: row.model.trim(),
              color,
              storage_capacity: row.storage,
              battery_health: unit.batteryHealth ? parseInt(unit.batteryHealth) : null,
              category: row.category,
              pta_status: row.category === "PTA Approved" ? "approved" : "pending",
              device_status: "in_stock",
              purchase_price: buy,
              selling_price: sell,
              supplier_id: selectedSupplierId,
              supplier_name: selectedSupplier?.companyName ?? "",
              purchase_date: today,
            })
            if (ie) throw new Error(`IMEI record insert failed for unit ${ui + 1}: ${ie.message}`)
            if (hasRealImei) {
              rowImeis.push(unit.imei)
              insertedImeis.push(unit.imei)
            }
          }
          purchaseItems.push({ productId: catalogId, productName: `${row.brand} ${row.model.trim()} (${color})`, productType: "Mobile", quantity: qty, returnedQty: 0, unitCost: buy, total: buy * qty, imeis: rowImeis })
        } // end color group
      } // end row

      for (const item of accessoryItems) {
        const buy = parseFloat(item.buyPrice), sell = parseFloat(item.sellPrice) || 0, qty = parseInt(item.qty) || 1
        const { data: cur } = await supabase.from("accessories").select("stock").eq("id", item.catalogId).single()
        const curStock = cur?.stock ?? 0
        origAccessoryStocks[item.catalogId] = curStock
        const { error } = await supabase.from("accessories").update({ purchase_price: buy, selling_price: sell, supplier_id: selectedSupplierId, stock: curStock + qty }).eq("id", item.catalogId)
        if (error) throw new Error(`Failed to update ${item.name}: ${error.message}`)
        updatedAccessoryIds.push(item.catalogId)
        purchaseItems.push({ productId: item.catalogId, productName: item.name, productType: "Accessory", quantity: qty, returnedQty: 0, unitCost: buy, total: buy * qty, imeis: [] })
      }

      const purchaseNotes = [notes || null, overpaidAmt > 0 ? `Advance credit: PKR ${overpaidAmt.toLocaleString()}` : null].filter(Boolean).join(" | ") || null

      if (editMode && editPurchaseId) {
        // â"€â"€ Edit mode: UPDATE existing purchase â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
        // The DB trigger (purchase_item_stock_increment) fires on every INSERT into
        // purchase_items. Stock was already incremented when the purchase was first created.
        // To avoid double-incrementing:
        //   1. Load the old purchase_items to know their quantities.
        //   2. Pre-decrement stock by (new qty) for each product so when the
        //      trigger fires on re-insert it adds back exactly that amount - net zero change
        //      from the current correct stock level.
        //   3. Apply the real delta (new qty âˆ' old qty) manually so final stock = correct.
        //
        // Simplified: pre-set stock to (current âˆ' newQty + oldQty) before the DELETE/INSERT.
        // After trigger fires on INSERT: stock = (current âˆ' newQty + oldQty) + newQty = current + oldQty.
        // Wait, that still double-counts. Correct approach:
        //   Before DELETE/INSERT: stock = stock âˆ' newQty   (pre-decrement)
        //   Trigger on INSERT adds newQty â†' stock = (stock âˆ' newQty) + newQty = stock  âœ"
        //   Then also apply delta (newQty âˆ' oldQty) separately â†' stock = stock + (newQty âˆ' oldQty)  âœ"
        // But we already have the old qty from origItems. The cleanest single step:
        //   Set stock to (currentStock âˆ' newQty) before INSERT, trigger restores it, then
        //   apply delta (newQty âˆ' oldQty) after insert.
        // That equals: currentStock âˆ' newQty + newQty + (newQty âˆ' oldQty) = currentStock + newQty âˆ' oldQty
        // Which is WRONG. We want currentStock + (newQty âˆ' oldQty).
        //
        // Correct all-in-one: before INSERT set stock to (currentStock + oldQty âˆ' newQty âˆ' newQty)
        // = currentStock + oldQty âˆ' 2*newQty. Trigger adds newQty â†' currentStock + oldQty âˆ' newQty. Wrong again.
        //
        // Simplest correct approach: apply delta AFTER the insert trigger fires.
        //   Before DELETE: record currentStock and oldQty per product.
        //   DELETE purchase_items (trigger doesn't fire on delete).
        //   INSERT new purchase_items - trigger fires, increments by newQty.
        //   After insert: set stock = currentStock + (newQty âˆ' oldQty).
        //   = currentStock + newQty âˆ' oldQty (from trigger) â†' need to subtract newQty then add delta
        //   After trigger: stock = currentStock + newQty (wrong, added newQty again).
        //   Patch: stock = currentStock + newQty âˆ' newQty + (newQty âˆ' oldQty) = currentStock + newQty âˆ' oldQty âœ"
        //   So after trigger: UPDATE stock = stock âˆ' newQty + (newQty âˆ' oldQty) = stock âˆ' oldQty
        //   Which = (currentStock + newQty) âˆ' oldQty = currentStock + (newQty âˆ' oldQty) âœ"

        await supabase.from("purchases").update({
          supplier_id: selectedSupplierId,
          supplier_name: selectedSupplier?.companyName ?? "",
          subtotal, total: grandTotal, amount_paid: amountPaid,
          balance_due: balanceDue, payment_status: paymentStatus,
          notes: purchaseNotes,
        }).eq("id", editPurchaseId)

        // Snapshot old purchase_items before deleting
        const { data: origItems } = await supabase
          .from("purchase_items").select("product_id, product_type, quantity")
          .eq("purchase_id", editPurchaseId)
        const oldQtyMap: Record<string, number> = {}
        for (const o of (origItems ?? [])) {
          oldQtyMap[(o as any).product_id] = (o as any).quantity
        }

        // Snapshot current stock before trigger fires
        const stockBefore: Record<string, number> = {}
        for (const pi of purchaseItems) {
          if (pi.productType === "Mobile") {
            const { data } = await supabase.from("mobiles").select("stock").eq("id", pi.productId).single()
            stockBefore[pi.productId] = (data as any)?.stock ?? 0
          } else if (pi.productType === "Accessory") {
            const { data } = await supabase.from("accessories").select("stock").eq("id", pi.productId).single()
            stockBefore[pi.productId] = (data as any)?.stock ?? 0
          }
        }
        // Also snapshot products that were removed entirely
        for (const o of (origItems ?? [])) {
          const pid = (o as any).product_id
          if (!purchaseItems.find(pi => pi.productId === pid) && !stockBefore[pid]) {
            const ptype = (o as any).product_type
            if (ptype === "Mobile") {
              const { data } = await supabase.from("mobiles").select("stock").eq("id", pid).single()
              stockBefore[pid] = (data as any)?.stock ?? 0
            } else if (ptype === "Accessory") {
              const { data } = await supabase.from("accessories").select("stock").eq("id", pid).single()
              stockBefore[pid] = (data as any)?.stock ?? 0
            }
          }
        }

        // Delete old items + re-insert (trigger will add newQty to stock for each)
        await supabase.from("purchase_items").delete().eq("purchase_id", editPurchaseId)
        await supabase.from("purchase_items").insert(
          purchaseItems.map((pi: any) => ({
            tenant_id: tenantId,
            purchase_id: editPurchaseId,
            product_id: pi.productId,
            product_name: pi.productName,
            product_type: pi.productType,
            quantity: pi.quantity,
            returned_qty: 0,
            unit_cost: pi.unitCost,
            total: pi.total,
            imeis: pi.imeis?.length ? pi.imeis : null,
          }))
        )

        // After trigger: stock[pid] = stockBefore[pid] + newQty
        // We want:        stock[pid] = stockBefore[pid] + (newQty âˆ' oldQty)
        // Correction:     stock[pid] âˆ' oldQty  (subtract old qty to undo the old stock it represented)
        for (const pi of purchaseItems) {
          const oldQty = oldQtyMap[pi.productId] ?? 0
          const corrected = (stockBefore[pi.productId] ?? 0) + pi.quantity - oldQty
          if (pi.productType === "Mobile") {
            await supabase.from("mobiles").update({ stock: Math.max(0, corrected) }).eq("id", pi.productId)
          } else if (pi.productType === "Accessory") {
            await supabase.from("accessories").update({ stock: Math.max(0, corrected) }).eq("id", pi.productId)
          }
        }
        // For products removed from the purchase entirely, subtract their old qty
        for (const o of (origItems ?? [])) {
          const pid = (o as any).product_id
          if (purchaseItems.find(pi => pi.productId === pid)) continue
          const oldQty = (o as any).quantity
          const ptype = (o as any).product_type
          const corrected = Math.max(0, (stockBefore[pid] ?? 0) - oldQty)
          if (ptype === "Mobile") {
            await supabase.from("mobiles").update({ stock: corrected }).eq("id", pid)
          } else if (ptype === "Accessory") {
            await supabase.from("accessories").update({ stock: corrected }).eq("id", pid)
          }
        }

        purchaseId = editPurchaseId
      } else {
        // â"€â"€ Create mode: INSERT new purchase â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
        const created = await createPurchase({ poNumber, date: today, supplierId: selectedSupplierId, supplierName: selectedSupplier?.companyName ?? "", subtotal, shippingCost: shipping, tax, total: grandTotal, amountPaid, balanceDue, paymentMethod, paymentStatus, deliveryStatus: "Received", dueDate: dueDate || null, notes: purchaseNotes, items: [] } as any, purchaseItems)
        purchaseId = (created as any).id
      }

      if (amountPaid > 0) {
        const payNotes = overpaidAmt > 0
          ? `Payment for ${poNumber} (includes PKR ${overpaidAmt.toLocaleString()} advance)`
          : `Payment for ${poNumber}`
        await supabase.from("payments").insert({ tenant_id: tenantId, date: today, type: "Paid", entity_type: "Supplier", entity_id: selectedSupplierId, entity_name: selectedSupplier?.companyName ?? "", reference_type: "Purchase", reference_number: poNumber, amount: amountPaid, method: paymentMethod, status: "Completed", notes: payNotes })
      }

      const activeSplits = splits.filter(e => parseFloat(e.amount) > 0)
      for (const se of activeSplits) {
        const amt = parseFloat(se.amount)
        await supabase.from("finance_transactions").insert({ tenant_id: tenantId, date: today, type: "purchase_payment", account_id: se.accountId, amount: amt, reference_type: "Purchase", reference_number: poNumber, description: `Purchase paid - ${poNumber}` })
        const { data: accRow } = await supabase.from("finance_accounts").select("current_balance").eq("id", se.accountId).single()
        if (accRow) {
          const prevBal = (accRow as any).current_balance
          await supabase.from("finance_accounts").update({ current_balance: prevBal - amt }).eq("id", se.accountId).eq("current_balance", prevBal)
        }
      }
      if (activeSplits.length > 0) {
        await supabase.from("purchases").update({ account_id: activeSplits[0].accountId }).eq("po_number", poNumber).eq("tenant_id", tenantId)
      }

      const displayPo = editMode ? (editPoNumber ?? "Purchase") : poNumber
      toast.success(editMode ? `${displayPo} updated!` : `${displayPo} recorded!`, { description: `${purchaseItems.length} item(s) - ${formatCurrency(grandTotal)} - ${paymentStatus}`, duration: 5000 })
      setMobileRows([])
      setAccessoryItems([])
      setSelectedSupplierId("")
      setSupplierSearch("")
      setEditMode(false)
      setEditPoNumber(null)
      setReviewOpen(false)
      onCreated?.()
      onClose()
    } catch (err) {
      if (purchaseId) await supabase.from("purchases").delete().eq("id", purchaseId)
      for (const id of createdMobileIds) await supabase.from("mobiles").delete().eq("id", id)
      for (const id of updatedMobileIds) await supabase.from("mobiles").update({ stock: origMobileStocks[id] ?? 0 }).eq("id", id)
      for (const id of updatedAccessoryIds) await supabase.from("accessories").update({ stock: origAccessoryStocks[id] ?? 0 }).eq("id", id)
      if (insertedImeis.length) await supabase.from("imei_records").delete().in("imei_number", insertedImeis)
      toast.error(err instanceof Error ? err.message : "Purchase failed - rolled back")
      setSubmitting(false)
    }
  }

  // â"€â"€ Progress â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const supplierDone = !!selectedSupplierId
  const phonesDone = mobileRows.length === 0 || mobileRows.every(r => r.brand && r.model && parseFloat(r.buyPrice) > 0)
  const totalItems = mobileRows.length + accessoryItems.length
  const subtotalLive = mobileRows.reduce((s, r) => s + (parseFloat(r.buyPrice) || 0) * (parseInt(r.qty) || 1), 0)
    + accessoryItems.reduce((s, a) => s + (parseFloat(a.buyPrice) || 0) * (parseInt(a.qty) || 1), 0)

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-full max-w-none md:max-w-[680px] p-0 flex flex-col">

        {/* â"€â"€ Header â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-700 px-4 pt-3 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 pr-8">
            <ShoppingBag className="w-4 h-4 text-white/80 shrink-0" />
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm">{editMode ? `Edit Purchase${editPoNumber ? ` - ${editPoNumber}` : ""}` : "New Purchase Order"}</SheetTitle>
              <SheetDescription className="text-[11px]">{editMode ? "Update purchase details - sold items are locked" : "Add phones & accessories from your supplier"}</SheetDescription>
            </div>
            {/* Live total in header */}
            {subtotalLive > 0 && (
              <span className="text-xs font-extrabold text-white tabular-nums shrink-0">
                {formatCurrency(subtotalLive)}
              </span>
            )}
          </div>

          {/* Progress steps */}
          <div className="mt-2.5 flex items-center gap-0">
            <StepDot n={1} active={!supplierDone} done={supplierDone} label="Supplier" />
            <div className={cn("flex-1 h-px mx-1 rounded transition-colors", supplierDone ? "bg-white/40" : "bg-white/15")} />
            <StepDot n={2} active={supplierDone && !phonesDone} done={supplierDone && phonesDone} label="Items" />
            <div className={cn("flex-1 h-px mx-1 rounded transition-colors", supplierDone && phonesDone ? "bg-white/40" : "bg-white/15")} />
            <StepDot n={3} active={supplierDone && phonesDone} done={false} label="Review" />
          </div>
        </div>

        {/* â"€â"€ Scrollable body â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
        <div className="flex-1 overflow-y-auto">
          {dataLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" />
              <p className="text-xs text-slate-400">Loading...</p>
            </div>
          ) : (
            <div className="p-3 space-y-2.5">

              {/* â•â• Step 1: Supplier â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              <section>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Supplier <span className="text-red-400">*</span></p>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none z-10" />
                  <input
                    placeholder="Search supplier..."
                    value={supplierSearch}
                    onChange={e => { setSupplierSearch(e.target.value); setDropOpen(true); if (!e.target.value) setSelectedSupplierId("") }}
                    onFocus={() => setDropOpen(true)}
                    className={cn(
                      "w-full h-8 rounded-lg border pl-8 pr-8 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 transition-colors",
                      selectedSupplier ? "border-emerald-400 bg-emerald-50/40" : "border-slate-200"
                    )}
                  />
                  {selectedSupplier && !dropOpen && (
                    <>
                      <Check className="absolute right-7 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500 pointer-events-none" />
                      <button onClick={() => { setSelectedSupplierId(""); setSupplierSearch("") }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400">
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {dropOpen && (
                    <>
                      <div className="absolute z-50 mt-0.5 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                        <div className="max-h-40 overflow-y-auto">
                          {filteredSuppliers.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center">No suppliers found</div>
                          ) : filteredSuppliers.map(s => (
                            <button key={s.id} type="button" disabled={s.status === "Inactive"}
                              className={cn("w-full text-left px-3 py-2 text-xs hover:bg-violet-50 flex items-center gap-2 transition-colors", s.id === selectedSupplierId ? "bg-violet-50 text-violet-700 font-semibold" : "text-slate-700", s.status === "Inactive" && "opacity-40 cursor-not-allowed")}
                              onClick={() => { setSelectedSupplierId(s.id); setSupplierSearch(s.companyName); setDropOpen(false) }}>
                              <span className="truncate">{s.companyName}</span>
                              {s.city && <span className="text-slate-400 ml-auto shrink-0 text-[10px]">{s.city}</span>}
                              {s.id === selectedSupplierId && <Check className="w-3 h-3 text-violet-600 shrink-0" />}
                            </button>
                          ))}
                        </div>
                        {/* Quick-add new supplier from dropdown */}
                        <button type="button"
                          onClick={() => { setDropOpen(false); setShowQuickSupplier(true); setQuickSupplierName(supplierSearch) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-violet-600 font-semibold bg-violet-50 hover:bg-violet-100 border-t border-violet-100 transition-colors">
                          <Plus className="w-3 h-3" />
                          {supplierSearch.trim() ? `Add "${supplierSearch.trim()}" as supplier` : "Add new supplier"}
                        </button>
                      </div>
                      <div className="fixed inset-0 z-40" onClick={() => setDropOpen(false)} />
                    </>
                  )}
                </div>

                {/* Quick-add supplier form */}
                {showQuickSupplier && (
                  <div className="mt-1.5 rounded-lg border border-violet-200 bg-violet-50/50 p-2.5 space-y-2">
                    <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">New Supplier</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="col-span-3">
                        <input
                          autoFocus
                          value={quickSupplierName}
                          onChange={e => setQuickSupplierName(e.target.value)}
                          placeholder="Company / Shop name *"
                          className="w-full h-7 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                        />
                      </div>
                      <input
                        value={quickSupplierPhone}
                        onChange={e => setQuickSupplierPhone(e.target.value)}
                        placeholder="Phone"
                        className="h-7 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                      <input
                        value={quickSupplierCity}
                        onChange={e => setQuickSupplierCity(e.target.value)}
                        placeholder="City"
                        className="h-7 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                      <div className="col-span-3">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-semibold">Rs</span>
                          <input
                            type="number" onWheel={e => e.currentTarget.blur()}
                            min="0"
                            value={quickSupplierBalance}
                            onChange={e => setQuickSupplierBalance(e.target.value)}
                            placeholder="Opening balance (what you already owe them)"
                            className="w-full h-7 rounded-md border border-slate-200 pl-7 pr-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={handleQuickAddSupplier} disabled={!quickSupplierName.trim() || savingSupplier}
                        className="flex-1 h-7 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors">
                        {savingSupplier ? "Saving..." : "Save Supplier"}
                      </button>
                      <button onClick={() => { setShowQuickSupplier(false); setQuickSupplierName(""); setQuickSupplierPhone(""); setQuickSupplierCity(""); setQuickSupplierBalance("") }}
                        className="h-7 px-3 rounded-md border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* â•â• Step 2: Mobile Phones â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              <section>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Phones
                    <span className="font-normal normal-case ml-1 text-slate-300">(optional)</span>
                  </p>
                  {mobileRows.length > 0 && <span className="text-[10px] text-violet-600 font-bold">{mobileRows.length}</span>}

                  {/* Add custom category */}
                  <div className="ml-auto">
                    {!showAddCategory ? (
                      <button onClick={() => setShowAddCategory(true)}
                        className="text-[10px] text-slate-300 hover:text-violet-500 flex items-center gap-0.5 transition-colors">
                        <Settings2 className="w-3 h-3" /> + category
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {/* Device type selector */}
                        <div className="flex rounded-md border border-violet-200 overflow-hidden text-[10px] font-semibold">
                          <button
                            onClick={() => setAddCategoryTarget("iphone")}
                            className={cn("px-2 py-0.5 transition-colors", addCategoryTarget === "iphone" ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-violet-50")}>
                            iPhone
                          </button>
                          <button
                            onClick={() => setAddCategoryTarget("android")}
                            className={cn("px-2 py-0.5 transition-colors", addCategoryTarget === "android" ? "bg-violet-600 text-white" : "bg-white text-slate-500 hover:bg-violet-50")}>
                            Android
                          </button>
                        </div>
                        <input autoFocus value={newCategoryInput} onChange={e => setNewCategoryInput(e.target.value)}
                          placeholder="e.g. CPO" maxLength={20}
                          className="border border-violet-300 rounded px-1.5 py-0.5 text-xs focus:outline-none w-20"
                          onKeyDown={e => {
                            if (e.key === "Enter" && newCategoryInput.trim()) {
                              const v = newCategoryInput.trim()
                              if (addCategoryTarget === "iphone") setExtraIphoneCategories(p => Array.from(new Set([...p, v])))
                              else setExtraAndroidCategories(p => Array.from(new Set([...p, v])))
                              setNewCategoryInput(""); setShowAddCategory(false)
                            }
                            if (e.key === "Escape") { setShowAddCategory(false); setNewCategoryInput("") }
                          }} />
                        <button onClick={() => {
                          const v = newCategoryInput.trim()
                          if (v) {
                            if (addCategoryTarget === "iphone") setExtraIphoneCategories(p => Array.from(new Set([...p, v])))
                            else setExtraAndroidCategories(p => Array.from(new Set([...p, v])))
                          }
                          setNewCategoryInput(""); setShowAddCategory(false)
                        }} className="px-1.5 py-0.5 bg-violet-600 text-white text-[10px] rounded hover:bg-violet-700">+</button>
                        <button onClick={() => { setShowAddCategory(false); setNewCategoryInput("") }} className="text-slate-400 text-xs">âœ•</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Extra category chips */}
                {(extraIphoneCategories.length > 0 || extraAndroidCategories.length > 0) && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {extraIphoneCategories.map(c => (
                      <span key={`ip-${c}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-[9px] rounded-full">
                        iPhone: {c}
                        <button onClick={() => setExtraIphoneCategories(p => p.filter(x => x !== c))} className="text-blue-300 hover:text-red-500">âœ•</button>
                      </span>
                    ))}
                    {extraAndroidCategories.map(c => (
                      <span key={`an-${c}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] rounded-full">
                        Android: {c}
                        <button onClick={() => setExtraAndroidCategories(p => p.filter(x => x !== c))} className="text-emerald-300 hover:text-red-500">âœ•</button>
                      </span>
                    ))}
                  </div>
                )}

                {mobileRows.length === 0 ? (
                  <button onClick={addRow}
                    className="w-full flex flex-col items-center justify-center gap-1.5 py-5 border border-dashed border-slate-200 text-slate-400 text-xs rounded-lg hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/30 transition-all">
                    <Smartphone className="w-5 h-5 opacity-40" />
                    <span className="font-medium">Add phones to this order</span>
                    <span className="text-[10px] text-slate-300">Optional - skip if purchasing accessories only</span>
                  </button>
                ) : (
                  <>
                    <div className="space-y-3">
                      {mobileRows.map((row, idx) => (
                        <PhoneCard
                          key={row.uid}
                          row={row}
                          idx={idx}
                          brands={brands}
                          models={models}
                          colors={colors}
                          storageOptions={storageOptions}
                          ramOptions={ramOptions}
                          extraIphoneCategories={extraIphoneCategories}
                          extraAndroidCategories={extraAndroidCategories}
                          locks={phoneLocks}
                          onToggleLock={togglePhoneLock}
                          onChange={(key, val) => updateRow(row.uid, key, val)}
                          onUnit={(ui, field, val) => updateUnit(row.uid, ui, field, val)}
                          onRemove={() => removeRow(row.uid)}
                          onDuplicate={() => duplicateRow(row.uid)}
                          onSplitQty={() => splitRow(row.uid)}
                          onImageUpload={file => {
                            const url = URL.createObjectURL(file)
                            setMobileRows(prev => prev.map(r => r.uid === row.uid ? { ...r, imageFile: file, imagePreview: url } : r))
                          }}
                          onAddBrand={handleAddBrand}
                          onEditBrand={handleEditBrand}
                          onDeleteBrand={handleDeleteBrand}
                          onAddModel={makeHandleAddModel(row.brand)}
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
                          onCheckImei={(ui, imei) => checkImei(row.uid, ui, imei)}
                        />
                      ))}
                    </div>
                    <button onClick={addRow}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-violet-200 text-violet-500 text-xs font-medium rounded-lg hover:border-violet-400 hover:bg-violet-50/50 transition-all">
                      <Plus className="w-3.5 h-3.5" />
                      Add Another Phone
                    </button>
                  </>
                )}
              </section>

              {/* â•â• Step 3: Accessories â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
              <section className="border-t border-slate-100 pt-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Accessories
                    <span className="font-normal normal-case ml-1 text-slate-300">(optional)</span>
                    {accessoryItems.length > 0 && <span className="ml-1 text-emerald-500">{accessoryItems.length}</span>}
                  </p>
                  <button onClick={() => setShowCatalog(v => !v)}
                    className="ml-auto text-[10px] text-emerald-600 font-semibold px-2 py-1 border border-emerald-200 rounded hover:bg-emerald-50 transition-colors flex items-center gap-1">
                    <Search className="w-3 h-3" />
                    Browse ({accessoryCatalog.length})
                  </button>
                </div>

                {showCatalog && (
                  <div className="mb-2">
                    <div className="relative mb-1.5">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      <input placeholder="Search accessories..." value={accessorySearch} onChange={e => setAccessorySearch(e.target.value)}
                        className="w-full h-7 rounded-md border border-slate-200 pl-7 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                      {filteredAccessories.map(a => {
                        const added = accessoryInCart.has(a.id)
                        return (
                          <div key={a.id} className={cn("rounded-lg border p-2 cursor-pointer transition-all flex items-center gap-2", added ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300")}
                            onClick={() => toggleAccessory(a)}>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold text-slate-800 truncate">{a.name}</p>
                              <p className="text-[9px] text-slate-400 truncate">{a.brand}</p>
                            </div>
                            <div className={cn("w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all", added ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400")}>
                              {added ? <Check className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                            </div>
                          </div>
                        )
                      })}
                      {filteredAccessories.length === 0 && <div className="col-span-2 text-center py-4 text-slate-400 text-xs">No accessories found</div>}
                    </div>
                  </div>
                )}

                {accessoryItems.length > 0 && (
                  <div className="space-y-1.5">
                    {accessoryItems.map(item => (
                      <div key={item.uid} className="rounded-lg border border-emerald-100 bg-emerald-50/30 px-2.5 py-2">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Headphones className="w-3 h-3 text-emerald-500 shrink-0" />
                          <p className="text-[11px] font-semibold text-slate-800 truncate flex-1">{item.name}</p>
                          <button onClick={() => setAccessoryItems(p => p.filter(a => a.uid !== item.uid))} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                            <XIcon className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <Field label="Buy Rs *">
                            <input type="number" onWheel={e => e.currentTarget.blur()} min={0} placeholder="0" value={item.buyPrice}
                              onChange={e => setAccessoryItems(p => p.map(a => a.uid === item.uid ? { ...a, buyPrice: e.target.value } : a))}
                              className={cn("w-full h-7 rounded-md border px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400", !item.buyPrice ? "border-amber-300" : "border-slate-200")} />
                          </Field>
                          <Field label="Sell Rs">
                            <input type="number" onWheel={e => e.currentTarget.blur()} min={0} placeholder="0" value={item.sellPrice}
                              onChange={e => setAccessoryItems(p => p.map(a => a.uid === item.uid ? { ...a, sellPrice: e.target.value } : a))}
                              className="w-full h-7 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400" />
                          </Field>
                          <Field label="Qty">
                            <input type="number" onWheel={e => e.currentTarget.blur()} min={1} value={item.qty}
                              onChange={e => setAccessoryItems(p => p.map(a => a.uid === item.uid ? { ...a, qty: e.target.value } : a))}
                              className="w-full h-7 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-violet-400" />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-3 py-2.5">
          <Button
            type="button"
            onClick={handleOpenReview}
            disabled={dataLoading}
            className={cn(
              "w-full h-9 font-bold text-sm gap-2 transition-all",
              selectedSupplierId && totalItems > 0
                ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            <ShoppingCart className="w-4 h-4" />
            Review & Confirm
            {totalItems > 0 && <span className="ml-1 text-xs opacity-80">- {totalItems} item{totalItems !== 1 ? "s" : ""} - {formatCurrency(subtotalLive)}</span>}
          </Button>
        </div>

      </SheetContent>

      <ReviewOrderModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        mobileRows={mobileRows}
        accessoryItems={accessoryItems}
        onConfirm={handleConfirmPurchase}
        submitting={submitting}
        accounts={accounts}
        supplier={selectedSupplier}
      />

    </Sheet>
  )
}

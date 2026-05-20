"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import {
  Plus, Search, Pencil, Trash2, X, FileText, TrendingDown,
  Calendar, AlertCircle, CheckCircle2, Clock, Receipt,
  Banknote, CreditCard, Smartphone, Building2, Zap,
  Tag, Filter, RotateCcw, ChevronDown, ChevronUp,
  Repeat2, Layers, DollarSign, BarChart3,
} from "lucide-react"
import { format, parseISO, startOfMonth, startOfYear, isWithinInterval, endOfMonth } from "date-fns"
import { toast } from "sonner"

import { getExpenses, createExpense, updateExpense, deleteExpense } from "@/lib/api/expenses"
import { getFinanceAccounts } from "@/lib/api/finance"
import { Expense, ExpenseCategory, ExpenseType, ExpensePayment } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, cn, todayPKT } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"

// ─── Constants ────────────────────────────────────────────────────────────────

const _now = new Date()
const TODAY = todayPKT()
const THIS_MONTH = TODAY.substring(0, 7)
const THIS_YEAR = TODAY.substring(0, 4)

const CATEGORIES: ExpenseCategory[] = [
  "Rent",
  "Electricity",
  "Internet & Phone",
  "Staff Salaries",
  "Marketing & Advertising",
  "Packaging & Supplies",
  "Repair & Maintenance",
  "Transport",
  "Equipment & Furniture",
  "Shop License & Taxes",
  "Miscellaneous",
]

const CATEGORY_META: Record<ExpenseCategory, { color: string; bg: string; border: string; dot: string }> = {
  "Rent":                   { color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200",  dot: "bg-purple-500"  },
  "Electricity":            { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500"   },
  "Internet & Phone":       { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500"    },
  "Staff Salaries":         { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  "Marketing & Advertising":{ color: "text-pink-700",    bg: "bg-pink-50",    border: "border-pink-200",    dot: "bg-pink-500"    },
  "Packaging & Supplies":   { color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200",  dot: "bg-orange-500"  },
  "Repair & Maintenance":   { color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500"     },
  "Transport":              { color: "text-cyan-700",    bg: "bg-cyan-50",    border: "border-cyan-200",    dot: "bg-cyan-500"    },
  "Equipment & Furniture":  { color: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200",  dot: "bg-indigo-500"  },
  "Shop License & Taxes":   { color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200",    dot: "bg-rose-500"    },
  "Miscellaneous":          { color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200",   dot: "bg-slate-400"   },
}

const TYPE_META: Record<ExpenseType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  "one-time": { label: "One-Time",  icon: <Receipt className="h-3 w-3" />,  color: "text-slate-600", bg: "bg-slate-100" },
  "daily":    { label: "Daily",     icon: <Calendar className="h-3 w-3" />,  color: "text-blue-600",  bg: "bg-blue-50"   },
  "monthly":  { label: "Monthly",   icon: <Repeat2 className="h-3 w-3" />,   color: "text-violet-600",bg: "bg-violet-50" },
  "yearly":   { label: "Yearly",    icon: <BarChart3 className="h-3 w-3" />, color: "text-amber-600", bg: "bg-amber-50"  },
}

const PAYMENT_META: Record<ExpensePayment, { icon: React.ReactNode; color: string }> = {
  "Cash":          { icon: <Banknote className="h-3.5 w-3.5" />,   color: "text-emerald-600" },
  "Bank Transfer": { icon: <Building2 className="h-3.5 w-3.5" />,  color: "text-purple-600"  },
  "JazzCash":      { icon: <Smartphone className="h-3.5 w-3.5" />, color: "text-red-600"     },
  "EasyPaisa":     { icon: <Zap className="h-3.5 w-3.5" />,        color: "text-green-600"   },
  "Card":          { icon: <CreditCard className="h-3.5 w-3.5" />, color: "text-blue-600"    },
}

const PAYMENT_OPTIONS: ExpensePayment[] = ["Cash", "Bank Transfer", "JazzCash", "EasyPaisa", "Card"]

// ─── Types ────────────────────────────────────────────────────────────────────

type TabType = "all" | "daily" | "monthly" | "yearly" | "one-time" | "recurring"

interface ExpenseForm {
  title: string
  category: ExpenseCategory | ""
  amount: string
  date: string
  type: ExpenseType
  paymentMethod: ExpensePayment
  accountId: string
  status: "Paid" | "Pending"
  isRecurring: boolean
  recurringDay: string
  recurringMonth: string
  notes: string
}

const defaultForm: ExpenseForm = {
  title: "", category: "", amount: "", date: TODAY,
  type: "one-time", paymentMethod: "Cash", accountId: "", status: "Paid",
  isRecurring: false, recurringDay: "1", recurringMonth: "1", notes: "",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeId() { return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ cat }: { cat: ExpenseCategory }) {
  const m = CATEGORY_META[cat]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border", m.color, m.bg, m.border)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", m.dot)} />
      {cat}
    </span>
  )
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ExpenseType }) {
  const m = TYPE_META[type]
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg", m.color, m.bg)}>
      {m.icon} {m.label}
    </span>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "Paid" | "Pending" }) {
  return status === "Paid"
    ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3 w-3" /> Paid</span>
    : <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><Clock className="h-3 w-3" /> Pending</span>
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, amount, count, countLabel, iconBg, icon, trend }: {
  label: string; amount: number; count: number; countLabel: string
  icon: React.ReactNode; iconBg: string; trend?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white px-4 py-3 border border-slate-100 border-t-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200" style={{}}>
      <div className="flex items-center justify-between mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-sm", iconBg)}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-bold text-slate-900 leading-none tracking-tight mb-1 truncate">{formatCurrency(amount)}</p>
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{count} {countLabel}{trend ? ` · ${trend}` : ""}</p>
    </div>
  )
}

// ─── Add/Edit Drawer ─────────────────────────────────────────────────────────

function ExpenseDrawer({ open, onClose, editing, onSave, accounts, defaultAccountId }: {
  open: boolean
  onClose: () => void
  editing: Expense | null
  onSave: (form: ExpenseForm) => void
  accounts: FinanceAccount[]
  defaultAccountId: string
}) {
  const [form, setForm] = useState<ExpenseForm>(defaultForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title,
        category: editing.category,
        amount: String(editing.amount),
        date: editing.date,
        type: editing.type,
        paymentMethod: editing.paymentMethod,
        accountId: defaultAccountId,
        status: editing.status,
        isRecurring: editing.isRecurring,
        recurringDay: String(editing.recurringDay ?? 1),
        recurringMonth: String(editing.recurringMonth ?? 1),
        notes: editing.notes ?? "",
      })
    } else {
      setForm({ ...defaultForm, accountId: defaultAccountId })
    }
    setErrors({})
  }, [editing, open, defaultAccountId])

  function up<K extends keyof ExpenseForm>(key: K, val: ExpenseForm[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.title.trim()) errs.title = "Title is required"
    if (!form.category) errs.category = "Category is required"
    if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = "Valid amount required"
    if (!form.date) errs.date = "Date is required"
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSave(form)
    onClose()
  }

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn("fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none")}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={cn(
        "fixed right-0 top-0 h-full w-full sm:w-[560px] bg-white z-50 shadow-2xl flex flex-col",
        "transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Header */}
        <div className={cn("shrink-0 px-6 py-5", editing ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "bg-gradient-to-r from-rose-500 to-pink-600")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                {editing ? <Pencil className="w-5 h-5 text-white" /> : <Plus className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{editing ? "Edit Expense" : "Add New Expense"}</h2>
                <p className="text-xs text-white/70 mt-0.5">{editing ? "Update expense details" : "Record a new business expense"}</p>
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Basic Info */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Expense Details</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Title / Description <span className="text-red-500">*</span></Label>
                <Input value={form.title} onChange={e => up("title", e.target.value)}
                  placeholder="e.g. Shop Rent, Electricity Bill..." className={cn("h-9 text-sm", errors.title && "border-red-400")} />
                {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Category <span className="text-red-500">*</span></Label>
                <Select value={form.category} onValueChange={val => up("category", val as ExpenseCategory)}>
                  <SelectTrigger className={cn("h-9 text-sm", errors.category && "border-red-400")}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>
                        <span className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", CATEGORY_META[c].dot)} />
                          {c}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-red-500">{errors.category}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Amount */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Amount (₨) <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">Rs</span>
                    <Input type="number" min={0} value={form.amount} onChange={e => up("amount", e.target.value)}
                      placeholder="0" className={cn("pl-9 h-9 text-sm font-bold", errors.amount && "border-red-400")} />
                  </div>
                  {errors.amount && <p className="text-xs text-red-500">{errors.amount}</p>}
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">Date <span className="text-red-500">*</span></Label>
                  <Input type="date" value={form.date} onChange={e => up("date", e.target.value)}
                    className={cn("h-9 text-sm", errors.date && "border-red-400")} />
                  {errors.date && <p className="text-xs text-red-500">{errors.date}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Expense Type */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-violet-50 border-b border-violet-100">
              <Repeat2 className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Expense Type</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Type picker */}
              <div className="grid grid-cols-2 gap-2">
                {(["one-time", "daily", "monthly", "yearly"] as ExpenseType[]).map(t => {
                  const m = TYPE_META[t]
                  return (
                    <button key={t} type="button" onClick={() => {
                      up("type", t)
                      up("isRecurring", t === "monthly" || t === "yearly")
                    }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                        form.type === t
                          ? `border-current ${m.color} ${m.bg} shadow-sm`
                          : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
                      )}>
                      {m.icon} {m.label}
                    </button>
                  )
                })}
              </div>

              {/* Recurring day (monthly) */}
              {form.type === "monthly" && (
                <div className="space-y-1.5 p-3 bg-violet-50 rounded-xl border border-violet-100">
                  <Label className="text-xs font-semibold text-violet-700">Recurring Day of Month</Label>
                  <Select value={form.recurringDay} onValueChange={val => up("recurringDay", val)}>
                    <SelectTrigger className="h-9 text-sm bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <SelectItem key={d} value={String(d)}>Day {d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"} of every month</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Recurring month + day (yearly) */}
              {form.type === "yearly" && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 space-y-2">
                  <Label className="text-xs font-semibold text-amber-700">Recurring Every Year On</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={form.recurringMonth} onValueChange={val => up("recurringMonth", val)}>
                      <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={form.recurringDay} onValueChange={val => up("recurringDay", val)}>
                      <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                          <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payment */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border-b border-emerald-100">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Payment</span>
            </div>
            <div className="p-4 space-y-3">
              {/* Account selector — deducts from Finance account when Paid */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Pay From Account</Label>
                {accounts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1.5">
                    {accounts.map(a => {
                      const isSelected = form.accountId === a.id
                      const typeColor = a.type === "cash" ? "emerald" : a.type === "bank" ? "purple" : "red"
                      return (
                        <button
                          key={a.id} type="button"
                          onClick={() => {
                            up("accountId", a.id)
                            up("paymentMethod", a.type === "cash" ? "Cash" : a.type === "bank" ? "Bank Transfer" : (a.bankName as ExpensePayment) || "Cash")
                          }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all text-left",
                            isSelected
                              ? `border-${typeColor}-500 bg-${typeColor}-50 text-${typeColor}-800`
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          )}
                        >
                          <span>{a.name}</span>
                          <span className={cn("text-[10px] font-bold", isSelected ? "" : "text-slate-400")}>
                            Rs {a.currentBalance.toLocaleString()}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {PAYMENT_OPTIONS.map(p => {
                      const pm = PAYMENT_META[p]
                      return (
                        <button key={p} type="button" onClick={() => up("paymentMethod", p)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                            form.paymentMethod === p
                              ? `${pm.color} bg-slate-800 text-white border-slate-800`
                              : `${pm.color} bg-white border-slate-200 hover:border-slate-300`
                          )}>
                          {pm.icon} {p}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Payment Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => up("status", "Paid")}
                    className={cn("flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all",
                      form.status === "Paid" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                    <CheckCircle2 className="h-4 w-4" /> Paid
                  </button>
                  <button type="button" onClick={() => up("status", "Pending")}
                    className={cn("flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all",
                      form.status === "Pending" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:border-slate-300")}>
                    <Clock className="h-4 w-4" /> Pending
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Notes</span>
              <span className="text-[10px] text-slate-400 ml-1">(optional)</span>
            </div>
            <div className="p-4">
              <Textarea value={form.notes} onChange={e => up("notes", e.target.value)}
                placeholder="Additional details, reference number, vendor name..." rows={3}
                className="text-sm resize-none bg-slate-50" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 flex items-center gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="w-28">Cancel</Button>
          <Button type="button" onClick={handleSave}
            className={cn("ml-auto px-6", editing ? "bg-blue-600 hover:bg-blue-700" : "bg-rose-600 hover:bg-rose-700")}>
            {editing ? "Save Changes" : "Add Expense"}
          </Button>
        </div>
      </div>
    </>
  )
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteDialog({ open, expense, onConfirm, onCancel }: {
  open: boolean; expense: Expense | null; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" /> Delete Expense
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          Are you sure you want to delete <span className="font-bold">&quot;{expense?.title}&quot;</span>?
          This action cannot be undone.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [list, setList] = useState<Expense[]>([])
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([])
  const [defaultAccountId, setDefaultAccountId] = useState("")
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabType>("all")
  const [search, setSearch] = useState("")
  const [catFilter, setCatFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [payFilter, setPayFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [sortField, setSortField] = useState<"date" | "amount" | "title">("date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [data, accs] = await Promise.all([getExpenses(), getFinanceAccounts()])
        setList(data)
        setFinanceAccounts(accs)
        const defAcc = accs.find(a => a.isDefaultCash) ?? accs[0]
        if (defAcc) setDefaultAccountId(defAcc.id)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch expenses")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const todayList  = list.filter(e => e.date === TODAY)
    const monthList  = list.filter(e => e.date.startsWith(THIS_MONTH))
    const yearList   = list.filter(e => e.date.startsWith(THIS_YEAR))
    const pendList   = list.filter(e => e.status === "Pending")

    return {
      today:   { amount: todayList.reduce((s, e) => s + e.amount, 0),  count: todayList.length  },
      month:   { amount: monthList.reduce((s, e) => s + e.amount, 0),  count: monthList.length  },
      year:    { amount: yearList.reduce((s, e) => s + e.amount, 0),   count: yearList.length   },
      pending: { amount: pendList.reduce((s, e) => s + e.amount, 0),   count: pendList.length   },
    }
  }, [list])

  // ── Category breakdown (this month) ──────────────────────────────────────────

  const categoryBreakdown = useMemo(() => {
    const monthList = list.filter(e => e.date.startsWith(THIS_MONTH) && e.status === "Paid")
    const total = monthList.reduce((s, e) => s + e.amount, 0)
    const map = new Map<ExpenseCategory, number>()
    monthList.forEach(e => map.set(e.category, (map.get(e.category) ?? 0) + e.amount))
    return Array.from(map.entries())
      .map(([cat, amount]) => ({ cat, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount)
  }, [list])

  // ── Filtered + sorted list ────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = list.filter(e => {
      if (tab === "recurring") return e.isRecurring
      if (tab !== "all") return e.type === tab
      return true
    })

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(e => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.notes?.toLowerCase().includes(q))
    }
    if (catFilter !== "all") result = result.filter(e => e.category === catFilter)
    if (statusFilter !== "all") result = result.filter(e => e.status === statusFilter)
    if (payFilter !== "all") result = result.filter(e => e.paymentMethod === payFilter)
    if (dateFrom) result = result.filter(e => e.date >= dateFrom)
    if (dateTo) result = result.filter(e => e.date <= dateTo)

    result.sort((a, b) => {
      let cmp = 0
      if (sortField === "date") cmp = a.date.localeCompare(b.date)
      else if (sortField === "amount") cmp = a.amount - b.amount
      else cmp = a.title.localeCompare(b.title)
      return sortDir === "asc" ? cmp : -cmp
    })
    return result
  }, [list, tab, search, catFilter, statusFilter, payFilter, dateFrom, dateTo, sortField, sortDir])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleOpenAdd() { setEditing(null); setDrawerOpen(true) }
  function handleOpenEdit(e: Expense) { setEditing(e); setDrawerOpen(true) }

  async function handleSave(form: ExpenseForm) {
    try {
      const amount = parseFloat(form.amount)
      const expenseData = {
        title: form.title,
        category: form.category as ExpenseCategory,
        amount,
        date: form.date,
        type: form.type,
        paymentMethod: form.paymentMethod,
        status: form.status,
        isRecurring: form.isRecurring,
        notes: form.notes || undefined,
        recurringDay: form.isRecurring ? parseInt(form.recurringDay) : undefined,
        recurringMonth: form.type === "yearly" ? parseInt(form.recurringMonth) : undefined,
      }
      if (editing) {
        const updated = await updateExpense(editing.id, expenseData)
        setList(prev => prev.map(e => e.id === editing.id ? updated : e))
        toast.success("Expense updated")
      } else {
        const { supabase } = await import("@/lib/supabase")
        const { getTenantId } = await import("@/lib/api/helpers")
        const created = await createExpense(expenseData as Omit<Expense, 'id'>)
        setList(prev => [created, ...prev])

        // ── Finance: debit from selected account when Paid ─────────────────
        if (form.status === "Paid" && form.accountId) {
          const tenantId = await getTenantId()
          await supabase.from("finance_transactions").insert({
            tenant_id: tenantId, date: form.date,
            type: "expense",
            account_id: form.accountId,
            amount,
            reference_type: "Expense",
            reference_id: created.id,
            description: `Expense — ${form.title}`,
          })
          const { data: accRow } = await supabase
            .from("finance_accounts").select("current_balance").eq("id", form.accountId).single()
          if (accRow) {
            const newBal = Math.max(0, (accRow as any).current_balance - amount)
            await supabase.from("finance_accounts").update({ current_balance: newBal }).eq("id", form.accountId)
            setFinanceAccounts(prev => prev.map(a => a.id === form.accountId ? { ...a, currentBalance: newBal } : a))
          }
          // Tag the expense with the account
          await supabase.from("expenses").update({ account_id: form.accountId }).eq("id", created.id)
        }

        toast.success("Expense added")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save expense")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteExpense(deleteTarget.id)
      setList(prev => prev.filter(e => e.id !== deleteTarget.id))
      toast.success("Expense deleted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense")
    }
    setDeleteTarget(null)
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  function clearFilters() {
    setSearch(""); setCatFilter("all"); setStatusFilter("all")
    setPayFilter("all"); setDateFrom(""); setDateTo("")
  }

  const hasActiveFilters = search || catFilter !== "all" || statusFilter !== "all" || payFilter !== "all" || dateFrom || dateTo

  const TABS: { key: TabType; label: string; count: number }[] = [
    { key: "all",      label: "All Expenses", count: list.length },
    { key: "daily",    label: "Daily",        count: list.filter(e => e.type === "daily").length },
    { key: "one-time", label: "One-Time",     count: list.filter(e => e.type === "one-time").length },
    { key: "monthly",  label: "Monthly",      count: list.filter(e => e.type === "monthly").length },
    { key: "yearly",   label: "Yearly",       count: list.filter(e => e.type === "yearly").length },
    { key: "recurring",label: "Recurring",    count: list.filter(e => e.isRecurring).length },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">

        {/* ── Page Header ── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Expenses</h1>
            <p className="text-xs text-slate-500">Track and manage all shop expenses — daily, monthly & yearly</p>
          </div>
          <Button onClick={handleOpenAdd}
            className="bg-rose-600 hover:bg-rose-700 gap-1.5 h-8 text-xs px-3">
            <Plus className="h-3.5 w-3.5" /> Add Expense
          </Button>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-4 gap-2.5">
          <StatCard
            label="Today's Expenses" amount={stats.today.amount} count={stats.today.count}
            countLabel="transactions" icon={<TrendingDown className="h-4 w-4 text-white" />}
            iconBg="bg-rose-500"
          />
          <StatCard
            label="This Month" amount={stats.month.amount} count={stats.month.count}
            countLabel="expenses" icon={<Calendar className="h-4 w-4 text-white" />}
            iconBg="bg-blue-600"
            trend={format(_now, "MMM yyyy")}
          />
          <StatCard
            label="This Year" amount={stats.year.amount} count={stats.year.count}
            countLabel="expenses" icon={<BarChart3 className="h-4 w-4 text-white" />}
            iconBg="bg-violet-600"
            trend={THIS_YEAR}
          />
          <StatCard
            label="Pending Payment" amount={stats.pending.amount} count={stats.pending.count}
            countLabel="unpaid" icon={<Clock className="h-4 w-4 text-white" />}
            iconBg="bg-amber-500"
          />
        </div>

        {/* ── Two-column layout: Table (left) + Breakdown (right) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">

          {/* ── Left: Table area ── */}
          <div className="space-y-3">

            {/* Tabs */}
            <div className="flex gap-0.5 bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm overflow-x-auto">
              {TABS.map(({ key, label, count }) => (
                <button key={key} type="button" onClick={() => setTab(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                    tab === key
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                  )}>
                  {label}
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                    tab === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {/* Filters */}
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search title, category, notes..." className="pl-8 h-8 text-xs" />
                  </div>
                  {/* Toggle filters */}
                  <Button variant="outline" size="sm" onClick={() => setShowFilters(v => !v)}
                    className={cn("gap-1.5 h-8 text-xs", hasActiveFilters && "border-rose-300 text-rose-600 bg-rose-50")}>
                    <Filter className="h-3 w-3" />
                    Filters
                    {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
                    {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-8 text-xs text-slate-500">
                      <RotateCcw className="h-3 w-3" /> Reset
                    </Button>
                  )}
                </div>

                {showFilters && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-100">
                    <Select value={catFilter} onValueChange={setCatFilter}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="Paid">Paid</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={payFilter} onValueChange={setPayFilter}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Payment" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Methods</SelectItem>
                        {PAYMENT_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1">
                      <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs flex-1" />
                      <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs flex-1" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                <button className="flex items-center gap-1 text-left hover:text-slate-700" onClick={() => toggleSort("title")}>
                  Expense {sortField === "title" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                </button>
                <button className="w-32 text-right hover:text-slate-700" onClick={() => toggleSort("date")}>
                  <span className="flex items-center justify-end gap-1">
                    Date {sortField === "date" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </span>
                </button>
                <button className="w-28 text-right hover:text-slate-700" onClick={() => toggleSort("amount")}>
                  <span className="flex items-center justify-end gap-1">
                    Amount {sortField === "amount" && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </span>
                </button>
                <span className="w-20 text-center">Status</span>
                <span className="w-20 text-center">Actions</span>
              </div>

              {/* Table rows */}
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <TrendingDown className="h-7 w-7 mb-2 opacity-30" />
                  <p className="font-semibold text-xs">No expenses found</p>
                  <p className="text-[10px] mt-0.5">Try adjusting your filters or add a new expense</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {filtered.map(exp => {
                    const pm = PAYMENT_META[exp.paymentMethod]
                    return (
                      <div key={exp.id}
                        className="flex flex-col sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-1.5 sm:gap-0 px-3 py-2 hover:bg-slate-50/80 transition-colors sm:items-center">

                        {/* Title + meta */}
                        <div className="min-w-0 pr-3 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-slate-800 truncate">{exp.title}</p>
                            <TypeBadge type={exp.type} />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <CategoryBadge cat={exp.category} />
                            <span className={cn("flex items-center gap-1 text-[10px] font-medium", pm.color)}>
                              {pm.icon} {exp.paymentMethod}
                            </span>
                            {exp.notes && <span className="text-[10px] text-slate-400 truncate max-w-[180px]">{exp.notes}</span>}
                          </div>
                        </div>

                        {/* Date */}
                        <div className="sm:w-32 sm:text-right flex items-center gap-2 sm:block">
                          <p className="text-xs font-medium text-slate-600">
                            {format(parseISO(exp.date), "dd MMM yyyy")}
                          </p>
                          {exp.isRecurring && (
                            <p className="text-[10px] text-violet-500 font-semibold flex items-center sm:justify-end gap-0.5 mt-0 sm:mt-0.5">
                              <Repeat2 className="h-2.5 w-2.5" /> recurring
                            </p>
                          )}
                        </div>

                        {/* Amount + Status + Actions: inline on mobile */}
                        <div className="flex items-center gap-3 sm:contents">
                          {/* Amount */}
                          <div className="sm:w-28 sm:text-right">
                            <p className="text-sm font-black text-slate-900">{formatCurrency(exp.amount)}</p>
                          </div>

                          {/* Status */}
                          <div className="sm:w-20 sm:flex sm:justify-center">
                            <StatusBadge status={exp.status} />
                          </div>

                          {/* Actions */}
                          <div className="sm:w-20 flex items-center sm:justify-center gap-1 ml-auto sm:ml-0">
                          <button type="button" onClick={() => handleOpenEdit(exp)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget(exp)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Table footer summary */}
              {filtered.length > 0 && (
                <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">{filtered.length} expense{filtered.length !== 1 ? "s" : ""} shown</span>
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <span className="text-xs text-slate-500">
                      Paid: <span className="font-bold text-emerald-600">{formatCurrency(filtered.filter(e => e.status === "Paid").reduce((s, e) => s + e.amount, 0))}</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      Pending: <span className="font-bold text-amber-600">{formatCurrency(filtered.filter(e => e.status === "Pending").reduce((s, e) => s + e.amount, 0))}</span>
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="text-xs font-bold text-slate-800">
                      Total: {formatCurrency(filtered.reduce((s, e) => s + e.amount, 0))}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* ── Right: Category Breakdown ── */}
          <div className="space-y-3">
            {/* Monthly breakdown */}
            <Card className="border-slate-200 shadow-sm">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Monthly Breakdown</p>
                  <p className="text-[10px] text-slate-400">{format(_now, "MMMM yyyy")} — paid only</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                </div>
              </div>
              <CardContent className="p-3 space-y-2">
                {categoryBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No data for this month</p>
                ) : (
                  <>
                    {categoryBreakdown.map(({ cat, amount, pct }) => {
                      const m = CATEGORY_META[cat]
                      return (
                        <div key={cat} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className={cn("w-2 h-2 rounded-full shrink-0", m.dot)} />
                              <span className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">{cat}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs font-bold text-slate-800">{formatCurrency(amount)}</span>
                              <span className="text-[10px] text-slate-400 ml-1">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", m.dot)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-slate-600">Month Total</span>
                      <span className="text-sm font-black text-slate-900">{formatCurrency(categoryBreakdown.reduce((s, i) => s + i.amount, 0))}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Recurring expenses summary */}
            <Card className="border-slate-200 shadow-sm">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-800">Active Recurring</p>
                  <p className="text-[10px] text-slate-400">Monthly + yearly commitments</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                  <Repeat2 className="h-4 w-4 text-violet-600" />
                </div>
              </div>
              <CardContent className="p-4 space-y-2">
                {(() => {
                  const unique = new Map<string, Expense>()
                  list.filter(e => e.isRecurring).forEach(e => {
                    if (!unique.has(e.title)) unique.set(e.title, e)
                  })
                  const items = Array.from(unique.values())
                  const monthlyTotal = items.filter(e => e.type === "monthly").reduce((s, e) => s + e.amount, 0)
                  const yearlyTotal  = items.filter(e => e.type === "yearly").reduce((s, e) => s + e.amount, 0)
                  return (
                    <>
                      {items.map(e => (
                        <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                          <div>
                            <p className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">{e.title}</p>
                            <TypeBadge type={e.type} />
                          </div>
                          <span className="text-xs font-bold text-slate-800 shrink-0">{formatCurrency(e.amount)}</span>
                        </div>
                      ))}
                      <Separator className="my-2" />
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Monthly commitment</span>
                          <span className="font-bold text-violet-700">{formatCurrency(monthlyTotal)}/mo</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Yearly commitment</span>
                          <span className="font-bold text-amber-700">{formatCurrency(yearlyTotal)}/yr</span>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Pending list */}
            {stats.pending.count > 0 && (
              <Card className="border-amber-200 shadow-sm bg-amber-50/50">
                <div className="px-3 py-2 border-b border-amber-200 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-bold text-amber-800">Pending Payments</p>
                  <span className="ml-auto text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                    {stats.pending.count}
                  </span>
                </div>
                <CardContent className="p-4 space-y-2">
                  {list.filter(e => e.status === "Pending").map(e => (
                    <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-amber-100 last:border-0">
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{e.title}</p>
                        <p className="text-[10px] text-slate-400">{format(parseISO(e.date), "dd MMM yyyy")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-amber-700">{formatCurrency(e.amount)}</p>
                        <button type="button" onClick={() => handleOpenEdit(e)}
                          className="text-[10px] text-blue-600 hover:underline">Edit</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-amber-200">
                    <span className="text-xs font-semibold text-amber-700">Total Due</span>
                    <span className="text-sm font-black text-amber-800">{formatCurrency(stats.pending.amount)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

      {/* Drawer + Delete dialog */}
      <ExpenseDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} editing={editing} onSave={handleSave} accounts={financeAccounts} defaultAccountId={defaultAccountId} />
      <DeleteDialog open={!!deleteTarget} expense={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}

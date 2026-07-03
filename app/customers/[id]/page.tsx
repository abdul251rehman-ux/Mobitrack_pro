"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Phone, Mail, MapPin, StickyNote,
  ShoppingBag, TrendingUp, Star,
  CalendarDays, CreditCard, Package, Plus, Wallet, AlertCircle, Users,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { getCustomerById } from "@/lib/api/customers"
import { getSales } from "@/lib/api/sales"
import { getPayments } from "@/lib/api/payments"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { Customer, Sale, Payment } from "@/data/types"
import { DataTable } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { formatCurrency, formatDate, todayPKT } from "@/lib/utils"

// ── Tier styling ──────────────────────────────────────────────────────────────
const tierStyles: Record<string, { badge: string; bg: string; border: string; icon: string }> = {
  Bronze:   { badge: "bg-orange-50 text-orange-700 border-orange-200",  bg: "from-orange-50 to-amber-50",   border: "border-orange-200",  icon: "text-orange-500" },
  Silver:   { badge: "bg-slate-100 text-slate-600 border-slate-300",   bg: "from-slate-50 to-slate-100",   border: "border-slate-200",   icon: "text-slate-500"  },
  Gold:     { badge: "bg-amber-50 text-amber-700 border-amber-200",    bg: "from-amber-50 to-yellow-50",   border: "border-amber-200",   icon: "text-amber-500"  },
  Platinum: { badge: "bg-slate-800 text-white border-slate-700",        bg: "from-slate-700 to-slate-800",  border: "border-slate-700",   icon: "text-white"      },
}

// ── Avatar ────────────────────────────────────────────────────────────────────
const avatarColors = [
  "bg-blue-600", "bg-violet-600", "bg-emerald-600", "bg-amber-600",
  "bg-rose-600",  "bg-cyan-600",   "bg-indigo-600",  "bg-teal-600",
]

function CustomerAvatar({ name, id }: { name: string; id: string }) {
  const idx = parseInt(id.replace(/\D/g, ""), 10) % avatarColors.length
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
  return (
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColors[idx]}`}>
      {initials}
    </div>
  )
}

// ── Compact stat card ─────────────────────────────────────────────────────────
function StatMini({ title, value, sub, accent, valueColor }: {
  title: string; value: string; sub?: string; accent?: string; valueColor?: string
}) {
  return (
    <div className={`rounded-lg border bg-white px-3 py-2.5 ${accent ?? "border-slate-200"}`}>
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none">{title}</p>
      <p className={`text-base font-bold leading-tight mt-1 ${valueColor ?? "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, children }: {
  icon: React.ElementType; label: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
      <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-blue-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <div className="text-xs font-semibold text-slate-800">{children}</div>
      </div>
    </div>
  )
}

// ── Recharts tooltip ──────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold text-slate-600 mb-0.5">{label}</p>
        <p className="text-slate-900 font-bold">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [customer, setCustomer]             = useState<Customer | null | undefined>(undefined)
  const [customerSales, setCustomerSales]   = useState<Sale[]>([])
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([])
  const [loading, setLoading]               = useState(true)

  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payAmount, setPayAmount]         = useState("")
  const [payMethod, setPayMethod]         = useState("Cash")
  const [payInvoice, setPayInvoice]       = useState("")
  const [payNotes, setPayNotes]           = useState("")
  const [paySubmitting, setPaySubmitting] = useState(false)

  async function fetchData() {
    try {
      setLoading(true)
      const [cust, allSales, allPayments] = await Promise.all([
        getCustomerById(id),
        getSales(),
        getPayments(),
      ])
      setCustomer(cust)
      setCustomerSales(allSales.filter((s) => s.customerId === id))
      setCustomerPayments(allPayments.filter((p) => p.entityType === "Customer" && p.entityId === id && p.type === "Received"))
    } catch {
      setCustomer(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [id])

  // ── Monthly spending ─────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const today  = new Date()
    const months: { label: string; key: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" })
      months.push({ key, label, amount: 0 })
    }
    customerSales.forEach((s) => {
      const bucket = months.find((m) => m.key === s.date.slice(0, 7))
      if (bucket) bucket.amount += s.total
    })
    return months
  }, [customerSales])

  // ── Derived stats ────────────────────────────────────────────────────────
  const totalBilled            = useMemo(() => customerSales.reduce((acc, s) => acc + s.total, 0), [customerSales])
  const totalPaid              = useMemo(() => customerPayments.reduce((acc, p) => acc + p.amount, 0), [customerPayments])
  const totalReceivedFromSales = useMemo(() => customerSales.reduce((acc, s) => acc + s.amountReceived, 0), [customerSales])
  const effectiveTotalPaid     = Math.max(totalPaid, totalReceivedFromSales)
  const outstandingBalance     = Math.max(0, totalBilled - effectiveTotalPaid)
  const creditBalance          = effectiveTotalPaid > totalBilled ? effectiveTotalPaid - totalBilled : 0
  const avgOrder               = customerSales.length > 0 ? totalBilled / customerSales.length : 0

  const unpaidSales = useMemo(() => customerSales.filter(s => {
    const paidForInvoice = customerPayments.filter(p => p.referenceNumber === s.invoiceNumber).reduce((sum, p) => sum + p.amount, 0)
    return s.total > paidForInvoice
  }), [customerSales, customerPayments])

  async function handleReceivePayment() {
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }
    if (!customer) return
    setPaySubmitting(true)
    try {
      const tenantId = await getTenantId()
      const sale      = payInvoice ? customerSales.find(s => s.invoiceNumber === payInvoice) : null
      const refNumber = payInvoice || `PAYMENT-${Date.now()}`
      const { error } = await supabase.from("payments").insert({
        tenant_id: tenantId, date: todayPKT(), type: "Received",
        entity_type: "Customer", entity_id: customer.id, entity_name: customer.name,
        reference_type: "Sale", reference_number: refNumber, amount, method: payMethod,
        status: "Completed", notes: payNotes || `Payment received from ${customer.name}`,
      })
      if (error) throw new Error(`Failed to record payment: ${error.message}`)
      if (sale) {
        const newReceived = (sale.amountReceived || 0) + amount
        await supabase.from("sales").update({
          amount_received: newReceived, change_due: Math.max(0, newReceived - sale.total),
          status: newReceived >= sale.total ? "Completed" : "Pending",
        }).eq("id", sale.id)
      }
      toast.success(`Payment of ${formatCurrency(amount)} received!`)
      setPayDialogOpen(false)
      setPayAmount(""); setPayMethod("Cash"); setPayInvoice(""); setPayNotes("")
      await fetchData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment")
    } finally {
      setPaySubmitting(false)
    }
  }

  // ── Sale columns ─────────────────────────────────────────────────────────
  const columns: ColumnDef<Sale>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice",
      cell: ({ row }) => <span className="font-mono text-xs font-medium text-slate-700">{row.original.invoiceNumber}</span>,
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap">
          <CalendarDays className="w-3 h-3 text-slate-400" />{formatDate(row.original.date)}
        </div>
      ),
    },
    {
      id: "items",
      header: "Items",
      cell: ({ row }) => {
        const count = row.original.items.reduce((acc, i) => acc + i.quantity, 0)
        return (
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <Package className="w-3 h-3 text-slate-400" />{count} item{count !== 1 ? "s" : ""}
          </div>
        )
      },
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => <span className="text-xs font-semibold text-slate-900">{formatCurrency(row.original.total)}</span>,
    },
    {
      id: "received",
      header: "Received",
      cell: ({ row }) => <span className="text-xs text-emerald-600 font-medium">{formatCurrency(row.original.amountReceived)}</span>,
    },
    {
      id: "balance",
      header: "Balance",
      cell: ({ row }) => {
        const bal = row.original.total - row.original.amountReceived
        return bal > 0
          ? <span className="text-xs font-bold text-red-600">{formatCurrency(bal)}</span>
          : <span className="text-xs text-emerald-600 font-medium">Paid</span>
      },
    },
    {
      accessorKey: "paymentMethod",
      header: "Method",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <CreditCard className="w-3 h-3 text-slate-400" />{row.original.paymentMethod}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]

  // ── Payment columns ───────────────────────────────────────────────────────
  const paymentColumns: ColumnDef<Payment>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap">
          <CalendarDays className="w-3 h-3 text-slate-400" />{formatDate(row.original.date)}
        </div>
      ),
    },
    {
      accessorKey: "referenceNumber",
      header: "Reference",
      cell: ({ row }) => <span className="font-mono text-xs text-slate-500">{row.original.referenceNumber}</span>,
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => <span className="text-xs font-bold text-emerald-600">{formatCurrency(row.original.amount)}</span>,
    },
    {
      accessorKey: "method",
      header: "Method",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <CreditCard className="w-3 h-3 text-slate-400" />{row.original.method}
        </div>
      ),
    },
    {
      accessorKey: "notes",
      header: "Notes",
      cell: ({ row }) => <span className="text-xs text-slate-400 truncate max-w-[180px] block">{row.original.notes || "-"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <Users className="w-10 h-10 text-slate-200 mb-3" />
        <h2 className="text-base font-bold text-slate-700 mb-1">Customer not found</h2>
        <p className="text-xs text-slate-500 mb-4">ID <span className="font-mono font-semibold text-blue-600">{id}</span> does not exist.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/customers")} className="h-8 text-xs gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />Back to Customers
        </Button>
      </div>
    )
  }

  const tier    = tierStyles[customer.loyaltyTier] ?? tierStyles.Bronze
  const initials = customer.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()

  return (
    <div className="p-4 space-y-3">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <Button variant="outline" size="sm" onClick={() => router.push("/customers")}
          className="h-7 px-2 gap-1 text-xs text-slate-600 hover:text-blue-600 hover:border-blue-300 shrink-0">
          <ArrowLeft className="w-3.5 h-3.5" />Back
        </Button>
        <CustomerAvatar name={customer.name} id={customer.id} />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-slate-900 leading-tight truncate">{customer.name}</h1>
          <p className="text-[10px] text-slate-500">{customer.phone}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border shrink-0 ${tier.badge}`}>
          <Star className="w-2.5 h-2.5 mr-1" />{customer.loyaltyTier}
        </span>
        <Button size="sm" onClick={() => setPayDialogOpen(true)}
          className="h-8 text-xs gap-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
          <Plus className="w-3.5 h-3.5" />Receive Payment
        </Button>
      </div>

      {/* ── Two-column: Contact + Stats + Chart ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Contact card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Contact Details</h2>
          </div>
          <div className="p-1.5">
            <InfoRow icon={Users} label="Full Name">{customer.name}</InfoRow>
            <InfoRow icon={Phone} label="Phone">{customer.phone}</InfoRow>
            <InfoRow icon={Mail} label="Email">
              {customer.email ?? <span className="text-slate-400 italic font-normal">Not provided</span>}
            </InfoRow>
            <InfoRow icon={MapPin} label="Address">
              {customer.address ?? <span className="text-slate-400 italic font-normal">Not provided</span>}
            </InfoRow>
            {customer.notes && (
              <InfoRow icon={StickyNote} label="Notes">
                <span className="font-normal text-slate-700">{customer.notes}</span>
              </InfoRow>
            )}
          </div>
        </div>

        {/* Stats + Chart */}
        <div className="lg:col-span-2 space-y-3">
          {/* Row 1: 3 financial stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatMini title="Total Billed" value={formatCurrency(totalBilled)}
              sub={`${customerSales.length} sale${customerSales.length !== 1 ? "s" : ""}`}
              accent="border-blue-200" />
            <StatMini title="Total Paid" value={formatCurrency(effectiveTotalPaid)}
              sub="Payments received" accent="border-emerald-200" valueColor="text-emerald-700" />
            {creditBalance > 0 ? (
              <StatMini
                title="Advance / Credit"
                value={formatCurrency(creditBalance)}
                sub="Customer paid extra"
                accent="border-blue-200"
                valueColor="text-blue-700"
              />
            ) : (
              <StatMini
                title="Outstanding"
                value={outstandingBalance > 0 ? formatCurrency(outstandingBalance) : "Settled"}
                sub={outstandingBalance > 0 ? "Customer owes" : "No balance due"}
                accent={outstandingBalance > 0 ? "border-red-200" : "border-emerald-200"}
                valueColor={outstandingBalance > 0 ? "text-red-600" : "text-emerald-700"}
              />
            )}
          </div>

          {/* Row 2: 3 more stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatMini title="No. of Sales" value={String(customerSales.length)}
              sub={customerSales.length > 0 ? `Last: ${formatDate(customerSales[0]?.date)}` : "No sales"} />
            <StatMini title="Avg. Order Value" value={formatCurrency(avgOrder)} sub="Per transaction" accent="border-violet-200" />
            <div className={`rounded-lg border bg-linear-to-br ${tier.bg} px-3 py-2.5 ${tier.border}`}>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide leading-none">Loyalty Tier</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Star className={`w-4 h-4 ${tier.icon}`} />
                <p className="text-base font-bold text-slate-900">{customer.loyaltyTier}</p>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {customer.loyaltyTier === "Platinum" ? "Top tier - Rs 500k+" :
                 customer.loyaltyTier === "Gold"     ? "Rs 200k-500k spent" :
                 customer.loyaltyTier === "Silver"   ? "Rs 50k-200k spent" :
                                                       "Under Rs 50k spent"}
              </p>
            </div>
          </div>

          {/* Monthly spending chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-semibold text-slate-700">Monthly Spending</h2>
              <span className="text-[10px] text-slate-400">Last 6 months</span>
            </div>
            <div className="px-3 py-2">
              {monthlyData.every((m) => m.amount === 0) ? (
                <div className="flex flex-col items-center justify-center h-28 text-slate-400 gap-1.5">
                  <TrendingUp className="w-6 h-6" />
                  <p className="text-xs">No purchases in the last 6 months</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false} tickLine={false} width={36} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                    <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Purchase History ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
            <h2 className="text-xs font-bold text-slate-800">Purchase History</h2>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {customerSales.length} sale{customerSales.length !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-[10px] text-slate-500">
            Total: <span className="font-semibold text-slate-800">{formatCurrency(totalBilled)}</span>
            {outstandingBalance > 0 && (
              <span className="text-red-600 font-semibold ml-2">Due: {formatCurrency(outstandingBalance)}</span>
            )}
            {creditBalance > 0 && (
              <span className="text-blue-600 font-semibold ml-2">Credit: +{formatCurrency(creditBalance)}</span>
            )}
          </span>
        </div>
        <div className="p-2">
          {customerSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-slate-400 gap-1.5">
              <ShoppingBag className="w-7 h-7" />
              <p className="text-xs">No purchases recorded for this customer</p>
            </div>
          ) : (
            <DataTable columns={columns} data={customerSales} searchKey="invoiceNumber" searchPlaceholder="Search invoices..." />
          )}
        </div>
      </div>

      {/* ── Payment History ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            <h2 className="text-xs font-bold text-slate-800">Payment History</h2>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              {customerPayments.length} payment{customerPayments.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500">
              Total Received: <span className="font-semibold text-emerald-700">{formatCurrency(effectiveTotalPaid)}</span>
            </span>
            <Button size="sm" variant="outline" onClick={() => setPayDialogOpen(true)} className="h-7 text-[10px] gap-1 px-2">
              <Plus className="w-2.5 h-2.5" />Add Payment
            </Button>
          </div>
        </div>
        <div className="p-2">
          {customerPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-slate-400 gap-1.5">
              <Wallet className="w-7 h-7" />
              <p className="text-xs">No payments recorded yet</p>
              {outstandingBalance > 0 && (
                <Button size="sm" variant="outline" onClick={() => setPayDialogOpen(true)} className="h-7 text-[10px] gap-1 px-2 mt-1">
                  <Plus className="w-2.5 h-2.5" />Record First Payment
                </Button>
              )}
            </div>
          ) : (
            <DataTable columns={paymentColumns} data={customerPayments} searchKey="referenceNumber" searchPlaceholder="Search payments..." />
          )}
        </div>
      </div>

      {/* ── Receive Payment Dialog ─────────────────────────────────────────── */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Wallet className="w-4 h-4 text-emerald-600" />Receive Payment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record a payment received from <span className="font-semibold text-slate-700">{customer.name}</span>
            </DialogDescription>
          </DialogHeader>

          {creditBalance > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-700">Credit: +{formatCurrency(creditBalance)}</p>
                <p className="text-[10px] text-blue-500 mt-0.5">Customer has advance credit on account</p>
              </div>
            </div>
          )}
          {outstandingBalance > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-700">Outstanding: {formatCurrency(outstandingBalance)}</p>
                <p className="text-[10px] text-red-500 mt-0.5">Customer owes this amount</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {unpaidSales.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-600">Against Invoice (optional)</Label>
                <Select value={payInvoice} onValueChange={setPayInvoice}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select invoice..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Payment</SelectItem>
                    {unpaidSales.map(s => {
                      const paidForThis = customerPayments.filter(p => p.referenceNumber === s.invoiceNumber).reduce((sum, p) => sum + p.amount, 0)
                      const due = s.total - Math.max(paidForThis, s.amountReceived)
                      return (
                        <SelectItem key={s.invoiceNumber} value={s.invoiceNumber}>
                          {s.invoiceNumber} - Due: {formatCurrency(Math.max(0, due))}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">Amount (Rs) <span className="text-red-500">*</span></Label>
              <Input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={payAmount} onChange={e => setPayAmount(e.target.value)}
                placeholder="0" className="h-8 text-xs" autoFocus />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cash", "Bank Transfer", "JazzCash", "EasyPaisa", "Cheque"].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-slate-600">Notes (optional)</Label>
              <Input value={payNotes} onChange={e => setPayNotes(e.target.value)}
                placeholder="e.g., Remaining balance for phone" className="h-8 text-xs" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setPayDialogOpen(false)} disabled={paySubmitting}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              onClick={handleReceivePayment} disabled={paySubmitting}>
              {paySubmitting ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

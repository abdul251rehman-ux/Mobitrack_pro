"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Phone, Mail, MapPin, StickyNote,
  ShoppingBag, TrendingUp, Receipt, Star,
  CalendarDays, CreditCard, Package,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { ColumnDef } from "@tanstack/react-table"

import { getCustomerById } from "@/lib/api/customers"
import { getSales } from "@/lib/api/sales"
import { Customer, Sale } from "@/data/types"
import { DataTable } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDate } from "@/lib/utils"

// ── Tier styling ──────────────────────────────────────────────────────────────
const tierStyles: Record<
  string,
  { badge: string; bg: string; border: string; icon: string }
> = {
  Bronze: {
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    bg: "from-slate-50 to-slate-100",
    border: "border-slate-200",
    icon: "text-slate-500",
  },
  Silver: {
    badge: "bg-slate-200 text-slate-700 border-slate-300",
    bg: "from-slate-100 to-slate-200",
    border: "border-slate-300",
    icon: "text-slate-600",
  },
  Gold: {
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    bg: "from-blue-50 to-blue-100",
    border: "border-blue-200",
    icon: "text-blue-600",
  },
  Platinum: {
    badge: "bg-slate-800 text-white border-slate-700",
    bg: "from-slate-700 to-slate-800",
    border: "border-slate-700",
    icon: "text-white",
  },
}

// ── Avatar ────────────────────────────────────────────────────────────────────
const avatarColors = [
  "bg-blue-600", "bg-blue-500", "bg-blue-700", "bg-slate-600",
  "bg-blue-800", "bg-slate-700", "bg-blue-600", "bg-slate-800",
]

function CustomerAvatar({ name, id, size = "lg" }: { name: string; id: string; size?: "sm" | "lg" }) {
  const idx = parseInt(id.replace(/\D/g, ""), 10) % avatarColors.length
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  const cls = size === "lg" ? "w-16 h-16 text-xl" : "w-10 h-10 text-sm"
  return (
    <div
      className={`${cls} rounded-2xl flex items-center justify-center text-white font-bold shrink-0 ${avatarColors[idx]}`}
    >
      {initials}
    </div>
  )
}

// ── Stat card (local, no icon color prop needed) ───────────────────────────────
function InfoStatCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className={`rounded-xl border bg-white p-5 space-y-1 ${accent ?? "border-slate-200"}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

// ── Recharts custom tooltip ───────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
        <p className="font-semibold text-slate-700 mb-1">{label}</p>
        <p className="text-slate-900 font-bold">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined)
  const [customerSales, setCustomerSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [cust, allSales] = await Promise.all([
          getCustomerById(id),
          getSales(),
        ])
        setCustomer(cust)
        setCustomerSales(allSales.filter((s) => s.customerId === id))
      } catch {
        setCustomer(null)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  // ── Monthly spending – last 6 months ────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const today = new Date()
    const months: { label: string; key: string; amount: number }[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" })
      months.push({ key, label, amount: 0 })
    }

    customerSales.forEach((s) => {
      const prefix = s.date.slice(0, 7) // "YYYY-MM"
      const bucket = months.find((m) => m.key === prefix)
      if (bucket) bucket.amount += s.total
    })

    return months
  }, [customerSales])

  // ── Derived stats ───────────────────────────────────────────────────────────
  const totalSpent = useMemo(
    () => customerSales.reduce((acc, s) => acc + s.total, 0),
    [customerSales]
  )

  const avgOrder = customerSales.length > 0 ? totalSpent / customerSales.length : 0

  // ── Sale history columns ────────────────────────────────────────────────────
  const columns: ColumnDef<Sale>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice",
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium text-slate-700">
          {row.original.invoiceNumber}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-slate-600 whitespace-nowrap">
          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
          {formatDate(row.original.date)}
        </div>
      ),
    },
    {
      id: "items",
      header: "Items",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-slate-600">
          <Package className="w-3.5 h-3.5 text-slate-400" />
          {row.original.items.reduce((acc, i) => acc + i.quantity, 0)} item
          {row.original.items.reduce((acc, i) => acc + i.quantity, 0) !== 1 ? "s" : ""}
        </div>
      ),
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-semibold text-slate-900">
          {formatCurrency(row.original.total)}
        </span>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: "Payment",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-slate-600">
          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
          {row.original.paymentMethod}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ]

  // ── Loading guard ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-screen-xl mx-auto flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  // ── 404 guard ────────────────────────────────────────────────────────────────
  if (!customer) {
    return (
      <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-slate-400" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-700">Customer not found</h2>
            <p className="text-slate-500 text-sm mt-1">
              The customer with ID <span className="font-mono">{id}</span> does not exist.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/customers")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Customers
          </Button>
        </div>
      </div>
    )
  }

  const tier = tierStyles[customer.loyaltyTier] ?? tierStyles.Bronze

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/customers")}
          className="gap-2 text-slate-600 hover:text-slate-900 mt-0.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div className="flex items-center gap-4 flex-1 min-w-0">
          <CustomerAvatar name={customer.name} id={customer.id} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">{customer.name}</h1>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold border ${tier.badge}`}
              >
                <Star className="w-3.5 h-3.5 mr-1.5" />
                {customer.loyaltyTier}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">{customer.phone}</p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Two-column layout: info card + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info Card */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">
                Contact Details
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {/* Name */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Full Name</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{customer.name}</p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Phone</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">{customer.phone}</p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Email</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5">
                    {customer.email ?? <span className="text-slate-400 italic">Not provided</span>}
                  </p>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Address</p>
                  <p className="text-sm font-medium text-slate-800 mt-0.5 leading-relaxed">
                    {customer.address ?? <span className="text-slate-400 italic">Not provided</span>}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {customer.notes && (
                <>
                  <Separator />
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <StickyNote className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">Notes</p>
                      <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{customer.notes}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoStatCard
              title="Total Spent"
              value={formatCurrency(customer.totalSpent)}
              sub={`Across ${customer.totalPurchases} purchases`}
              accent="border-blue-200"
            />
            <InfoStatCard
              title="Number of Purchases"
              value={String(customer.totalPurchases)}
              sub={`Last: ${formatDate(customer.lastPurchaseDate)}`}
              accent="border-emerald-200"
            />
            <InfoStatCard
              title="Avg. Order Value"
              value={formatCurrency(avgOrder)}
              sub="Per transaction"
              accent="border-violet-200"
            />
            <div
              className={`rounded-xl border bg-linear-to-br ${tier.bg} p-5 space-y-1 ${tier.border}`}
            >
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Loyalty Tier
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Star className={`w-6 h-6 ${tier.icon}`} />
                <p className="text-2xl font-bold text-slate-900">{customer.loyaltyTier}</p>
              </div>
              <p className="text-xs text-slate-400">
                {customer.loyaltyTier === "Platinum"
                  ? "Top tier — ₨500k+"
                  : customer.loyaltyTier === "Gold"
                  ? "₨200k–₨500k spent"
                  : customer.loyaltyTier === "Silver"
                  ? "₨50k–₨200k spent"
                  : "Under ₨50k spent"}
              </p>
            </div>
          </div>

          {/* Monthly spending chart */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">
                Monthly Spending
              </h2>
              <span className="text-xs text-slate-400">Last 6 months</span>
            </div>
            <div className="p-5">
              {monthlyData.every((m) => m.amount === 0) ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                  <TrendingUp className="w-8 h-8" />
                  <p className="text-sm">No purchases in the last 6 months</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={monthlyData}
                    margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
                    barSize={32}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `₨${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                    <Bar
                      dataKey="amount"
                      fill="#6366f1"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Purchase History */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-slate-800">Purchase History</h2>
            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-0.5">
              {customerSales.length} sale{customerSales.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Receipt className="w-4 h-4" />
            <span>Total: <span className="font-semibold text-slate-800">{formatCurrency(totalSpent)}</span></span>
          </div>
        </div>
        <div className="p-5">
          {customerSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
              <ShoppingBag className="w-8 h-8" />
              <p className="text-sm">No purchases recorded for this customer</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={customerSales}
              searchPlaceholder="Search invoices..."
            />
          )}
        </div>
      </div>
    </div>
  )
}

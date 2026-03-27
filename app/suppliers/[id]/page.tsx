"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import {
  ArrowLeft, Building2, Phone, Mail, MapPin,
  ShoppingBag, CreditCard, AlertCircle, Package,
  CalendarDays, FileText,
} from "lucide-react"

import { getSupplierById } from "@/lib/api/suppliers"
import { getPurchases } from "@/lib/api/purchases"
import { Supplier, Purchase } from "@/data/types"
import { PageWrapper } from "@/components/layout/page-wrapper"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = rating >= star
        const half   = !filled && rating >= star - 0.5
        return (
          <span
            key={star}
            className={
              filled ? "text-amber-400 text-lg" :
              half   ? "text-amber-300 text-lg" :
                       "text-slate-200 text-lg"
            }
          >
            ★
          </span>
        )
      })}
      <span className="ml-1.5 text-sm font-semibold text-slate-600">{rating.toFixed(1)} / 5</span>
    </div>
  )
}

// ─── Purchase History Columns ─────────────────────────────────────────────────
const purchaseColumns: ColumnDef<Purchase>[] = [
  {
    accessorKey: "poNumber",
    header: "PO #",
    cell: ({ row }) => (
      <span className="font-mono text-xs font-bold text-blue-600">
        {row.getValue("poNumber")}
      </span>
    ),
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="text-sm text-slate-600">{formatDate(row.getValue("date"))}</span>
    ),
  },
  {
    id: "items",
    header: "Items",
    cell: ({ row }) => {
      const items = row.original.items
      const qty   = items.reduce((sum, i) => sum + i.quantity, 0)
      return (
        <span className="text-sm text-slate-600">
          {items.length} line{items.length !== 1 ? "s" : ""}{" "}
          <span className="text-slate-400">({qty} units)</span>
        </span>
      )
    },
  },
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => (
      <span className="font-bold text-slate-900 text-sm">
        {formatCurrency(row.getValue("total"))}
      </span>
    ),
  },
  {
    accessorKey: "amountPaid",
    header: "Amount Paid",
    cell: ({ row }) => (
      <span className="text-sm text-blue-700 font-medium">
        {formatCurrency(row.getValue("amountPaid"))}
      </span>
    ),
  },
  {
    accessorKey: "balanceDue",
    header: "Balance",
    cell: ({ row }) => {
      const balance: number = row.getValue("balanceDue")
      return balance > 0 ? (
        <span className="text-sm font-semibold text-red-600">
          {formatCurrency(balance)}
        </span>
      ) : (
        <span className="text-sm text-slate-400">—</span>
      )
    },
  },
  {
    accessorKey: "paymentStatus",
    header: "Payment",
    cell: ({ row }) => <StatusBadge status={row.getValue("paymentStatus")} />,
  },
  {
    accessorKey: "deliveryStatus",
    header: "Delivery",
    cell: ({ row }) => {
      const status: string = row.getValue("deliveryStatus")
      return (
        <StatusBadge
          status={status}
          className={status === "Partial" ? "bg-blue-100 text-blue-700" : undefined}
        />
      )
    },
  },
]

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SupplierDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const id       = params?.id as string

  const [supplier, setSupplier] = useState<Supplier | null | undefined>(undefined)
  const [supplierPurchases, setSupplierPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [sup, allPurchases] = await Promise.all([
          getSupplierById(id),
          getPurchases(),
        ])
        setSupplier(sup)
        setSupplierPurchases(sup ? allPurchases.filter((p) => p.supplierId === sup.id) : [])
      } catch {
        setSupplier(null)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const totalPurchased = useMemo(
    () => supplierPurchases.reduce((sum, p) => sum + p.total, 0),
    [supplierPurchases]
  )

  const totalPaid = useMemo(
    () => supplierPurchases.reduce((sum, p) => sum + p.amountPaid, 0),
    [supplierPurchases]
  )

  const balanceDue = useMemo(
    () => supplierPurchases.reduce((sum, p) => sum + p.balanceDue, 0),
    [supplierPurchases]
  )

  // ── Recent payments (purchases with amountPaid > 0) ───────────────────────
  const recentPayments = useMemo(() => {
    return supplierPurchases
      .filter((p) => p.amountPaid > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [supplierPurchases])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </PageWrapper>
    )
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!supplier) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Building2 className="w-14 h-14 text-slate-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">Supplier Not Found</h2>
          <p className="text-slate-500 mb-6 text-sm">
            The supplier with ID <span className="font-mono font-semibold text-blue-600">{id}</span> does not exist.
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/suppliers")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Suppliers
          </Button>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      {/* ── Back + Title ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/suppliers")}
          className="gap-1.5 text-slate-600 hover:text-blue-600 hover:border-indigo-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight truncate">
              {supplier.companyName}
            </h1>
            <p className="text-sm text-slate-500">{supplier.contactPerson}</p>
          </div>
          <StatusBadge status={supplier.status} className="shrink-0" />
        </div>
      </div>

      {/* ── Supplier Info Card ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Supplier Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Contact Person */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Contact Person</p>
              <p className="text-sm font-semibold text-slate-800">{supplier.contactPerson}</p>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Phone</p>
              <a
                href={`tel:${supplier.phone}`}
                className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
              >
                {supplier.phone}
              </a>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Email</p>
              <a
                href={`mailto:${supplier.email}`}
                className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors break-all"
              >
                {supplier.email}
              </a>
            </div>
          </div>

          {/* City */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">City</p>
              <p className="text-sm font-semibold text-slate-800">{supplier.city}</p>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-start gap-3 sm:col-span-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Address</p>
              <p className="text-sm font-semibold text-slate-800">{supplier.address}</p>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <span className="text-blue-500 text-sm font-bold">★</span>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Rating</p>
              <StarRating rating={supplier.rating} />
            </div>
          </div>

          {/* Notes */}
          {supplier.notes && (
            <div className="flex items-start gap-3 col-span-full">
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Notes</p>
                <p className="text-sm text-slate-700 leading-relaxed">{supplier.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stat Cards Row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
        <StatCard
          title="Total Purchased"
          value={formatCurrency(totalPurchased)}
          subtext={`${supplierPurchases.length} purchase orders`}
          icon={ShoppingBag}
          iconBg="bg-blue-100"
          gradient="from-indigo-50 to-blue-50"
        />
        <StatCard
          title="Total Paid"
          value={formatCurrency(totalPaid)}
          subtext="Amount settled so far"
          icon={CreditCard}
          iconBg="bg-blue-100"
          gradient="from-emerald-50 to-teal-50"
        />
        <StatCard
          title="Balance Due"
          value={formatCurrency(balanceDue)}
          subtext={balanceDue > 0 ? "Outstanding payment" : "No balance due"}
          icon={AlertCircle}
          iconBg={balanceDue > 0 ? "bg-red-100" : "bg-slate-100"}
          gradient={balanceDue > 0 ? "from-red-50 to-rose-50" : "from-slate-50 to-slate-100"}
          className={balanceDue > 0 ? "border-red-200" : ""}
        />
        <StatCard
          title="Number of Orders"
          value={String(supplierPurchases.length)}
          subtext="Total purchase orders"
          icon={Package}
          iconBg="bg-blue-100"
          gradient="from-purple-50 to-violet-50"
        />
      </div>

      {/* ── Two-column layout: History + Payments ────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Purchase History Table */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Purchase History</h2>
              <Badge
                variant="secondary"
                className="bg-blue-100 text-blue-700 font-semibold"
              >
                {supplierPurchases.length} orders
              </Badge>
            </div>

            {supplierPurchases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <ShoppingBag className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm font-medium text-slate-500">No purchases yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Purchase orders from this supplier will appear here
                </p>
              </div>
            ) : (
              <div className="p-4">
                <DataTable
                  columns={purchaseColumns}
                  data={supplierPurchases}
                  searchKey="poNumber"
                  searchPlaceholder="Search by PO number..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments Sidebar */}
        <div className="xl:col-span-1 space-y-6">
          {/* Recent Payments */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Recent Payments</h2>
              <CreditCard className="w-4 h-4 text-slate-400" />
            </div>

            {recentPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-5">
                <CreditCard className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-500">No payments recorded</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentPayments.map((p) => (
                  <div key={p.id} className="px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-blue-600 font-mono">
                          {p.poNumber}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CalendarDays className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">{formatDate(p.date)}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{p.paymentMethod}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-blue-700">
                          {formatCurrency(p.amountPaid)}
                        </p>
                        <StatusBadge status={p.paymentStatus} className="mt-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Summary Card */}
          {supplierPurchases.length > 0 && (
            <div className="bg-linear-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Payment Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-blue-600">Total Invoiced</span>
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(totalPurchased)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-blue-600">Total Paid</span>
                  <span className="text-sm font-bold text-blue-700">
                    {formatCurrency(totalPaid)}
                  </span>
                </div>
                <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
                  <span className={`text-xs font-semibold ${balanceDue > 0 ? "text-red-600" : "text-slate-500"}`}>
                    Balance Due
                  </span>
                  <span className={`text-sm font-bold ${balanceDue > 0 ? "text-red-600" : "text-slate-500"}`}>
                    {balanceDue > 0 ? formatCurrency(balanceDue) : "—"}
                  </span>
                </div>
                {totalPurchased > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-blue-500 mb-1">
                      <span>Payment Progress</span>
                      <span>{Math.round((totalPaid / totalPurchased) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.round((totalPaid / totalPurchased) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

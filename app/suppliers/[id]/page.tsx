"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import {
  ArrowLeft, Building2, Phone, Mail, MapPin,
  ShoppingBag, CreditCard, AlertCircle, Package,
  CalendarDays, FileText, Star,
} from "lucide-react"

import { getSupplierById } from "@/lib/api/suppliers"
import { getPurchases } from "@/lib/api/purchases"
import { Supplier, Purchase } from "@/data/types"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
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
              filled ? "text-amber-400 text-sm" :
              half   ? "text-amber-300 text-sm" :
                       "text-slate-200 text-sm"
            }
          >
            ★
          </span>
        )
      })}
      <span className="ml-1 text-xs font-semibold text-slate-600">{rating.toFixed(1)}/5</span>
    </div>
  )
}

// ─── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, children }: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
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
      <span className="text-xs text-slate-600">{formatDate(row.getValue("date"))}</span>
    ),
  },
  {
    id: "items",
    header: "Items",
    cell: ({ row }) => {
      const items = row.original.items
      const qty   = items.reduce((sum, i) => sum + i.quantity, 0)
      return (
        <span className="text-xs text-slate-600">
          {items.length}L{" "}
          <span className="text-slate-400">({qty}u)</span>
        </span>
      )
    },
  },
  {
    accessorKey: "total",
    header: "Total",
    cell: ({ row }) => (
      <span className="font-bold text-slate-900 text-xs">
        {formatCurrency(row.getValue("total"))}
      </span>
    ),
  },
  {
    accessorKey: "amountPaid",
    header: "Paid",
    cell: ({ row }) => (
      <span className="text-xs text-blue-700 font-medium">
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
        <span className="text-xs font-semibold text-red-600">
          {formatCurrency(balance)}
        </span>
      ) : (
        <span className="text-xs text-slate-400">—</span>
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
  const recentPayments = useMemo(() => {
    return supplierPurchases
      .filter((p) => p.amountPaid > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [supplierPurchases])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <Building2 className="w-10 h-10 text-slate-200 mb-3" />
        <h2 className="text-base font-bold text-slate-700 mb-1">Supplier Not Found</h2>
        <p className="text-xs text-slate-500 mb-4">
          ID <span className="font-mono font-semibold text-blue-600">{id}</span> does not exist.
        </p>
        <Button variant="outline" size="sm" onClick={() => router.push("/suppliers")} className="gap-1.5 h-8 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Suppliers
        </Button>
      </div>
    )
  }

  const initials = supplier.companyName.slice(0, 2).toUpperCase()
  const payPct   = totalPurchased > 0 ? Math.min(100, Math.round((totalPaid / totalPurchased) * 100)) : 0

  return (
    <div className="p-4 space-y-3">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/suppliers")}
          className="h-7 px-2 gap-1 text-xs text-slate-600 hover:text-blue-600 hover:border-blue-300 shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Button>

        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">{initials}</span>
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-slate-900 leading-tight truncate">
            {supplier.companyName}
          </h1>
          <p className="text-[10px] text-slate-500 truncate">{supplier.contactPerson}</p>
        </div>

        <StatusBadge status={supplier.status} className="shrink-0" />
      </div>

      {/* ── Info Card ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <h2 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Supplier Information</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-0 p-1.5">
          <InfoRow icon={Building2} label="Contact Person">{supplier.contactPerson}</InfoRow>
          <InfoRow icon={Phone} label="Phone">
            <a href={`tel:${supplier.phone}`} className="hover:text-blue-600 transition-colors">{supplier.phone}</a>
          </InfoRow>
          <InfoRow icon={Mail} label="Email">
            <a href={`mailto:${supplier.email}`} className="hover:text-blue-600 transition-colors break-all">{supplier.email}</a>
          </InfoRow>
          <InfoRow icon={MapPin} label="City">{supplier.city}</InfoRow>
          <InfoRow icon={MapPin} label="Address">
            <span className="wrap-break-word">{supplier.address}</span>
          </InfoRow>
          <InfoRow icon={Star} label="Rating"><StarRating rating={supplier.rating} /></InfoRow>
          {supplier.notes && (
            <div className="col-span-full">
              <InfoRow icon={FileText} label="Notes">
                <span className="text-slate-700 font-normal">{supplier.notes}</span>
              </InfoRow>
            </div>
          )}
        </div>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard
          title="Total Purchased"
          value={formatCurrency(totalPurchased)}
          subtext={`${supplierPurchases.length} orders`}
          icon={ShoppingBag}
          iconBg="bg-blue-100"
        />
        <StatCard
          title="Total Paid"
          value={formatCurrency(totalPaid)}
          subtext="Amount settled"
          icon={CreditCard}
          iconBg="bg-emerald-100"
        />
        <StatCard
          title="Balance Due"
          value={formatCurrency(balanceDue)}
          subtext={balanceDue > 0 ? "Outstanding" : "No balance"}
          icon={AlertCircle}
          iconBg={balanceDue > 0 ? "bg-red-100" : "bg-slate-100"}
          className={balanceDue > 0 ? "border-red-200" : ""}
        />
        <StatCard
          title="No. of Orders"
          value={String(supplierPurchases.length)}
          subtext="Purchase orders"
          icon={Package}
          iconBg="bg-blue-100"
        />
      </div>

      {/* ── History + Payments ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {/* Purchase History */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800">Purchase History</h2>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {supplierPurchases.length} orders
            </span>
          </div>

          {supplierPurchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <ShoppingBag className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-xs font-medium text-slate-500">No purchases yet</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Purchase orders will appear here</p>
            </div>
          ) : (
            <div className="p-2">
              <DataTable
                columns={purchaseColumns}
                data={supplierPurchases}
                searchKey="poNumber"
                searchPlaceholder="Search by PO number..."
              />
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="xl:col-span-1 space-y-3">
          {/* Recent Payments */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-3 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800">Recent Payments</h2>
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
            </div>

            {recentPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <CreditCard className="w-7 h-7 text-slate-200 mb-2" />
                <p className="text-xs text-slate-500">No payments recorded</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentPayments.map((p) => (
                  <div key={p.id} className="px-3 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-blue-600 font-mono">{p.poNumber}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <CalendarDays className="w-2.5 h-2.5 text-slate-400" />
                          <span className="text-[10px] text-slate-500">{formatDate(p.date)}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{p.paymentMethod}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-blue-700">{formatCurrency(p.amountPaid)}</p>
                        <StatusBadge status={p.paymentStatus} className="mt-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment Summary */}
          {supplierPurchases.length > 0 && (
            <div className="bg-linear-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-3.5">
              <h3 className="text-xs font-bold text-slate-800 mb-3">Payment Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-blue-600">Total Invoiced</span>
                  <span className="text-xs font-bold text-slate-900">{formatCurrency(totalPurchased)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-blue-600">Total Paid</span>
                  <span className="text-xs font-bold text-blue-700">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="border-t border-blue-200 pt-2 flex justify-between items-center">
                  <span className={`text-[10px] font-semibold ${balanceDue > 0 ? "text-red-600" : "text-slate-500"}`}>
                    Balance Due
                  </span>
                  <span className={`text-xs font-bold ${balanceDue > 0 ? "text-red-600" : "text-slate-500"}`}>
                    {balanceDue > 0 ? formatCurrency(balanceDue) : "—"}
                  </span>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-blue-500 mb-1">
                    <span>Payment Progress</span>
                    <span>{payPct}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${payPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

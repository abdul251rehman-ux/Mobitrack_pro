"use client"

import { useState, useMemo, useEffect } from "react"
import { Plus, Eye, Pencil, ShoppingBag, CalendarDays, TrendingDown, AlertCircle, RotateCcw, Truck, Package } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import Link from "next/link"

import { getPurchases, updatePurchaseStatus } from "@/lib/api/purchases"
import { getMobiles, getAccessories } from "@/lib/api/products"
import { supabase } from "@/lib/supabase"
import type { Mobile, Accessory } from "@/data/types"
import { getSuppliers } from "@/lib/api/suppliers"
import { Purchase, PurchaseItem, Supplier } from "@/data/types"
import { DataTable } from "@/components/shared/data-table"
import { PageWrapper } from "@/components/layout/page-wrapper"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate } from "@/lib/utils"

// ─── Constants ────────────────────────────────────────────────────────────────
const _now = new Date()
const TODAY = _now.toISOString().split("T")[0]
const CURRENT_MONTH = TODAY.substring(0, 7)
const WEEK_START = new Date(_now.getTime() - 7 * 24 * 60 * 60 * 1000)

// ─── Table Columns ─────────────────────────────────────────────────────────
function buildColumns(onView: (p: Purchase) => void, onEdit: (p: Purchase) => void): ColumnDef<Purchase>[] {
  return [
    {
      accessorKey: "poNumber",
      header: "PO #",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-blue-600">
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
      accessorKey: "supplierName",
      header: "Supplier",
      cell: ({ row }) => (
        <span className="font-medium text-slate-800">{row.getValue("supplierName")}</span>
      ),
    },
    {
      id: "items",
      header: "Items",
      cell: ({ row }) => {
        const items: PurchaseItem[] = row.original.items
        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0)
        return (
          <span className="text-sm text-slate-600">
            {items.length} line{items.length !== 1 ? "s" : ""}{" "}
            <span className="text-slate-400">({totalQty} units)</span>
          </span>
        )
      },
    },
    {
      accessorKey: "total",
      header: "Total Cost",
      cell: ({ row }) => (
        <span className="font-bold text-slate-900">{formatCurrency(row.getValue("total"))}</span>
      ),
    },
    {
      accessorKey: "amountPaid",
      header: "Amount Paid",
      cell: ({ row }) => (
        <span className="text-sm text-slate-700">{formatCurrency(row.getValue("amountPaid"))}</span>
      ),
    },
    {
      accessorKey: "balanceDue",
      header: "Balance Due",
      cell: ({ row }) => {
        const balance: number = row.getValue("balanceDue")
        return balance > 0 ? (
          <span className="text-sm font-semibold text-red-600">{formatCurrency(balance)}</span>
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
        // Override "Partial" delivery to use blue per spec
        const cls =
          status === "Partial"
            ? "bg-blue-100 text-blue-700"
            : undefined
        return <StatusBadge status={status} className={cls} />
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
            onClick={() => onView(row.original)}
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
            onClick={() => onEdit(row.original)}
            title="Edit purchase"
          >
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ]
}

// ─── View Dialog ─────────────────────────────────────────────────────────────
function PurchaseViewDialog({
  purchase,
  open,
  onClose,
}: {
  purchase: Purchase | null
  open: boolean
  onClose: () => void
}) {
  if (!purchase) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Purchase Order Details
              </DialogTitle>
              <DialogDescription className="text-slate-500 mt-0.5">
                <span className="font-mono font-semibold text-blue-600 text-sm">
                  {purchase.poNumber}
                </span>
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={purchase.paymentStatus} />
              <StatusBadge
                status={purchase.deliveryStatus}
                className={purchase.deliveryStatus === "Partial" ? "bg-blue-100 text-blue-700" : undefined}
              />
            </div>
          </div>
        </DialogHeader>

        {/* Meta info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 rounded-xl p-4 mt-2">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Date</p>
            <p className="text-sm font-medium text-slate-800">{formatDate(purchase.date)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Supplier</p>
            <p className="text-sm font-medium text-slate-800">{purchase.supplierName}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Payment Method</p>
            <p className="text-sm font-medium text-slate-800">{purchase.paymentMethod}</p>
          </div>
          {purchase.dueDate && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Due Date</p>
              <p className="text-sm font-medium text-slate-800">{formatDate(purchase.dueDate)}</p>
            </div>
          )}
          {purchase.notes && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-slate-400 mb-0.5">Notes</p>
              <p className="text-sm text-slate-700">{purchase.notes}</p>
            </div>
          )}
        </div>

        {/* Items table */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Items ({purchase.items.length})
          </h3>
          <div className="rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[450px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    Product
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    Type
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    Qty
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    Unit Cost
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchase.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{item.productName}</p>
                      {item.imeis && item.imeis.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          IMEIs: {item.imeis.join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          item.productType === "Mobile"
                            ? "border-blue-200 text-blue-700 bg-blue-50"
                            : "border-slate-200 text-slate-700 bg-slate-50"
                        }
                      >
                        {item.productType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCurrency(item.unitCost)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial summary */}
        <div className="mt-4 flex justify-end">
          <div className="w-full sm:w-72 space-y-2 bg-slate-50 rounded-xl p-4">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(purchase.subtotal)}</span>
            </div>
            {purchase.shippingCost > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Shipping</span>
                <span>{formatCurrency(purchase.shippingCost)}</span>
              </div>
            )}
            {purchase.tax > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tax</span>
                <span>{formatCurrency(purchase.tax)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-2 mt-2">
              <span>Total</span>
              <span>{formatCurrency(purchase.total)}</span>
            </div>
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Amount Paid</span>
              <span>{formatCurrency(purchase.amountPaid)}</span>
            </div>
            {purchase.balanceDue > 0 && (
              <div className="flex justify-between text-sm font-semibold text-red-600">
                <span>Balance Due</span>
                <span>{formatCurrency(purchase.balanceDue)}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PurchasesPage() {
  // ── Data state ──────────────────────────────────────────────────────────
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [mobiles, setMobiles] = useState<Mobile[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [loading, setLoading] = useState(true)

  // Product names for dropdown
  const productNames = useMemo(() => {
    const mNames = mobiles.map(m => `${m.brand} ${m.model}`)
    const aNames = accessories.map(a => `${a.name} — ${a.brand}`)
    return [...new Set([...mNames, ...aNames])].sort()
  }, [mobiles, accessories])

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [purchasesData, suppliersData, mobilesData, accessoriesData] = await Promise.all([
          getPurchases(),
          getSuppliers(),
          getMobiles(),
          getAccessories(),
        ])
        setPurchases(purchasesData)
        setSuppliers(suppliersData)
        setMobiles(mobilesData)
        setAccessories(accessoriesData)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load purchases")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ── Filter state ──────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all")

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const todayCount = useMemo(
    () => purchases.filter((p) => p.date === TODAY).length,
    [purchases]
  )

  const weekCount = useMemo(
    () =>
      purchases.filter((p) => {
        const d = new Date(p.date)
        return d >= WEEK_START && d <= new Date(TODAY)
      }).length,
    [purchases]
  )

  const monthCount = useMemo(
    () => purchases.filter((p) => p.date.startsWith(CURRENT_MONTH)).length,
    [purchases]
  )

  const totalPayable = useMemo(
    () =>
      purchases
        .filter((p) => p.paymentStatus !== "Paid")
        .reduce((sum, p) => sum + p.balanceDue, 0),
    [purchases]
  )

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (dateFrom && p.date < dateFrom) return false
      if (dateTo && p.date > dateTo) return false
      if (supplierFilter !== "all" && p.supplierId !== supplierFilter) return false
      if (paymentStatusFilter !== "all" && p.paymentStatus !== paymentStatusFilter) return false
      if (deliveryStatusFilter !== "all" && p.deliveryStatus !== deliveryStatusFilter) return false
      return true
    })
  }, [purchases, dateFrom, dateTo, supplierFilter, paymentStatusFilter, deliveryStatusFilter])

  // ── Active filter count ───────────────────────────────────────────────────
  const activeFilterCount = [
    dateFrom,
    dateTo,
    supplierFilter !== "all" ? supplierFilter : "",
    paymentStatusFilter !== "all" ? paymentStatusFilter : "",
    deliveryStatusFilter !== "all" ? deliveryStatusFilter : "",
  ].filter(Boolean).length

  const handleReset = () => {
    setDateFrom("")
    setDateTo("")
    setSupplierFilter("all")
    setPaymentStatusFilter("all")
    setDeliveryStatusFilter("all")
  }

  const handleView = (purchase: Purchase) => {
    setViewPurchase(purchase)
    setViewOpen(true)
  }

  // ── Edit state ──────────────────────────────────────────────────────────
  const [editPurchase, setEditPurchase] = useState<Purchase | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editPaymentStatus, setEditPaymentStatus] = useState("")
  const [editDeliveryStatus, setEditDeliveryStatus] = useState("")
  const [editAmountPaid, setEditAmountPaid] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editItems, setEditItems] = useState<PurchaseItem[]>([])
  const [editSaving, setEditSaving] = useState(false)

  function handleEdit(purchase: Purchase) {
    setEditPurchase(purchase)
    setEditPaymentStatus(purchase.paymentStatus)
    setEditDeliveryStatus(purchase.deliveryStatus)
    setEditAmountPaid(String(purchase.amountPaid))
    setEditNotes(purchase.notes || "")
    setEditItems(purchase.items.map(i => ({ ...i })))
    setEditOpen(true)
  }

  function updateEditItem(idx: number, field: string, value: string | number) {
    setEditItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === "unitCost" || field === "quantity") {
        updated.total = (Number(updated.unitCost) || 0) * (Number(updated.quantity) || 0)
      }
      return updated
    }))
  }

  const editSubtotal = editItems.reduce((s, i) => s + (i.total || 0), 0)

  async function handleEditSave() {
    if (!editPurchase || editSaving) return
    setEditSaving(true)
    try {
      const paid = parseFloat(editAmountPaid) || 0
      const newTotal = editSubtotal + (editPurchase.shippingCost || 0) + (editPurchase.tax || 0)
      const bal = Math.max(0, newTotal - paid)
      const ps = paid <= 0 ? "Unpaid" : paid >= newTotal ? "Paid" : "Partial"

      // Update purchase header
      await updatePurchaseStatus(editPurchase.id, {
        paymentStatus: ps as any,
        deliveryStatus: editDeliveryStatus as any,
        amountPaid: paid,
        balanceDue: bal,
        notes: editNotes,
      })

      // Update subtotal/total on purchase
      await supabase.from("purchases").update({
        subtotal: editSubtotal, total: newTotal, balance_due: bal,
      }).eq("id", editPurchase.id)

      // Delete old items and re-insert updated ones
      await supabase.from("purchase_items").delete().eq("purchase_id", editPurchase.id)
      const tenantId = (await supabase.from("purchases").select("tenant_id").eq("id", editPurchase.id).single()).data?.tenant_id
      if (tenantId) {
        await supabase.from("purchase_items").insert(
          editItems.map(item => ({
            tenant_id: tenantId,
            purchase_id: editPurchase.id,
            product_id: item.productId || null,
            product_name: item.productName,
            product_type: item.productType,
            quantity: item.quantity,
            unit_cost: item.unitCost,
            total: item.total,
            imeis: item.imeis || null,
          }))
        )
      }

      setPurchases(prev => prev.map(p => p.id === editPurchase.id ? {
        ...p, paymentStatus: ps as any, deliveryStatus: editDeliveryStatus as any,
        amountPaid: paid, balanceDue: bal, notes: editNotes,
        subtotal: editSubtotal, total: newTotal, items: editItems,
      } : p))
      toast.success("Purchase updated")
      setEditOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally { setEditSaving(false) }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo(() => buildColumns(handleView, handleEdit), [])

  // ── Filter toolbar ────────────────────────────────────────────────────────
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 w-full">
      {/* Date range */}
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 w-28 sm:w-36 text-sm"
          placeholder="From"
        />
        <span className="text-slate-400 text-sm">—</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 w-28 sm:w-36 text-sm"
          placeholder="To"
        />
      </div>

      {/* Supplier */}
      <Select value={supplierFilter} onValueChange={setSupplierFilter}>
        <SelectTrigger className="h-9 w-full sm:w-52 text-sm">
          <SelectValue placeholder="All Suppliers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Suppliers</SelectItem>
          {suppliers
            .filter((s) => s.status === "Active")
            .map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.companyName}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      {/* Payment status */}
      <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
        <SelectTrigger className="h-9 w-full sm:w-40 text-sm">
          <SelectValue placeholder="Payment Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Payments</SelectItem>
          <SelectItem value="Paid">Paid</SelectItem>
          <SelectItem value="Partial">Partial</SelectItem>
          <SelectItem value="Unpaid">Unpaid</SelectItem>
        </SelectContent>
      </Select>

      {/* Delivery status */}
      <Select value={deliveryStatusFilter} onValueChange={setDeliveryStatusFilter}>
        <SelectTrigger className="h-9 w-full sm:w-40 text-sm">
          <SelectValue placeholder="Delivery Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Deliveries</SelectItem>
          <SelectItem value="Received">Received</SelectItem>
          <SelectItem value="Pending">Pending</SelectItem>
          <SelectItem value="Partial">Partial</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset */}
      {activeFilterCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 text-slate-600 hover:text-red-600 hover:border-red-300"
          onClick={handleReset}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
          <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">
            {activeFilterCount}
          </span>
        </Button>
      )}
    </div>
  )

  return (
    <PageWrapper>
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Purchases"
        description="Manage purchase orders and supplier payments"
        action={
          <Link href="/purchases/new">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm">
              <Plus className="w-4 h-4" />
              New Purchase
            </Button>
          </Link>
        }
      />

      {/* ── Stat Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5 mb-8">
        <StatCard
          title="Today's Purchases"
          value={String(todayCount)}
          subtext={formatDate(TODAY)}
          icon={ShoppingBag}
          iconBg="bg-blue-100"
          gradient="from-purple-50 to-violet-50"
        />
        <StatCard
          title="This Week"
          value={String(weekCount)}
          subtext="Last 7 days"
          icon={CalendarDays}
          iconBg="bg-blue-100"
          gradient="from-blue-50 to-indigo-50"
        />
        <StatCard
          title="This Month"
          value={String(monthCount)}
          subtext="March 2026"
          icon={TrendingDown}
          iconBg="bg-blue-100"
          gradient="from-emerald-50 to-teal-50"
        />
        <StatCard
          title="Total Payable"
          value={formatCurrency(totalPayable)}
          subtext="Balance due to suppliers"
          icon={AlertCircle}
          iconBg="bg-red-100"
          gradient="from-red-50 to-rose-50"
        />
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading purchases...</div>
      ) : (
      <>

      {/* ── Mobile Cards (md:hidden) ─────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {/* Filter toolbar for mobile */}
        {toolbar}

        {filteredPurchases.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">No purchases found</div>
        )}

        {filteredPurchases.map((purchase) => {
          const accentColor =
            purchase.paymentStatus === "Paid"
              ? "bg-emerald-500"
              : purchase.paymentStatus === "Partial"
              ? "bg-amber-400"
              : "bg-red-400"

          const totalQty = purchase.items.reduce((sum: number, i: { quantity: number }) => sum + i.quantity, 0)

          return (
            <div
              key={purchase.id}
              className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              {/* Left accent strip */}
              <div className={`w-1 shrink-0 ${accentColor}`} />

              {/* Card body */}
              <div className="flex-1 p-3 min-w-0">
                {/* Row 1: PO # + Payment + Delivery badges */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-blue-600 text-sm font-bold">{purchase.poNumber}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge status={purchase.paymentStatus} />
                    <StatusBadge
                      status={purchase.deliveryStatus}
                      className={purchase.deliveryStatus === "Partial" ? "bg-blue-100 text-blue-700" : undefined}
                    />
                  </div>
                </div>

                {/* Row 2: Supplier + Date */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-800 text-sm truncate">{purchase.supplierName}</span>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {formatDate(purchase.date)}
                  </span>
                </div>

                {/* Row 3: Items count + Total */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium">
                    <Package className="w-3 h-3" />
                    {purchase.items.length} line{purchase.items.length !== 1 ? "s" : ""} ({totalQty} units)
                  </span>
                  <span className="text-base font-bold text-slate-900">{formatCurrency(purchase.total)}</span>
                </div>

                {/* Row 4: Paid + Balance due */}
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="text-xs text-emerald-700 font-medium">
                    Paid: {formatCurrency(purchase.amountPaid)}
                  </span>
                  {purchase.balanceDue > 0 && (
                    <span className="text-xs text-red-600 font-semibold">
                      Due: {formatCurrency(purchase.balanceDue)}
                    </span>
                  )}
                </div>

                {/* Row 5: Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => handleView(purchase)}
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50"
                    onClick={() => handleEdit(purchase)}
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop Table (hidden md:block) ──────────────────────────────────── */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={filteredPurchases}
          searchKey="supplierName"
          searchPlaceholder="Search by supplier name..."
          toolbar={toolbar}
        />
      </div>

      </>
      )}

      {/* ── View Dialog ──────────────────────────────────────────────────────── */}
      <PurchaseViewDialog
        purchase={viewPurchase}
        open={viewOpen}
        onClose={() => setViewOpen(false)}
      />

      {/* ── Edit Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Edit Purchase</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editPurchase?.poNumber} · {editPurchase?.supplierName} · {editPurchase?.date}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Purchase-level fields */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Payment Status</Label>
                <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Delivery Status</Label>
                <Select value={editDeliveryStatus} onValueChange={setEditDeliveryStatus}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Received">Received</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Amount Paid (Rs)</Label>
                <Input type="number" min={0} value={editAmountPaid} onChange={e => setEditAmountPaid(e.target.value)} className="h-9 text-sm" />
                {editPurchase && (
                  <p className="text-[10px] text-slate-400">
                    Balance: {formatCurrency(Math.max(0, editPurchase.total - (parseFloat(editAmountPaid) || 0)))}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Notes</Label>
                <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="h-9 text-sm" placeholder="Optional..." />
              </div>
            </div>

            {/* Editable Items */}
            {editItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items ({editItems.length})</p>
                <div className="space-y-2">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-2 space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-400">Product Name</Label>
                          <Select value={item.productName} onValueChange={v => updateEditItem(idx, "productName", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select product" /></SelectTrigger>
                            <SelectContent className="max-h-48">
                              {/* Current value always shown */}
                              {item.productName && !productNames.includes(item.productName) && (
                                <SelectItem value={item.productName}>{item.productName}</SelectItem>
                              )}
                              {productNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-400">Type</Label>
                          <Select value={item.productType} onValueChange={v => updateEditItem(idx, "productType", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Mobile">Mobile</SelectItem>
                              <SelectItem value="Accessory">Accessory</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-400">Qty</Label>
                          <Input type="number" min={1} value={item.quantity} onChange={e => updateEditItem(idx, "quantity", parseInt(e.target.value) || 1)} className="h-8 text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-400">Unit Cost (Rs)</Label>
                          <Input type="number" min={0} value={item.unitCost} onChange={e => updateEditItem(idx, "unitCost", parseFloat(e.target.value) || 0)} className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-400">Total</Label>
                          <div className="h-8 flex items-center px-2 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-800">{formatCurrency(item.total)}</div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-semibold text-slate-400">IMEIs</Label>
                          <Input value={item.imeis?.join(", ") || ""} onChange={e => updateEditItem(idx, "imeis", e.target.value.split(",").map(s => s.trim()).filter(Boolean) as any)} className="h-8 text-xs font-mono" placeholder="—" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end text-xs font-bold text-slate-700 pt-1">
                    Subtotal: {formatCurrency(editSubtotal)}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}

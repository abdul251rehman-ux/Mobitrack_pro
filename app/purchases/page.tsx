"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Plus, Eye, Pencil, ShoppingBag, CalendarDays, TrendingDown, AlertCircle, RotateCcw, Truck, Package, FileText, Download, ArrowLeft, Search } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import Link from "next/link"

import { getPurchases } from "@/lib/api/purchases"
import { getSuppliers } from "@/lib/api/suppliers"
import { Purchase, PurchaseItem, Supplier } from "@/data/types"
import { NewPurchaseSheet } from "@/app/purchases/new-purchase-sheet"
import { DataTable } from "@/components/shared/data-table"
import { PageWrapper } from "@/components/layout/page-wrapper"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { formatCurrency, formatDatePKT, todayPKT } from "@/lib/utils"

// ─── Constants ────────────────────────────────────────────────────────────────
const TODAY = todayPKT()
const CURRENT_MONTH = TODAY.substring(0, 7)
const _now = new Date()
const WEEK_START = new Date(_now.getTime() - 7 * 24 * 60 * 60 * 1000)

// ─── Table Columns ─────────────────────────────────────────────────────────
function buildColumns(onView: (p: Purchase) => void, onEdit: (p: Purchase) => void): ColumnDef<Purchase>[] {
  return [
    {
      accessorKey: "poNumber",
      header: "PO #",
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">
          {row.getValue("poNumber")}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">{formatDatePKT(row.getValue("date"))}</span>
      ),
    },
    {
      accessorKey: "supplierName",
      header: "Supplier",
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-slate-800">{row.getValue("supplierName")}</span>
      ),
    },
    {
      id: "items",
      header: "Items",
      cell: ({ row }) => {
        const items: PurchaseItem[] = row.original.items
        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0)
        return (
          <span className="text-xs text-slate-500">
            {items.length}L - <span className="text-slate-400">{totalQty}u</span>
          </span>
        )
      },
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => (
        <span className="text-xs font-bold text-slate-900 whitespace-nowrap">{formatCurrency(row.getValue("total"))}</span>
      ),
    },
    {
      accessorKey: "amountPaid",
      header: "Amt Paid",
      cell: ({ row }) => (
        <span className="text-xs text-slate-600 whitespace-nowrap">{formatCurrency(row.getValue("amountPaid"))}</span>
      ),
    },
    {
      accessorKey: "balanceDue",
      header: "Bal Due",
      cell: ({ row }) => {
        const balance: number = row.getValue("balanceDue")
        return balance > 0 ? (
          <span className="text-xs font-semibold text-red-600 whitespace-nowrap">{formatCurrency(balance)}</span>
        ) : (
          <span className="text-xs text-slate-300">-</span>
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
        const cls = status === "Partial" ? "bg-blue-100 text-blue-700" : undefined
        return <StatusBadge status={status} className={cls} />
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => onView(row.original)} title="View details">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => onEdit(row.original)} title="Edit purchase">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Link href={`/purchase-returns?from=${row.original.id}`}>
            <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Return items to supplier">
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
          </Link>
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 bg-slate-50 rounded-xl p-3 sm:p-4 mt-2">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Date</p>
            <p className="text-sm font-medium text-slate-800">{formatDatePKT(purchase.date)}</p>
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
              <p className="text-sm font-medium text-slate-800">{formatDatePKT(purchase.dueDate)}</p>
            </div>
          )}
          {purchase.notes && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-xs text-slate-400 mb-0.5">Notes</p>
              <p className="text-sm text-slate-700">{purchase.notes}</p>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Items ({purchase.items.length})
          </h3>

          {/* Mobile card layout */}
          <div className="sm:hidden space-y-2">
            {purchase.items.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800 text-sm">{item.productName}</span>
                  <Badge
                    variant="outline"
                    className={
                      item.productType === "Mobile"
                        ? "border-blue-200 text-blue-700 bg-blue-50 shrink-0"
                        : "border-slate-200 text-slate-700 bg-slate-50 shrink-0"
                    }
                  >
                    {item.productType}
                  </Badge>
                </div>
                {item.imeis && item.imeis.length > 0 && (
                  <p className="text-xs text-slate-400 font-mono break-all">
                    IMEIs: {item.imeis.join(", ")}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Qty: {item.quantity} × {formatCurrency(item.unitCost)}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                  <span className="text-xs text-slate-400">Total</span>
                  <span className="font-semibold text-sm text-slate-900">{formatCurrency(item.total)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table layout */}
          <div className="hidden sm:block rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
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
          <div className="w-full sm:w-72 space-y-2 bg-slate-50 rounded-xl p-3 sm:p-4">
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
  const [loading, setLoading] = useState(true)

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true)
      const [purchasesData, suppliersData] = await Promise.all([
        getPurchases(),
        getSuppliers(),
      ])
      setPurchases(purchasesData)
      setSuppliers(suppliersData)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load purchases")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPurchases() }, [loadPurchases])

  // ── Filter state ──────────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [supplierFilter, setSupplierFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all")
  const [search, setSearch] = useState("")

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false)
  const [editSheetPurchaseId, setEditSheetPurchaseId] = useState<string | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const todayStats = useMemo(() => {
    const list = purchases.filter((p) => p.date === TODAY)
    return { count: list.length, total: list.reduce((s, p) => s + p.total, 0) }
  }, [purchases])

  const weekStats = useMemo(() => {
    const list = purchases.filter((p) => {
      const d = new Date(p.date)
      return d >= WEEK_START && d <= new Date(TODAY)
    })
    return { count: list.length, total: list.reduce((s, p) => s + p.total, 0) }
  }, [purchases])

  const monthStats = useMemo(() => {
    const list = purchases.filter((p) => p.date.startsWith(CURRENT_MONTH))
    return { count: list.length, total: list.reduce((s, p) => s + p.total, 0) }
  }, [purchases])

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (dateFrom && p.date < dateFrom) return false
      if (dateTo && p.date > dateTo) return false
      if (supplierFilter !== "all" && p.supplierId !== supplierFilter) return false
      if (paymentStatusFilter !== "all" && p.paymentStatus !== paymentStatusFilter) return false
      if (deliveryStatusFilter !== "all" && p.deliveryStatus !== deliveryStatusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchesHeader =
          p.poNumber.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q) ||
          (p.notes ?? "").toLowerCase().includes(q)
        const matchesItem = p.items.some(i =>
          i.productName.toLowerCase().includes(q) ||
          (i.imeis ?? []).some(imei => imei.toLowerCase().includes(q))
        )
        if (!matchesHeader && !matchesItem) return false
      }
      return true
    })
  }, [purchases, dateFrom, dateTo, supplierFilter, paymentStatusFilter, deliveryStatusFilter, search])

  const totalPayable = useMemo(
    () =>
      filteredPurchases
        .filter((p) => p.paymentStatus !== "Paid")
        .reduce((sum, p) => sum + p.balanceDue, 0),
    [filteredPurchases]
  )

  // ── Active filter count ───────────────────────────────────────────────────
  const activeFilterCount = [
    dateFrom,
    dateTo,
    supplierFilter !== "all" ? supplierFilter : "",
    paymentStatusFilter !== "all" ? paymentStatusFilter : "",
    deliveryStatusFilter !== "all" ? deliveryStatusFilter : "",
    search,
  ].filter(Boolean).length

  const handleReset = () => {
    setDateFrom("")
    setDateTo("")
    setSupplierFilter("all")
    setPaymentStatusFilter("all")
    setDeliveryStatusFilter("all")
    setSearch("")
  }

  const handleView = (purchase: Purchase) => {
    setViewPurchase(purchase)
    setViewOpen(true)
  }

  function handleEdit(purchase: Purchase) {
    setEditSheetPurchaseId(purchase.id)
    setEditSheetOpen(true)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo(() => buildColumns(handleView, handleEdit), [])

  // ── Filter toolbar ────────────────────────────────────────────────────────
  const toolbar = (
    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
      {/* Universal search */}
      <div className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Supplier, PO #, product, IMEI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 w-56 text-xs"
        />
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1 shrink-0">
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-[108px] text-xs" />
        <span className="text-slate-400 text-xs">-</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-[108px] text-xs" />
      </div>

      {/* Supplier dropdown (secondary - exact match) */}
      <Select value={supplierFilter} onValueChange={setSupplierFilter}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="All Suppliers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Suppliers</SelectItem>
          {suppliers.filter((s) => s.status === "Active").map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Payment status */}
      <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue placeholder="All Payments" />
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
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue placeholder="All Deliveries" />
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
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs text-slate-600 hover:text-red-600 hover:border-red-300" onClick={handleReset}>
          <RotateCcw className="w-3 h-3" />
          Reset
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold">
            {activeFilterCount}
          </span>
        </Button>
      )}
    </div>
  )

  async function handleExportPDF() {
    if (filteredPurchases.length === 0) { toast.error("No purchases to export"); return }
    const [{ generateReportPDF }, { getTenant }] = await Promise.all([
      import("@/lib/pdf/report"),
      import("@/lib/api/settings"),
    ])
    const tenant = await getTenant()
    const periodParts = [dateFrom && "From: " + dateFrom, dateTo && "To: " + dateTo].filter(Boolean)
    const subtitle = [...periodParts, filteredPurchases.length + " orders"].join(" | ")
    generateReportPDF({
      shopName:    tenant?.name    ?? "Mobile Shop",
      shopAddress: [tenant?.address, tenant?.city].filter(Boolean).join(", "),
      shopPhone:   tenant?.phone   ?? "",
      title:       "Purchase Orders",
      subtitle,
      columns: [
        { header: "PO #",        dataKey: "poNumber",       width: 24, halign: "left" },
        { header: "Date",        dataKey: "date",           width: 20 },
        { header: "Supplier",    dataKey: "supplierName",   width: 36 },
        { header: "Items",       dataKey: "itemCount",      width: 12, halign: "center" },
        { header: "Total",       dataKey: "totalFmt",       width: 28, halign: "right" },
        { header: "Paid",        dataKey: "paidFmt",        width: 28, halign: "right" },
        { header: "Balance Due", dataKey: "balanceFmt",     width: 28, halign: "right", bold: true },
        { header: "Pay Status",  dataKey: "paymentStatus",  width: 22 },
        { header: "Delivery",    dataKey: "deliveryStatus", width: 22 },
      ],
      rows: filteredPurchases.map(p => ({
        poNumber:       p.poNumber,
        date:           p.date,
        supplierName:   p.supplierName,
        itemCount:      String(p.items.length),
        totalFmt:       "Rs " + p.total.toLocaleString(),
        paidFmt:        "Rs " + p.amountPaid.toLocaleString(),
        balanceFmt:     p.balanceDue > 0 ? "Rs " + p.balanceDue.toLocaleString() : "-",
        paymentStatus:  p.paymentStatus,
        deliveryStatus: p.deliveryStatus,
      })),
      summary: [
        { label: "Total Orders",  value: String(filteredPurchases.length) },
        { label: "Total Spent",   value: "Rs " + filteredPurchases.reduce((s, p) => s + p.total, 0).toLocaleString() },
        { label: "Total Payable", value: "Rs " + filteredPurchases.reduce((s, p) => s + p.balanceDue, 0).toLocaleString() },
      ],
      filename: "purchases-" + todayPKT(),
    })
    toast.success("PDF exported")
  }

  async function handleExportExcel() {
    if (filteredPurchases.length === 0) { toast.error("No purchases to export"); return }
    const { exportToExcel } = await import("@/lib/excel-export")
    const periodParts = [dateFrom && "From: " + dateFrom, dateTo && "To: " + dateTo].filter(Boolean)
    exportToExcel(
      filteredPurchases.map(p => ({
        poNumber:       p.poNumber,
        date:           p.date,
        supplierName:   p.supplierName,
        items:          p.items.length,
        total:          p.total,
        amountPaid:     p.amountPaid,
        balanceDue:     p.balanceDue,
        paymentStatus:  p.paymentStatus,
        deliveryStatus: p.deliveryStatus,
        notes:          p.notes || "",
      })),
      "purchases-" + todayPKT(),
      [
        { key: "poNumber",       header: "PO #",          width: 16 },
        { key: "date",           header: "Date",           width: 14 },
        { key: "supplierName",   header: "Supplier",       width: 28 },
        { key: "items",          header: "Items",          width: 10, align: "center" },
        { key: "total",          header: "Total (Rs)",     width: 16, numFmt: "#,##0", align: "right" },
        { key: "amountPaid",     header: "Paid (Rs)",      width: 16, numFmt: "#,##0", align: "right" },
        { key: "balanceDue",     header: "Balance Due (Rs)", width: 18, numFmt: "#,##0", align: "right" },
        { key: "paymentStatus",  header: "Payment",        width: 14 },
        { key: "deliveryStatus", header: "Delivery",       width: 14 },
        { key: "notes",          header: "Notes",          width: 24 },
      ],
      {
        sheetName: "Purchases",
        title: "Purchase Orders",
        subtitle: periodParts.join(" | ") || undefined,
        summaryRows: [
          { label: "Total Orders", value: filteredPurchases.length },
          { label: "Total Spent",  value: filteredPurchases.reduce((s, p) => s + p.total, 0) },
          { label: "Total Payable", value: filteredPurchases.reduce((s, p) => s + p.balanceDue, 0) },
        ],
      }
    )
    toast.success("Excel exported - " + filteredPurchases.length + " orders")
  }

  return (
    <PageWrapper>
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <PageHeader
        title="Purchases"
        description="Manage purchase orders and supplier payments"
        icon={<ShoppingBag />}
        iconBg="bg-violet-600"
        action={
          <div className="flex items-center gap-1.5">
            <button onClick={handleExportPDF} className="flex items-center gap-1.5 h-9 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
              <FileText className="w-3.5 h-3.5" />PDF
            </button>
            <button onClick={handleExportExcel} className="flex items-center gap-1.5 h-9 px-3 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
              <Download className="w-3.5 h-3.5" />Excel
            </button>
            <Button onClick={() => setNewPurchaseOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm h-9">
              <Plus className="w-4 h-4" />
              New Purchase
            </Button>
          </div>
        }
      />

      {/* ── Stat Cards - 4 in one row ────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        <StatCard
          title="Today's Purchases"
          value={formatCurrency(todayStats.total)}
          subtext={`${todayStats.count} order${todayStats.count !== 1 ? "s" : ""}`}
          icon={ShoppingBag}
          iconBg="bg-blue-100"
        />
        <StatCard
          title="This Week"
          value={formatCurrency(weekStats.total)}
          subtext={`${weekStats.count} order${weekStats.count !== 1 ? "s" : ""} - last 7 days`}
          icon={CalendarDays}
          iconBg="bg-blue-100"
        />
        <StatCard
          title="This Month"
          value={formatCurrency(monthStats.total)}
          subtext={`${monthStats.count} order${monthStats.count !== 1 ? "s" : ""} - ${new Date().toLocaleString("default", { month: "long", year: "numeric" })}`}
          icon={TrendingDown}
          iconBg="bg-blue-100"
        />
        <StatCard
          title="Total Payable"
          value={formatCurrency(totalPayable)}
          subtext="Balance due to suppliers"
          icon={AlertCircle}
          iconBg="bg-red-100"
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
                    {formatDatePKT(purchase.date)}
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
                  <Link href={`/purchase-returns?from=${purchase.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      Return
                    </Button>
                  </Link>
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

      <NewPurchaseSheet
        open={newPurchaseOpen}
        onClose={() => setNewPurchaseOpen(false)}
        onCreated={loadPurchases}
      />

      <NewPurchaseSheet
        open={editSheetOpen}
        onClose={() => { setEditSheetOpen(false); setEditSheetPurchaseId(null) }}
        onCreated={loadPurchases}
        editPurchaseId={editSheetPurchaseId}
      />

    </PageWrapper>
  )
}

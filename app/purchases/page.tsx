"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Plus, Eye, Pencil, ShoppingBag, CalendarDays, TrendingDown, AlertCircle, RotateCcw, Truck, Package, FileText, Download, ArrowLeft, Search } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import Link from "next/link"

import { getPurchases, updatePurchaseStatus } from "@/lib/api/purchases"
import { getMobiles, getAccessories } from "@/lib/api/products"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import type { Mobile, Accessory } from "@/data/types"
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
            {items.length}L · <span className="text-slate-400">{totalQty}u</span>
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
          <span className="text-xs text-slate-300">—</span>
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
  const [mobiles, setMobiles] = useState<Mobile[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [loading, setLoading] = useState(true)

  // Product names for dropdown
  const productNames = useMemo(() => {
    const mNames = mobiles.map(m => `${m.brand} ${m.model}`)
    const aNames = accessories.map(a => `${a.name} — ${a.brand}`)
    return [...new Set([...mNames, ...aNames])].sort()
  }, [mobiles, accessories])

  const loadPurchases = useCallback(async () => {
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
      const previousPaid = editPurchase.amountPaid || 0
      const newTotal = editSubtotal + (editPurchase.shippingCost || 0) + (editPurchase.tax || 0)
      const bal = Math.max(0, newTotal - paid)
      const ps = paid <= 0 ? "Unpaid" : paid >= newTotal ? "Paid" : "Partial"

      const tenantId = await getTenantId()

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

      // ── Sync mobiles.stock for quantity changes ────────────────────────
      for (const newItem of editItems) {
        if (newItem.productType !== "Mobile" || !newItem.productId) continue
        const oldItem = editPurchase.items.find(i => i.productId === newItem.productId)
        const oldQty = oldItem?.quantity ?? 0
        const delta = newItem.quantity - oldQty
        if (delta === 0) continue
        const { data: mob } = await supabase.from("mobiles")
          .select("stock").eq("id", newItem.productId).eq("tenant_id", tenantId).maybeSingle()
        if (mob) {
          await supabase.from("mobiles")
            .update({ stock: Math.max(0, (mob as any).stock + delta) })
            .eq("id", newItem.productId)
        }
        if (delta > 0) {
          // Add placeholder imei_records for added quantity — real IMEIs unknown at edit time
          const records = Array.from({ length: delta }, (_, i) => ({
            tenant_id: tenantId,
            product_id: newItem.productId,
            imei_number: `EDIT-${editPurchase.id}-${newItem.productId}-${Date.now()}-${i}`,
            device_status: "in_stock",
            purchase_id: editPurchase.id,
          }))
          await supabase.from("imei_records").insert(records)
        } else if (delta < 0) {
          // Remove placeholder imei_records for reduced quantity (in_stock only — never remove sold units)
          const { data: toRemove } = await supabase.from("imei_records")
            .select("id").eq("product_id", newItem.productId).eq("purchase_id", editPurchase.id)
            .eq("device_status", "in_stock").eq("tenant_id", tenantId).limit(Math.abs(delta))
          if (toRemove && toRemove.length > 0) {
            await supabase.from("imei_records").delete().in("id", toRemove.map((r: any) => r.id))
          }
        }
      }

      // ── Sync payment records with supplier ledger ──────────────────────
      // If amount paid changed, update/create/delete the payment record
      // so the supplier ledger stays in sync
      if (paid !== previousPaid) {
        // Remove any existing payment records for this purchase
        await supabase
          .from("payments")
          .delete()
          .eq("reference_number", editPurchase.poNumber)
          .eq("entity_type", "Supplier")
          .eq("type", "Paid")
          .eq("tenant_id", tenantId)

        // Create a new payment record if amount > 0
        if (paid > 0) {
          const supplierName = suppliers.find(s => s.id === editPurchase.supplierId)?.companyName || editPurchase.supplierName
          const { error: payErr } = await supabase.from("payments").insert({
            tenant_id: tenantId,
            date: todayPKT(),
            type: "Paid",
            entity_type: "Supplier",
            entity_id: editPurchase.supplierId,
            entity_name: supplierName,
            reference_type: "Purchase",
            reference_number: editPurchase.poNumber,
            amount: paid,
            method: editPurchase.paymentMethod || "Cash",
            status: "Completed",
            notes: `Payment for ${editPurchase.poNumber}`,
          })
          if (payErr) throw new Error(`Failed to sync payment record: ${payErr.message}`)
        }
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
        <span className="text-slate-400 text-xs">—</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-[108px] text-xs" />
      </div>

      {/* Supplier dropdown (secondary — exact match) */}
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
        balanceFmt:     p.balanceDue > 0 ? "Rs " + p.balanceDue.toLocaleString() : "—",
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
    toast.success("Excel exported — " + filteredPurchases.length + " orders")
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

      {/* ── Stat Cards — 4 in one row ────────────────────────────────────────── */}
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
          subtext={`${weekStats.count} order${weekStats.count !== 1 ? "s" : ""} · last 7 days`}
          icon={CalendarDays}
          iconBg="bg-blue-100"
        />
        <StatCard
          title="This Month"
          value={formatCurrency(monthStats.total)}
          subtext={`${monthStats.count} order${monthStats.count !== 1 ? "s" : ""} · ${new Date().toLocaleString("default", { month: "long", year: "numeric" })}`}
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
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Edit Purchase</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {editPurchase?.poNumber} · {editPurchase?.supplierName} · {editPurchase?.date}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 sm:space-y-5 py-1 sm:py-2">
            {/* ── Order Details Section ─────────────────────────── */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Order Details</p>
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
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
                    <p className="text-[10px] text-slate-400">Auto-updates when amount paid changes</p>
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Amount Paid (Rs)</Label>
                    <Input type="number" min={0} value={editAmountPaid} onChange={e => {
                      const val = e.target.value
                      setEditAmountPaid(val)
                      const paid = parseFloat(val) || 0
                      const total = editSubtotal + (editPurchase?.shippingCost || 0) + (editPurchase?.tax || 0)
                      setEditPaymentStatus(paid <= 0 ? "Unpaid" : paid >= total ? "Paid" : "Partial")
                    }} className="h-9 text-sm" />
                    {editPurchase && (
                      <p className="text-[11px] text-slate-400">
                        Balance: {formatCurrency(Math.max(0, editPurchase.total - (parseFloat(editAmountPaid) || 0)))}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-600">Notes</Label>
                    <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="h-9 text-sm" placeholder="Optional..." />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Items Section ──────────────────────────────────── */}
            {editItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items ({editItems.length})</p>
                <div className="space-y-3">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:p-4 space-y-3">
                      {/* Product & Type */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-500">Product Name</Label>
                          <Select value={item.productName} onValueChange={v => updateEditItem(idx, "productName", v)}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select product" /></SelectTrigger>
                            <SelectContent className="max-h-48">
                              {item.productName && !productNames.includes(item.productName) && (
                                <SelectItem value={item.productName}>{item.productName}</SelectItem>
                              )}
                              {productNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-500">Type</Label>
                          <Select value={item.productType} onValueChange={v => updateEditItem(idx, "productType", v)}>
                            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Mobile">Mobile</SelectItem>
                              <SelectItem value="Accessory">Accessory</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {/* Qty, Unit Cost, Total */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-500">Qty</Label>
                          <Input type="number" min={1} value={item.quantity} onChange={e => updateEditItem(idx, "quantity", parseInt(e.target.value) || 1)} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-500">Unit Cost</Label>
                          <Input type="number" min={0} value={item.unitCost} onChange={e => updateEditItem(idx, "unitCost", parseFloat(e.target.value) || 0)} className="h-9 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-slate-500">Total</Label>
                          <div className="h-9 flex items-center px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-800">{formatCurrency(item.total)}</div>
                        </div>
                      </div>
                      {/* IMEIs */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-500">IMEIs</Label>
                        <Input value={item.imeis?.join(", ") || ""} onChange={e => updateEditItem(idx, "imeis", e.target.value.split(",").map(s => s.trim()).filter(Boolean) as any)} className="h-9 text-sm font-mono" placeholder="Comma-separated IMEIs..." />
                      </div>
                    </div>
                  ))}
                  {/* Subtotal */}
                  <div className="flex justify-end items-center gap-2 pt-1 pr-1">
                    <span className="text-xs text-slate-500">Subtotal:</span>
                    <span className="text-sm font-bold text-slate-800">{formatCurrency(editSubtotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Action Buttons ────────────────────────────────── */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button size="sm" className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700" onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <NewPurchaseSheet
        open={newPurchaseOpen}
        onClose={() => setNewPurchaseOpen(false)}
        onCreated={loadPurchases}
      />

    </PageWrapper>
  )
}

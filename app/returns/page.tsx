"use client"

import { useState, useMemo, useEffect } from "react"
import {
  RotateCcw, Search, Plus, Eye, CheckCircle2, XCircle,
  Clock, ArrowLeftRight, Package, AlertTriangle,
  DollarSign, Percent, Trash2, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

import { getReturns, createReturn, updateReturnStatus } from "@/lib/api/returns"
import { Return, ReturnStatus, ReturnReason, ReturnItem } from "@/data/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"

// ─── Constants ────────────────────────────────────────────────────────────────

const RETURN_REASONS: ReturnReason[] = [
  "Defective",
  "Wrong Item",
  "Customer Changed Mind",
  "Not As Described",
  "Duplicate Order",
  "Damaged in Transit",
  "Warranty Claim",
  "Other",
]

const RETURN_STATUSES: ReturnStatus[] = [
  "Pending",
  "Approved",
  "Rejected",
  "Completed",
  "Exchanged",
]

const REFUND_METHODS = [
  "Cash",
  "Card",
  "JazzCash",
  "EasyPaisa",
  "Bank Transfer",
  "Store Credit",
]

const ITEM_CONDITIONS: ReturnItem["condition"][] = ["Good", "Damaged", "Defective"]

const STATUS_COLORS: Record<ReturnStatus, string> = {
  Pending: "bg-amber-50 text-amber-700 border border-amber-200",
  Approved: "bg-blue-50 text-blue-700 border border-blue-200",
  Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border border-red-200",
  Exchanged: "bg-purple-50 text-purple-700 border border-purple-200",
}

const REASON_COLORS: Record<ReturnReason, string> = {
  Defective: "bg-red-50 text-red-700 border border-red-200",
  "Wrong Item": "bg-orange-50 text-orange-700 border border-orange-200",
  "Customer Changed Mind": "bg-slate-100 text-slate-600 border border-slate-200",
  "Not As Described": "bg-amber-50 text-amber-700 border border-amber-200",
  "Duplicate Order": "bg-blue-50 text-blue-700 border border-blue-200",
  "Damaged in Transit": "bg-rose-50 text-rose-700 border border-rose-200",
  "Warranty Claim": "bg-violet-50 text-violet-700 border border-violet-200",
  Other: "bg-slate-100 text-slate-500 border border-slate-200",
}

const APPROX_TOTAL_SALES = 45 // approximate total sales for return rate calculation

// ─── New-item template ────────────────────────────────────────────────────────

interface NewReturnItem {
  productName: string
  productType: "Mobile" | "Accessory"
  quantity: number
  unitPrice: number
  condition: ReturnItem["condition"]
  imei: string
}

const EMPTY_ITEM: NewReturnItem = {
  productName: "",
  productType: "Mobile",
  quantity: 1,
  unitPrice: 0,
  condition: "Good",
  imei: "",
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReturnsPage() {
  // ── Data state ────────────────────────────────────────────────────────────
  const [returnsList, setReturnsList] = useState<Return[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const data = await getReturns()
        setReturnsList(data)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch returns")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [reasonFilter, setReasonFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [viewReturn, setViewReturn] = useState<Return | null>(null)

  // ── New return form state ─────────────────────────────────────────────────
  const [newInvoice, setNewInvoice] = useState("")
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newReason, setNewReason] = useState<ReturnReason>("Defective")
  const [newRefundMethod, setNewRefundMethod] = useState("Cash")
  const [newRestock, setNewRestock] = useState(true)
  const [newNotes, setNewNotes] = useState("")
  const [newItems, setNewItems] = useState<NewReturnItem[]>([{ ...EMPTY_ITEM }])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = returnsList.length
    const pending = returnsList.filter((r) => r.status === "Pending").length
    const totalRefunded = returnsList
      .filter((r) => r.status === "Completed" || r.status === "Approved")
      .reduce((acc, r) => acc + r.refundAmount, 0)
    const returnRate = APPROX_TOTAL_SALES > 0 ? ((total / APPROX_TOTAL_SALES) * 100).toFixed(1) : "0"
    return { total, pending, totalRefunded, returnRate }
  }, [returnsList])

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return returnsList.filter((r) => {
      if (
        search &&
        !r.returnNumber.toLowerCase().includes(search.toLowerCase()) &&
        !r.customerName.toLowerCase().includes(search.toLowerCase())
      ) {
        return false
      }
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (reasonFilter !== "all" && r.reason !== reasonFilter) return false
      if (dateFrom && r.date < dateFrom) return false
      if (dateTo && r.date > dateTo) return false
      return true
    })
  }, [returnsList, search, statusFilter, reasonFilter, dateFrom, dateTo])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function resetFilters() {
    setSearch("")
    setStatusFilter("all")
    setReasonFilter("all")
    setDateFrom("")
    setDateTo("")
  }

  function resetForm() {
    setNewInvoice("")
    setNewCustomerName("")
    setNewCustomerPhone("")
    setNewReason("Defective")
    setNewRefundMethod("Cash")
    setNewRestock(true)
    setNewNotes("")
    setNewItems([{ ...EMPTY_ITEM }])
  }

  function lookupInvoice() {
    // Simulate invoice lookup against known returns data
    const match = returnsList.find((r) => r.invoiceNumber === newInvoice)
    if (match) {
      setNewCustomerName(match.customerName)
      setNewCustomerPhone(match.customerPhone)
      toast.success("Invoice found — customer info populated")
    } else {
      toast.error("Invoice not found — please enter customer details manually")
    }
  }

  function calcRefundTotal(): number {
    return newItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  }

  function updateItem(index: number, patch: Partial<NewReturnItem>) {
    setNewItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it))
    )
  }

  function removeItem(index: number) {
    setNewItems((prev) => prev.filter((_, i) => i !== index))
  }

  function addItem() {
    setNewItems((prev) => [...prev, { ...EMPTY_ITEM }])
  }

  // ── Create return ─────────────────────────────────────────────────────────

  async function handleCreateReturn() {
    if (!newInvoice.trim()) {
      toast.error("Invoice number is required")
      return
    }
    if (!newCustomerName.trim()) {
      toast.error("Customer name is required")
      return
    }
    if (newItems.length === 0 || newItems.some((it) => !it.productName.trim())) {
      toast.error("Please add at least one item with a product name")
      return
    }

    const nextNum = returnsList.length + 1
    const refundAmount = calcRefundTotal()

    const items: ReturnItem[] = newItems.map((it, idx) => ({
      productId: `ret-prod-${Date.now()}-${idx}`,
      productName: it.productName,
      productType: it.productType,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: it.quantity * it.unitPrice,
      imei: it.imei || undefined,
      condition: it.condition,
    }))

    const newReturn: Return = {
      id: `ret-${String(nextNum).padStart(3, "0")}`,
      returnNumber: `RET-2026-${String(nextNum).padStart(4, "0")}`,
      date: new Date().toISOString().split("T")[0],
      saleId: `sale-lookup-${newInvoice}`,
      invoiceNumber: newInvoice,
      customerId: `cust-new-${Date.now()}`,
      customerName: newCustomerName,
      customerPhone: newCustomerPhone,
      items,
      reason: newReason,
      subtotal: refundAmount,
      refundAmount,
      refundMethod: newRefundMethod,
      status: "Pending",
      restockItems: newRestock,
      processedBy: "Current User",
      notes: newNotes || undefined,
      createdAt: new Date().toISOString(),
    }

    try {
      const created = await createReturn(
        {
          returnNumber: newReturn.returnNumber,
          date: newReturn.date,
          saleId: newReturn.saleId,
          invoiceNumber: newReturn.invoiceNumber,
          customerId: newReturn.customerId,
          customerName: newReturn.customerName,
          customerPhone: newReturn.customerPhone,
          reason: newReturn.reason,
          subtotal: newReturn.subtotal,
          refundAmount: newReturn.refundAmount,
          refundMethod: newReturn.refundMethod,
          status: newReturn.status,
          restockItems: newReturn.restockItems,
          processedBy: newReturn.processedBy,
          notes: newReturn.notes,
          createdAt: newReturn.createdAt,
          items: [],
        },
        items,
      )
      setReturnsList((prev) => [created, ...prev])
      setShowCreate(false)
      resetForm()
      toast.success(`Return ${newReturn.returnNumber} created successfully`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create return")
    }
  }

  // ── Status actions ────────────────────────────────────────────────────────

  async function approveReturn(id: string) {
    try {
      await updateReturnStatus(id, "Approved")
      setReturnsList((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "Approved" as ReturnStatus } : r))
      )
      toast.success("Return approved")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve return")
    }
  }

  async function rejectReturn(id: string) {
    try {
      await updateReturnStatus(id, "Rejected")
      setReturnsList((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: "Rejected" as ReturnStatus, resolvedAt: new Date().toISOString() }
            : r
        )
      )
      toast.success("Return rejected")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject return")
    }
  }

  async function completeReturn(id: string) {
    try {
      await updateReturnStatus(id, "Completed")
      setReturnsList((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: "Completed" as ReturnStatus, resolvedAt: new Date().toISOString() }
            : r
        )
      )
      toast.success("Return completed — refund processed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete return")
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Returns & Refunds"
        description="Manage product returns, exchanges, and refund processing"
        action={
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-8 text-xs px-3"
            onClick={() => {
              resetForm()
              setShowCreate(true)
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Process Return
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2.5">
        <StatCard
          title="Total Returns"
          value={String(stats.total)}
          icon={RotateCcw}
          iconBg="bg-blue-100"
          subtext="All time returns"
        />
        <StatCard
          title="Pending Returns"
          value={String(stats.pending)}
          icon={Clock}
          iconBg="bg-amber-100"
          subtext="Awaiting processing"
        />
        <StatCard
          title="Total Refunded"
          value={formatCurrency(stats.totalRefunded)}
          icon={DollarSign}
          iconBg="bg-emerald-100"
          subtext="Approved & completed"
        />
        <StatCard
          title="Return Rate"
          value={`${stats.returnRate}%`}
          icon={Percent}
          iconBg="bg-red-100"
          subtext={`${stats.total} of ~${APPROX_TOTAL_SALES} sales`}
        />
      </div>

      {/* Filters */}
      <Card className="border border-slate-100 shadow-sm">
        <CardContent className="px-3 py-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search return # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {RETURN_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reason */}
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date from */}
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-[110px] text-xs" />
            <span className="text-slate-400 text-xs">—</span>
            {/* Date to */}
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-[110px] text-xs" />

            {/* Reset */}
            <Button variant="outline" size="sm" onClick={resetFilters} className="h-8 gap-1 text-xs shrink-0">
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="whitespace-nowrap text-xs px-3 py-2">Return #</TableHead>
                <TableHead className="whitespace-nowrap text-xs px-3 py-2">Date</TableHead>
                <TableHead className="whitespace-nowrap text-xs px-3 py-2">Invoice #</TableHead>
                <TableHead className="whitespace-nowrap text-xs px-3 py-2">Customer</TableHead>
                <TableHead className="whitespace-nowrap text-xs px-3 py-2">Items</TableHead>
                <TableHead className="whitespace-nowrap text-xs px-3 py-2">Reason</TableHead>
                <TableHead className="whitespace-nowrap text-xs px-3 py-2">Refund Amt</TableHead>
                <TableHead className="whitespace-nowrap text-xs px-3 py-2">Status</TableHead>
                <TableHead className="whitespace-nowrap text-xs px-3 py-2 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10 text-slate-400 text-xs">
                    <RotateCcw className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
                    No returns found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((ret) => (
                  <TableRow key={ret.id}>
                    <TableCell className="px-3 py-2 text-xs font-semibold text-blue-600 whitespace-nowrap">{ret.returnNumber}</TableCell>
                    <TableCell className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDate(ret.date)}</TableCell>
                    <TableCell className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{ret.invoiceNumber}</TableCell>
                    <TableCell className="px-3 py-2">
                      <p className="text-xs font-medium text-slate-800 whitespace-nowrap">{ret.customerName}</p>
                      <p className="text-[10px] text-slate-400">{ret.customerPhone}</p>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-1.5 py-0 h-4">
                        {ret.items.length}{ret.items.length === 1 ? " item" : " items"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0 text-[10px] font-medium whitespace-nowrap ${REASON_COLORS[ret.reason]}`}>
                        {ret.reason}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs font-semibold text-slate-800 whitespace-nowrap">{formatCurrency(ret.refundAmount)}</TableCell>
                    <TableCell className="px-3 py-2">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0 text-[10px] font-medium whitespace-nowrap ${STATUS_COLORS[ret.status]}`}>
                        {ret.status}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => setViewReturn(ret)} title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {ret.status === "Pending" && (
                          <>
                            <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => approveReturn(ret.id)} title="Approve">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => rejectReturn(ret.id)} title="Reject">
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        {ret.status === "Approved" && (
                          <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => completeReturn(ret.id)} title="Complete">
                            <Package className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ─── Process Return Dialog ──────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process New Return</DialogTitle>
            <DialogDescription>Enter the return details and items to process a new return.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Invoice lookup */}
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. INV-2025-0002"
                  value={newInvoice}
                  onChange={(e) => setNewInvoice(e.target.value)}
                />
                <Button variant="outline" onClick={lookupInvoice} className="shrink-0">
                  <Search className="w-4 h-4 mr-1.5" />
                  Lookup
                </Button>
              </div>
            </div>

            {/* Customer info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div className="space-y-2">
                <Label>Customer Phone</Label>
                <Input
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="0300-1234567"
                />
              </div>
            </div>

            {/* Return reason */}
            <div className="space-y-2">
              <Label>Return Reason</Label>
              <Select value={newReason} onValueChange={(v) => setNewReason(v as ReturnReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Items to Return</Label>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Item
                </Button>
              </div>

              {newItems.map((item, idx) => (
                <Card key={idx} className="border border-slate-200">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">Item {idx + 1}</span>
                      {newItems.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Product Name</Label>
                        <Input
                          value={item.productName}
                          onChange={(e) => updateItem(idx, { productName: e.target.value })}
                          placeholder="Product name"
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Product Type</Label>
                        <Select
                          value={item.productType}
                          onValueChange={(v) => updateItem(idx, { productType: v as "Mobile" | "Accessory" })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mobile">Mobile</SelectItem>
                            <SelectItem value="Accessory">Accessory</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Unit Price (₨)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, { unitPrice: Math.max(0, Number(e.target.value)) })}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Condition</Label>
                        <Select
                          value={item.condition}
                          onValueChange={(v) => updateItem(idx, { condition: v as ReturnItem["condition"] })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_CONDITIONS.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">IMEI (optional)</Label>
                        <Input
                          value={item.imei}
                          onChange={(e) => updateItem(idx, { imei: e.target.value })}
                          placeholder="15-digit IMEI"
                          className="h-9"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Refund summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Refund Amount</Label>
                <div className="h-10 px-3 flex items-center rounded-md border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900">
                  {formatCurrency(calcRefundTotal())}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Refund Method</Label>
                <Select value={newRefundMethod} onValueChange={setNewRefundMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFUND_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Restock */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="restock"
                checked={newRestock}
                onCheckedChange={(checked) => setNewRestock(checked === true)}
              />
              <Label htmlFor="restock" className="text-sm cursor-pointer">
                Restock returned items to inventory
              </Label>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Additional notes about this return..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreateReturn}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Submit Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View Details Dialog ────────────────────────────────────────────── */}
      <Dialog open={!!viewReturn} onOpenChange={(open) => !open && setViewReturn(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewReturn && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  Return {viewReturn.returnNumber}
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[viewReturn.status]}`}>
                    {viewReturn.status}
                  </span>
                </DialogTitle>
                <DialogDescription>
                  Full details for return {viewReturn.returnNumber}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* General info */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Date</p>
                    <p className="text-slate-800">{formatDate(viewReturn.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Invoice</p>
                    <p className="text-slate-800">{viewReturn.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Customer</p>
                    <p className="text-slate-800 font-medium">{viewReturn.customerName}</p>
                    <p className="text-slate-500 text-xs">{viewReturn.customerPhone}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Reason</p>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${REASON_COLORS[viewReturn.reason]}`}>
                      {viewReturn.reason}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Refund Method</p>
                    <p className="text-slate-800">{viewReturn.refundMethod}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Refund Amount</p>
                    <p className="text-slate-900 font-bold text-base">{formatCurrency(viewReturn.refundAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Restock</p>
                    <p className="text-slate-800">{viewReturn.restockItems ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Processed By</p>
                    <p className="text-slate-800">{viewReturn.processedBy}</p>
                  </div>
                </div>

                {/* Notes */}
                {viewReturn.notes && (
                  <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                    {viewReturn.notes}
                  </div>
                )}

                {/* Items table */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Returned Items</p>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead>Product</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Condition</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewReturn.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <p className="font-medium text-slate-800">{item.productName}</p>
                              {item.imei && (
                                <p className="text-xs text-slate-400">IMEI: {item.imei}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs">
                                {item.productType}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(item.lineTotal)}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                  item.condition === "Good"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : item.condition === "Damaged"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-red-50 text-red-700 border border-red-200"
                                }`}
                              >
                                {item.condition}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Status Timeline */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Status Timeline</p>
                  <div className="space-y-3">
                    {/* Created */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <Plus className="w-3 h-3 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">Return Created</p>
                        <p className="text-xs text-slate-400">{formatDate(viewReturn.createdAt)}</p>
                      </div>
                    </div>

                    {/* Status-specific steps */}
                    {(viewReturn.status === "Approved" || viewReturn.status === "Completed") && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">Approved</p>
                          <p className="text-xs text-slate-400">Return approved for processing</p>
                        </div>
                      </div>
                    )}

                    {viewReturn.status === "Rejected" && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                          <XCircle className="w-3 h-3 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">Rejected</p>
                          <p className="text-xs text-slate-400">
                            {viewReturn.resolvedAt ? formatDate(viewReturn.resolvedAt) : "Return request denied"}
                          </p>
                        </div>
                      </div>
                    )}

                    {viewReturn.status === "Completed" && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">Completed</p>
                          <p className="text-xs text-slate-400">
                            {viewReturn.resolvedAt
                              ? `Refund processed on ${formatDate(viewReturn.resolvedAt)}`
                              : "Refund processed"}
                          </p>
                        </div>
                      </div>
                    )}

                    {viewReturn.status === "Exchanged" && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                          <ArrowLeftRight className="w-3 h-3 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">Exchanged</p>
                          <p className="text-xs text-slate-400">
                            {viewReturn.resolvedAt
                              ? `Product exchanged on ${formatDate(viewReturn.resolvedAt)}`
                              : "Product exchanged with replacement"}
                            {viewReturn.exchangeSaleId && (
                              <span className="text-slate-500 ml-1">(New Sale: {viewReturn.exchangeSaleId})</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {viewReturn.status === "Pending" && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <Clock className="w-3 h-3 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">Awaiting Review</p>
                          <p className="text-xs text-slate-400">Return is pending approval or rejection</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons based on status */}
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewReturn(null)}>
                  Close
                </Button>
                {viewReturn.status === "Pending" && (
                  <>
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        rejectReturn(viewReturn.id)
                        setViewReturn(null)
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        approveReturn(viewReturn.id)
                        setViewReturn(null)
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </>
                )}
                {viewReturn.status === "Approved" && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      completeReturn(viewReturn.id)
                      setViewReturn(null)
                    }}
                  >
                    <Package className="w-4 h-4 mr-2" />
                    Complete Return
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

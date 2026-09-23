"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import {
  RotateCcw, Search, Plus, Eye, CheckCircle2, XCircle,
  Clock, ArrowLeftRight, Package, AlertTriangle,
  DollarSign, Percent, Trash2, ChevronRight,
} from "lucide-react"
import { toast } from "sonner"

import { getReturns, createReturn, updateReturnStatus } from "@/lib/api/returns"
import { getProfiles } from "@/lib/api/settings"
import { getSales, reserveReturnQty, releaseReturnQty } from "@/lib/api/sales"
import { createAuditLog } from "@/lib/api/audit"
import { useAuth } from "@/context/auth-context"
import { getFinanceAccounts, adjustAccountBalance } from "@/lib/api/finance"
import type { Sale } from "@/data/types"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { Return, ReturnStatus, ReturnReason, ReturnItem } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, formatDate, todayPKT, cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { PermissionGate } from "@/components/shared/permission-gate"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
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

// â"€â"€â"€ Constants â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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
  Approved: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Rejected: "bg-rose-50 text-rose-700 border border-rose-200",
  Exchanged: "bg-purple-50 text-purple-700 border border-purple-200",
}

const REASON_COLORS: Record<ReturnReason, string> = {
  Defective: "bg-rose-50 text-rose-700 border border-rose-200",
  "Wrong Item": "bg-orange-50 text-orange-700 border border-orange-200",
  "Customer Changed Mind": "bg-slate-100 text-slate-600 border border-slate-200",
  "Not As Described": "bg-amber-50 text-amber-700 border border-amber-200",
  "Duplicate Order": "bg-indigo-50 text-indigo-700 border border-indigo-200",
  "Damaged in Transit": "bg-rose-50 text-rose-700 border border-rose-200",
  "Warranty Claim": "bg-violet-50 text-violet-700 border border-violet-200",
  Other: "bg-slate-100 text-slate-500 border border-slate-200",
}

// â"€â"€â"€ New-item template â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

interface NewReturnItem {
  saleItemId?: string     // sale_items.id - for returned_qty update; undefined for manual entry (no matched sale)
  productId: string      // real product id from sale_items, used for inventory restock
  productName: string
  productType: "Mobile" | "Accessory" | "UsedPhone"
  quantity: number
  maxQty: number          // originalQty - alreadyReturned - what's actually returnable; Infinity for manual entry
  originalQty: number
  /** What the customer originally paid per unit - fixed, shown as reference
   *  only, never edited directly. */
  unitPrice: number
  /** What's actually being refunded per unit - defaults to unitPrice, but
   *  the shopkeeper can lower it (a restocking fee, condition-based
   *  deduction, partial goodwill refund, etc.) without touching the
   *  original sale record. This is what the return total is calculated
   *  from, not unitPrice. */
  refundPrice: number
  condition: ReturnItem["condition"]
  imei: string
  selected: boolean
}

const EMPTY_ITEM: NewReturnItem = {
  productId: "",
  productName: "",
  productType: "Mobile",
  quantity: 1,
  maxQty: Infinity,
  originalQty: 1,
  unitPrice: 0,
  refundPrice: 0,
  condition: "Good",
  imei: "",
  selected: true,
}

// â"€â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function ReturnsPageInner() {
  const searchParams = useSearchParams()
  const autoInvoice = searchParams.get("invoice") ?? ""
  const autoOpened = useRef(false)

  // â"€â"€ Data state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const { user } = useAuth()
  const [returnsList, setReturnsList] = useState<Return[]>([])
  const [salesList, setSalesList] = useState<Sale[]>([])
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([])
  // Maps processedBy (a profiles.id UUID) to a display name for the view
  // dialog - processedBy itself must stay a real UUID (it's a DB foreign
  // key), so the readable name is resolved separately rather than stored
  // as the field itself.
  const [staffNameById, setStaffNameById] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [data, sales, accounts, profiles] = await Promise.all([getReturns(), getSales(), getFinanceAccounts(), getProfiles()])
        setReturnsList(data)
        setSalesList(sales)
        setFinanceAccounts(accounts)
        setStaffNameById(Object.fromEntries(profiles.map(p => [p.id, p.name])))
        const def = accounts.find(a => a.isDefaultCash) ?? accounts[0]
        if (def) setNewAccountId(def.id)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch returns")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Auto-open create dialog and lookup invoice when arriving from sales list with ?invoice=
  useEffect(() => {
    if (autoInvoice && !loading && salesList.length > 0 && !autoOpened.current) {
      autoOpened.current = true
      setNewInvoice(autoInvoice)
      setShowCreate(true)
      // Auto-lookup after state settles
      setTimeout(() => {
        const match = salesList.find(s => s.invoiceNumber?.toLowerCase() === autoInvoice.toLowerCase())
        setMatchedSale(match ?? null)
        if (match) {
          setNewCustomerName(match.customerName)
          setNewCustomerPhone(match.customerPhone)
          setNewItems(buildReturnableItems(match))
        }
      }, 0)
    }
  }, [autoInvoice, loading, salesList])

  // â"€â"€ Filter state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [reasonFilter, setReasonFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // â"€â"€ Dialog state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [showCreate, setShowCreate] = useState(false)
  const [viewReturn, setViewReturn] = useState<Return | null>(null)
  const [creating, setCreating] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // â"€â"€ New return form state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [newInvoice, setNewInvoice] = useState("")
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newReason, setNewReason] = useState<ReturnReason>("Defective")
  const [newRefundType, setNewRefundType] = useState<"cash" | "store_credit">("cash")
  const [newRefundMethod, setNewRefundMethod] = useState("Cash")
  const [newAccountId, setNewAccountId] = useState("")
  const [newRestock, setNewRestock] = useState(true)
  const [newNotes, setNewNotes] = useState("")
  const [newItems, setNewItems] = useState<NewReturnItem[]>([{ ...EMPTY_ITEM }])
  // The real sale this return is against, resolved by lookupInvoice() - used
  // instead of a fabricated placeholder id, so the return is actually linked
  // to real sale/customer records (see handleCreateReturn).
  const [matchedSale, setMatchedSale] = useState<Sale | null>(null)

  // â"€â"€ Stats â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const stats = useMemo(() => {
    const total = returnsList.length
    const pending = returnsList.filter((r) => r.status === "Pending").length
    const totalRefunded = returnsList
      .filter((r) => r.status === "Completed" || r.status === "Approved")
      .reduce((acc, r) => acc + r.refundAmount, 0)
    const totalSales = salesList.length
    const returnRate = totalSales > 0 ? ((total / totalSales) * 100).toFixed(1) : "0"
    return { total, pending, totalRefunded, returnRate, totalSales }
  }, [returnsList, salesList])

  // â"€â"€ Filtered data â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

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
    setMatchedSale(null)
    setNewReason("Defective")
    setNewRefundType("cash")
    setNewRefundMethod("Cash")
    const def = financeAccounts.find(a => a.isDefaultCash) ?? financeAccounts[0]
    if (def) setNewAccountId(def.id)
    setNewRestock(true)
    setNewNotes("")
    setNewItems([{ ...EMPTY_ITEM }])
  }

  // Builds selectable, capped return lines from the matched sale's own
  // items - maxQty = quantity - returnedQty (how many of this line haven't
  // already been returned across past Sale Returns), mirroring
  // app/purchase-returns/page.tsx's buildLineItems. Fully-returned lines
  // are excluded entirely (nothing left to return).
  function buildReturnableItems(sale: Sale): NewReturnItem[] {
    return (sale.items ?? [])
      .map((si) => {
        const alreadyReturned = si.returnedQty ?? 0
        const maxQty = Math.max(0, si.quantity - alreadyReturned)
        return {
          saleItemId: si.id,
          productId: si.productId ?? "",
          productName: si.productName,
          productType: si.productType as "Mobile" | "Accessory" | "UsedPhone",
          quantity: Math.min(1, maxQty),
          maxQty,
          originalQty: si.quantity,
          unitPrice: si.unitPrice,
          refundPrice: si.unitPrice,
          condition: "Good" as ReturnItem["condition"],
          imei: si.imei ?? "",
          selected: false,
        }
      })
      .filter((it) => it.maxQty > 0)
  }

  function lookupInvoice() {
    const match = salesList.find(
      (s) => s.invoiceNumber?.toLowerCase() === newInvoice.trim().toLowerCase()
    )
    setMatchedSale(match ?? null)
    if (match) {
      setNewCustomerName(match.customerName)
      setNewCustomerPhone(match.customerPhone)
      const returnable = buildReturnableItems(match)
      if (returnable.length > 0) {
        setNewItems(returnable)
        toast.success(`Invoice found - ${returnable.length} returnable item(s) - select what's being returned`)
      } else if (match.items && match.items.length > 0) {
        setNewItems([])
        toast.warning("Invoice found - every item on this sale has already been fully returned")
      } else {
        toast.success("Invoice found - customer info populated")
      }
    } else {
      toast.error("Invoice not found - please enter customer details manually")
    }
  }

  function calcRefundTotal(): number {
    return newItems
      .filter((item) => item.selected)
      .reduce((sum, item) => sum + item.quantity * item.refundPrice, 0)
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

  // â"€â"€ Create return â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async function handleCreateReturn() {
    if (creating) return
    if (!newInvoice.trim()) {
      toast.error("Invoice number is required")
      return
    }
    if (!newCustomerName.trim()) {
      toast.error("Customer name is required")
      return
    }
    const selectedItems = newItems.filter((it) => it.selected)
    if (selectedItems.length === 0 || selectedItems.some((it) => !it.productName.trim())) {
      toast.error("Please select at least one item to return")
      return
    }
    // Blocks over-returning: can't return more than what's still returnable
    // on this line (quantity - already returned) - the same guard Purchase
    // Return has, now applied here so the same double-return/over-return gap
    // can't happen on the sales side either.
    for (const it of selectedItems) {
      if (it.quantity > it.maxQty) {
        toast.error(`${it.productName}: max returnable is ${it.maxQty} (already returned: ${it.originalQty - it.maxQty})`)
        return
      }
      if (it.quantity <= 0) {
        toast.error(`${it.productName}: return quantity must be at least 1`)
        return
      }
    }

    setCreating(true)
    try {

    const refundAmount = calcRefundTotal()

    // return_items.unit_price/line_total record the REFUND price (what was
    // actually given back), not the original sale price - that's the real
    // money that moved, and it's what refund_amount is built from. The
    // original sale price is still recoverable via saleId/the linked sale
    // whenever needed, so nothing is lost by not storing it a second time.
    const items: ReturnItem[] = selectedItems.map((it) => ({
      saleItemId: it.saleItemId,
      productId: it.productId || `ret-${Date.now()}`,
      productName: it.productName,
      // DB return_items CHECK only allows Mobile/Accessory - map UsedPhone â†' Mobile
      productType: (it.productType === "UsedPhone" ? "Mobile" : it.productType) as ReturnItem["productType"],
      quantity: it.quantity,
      unitPrice: it.refundPrice,
      lineTotal: it.quantity * it.refundPrice,
      imei: it.imei || undefined,
      condition: it.condition,
    }))

    // Atomic, row-locked reservation (supabase/fix_return_number_race.sql) -
    // replaces the old `SELECT count(*)` + compute-locally approach, which
    // could race two close-together return creations into the same number
    // (the same bug class fixed for purchases.po_number this session).
    const tenantId = await getTenantId()
    const dateTag = todayPKT().replace(/-/g, "").slice(0, 8)
    const { data: reservedReturnNumber, error: rnErr } = await supabase.rpc('reserve_return_number', { p_tenant_id: tenantId, p_date_tag: dateTag })
    if (rnErr) throw new Error(`Failed to reserve return number: ${rnErr.message}`)

    // Link to the REAL sale/customer resolved by lookupInvoice() - a
    // fabricated placeholder id here (the old `sale-lookup-...`/
    // `cust-new-...` strings) fails the DB's UUID columns outright,
    // confirmed live: every return creation was hard-failing with
    // "invalid input syntax for type uuid". If no invoice matched (manual
    // entry, e.g. a very old sale not in the loaded list), both are left
    // undefined rather than a fake value - the DB columns are nullable.
    const newReturn: Return = {
      id: `ret-${Date.now()}`,
      returnNumber: reservedReturnNumber as string,
      date: todayPKT(),
      saleId: matchedSale?.id,
      invoiceNumber: newInvoice,
      customerId: matchedSale?.customerId || undefined,
      customerName: newCustomerName,
      customerPhone: newCustomerPhone,
      items,
      reason: newReason,
      subtotal: refundAmount,
      refundAmount,
      refundMethod: newRefundMethod,
      status: "Pending",
      restockItems: newRestock,
      // The DB column is a UUID foreign key to profiles - "Current User"
      // (a display label, not an id) was failing this insert on every
      // single use, confirmed live. undefined when not logged in (should
      // not happen in practice, but the column is nullable).
      processedBy: user?.id,
      notes: newNotes || undefined,
      createdAt: new Date().toISOString(),
    }

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
          refundMethod: newRefundType === "store_credit" ? "Store Credit" : newRefundMethod,
          status: newReturn.status,
          restockItems: newReturn.restockItems,
          processedBy: newReturn.processedBy,
          notes: newReturn.notes,
          createdAt: newReturn.createdAt,
          items: [],
        },
        items,
      )

      // Reserve the returned quantity immediately (not deferred to
      // Approve/Complete) - this is the actual source of truth preventing a
      // second return from being created against the same units while this
      // one is still Pending review, mirroring Purchase Return's
      // returned_qty update (app/purchase-returns/page.tsx). Uses the
      // atomic, row-locked reserve_return_qty RPC (supabase/
      // add_return_item_tracking.sql) rather than a client read-then-write,
      // which would otherwise race against another return (or a reject)
      // touching the same sale_items row at nearly the same time. Only
      // applies to lines that came from a real matched sale - manual-entry
      // lines (no saleItemId) have nothing to reserve against.
      for (const it of selectedItems) {
        if (!it.saleItemId) continue
        await reserveReturnQty(it.saleItemId, it.quantity)
      }

      // If every item on the matched sale has now been fully returned, flip
      // it to Refunded - keeps Dashboard revenue/profit/receivable
      // calculations consistent (a fully-returned sale should no longer
      // count as real revenue), the same reasoning Purchase Return's
      // balance_due=0 -> payment_status='Paid' update follows. A genuinely
      // partial return (some items/qty still not returned) leaves the sale
      // untouched - it's still a real, active sale for the rest.
      //
      // Re-reads sale_items fresh rather than trusting `matchedSale.items`
      // (a snapshot loaded once when the dialog opened) - the reserve calls
      // just above already committed the real returned_qty values, so this
      // read reflects every return against this sale up to this exact
      // moment, not a possibly-stale one from dialog-open time.
      if (matchedSale) {
        const { data: freshSaleItems } = await supabase
          .from("sale_items")
          .select("quantity, returned_qty")
          .eq("sale_id", matchedSale.id)
          .eq("tenant_id", tenantId)
        const stillOutstanding = (freshSaleItems ?? []).some(
          (si: any) => (si.returned_qty ?? 0) < si.quantity
        )
        if (!stillOutstanding) {
          const { error: refundStatusErr } = await supabase
            .from("sales")
            .update({ status: "Refunded" })
            .eq("id", matchedSale.id)
            .eq("tenant_id", tenantId)
          if (refundStatusErr) throw new Error(`Failed to mark sale as refunded: ${refundStatusErr.message}`)
        }
      }

      // Finance: record cash refund as money OUT of the account
      if (newRefundType === "cash" && newAccountId && refundAmount > 0) {
        const { error: refundFtErr } = await supabase.from("finance_transactions").insert({
          tenant_id: tenantId,
          date: newReturn.date,
          type: "sale_refund",
          account_id: newAccountId,
          amount: refundAmount,
          reference_type: "Return",
          reference_number: newReturn.returnNumber,
          description: `Refund - ${newReturn.returnNumber} (${newReturn.invoiceNumber})`,
          notes: newReturn.notes ?? null,
        })
        if (refundFtErr) throw new Error(`Finance audit failed: ${refundFtErr.message}`)

        // Atomic, row-locked debit (supabase/fix_balance_race_condition.sql) -
        // safe against a concurrent payment against the same account racing this one.
        await adjustAccountBalance(newAccountId, -refundAmount)

        // Record this refund as a "Paid" customer payment (money we gave
        // them - same direction as "Gave Payment" in the Customer Ledger)
        // so it's actually visible in the one place the shop owner looks up
        // a customer's balance - without this, cash correctly left the
        // account but the customer's own Ledger never learned about it,
        // confirmed as a real gap in this feature (no `payments` insert
        // existed anywhere in this file before this fix). Only recorded
        // against a real customer when lookupInvoice() found one - a
        // manually-entered return with no matching sale has no customer
        // record to attribute it to.
        if (matchedSale?.customerId) {
          const { error: refundPayErr } = await supabase.from("payments").insert({
            tenant_id: tenantId,
            date: newReturn.date,
            type: "Paid",
            entity_type: "Customer",
            entity_id: matchedSale.customerId,
            entity_name: newReturn.customerName,
            reference_type: "Return",
            reference_number: newReturn.returnNumber,
            reference_id: (created as any).id,
            amount: refundAmount,
            method: newRefundMethod,
            status: "Completed",
            notes: `Refund for return ${newReturn.returnNumber} (${newReturn.invoiceNumber})`,
          })
          if (refundPayErr) throw new Error(`Failed to record refund payment: ${refundPayErr.message}`)
        }

        // tag return with account - checked, since a silent failure here
        // would leave refund_type/account_id unset, which would silently
        // break rejectReturn's reversal (its `refund_type === "cash"` check
        // would never match, leaking the cash reversal).
        const { error: tagErr } = await supabase.from("returns")
          .update({ account_id: newAccountId, refund_type: "cash" })
          .eq("id", (created as any).id)
        if (tagErr) throw new Error(`Failed to tag return with refund account: ${tagErr.message}`)
      } else if (newRefundType === "store_credit") {
        // No cash moves, but the customer's balance still changes (a
        // credit toward future purchases) - same "Paid" direction/effect as
        // a cash refund, just not through a finance account. Same
        // reasoning as the cash branch above for why this needs a
        // `payments` row to be visible in the Customer Ledger.
        if (matchedSale?.customerId) {
          const { error: creditErr } = await supabase.from("payments").insert({
            tenant_id: tenantId,
            date: newReturn.date,
            type: "Paid",
            entity_type: "Customer",
            entity_id: matchedSale.customerId,
            entity_name: newReturn.customerName,
            reference_type: "Return",
            reference_number: newReturn.returnNumber,
            reference_id: (created as any).id,
            amount: refundAmount,
            method: "Store Credit",
            status: "Completed",
            notes: `Store credit for return ${newReturn.returnNumber} (${newReturn.invoiceNumber})`,
          })
          if (creditErr) throw new Error(`Failed to record store credit: ${creditErr.message}`)
        }

        const { error: tagErr } = await supabase.from("returns")
          .update({ refund_type: "store_credit" })
          .eq("id", (created as any).id)
        if (tagErr) throw new Error(`Failed to tag return as store credit: ${tagErr.message}`)
      }

      setReturnsList((prev) => [created, ...prev])
      setShowCreate(false)
      resetForm()
      toast.success(`Return ${newReturn.returnNumber} created - ${newRefundType === "store_credit" ? "Store Credit issued" : `Rs ${refundAmount.toLocaleString()} refunded from account`}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create return")
    } finally {
      setCreating(false)
    }
  }

  // â"€â"€ Status actions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  function logReturnStatusChange(ret: Return, newStatus: ReturnStatus, action: "APPROVE" | "REJECT" | "UPDATE") {
    createAuditLog({
      timestamp: new Date().toISOString(),
      userId: user?.id ?? "system",
      userName: user?.name ?? "Unknown",
      userRole: user?.role ?? "Admin",
      action,
      module: "Returns",
      entityId: ret.id,
      entityName: ret.returnNumber,
      description: `Return ${ret.returnNumber} (invoice ${ret.invoiceNumber}) - ${ret.status} → ${newStatus}`,
      oldValue: JSON.stringify({ status: ret.status }),
      newValue: JSON.stringify({ status: newStatus }),
    }).catch(() => {})
  }

  async function approveReturn(id: string) {
    if (processingId) return
    setProcessingId(id)
    try {
      await updateReturnStatus(id, "Approved")
      const ret = returnsList.find(r => r.id === id)
      setReturnsList((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "Approved" as ReturnStatus } : r))
      )
      toast.success("Return approved")
      if (ret) logReturnStatusChange(ret, "Approved", "APPROVE")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve return")
    } finally {
      setProcessingId(null)
    }
  }

  async function rejectReturn(id: string) {
    if (processingId) return
    setProcessingId(id)
    try {
      const tenantId = await getTenantId()

      // Flip status to Rejected FIRST, guarded on still being Pending - this
      // UPDATE is atomic in Postgres, so if two staff members click Reject on
      // the same return at nearly the same time, only one of these two
      // requests can match a row (status='Pending'); the other gets 0 rows
      // back and skips the reversal below entirely, instead of both of them
      // reading "still Pending" and both crediting the account back.
      const { data: statusRows, error: statusErr } = await supabase
        .from("returns")
        .update({ status: "Rejected", resolved_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .eq("status", "Pending")
        .select("refund_type, account_id, refund_amount, sale_id, customer_id, customer_name, return_number")
      if (statusErr) throw new Error(statusErr.message)

      const retRow = statusRows?.[0]
      if (!retRow) {
        // Already resolved by someone else (or never existed) - nothing more to do.
        setProcessingId(null)
        return
      }

      // Reverse cash refund that was issued when the return was created
      if (retRow.refund_type === "cash" && retRow.account_id && retRow.refund_amount > 0) {
        const accId = retRow.account_id as string
        const amount = retRow.refund_amount as number
        // Atomic, row-locked credit (supabase/fix_balance_race_condition.sql).
        await adjustAccountBalance(accId, amount)
        // Record the reversal transaction
        await supabase.from("finance_transactions").insert({
          tenant_id: tenantId,
          date: todayPKT(),
          type: "return_reversal",
          account_id: accId,
          amount,
          reference_type: "Return",
          reference_number: id,
          description: `Return rejected - refund reversed`,
        })
      }

      // Re-read return_items fresh from the DB rather than trusting the
      // local returnsList (loaded once at page mount, never invalidated) -
      // if this return was created in a different tab/session since this
      // page loaded, the in-memory copy would be missing entirely and this
      // whole reversal would silently no-op while still reporting success.
      const { data: freshReturnItems } = await supabase
        .from("return_items")
        .select("sale_item_id, quantity")
        .eq("return_id", id)
        .eq("tenant_id", tenantId)

      for (const item of freshReturnItems ?? []) {
        if (!(item as any).sale_item_id) continue
        // Atomic, row-locked (supabase/add_return_item_tracking.sql) -
        // replaces a read-then-write that could lose an update if this
        // races another reject or a new return on the same sale_items row.
        await releaseReturnQty((item as any).sale_item_id, (item as any).quantity)
      }

      // If this return had flipped the sale to Refunded, revert it back
      // to Completed - the items are no longer considered returned.
      if (retRow.sale_id) {
        await supabase
          .from("sales")
          .update({ status: "Completed" })
          .eq("id", retRow.sale_id)
          .eq("tenant_id", tenantId)
          .eq("status", "Refunded")
      }

      // Reverse the "Paid" customer payment recorded when this return
      // was created (cash refund or store credit) via a compensating
      // "Received" entry, rather than deleting the original row - keeps
      // the Customer Ledger's full history intact and auditable.
      if (retRow.customer_id && retRow.refund_amount > 0) {
        await supabase.from("payments").insert({
          tenant_id: tenantId,
          date: todayPKT(),
          type: "Received",
          entity_type: "Customer",
          entity_id: retRow.customer_id,
          entity_name: retRow.customer_name,
          reference_type: "Return",
          reference_number: `${retRow.return_number}-REJECTED`,
          reference_id: id,
          amount: retRow.refund_amount,
          method: retRow.refund_type === "store_credit" ? "Store Credit" : "Cash",
          status: "Completed",
          notes: `Return ${retRow.return_number} rejected - reversing its refund`,
        })
      }

      const ret = returnsList.find(r => r.id === id)

      setReturnsList((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: "Rejected" as ReturnStatus, resolvedAt: new Date().toISOString() }
            : r
        )
      )
      toast.success("Return rejected - refund and reserved quantity reversed")
      if (ret) logReturnStatusChange(ret, "Rejected", "REJECT")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject return")
    } finally {
      setProcessingId(null)
    }
  }

  async function completeReturn(id: string) {
    if (processingId) return
    const ret = returnsList.find(r => r.id === id)
    if (!ret) return
    setProcessingId(id)
    try {
      const tenantId = await getTenantId()

      // â"€â"€ 1. Reverse inventory - all steps must succeed before marking Completed
      if (ret.restockItems) {
        for (const item of ret.items) {
          if (item.imei) {
            // Determine whether this is a new-phone (imei_records with product_id)
            // or a used phone (used_phones table). Phantom imei_records rows
            // created by the old bulk-add bug have product_id = NULL - treat those
            // the same as used phones.
            const { data: imeiRow, error: imeiErr } = await supabase.from("imei_records")
              .select("id, product_id, device_status")
              .eq("imei_number", item.imei).eq("tenant_id", tenantId)
              .not("product_id", "is", null)   // only real new-phone records
              .maybeSingle()

            if (imeiErr) throw new Error(`IMEI lookup failed: ${imeiErr.message}`)

            if (imeiRow) {
              // â"€â"€ Real new phone from purchases â"€â"€
              if ((imeiRow as any).device_status !== "sold") {
                throw new Error(`Phone with IMEI ${item.imei} is not marked as sold - cannot restock`)
              }
              const { error: restoreErr } = await supabase.from("imei_records")
                .update({ device_status: "in_stock", sold_date: null, customer_name: null, customer_phone: null, customer_id: null })
                .eq("id", (imeiRow as any).id)
              if (restoreErr) throw new Error(`Failed to restore IMEI record: ${restoreErr.message}`)

              const pid = (imeiRow as any).product_id
              if (pid) {
                const { data: mob } = await supabase.from("mobiles").select("stock").eq("id", pid).single()
                if (mob) {
                  const { error: stockErr } = await supabase.from("mobiles")
                    .update({ stock: (mob as any).stock + 1 }).eq("id", pid)
                  if (stockErr) throw new Error(`Failed to update mobile stock: ${stockErr.message}`)
                }
              }
            } else {
              // â"€â"€ Used phone - restore in used_phones â"€â"€
              const { data: usedRow, error: usedLookupErr } = await supabase.from("used_phones")
                .select("id, status").eq("imei_number", item.imei).eq("tenant_id", tenantId).maybeSingle()
              if (usedLookupErr) throw new Error(`Used phone lookup failed: ${usedLookupErr.message}`)
              if (!usedRow) throw new Error(`No phone found with IMEI ${item.imei} - cannot restock`)
              if ((usedRow as any).status !== "sold") {
                throw new Error(`Used phone with IMEI ${item.imei} is not marked as sold - cannot restock`)
              }
              const { error: usedErr } = await supabase.from("used_phones")
                .update({ status: "in_stock", sold_date: null, source_customer_name: null })
                .eq("id", (usedRow as any).id).eq("tenant_id", tenantId)
              if (usedErr) throw new Error(`Failed to restore used phone: ${usedErr.message}`)
              // Also restore any phantom imei_records row from old bulk-add bug
              await supabase.from("imei_records")
                .update({ device_status: "in_stock", sold_date: null, customer_name: null })
                .eq("imei_number", item.imei).eq("tenant_id", tenantId).is("product_id", null)
            }
          } else if (item.productType === "Accessory") {
            const { data: acc, error: accErr } = await supabase.from("accessories")
              .select("stock").eq("id", item.productId).eq("tenant_id", tenantId).maybeSingle()
            if (accErr) throw new Error(`Accessory lookup failed: ${accErr.message}`)
            if (!acc) throw new Error(`Accessory not found - cannot restock`)
            const { error: updErr } = await supabase.from("accessories")
              .update({ stock: (acc as any).stock + item.quantity }).eq("id", item.productId)
            if (updErr) throw new Error(`Failed to update accessory stock: ${updErr.message}`)
          }
        }
      }

      // Finance was already deducted when the return was created (Pending state).
      // No second deduction here - just mark as Completed.

      await updateReturnStatus(id, "Completed")
      setReturnsList(prev => prev.map(r =>
        r.id === id ? { ...r, status: "Completed" as ReturnStatus, resolvedAt: new Date().toISOString() } : r
      ))
      toast.success("Return completed - inventory restocked & refund recorded")
      logReturnStatusChange(ret, "Completed", "UPDATE")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete return")
    } finally {
      setProcessingId(null)
    }
  }

  // â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Returns & Refunds"
        description="Manage product returns, exchanges, and refund processing"
        icon={<RotateCcw />}
        iconBg="bg-amber-600"
        action={
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-8 text-xs px-3"
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
        <StatCard
          title="Total Returns"
          value={String(stats.total)}
          icon={RotateCcw}
          iconBg="bg-indigo-100"
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
          iconBg="bg-rose-100"
          subtext={`${stats.total} of ${stats.totalSales} sales`}
        />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-end gap-2">
          {/* Search */}
          <div className="col-span-2 sm:flex-1 sm:min-w-[180px] sm:max-w-[240px]">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Return # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-full sm:w-[130px] text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {RETURN_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Reason</label>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="h-8 w-full sm:w-[150px] text-xs">
                <SelectValue placeholder="All Reasons" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="col-span-2 sm:col-auto">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Date Range</label>
            <div className="flex items-center gap-1">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 flex-1 sm:w-[115px] text-xs" />
              <span className="text-slate-300 text-xs shrink-0">—</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 flex-1 sm:w-[115px] text-xs" />
            </div>
          </div>

          {/* Reset */}
          <Button variant="outline" size="sm" onClick={resetFilters} className="col-span-2 sm:col-auto h-8 gap-1 text-xs text-slate-600 hover:text-rose-600 hover:border-rose-300 sm:self-end">
            <RotateCcw className="w-3 h-3" />
            Reset
          </Button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 ? (
          <Card className="border border-slate-100 shadow-sm py-10 text-center text-slate-400 text-xs">
            <RotateCcw className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
            No returns found
          </Card>
        ) : (
          filtered.map((ret) => (
            <Card key={ret.id} className="border border-slate-100 shadow-sm p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-indigo-600">{ret.returnNumber}</span>
                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[ret.status]}`}>
                  {ret.status}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-800">{ret.customerName}</p>
                <p className="text-[10px] text-slate-400">{ret.customerPhone} · Invoice {ret.invoiceNumber} · {formatDate(ret.date)}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-1.5 py-0 h-4">
                  {ret.items.length}{ret.items.length === 1 ? " item" : " items"}
                </Badge>
                <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${REASON_COLORS[ret.reason]}`}>
                  {ret.reason}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-800">{formatCurrency(ret.refundAmount)}</span>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setViewReturn(ret)} title="View">
                    <Eye className="w-4 h-4" />
                  </Button>
                  {ret.status === "Pending" && (
                    <>
                      <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => approveReturn(ret.id)} disabled={processingId === ret.id} title="Approve">
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => rejectReturn(ret.id)} disabled={processingId === ret.id} title="Reject">
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  {ret.status === "Approved" && (
                    <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => completeReturn(ret.id)} disabled={processingId === ret.id} title="Complete">
                      <Package className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Table - desktop */}
      <Card className="hidden md:block border border-slate-100 shadow-sm overflow-hidden">
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
                    <TableCell className="px-3 py-2 text-xs font-semibold text-indigo-600 whitespace-nowrap">{ret.returnNumber}</TableCell>
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
                        <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => setViewReturn(ret)} title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {ret.status === "Pending" && (
                          <>
                            <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => approveReturn(ret.id)} disabled={processingId === ret.id} title="Approve">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50" onClick={() => rejectReturn(ret.id)} disabled={processingId === ret.id} title="Reject">
                              <XCircle className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        {ret.status === "Approved" && (
                          <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => completeReturn(ret.id)} disabled={processingId === ret.id} title="Complete">
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

      {/* â"€â"€â"€ Process Return Dialog â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl">
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
                  onChange={(e) => { setNewInvoice(e.target.value); setMatchedSale(null) }}
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
                {!matchedSale && (
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Item
                  </Button>
                )}
              </div>
              {matchedSale && newItems.length === 0 && (
                <p className="text-xs text-slate-400 px-1">Every item on this sale has already been fully returned.</p>
              )}
              {matchedSale && newItems.length > 0 && (
                <p className="text-xs text-slate-400 px-1">Select which items are being returned - quantity is capped at what hasn't already been returned.</p>
              )}

              {newItems.map((item, idx) => (
                <Card key={idx} className={cn("border", item.selected ? "border-indigo-300 bg-indigo-50/30" : "border-slate-200")}>
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {matchedSale && (
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(checked) => updateItem(idx, { selected: checked === true })}
                          />
                        )}
                        <span className="text-xs font-semibold text-slate-500 truncate">
                          {matchedSale ? item.productName : `Item ${idx + 1}`}
                        </span>
                        {matchedSale && (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] shrink-0">
                            {item.originalQty - item.maxQty}/{item.originalQty} already returned
                          </Badge>
                        )}
                      </div>
                      {!matchedSale && newItems.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-rose-500 shrink-0"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {!matchedSale && (
                        <>
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
                        </>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Quantity {matchedSale && `(max ${item.maxQty})`}</Label>
                        <Input
                          type="number" onWheel={e => e.currentTarget.blur()}
                          min={1}
                          max={matchedSale ? item.maxQty : undefined}
                          disabled={matchedSale ? !item.selected : false}
                          value={item.quantity}
                          onChange={(e) => {
                            const v = Math.max(1, Number(e.target.value))
                            updateItem(idx, { quantity: matchedSale ? Math.min(v, item.maxQty) : v })
                          }}
                          className="h-9"
                        />
                      </div>
                      {matchedSale ? (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Original Sale Price</Label>
                            <p className="h-9 px-3 flex items-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500">
                              {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Refund Amount {item.refundPrice !== item.unitPrice && "(adjusted)"}</Label>
                            <MoneyInput
                              min={0}
                              max={item.unitPrice}
                              disabled={!item.selected}
                              value={item.refundPrice}
                              onChange={(v) => updateItem(idx, { refundPrice: Math.min(item.unitPrice, Math.max(0, Number(v))) })}
                              className="h-9"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-xs">Unit Price</Label>
                          <MoneyInput
                            min={0}
                            value={item.unitPrice}
                            onChange={(v) => updateItem(idx, { unitPrice: Math.max(0, Number(v)), refundPrice: Math.max(0, Number(v)) })}
                            className="h-9"
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Condition</Label>
                        <Select
                          value={item.condition}
                          onValueChange={(v) => updateItem(idx, { condition: v as ReturnItem["condition"] })}
                        >
                          <SelectTrigger className="h-9" disabled={matchedSale ? !item.selected : false}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ITEM_CONDITIONS.map((c) => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {!matchedSale && (
                        <div className="space-y-1">
                          <Label className="text-xs">IMEI (optional)</Label>
                          <Input
                            value={item.imei}
                            onChange={(e) => updateItem(idx, { imei: e.target.value })}
                            placeholder="15-digit IMEI"
                            className="h-9"
                          />
                        </div>
                      )}
                      {matchedSale && item.imei && (
                        <div className="space-y-1">
                          <Label className="text-xs">IMEI</Label>
                          <p className="h-9 flex items-center text-xs text-slate-500 font-mono">{item.imei}</p>
                        </div>
                      )}
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
                <Label>Refund Type</Label>
                <Select value={newRefundType} onValueChange={v => setNewRefundType(v as "cash" | "store_credit")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash Refund (money out)</SelectItem>
                    <SelectItem value="store_credit">Store Credit (no money out)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newRefundType === "cash" && (
              <div className="space-y-2">
                <Label>Pay Refund From Account</Label>
                <Select value={newAccountId} onValueChange={setNewAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                  <SelectContent>
                    {financeAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} - Rs {a.currentBalance.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">This amount will be deducted from the selected account</p>
              </div>
            )}
            {newRefundType === "store_credit" && (
              <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2.5 text-xs text-indigo-700">
                Store Credit issued - no money leaves any account. Customer can use this credit on next purchase.
              </div>
            )}

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
            <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleCreateReturn} disabled={creating}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {creating ? "Submitting..." : "Submit Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â"€â"€â"€ View Details Dialog â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <Dialog open={!!viewReturn} onOpenChange={(open) => !open && setViewReturn(null)}>
        <DialogContent className="sm:max-w-2xl">
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
                    <p className="text-slate-800">{(viewReturn.processedBy && staffNameById[viewReturn.processedBy]) || "—"}</p>
                  </div>
                </div>

                {/* Notes */}
                {viewReturn.notes && (
                  <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                    {viewReturn.notes}
                  </div>
                )}

                {/* Items list */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Returned Items</p>

                  {/* Mobile cards */}
                  <div className="sm:hidden space-y-2">
                    {viewReturn.items.map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-slate-200 p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-slate-800 text-sm truncate">{item.productName}</p>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs shrink-0">
                            {item.productType}
                          </Badge>
                        </div>
                        {item.imei && <p className="text-xs text-slate-400">IMEI: {item.imei}</p>}
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Qty {item.quantity} × {formatCurrency(item.unitPrice)}</span>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                              item.condition === "Good"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : item.condition === "Damaged"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {item.condition}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                          <span className="text-xs text-slate-400">Total</span>
                          <span className="font-semibold text-sm text-slate-900">{formatCurrency(item.lineTotal)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block rounded-lg border border-slate-200 overflow-hidden">
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
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
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
                      <div className="mt-0.5 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <Plus className="w-3 h-3 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">Return Created</p>
                        <p className="text-xs text-slate-400">{formatDate(viewReturn.createdAt)}</p>
                      </div>
                    </div>

                    {/* Status-specific steps */}
                    {(viewReturn.status === "Approved" || viewReturn.status === "Completed") && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">Approved</p>
                          <p className="text-xs text-slate-400">Return approved for processing</p>
                        </div>
                      </div>
                    )}

                    {viewReturn.status === "Rejected" && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                          <XCircle className="w-3 h-3 text-rose-600" />
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
                      className="border-rose-200 text-rose-600 hover:bg-rose-50"
                      onClick={() => {
                        rejectReturn(viewReturn.id)
                        setViewReturn(null)
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
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

export default function ReturnsPage() {
  return (
    <PermissionGate permission="returns.view">
      <ReturnsPageInner />
    </PermissionGate>
  )
}

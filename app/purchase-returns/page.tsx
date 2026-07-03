﻿"use client"

import React, { useState, useMemo, useEffect } from "react"
import {
  RotateCcw, Search, Plus, CheckCircle2, XCircle, Clock,
  Package, Truck, Minus, Banknote, Landmark, Wallet,
  AlertCircle, ArrowDownCircle, RefreshCw, FileText, BookOpen,
} from "lucide-react"
import { toast } from "sonner"

import { useSearchParams } from "next/navigation"
import { getPurchases } from "@/lib/api/purchases"
import { getSuppliers } from "@/lib/api/suppliers"
import { getFinanceAccounts } from "@/lib/api/finance"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import type { Purchase, Supplier } from "@/data/types"
import type { FinanceAccount } from "@/lib/api/types"
import { formatCurrency, formatDatePKT, todayPKT, cn } from "@/lib/utils"
import { PageWrapper } from "@/components/layout/page-wrapper"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"

// â"€â"€â"€ Types â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

type Resolution = "Refund" | "Replacement" | "Credit Note" | "Ledger Credit"
type PRStatus   = "Pending" | "Approved" | "Completed" | "Rejected"

interface ReturnLineItem {
  purchaseItemId: string   // purchase_items.id - for returned_qty update (Fix 6)
  productId: string        // catalog id - for precise stock deduction (Fix 8)
  productName: string
  productType: string
  returnQty: number
  maxQty: number           // quantity - returnedQty - what is actually returnable (Fix 2&3)
  originalQty: number      // total purchased
  alreadyReturned: number  // how many returned in past returns
  unitCost: number
  reason: string
  imeis: string[]          // all IMEIs from original purchase for this line
  selected: boolean
}

interface PurchaseReturn {
  id: string
  returnNumber: string
  date: string
  purchaseId: string
  poNumber: string
  supplierId: string
  supplierName: string
  items: ReturnLineItem[]
  totalAmount: number
  resolution: Resolution
  refundMethod: string
  accountId: string
  status: PRStatus
  notes: string
  createdAt: string
}

// â"€â"€â"€ Constants â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const REASONS = [
  "Defective", "Wrong Item", "Not As Described",
  "Damaged in Transit", "Excess / Overstock", "Quality Issue", "Other",
]

const STATUS_COLORS: Record<PRStatus, string> = {
  Pending:   "bg-amber-50 text-amber-700 border border-amber-200",
  Approved:  "bg-blue-50 text-blue-700 border border-blue-200",
  Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Rejected:  "bg-red-50 text-red-700 border border-red-200",
}

const RESOLUTION_COLORS: Record<Resolution, string> = {
  "Refund":        "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Replacement":   "bg-blue-50 text-blue-700 border border-blue-200",
  "Credit Note":   "bg-violet-50 text-violet-700 border border-violet-200",
  "Ledger Credit": "bg-amber-50 text-amber-700 border border-amber-200",
}

const RESOLUTION_CONFIG: Record<Resolution, {
  icon: React.ReactNode; label: string; description: string
  selectedColor: string; hoverColor: string
}> = {
  "Refund": {
    icon: <ArrowDownCircle className="w-4 h-4" />,
    label: "Refund",
    description: "Supplier pays you back now - cash/bank/wallet",
    selectedColor: "border-emerald-500 bg-emerald-50 text-emerald-700",
    hoverColor: "border-slate-200 text-slate-600 hover:bg-slate-50",
  },
  "Replacement": {
    icon: <RefreshCw className="w-4 h-4" />,
    label: "Replacement",
    description: "Supplier sends new units - no money moves",
    selectedColor: "border-blue-500 bg-blue-50 text-blue-700",
    hoverColor: "border-slate-200 text-slate-600 hover:bg-slate-50",
  },
  "Credit Note": {
    icon: <FileText className="w-4 h-4" />,
    label: "Credit Note",
    description: "Deducted from what you owe the supplier",
    selectedColor: "border-violet-500 bg-violet-50 text-violet-700",
    hoverColor: "border-slate-200 text-slate-600 hover:bg-slate-50",
  },
  "Ledger Credit": {
    icon: <BookOpen className="w-4 h-4" />,
    label: "Ledger Credit",
    description: "Supplier owes you - settle on next purchase",
    selectedColor: "border-amber-500 bg-amber-50 text-amber-700",
    hoverColor: "border-slate-200 text-slate-600 hover:bg-slate-50",
  },
}

// â"€â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

function generateReturnNumber(existing: PurchaseReturn[]): string {
  const max = existing.reduce((m, r) => {
    const n = parseInt(r.returnNumber.replace(/\D/g, "")) || 0
    return n > m ? n : m
  }, 0)
  return `PR-${String(max + 1).padStart(4, "0")}`
}

function AccountIcon({ type }: { type: string }) {
  if (type === "bank")         return <Landmark className="w-4 h-4" />
  if (type === "mobile_wallet") return <Wallet className="w-4 h-4" />
  return <Banknote className="w-4 h-4" />
}

function accountRingColor(type: string, selected: boolean) {
  if (!selected) return "border-slate-200 bg-white"
  if (type === "bank")         return "border-blue-400 bg-blue-50"
  if (type === "mobile_wallet") return "border-violet-400 bg-violet-50"
  return "border-emerald-400 bg-emerald-50"
}

function accountIconBg(type: string, selected: boolean) {
  if (!selected) return "bg-slate-100 text-slate-500"
  if (type === "bank")         return "bg-blue-200 text-blue-700"
  if (type === "mobile_wallet") return "bg-violet-200 text-violet-700"
  return "bg-emerald-200 text-emerald-700"
}

function refundMethodFromType(type: string): string {
  if (type === "bank")         return "Bank Transfer"
  if (type === "mobile_wallet") return "Wallet"
  return "Cash"
}

// â"€â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function PurchaseReturnsPage() {
  const searchParams = useSearchParams()

  const [returnsList,     setReturnsList]     = useState<PurchaseReturn[]>([])
  const [purchases,       setPurchases]       = useState<Purchase[]>([])
  const [suppliers,       setSuppliers]       = useState<Supplier[]>([])
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>([])
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const tenantId = await getTenantId()
        const [purchasesData, suppliersData, accountsData] = await Promise.all([
          getPurchases(),
          getSuppliers(),
          getFinanceAccounts(),
        ])
        setPurchases(purchasesData)
        setSuppliers(suppliersData)
        setFinanceAccounts(accountsData)

        const defaultAcc = accountsData.find(a => a.isDefaultCash) ?? accountsData[0]
        if (defaultAcc) setNewAccountId(defaultAcc.id)

        const { data: prData, error: prErr } = await supabase
          .from("purchase_returns")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })

        if (!prErr && prData) setReturnsList(prData.map(dbToReturn))

        const fromId = searchParams.get("from")
        if (fromId) {
          const match = purchasesData.find(p => p.id === fromId)
          if (match) {
            setPurchaseSearchQuery(`${match.poNumber} - ${match.supplierName}`)
            setSelectedPurchaseId(match.id)
            setNewSupplierId(match.supplierId)
            setNewSupplierName(match.supplierName)
            setLineItems(buildLineItems(match))
            setShowCreate(true)
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // FIX 2 & 3: Build line items using returnedQty so maxQty = what's actually returnable
  function buildLineItems(purchase: Purchase): ReturnLineItem[] {
    return purchase.items
      .map(item => {
        const alreadyReturned = item.returnedQty ?? 0
        const maxQty = item.quantity - alreadyReturned
        return {
          purchaseItemId: item.id ?? "",
          productId:      item.productId,
          productName:    item.productName,
          productType:    item.productType,
          returnQty:      Math.min(1, maxQty),
          maxQty,
          originalQty:    item.quantity,
          alreadyReturned,
          unitCost:       item.unitCost,
          reason:         "Defective",
          imeis:          item.imeis ?? [],
          selected:       false,
        }
      })
      .filter(item => item.maxQty > 0) // FIX 3: hide fully-returned items
  }

  function dbToReturn(row: Record<string, unknown>): PurchaseReturn {
    return {
      id:           row.id as string,
      returnNumber: row.return_number as string,
      date:         row.date as string,
      purchaseId:   row.purchase_id as string,
      poNumber:     row.po_number as string,
      supplierId:   row.supplier_id as string,
      supplierName: row.supplier_name as string,
      items:        (row.items as ReturnLineItem[]) ?? [],
      totalAmount:  row.total_amount as number,
      resolution:   row.resolution as Resolution,
      refundMethod: (row.refund_method as string) ?? "",
      accountId:    (row.account_id as string) ?? "",
      status:       row.status as PRStatus,
      notes:        (row.notes as string) ?? "",
      createdAt:    row.created_at as string,
    }
  }

  // â"€â"€ Filter state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [search,           setSearch]           = useState("")
  const [statusFilter,     setStatusFilter]     = useState("all")
  const [resolutionFilter, setResolutionFilter] = useState("all")

  // â"€â"€ Dialog state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [showCreate, setShowCreate] = useState(false)
  const [viewReturn, setViewReturn] = useState<PurchaseReturn | null>(null)

  // â"€â"€ Form state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [selectedPurchaseId,   setSelectedPurchaseId]   = useState("")
  const [newSupplierId,        setNewSupplierId]        = useState("")
  const [newSupplierName,      setNewSupplierName]      = useState("")
  const [newResolution,        setNewResolution]        = useState<Resolution>("Refund")
  const [newAccountId,         setNewAccountId]         = useState("")
  const [newNotes,             setNewNotes]             = useState("")
  const [lineItems,            setLineItems]            = useState<ReturnLineItem[]>([])
  const [purchaseSearchQuery,  setPurchaseSearchQuery]  = useState("")
  const [showPurchaseDropdown, setShowPurchaseDropdown] = useState(false)
  const [saving,               setSaving]               = useState(false)

  const selectedPurchase = useMemo(
    () => purchases.find(p => p.id === selectedPurchaseId) ?? null,
    [purchases, selectedPurchaseId]
  )

  const filteredPurchaseOptions = useMemo(() => {
    const q = purchaseSearchQuery.toLowerCase()
    return purchases.filter(p =>
      p.poNumber.toLowerCase().includes(q) ||
      p.supplierName.toLowerCase().includes(q)
    ).slice(0, 10)
  }, [purchases, purchaseSearchQuery])

  function selectPurchase(purchase: Purchase) {
    setSelectedPurchaseId(purchase.id)
    setPurchaseSearchQuery(`${purchase.poNumber} - ${purchase.supplierName}`)
    setShowPurchaseDropdown(false)
    setNewSupplierId(purchase.supplierId)
    setNewSupplierName(purchase.supplierName)
    setLineItems(buildLineItems(purchase))
  }

  function updateLine(idx: number, field: keyof ReturnLineItem, value: unknown) {
    setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l))
  }

  const selectedLines = lineItems.filter(l => l.selected)
  const newTotal      = selectedLines.reduce((s, l) => s + l.unitCost * l.returnQty, 0)

  const selectedAccount = useMemo(
    () => financeAccounts.find(a => a.id === newAccountId) ?? null,
    [financeAccounts, newAccountId]
  )

  function resetForm() {
    setSelectedPurchaseId("")
    setPurchaseSearchQuery("")
    setShowPurchaseDropdown(false)
    setNewSupplierId("")
    setNewSupplierName("")
    setNewResolution("Refund")
    const def = financeAccounts.find(a => a.isDefaultCash) ?? financeAccounts[0]
    if (def) setNewAccountId(def.id)
    setNewNotes("")
    setLineItems([])
  }

  // â"€â"€ Save - all 8 fixes applied â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  async function handleSave() {
    if (!selectedPurchase) { toast.error("Select a purchase first"); return }
    if (selectedLines.length === 0) { toast.error("Select at least one item to return"); return }
    if (newResolution === "Refund" && !newAccountId) {
      toast.error("Select which account receives the refund money"); return
    }

    // FIX 2 & 3: Final validation - qty cannot exceed what is returnable
    for (const line of selectedLines) {
      if (line.returnQty > line.maxQty) {
        toast.error(`${line.productName}: max returnable is ${line.maxQty} (${line.alreadyReturned} already returned)`)
        return
      }
      if (line.returnQty <= 0) {
        toast.error(`${line.productName}: return quantity must be at least 1`); return
      }
    }

    if (saving) return
    setSaving(true)

    // FIX 7: Track rollback state so we can undo on any failure
    const rollback: (() => Promise<void>)[] = []

    try {
      const tenantId    = await getTenantId()
      const returnNumber = generateReturnNumber(returnsList)
      const today       = todayPKT()
      const method      = refundMethodFromType(selectedAccount?.type ?? "cash")

      // â"€â"€ Step 1: Insert purchase_return record â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
      const { data: pr, error: prErr } = await supabase
        .from("purchase_returns")
        .insert({
          tenant_id:     tenantId,
          return_number: returnNumber,
          date:          today,
          purchase_id:   selectedPurchase.id,
          po_number:     selectedPurchase.poNumber,
          supplier_id:   newSupplierId,
          supplier_name: newSupplierName,
          items:         selectedLines,
          total_amount:  newTotal,
          resolution:    newResolution,
          refund_method: newResolution === "Refund" ? method : null,
          account_id:    newResolution === "Refund" ? newAccountId : null,
          status:        "Completed",
          notes:         newNotes || null,
        })
        .select()
        .single()

      if (prErr) throw new Error(`Failed to create return record: ${prErr.message}`)

      rollback.push(async () => {
        await supabase.from("purchase_returns").delete().eq("id", (pr as any).id)
      })

      // â"€â"€ Step 2: Update returned_qty on each purchase_item (FIX 6) â"€â"€â"€â"€â"€
      // This prevents double-returning in future - the source of truth
      for (const line of selectedLines) {
        if (!line.purchaseItemId) continue
        const { error } = await supabase
          .from("purchase_items")
          .update({ returned_qty: line.alreadyReturned + line.returnQty })
          .eq("id", line.purchaseItemId)
          .eq("tenant_id", tenantId)
        if (error) throw new Error(`Failed to update returned qty for ${line.productName}: ${error.message}`)
      }

      rollback.push(async () => {
        for (const line of selectedLines) {
          if (!line.purchaseItemId) continue
          await supabase
            .from("purchase_items")
            .update({ returned_qty: line.alreadyReturned })
            .eq("id", line.purchaseItemId)
            .eq("tenant_id", tenantId)
        }
      })

      // â"€â"€ Step 3: Stock deduction + IMEI handling â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
      for (const line of selectedLines) {
        const qty = line.returnQty

        if (line.productType === "Mobile") {
          // FIX 8: Use product_id directly - no fuzzy name matching
          if (line.productId) {
            const { data: mob } = await supabase
              .from("mobiles")
              .select("id, stock")
              .eq("id", line.productId)
              .eq("tenant_id", tenantId)
              .single()
            if (mob) {
              const newStock = Math.max(0, (mob as any).stock - qty)
              await supabase.from("mobiles").update({ stock: newStock }).eq("id", line.productId)
              rollback.push(async () => {
                await supabase.from("mobiles").update({ stock: (mob as any).stock }).eq("id", line.productId)
              })
            }
          }

          // FIX 5 & 6: Only mark IMEIs returned if they are currently in_stock
          // Skip any IMEI that is already sold or returned
          if (line.imeis && line.imeis.length > 0) {
            const imeisToCheck = line.imeis.slice(0, qty)
            const { data: imeiRows } = await supabase
              .from("imei_records")
              .select("imei_number, device_status")
              .eq("tenant_id", tenantId)
              .in("imei_number", imeisToCheck)

            const returnable = (imeiRows ?? [])
              .filter((r: any) => r.device_status === "in_stock")
              .map((r: any) => r.imei_number as string)

            const alreadySold     = (imeiRows ?? []).filter((r: any) => r.device_status === "sold").map((r: any) => r.imei_number)
            const alreadyReturned = (imeiRows ?? []).filter((r: any) => r.device_status === "returned").map((r: any) => r.imei_number)

            if (alreadySold.length > 0) {
              toast.warning(`${alreadySold.length} IMEI(s) already sold - skipped from return. Sold devices cannot be returned to supplier.`)
            }
            if (alreadyReturned.length > 0) {
              toast.warning(`${alreadyReturned.length} IMEI(s) were already returned previously - skipped.`)
            }

            if (returnable.length > 0) {
              await supabase
                .from("imei_records")
                .update({ device_status: "returned" })
                .eq("tenant_id", tenantId)
                .in("imei_number", returnable)

              rollback.push(async () => {
                await supabase
                  .from("imei_records")
                  .update({ device_status: "in_stock" })
                  .eq("tenant_id", tenantId)
                  .in("imei_number", returnable)
              })
            }
          }
        }

        if (line.productType === "Accessory") {
          // FIX 8: Use product_id directly for accessories too
          if (line.productId) {
            const { data: acc } = await supabase
              .from("accessories")
              .select("id, stock")
              .eq("id", line.productId)
              .eq("tenant_id", tenantId)
              .single()
            if (acc) {
              const newStock = Math.max(0, (acc as any).stock - qty)
              await supabase.from("accessories").update({ stock: newStock }).eq("id", line.productId)
              rollback.push(async () => {
                await supabase.from("accessories").update({ stock: (acc as any).stock }).eq("id", line.productId)
              })
            }
          }
        }
      }

      // â"€â"€ Step 4: Financial effects by resolution â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

      if (newResolution === "Refund") {
        // FIX 1: Supplier pays YOU â†' account balance INCREASES
        const { data: accRow } = await supabase
          .from("finance_accounts")
          .select("current_balance")
          .eq("id", newAccountId)
          .single()

        if (accRow) {
          const oldBal = (accRow as any).current_balance as number
          const newBal = oldBal + newTotal
          await supabase.from("finance_accounts").update({ current_balance: newBal }).eq("id", newAccountId)
          rollback.push(async () => {
            await supabase.from("finance_accounts").update({ current_balance: oldBal }).eq("id", newAccountId)
          })
        }

        await supabase.from("finance_transactions").insert({
          tenant_id:   tenantId,
          date:        today,
          type:        "purchase_return_refund",
          category:    "Purchase Return",
          description: `Refund received - ${returnNumber} from ${newSupplierName}`,
          amount:      newTotal,
          account_id:  newAccountId,
          reference:   returnNumber,
        })

        await supabase.from("payments").insert({
          tenant_id:        tenantId,
          date:             today,
          type:             "Received",
          entity_type:      "Supplier",
          entity_id:        newSupplierId,
          entity_name:      newSupplierName,
          reference_type:   "Purchase Return",
          reference_number: returnNumber,
          amount:           newTotal,
          method:           method,
          status:           "Completed",
          notes:            `Refund received for ${returnNumber}`,
        })

        // Reduce supplier outstanding balance if they owed us money
        const { data: supRow } = await supabase
          .from("suppliers").select("outstanding_balance").eq("id", newSupplierId).single()
        if (supRow && (supRow as any).outstanding_balance > 0) {
          await supabase
            .from("suppliers")
            .update({ outstanding_balance: Math.max(0, (supRow as any).outstanding_balance - newTotal) })
            .eq("id", newSupplierId)
        }
      }

      if (newResolution === "Credit Note") {
        // No cash - credit reduces what we owe; can go negative (they owe us)
        const { data: supRow } = await supabase
          .from("suppliers").select("outstanding_balance").eq("id", newSupplierId).single()
        if (supRow) {
          await supabase
            .from("suppliers")
            .update({ outstanding_balance: (supRow as any).outstanding_balance - newTotal })
            .eq("id", newSupplierId)
        }

        await supabase.from("payments").insert({
          tenant_id: tenantId, date: today, type: "Credit Note",
          entity_type: "Supplier", entity_id: newSupplierId, entity_name: newSupplierName,
          reference_type: "Purchase Return", reference_number: returnNumber,
          amount: newTotal, method: "Credit Note", status: "Completed",
          notes: `Credit note applied - ${returnNumber}`,
        })
      }

      if (newResolution === "Ledger Credit") {
        // No cash - recorded in ledger for future settlement
        const { data: supRow } = await supabase
          .from("suppliers").select("outstanding_balance").eq("id", newSupplierId).single()
        if (supRow) {
          await supabase
            .from("suppliers")
            .update({ outstanding_balance: (supRow as any).outstanding_balance - newTotal })
            .eq("id", newSupplierId)
        }

        await supabase.from("payments").insert({
          tenant_id: tenantId, date: today, type: "Ledger Credit",
          entity_type: "Supplier", entity_id: newSupplierId, entity_name: newSupplierName,
          reference_type: "Purchase Return", reference_number: returnNumber,
          amount: newTotal, method: "Ledger", status: "Pending",
          notes: `Ledger credit pending settlement - ${returnNumber}`,
        })
      }

      // Replacement: no financial movement - stock deducted above, record exists for tracking

      // â"€â"€ Refresh purchases so returned_qty reflects immediately in UI â"€â"€â"€
      const refreshed = await getPurchases()
      setPurchases(refreshed)

      const newReturn = dbToReturn(pr as Record<string, unknown>)
      setReturnsList(prev => [newReturn, ...prev])
      toast.success(`${returnNumber} recorded`, {
        description: `${newResolution} - ${formatCurrency(newTotal)} - ${newSupplierName}`,
        duration: 5000,
      })
      setShowCreate(false)
      resetForm()

    } catch (err) {
      // FIX 7: Rollback everything that succeeded before the failure
      toast.error("Saving failed - rolling back changes...")
      for (const undo of rollback.reverse()) {
        try { await undo() } catch { /* best effort */ }
      }
      toast.error(err instanceof Error ? err.message : "Failed to save return")
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateStatus(id: string, status: PRStatus) {
    try {
      const { error } = await supabase.from("purchase_returns").update({ status }).eq("id", id)
      if (error) throw new Error(error.message)
      setReturnsList(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      if (viewReturn?.id === id) setViewReturn(prev => prev ? { ...prev, status } : prev)
      toast.success(`Status updated to ${status}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status")
    }
  }

  // â"€â"€ Stats â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const stats = useMemo(() => ({
    total:      returnsList.length,
    pending:    returnsList.filter(r => r.status === "Pending").length,
    completed:  returnsList.filter(r => r.status === "Completed").length,
    totalValue: returnsList
      .filter(r => r.resolution === "Refund" && r.status === "Completed")
      .reduce((s, r) => s + r.totalAmount, 0),
  }), [returnsList])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return returnsList.filter(r => {
      if (q && !r.returnNumber.toLowerCase().includes(q) && !r.supplierName.toLowerCase().includes(q) && !r.poNumber.toLowerCase().includes(q)) return false
      if (statusFilter     !== "all" && r.status     !== statusFilter)     return false
      if (resolutionFilter !== "all" && r.resolution !== resolutionFilter) return false
      return true
    })
  }, [returnsList, search, statusFilter, resolutionFilter])

  // â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  return (
    <PageWrapper>
      <PageHeader
        title="Purchase Returns"
        description="Return items to suppliers - refunds, replacements, credit notes & ledger credits"
        icon={<RotateCcw />}
        iconBg="bg-rose-600"
        action={
          <Button className="bg-rose-600 hover:bg-rose-700 text-white gap-2 shadow-sm h-9"
            onClick={() => { resetForm(); setShowCreate(true) }}>
            <Plus className="w-4 h-4" /> New Return
          </Button>
        }
      />

      {/* â"€â"€ Stats â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        <StatCard title="Total Returns"  value={String(stats.total)}              subtext="All time"        icon={RotateCcw}    iconBg="bg-rose-100"    />
        <StatCard title="Pending"        value={String(stats.pending)}            subtext="Awaiting action" icon={Clock}        iconBg="bg-amber-100"   />
        <StatCard title="Completed"      value={String(stats.completed)}          subtext="Resolved"        icon={CheckCircle2} iconBg="bg-emerald-100" />
        <StatCard title="Cash Recovered" value={formatCurrency(stats.totalValue)} subtext="Via refunds"     icon={Package}      iconBg="bg-blue-100"    />
      </div>

      {/* â"€â"€ Filters â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px] max-w-xs">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input placeholder="Return # or supplier..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Resolution</label>
            <Select value={resolutionFilter} onValueChange={setResolutionFilter}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="All Resolutions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resolutions</SelectItem>
                <SelectItem value="Refund">Refund</SelectItem>
                <SelectItem value="Replacement">Replacement</SelectItem>
                <SelectItem value="Credit Note">Credit Note</SelectItem>
                <SelectItem value="Ledger Credit">Ledger Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(search || statusFilter !== "all" || resolutionFilter !== "all") && (
            <Button variant="outline" size="sm" className="h-8 text-xs text-slate-600 hover:text-red-600 hover:border-red-300 self-end"
              onClick={() => { setSearch(""); setStatusFilter("all"); setResolutionFilter("all") }}>
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* â"€â"€ List â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <RotateCcw className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No purchase returns found</p>
          <p className="text-slate-300 text-xs mt-1">Click "New Return" to record your first supplier return</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ret => (
            <div key={ret.id}
              className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:border-rose-200 transition-colors cursor-pointer"
              onClick={() => setViewReturn(ret)}>
              <div className={cn("w-1 shrink-0",
                ret.status === "Completed" ? "bg-emerald-500"
                : ret.status === "Rejected" ? "bg-red-400"
                : ret.status === "Approved" ? "bg-blue-500"
                : "bg-amber-400"
              )} />
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-rose-600 text-sm font-bold">{ret.returnNumber}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", RESOLUTION_COLORS[ret.resolution])}>{ret.resolution}</span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[ret.status])}>{ret.status}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-800 truncate">{ret.supplierName}</span>
                    <span className="text-xs text-slate-400 font-mono shrink-0">- {ret.poNumber}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 shrink-0">{formatCurrency(ret.totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-400">{formatDatePKT(ret.date)} - {ret.items.length} line{ret.items.length !== 1 ? "s" : ""}</span>
                  {ret.resolution === "Refund" && ret.refundMethod && (
                    <span className="text-xs text-slate-500">via {ret.refundMethod}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          CREATE DIALOG
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog open={showCreate} onOpenChange={v => { if (!v) { setShowCreate(false); resetForm() } }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto w-[96vw] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">New Purchase Return</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Select a purchase, choose items to return, then pick how the supplier resolves it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">

            {/* â"€â"€ Purchase selector â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">
                Purchase Order <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <Input className="pl-8 h-9 text-sm" placeholder="Search by PO# or supplier name..."
                  value={purchaseSearchQuery}
                  onChange={e => { setPurchaseSearchQuery(e.target.value); setShowPurchaseDropdown(true) }}
                  onFocus={() => setShowPurchaseDropdown(true)} />
                {showPurchaseDropdown && filteredPurchaseOptions.length > 0 && (
                  <>
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      {filteredPurchaseOptions.map(p => (
                        <button key={p.id}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 text-left transition-colors"
                          onMouseDown={() => selectPurchase(p)}>
                          <div>
                            <span className="text-sm font-semibold text-slate-800">{p.poNumber}</span>
                            <span className="text-xs text-slate-500 ml-2">- {p.supplierName}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-slate-900">{formatCurrency(p.total)}</span>
                            <span className="text-[10px] text-slate-400 ml-2">{formatDatePKT(p.date)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPurchaseDropdown(false)} />
                  </>
                )}
              </div>
            </div>

            {/* â"€â"€ Supplier + Date â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
            {selectedPurchase && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Supplier</Label>
                  <Select value={newSupplierId} onValueChange={v => {
                    setNewSupplierId(v)
                    const s = suppliers.find(s => s.id === v)
                    if (s) setNewSupplierName(s.companyName)
                  }}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {suppliers.filter(s => s.status === "Active").map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-slate-400 mt-1">Auto-filled - change if returning to different person</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Return Date</Label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-600">
                    {todayPKT()}
                  </div>
                </div>
              </div>
            )}

            {/* â"€â"€ Items â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
            {lineItems.length > 0 && (
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-2 block">
                  Items - check items to return
                  <span className="font-normal text-slate-400 ml-2">(only showing returnable items)</span>
                </Label>
                <div className="space-y-2">
                  {lineItems.map((line, idx) => (
                    <div key={idx} className={cn(
                      "rounded-xl border p-3 transition-colors",
                      line.selected ? "border-rose-300 bg-rose-50/40" : "border-slate-200 bg-slate-50/40"
                    )}>
                      <div className="flex items-start gap-3">
                        <button
                          className={cn("mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors",
                            line.selected ? "border-rose-500 bg-rose-500" : "border-slate-300 bg-white"
                          )}
                          onClick={() => updateLine(idx, "selected", !line.selected)}>
                          {line.selected && <span className="text-white text-[10px] font-bold">âœ"</span>}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-slate-800 truncate">{line.productName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">{line.productType}</span>
                          </div>

                          {/* FIX 2 & 3: Show returnable qty clearly */}
                          <p className="text-[10px] text-slate-400 mb-2">
                            Bought: {line.originalQty}
                            {line.alreadyReturned > 0 && (
                              <span className="text-amber-600 font-semibold ml-2">- Already returned: {line.alreadyReturned}</span>
                            )}
                            <span className="text-emerald-600 font-semibold ml-2">- Returnable: {line.maxQty}</span>
                          </p>

                          {line.selected && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <div>
                                <Label className="text-[10px] text-slate-500 mb-1 block">Return Qty (max {line.maxQty})</Label>
                                <div className="flex items-center gap-1">
                                  <button className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 shrink-0"
                                    onClick={() => updateLine(idx, "returnQty", Math.max(1, line.returnQty - 1))}>
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <Input type="number" onWheel={e => e.currentTarget.blur()} min={1} max={line.maxQty} value={line.returnQty}
                                    onChange={e => updateLine(idx, "returnQty", Math.min(line.maxQty, Math.max(1, parseInt(e.target.value) || 1)))}
                                    className="h-6 text-center text-xs px-1 w-12" />
                                  <button className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-100 shrink-0"
                                    onClick={() => updateLine(idx, "returnQty", Math.min(line.maxQty, line.returnQty + 1))}>
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <div>
                                <Label className="text-[10px] text-slate-500 mb-1 block">Unit Cost</Label>
                                <Input type="number" onWheel={e => e.currentTarget.blur()} min={0} value={line.unitCost}
                                  onChange={e => updateLine(idx, "unitCost", parseFloat(e.target.value) || 0)}
                                  className="h-6 text-xs" />
                              </div>
                              <div>
                                <Label className="text-[10px] text-slate-500 mb-1 block">Line Total</Label>
                                <div className="h-6 flex items-center px-2 rounded border border-slate-200 bg-white text-xs font-semibold text-slate-800">
                                  {formatCurrency(line.unitCost * line.returnQty)}
                                </div>
                              </div>
                              <div className="col-span-2 sm:col-span-3">
                                <Label className="text-[10px] text-slate-500 mb-1 block">Reason</Label>
                                <Select value={line.reason} onValueChange={v => updateLine(idx, "reason", v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedLines.length > 0 && (
                  <div className="flex justify-between items-center mt-3 px-1">
                    <span className="text-xs text-slate-500">{selectedLines.length} item{selectedLines.length !== 1 ? "s" : ""} selected</span>
                    <span className="text-sm font-bold text-slate-900">Total: {formatCurrency(newTotal)}</span>
                  </div>
                )}
              </div>
            )}

            {/* FIX 3: All items fully returned */}
            {selectedPurchase && lineItems.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-amber-700">All items already returned</p>
                <p className="text-xs text-amber-600 mt-1">Every item from this purchase has been fully returned. Select a different purchase order.</p>
              </div>
            )}

            {/* â"€â"€ Resolution â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
            {selectedLines.length > 0 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-2 block">
                    Resolution <span className="text-red-500">*</span>
                    <span className="font-normal text-slate-400 ml-2">- how does the supplier settle this?</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(RESOLUTION_CONFIG) as [Resolution, typeof RESOLUTION_CONFIG[Resolution]][]).map(([key, cfg]) => (
                      <button key={key} type="button" onClick={() => setNewResolution(key)}
                        className={cn("rounded-xl border p-3 text-left transition-all",
                          newResolution === key ? cfg.selectedColor : cfg.hoverColor
                        )}>
                        <div className="flex items-center gap-2 mb-1">
                          {cfg.icon}
                          <span className="text-sm font-semibold">{cfg.label}</span>
                        </div>
                        <p className="text-[11px] leading-snug opacity-80">{cfg.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Refund: account cards */}
                {newResolution === "Refund" && (
                  <div>
                    <Label className="text-xs font-semibold text-slate-600 mb-2 block">
                      Refund goes into which account? <span className="text-red-500">*</span>
                    </Label>
                    {financeAccounts.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-700">No finance accounts found. Set up accounts first.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {financeAccounts.map(acc => {
                          const sel  = newAccountId === acc.id
                          const type = acc.type ?? "cash"
                          return (
                            <button key={acc.id} type="button" onClick={() => setNewAccountId(acc.id)}
                              className={cn("w-full rounded-xl border p-3 flex items-center gap-3 text-left transition-all", accountRingColor(type, sel))}>
                              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", accountIconBg(type, sel))}>
                                <AccountIcon type={type} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate">{acc.name}</p>
                                <p className="text-sm font-extrabold text-slate-900 tabular-nums">
                                  {formatCurrency(acc.currentBalance)}
                                  {sel && (
                                    <span className="ml-2 text-xs font-semibold text-emerald-600">
                                      â†' {formatCurrency(acc.currentBalance + newTotal)} after refund
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                                sel ? "bg-emerald-600 border-emerald-600" : "border-slate-300")}>
                                {sel && <span className="text-white text-[10px] font-bold">âœ"</span>}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {newAccountId && (
                      <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-start gap-2">
                        <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-emerald-700">
                          <span className="font-semibold">{formatCurrency(newTotal)}</span> added to{" "}
                          <span className="font-semibold">{selectedAccount?.name}</span> - Supplier ledger updated - Stock reduced
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {newResolution === "Replacement" && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 flex items-start gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-700">
                      <p className="font-semibold">No money moves</p>
                      <p className="opacity-80 mt-0.5">Stock reduced now. When replacement arrives, record it as a new purchase.</p>
                    </div>
                  </div>
                )}

                {newResolution === "Credit Note" && (
                  <div className="rounded-lg bg-violet-50 border border-violet-200 px-3 py-2.5 flex items-start gap-2">
                    <FileText className="w-3.5 h-3.5 text-violet-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-violet-700">
                      <p className="font-semibold">No cash received</p>
                      <p className="opacity-80 mt-0.5"><span className="font-semibold">{formatCurrency(newTotal)}</span> deducted from what you owe <span className="font-semibold">{newSupplierName}</span>. Use on next purchase.</p>
                    </div>
                  </div>
                )}

                {newResolution === "Ledger Credit" && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-xs text-amber-700">
                      <p className="font-semibold">Recorded - settle later</p>
                      <p className="opacity-80 mt-0.5"><span className="font-semibold">{newSupplierName}</span> owes you <span className="font-semibold">{formatCurrency(newTotal)}</span>. Deduct from next payment to them.</p>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">Notes (optional)</Label>
                  <Textarea value={newNotes} onChange={e => setNewNotes(e.target.value)}
                    placeholder="e.g. Supplier agreed by call, credit on next order..."
                    className="text-sm resize-none h-16" />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm() }}>Cancel</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleSave}
              disabled={saving || selectedLines.length === 0}>
              {saving ? "Saving..." : `Confirm Return${newTotal > 0 ? ` - ${formatCurrency(newTotal)}` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          VIEW DIALOG
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog open={!!viewReturn} onOpenChange={v => { if (!v) setViewReturn(null) }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto w-[96vw] p-4 sm:p-6">
          {viewReturn && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-base font-bold font-mono text-rose-600">{viewReturn.returnNumber}</DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 mt-0.5">
                      {viewReturn.poNumber} - {viewReturn.supplierName} - {formatDatePKT(viewReturn.date)}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", RESOLUTION_COLORS[viewReturn.resolution])}>{viewReturn.resolution}</span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[viewReturn.status])}>{viewReturn.status}</span>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Returned Items</p>
                {viewReturn.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{item.productName}</p>
                      <p className="text-xs text-slate-400">{item.reason} - qty {item.returnQty}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(item.unitCost * item.returnQty)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-1 px-1">
                  <span className="text-xs text-slate-500">Total</span>
                  <span className="text-base font-bold text-slate-900">{formatCurrency(viewReturn.totalAmount)}</span>
                </div>
              </div>

              <div className={cn("mt-3 rounded-lg border px-3 py-2.5 flex items-center justify-between",
                viewReturn.resolution === "Refund"        ? "bg-emerald-50 border-emerald-100"
                : viewReturn.resolution === "Replacement" ? "bg-blue-50 border-blue-100"
                : viewReturn.resolution === "Credit Note" ? "bg-violet-50 border-violet-100"
                : "bg-amber-50 border-amber-100"
              )}>
                <div>
                  <p className={cn("text-xs font-semibold",
                    viewReturn.resolution === "Refund"        ? "text-emerald-700"
                    : viewReturn.resolution === "Replacement" ? "text-blue-700"
                    : viewReturn.resolution === "Credit Note" ? "text-violet-700"
                    : "text-amber-700"
                  )}>{viewReturn.resolution}</p>
                  {viewReturn.resolution === "Refund" && viewReturn.refundMethod && (
                    <p className="text-xs text-emerald-600 mt-0.5">via {viewReturn.refundMethod}</p>
                  )}
                </div>
                <span className="text-sm font-bold">{formatCurrency(viewReturn.totalAmount)}</span>
              </div>

              {viewReturn.notes && (
                <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{viewReturn.notes}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {viewReturn.status === "Pending" && (
                  <>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs gap-1.5"
                      onClick={() => handleUpdateStatus(viewReturn.id, "Approved")}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleUpdateStatus(viewReturn.id, "Rejected")}>
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </>
                )}
                {viewReturn.status === "Approved" && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs gap-1.5"
                    onClick={() => handleUpdateStatus(viewReturn.id, "Completed")}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Completed
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}

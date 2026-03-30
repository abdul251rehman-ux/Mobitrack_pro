"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Search, Plus, Download, Eye, X,
  ArrowDownLeft, ArrowUpRight, Wallet,
  Clock, CreditCard, Banknote, Building2,
  Smartphone, Zap, Users, Truck,
} from "lucide-react"
import { toast } from "sonner"

import { getPayments, createPayment } from "@/lib/api/payments"
import { getCustomers } from "@/lib/api/customers"
import { getSuppliers } from "@/lib/api/suppliers"
import { getSales } from "@/lib/api/sales"
import { getPurchases } from "@/lib/api/purchases"
import { supabase } from "@/lib/supabase"
import { Payment, Customer, Supplier, Sale, Purchase } from "@/data/types"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { exportToCSV } from "@/lib/csv-export"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "JazzCash", "EasyPaisa", "Card", "Cheque"]
const REFERENCE_TYPES: Payment["referenceType"][] = ["Sale", "Purchase", "Return", "Advance", "Settlement"]

const METHOD_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  "Cash":          { icon: <Banknote className="h-3 w-3" />,   color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  "Bank Transfer": { icon: <Building2 className="h-3 w-3" />,  color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200"  },
  "JazzCash":      { icon: <Smartphone className="h-3 w-3" />, color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200"     },
  "EasyPaisa":     { icon: <Zap className="h-3 w-3" />,        color: "text-green-700",   bg: "bg-green-50",   border: "border-green-200"   },
  "Card":          { icon: <CreditCard className="h-3 w-3" />, color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200"    },
  "Cheque":        { icon: <Wallet className="h-3 w-3" />,     color: "text-slate-700",   bg: "bg-slate-50",   border: "border-slate-200"   },
}

// ─── Initial form state ───────────────────────────────────────────────────────

interface PaymentForm {
  type: "Received" | "Paid"
  entityType: "Customer" | "Supplier"
  entityId: string
  referenceType: Payment["referenceType"]
  referenceNumber: string
  amount: string
  method: string
  notes: string
}

const emptyForm: PaymentForm = {
  type: "Received",
  entityType: "Customer",
  entityId: "",
  referenceType: "Sale",
  referenceNumber: "",
  amount: "",
  method: "Cash",
  notes: "",
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")

  // Filters
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState("All")
  const [filterEntityType, setFilterEntityType] = useState("All")
  const [filterMethod, setFilterMethod] = useState("All")
  const [filterStatus, setFilterStatus] = useState("All")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // Dialog state
  const [showRecordDialog, setShowRecordDialog] = useState(false)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [viewPayment, setViewPayment] = useState<Payment | null>(null)
  const [form, setForm] = useState<PaymentForm>(emptyForm)

  // Pre-fill record dialog from receivables/payables tab
  const [prefilledEntityType, setPrefilledEntityType] = useState<"Customer" | "Supplier" | null>(null)
  const [prefilledEntityId, setPrefilledEntityId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [paymentsData, customersData, suppliersData, salesData, purchasesData] = await Promise.all([
          getPayments(),
          getCustomers(),
          getSuppliers(),
          getSales(),
          getPurchases(),
        ])
        setPayments(paymentsData)
        setCustomers(customersData)
        setSuppliers(suppliersData)
        setSales(salesData)
        setPurchases(purchasesData)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch data")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ─── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    // Total received: max of (payments table) vs (sales.amountReceived)
    const receivedFromPayments = payments
      .filter((p) => p.type === "Received" && p.status !== "Failed")
      .reduce((sum, p) => sum + p.amount, 0)
    const receivedFromSales = sales.reduce((sum, s) => sum + s.amountReceived, 0)
    const totalReceived = Math.max(receivedFromPayments, receivedFromSales)

    // Total paid: max of (payments table) vs (purchases.amountPaid)
    const paidFromPayments = payments
      .filter((p) => p.type === "Paid" && p.status !== "Failed")
      .reduce((sum, p) => sum + p.amount, 0)
    const paidFromPurchases = purchases.reduce((sum, p) => sum + p.amountPaid, 0)
    const totalPaid = Math.max(paidFromPayments, paidFromPurchases)

    const netBalance = totalReceived - totalPaid
    const pendingCount = payments.filter((p) => p.status === "Pending").length

    const receivedCount = payments.filter((p) => p.type === "Received" && p.status !== "Failed").length
    const paidCount = payments.filter((p) => p.type === "Paid" && p.status !== "Failed").length

    return { totalReceived, totalPaid, netBalance, pendingCount, receivedCount, paidCount }
  }, [payments, sales, purchases])

  // ─── Filtered payments ──────────────────────────────────────────────────────

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (search) {
        const q = search.toLowerCase()
        const match =
          p.entityName.toLowerCase().includes(q) ||
          (p.referenceNumber?.toLowerCase().includes(q)) ||
          p.id.toLowerCase().includes(q) ||
          p.notes?.toLowerCase().includes(q)
        if (!match) return false
      }
      if (filterType !== "All" && p.type !== filterType) return false
      if (filterEntityType !== "All" && p.entityType !== filterEntityType) return false
      if (filterMethod !== "All" && p.method !== filterMethod) return false
      if (filterStatus !== "All" && p.status !== filterStatus) return false
      if (dateFrom && p.date < dateFrom) return false
      if (dateTo && p.date > dateTo) return false
      return true
    })
  }, [payments, search, filterType, filterEntityType, filterMethod, filterStatus, dateFrom, dateTo])

  // ─── Customer receivables (calculated from sales + payments) ────────────────

  const customerReceivables = useMemo(() => {
    return customers
      .map((c) => {
        // Total billed from sales
        const custSales = sales.filter(s => s.customerId === c.id)
        const totalBilled = custSales.reduce((sum, s) => sum + s.total, 0)

        // Total received from payments
        const totalReceivedPayments = payments
          .filter((p) => p.entityType === "Customer" && p.entityId === c.id && p.type === "Received" && p.status === "Completed")
          .reduce((s, p) => s + p.amount, 0)

        // Also consider amountReceived from sales (handles missing payment records)
        const totalReceivedSales = custSales.reduce((sum, s) => sum + s.amountReceived, 0)
        const effectiveReceived = Math.max(totalReceivedPayments, totalReceivedSales)

        const outstanding = Math.max(0, totalBilled - effectiveReceived)

        const lastPayment = payments
          .filter((p) => p.entityType === "Customer" && p.entityId === c.id && p.type === "Received" && p.status === "Completed")
          .sort((a, b) => b.date.localeCompare(a.date))[0]

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          totalDue: outstanding,
          lastPaymentDate: lastPayment?.date,
        }
      })
      .filter((c) => c.totalDue > 0)
      .sort((a, b) => b.totalDue - a.totalDue)
  }, [customers, sales, payments])

  // ─── Supplier payables (calculated from purchases + payments) ──────────────

  const supplierPayables = useMemo(() => {
    return suppliers
      .map((s) => {
        // Total from purchases
        const suppPurchases = purchases.filter(p => p.supplierId === s.id)
        const totalBilled = suppPurchases.reduce((sum, p) => sum + p.total, 0)

        // Total paid from payments
        const totalPaidPayments = payments
          .filter((p) => p.entityType === "Supplier" && p.entityId === s.id && p.type === "Paid" && p.status === "Completed")
          .reduce((sum, p) => sum + p.amount, 0)

        // Also consider amountPaid from purchases (handles missing payment records)
        const totalPaidPurchases = suppPurchases.reduce((sum, p) => sum + p.amountPaid, 0)
        const effectivePaid = Math.max(totalPaidPayments, totalPaidPurchases)

        const outstanding = Math.max(0, totalBilled - effectivePaid)

        const lastPayment = payments
          .filter((p) => p.entityType === "Supplier" && p.entityId === s.id && p.type === "Paid" && p.status === "Completed")
          .sort((a, b) => b.date.localeCompare(a.date))[0]

        return {
          id: s.id,
          name: s.companyName,
          phone: s.phone,
          totalDue: outstanding,
          lastPaymentDate: lastPayment?.date,
        }
      })
      .filter((s) => s.totalDue > 0)
      .sort((a, b) => b.totalDue - a.totalDue)
  }, [suppliers, purchases, payments])

  // ─── Entity list for form dropdown ──────────────────────────────────────────

  const entityOptions = useMemo(() => {
    if (form.entityType === "Customer") {
      return customers.map((c) => ({ id: c.id, name: c.name }))
    }
    return suppliers.filter((s) => s.status === "Active").map((s) => ({ id: s.id, name: s.companyName }))
  }, [form.entityType, customers, suppliers])

  // ─── Selected entity summary (for dialog) ─────────────────────────────────

  const entitySummary = useMemo(() => {
    if (!form.entityId) return null

    if (form.entityType === "Customer") {
      const custSales = sales.filter(s => s.customerId === form.entityId)
      const totalBilled = custSales.reduce((sum, s) => sum + s.total, 0)
      const custPayments = payments.filter(p => p.entityType === "Customer" && p.entityId === form.entityId && p.type === "Received" && p.status !== "Failed")
      const totalReceived = custPayments.reduce((sum, p) => sum + p.amount, 0)
      const totalReceivedFromSales = custSales.reduce((sum, s) => sum + s.amountReceived, 0)
      const effectivePaid = Math.max(totalReceived, totalReceivedFromSales)
      const outstanding = Math.max(0, totalBilled - effectivePaid)

      return {
        label: "Total Received",
        totalBilled,
        totalPaid: effectivePaid,
        outstanding,
        recentPayments: custPayments.slice(0, 5),
        unpaidRefs: custSales.filter(s => s.total > s.amountReceived).map(s => ({
          ref: s.invoiceNumber, total: s.total, paid: s.amountReceived, due: s.total - s.amountReceived,
        })),
      }
    } else {
      const suppPurchases = purchases.filter(p => p.supplierId === form.entityId)
      const totalBilled = suppPurchases.reduce((sum, p) => sum + p.total, 0)
      const suppPayments = payments.filter(p => p.entityType === "Supplier" && p.entityId === form.entityId && p.type === "Paid" && p.status !== "Failed")
      const totalPaidFromPayments = suppPayments.reduce((sum, p) => sum + p.amount, 0)
      const totalPaidFromPurchases = suppPurchases.reduce((sum, p) => sum + p.amountPaid, 0)
      const effectivePaid = Math.max(totalPaidFromPayments, totalPaidFromPurchases)
      const outstanding = Math.max(0, totalBilled - effectivePaid)

      return {
        label: "Total Paid",
        totalBilled,
        totalPaid: effectivePaid,
        outstanding,
        recentPayments: suppPayments.slice(0, 5),
        unpaidRefs: suppPurchases.filter(p => p.balanceDue > 0).map(p => ({
          ref: p.poNumber, total: p.total, paid: p.amountPaid, due: p.balanceDue,
        })),
      }
    }
  }, [form.entityId, form.entityType, sales, purchases, payments])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function openRecordDialog(entityType?: "Customer" | "Supplier", entityId?: string) {
    const newForm: PaymentForm = {
      ...emptyForm,
      type: entityType === "Supplier" ? "Paid" : "Received",
      entityType: entityType ?? "Customer",
      entityId: entityId ?? "",
      referenceType: entityType === "Supplier" ? "Purchase" : "Sale",
    }
    setForm(newForm)
    setShowRecordDialog(true)
  }

  async function handleRecordPayment() {
    if (!form.entityId) {
      toast.error("Please select an entity")
      return
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    const entityName =
      form.entityType === "Customer"
        ? customers.find((c) => c.id === form.entityId)?.name ?? ""
        : suppliers.find((s) => s.id === form.entityId)?.companyName ?? ""

    try {
      const amount = Number(form.amount)
      const created = await createPayment({
        date: new Date().toISOString().split("T")[0],
        type: form.type,
        entityType: form.entityType,
        entityId: form.entityId,
        entityName,
        referenceType: form.referenceType,
        referenceNumber: form.referenceNumber || undefined,
        amount,
        method: form.method,
        status: "Completed",
        notes: form.notes || undefined,
        processedBy: "",
        createdAt: new Date().toISOString(),
      })

      // Update the related sale or purchase record
      if (form.entityType === "Customer" && form.referenceNumber) {
        const sale = sales.find(s => s.invoiceNumber === form.referenceNumber)
        if (sale) {
          const newReceived = (sale.amountReceived || 0) + amount
          await supabase.from("sales").update({
            amount_received: newReceived,
            change_due: Math.max(0, newReceived - sale.total),
            status: newReceived >= sale.total ? "Completed" : "Pending",
          }).eq("id", sale.id)
        }
      } else if (form.entityType === "Supplier" && form.referenceNumber) {
        const purchase = purchases.find(p => p.poNumber === form.referenceNumber)
        if (purchase) {
          const newPaid = (purchase.amountPaid || 0) + amount
          const newBalance = Math.max(0, purchase.total - newPaid)
          const ps = newPaid <= 0 ? "Unpaid" : newPaid >= purchase.total ? "Paid" : "Partial"
          await supabase.from("purchases").update({
            amount_paid: newPaid,
            balance_due: newBalance,
            payment_status: ps,
          }).eq("id", purchase.id)
        }
      }

      setPayments((prev) => [created, ...prev])
      // Refresh sales/purchases data
      const [newSales, newPurchases] = await Promise.all([getSales(), getPurchases()])
      setSales(newSales)
      setPurchases(newPurchases)

      setShowRecordDialog(false)
      setForm(emptyForm)
      toast.success(`Payment of ${formatCurrency(amount)} recorded successfully`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment")
    }
  }

  function handleExportCSV() {
    const exportData = filteredPayments.map((p) => ({
      id: p.id,
      date: p.date,
      type: p.type,
      entityType: p.entityType,
      entityName: p.entityName,
      referenceType: p.referenceType,
      referenceNumber: p.referenceNumber ?? "",
      amount: p.amount,
      method: p.method,
      status: p.status,
      notes: p.notes ?? "",
      processedBy: p.processedBy,
    }))
    exportToCSV(exportData, "payments-export", [
      { key: "id", header: "Payment ID" },
      { key: "date", header: "Date" },
      { key: "type", header: "Type" },
      { key: "entityType", header: "Entity Type" },
      { key: "entityName", header: "Entity Name" },
      { key: "referenceType", header: "Reference Type" },
      { key: "referenceNumber", header: "Reference #" },
      { key: "amount", header: "Amount (PKR)" },
      { key: "method", header: "Method" },
      { key: "status", header: "Status" },
      { key: "notes", header: "Notes" },
      { key: "processedBy", header: "Processed By" },
    ])
    toast.success(`Exported ${exportData.length} payments to CSV`)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments Center"
        description="Track all received and paid payments, manage receivables and payables"
      />

      {/* ─── Stats Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <StatCard
          title="Total Received"
          value={formatCurrency(stats.totalReceived)}
          icon={ArrowDownLeft}
          iconBg="bg-emerald-100"
          subtext={`${payments.filter((p) => p.type === "Received").length} transactions`}
        />
        <StatCard
          title="Total Paid"
          value={formatCurrency(stats.totalPaid)}
          icon={ArrowUpRight}
          iconBg="bg-red-100"
          subtext={`${payments.filter((p) => p.type === "Paid").length} transactions`}
        />
        <StatCard
          title="Net Balance"
          value={formatCurrency(stats.netBalance)}
          icon={Wallet}
          iconBg="bg-blue-100"
          subtext={stats.netBalance >= 0 ? "Positive balance" : "Deficit"}
        />
        <StatCard
          title="Pending Payments"
          value={String(stats.pendingCount)}
          icon={Clock}
          iconBg="bg-amber-100"
          subtext="Awaiting clearance"
        />
      </div>

      {/* ─── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="all">All Payments</TabsTrigger>
          <TabsTrigger value="receivables">Receivables &amp; Payables</TabsTrigger>
        </TabsList>

        {/* ═══ ALL PAYMENTS TAB ════════════════════════════════════════════════ */}
        <TabsContent value="all" className="space-y-4">
          {/* Filters + actions */}
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-4 space-y-4">
              {/* Row 1: search + actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, reference, ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => openRecordDialog()} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" /> Record Payment
                  </Button>
                  <Button variant="outline" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                </div>
              </div>

              {/* Row 2: filters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    <SelectItem value="Received">Received</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                  <SelectTrigger><SelectValue placeholder="Entity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Entities</SelectItem>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterMethod} onValueChange={setFilterMethod}>
                  <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Methods</SelectItem>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Statuses</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                <div className="space-y-1">
                  <label className="block text-[10px] font-medium text-slate-400 sm:hidden">From</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    placeholder="From"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-medium text-slate-400 sm:hidden">To</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    placeholder="To"
                    className="text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments table */}
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50/60">
                      <TableHead className="text-xs font-semibold text-slate-500 whitespace-nowrap">Date</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 whitespace-nowrap">Type</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 whitespace-nowrap">Entity</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 whitespace-nowrap">Reference</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 text-right whitespace-nowrap">Amount</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 whitespace-nowrap">Method</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 whitespace-nowrap">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 text-right whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                          No payments found matching your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPayments.map((p) => {
                        const methodMeta = METHOD_META[p.method]
                        return (
                          <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <TableCell className="text-sm text-slate-700 whitespace-nowrap">
                              {formatDate(p.date)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs font-medium",
                                  p.type === "Received"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                                )}
                              >
                                {p.type === "Received" ? (
                                  <ArrowDownLeft className="h-3 w-3 mr-1" />
                                ) : (
                                  <ArrowUpRight className="h-3 w-3 mr-1" />
                                )}
                                {p.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium text-slate-800">{p.entityName}</p>
                                <p className="text-xs text-slate-400">{p.entityType}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm text-slate-700">{p.referenceType}</p>
                                {p.referenceNumber && (
                                  <p className="text-xs text-slate-400 font-mono">{p.referenceNumber}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={cn(
                                  "text-sm font-semibold",
                                  p.type === "Received" ? "text-emerald-600" : "text-red-600"
                                )}
                              >
                                {p.type === "Received" ? "+" : "-"}{formatCurrency(Math.abs(p.amount))}
                              </span>
                            </TableCell>
                            <TableCell>
                              {methodMeta ? (
                                <Badge
                                  variant="outline"
                                  className={cn("text-xs font-medium", methodMeta.color, methodMeta.bg, methodMeta.border)}
                                >
                                  {methodMeta.icon}
                                  <span className="ml-1">{p.method}</span>
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">{p.method}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={p.status} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600"
                                onClick={() => {
                                  setViewPayment(p)
                                  setShowViewDialog(true)
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              {filteredPayments.length > 0 && (
                <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
                  Showing {filteredPayments.length} of {payments.length} payments
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ RECEIVABLES & PAYABLES TAB ══════════════════════════════════════ */}
        <TabsContent value="receivables" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Receivables */}
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-0">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Customer Receivables</h3>
                      <p className="text-xs text-slate-400">Outstanding amounts from customers</p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {customerReceivables.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">No outstanding receivables</div>
                  ) : (
                    customerReceivables.map((c) => (
                      <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.phone}</p>
                        </div>
                        <div className="text-right mr-3">
                          <p className="text-sm font-semibold text-emerald-600">{formatCurrency(c.totalDue)}</p>
                          <p className="text-xs text-slate-400">
                            {c.lastPaymentDate ? `Last: ${formatDate(c.lastPaymentDate)}` : "No payments"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => openRecordDialog("Customer", c.id)}
                        >
                          Record Payment
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                {customerReceivables.length > 0 && (
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-600">Total Receivable</span>
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(customerReceivables.reduce((s, c) => s + c.totalDue, 0))}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supplier Payables */}
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-0">
                <div className="p-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                      <Truck className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Supplier Payables</h3>
                      <p className="text-xs text-slate-400">Outstanding amounts to suppliers</p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {supplierPayables.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">No outstanding payables</div>
                  ) : (
                    supplierPayables.map((s) => (
                      <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.phone}</p>
                        </div>
                        <div className="text-right mr-3">
                          <p className="text-sm font-semibold text-red-600">{formatCurrency(s.totalDue)}</p>
                          <p className="text-xs text-slate-400">
                            {s.lastPaymentDate ? `Last: ${formatDate(s.lastPaymentDate)}` : "No payments"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => openRecordDialog("Supplier", s.id)}
                        >
                          Record Payment
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                {supplierPayables.length > 0 && (
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-600">Total Payable</span>
                      <span className="font-bold text-red-600">
                        {formatCurrency(supplierPayables.reduce((s, sp) => s + sp.totalDue, 0))}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ RECORD PAYMENT DIALOG ════════════════════════════════════════════ */}
      <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Type + Entity Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Payment Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as "Received" | "Paid" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Received">Received (Payment from Customer/Supplier)</SelectItem>
                    <SelectItem value="Paid">Paid (We paid to Customer/Supplier)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Entity Type</Label>
                <Select
                  value={form.entityType}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      entityType: v as "Customer" | "Supplier",
                      entityId: "",
                      type: v === "Supplier" ? "Paid" : "Received",
                      referenceType: v === "Supplier" ? "Purchase" : "Sale",
                      referenceNumber: "",
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Entity */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">
                {form.entityType === "Customer" ? "Customer" : "Supplier"} <span className="text-red-500">*</span>
              </Label>
              <Select value={form.entityId} onValueChange={(v) => setForm((f) => ({ ...f, entityId: v, referenceNumber: "" }))}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${form.entityType.toLowerCase()}...`} />
                </SelectTrigger>
                <SelectContent>
                  {entityOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Entity Summary — shows when entity selected ────────────── */}
            {entitySummary && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                {/* Summary cards */}
                <div className="grid grid-cols-3 divide-x divide-slate-200">
                  <div className="p-3 text-center">
                    <p className="text-[10px] font-medium text-slate-400 uppercase">Total Billed</p>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{formatCurrency(entitySummary.totalBilled)}</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-[10px] font-medium text-slate-400 uppercase">{entitySummary.label}</p>
                    <p className="text-sm font-bold text-emerald-700 mt-0.5">{formatCurrency(entitySummary.totalPaid)}</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-[10px] font-medium text-slate-400 uppercase">Outstanding</p>
                    <p className={cn("text-sm font-bold mt-0.5", entitySummary.outstanding > 0 ? "text-red-600" : "text-emerald-700")}>
                      {entitySummary.outstanding > 0 ? formatCurrency(entitySummary.outstanding) : "Settled"}
                    </p>
                  </div>
                </div>

                {/* Unpaid invoices/POs */}
                {entitySummary.unpaidRefs.length > 0 && (
                  <div className="border-t border-slate-200">
                    <div className="px-3 py-2 bg-white">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                        Unpaid {form.entityType === "Customer" ? "Invoices" : "Purchase Orders"}
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {entitySummary.unpaidRefs.map(r => (
                          <button
                            key={r.ref}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, referenceNumber: r.ref, amount: String(Math.max(0, r.due)) }))}
                            className={cn(
                              "w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors",
                              form.referenceNumber === r.ref ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50 border border-transparent"
                            )}
                          >
                            <span className="font-mono font-medium text-slate-700">{r.ref}</span>
                            <span className="flex items-center gap-3">
                              <span className="text-slate-400">Total: {formatCurrency(r.total)}</span>
                              <span className="text-emerald-600">Paid: {formatCurrency(r.paid)}</span>
                              <span className="font-bold text-red-600">Due: {formatCurrency(Math.max(0, r.due))}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent payments */}
                {entitySummary.recentPayments.length > 0 && (
                  <div className="border-t border-slate-200">
                    <div className="px-3 py-2 bg-white">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Recent Payments</p>
                      <div className="space-y-1 max-h-28 overflow-y-auto">
                        {entitySummary.recentPayments.map(p => (
                          <div key={p.id} className="flex items-center justify-between text-xs px-2.5 py-1 rounded-md bg-slate-50">
                            <span className="text-slate-500">{formatDate(p.date)}</span>
                            <span className="font-mono text-slate-400">{p.referenceNumber}</span>
                            <span className="font-bold text-emerald-600">+{formatCurrency(p.amount)}</span>
                            <span className="text-slate-400">{p.method}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reference type + number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Reference Type</Label>
                <Select
                  value={form.referenceType}
                  onValueChange={(v) => setForm((f) => ({ ...f, referenceType: v as Payment["referenceType"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REFERENCE_TYPES.map((rt) => (
                      <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Reference # (optional)</Label>
                <Input
                  value={form.referenceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                  placeholder={form.entityType === "Customer" ? "e.g. INV-2026-0011" : "e.g. PO-2026-0138"}
                />
              </div>
            </div>

            {/* Amount + method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Amount (Rs) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Payment Method</Label>
                <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes about this payment..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecordDialog(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleRecordPayment}>
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ VIEW PAYMENT DIALOG ══════════════════════════════════════════════ */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">Payment Details</DialogTitle>
          </DialogHeader>
          {viewPayment && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Payment ID</p>
                  <p className="font-mono text-slate-700">{viewPayment.id}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Date</p>
                  <p className="text-slate-700">{formatDate(viewPayment.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Type</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      viewPayment.type === "Received"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-red-50 text-red-700 border-red-200"
                    )}
                  >
                    {viewPayment.type}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Status</p>
                  <StatusBadge status={viewPayment.status} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Entity</p>
                  <p className="text-slate-700 font-medium">{viewPayment.entityName}</p>
                  <p className="text-xs text-slate-400">{viewPayment.entityType}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Amount</p>
                  <p className={cn(
                    "font-semibold",
                    viewPayment.type === "Received" ? "text-emerald-600" : "text-red-600"
                  )}>
                    {formatCurrency(Math.abs(viewPayment.amount))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Reference</p>
                  <p className="text-slate-700">{viewPayment.referenceType}</p>
                  {viewPayment.referenceNumber && (
                    <p className="text-xs font-mono text-slate-400">{viewPayment.referenceNumber}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Method</p>
                  <p className="text-slate-700">{viewPayment.method}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">Processed By</p>
                  <p className="text-slate-700">{viewPayment.processedBy}</p>
                </div>
                {viewPayment.notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400 mb-0.5">Notes</p>
                    <p className="text-slate-600 text-sm bg-slate-50 rounded-lg p-3">{viewPayment.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

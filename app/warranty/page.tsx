"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Shield, Wrench, Search, Plus, Eye, FileText, Clock,
  AlertTriangle, CheckCircle, XCircle, ChevronRight,
  DollarSign, Package, User, Phone, Calendar, Hash,
} from "lucide-react"
import { toast } from "sonner"

import { getWarrantyRecords, createWarrantyClaim, getRepairTickets, createRepairTicket, updateRepairTicket } from "@/lib/api/warranty"
import { WarrantyRecord, RepairTicket, RepairStatus, RepairPriority, WarrantyClaim } from "@/data/types"
import { formatCurrency, formatDate } from "@/lib/utils"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

// ── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date("2026-03-24")

function daysUntilExpiry(expiryDate: string): number {
  const expiry = new Date(expiryDate)
  const diff = expiry.getTime() - TODAY.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const WARRANTY_STATUS_COLORS: Record<string, string> = {
  Active:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Expired: "bg-red-50 text-red-700 border border-red-200",
  Claimed: "bg-amber-50 text-amber-700 border border-amber-200",
  Voided:  "bg-slate-100 text-slate-600 border border-slate-200",
}

const REPAIR_STATUS_COLORS: Record<RepairStatus, string> = {
  Received:       "bg-blue-50 text-blue-700 border border-blue-200",
  Diagnosing:     "bg-violet-50 text-violet-700 border border-violet-200",
  "In Repair":    "bg-amber-50 text-amber-700 border border-amber-200",
  "Waiting Parts":"bg-orange-50 text-orange-700 border border-orange-200",
  Repaired:       "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Delivered:      "bg-teal-50 text-teal-700 border border-teal-200",
  Cancelled:      "bg-red-50 text-red-700 border border-red-200",
}

const PRIORITY_COLORS: Record<RepairPriority, string> = {
  Low:    "bg-slate-100 text-slate-600 border border-slate-200",
  Medium: "bg-blue-50 text-blue-700 border border-blue-200",
  High:   "bg-amber-50 text-amber-700 border border-amber-200",
  Urgent: "bg-red-50 text-red-700 border border-red-200",
}

const CLAIM_STATUS_COLORS: Record<string, string> = {
  Open:         "bg-blue-50 text-blue-700 border border-blue-200",
  "In Progress":"bg-amber-50 text-amber-700 border border-amber-200",
  Resolved:     "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Rejected:     "bg-red-50 text-red-700 border border-red-200",
}

const TERMINAL_STATUSES: RepairStatus[] = ["Delivered", "Cancelled"]
const ALL_REPAIR_STATUSES: RepairStatus[] = ["Received", "Diagnosing", "In Repair", "Waiting Parts", "Repaired", "Delivered", "Cancelled"]

function CustomBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${colorClass}`}>
      {label}
    </span>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function WarrantyPage() {
  // ── Data state ───────────────────────────────────────────────────────────
  const [warranties, setWarranties] = useState<WarrantyRecord[]>([])
  const [tickets, setTickets] = useState<RepairTicket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [warrantyData, ticketData] = await Promise.all([
          getWarrantyRecords(),
          getRepairTickets(),
        ])
        setWarranties(warrantyData)
        setTickets(ticketData)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch warranty data")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // ── Search state ─────────────────────────────────────────────────────────
  const [warrantySearch, setWarrantySearch] = useState("")
  const [ticketSearch, setTicketSearch] = useState("")
  const [warrantyStatusFilter, setWarrantyStatusFilter] = useState("all")
  const [ticketStatusFilter, setTicketStatusFilter] = useState("all")
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("all")

  // ── Dialog state ─────────────────────────────────────────────────────────
  const [viewWarranty, setViewWarranty] = useState<WarrantyRecord | null>(null)
  const [claimWarranty, setClaimWarranty] = useState<WarrantyRecord | null>(null)
  const [claimIssue, setClaimIssue] = useState("")

  const [viewTicket, setViewTicket] = useState<RepairTicket | null>(null)
  const [newTicketOpen, setNewTicketOpen] = useState(false)
  const [editTicket, setEditTicket] = useState<RepairTicket | null>(null)

  // ── New ticket form state ────────────────────────────────────────────────
  const [ntForm, setNtForm] = useState({
    customerName: "",
    customerPhone: "",
    deviceBrand: "",
    deviceModel: "",
    imei: "",
    issue: "",
    priority: "Medium" as RepairPriority,
    estimatedCost: "",
    technicianName: "",
    estimatedCompletionDate: "",
  })

  // ── Warranty Stats ───────────────────────────────────────────────────────
  const warrantyStats = useMemo(() => {
    const total = warranties.length
    const active = warranties.filter((w) => w.status === "Active").length
    const expiringSoon = warranties.filter(
      (w) => w.status === "Active" && daysUntilExpiry(w.expiryDate) <= 30 && daysUntilExpiry(w.expiryDate) > 0
    ).length
    const claimsOpen = warranties.reduce(
      (acc, w) => acc + w.claims.filter((c) => c.status === "Open" || c.status === "In Progress").length, 0
    )
    return { total, active, expiringSoon, claimsOpen }
  }, [warranties])

  // ── Ticket Stats ─────────────────────────────────────────────────────────
  const ticketStats = useMemo(() => {
    const total = tickets.length
    const activeRepairs = tickets.filter((t) => !TERMINAL_STATUSES.includes(t.status)).length
    const urgentCount = tickets.filter((t) => t.priority === "Urgent").length
    const revenue = tickets.reduce((acc, t) => acc + t.actualCost, 0)
    return { total, activeRepairs, urgentCount, revenue }
  }, [tickets])

  // ── Filtered warranties ──────────────────────────────────────────────────
  const filteredWarranties = useMemo(() => {
    return warranties.filter((w) => {
      if (warrantySearch) {
        const s = warrantySearch.toLowerCase()
        if (
          !w.productName.toLowerCase().includes(s) &&
          !w.customerName.toLowerCase().includes(s) &&
          !(w.imei && w.imei.includes(s))
        ) return false
      }
      if (warrantyStatusFilter !== "all" && w.status !== warrantyStatusFilter) return false
      return true
    })
  }, [warranties, warrantySearch, warrantyStatusFilter])

  // ── Filtered tickets ─────────────────────────────────────────────────────
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (ticketSearch) {
        const s = ticketSearch.toLowerCase()
        if (
          !t.ticketNumber.toLowerCase().includes(s) &&
          !t.customerName.toLowerCase().includes(s) &&
          !t.deviceModel.toLowerCase().includes(s) &&
          !t.deviceBrand.toLowerCase().includes(s)
        ) return false
      }
      if (ticketStatusFilter !== "all" && t.status !== ticketStatusFilter) return false
      if (ticketPriorityFilter !== "all" && t.priority !== ticketPriorityFilter) return false
      return true
    })
  }, [tickets, ticketSearch, ticketStatusFilter, ticketPriorityFilter])

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleFileClaim() {
    if (!claimWarranty || !claimIssue.trim()) return
    try {
      const created = await createWarrantyClaim(claimWarranty.id, {
        date: TODAY.toISOString().split("T")[0],
        issue: claimIssue.trim(),
        resolution: "",
        status: "Open",
      })
      setWarranties((prev) =>
        prev.map((w) =>
          w.id === claimWarranty.id
            ? { ...w, status: "Claimed" as const, claims: [...w.claims, created] }
            : w
        )
      )
      toast.success("Warranty claim filed successfully")
      setClaimWarranty(null)
      setClaimIssue("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to file warranty claim")
    }
  }

  async function handleCreateTicket() {
    if (!ntForm.customerName || !ntForm.deviceBrand || !ntForm.deviceModel || !ntForm.issue || !ntForm.technicianName) {
      toast.error("Please fill in all required fields")
      return
    }
    const ticketNum = `RPR-${new Date().getFullYear()}-${String(tickets.length + 1).padStart(4, "0")}`
    try {
      const created = await createRepairTicket(
        {
          ticketNumber: ticketNum,
          date: TODAY.toISOString().split("T")[0],
          customerId: `cust-new-${Date.now()}`,
          customerName: ntForm.customerName,
          customerPhone: ntForm.customerPhone,
          deviceBrand: ntForm.deviceBrand,
          deviceModel: ntForm.deviceModel,
          imei: ntForm.imei || undefined,
          issue: ntForm.issue,
          priority: ntForm.priority,
          status: "Received",
          estimatedCost: ntForm.estimatedCost ? Number(ntForm.estimatedCost) : 0,
          actualCost: 0,
          technicianName: ntForm.technicianName,
          receivedDate: TODAY.toISOString().split("T")[0],
          estimatedCompletionDate: ntForm.estimatedCompletionDate || undefined,
        },
        [],
      )
      setTickets((prev) => [created, ...prev])
      toast.success(`Ticket ${ticketNum} created`)
      setNewTicketOpen(false)
      setNtForm({
        customerName: "", customerPhone: "", deviceBrand: "", deviceModel: "",
        imei: "", issue: "", priority: "Medium", estimatedCost: "", technicianName: "",
        estimatedCompletionDate: "",
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create repair ticket")
    }
  }

  async function handleUpdateStatus(ticketId: string, newStatus: RepairStatus) {
    try {
      const updates: Partial<RepairTicket> = { status: newStatus }
      if (newStatus === "Repaired") updates.completedDate = TODAY.toISOString().split("T")[0]
      if (newStatus === "Delivered") updates.deliveredDate = TODAY.toISOString().split("T")[0]
      const updated = await updateRepairTicket(ticketId, updates)
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? updated : t))
      )
      toast.success(`Ticket status updated to ${newStatus}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update ticket status")
    }
  }

  async function handleSaveTicketEdits() {
    if (!editTicket) return
    try {
      const updated = await updateRepairTicket(editTicket.id, editTicket)
      setTickets((prev) => prev.map((t) => (t.id === editTicket.id ? updated : t)))
      toast.success("Ticket updated")
      setEditTicket(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update ticket")
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Warranty & Repairs"
        description="Track product warranties, file claims, and manage repair tickets"
        badge={
          <Badge variant="outline" className="text-xs font-medium">
            {warrantyStats.claimsOpen + ticketStats.activeRepairs} Active Items
          </Badge>
        }
      />

      <Tabs defaultValue="warranties" className="space-y-6">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="warranties" className="gap-1.5">
            <Shield className="w-4 h-4" />
            Warranties
          </TabsTrigger>
          <TabsTrigger value="repairs" className="gap-1.5">
            <Wrench className="w-4 h-4" />
            Repair Tickets
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            WARRANTIES TAB
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="warranties">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard title="Total Warranties" value={String(warrantyStats.total)} icon={Shield} iconBg="bg-blue-100" />
            <StatCard title="Active" value={String(warrantyStats.active)} icon={CheckCircle} iconBg="bg-emerald-100" />
            <StatCard title="Expiring Soon" value={String(warrantyStats.expiringSoon)} icon={AlertTriangle} iconBg="bg-amber-100" subtext="Within 30 days" />
            <StatCard title="Claims Open" value={String(warrantyStats.claimsOpen)} icon={FileText} iconBg="bg-red-100" />
          </div>

          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by product, customer, or IMEI..."
                    value={warrantySearch}
                    onChange={(e) => setWarrantySearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={warrantyStatusFilter} onValueChange={setWarrantyStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="Claimed">Claimed</SelectItem>
                    <SelectItem value="Voided">Voided</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Warranty Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>IMEI</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead>Warranty Period</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWarranties.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          No warranty records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredWarranties.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-medium">{w.productName}</TableCell>
                          <TableCell className="text-slate-500 font-mono text-xs">{w.imei || "—"}</TableCell>
                          <TableCell>{w.customerName}</TableCell>
                          <TableCell>{formatDate(w.purchaseDate)}</TableCell>
                          <TableCell>{w.warrantyMonths} months</TableCell>
                          <TableCell>
                            <span className={daysUntilExpiry(w.expiryDate) <= 30 && w.status === "Active" ? "text-amber-600 font-medium" : ""}>
                              {formatDate(w.expiryDate)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <CustomBadge label={w.status} colorClass={WARRANTY_STATUS_COLORS[w.status]} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setViewWarranty(w)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {w.status === "Active" && (
                                <Button variant="ghost" size="sm" onClick={() => setClaimWarranty(w)} className="text-amber-600 hover:text-amber-700">
                                  <FileText className="w-4 h-4" />
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            REPAIR TICKETS TAB
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="repairs">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard title="Total Tickets" value={String(ticketStats.total)} icon={Wrench} iconBg="bg-blue-100" />
            <StatCard title="Active Repairs" value={String(ticketStats.activeRepairs)} icon={Clock} iconBg="bg-amber-100" />
            <StatCard title="Urgent Priority" value={String(ticketStats.urgentCount)} icon={AlertTriangle} iconBg="bg-red-100" />
            <StatCard title="Repair Revenue" value={formatCurrency(ticketStats.revenue)} icon={DollarSign} iconBg="bg-emerald-100" />
          </div>

          {/* Filters + New Ticket button */}
          <Card className="mb-4">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by ticket #, customer, or device..."
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {ALL_REPAIR_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={ticketPriorityFilter} onValueChange={setTicketPriorityFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={() => setNewTicketOpen(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" />
                  New Repair Ticket
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Repair Tickets Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                          No repair tickets found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTickets.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-bold text-slate-900">{t.ticketNumber}</TableCell>
                          <TableCell>{formatDate(t.date)}</TableCell>
                          <TableCell>{t.customerName}</TableCell>
                          <TableCell>{t.deviceBrand} {t.deviceModel}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={t.issue}>{t.issue}</TableCell>
                          <TableCell>
                            <CustomBadge label={t.priority} colorClass={PRIORITY_COLORS[t.priority]} />
                          </TableCell>
                          <TableCell>
                            <CustomBadge label={t.status} colorClass={REPAIR_STATUS_COLORS[t.status]} />
                          </TableCell>
                          <TableCell>{t.actualCost > 0 ? formatCurrency(t.actualCost) : t.estimatedCost > 0 ? <span className="text-slate-400">{formatCurrency(t.estimatedCost)}</span> : "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setViewTicket(t)}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              {!TERMINAL_STATUSES.includes(t.status) && (
                                <Select onValueChange={(val) => handleUpdateStatus(t.id, val as RepairStatus)}>
                                  <SelectTrigger className="h-8 w-[130px] text-xs">
                                    <SelectValue placeholder="Update Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ALL_REPAIR_STATUSES.filter((s) => s !== t.status).map((s) => (
                                      <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => setEditTicket({ ...t })}>
                                <FileText className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIALOGS
      ═══════════════════════════════════════════════════════════════════════ */}

      {/* View Warranty Dialog */}
      <Dialog open={!!viewWarranty} onOpenChange={(open) => !open && setViewWarranty(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Warranty Details</DialogTitle>
            <DialogDescription>Full warranty information and claims history</DialogDescription>
          </DialogHeader>
          {viewWarranty && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Product</p>
                  <p className="text-sm font-medium">{viewWarranty.productName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Type</p>
                  <p className="text-sm font-medium">{viewWarranty.productType}</p>
                </div>
                {viewWarranty.imei && (
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">IMEI</p>
                    <p className="text-sm font-mono">{viewWarranty.imei}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Invoice</p>
                  <p className="text-sm font-medium">{viewWarranty.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Customer</p>
                  <p className="text-sm font-medium">{viewWarranty.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Phone</p>
                  <p className="text-sm font-medium">{viewWarranty.customerPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Purchase Date</p>
                  <p className="text-sm font-medium">{formatDate(viewWarranty.purchaseDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Warranty Period</p>
                  <p className="text-sm font-medium">{viewWarranty.warrantyMonths} months</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Expiry Date</p>
                  <p className="text-sm font-medium">{formatDate(viewWarranty.expiryDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Status</p>
                  <CustomBadge label={viewWarranty.status} colorClass={WARRANTY_STATUS_COLORS[viewWarranty.status]} />
                </div>
              </div>

              {/* Claims History */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Claims History ({viewWarranty.claims.length})</h4>
                {viewWarranty.claims.length === 0 ? (
                  <p className="text-sm text-slate-400">No claims filed</p>
                ) : (
                  <div className="space-y-3">
                    {viewWarranty.claims.map((claim) => (
                      <div key={claim.id} className="border border-slate-100 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs text-slate-500">{formatDate(claim.date)}</span>
                          <CustomBadge label={claim.status} colorClass={CLAIM_STATUS_COLORS[claim.status] || "bg-slate-100 text-slate-600 border border-slate-200"} />
                        </div>
                        <p className="text-sm font-medium text-slate-900 mb-1">{claim.issue}</p>
                        {claim.resolution && (
                          <p className="text-xs text-slate-600"><span className="font-medium">Resolution:</span> {claim.resolution}</p>
                        )}
                        {claim.notes && (
                          <p className="text-xs text-slate-500 mt-1">{claim.notes}</p>
                        )}
                        {claim.repairTicketId && (
                          <p className="text-xs text-blue-600 mt-1">Repair Ticket: {claim.repairTicketId}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* File Claim Dialog */}
      <Dialog open={!!claimWarranty} onOpenChange={(open) => { if (!open) { setClaimWarranty(null); setClaimIssue("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>File Warranty Claim</DialogTitle>
            <DialogDescription>
              {claimWarranty ? `${claimWarranty.productName} - ${claimWarranty.customerName}` : ""}
            </DialogDescription>
          </DialogHeader>
          {claimWarranty && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="claim-issue">Issue Description</Label>
                <Textarea
                  id="claim-issue"
                  placeholder="Describe the issue in detail..."
                  value={claimIssue}
                  onChange={(e) => setClaimIssue(e.target.value)}
                  rows={4}
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setClaimWarranty(null); setClaimIssue("") }}>
                  Cancel
                </Button>
                <Button onClick={handleFileClaim} disabled={!claimIssue.trim()}>
                  Submit Claim
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Ticket Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={(open) => !open && setViewTicket(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Repair Ticket: {viewTicket?.ticketNumber}</DialogTitle>
            <DialogDescription>Full repair ticket details and status timeline</DialogDescription>
          </DialogHeader>
          {viewTicket && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Customer</p>
                  <p className="text-sm font-medium">{viewTicket.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Phone</p>
                  <p className="text-sm font-medium">{viewTicket.customerPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Device</p>
                  <p className="text-sm font-medium">{viewTicket.deviceBrand} {viewTicket.deviceModel}</p>
                </div>
                {viewTicket.imei && (
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">IMEI</p>
                    <p className="text-sm font-mono">{viewTicket.imei}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-0.5">Issue</p>
                  <p className="text-sm font-medium">{viewTicket.issue}</p>
                </div>
                {viewTicket.diagnosis && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500 mb-0.5">Diagnosis</p>
                    <p className="text-sm">{viewTicket.diagnosis}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Priority</p>
                  <CustomBadge label={viewTicket.priority} colorClass={PRIORITY_COLORS[viewTicket.priority]} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Status</p>
                  <CustomBadge label={viewTicket.status} colorClass={REPAIR_STATUS_COLORS[viewTicket.status]} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Technician</p>
                  <p className="text-sm font-medium">{viewTicket.technicianName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Estimated Cost</p>
                  <p className="text-sm font-medium">{viewTicket.estimatedCost > 0 ? formatCurrency(viewTicket.estimatedCost) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Actual Cost</p>
                  <p className="text-sm font-medium">{viewTicket.actualCost > 0 ? formatCurrency(viewTicket.actualCost) : "—"}</p>
                </div>
                {viewTicket.warrantyClaimId && (
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Warranty Claim</p>
                    <p className="text-sm text-blue-600 font-medium">{viewTicket.warrantyClaimId}</p>
                  </div>
                )}
              </div>

              {/* Parts */}
              {viewTicket.parts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-2">Parts Used</h4>
                  <div className="border border-slate-100 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Part</TableHead>
                          <TableHead className="text-xs">Qty</TableHead>
                          <TableHead className="text-xs text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewTicket.parts.map((part, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{part.name}</TableCell>
                            <TableCell className="text-sm">{part.quantity}</TableCell>
                            <TableCell className="text-sm text-right">{formatCurrency(part.cost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Status Timeline */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-2">Status Timeline</h4>
                <div className="space-y-2">
                  {viewTicket.receivedDate && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs text-slate-500 w-20">{formatDate(viewTicket.receivedDate)}</span>
                      <span className="text-sm">Received</span>
                    </div>
                  )}
                  {viewTicket.estimatedCompletionDate && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-300" />
                      <span className="text-xs text-slate-500 w-20">{formatDate(viewTicket.estimatedCompletionDate)}</span>
                      <span className="text-sm text-slate-400">Est. Completion</span>
                    </div>
                  )}
                  {viewTicket.completedDate && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs text-slate-500 w-20">{formatDate(viewTicket.completedDate)}</span>
                      <span className="text-sm">Repaired</span>
                    </div>
                  )}
                  {viewTicket.deliveredDate && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-teal-500" />
                      <span className="text-xs text-slate-500 w-20">{formatDate(viewTicket.deliveredDate)}</span>
                      <span className="text-sm">Delivered</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {viewTicket.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">Notes</h4>
                  <p className="text-sm text-slate-600">{viewTicket.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Repair Ticket Dialog */}
      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Repair Ticket</DialogTitle>
            <DialogDescription>Create a new repair ticket for a customer device</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="nt-name">Customer Name *</Label>
                <Input id="nt-name" value={ntForm.customerName} onChange={(e) => setNtForm((f) => ({ ...f, customerName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="nt-phone">Phone</Label>
                <Input id="nt-phone" value={ntForm.customerPhone} onChange={(e) => setNtForm((f) => ({ ...f, customerPhone: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="nt-brand">Device Brand *</Label>
                <Input id="nt-brand" value={ntForm.deviceBrand} onChange={(e) => setNtForm((f) => ({ ...f, deviceBrand: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="nt-model">Device Model *</Label>
                <Input id="nt-model" value={ntForm.deviceModel} onChange={(e) => setNtForm((f) => ({ ...f, deviceModel: e.target.value }))} className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="nt-imei">IMEI (Optional)</Label>
                <Input id="nt-imei" value={ntForm.imei} onChange={(e) => setNtForm((f) => ({ ...f, imei: e.target.value }))} className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="nt-issue">Issue Description *</Label>
                <Textarea id="nt-issue" value={ntForm.issue} onChange={(e) => setNtForm((f) => ({ ...f, issue: e.target.value }))} rows={3} className="mt-1" />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={ntForm.priority} onValueChange={(v) => setNtForm((f) => ({ ...f, priority: v as RepairPriority }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="nt-cost">Estimated Cost</Label>
                <Input id="nt-cost" type="number" value={ntForm.estimatedCost} onChange={(e) => setNtForm((f) => ({ ...f, estimatedCost: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="nt-tech">Technician *</Label>
                <Input id="nt-tech" value={ntForm.technicianName} onChange={(e) => setNtForm((f) => ({ ...f, technicianName: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="nt-estdate">Est. Completion</Label>
                <Input id="nt-estdate" type="date" value={ntForm.estimatedCompletionDate} onChange={(e) => setNtForm((f) => ({ ...f, estimatedCompletionDate: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewTicketOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTicket}>Create Ticket</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Ticket Dialog */}
      <Dialog open={!!editTicket} onOpenChange={(open) => !open && setEditTicket(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Ticket: {editTicket?.ticketNumber}</DialogTitle>
            <DialogDescription>Update cost, diagnosis, and notes</DialogDescription>
          </DialogHeader>
          {editTicket && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-diagnosis">Diagnosis</Label>
                <Textarea
                  id="edit-diagnosis"
                  value={editTicket.diagnosis || ""}
                  onChange={(e) => setEditTicket({ ...editTicket, diagnosis: e.target.value })}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-est-cost">Estimated Cost</Label>
                  <Input
                    id="edit-est-cost"
                    type="number"
                    value={editTicket.estimatedCost}
                    onChange={(e) => setEditTicket({ ...editTicket, estimatedCost: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-act-cost">Actual Cost</Label>
                  <Input
                    id="edit-act-cost"
                    type="number"
                    value={editTicket.actualCost}
                    onChange={(e) => setEditTicket({ ...editTicket, actualCost: Number(e.target.value) })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={editTicket.notes || ""}
                  onChange={(e) => setEditTicket({ ...editTicket, notes: e.target.value })}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditTicket(null)}>Cancel</Button>
                <Button onClick={handleSaveTicketEdits}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Shield, Wrench, Search, Plus, Eye, FileText, Clock,
  AlertTriangle, CheckCircle, DollarSign, Package, User, Phone, Calendar, Hash,
} from "lucide-react"
import { toast } from "sonner"

import { getWarrantyRecords, createWarrantyClaim, getRepairTickets, createRepairTicket, updateRepairTicket } from "@/lib/api/warranty"
import { WarrantyRecord, RepairTicket, RepairStatus, RepairPriority } from "@/data/types"
import { formatCurrency, formatDate } from "@/lib/utils"

import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// ── Helpers ───────────────────────────────────────────────────────────────────
const TODAY = new Date("2026-03-24")

function daysUntilExpiry(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24))
}

const WARRANTY_STATUS_COLORS: Record<string, string> = {
  Active:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Expired: "bg-red-50 text-red-700 border border-red-200",
  Claimed: "bg-amber-50 text-amber-700 border border-amber-200",
  Voided:  "bg-slate-100 text-slate-600 border border-slate-200",
}
const REPAIR_STATUS_COLORS: Record<RepairStatus, string> = {
  Received:        "bg-blue-50 text-blue-700 border border-blue-200",
  Diagnosing:      "bg-violet-50 text-violet-700 border border-violet-200",
  "In Repair":     "bg-amber-50 text-amber-700 border border-amber-200",
  "Waiting Parts": "bg-orange-50 text-orange-700 border border-orange-200",
  Repaired:        "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Delivered:       "bg-teal-50 text-teal-700 border border-teal-200",
  Cancelled:       "bg-red-50 text-red-700 border border-red-200",
}
const PRIORITY_COLORS: Record<RepairPriority, string> = {
  Low:    "bg-slate-100 text-slate-600 border border-slate-200",
  Medium: "bg-blue-50 text-blue-700 border border-blue-200",
  High:   "bg-amber-50 text-amber-700 border border-amber-200",
  Urgent: "bg-red-50 text-red-700 border border-red-200",
}
const CLAIM_STATUS_COLORS: Record<string, string> = {
  Open:          "bg-blue-50 text-blue-700 border border-blue-200",
  "In Progress": "bg-amber-50 text-amber-700 border border-amber-200",
  Resolved:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Rejected:      "bg-red-50 text-red-700 border border-red-200",
}

const TERMINAL_STATUSES: RepairStatus[] = ["Delivered", "Cancelled"]
const ALL_REPAIR_STATUSES: RepairStatus[] = ["Received", "Diagnosing", "In Repair", "Waiting Parts", "Repaired", "Delivered", "Cancelled"]

function Chip({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${colorClass}`}>
      {label}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WarrantyPage() {
  const [warranties, setWarranties] = useState<WarrantyRecord[]>([])
  const [tickets, setTickets]       = useState<RepairTicket[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [warrantyData, ticketData] = await Promise.all([getWarrantyRecords(), getRepairTickets()])
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

  const [warrantySearch, setWarrantySearch]           = useState("")
  const [ticketSearch, setTicketSearch]               = useState("")
  const [warrantyStatusFilter, setWarrantyStatusFilter] = useState("all")
  const [ticketStatusFilter, setTicketStatusFilter]   = useState("all")
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("all")

  const [viewWarranty, setViewWarranty]   = useState<WarrantyRecord | null>(null)
  const [claimWarranty, setClaimWarranty] = useState<WarrantyRecord | null>(null)
  const [claimIssue, setClaimIssue]       = useState("")
  const [viewTicket, setViewTicket]       = useState<RepairTicket | null>(null)
  const [newTicketOpen, setNewTicketOpen] = useState(false)
  const [editTicket, setEditTicket]       = useState<RepairTicket | null>(null)

  const [ntForm, setNtForm] = useState({
    customerName: "", customerPhone: "", deviceBrand: "", deviceModel: "",
    imei: "", issue: "", priority: "Medium" as RepairPriority,
    estimatedCost: "", technicianName: "", estimatedCompletionDate: "",
  })

  const warrantyStats = useMemo(() => ({
    total:       warranties.length,
    active:      warranties.filter((w) => w.status === "Active").length,
    expiringSoon: warranties.filter((w) => w.status === "Active" && daysUntilExpiry(w.expiryDate) <= 30 && daysUntilExpiry(w.expiryDate) > 0).length,
    claimsOpen:  warranties.reduce((acc, w) => acc + w.claims.filter((c) => c.status === "Open" || c.status === "In Progress").length, 0),
  }), [warranties])

  const ticketStats = useMemo(() => ({
    total:        tickets.length,
    activeRepairs: tickets.filter((t) => !TERMINAL_STATUSES.includes(t.status)).length,
    urgentCount:  tickets.filter((t) => t.priority === "Urgent").length,
    revenue:      tickets.reduce((acc, t) => acc + t.actualCost, 0),
  }), [tickets])

  const filteredWarranties = useMemo(() => warranties.filter((w) => {
    if (warrantySearch) {
      const s = warrantySearch.toLowerCase()
      if (!w.productName.toLowerCase().includes(s) && !w.customerName.toLowerCase().includes(s) && !(w.imei && w.imei.includes(s))) return false
    }
    if (warrantyStatusFilter !== "all" && w.status !== warrantyStatusFilter) return false
    return true
  }), [warranties, warrantySearch, warrantyStatusFilter])

  const filteredTickets = useMemo(() => tickets.filter((t) => {
    if (ticketSearch) {
      const s = ticketSearch.toLowerCase()
      if (!t.ticketNumber.toLowerCase().includes(s) && !t.customerName.toLowerCase().includes(s) && !t.deviceModel.toLowerCase().includes(s) && !t.deviceBrand.toLowerCase().includes(s)) return false
    }
    if (ticketStatusFilter !== "all" && t.status !== ticketStatusFilter) return false
    if (ticketPriorityFilter !== "all" && t.priority !== ticketPriorityFilter) return false
    return true
  }), [tickets, ticketSearch, ticketStatusFilter, ticketPriorityFilter])

  async function handleFileClaim() {
    if (!claimWarranty || !claimIssue.trim()) return
    try {
      const created = await createWarrantyClaim(claimWarranty.id, { date: TODAY.toISOString().split("T")[0], issue: claimIssue.trim(), resolution: "", status: "Open" })
      setWarranties((prev) => prev.map((w) => w.id === claimWarranty.id ? { ...w, status: "Claimed" as const, claims: [...w.claims, created] } : w))
      toast.success("Warranty claim filed successfully")
      setClaimWarranty(null); setClaimIssue("")
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to file warranty claim") }
  }

  async function handleCreateTicket() {
    if (!ntForm.customerName || !ntForm.deviceBrand || !ntForm.deviceModel || !ntForm.issue || !ntForm.technicianName) { toast.error("Please fill in all required fields"); return }
    const ticketNum = `RPR-${new Date().getFullYear()}-${String(tickets.length + 1).padStart(4, "0")}`
    try {
      const created = await createRepairTicket({
        ticketNumber: ticketNum, date: TODAY.toISOString().split("T")[0], customerId: `cust-new-${Date.now()}`,
        customerName: ntForm.customerName, customerPhone: ntForm.customerPhone, deviceBrand: ntForm.deviceBrand,
        deviceModel: ntForm.deviceModel, imei: ntForm.imei || undefined, issue: ntForm.issue, priority: ntForm.priority,
        status: "Received", estimatedCost: ntForm.estimatedCost ? Number(ntForm.estimatedCost) : 0, actualCost: 0,
        technicianName: ntForm.technicianName, receivedDate: TODAY.toISOString().split("T")[0],
        estimatedCompletionDate: ntForm.estimatedCompletionDate || undefined,
      }, [])
      setTickets((prev) => [created, ...prev])
      toast.success(`Ticket ${ticketNum} created`)
      setNewTicketOpen(false)
      setNtForm({ customerName: "", customerPhone: "", deviceBrand: "", deviceModel: "", imei: "", issue: "", priority: "Medium", estimatedCost: "", technicianName: "", estimatedCompletionDate: "" })
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create repair ticket") }
  }

  async function handleUpdateStatus(ticketId: string, newStatus: RepairStatus) {
    try {
      const updates: Partial<RepairTicket> = { status: newStatus }
      if (newStatus === "Repaired")  updates.completedDate = TODAY.toISOString().split("T")[0]
      if (newStatus === "Delivered") updates.deliveredDate = TODAY.toISOString().split("T")[0]
      const updated = await updateRepairTicket(ticketId, updates)
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updated : t)))
      toast.success(`Status updated to ${newStatus}`)
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update ticket status") }
  }

  async function handleSaveTicketEdits() {
    if (!editTicket) return
    try {
      const updated = await updateRepairTicket(editTicket.id, editTicket)
      setTickets((prev) => prev.map((t) => (t.id === editTicket.id ? updated : t)))
      toast.success("Ticket updated"); setEditTicket(null)
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update ticket") }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Warranty & Repairs</h1>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {warrantyStats.claimsOpen + ticketStats.activeRepairs} active
          </span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="warranties" className="space-y-3">
        <TabsList className="h-8 p-0.5">
          <TabsTrigger value="warranties" className="h-7 text-xs gap-1.5 px-3">
            <Shield className="w-3.5 h-3.5" />Warranties
          </TabsTrigger>
          <TabsTrigger value="repairs" className="h-7 text-xs gap-1.5 px-3">
            <Wrench className="w-3.5 h-3.5" />Repair Tickets
          </TabsTrigger>
        </TabsList>

        {/* ══ WARRANTIES TAB ══════════════════════════════════════════════════ */}
        <TabsContent value="warranties" className="space-y-3 mt-0">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <StatCard title="Total Warranties" value={String(warrantyStats.total)}       icon={Shield}        iconBg="bg-blue-100" />
            <StatCard title="Active"            value={String(warrantyStats.active)}      icon={CheckCircle}   iconBg="bg-emerald-100" />
            <StatCard title="Expiring Soon"     value={String(warrantyStats.expiringSoon)} icon={AlertTriangle} iconBg="bg-amber-100" subtext="Within 30 days" />
            <StatCard title="Claims Open"       value={String(warrantyStats.claimsOpen)}  icon={FileText}      iconBg="bg-red-100" />
          </div>

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input placeholder="Search by product, customer, or IMEI..." value={warrantySearch}
                onChange={(e) => setWarrantySearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <Select value={warrantyStatusFilter} onValueChange={setWarrantyStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-full sm:w-36">
                <SelectValue placeholder="All Statuses" />
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

          {/* Warranty Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Product Name</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">IMEI</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Customer</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Purchase Date</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Period</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Expiry</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWarranties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-xs text-slate-400">
                        <Shield className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                        No warranty records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWarranties.map((w) => (
                      <TableRow key={w.id} className="hover:bg-slate-50">
                        <TableCell className="text-xs font-semibold text-slate-900 px-3 py-2">{w.productName}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-mono px-3 py-2">{w.imei || "—"}</TableCell>
                        <TableCell className="text-xs text-slate-700 px-3 py-2">{w.customerName}</TableCell>
                        <TableCell className="text-xs text-slate-600 px-3 py-2 whitespace-nowrap">{formatDate(w.purchaseDate)}</TableCell>
                        <TableCell className="text-xs text-slate-600 px-3 py-2 whitespace-nowrap">{w.warrantyMonths}mo</TableCell>
                        <TableCell className="px-3 py-2 whitespace-nowrap">
                          <span className={`text-xs ${daysUntilExpiry(w.expiryDate) <= 30 && w.status === "Active" ? "text-amber-600 font-semibold" : "text-slate-600"}`}>
                            {formatDate(w.expiryDate)}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Chip label={w.status} colorClass={WARRANTY_STATUS_COLORS[w.status]} />
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => setViewWarranty(w)}
                              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {w.status === "Active" && (
                              <button onClick={() => setClaimWarranty(w)}
                                className="p-1 rounded-md hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ══ REPAIR TICKETS TAB ════════════════════════════════════════════════ */}
        <TabsContent value="repairs" className="space-y-3 mt-0">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <StatCard title="Total Tickets"   value={String(ticketStats.total)}        icon={Wrench}        iconBg="bg-blue-100" />
            <StatCard title="Active Repairs"  value={String(ticketStats.activeRepairs)} icon={Clock}         iconBg="bg-amber-100" />
            <StatCard title="Urgent Priority" value={String(ticketStats.urgentCount)}   icon={AlertTriangle} iconBg="bg-red-100" />
            <StatCard title="Repair Revenue"  value={formatCurrency(ticketStats.revenue)} icon={DollarSign}  iconBg="bg-emerald-100" />
          </div>

          {/* Filter bar + New Ticket */}
          <div className="flex flex-wrap gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2.5 items-center">
            <div className="relative flex-1 min-w-45">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input placeholder="Search by ticket #, customer, or device..." value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)} className="pl-8 h-8 text-xs" />
            </div>
            <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ALL_REPAIR_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ticketPriorityFilter} onValueChange={setTicketPriorityFilter}>
              <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All Priorities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {["Low", "Medium", "High", "Urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setNewTicketOpen(true)} className="h-8 text-xs gap-1.5 px-3 ml-auto">
              <Plus className="w-3.5 h-3.5" />New Ticket
            </Button>
          </div>

          {/* Repair Tickets Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Ticket #</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Date</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Customer</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Device</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Issue</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Priority</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 whitespace-nowrap">Cost</TableHead>
                    <TableHead className="text-[10px] font-semibold text-slate-500 uppercase px-3 py-2 text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-xs text-slate-400">
                        <Wrench className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                        No repair tickets found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTickets.map((t) => (
                      <TableRow key={t.id} className="hover:bg-slate-50">
                        <TableCell className="text-xs font-bold text-slate-900 px-3 py-2 whitespace-nowrap">{t.ticketNumber}</TableCell>
                        <TableCell className="text-xs text-slate-600 px-3 py-2 whitespace-nowrap">{formatDate(t.date)}</TableCell>
                        <TableCell className="text-xs text-slate-700 px-3 py-2">{t.customerName}</TableCell>
                        <TableCell className="text-xs text-slate-700 px-3 py-2 whitespace-nowrap">{t.deviceBrand} {t.deviceModel}</TableCell>
                        <TableCell className="text-xs text-slate-600 px-3 py-2 max-w-40 truncate" title={t.issue}>{t.issue}</TableCell>
                        <TableCell className="px-3 py-2">
                          <Chip label={t.priority} colorClass={PRIORITY_COLORS[t.priority]} />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Chip label={t.status} colorClass={REPAIR_STATUS_COLORS[t.status]} />
                        </TableCell>
                        <TableCell className="text-xs px-3 py-2 whitespace-nowrap">
                          {t.actualCost > 0
                            ? <span className="font-semibold text-slate-900">{formatCurrency(t.actualCost)}</span>
                            : t.estimatedCost > 0
                            ? <span className="text-slate-400">{formatCurrency(t.estimatedCost)}</span>
                            : "—"}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => setViewTicket(t)}
                              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {!TERMINAL_STATUSES.includes(t.status) && (
                              <Select onValueChange={(val) => handleUpdateStatus(t.id, val as RepairStatus)}>
                                <SelectTrigger className="h-7 w-28 text-[10px] border-slate-200">
                                  <SelectValue placeholder="Update" />
                                </SelectTrigger>
                                <SelectContent>
                                  {ALL_REPAIR_STATUSES.filter((s) => s !== t.status).map((s) => (
                                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <button onClick={() => setEditTicket({ ...t })}
                              className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══ DIALOGS ════════════════════════════════════════════════════════════ */}

      {/* View Warranty */}
      <Dialog open={!!viewWarranty} onOpenChange={(open) => !open && setViewWarranty(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Warranty Details</DialogTitle>
            <DialogDescription className="text-xs">Full warranty information and claims history</DialogDescription>
          </DialogHeader>
          {viewWarranty && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Product",       viewWarranty.productName],
                  ["Type",          viewWarranty.productType],
                  ...(viewWarranty.imei ? [["IMEI", viewWarranty.imei]] : []),
                  ["Invoice",       viewWarranty.invoiceNumber],
                  ["Customer",      viewWarranty.customerName],
                  ["Phone",         viewWarranty.customerPhone],
                  ["Purchase Date", formatDate(viewWarranty.purchaseDate)],
                  ["Period",        `${viewWarranty.warrantyMonths} months`],
                  ["Expiry",        formatDate(viewWarranty.expiryDate)],
                ].map(([label, val]) => (
                  <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-xs font-semibold text-slate-800">{val}</p>
                  </div>
                ))}
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Status</p>
                  <Chip label={viewWarranty.status} colorClass={WARRANTY_STATUS_COLORS[viewWarranty.status]} />
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-800 mb-2">Claims History ({viewWarranty.claims.length})</h4>
                {viewWarranty.claims.length === 0 ? (
                  <p className="text-xs text-slate-400">No claims filed</p>
                ) : (
                  <div className="space-y-2">
                    {viewWarranty.claims.map((claim) => (
                      <div key={claim.id} className="border border-slate-100 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-slate-500">{formatDate(claim.date)}</span>
                          <Chip label={claim.status} colorClass={CLAIM_STATUS_COLORS[claim.status] || "bg-slate-100 text-slate-600 border border-slate-200"} />
                        </div>
                        <p className="text-xs font-semibold text-slate-900">{claim.issue}</p>
                        {claim.resolution && <p className="text-[10px] text-slate-600 mt-0.5"><span className="font-medium">Resolution:</span> {claim.resolution}</p>}
                        {claim.notes && <p className="text-[10px] text-slate-500 mt-0.5">{claim.notes}</p>}
                        {claim.repairTicketId && <p className="text-[10px] text-blue-600 mt-0.5">Ticket: {claim.repairTicketId}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* File Claim */}
      <Dialog open={!!claimWarranty} onOpenChange={(open) => { if (!open) { setClaimWarranty(null); setClaimIssue("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">File Warranty Claim</DialogTitle>
            <DialogDescription className="text-xs">{claimWarranty ? `${claimWarranty.productName} — ${claimWarranty.customerName}` : ""}</DialogDescription>
          </DialogHeader>
          {claimWarranty && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="claim-issue" className="text-xs">Issue Description</Label>
                <Textarea id="claim-issue" placeholder="Describe the issue in detail..." value={claimIssue}
                  onChange={(e) => setClaimIssue(e.target.value)} rows={3} className="mt-1 text-xs resize-none" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setClaimWarranty(null); setClaimIssue("") }}>Cancel</Button>
                <Button size="sm" className="h-8 text-xs" onClick={handleFileClaim} disabled={!claimIssue.trim()}>Submit Claim</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Ticket */}
      <Dialog open={!!viewTicket} onOpenChange={(open) => !open && setViewTicket(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Repair Ticket: {viewTicket?.ticketNumber}</DialogTitle>
            <DialogDescription className="text-xs">Full repair ticket details and status timeline</DialogDescription>
          </DialogHeader>
          {viewTicket && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Customer",    viewTicket.customerName],
                  ["Phone",       viewTicket.customerPhone],
                  ["Device",      `${viewTicket.deviceBrand} ${viewTicket.deviceModel}`],
                  ...(viewTicket.imei ? [["IMEI", viewTicket.imei]] : []),
                  ["Technician",  viewTicket.technicianName],
                  ["Est. Cost",   viewTicket.estimatedCost > 0 ? formatCurrency(viewTicket.estimatedCost) : "—"],
                  ["Actual Cost", viewTicket.actualCost > 0 ? formatCurrency(viewTicket.actualCost) : "—"],
                ].map(([label, val]) => (
                  <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-xs font-semibold text-slate-800">{val}</p>
                  </div>
                ))}
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Priority</p>
                  <Chip label={viewTicket.priority} colorClass={PRIORITY_COLORS[viewTicket.priority]} />
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Status</p>
                  <Chip label={viewTicket.status} colorClass={REPAIR_STATUS_COLORS[viewTicket.status]} />
                </div>
                <div className="col-span-2 bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Issue</p>
                  <p className="text-xs font-semibold text-slate-800">{viewTicket.issue}</p>
                </div>
                {viewTicket.diagnosis && (
                  <div className="col-span-2 bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Diagnosis</p>
                    <p className="text-xs text-slate-700">{viewTicket.diagnosis}</p>
                  </div>
                )}
              </div>
              {viewTicket.parts.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 mb-1.5">Parts Used</h4>
                  <div className="border border-slate-100 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="text-[10px] px-3 py-1.5">Part</TableHead>
                          <TableHead className="text-[10px] px-3 py-1.5">Qty</TableHead>
                          <TableHead className="text-[10px] px-3 py-1.5 text-right">Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewTicket.parts.map((part, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs px-3 py-1.5">{part.name}</TableCell>
                            <TableCell className="text-xs px-3 py-1.5">{part.quantity}</TableCell>
                            <TableCell className="text-xs px-3 py-1.5 text-right">{formatCurrency(part.cost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-xs font-semibold text-slate-800 mb-1.5">Status Timeline</h4>
                <div className="space-y-1.5">
                  {[
                    { date: viewTicket.receivedDate,            label: "Received",       color: "bg-blue-500"    },
                    { date: viewTicket.estimatedCompletionDate, label: "Est. Completion", color: "bg-slate-300"  },
                    { date: viewTicket.completedDate,           label: "Repaired",        color: "bg-emerald-500" },
                    { date: viewTicket.deliveredDate,           label: "Delivered",       color: "bg-teal-500"   },
                  ].filter(e => e.date).map((e) => (
                    <div key={e.label} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${e.color}`} />
                      <span className="text-[10px] text-slate-500 w-20">{formatDate(e.date!)}</span>
                      <span className="text-xs text-slate-700">{e.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {viewTicket.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 mb-1">Notes</h4>
                  <p className="text-xs text-slate-600">{viewTicket.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Ticket */}
      <Dialog open={newTicketOpen} onOpenChange={setNewTicketOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">New Repair Ticket</DialogTitle>
            <DialogDescription className="text-xs">Create a new repair ticket for a customer device</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "nt-name",   label: "Customer Name *", key: "customerName",   type: "text"   },
                { id: "nt-phone",  label: "Phone",           key: "customerPhone",  type: "text"   },
                { id: "nt-brand",  label: "Device Brand *",  key: "deviceBrand",    type: "text"   },
                { id: "nt-model",  label: "Device Model *",  key: "deviceModel",    type: "text"   },
              ].map(({ id, label, key, type }) => (
                <div key={id}>
                  <Label htmlFor={id} className="text-xs">{label}</Label>
                  <Input id={id} type={type} className="h-8 text-xs mt-1"
                    value={(ntForm as any)[key]}
                    onChange={(e) => setNtForm((f) => ({ ...f, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="col-span-2">
                <Label htmlFor="nt-imei" className="text-xs">IMEI (Optional)</Label>
                <Input id="nt-imei" className="h-8 text-xs mt-1" value={ntForm.imei}
                  onChange={(e) => setNtForm((f) => ({ ...f, imei: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label htmlFor="nt-issue" className="text-xs">Issue Description *</Label>
                <Textarea id="nt-issue" className="text-xs mt-1 resize-none" rows={2} value={ntForm.issue}
                  onChange={(e) => setNtForm((f) => ({ ...f, issue: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={ntForm.priority} onValueChange={(v) => setNtForm((f) => ({ ...f, priority: v as RepairPriority }))}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Low", "Medium", "High", "Urgent"].map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="nt-cost" className="text-xs">Estimated Cost</Label>
                <Input id="nt-cost" type="number" className="h-8 text-xs mt-1" value={ntForm.estimatedCost}
                  onChange={(e) => setNtForm((f) => ({ ...f, estimatedCost: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="nt-tech" className="text-xs">Technician *</Label>
                <Input id="nt-tech" className="h-8 text-xs mt-1" value={ntForm.technicianName}
                  onChange={(e) => setNtForm((f) => ({ ...f, technicianName: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="nt-estdate" className="text-xs">Est. Completion</Label>
                <Input id="nt-estdate" type="date" className="h-8 text-xs mt-1" value={ntForm.estimatedCompletionDate}
                  onChange={(e) => setNtForm((f) => ({ ...f, estimatedCompletionDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setNewTicketOpen(false)}>Cancel</Button>
              <Button size="sm" className="h-8 text-xs" onClick={handleCreateTicket}>Create Ticket</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Ticket */}
      <Dialog open={!!editTicket} onOpenChange={(open) => !open && setEditTicket(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Edit Ticket: {editTicket?.ticketNumber}</DialogTitle>
            <DialogDescription className="text-xs">Update cost, diagnosis, and notes</DialogDescription>
          </DialogHeader>
          {editTicket && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="edit-diagnosis" className="text-xs">Diagnosis</Label>
                <Textarea id="edit-diagnosis" rows={2} className="text-xs mt-1 resize-none"
                  value={editTicket.diagnosis || ""}
                  onChange={(e) => setEditTicket({ ...editTicket, diagnosis: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="edit-est-cost" className="text-xs">Estimated Cost</Label>
                  <Input id="edit-est-cost" type="number" className="h-8 text-xs mt-1"
                    value={editTicket.estimatedCost}
                    onChange={(e) => setEditTicket({ ...editTicket, estimatedCost: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="edit-act-cost" className="text-xs">Actual Cost</Label>
                  <Input id="edit-act-cost" type="number" className="h-8 text-xs mt-1"
                    value={editTicket.actualCost}
                    onChange={(e) => setEditTicket({ ...editTicket, actualCost: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-notes" className="text-xs">Notes</Label>
                <Textarea id="edit-notes" rows={2} className="text-xs mt-1 resize-none"
                  value={editTicket.notes || ""}
                  onChange={(e) => setEditTicket({ ...editTicket, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditTicket(null)}>Cancel</Button>
                <Button size="sm" className="h-8 text-xs" onClick={handleSaveTicketEdits}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

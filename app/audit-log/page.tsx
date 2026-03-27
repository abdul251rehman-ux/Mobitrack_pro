"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Search, X, Download, Filter, RotateCcw,
  Activity, Users, ShieldAlert, CalendarDays,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Clock, Eye,
} from "lucide-react"
import { format, parseISO, startOfDay } from "date-fns"
import { toast } from "sonner"

import { getAuditLogs } from "@/lib/api/audit"
import { AuditLog, AuditAction, AuditModule } from "@/data/types"
import { cn } from "@/lib/utils"
import { exportToCSV } from "@/lib/csv-export"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"

// ─── Constants ──────────────────────────────────────────────────────────────

const TODAY = "2026-03-24"
const ITEMS_PER_PAGE = 20

const ALL_ACTIONS: AuditAction[] = [
  "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT",
  "SALE", "REFUND", "PURCHASE", "PAYMENT",
  "STOCK_ADJUST", "PRICE_CHANGE", "EXPORT", "SETTINGS_CHANGE",
]

const ALL_MODULES: AuditModule[] = [
  "Sales", "Purchases", "Products", "Customers", "Suppliers",
  "Inventory", "Expenses", "Settings", "Auth", "Returns", "Warranty", "Payments",
]

const CRITICAL_ACTIONS: AuditAction[] = ["DELETE", "REFUND", "SETTINGS_CHANGE"]

const ACTION_COLORS: Record<AuditAction, { text: string; bg: string; border: string }> = {
  CREATE:          { text: "text-green-700",   bg: "bg-green-50",   border: "border-green-200"   },
  UPDATE:          { text: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200"    },
  DELETE:          { text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200"     },
  LOGIN:           { text: "text-slate-700",   bg: "bg-slate-50",   border: "border-slate-200"   },
  SALE:            { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  REFUND:          { text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200"   },
  PURCHASE:        { text: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200"  },
  PAYMENT:         { text: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200"    },
  STOCK_ADJUST:    { text: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200"  },
  PRICE_CHANGE:    { text: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200"  },
  EXPORT:          { text: "text-cyan-700",    bg: "bg-cyan-50",    border: "border-cyan-200"    },
  SETTINGS_CHANGE: { text: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200"    },
  LOGOUT:          { text: "text-gray-700",    bg: "bg-gray-50",    border: "border-gray-200"    },
}

const MODULE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Sales:      { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  Purchases:  { text: "text-indigo-700",  bg: "bg-indigo-50",  border: "border-indigo-200"  },
  Products:   { text: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200"    },
  Customers:  { text: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200"  },
  Suppliers:  { text: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200"  },
  Inventory:  { text: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200"   },
  Expenses:   { text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200"     },
  Settings:   { text: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-200"    },
  Auth:       { text: "text-slate-700",   bg: "bg-slate-100",  border: "border-slate-200"   },
  Returns:    { text: "text-pink-700",    bg: "bg-pink-50",    border: "border-pink-200"    },
  Warranty:   { text: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200"    },
  Payments:   { text: "text-cyan-700",    bg: "bg-cyan-50",    border: "border-cyan-200"    },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  return format(new Date(ts), "dd MMM yyyy, h:mm a")
}

function isToday(ts: string): boolean {
  const d = startOfDay(new Date(ts))
  const t = startOfDay(parseISO(TODAY))
  return d.getTime() === t.getTime()
}

function tryFormatJSON(value: string | undefined): string {
  if (!value) return ""
  try {
    const parsed = JSON.parse(value)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return value
  }
}

// ─── Page Component ─────────────────────────────────────────────────────────

export default function AuditLogPage() {
  // ── Data state ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    async function load() {
      try {
        const data = await getAuditLogs()
        setLogs(data)
      } catch (err) {
        toast.error("Failed to load audit logs")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Filter state ────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [moduleFilter, setModuleFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  // ── UI state ────────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null)

  // ── Unique users ────────────────────────────────────────────────────────────
  const uniqueUsers = useMemo(() => {
    const names = new Set(logs.map((l) => l.userName))
    return Array.from(names).sort()
  }, [logs])

  // ── Filtered + sorted ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...logs]

    // Search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.description.toLowerCase().includes(q) ||
          l.userName.toLowerCase().includes(q) ||
          (l.entityName && l.entityName.toLowerCase().includes(q))
      )
    }

    // Action filter
    if (actionFilter !== "all") {
      result = result.filter((l) => l.action === actionFilter)
    }

    // Module filter
    if (moduleFilter !== "all") {
      result = result.filter((l) => l.module === moduleFilter)
    }

    // User filter
    if (userFilter !== "all") {
      result = result.filter((l) => l.userName === userFilter)
    }

    // Date range
    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom))
      result = result.filter((l) => new Date(l.timestamp) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59.999Z")
      result = result.filter((l) => new Date(l.timestamp) <= to)
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return result
  }, [logs, search, actionFilter, moduleFilter, userFilter, dateFrom, dateTo])

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginatedLogs = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = logs.length
    const todayCount = logs.filter((l) => isToday(l.timestamp)).length
    const uniqueUserCount = new Set(logs.map((l) => l.userName)).size
    const criticalCount = logs.filter((l) => CRITICAL_ACTIONS.includes(l.action)).length
    return { total, todayCount, uniqueUserCount, criticalCount }
  }, [logs])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function clearFilters() {
    setSearch("")
    setActionFilter("all")
    setModuleFilter("all")
    setUserFilter("all")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  function handleExport() {
    if (filtered.length === 0) {
      toast.error("No data to export")
      return
    }
    exportToCSV(
      filtered.map((l) => ({
        timestamp: formatTimestamp(l.timestamp),
        user: l.userName,
        role: l.userRole,
        action: l.action,
        module: l.module,
        entity: l.entityName ?? "",
        description: l.description,
        oldValue: l.oldValue ?? "",
        newValue: l.newValue ?? "",
        ipAddress: l.ipAddress ?? "",
      })),
      "audit-log-export",
      [
        { key: "timestamp", header: "Timestamp" },
        { key: "user", header: "User" },
        { key: "role", header: "Role" },
        { key: "action", header: "Action" },
        { key: "module", header: "Module" },
        { key: "entity", header: "Entity" },
        { key: "description", header: "Description" },
        { key: "oldValue", header: "Old Value" },
        { key: "newValue", header: "New Value" },
        { key: "ipAddress", header: "IP Address" },
      ]
    )
    toast.success(`Exported ${filtered.length} log entries`)
  }

  const hasActiveFilters = search || actionFilter !== "all" || moduleFilter !== "all" || userFilter !== "all" || dateFrom || dateTo

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading audit log...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <PageHeader
        title="Audit Log"
        description="Track all system activities, user actions, and data changes"
        badge={
          <Badge variant="outline" className="text-xs font-medium text-slate-500 border-slate-200">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </Badge>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard
          title="Total Activities"
          value={stats.total.toLocaleString()}
          icon={Activity}
          iconBg="bg-blue-100"
          subtext="All time"
        />
        <StatCard
          title="Today's Activities"
          value={stats.todayCount.toLocaleString()}
          icon={CalendarDays}
          iconBg="bg-emerald-100"
          subtext={format(parseISO(TODAY), "dd MMM yyyy")}
        />
        <StatCard
          title="Users Active"
          value={stats.uniqueUserCount.toLocaleString()}
          icon={Users}
          iconBg="bg-violet-100"
          subtext="Unique users"
        />
        <StatCard
          title="Critical Actions"
          value={stats.criticalCount.toLocaleString()}
          icon={ShieldAlert}
          iconBg="bg-red-100"
          subtext="Delete, Refund, Settings"
        />
      </div>

      {/* Filters */}
      <Card className="mb-6 border-slate-100 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search description, user, entity..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Action */}
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {ALL_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Module */}
            <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {ALL_MODULES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* User */}
            <Select value={userFilter} onValueChange={(v) => { setUserFilter(v); setPage(1) }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map((u) => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date From */}
            <div>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                className="h-9 text-sm"
                placeholder="From"
              />
            </div>

            {/* Date To */}
            <div>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                className="h-9 text-sm"
                placeholder="To"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 sm:col-span-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={handleExport}
              >
                <Download className="w-4 h-4" />
                Export Log
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 text-slate-500"
                  onClick={clearFilters}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Activity className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No audit entries found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="text-xs font-semibold text-slate-500 w-[180px]">Timestamp</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 w-[150px]">User</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 w-[130px]">Action</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 w-[110px]">Module</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 w-[150px]">Entity</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500">Description</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 w-[80px] text-center">Changes</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => {
                      const actionStyle = ACTION_COLORS[log.action]
                      const moduleStyle = MODULE_COLORS[log.module] ?? { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" }
                      const hasChanges = !!(log.oldValue || log.newValue)
                      const isExpanded = expandedRow === log.id

                      return (
                        <TableRow
                          key={log.id}
                          className={cn(
                            "cursor-pointer hover:bg-slate-50/60 transition-colors",
                            CRITICAL_ACTIONS.includes(log.action) && "bg-red-50/30"
                          )}
                          onClick={() => setDetailLog(log)}
                        >
                          <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {formatTimestamp(log.timestamp)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-medium text-slate-800">{log.userName}</span>
                              <Badge variant="outline" className="w-fit text-[10px] px-1.5 py-0 text-slate-500 border-slate-200">
                                {log.userRole}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] font-semibold px-2 py-0.5",
                                actionStyle.text, actionStyle.bg, actionStyle.border
                              )}
                            >
                              {log.action.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[11px] px-2 py-0.5",
                                moduleStyle.text, moduleStyle.bg, moduleStyle.border
                              )}
                            >
                              {log.module}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700 max-w-[150px] truncate">
                            {log.entityName ?? <span className="text-slate-300">--</span>}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 max-w-[250px]">
                            <span className="line-clamp-1">{log.description}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {hasChanges ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpandedRow(isExpanded ? null : log.id)
                                }}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                )}
                              </Button>
                            ) : (
                              <span className="text-slate-300 text-xs">--</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDetailLog(log)
                              }}
                            >
                              <Eye className="w-4 h-4 text-slate-400" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}

                    {/* Expanded changes row */}
                    {paginatedLogs.map((log) => {
                      if (expandedRow !== log.id || !(log.oldValue || log.newValue)) return null
                      return (
                        <TableRow key={`${log.id}-expanded`} className="bg-slate-50/50">
                          <TableCell colSpan={8} className="py-3 px-6">
                            <div className="flex flex-col sm:flex-row gap-4">
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-slate-500 mb-1.5">Old Value</p>
                                <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 font-mono whitespace-pre-wrap break-all">
                                  {tryFormatJSON(log.oldValue) || <span className="text-slate-400 italic">N/A</span>}
                                </div>
                              </div>
                              <div className="hidden sm:flex items-center text-slate-300 text-lg font-bold">&rarr;</div>
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-slate-500 mb-1.5">New Value</p>
                                <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700 font-mono whitespace-pre-wrap break-all">
                                  {tryFormatJSON(log.newValue) || <span className="text-slate-400 italic">N/A</span>}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}
                  &ndash;{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | "dots")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("dots")
                      acc.push(p)
                      return acc
                    }, [])
                    .map((item, idx) =>
                      item === "dots" ? (
                        <span key={`dots-${idx}`} className="px-1 text-xs text-slate-400">...</span>
                      ) : (
                        <Button
                          key={item}
                          variant={safePage === item ? "default" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0 text-xs"
                          onClick={() => setPage(item)}
                        >
                          {item}
                        </Button>
                      )
                    )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={(open) => { if (!open) setDetailLog(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Audit Log Detail</DialogTitle>
          </DialogHeader>

          {detailLog && (
            <div className="space-y-4 mt-2">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-0.5">Timestamp</p>
                  <p className="text-slate-700">{formatTimestamp(detailLog.timestamp)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-0.5">User</p>
                  <p className="text-slate-700">{detailLog.userName} <span className="text-slate-400">({detailLog.userRole})</span></p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-0.5">Action</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] font-semibold px-2 py-0.5",
                      ACTION_COLORS[detailLog.action].text,
                      ACTION_COLORS[detailLog.action].bg,
                      ACTION_COLORS[detailLog.action].border
                    )}
                  >
                    {detailLog.action.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-0.5">Module</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px] px-2 py-0.5",
                      (MODULE_COLORS[detailLog.module] ?? { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" }).text,
                      (MODULE_COLORS[detailLog.module] ?? { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" }).bg,
                      (MODULE_COLORS[detailLog.module] ?? { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200" }).border
                    )}
                  >
                    {detailLog.module}
                  </Badge>
                </div>
                {detailLog.entityName && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-0.5">Entity</p>
                    <p className="text-slate-700">{detailLog.entityName}</p>
                  </div>
                )}
                {detailLog.entityId && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-0.5">Entity ID</p>
                    <p className="text-slate-500 font-mono text-xs">{detailLog.entityId}</p>
                  </div>
                )}
                {detailLog.ipAddress && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-0.5">IP Address</p>
                    <p className="text-slate-500 font-mono text-xs">{detailLog.ipAddress}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-0.5">Log ID</p>
                  <p className="text-slate-500 font-mono text-xs">{detailLog.id}</p>
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">Description</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100">
                  {detailLog.description}
                </p>
              </div>

              {/* Changes */}
              {(detailLog.oldValue || detailLog.newValue) && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-2">Changes</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-red-500 mb-1">Old Value</p>
                      <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 font-mono whitespace-pre-wrap break-all min-h-[40px]">
                        {tryFormatJSON(detailLog.oldValue) || <span className="text-slate-400 italic">N/A</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-green-600 mb-1">New Value</p>
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-green-700 font-mono whitespace-pre-wrap break-all min-h-[40px]">
                        {tryFormatJSON(detailLog.newValue) || <span className="text-slate-400 italic">N/A</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

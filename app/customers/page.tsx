"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Plus, Eye, Pencil, Trash2, Search, Users,
  Phone, Mail, MapPin, StickyNote, Calendar, ShoppingBag, CreditCard, Building2,
  BookOpen, TrendingUp, AlertCircle,
} from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import Link from "next/link"

import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/api/customers"
import { Customer } from "@/data/types"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { DataTable } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatCard } from "@/components/shared/stat-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { formatCurrency, formatDate } from "@/lib/utils"

// â"€â"€ Zod schema â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(7, "Enter a valid phone number"),
  cnic: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  creditLimit: z.string().optional(),
  notes: z.string().optional(),
})
type CustomerForm = z.infer<typeof customerSchema>

// â"€â"€ Tier badge â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const tierColors: Record<string, string> = {
  Bronze:   "bg-orange-50 text-orange-700 border-orange-200",
  Silver:   "bg-slate-100 text-slate-600 border-slate-300",
  Gold:     "bg-amber-50 text-amber-700 border-amber-200",
  Platinum: "bg-slate-800 text-white border-slate-700",
}

// â"€â"€ Tier card config â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const tierCardConfig: Record<string, { dot: string; label: string; accent: string; ring: string; icon: string }> = {
  Platinum: { dot: "bg-slate-700",  label: "text-slate-600",  accent: "border-l-slate-700",  ring: "ring-slate-400",  icon: "â˜..." },
  Gold:     { dot: "bg-amber-400",  label: "text-amber-600",  accent: "border-l-amber-400",  ring: "ring-amber-400",  icon: "â˜..." },
  Silver:   { dot: "bg-slate-400",  label: "text-slate-500",  accent: "border-l-slate-400",  ring: "ring-slate-300",  icon: "â˜..." },
  Bronze:   { dot: "bg-orange-400", label: "text-orange-600", accent: "border-l-orange-400", ring: "ring-orange-300", icon: "â˜..." },
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${tierColors[tier] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {tier}
    </span>
  )
}

// â"€â"€ Avatar â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const avatarColors = [
  "bg-blue-600", "bg-violet-600", "bg-emerald-600", "bg-amber-600",
  "bg-rose-600",  "bg-cyan-600",   "bg-indigo-600",  "bg-teal-600",
  "bg-pink-600",  "bg-orange-600",
]

function CustomerAvatar({ name, id }: { name: string; id: string }) {
  const idx = parseInt(id.replace(/\D/g, ""), 10) % avatarColors.length
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${avatarColors[idx]}`}>
      {initials}
    </div>
  )
}

// â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const data = await getCustomers()
        setCustomers(data)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to fetch customers")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const [search, setSearch]         = useState("")
  const [tierFilter, setTierFilter] = useState("All")
  const [sortBy, setSortBy]         = useState("totalSpent")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<CustomerForm>({ resolver: zodResolver(customerSchema) })

  // â"€â"€ Filtered + sorted â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const filtered = useMemo(() => {
    let list = [...customers]
    if (search.trim()) {
      const q = search.toLowerCase().replace(/-/g, "")
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.cnic ?? "").replace(/-/g, "").toLowerCase().includes(q) ||
        (c.address ?? "").toLowerCase().includes(q)
      )
    }
    if (tierFilter !== "All") list = list.filter((c) => c.loyaltyTier === tierFilter)
    list.sort((a, b) => {
      if (sortBy === "totalSpent")    return b.totalSpent - a.totalSpent
      if (sortBy === "lastPurchase")  return new Date(b.lastPurchaseDate ?? 0).getTime() - new Date(a.lastPurchaseDate ?? 0).getTime()
      if (sortBy === "name")          return a.name.localeCompare(b.name)
      return 0
    })
    return list
  }, [customers, search, tierFilter, sortBy])

  function openAdd() {
    setEditTarget(null)
    reset({ name: "", phone: "", cnic: "", whatsapp: "", email: "", address: "", city: "", creditLimit: "", notes: "" })
    setDialogOpen(true)
  }
  function openEdit(customer: Customer) {
    setEditTarget(customer)
    reset({ name: customer.name, phone: customer.phone, cnic: customer.cnic ?? "", whatsapp: customer.whatsapp ?? "", email: customer.email ?? "", address: customer.address ?? "", city: customer.city ?? "", creditLimit: customer.creditLimit ? String(customer.creditLimit) : "", notes: customer.notes ?? "" })
    setDialogOpen(true)
  }

  async function onSubmit(data: CustomerForm) {
    try {
      const creditLimit = data.creditLimit ? parseFloat(data.creditLimit) : undefined
      const patch = {
        name: data.name, phone: data.phone,
        cnic: data.cnic || undefined,
        whatsapp: data.whatsapp || undefined,
        email: data.email || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        creditLimit,
        notes: data.notes || undefined,
      }
      if (editTarget) {
        const updated = await updateCustomer(editTarget.id, patch)
        setCustomers((prev) => prev.map((c) => (c.id === editTarget.id ? updated : c)))
        toast.success("Customer updated", { description: `${data.name}'s profile has been updated.` })
      } else {
        const created = await createCustomer({ ...patch, totalPurchases: 0, totalSpent: 0, loyaltyTier: "Bronze" })
        setCustomers((prev) => [created, ...prev])
        toast.success("Customer added", { description: `${data.name} has been added to your customer list.` })
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save customer")
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteCustomer(deleteTarget.id)
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      toast.success("Customer deleted", { description: `${deleteTarget.name} has been removed.` })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete customer")
    }
    setDeleteTarget(null)
  }

  // â"€â"€ Ledger â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  interface LedgerSale {
    id: string
    invoiceNumber: string
    date: string
    total: number
    amountReceived: number
    status: string
  }
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null)
  const [ledgerSales, setLedgerSales]       = useState<LedgerSale[]>([])
  const [ledgerLoading, setLedgerLoading]   = useState(false)

  async function openLedger(customer: Customer) {
    setLedgerCustomer(customer)
    setLedgerSales([])
    setLedgerLoading(true)
    try {
      const tenantId = await getTenantId()
      const { data, error } = await supabase
        .from("sales")
        .select("id, invoice_number, date, total, amount_received, status")
        .eq("tenant_id", tenantId)
        .eq("customer_id", customer.id)
        .order("date", { ascending: false })
      if (error) throw error
      setLedgerSales((data ?? []).map((r: any) => ({
        id: r.id,
        invoiceNumber: r.invoice_number,
        date: r.date,
        total: r.total ?? 0,
        amountReceived: r.amount_received ?? 0,
        status: r.status,
      })))
    } catch (err) {
      toast.error("Failed to load ledger")
    } finally {
      setLedgerLoading(false)
    }
  }

  // â"€â"€ Columns â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const columns: ColumnDef<Customer>[] = [
    {
      id: "avatar",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <CustomerAvatar name={row.original.name} id={row.original.id} />,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <div className="text-xs font-semibold text-slate-900">{row.original.name}</div>,
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <Phone className="w-3 h-3 text-slate-400" />
          {row.original.phone}
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.original.email
        return email ? (
          <div className="flex items-center gap-1 text-xs text-slate-600 max-w-[160px] truncate">
            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{email}</span>
          </div>
        ) : <span className="text-xs text-slate-400">-</span>
      },
    },
    {
      accessorKey: "totalPurchases",
      header: "Purchases",
      cell: ({ row }) => <div className="text-xs text-center font-medium text-slate-700">{row.original.totalPurchases}</div>,
    },
    {
      accessorKey: "totalSpent",
      header: "Total Spent",
      cell: ({ row }) => <div className="text-xs font-semibold text-slate-900">{formatCurrency(row.original.totalSpent)}</div>,
    },
    {
      accessorKey: "lastPurchaseDate",
      header: "Last Purchase",
      cell: ({ row }) => <div className="text-xs text-slate-600 whitespace-nowrap">{row.original.lastPurchaseDate ? formatDate(row.original.lastPurchaseDate) : "-"}</div>,
    },
    {
      accessorKey: "loyaltyTier",
      header: "Tier",
      cell: ({ row }) => <TierBadge tier={row.original.loyaltyTier} />,
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-0.5 justify-end">
          <Button variant="ghost" size="icon-sm" asChild title="View details">
            <Link href={`/customers/${row.original.id}`}>
              <Eye className="w-3.5 h-3.5 text-slate-500" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon-sm" title="Udhaar Ledger" onClick={() => openLedger(row.original)}>
            <BookOpen className="w-3.5 h-3.5 text-violet-500" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => openEdit(row.original)}>
            <Pencil className="w-3.5 h-3.5 text-slate-500" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => setDeleteTarget(row.original)}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </Button>
        </div>
      ),
    },
  ]

  // â"€â"€ Tier counts â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const tierCounts = useMemo(() => ({
    Platinum: customers.filter((c) => c.loyaltyTier === "Platinum").length,
    Gold:     customers.filter((c) => c.loyaltyTier === "Gold").length,
    Silver:   customers.filter((c) => c.loyaltyTier === "Silver").length,
    Bronze:   customers.filter((c) => c.loyaltyTier === "Bronze").length,
  }), [customers])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
      </div>
    )
  }

  // â"€â"€ Filter toolbar (injected into DataTable) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const filterToolbar = (
    <>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Search by name, phone, CNIC, address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-xs w-52"
        />
      </div>
      <Select value={tierFilter} onValueChange={setTierFilter}>
        <SelectTrigger className="h-8 text-xs w-28">
          <SelectValue placeholder="All Tiers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All Tiers</SelectItem>
          <SelectItem value="Bronze">Bronze</SelectItem>
          <SelectItem value="Silver">Silver</SelectItem>
          <SelectItem value="Gold">Gold</SelectItem>
          <SelectItem value="Platinum">Platinum</SelectItem>
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger className="h-8 text-xs w-32">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="totalSpent">Total Spent</SelectItem>
          <SelectItem value="lastPurchase">Last Purchase</SelectItem>
          <SelectItem value="name">Name (A-"Z)</SelectItem>
        </SelectContent>
      </Select>
      {(search || tierFilter !== "All") && (
        <button
          onClick={() => { setSearch(""); setTierFilter("All") }}
          className="text-[10px] text-slate-500 hover:text-slate-700 whitespace-nowrap transition-colors"
        >
          Clear
        </button>
      )}
      <span className="text-[10px] text-slate-400 whitespace-nowrap ml-0.5">
        {filtered.length}/{customers.length}
      </span>
    </>
  )

  return (
    <div className="p-4 space-y-3">
      {/* â"€â"€ Header â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Customers</h1>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {customers.length}
          </span>
        </div>
        <Button onClick={openAdd} size="sm" className="h-8 text-xs gap-1.5 px-3">
          <Plus className="w-3.5 h-3.5" />
          Add Customer
        </Button>
      </div>

      {/* â"€â"€ Summary Stats â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard title="Total Revenue" value={formatCurrency(customers.reduce((s, c) => s + c.totalSpent, 0))} icon={TrendingUp} iconBg="bg-emerald-100" subtext={`${customers.length} customers`} />
        <StatCard title="Total Orders" value={String(customers.reduce((s, c) => s + c.totalPurchases, 0))} icon={ShoppingBag} iconBg="bg-blue-100" subtext="Across all customers" />
        <StatCard title="Credit Limits Set" value={String(customers.filter(c => (c.creditLimit ?? 0) > 0).length)} icon={CreditCard} iconBg="bg-violet-100" subtext="Customers with udhaar limit" />
      </div>

      {/* â"€â"€ Tier Strip â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="grid grid-cols-4 gap-2">
        {(["Platinum", "Gold", "Silver", "Bronze"] as const).map((tier) => {
          const cfg      = tierCardConfig[tier]
          const isActive = tierFilter === tier
          return (
            <button
              key={tier}
              onClick={() => setTierFilter(isActive ? "All" : tier)}
              className={[
                "relative text-left rounded-lg bg-white border border-slate-200 border-l-4 px-3 py-2.5",
                "transition-all duration-150 hover:shadow-md hover:-translate-y-px",
                cfg.accent,
                isActive ? `ring-1 ${cfg.ring} shadow-sm` : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${cfg.label}`}>{tier}</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
              </div>
              <p className="text-xl font-bold text-slate-900 leading-none tracking-tight">{tierCounts[tier]}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                {tierCounts[tier] === 1 ? "customer" : "customers"}
              </p>
            </button>
          )
        })}
      </div>

      {/* â"€â"€ Mobile Cards â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs">No customers found</div>
        )}
        {filtered.map((customer) => {
          const accentColor =
            customer.loyaltyTier === "Platinum" ? "bg-slate-800" :
            customer.loyaltyTier === "Gold"     ? "bg-amber-400" :
            customer.loyaltyTier === "Silver"   ? "bg-slate-300" : "bg-orange-400"
          return (
            <div key={customer.id} className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className={`w-1 shrink-0 ${accentColor}`} />
              <div className="flex-1 p-3 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <CustomerAvatar name={customer.name} id={customer.id} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{customer.name}</p>
                  </div>
                  <TierBadge tier={customer.loyaltyTier} />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                    <Phone className="w-2.5 h-2.5 text-slate-400" />{customer.phone}
                  </span>
                  {customer.cnic && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 font-mono">
                      <CreditCard className="w-2.5 h-2.5 text-slate-400 shrink-0" />{customer.cnic}
                    </span>
                  )}
                  {customer.email && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 truncate max-w-[150px]">
                      <Mail className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </span>
                  )}
                </div>
                {customer.address && (
                  <div className="flex items-start gap-1 mb-1.5">
                    <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-[10px] text-slate-500 line-clamp-1">{customer.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
                    <ShoppingBag className="w-2.5 h-2.5" />{customer.totalPurchases} purchases
                  </span>
                  <span className="text-xs font-bold text-slate-900">{formatCurrency(customer.totalSpent)}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-2">
                  <Calendar className="w-2.5 h-2.5" />
                  Last: {customer.lastPurchaseDate ? formatDate(customer.lastPurchaseDate) : "-"}
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 px-2" asChild>
                    <Link href={`/customers/${customer.id}`}><Eye className="w-2.5 h-2.5" />View</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-violet-600 border-violet-200 hover:bg-violet-50 px-2" onClick={() => openLedger(customer)}>
                    <BookOpen className="w-2.5 h-2.5" />Ledger
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-slate-600 border-slate-200 hover:bg-slate-50 px-2" onClick={() => openEdit(customer)}>
                    <Pencil className="w-2.5 h-2.5" />Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-red-500 border-red-200 hover:bg-red-50 px-2" onClick={() => setDeleteTarget(customer)}>
                    <Trash2 className="w-2.5 h-2.5" />Delete
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* â"€â"€ Desktop Table â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={filtered}
          toolbar={filterToolbar}
        />
      </div>

      {/* â"€â"€ Add / Edit Dialog â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Customer" : "Add New Customer"}</DialogTitle>
            <DialogDescription>
              {editTarget ? "Update the customer's profile information below." : "Fill in the details to add a new customer."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 mt-1">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs">Full Name <span className="text-red-500">*</span></Label>
              <Input id="name" placeholder="e.g. Ahmed Khan" className="h-8 text-xs" {...register("name")} />
              {errors.name && <p className="text-[10px] text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs">Phone <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input id="phone" placeholder="+92 300 1234567" className="pl-8 h-8 text-xs" {...register("phone")} />
              </div>
              {errors.phone && <p className="text-[10px] text-red-500">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="cnic" className="text-xs">CNIC (ID Card) <span className="text-slate-400 text-[10px]">(required for credit sales)</span></Label>
              <div className="relative">
                <CreditCard className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input id="cnic" placeholder="e.g. 42101-1234567-1" className="pl-8 h-8 text-xs font-mono" {...register("cnic")} />
              </div>
              {errors.cnic && <p className="text-[10px] text-red-500">{errors.cnic.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="whatsapp" className="text-xs">WhatsApp <span className="text-slate-400 text-[10px]">(if different from phone)</span></Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-500" />
                <Input id="whatsapp" placeholder="+92 300 1234567" className="pl-8 h-8 text-xs" {...register("whatsapp")} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs">Email <span className="text-slate-400 text-[10px]">(optional)</span></Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input id="email" type="email" placeholder="customer@example.com" className="pl-8 h-8 text-xs" {...register("email")} />
              </div>
              {errors.email && <p className="text-[10px] text-red-500">{errors.email.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="address" className="text-xs">Address <span className="text-slate-400 text-[10px]">(optional)</span></Label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input id="address" placeholder="Street, Area" className="pl-8 h-8 text-xs" {...register("address")} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="city" className="text-xs">City <span className="text-slate-400 text-[10px]">(optional)</span></Label>
                <div className="relative">
                  <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input id="city" placeholder="Karachi, Lahore..." className="pl-8 h-8 text-xs" {...register("city")} />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="creditLimit" className="text-xs">Credit Limit <span className="text-slate-400 text-[10px]">(max udhaar - optional)</span></Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">Rs</span>
                <Input id="creditLimit" type="number" onWheel={e => e.currentTarget.blur()} min={0} placeholder="e.g. 50000" className="pl-8 h-8 text-xs" {...register("creditLimit")} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes" className="text-xs">Notes <span className="text-slate-400 text-[10px]">(optional)</span></Label>
              <div className="relative">
                <StickyNote className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <Textarea id="notes" placeholder="Any additional notes..." className="pl-8 min-h-[70px] resize-none text-xs" {...register("notes")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" className="h-8 text-xs" disabled={isSubmitting}>
                {editTarget ? "Save Changes" : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* â"€â"€ Delete Confirm â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Customer"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />

      {/* â"€â"€ Ledger Modal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <Dialog open={!!ledgerCustomer} onOpenChange={(open) => !open && setLedgerCustomer(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-violet-600" />
              Udhaar Ledger - {ledgerCustomer?.name}
            </DialogTitle>
            <DialogDescription>
              All sales and outstanding balance for this customer.
            </DialogDescription>
          </DialogHeader>

          {ledgerLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600" />
            </div>
          ) : (() => {
            const totalBilled    = ledgerSales.reduce((s, r) => s + r.total, 0)
            const totalReceived  = ledgerSales.reduce((s, r) => s + r.amountReceived, 0)
            const totalOutstanding = ledgerSales
              .filter(r => r.status === "Pending")
              .reduce((s, r) => s + Math.max(0, r.total - r.amountReceived), 0)

            return (
              <>
                {/* Summary strip */}
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Total Billed</p>
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(totalBilled)}</p>
                  </div>
                  <div className="text-center border-x border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Received</p>
                    <p className="text-sm font-bold text-emerald-700">{formatCurrency(totalReceived)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">Outstanding (Udhaar)</p>
                    <p className={`text-sm font-bold ${totalOutstanding > 0 ? "text-red-600" : "text-slate-500"}`}>
                      {formatCurrency(totalOutstanding)}
                    </p>
                  </div>
                </div>

                {ledgerCustomer?.creditLimit && ledgerCustomer.creditLimit > 0 && (
                  <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs border ${
                    totalOutstanding >= ledgerCustomer.creditLimit
                      ? "bg-red-50 border-red-200 text-red-700"
                      : "bg-amber-50 border-amber-200 text-amber-700"
                  }`}>
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Credit limit: {formatCurrency(ledgerCustomer.creditLimit)}.
                    {totalOutstanding >= ledgerCustomer.creditLimit
                      ? " Limit reached - no more credit allowed."
                      : ` ${formatCurrency(ledgerCustomer.creditLimit - totalOutstanding)} remaining.`}
                  </div>
                )}

                {/* Sales table */}
                {ledgerSales.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-xs">No sales found for this customer.</p>
                  </div>
                ) : (
                  <div className="overflow-auto flex-1">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left py-2 px-3 font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Invoice</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Date</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Total</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Received</th>
                          <th className="text-right py-2 px-3 font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Balance</th>
                          <th className="text-center py-2 px-3 font-semibold text-slate-600 text-[10px] uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerSales.map((sale, idx) => {
                          const balance = Math.max(0, sale.total - sale.amountReceived)
                          const isPending = sale.status === "Pending" && balance > 0
                          return (
                            <tr key={sale.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                              <td className="py-2 px-3 font-mono text-[11px] text-blue-700">{sale.invoiceNumber}</td>
                              <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{formatDate(sale.date)}</td>
                              <td className="py-2 px-3 text-right font-semibold text-slate-900">{formatCurrency(sale.total)}</td>
                              <td className="py-2 px-3 text-right text-emerald-700">{formatCurrency(sale.amountReceived)}</td>
                              <td className={`py-2 px-3 text-right font-semibold ${isPending ? "text-red-600" : "text-slate-400"}`}>
                                {isPending ? formatCurrency(balance) : "-"}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  sale.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  sale.status === "Pending"   ? "bg-amber-50 text-amber-700 border-amber-200" :
                                  "bg-slate-100 text-slate-600 border-slate-200"
                                }`}>
                                  {sale.status}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}

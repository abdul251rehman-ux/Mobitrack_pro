"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Plus, Eye, Pencil, Trash2, Search, Users,
  Phone, Mail, MapPin, StickyNote, Calendar, ShoppingBag,
} from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import Link from "next/link"

import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/api/customers"
import { Customer } from "@/data/types"
import { DataTable } from "@/components/shared/data-table"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
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
import { formatCurrency, formatDate, todayPKT } from "@/lib/utils"

// ── Zod schema ────────────────────────────────────────────────────────────────
const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
})
type CustomerForm = z.infer<typeof customerSchema>

// ── Tier badge ────────────────────────────────────────────────────────────────
const tierColors: Record<string, string> = {
  Bronze:   "bg-orange-50 text-orange-700 border-orange-200",
  Silver:   "bg-slate-100 text-slate-600 border-slate-300",
  Gold:     "bg-amber-50 text-amber-700 border-amber-200",
  Platinum: "bg-slate-800 text-white border-slate-700",
}

// ── Tier card config ──────────────────────────────────────────────────────────
const tierCardConfig: Record<string, { dot: string; label: string; accent: string; ring: string; icon: string }> = {
  Platinum: { dot: "bg-slate-700",  label: "text-slate-600",  accent: "border-l-slate-700",  ring: "ring-slate-400",  icon: "★" },
  Gold:     { dot: "bg-amber-400",  label: "text-amber-600",  accent: "border-l-amber-400",  ring: "ring-amber-400",  icon: "★" },
  Silver:   { dot: "bg-slate-400",  label: "text-slate-500",  accent: "border-l-slate-400",  ring: "ring-slate-300",  icon: "★" },
  Bronze:   { dot: "bg-orange-400", label: "text-orange-600", accent: "border-l-orange-400", ring: "ring-orange-300", icon: "★" },
}

function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${tierColors[tier] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
      {tier}
    </span>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
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

// ── Page ──────────────────────────────────────────────────────────────────────
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

  // ── Filtered + sorted ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...customers]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q))
    }
    if (tierFilter !== "All") list = list.filter((c) => c.loyaltyTier === tierFilter)
    list.sort((a, b) => {
      if (sortBy === "totalSpent")    return b.totalSpent - a.totalSpent
      if (sortBy === "lastPurchase")  return new Date(b.lastPurchaseDate).getTime() - new Date(a.lastPurchaseDate).getTime()
      if (sortBy === "name")          return a.name.localeCompare(b.name)
      return 0
    })
    return list
  }, [customers, search, tierFilter, sortBy])

  function openAdd() {
    setEditTarget(null)
    reset({ name: "", phone: "", email: "", address: "", notes: "" })
    setDialogOpen(true)
  }
  function openEdit(customer: Customer) {
    setEditTarget(customer)
    reset({ name: customer.name, phone: customer.phone, email: customer.email ?? "", address: customer.address ?? "", notes: customer.notes ?? "" })
    setDialogOpen(true)
  }

  async function onSubmit(data: CustomerForm) {
    try {
      if (editTarget) {
        const updated = await updateCustomer(editTarget.id, { name: data.name, phone: data.phone, email: data.email || undefined, address: data.address || undefined, notes: data.notes || undefined })
        setCustomers((prev) => prev.map((c) => (c.id === editTarget.id ? updated : c)))
        toast.success("Customer updated", { description: `${data.name}'s profile has been updated.` })
      } else {
        const created = await createCustomer({ name: data.name, phone: data.phone, email: data.email || undefined, address: data.address || undefined, notes: data.notes || undefined, totalPurchases: 0, totalSpent: 0, lastPurchaseDate: todayPKT(), loyaltyTier: "Bronze" })
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

  // ── Columns ─────────────────────────────────────────────────────────────────
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
        ) : <span className="text-xs text-slate-400">—</span>
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
      cell: ({ row }) => <div className="text-xs text-slate-600 whitespace-nowrap">{formatDate(row.original.lastPurchaseDate)}</div>,
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

  // ── Tier counts ─────────────────────────────────────────────────────────────
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

  // ── Filter toolbar (injected into DataTable) ─────────────────────────────
  const filterToolbar = (
    <>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <Input
          placeholder="Search by name or phone..."
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
          <SelectItem value="name">Name (A–Z)</SelectItem>
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
      {/* ── Header ──────────────────────────────────────────────────────────── */}
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

      {/* ── Tier Strip ──────────────────────────────────────────────────────── */}
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

      {/* ── Mobile Cards ────────────────────────────────────────────────────── */}
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
                  Last: {formatDate(customer.lastPurchaseDate)}
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 px-2" asChild>
                    <Link href={`/customers/${customer.id}`}><Eye className="w-2.5 h-2.5" />View</Link>
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

      {/* ── Desktop Table ────────────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={filtered}
          toolbar={filterToolbar}
        />
      </div>

      {/* ── Add / Edit Dialog ────────────────────────────────────────────────── */}
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
              <Label htmlFor="email" className="text-xs">Email <span className="text-slate-400 text-[10px]">(optional)</span></Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input id="email" type="email" placeholder="customer@example.com" className="pl-8 h-8 text-xs" {...register("email")} />
              </div>
              {errors.email && <p className="text-[10px] text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="address" className="text-xs">Address <span className="text-slate-400 text-[10px]">(optional)</span></Label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input id="address" placeholder="Street, Area, City" className="pl-8 h-8 text-xs" {...register("address")} />
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

      {/* ── Delete Confirm ────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Customer"
        description={`Are you sure you want to delete ${deleteTarget?.name}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  )
}

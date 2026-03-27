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
import { PageHeader } from "@/components/shared/page-header"
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
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate, getLoyaltyTier } from "@/lib/utils"

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

function TierBadge({ tier }: { tier: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${tierColors[tier] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {tier}
    </span>
  )
}

// ── Avatar ────────────────────────────────────────────────────────────────────
const avatarColors = [
  "bg-blue-600",   "bg-violet-600", "bg-emerald-600", "bg-amber-600",
  "bg-rose-600",   "bg-cyan-600",   "bg-indigo-600",  "bg-teal-600",
  "bg-pink-600",   "bg-orange-600",
]

function CustomerAvatar({ name, id }: { name: string; id: string }) {
  const idx = parseInt(id.replace(/\D/g, ""), 10) % avatarColors.length
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${avatarColors[idx]}`}
    >
      {initials}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId() {
  return `cust-${Date.now()}`
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

  // Filters
  const [search, setSearch] = useState("")
  const [tierFilter, setTierFilter] = useState("All")
  const [sortBy, setSortBy] = useState("totalSpent")

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  // Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({ resolver: zodResolver(customerSchema) })

  // ── Filtered + sorted data ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...customers]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
      )
    }

    if (tierFilter !== "All") {
      list = list.filter((c) => c.loyaltyTier === tierFilter)
    }

    list.sort((a, b) => {
      if (sortBy === "totalSpent") return b.totalSpent - a.totalSpent
      if (sortBy === "lastPurchase")
        return new Date(b.lastPurchaseDate).getTime() - new Date(a.lastPurchaseDate).getTime()
      if (sortBy === "name") return a.name.localeCompare(b.name)
      return 0
    })

    return list
  }, [customers, search, tierFilter, sortBy])

  // ── Open add / edit dialog ──────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null)
    reset({ name: "", phone: "", email: "", address: "", notes: "" })
    setDialogOpen(true)
  }

  function openEdit(customer: Customer) {
    setEditTarget(customer)
    reset({
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? "",
      address: customer.address ?? "",
      notes: customer.notes ?? "",
    })
    setDialogOpen(true)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(data: CustomerForm) {
    try {
      if (editTarget) {
        const updated = await updateCustomer(editTarget.id, {
          name: data.name,
          phone: data.phone,
          email: data.email || undefined,
          address: data.address || undefined,
          notes: data.notes || undefined,
        })
        setCustomers((prev) =>
          prev.map((c) => (c.id === editTarget.id ? updated : c))
        )
        toast.success("Customer updated", {
          description: `${data.name}'s profile has been updated.`,
        })
      } else {
        const created = await createCustomer({
          name: data.name,
          phone: data.phone,
          email: data.email || undefined,
          address: data.address || undefined,
          notes: data.notes || undefined,
          totalPurchases: 0,
          totalSpent: 0,
          lastPurchaseDate: new Date().toISOString(),
          loyaltyTier: "Bronze",
        })
        setCustomers((prev) => [created, ...prev])
        toast.success("Customer added", {
          description: `${data.name} has been added to your customer list.`,
        })
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save customer")
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteCustomer(deleteTarget.id)
      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      toast.success("Customer deleted", {
        description: `${deleteTarget.name} has been removed.`,
      })
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
      cell: ({ row }) => (
        <CustomerAvatar name={row.original.name} id={row.original.id} />
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="font-medium text-slate-900">{row.original.name}</div>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-slate-600">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
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
          <div className="flex items-center gap-1.5 text-slate-600 max-w-[180px] truncate">
            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{email}</span>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        )
      },
    },
    {
      accessorKey: "totalPurchases",
      header: "Purchases",
      cell: ({ row }) => (
        <div className="text-center font-medium text-slate-700">
          {row.original.totalPurchases}
        </div>
      ),
    },
    {
      accessorKey: "totalSpent",
      header: "Total Spent",
      cell: ({ row }) => (
        <div className="font-semibold text-slate-900">
          {formatCurrency(row.original.totalSpent)}
        </div>
      ),
    },
    {
      accessorKey: "lastPurchaseDate",
      header: "Last Purchase",
      cell: ({ row }) => (
        <div className="text-slate-600 whitespace-nowrap">
          {formatDate(row.original.lastPurchaseDate)}
        </div>
      ),
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
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-sm" asChild title="View details">
            <Link href={`/customers/${row.original.id}`}>
              <Eye className="w-4 h-4 text-slate-500" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Edit customer"
            onClick={() => openEdit(row.original)}
          >
            <Pencil className="w-4 h-4 text-slate-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Delete customer"
            onClick={() => setDeleteTarget(row.original)}
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </Button>
        </div>
      ),
    },
  ]

  // ── Tier counts for header badge ────────────────────────────────────────────
  const tierCounts = useMemo(() => {
    return {
      Platinum: customers.filter((c) => c.loyaltyTier === "Platinum").length,
      Gold: customers.filter((c) => c.loyaltyTier === "Gold").length,
      Silver: customers.filter((c) => c.loyaltyTier === "Silver").length,
      Bronze: customers.filter((c) => c.loyaltyTier === "Bronze").length,
    }
  }, [customers])

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-screen-2xl mx-auto flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="Customers"
        description={`${customers.length} customers total`}
        badge={
          <Badge variant="secondary" className="text-sm font-medium">
            {customers.length}
          </Badge>
        }
        action={
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Customer
          </Button>
        }
      />

      {/* Tier summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["Platinum", "Gold", "Silver", "Bronze"] as const).map((tier) => (
          <button
            key={tier}
            onClick={() => setTierFilter(tierFilter === tier ? "All" : tier)}
            className={`rounded-xl border px-4 py-3 text-left transition-all hover:shadow-sm ${
              tierFilter === tier ? "ring-2 ring-offset-1" : ""
            } ${tierColors[tier]}`}
          >
            <p className="text-lg font-bold">{tierCounts[tier]}</p>
            <p className="text-xs font-medium opacity-80">{tier}</p>
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-0 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Loyalty Tier" />
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
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="totalSpent">Total Spent</SelectItem>
            <SelectItem value="lastPurchase">Last Purchase</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
          </SelectContent>
        </Select>

        {(search || tierFilter !== "All") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setTierFilter("All") }}
            className="text-slate-500"
          >
            Clear filters
          </Button>
        )}

        <div className="ml-auto text-sm text-slate-500">
          {filtered.length} of {customers.length} customers
        </div>
      </div>

      {/* Mobile Cards (md:hidden) */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">No customers found</div>
        )}

        {filtered.map((customer) => {
          const accentColor =
            customer.loyaltyTier === "Platinum"
              ? "bg-slate-800"
              : customer.loyaltyTier === "Gold"
              ? "bg-amber-400"
              : customer.loyaltyTier === "Silver"
              ? "bg-slate-300"
              : "bg-orange-400"

          return (
            <div
              key={customer.id}
              className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              {/* Left accent strip */}
              <div className={`w-1 shrink-0 ${accentColor}`} />

              {/* Card body */}
              <div className="flex-1 p-3 min-w-0">
                {/* Row 1: Avatar + Name + TierBadge */}
                <div className="flex items-center gap-2.5 mb-2">
                  <CustomerAvatar name={customer.name} id={customer.id} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate leading-tight">{customer.name}</p>
                  </div>
                  <TierBadge tier={customer.loyaltyTier} />
                </div>

                {/* Row 2: Phone + Email */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                    <Phone className="w-3 h-3 text-slate-400" />
                    {customer.phone}
                  </span>
                  {customer.email && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 truncate max-w-[160px]">
                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </span>
                  )}
                </div>

                {/* Row 3: Address (if present) */}
                {customer.address && (
                  <div className="flex items-start gap-1 mb-2">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-500 line-clamp-1">{customer.address}</span>
                  </div>
                )}

                {/* Row 4: Purchases + Total spent */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-700 font-medium">
                    <ShoppingBag className="w-3 h-3" />
                    {customer.totalPurchases} purchases
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(customer.totalSpent)}
                  </span>
                </div>

                {/* Row 5: Last purchase date */}
                <div className="flex items-center gap-1 text-xs text-slate-400 mb-2.5">
                  <Calendar className="w-3 h-3" />
                  Last purchase: {formatDate(customer.lastPurchaseDate)}
                </div>

                {/* Row 6: Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                    asChild
                  >
                    <Link href={`/customers/${customer.id}`}>
                      <Eye className="w-3 h-3" />
                      View
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 text-slate-600 border-slate-200 hover:bg-slate-50"
                    onClick={() => openEdit(customer)}
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
                    onClick={() => setDeleteTarget(customer)}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop Table (hidden md:block) */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search customers..."
        />
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? "Update the customer's profile information below."
                : "Fill in the details to add a new customer."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Ahmed Khan"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">
                Phone <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="phone"
                  placeholder="+92 300 1234567"
                  className="pl-9"
                  {...register("phone")}
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email <span className="text-slate-400 text-xs">(optional)</span></Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="customer@example.com"
                  className="pl-9"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="address">Address <span className="text-slate-400 text-xs">(optional)</span></Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input
                  id="address"
                  placeholder="Street, Area, City"
                  className="pl-9"
                  {...register("address")}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes <span className="text-slate-400 text-xs">(optional)</span></Label>
              <div className="relative">
                <StickyNote className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Textarea
                  id="notes"
                  placeholder="Any additional notes about this customer..."
                  className="pl-9 min-h-[80px] resize-none"
                  {...register("notes")}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {editTarget ? "Save Changes" : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
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

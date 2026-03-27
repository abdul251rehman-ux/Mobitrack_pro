"use client"

import { useState, useRef, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Building2, Mail, Phone, Upload, FileText, Users, Database,
  Download, Shield, RotateCcw, Plus, Pencil, Power, Settings,
} from "lucide-react"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { getTenant, updateTenant, getTenantSettings, updateTenantSettings, getProfiles } from "@/lib/api/settings"

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRole = "Admin" | "Manager" | "Cashier"
type UserStatus = "Active" | "Inactive"

interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  lastLogin: string
}

// ── Demo users ─────────────────────────────────────────────────────────────────

const initialUsers: AppUser[] = [
  { id: "u1", name: "Ahmed Khan",   email: "ahmed@mobitrack.com",  role: "Admin",   status: "Active",   lastLogin: "2026-03-12" },
  { id: "u2", name: "Fatima Malik", email: "fatima@mobitrack.com", role: "Manager", status: "Active",   lastLogin: "2026-03-11" },
  { id: "u3", name: "Ali Hassan",   email: "ali@mobitrack.com",    role: "Cashier", status: "Active",   lastLogin: "2026-03-10" },
  { id: "u4", name: "Sara Ahmed",   email: "sara@mobitrack.com",   role: "Cashier", status: "Inactive", lastLogin: "2026-02-28" },
]

// ── Zod schemas ───────────────────────────────────────────────────────────────

const shopSchema = z.object({
  shopName:    z.string().min(2, "Shop name is required"),
  address:     z.string().min(3, "Address is required"),
  city:        z.string().min(1, "City is required"),
  phone:       z.string().min(7, "Valid phone required"),
  email:       z.string().email("Valid email required"),
  ntn:         z.string().min(1, "NTN is required"),
  currency:    z.string().min(1, "Currency symbol is required"),
})

const taxSchema = z.object({
  taxName:  z.string().min(1, "Tax name is required"),
  taxRate:  z.number().min(0).max(100),
})

const invoiceSchema = z.object({
  prefix:      z.string().min(1, "Prefix is required"),
  nextNumber:  z.string().min(1, "Next number is required"),
  footerText:  z.string(),
  termsText:   z.string(),
})

const userSchema = z.object({
  name:     z.string().min(2, "Name is required"),
  email:    z.string().email("Valid email required"),
  role:     z.enum(["Admin", "Manager", "Cashier"]),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  status:   z.boolean(),
})

type ShopForm    = z.infer<typeof shopSchema>
type TaxForm     = z.infer<typeof taxSchema>
type InvoiceForm = z.infer<typeof invoiceSchema>
type UserForm    = z.infer<typeof userSchema>

// ── Avatar helpers ─────────────────────────────────────────────────────────────

const avatarPalette = [
  "bg-blue-600", "bg-blue-500", "bg-blue-700",
  "bg-slate-600", "bg-blue-800", "bg-slate-700",
]

function UserAvatar({ name, id }: { name: string; id: string }) {
  const idx      = parseInt(id.replace(/\D/g, ""), 10) % avatarPalette.length
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${avatarPalette[idx]}`}>
      {initials}
    </div>
  )
}

const roleBadgeClass: Record<UserRole, string> = {
  Admin:   "bg-slate-800 text-white border border-slate-700",
  Manager: "bg-blue-100 text-blue-700 border border-blue-200",
  Cashier: "bg-slate-100 text-slate-600 border border-slate-200",
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)

  // ── Tab 1: Shop Profile ────────────────────────────────────────────────────
  const shopForm = useForm<ShopForm>({
    resolver: zodResolver(shopSchema),
    defaultValues: {
      shopName: "MobiTrack Pro",
      address:  "123 Main Market, Liberty",
      city:     "Lahore",
      phone:    "+92 42 35761234",
      email:    "info@mobitrackpro.com",
      ntn:      "1234567-8",
      currency: "₨",
    },
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleLogoFile(file: File) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum size is 2 MB." })
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    async function load() {
      try {
        const [tenant, settings, profiles] = await Promise.all([
          getTenant(),
          getTenantSettings(),
          getProfiles(),
        ])
        // Populate shop form
        shopForm.reset({
          shopName: tenant.name || "MobiTrack Pro",
          address: tenant.address || "",
          city: tenant.city || "Lahore",
          phone: tenant.phone || "",
          email: tenant.email || "",
          ntn: "1234567-8",
          currency: tenant.currency || "₨",
        })
        // Populate tax form
        taxForm.reset({
          taxName: "GST",
          taxRate: settings.taxRate ?? 17,
        })
        setTaxEnabled(settings.taxEnabled ?? true)
        // Populate invoice form
        invoiceForm.reset({
          prefix: settings.invoicePrefix || "INV",
          nextNumber: "2026-0053",
          footerText: settings.receiptFooter || "Thank you for your business!",
          termsText: "All sales are final. No returns after 7 days.",
        })
        // Populate users from profiles
        if (profiles.length > 0) {
          setUsers(profiles.map((p: any) => ({
            id: p.id,
            name: p.name || "Unknown",
            email: p.email || "",
            role: (p.role || "Cashier") as UserRole,
            status: (p.status === "active" ? "Active" : "Inactive") as UserStatus,
            lastLogin: p.lastLogin || "Never",
          })))
        }
      } catch (err) {
        toast.error("Failed to load settings")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function onShopSubmit(data: ShopForm) {
    try {
      await updateTenant({
        name: data.shopName,
        address: data.address,
        city: data.city,
        phone: data.phone,
        email: data.email,
        currency: data.currency,
      })
      toast.success("Shop profile saved", {
        description: "Your shop details have been updated successfully.",
      })
    } catch (err) {
      toast.error("Failed to save shop profile")
      console.error(err)
    }
  }

  // ── Tab 2: Tax Config ──────────────────────────────────────────────────────
  const taxForm = useForm<TaxForm>({
    resolver: zodResolver(taxSchema),
    defaultValues: { taxName: "GST", taxRate: 17 },
  })
  const [taxEnabled, setTaxEnabled] = useState(true)

  async function onTaxSubmit(data: TaxForm) {
    try {
      await updateTenantSettings({
        taxEnabled,
        taxRate: data.taxRate,
      })
      toast.success("Tax settings saved", {
        description: `${data.taxName} at ${data.taxRate}% is now ${taxEnabled ? "enabled" : "disabled"}.`,
      })
    } catch (err) {
      toast.error("Failed to save tax settings")
      console.error(err)
    }
  }

  // ── Tab 3: Invoice Settings ────────────────────────────────────────────────
  const invoiceForm = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      prefix:     "INV",
      nextNumber: "2026-0053",
      footerText: "Thank you for your business!",
      termsText:  "All sales are final. No returns after 7 days.",
    },
  })
  const [showLogoOnInvoice, setShowLogoOnInvoice] = useState(true)

  async function onInvoiceSubmit(data: InvoiceForm) {
    try {
      await updateTenantSettings({
        invoicePrefix: data.prefix,
        receiptFooter: data.footerText,
      })
      toast.success("Invoice settings saved", {
        description: "Your invoice configuration has been updated.",
      })
    } catch (err) {
      toast.error("Failed to save invoice settings")
      console.error(err)
    }
  }

  // ── Tab 4: User Management ─────────────────────────────────────────────────
  const [users, setUsers]               = useState<AppUser[]>(initialUsers)
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [editUser, setEditUser]         = useState<AppUser | null>(null)
  const [toggleTarget, setToggleTarget] = useState<AppUser | null>(null)

  const userForm = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", role: "Cashier", password: "", status: true },
  })

  function openAddUser() {
    setEditUser(null)
    userForm.reset({ name: "", email: "", role: "Cashier", password: "", status: true })
    setUserDialogOpen(true)
  }

  function openEditUser(user: AppUser) {
    setEditUser(user)
    userForm.reset({
      name:     user.name,
      email:    user.email,
      role:     user.role,
      password: "",
      status:   user.status === "Active",
    })
    setUserDialogOpen(true)
  }

  function onUserSubmit(data: UserForm) {
    if (editUser) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUser.id
            ? { ...u, name: data.name, email: data.email, role: data.role, status: data.status ? "Active" : "Inactive" }
            : u
        )
      )
      toast.success("User updated", { description: `${data.name}'s profile has been updated.` })
    } else {
      const newUser: AppUser = {
        id:        `u${Date.now()}`,
        name:      data.name,
        email:     data.email,
        role:      data.role,
        status:    data.status ? "Active" : "Inactive",
        lastLogin: "Never",
      }
      setUsers((prev) => [newUser, ...prev])
      toast.success("User added", { description: `${data.name} has been added.` })
    }
    setUserDialogOpen(false)
  }

  function confirmToggleStatus() {
    if (!toggleTarget) return
    const next: UserStatus = toggleTarget.status === "Active" ? "Inactive" : "Active"
    setUsers((prev) =>
      prev.map((u) => (u.id === toggleTarget.id ? { ...u, status: next } : u))
    )
    toast.success(`User ${next === "Active" ? "activated" : "deactivated"}`, {
      description: `${toggleTarget.name} is now ${next.toLowerCase()}.`,
    })
    setToggleTarget(null)
  }

  // ── Tab 5: Data Management ─────────────────────────────────────────────────
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    toast.success("Export started", { description: "Your CSV file is being prepared for download." })
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    toast.success("Import queued", { description: `${file.name} will be processed shortly.` })
    e.target.value = ""
  }

  function handleReset() {
    setResetDialogOpen(false)
    toast.success("Demo data reset", { description: "All data has been restored to defaults." })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your shop profile, taxes, invoices, users, and data."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-0.5 text-xs font-medium">
            <Settings className="w-3.5 h-3.5" />
            Configuration
          </span>
        }
      />

      <Tabs defaultValue="shop" className="space-y-6">
        {/* ── Tab triggers ──────────────────────────────────────────────────── */}
        <TabsList className="flex flex-wrap gap-1 h-auto bg-slate-100 p-1 rounded-xl overflow-x-auto">
          <TabsTrigger value="shop"     className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Building2 className="w-4 h-4" /> Shop Profile
          </TabsTrigger>
          <TabsTrigger value="tax"      className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Shield className="w-4 h-4" /> Tax Config
          </TabsTrigger>
          <TabsTrigger value="invoice"  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <FileText className="w-4 h-4" /> Invoice
          </TabsTrigger>
          <TabsTrigger value="users"    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Users className="w-4 h-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="data"     className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Database className="w-4 h-4" /> Data
          </TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════════════════
            TAB 1 — SHOP PROFILE
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="shop" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Shop details form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Shop Details
                  </CardTitle>
                  <CardDescription>Basic information about your business</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={shopForm.handleSubmit(onShopSubmit)} className="space-y-5">
                    {/* Row 1 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="shopName">Shop Name</Label>
                        <Input id="shopName" placeholder="Your shop name" {...shopForm.register("shopName")} />
                        {shopForm.formState.errors.shopName && (
                          <p className="text-xs text-red-500">{shopForm.formState.errors.shopName.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="city">City</Label>
                        <Select
                          defaultValue={shopForm.getValues("city")}
                          onValueChange={(v) => shopForm.setValue("city", v)}
                        >
                          <SelectTrigger id="city">
                            <SelectValue placeholder="Select city" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Lahore">Lahore</SelectItem>
                            <SelectItem value="Karachi">Karachi</SelectItem>
                            <SelectItem value="Islamabad">Islamabad</SelectItem>
                            <SelectItem value="Rawalpindi">Rawalpindi</SelectItem>
                            <SelectItem value="Faisalabad">Faisalabad</SelectItem>
                            <SelectItem value="Multan">Multan</SelectItem>
                            <SelectItem value="Peshawar">Peshawar</SelectItem>
                            <SelectItem value="Quetta">Quetta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-1.5">
                      <Label htmlFor="address">Address</Label>
                      <Input id="address" placeholder="Street address" {...shopForm.register("address")} />
                      {shopForm.formState.errors.address && (
                        <p className="text-xs text-red-500">{shopForm.formState.errors.address.message}</p>
                      )}
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">
                          <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> Phone</span>
                        </Label>
                        <Input id="phone" placeholder="+92 42 35761234" {...shopForm.register("phone")} />
                        {shopForm.formState.errors.phone && (
                          <p className="text-xs text-red-500">{shopForm.formState.errors.phone.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email">
                          <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-400" /> Email</span>
                        </Label>
                        <Input id="email" type="email" placeholder="info@yourshop.com" {...shopForm.register("email")} />
                        {shopForm.formState.errors.email && (
                          <p className="text-xs text-red-500">{shopForm.formState.errors.email.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Row 3 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="ntn">Tax Registration # NTN</Label>
                        <Input id="ntn" placeholder="1234567-8" {...shopForm.register("ntn")} />
                        {shopForm.formState.errors.ntn && (
                          <p className="text-xs text-red-500">{shopForm.formState.errors.ntn.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="currency">Currency Symbol</Label>
                        <Input id="currency" placeholder="₨" maxLength={5} {...shopForm.register("currency")} />
                        {shopForm.formState.errors.currency && (
                          <p className="text-xs text-red-500">{shopForm.formState.errors.currency.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button type="submit" className="gap-2">
                        Save Changes
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Logo upload */}
            <div>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg">Shop Logo</CardTitle>
                  <CardDescription>Shown on invoices and receipts</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  {logoPreview ? (
                    <div className="relative w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-full max-h-36 object-contain rounded-lg border border-slate-200 bg-slate-50"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => setLogoPreview(null)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`w-full rounded-xl border-2 border-dashed transition-colors p-8 flex flex-col items-center gap-3 cursor-pointer ${
                        isDragging
                          ? "border-blue-400 bg-blue-50"
                          : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDragging(false)
                        const file = e.dataTransfer.files?.[0]
                        if (file) handleLogoFile(file)
                      }}
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-slate-700">Drag & drop or click to upload</p>
                        <p className="text-xs text-slate-400 mt-1">JPG, PNG, SVG up to 2MB</p>
                      </div>
                    </button>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleLogoFile(file)
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            TAB 2 — TAX CONFIGURATION
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="tax">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5 text-amber-600" />
                Tax Configuration
              </CardTitle>
              <CardDescription>Configure how tax is applied to sales and invoices</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={taxForm.handleSubmit(onTaxSubmit)} className="space-y-6">
                <div className="space-y-1.5">
                  <Label htmlFor="taxName">Tax Name</Label>
                  <Input id="taxName" placeholder="e.g. GST, VAT" {...taxForm.register("taxName")} />
                  {taxForm.formState.errors.taxName && (
                    <p className="text-xs text-red-500">{taxForm.formState.errors.taxName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <div className="relative">
                    <Input
                      id="taxRate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="17"
                      className="pr-10"
                      {...taxForm.register("taxRate")}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">%</span>
                  </div>
                  {taxForm.formState.errors.taxRate && (
                    <p className="text-xs text-red-500">{taxForm.formState.errors.taxRate.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Enable Tax</p>
                    <p className="text-xs text-slate-500 mt-0.5">Apply tax to all new transactions</p>
                  </div>
                  <Switch
                    checked={taxEnabled}
                    onCheckedChange={setTaxEnabled}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>

                <div className="pt-1">
                  <Button type="submit" className="gap-2">
                    Save Tax Settings
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            TAB 3 — INVOICE SETTINGS
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="invoice">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-blue-600" />
                Invoice Settings
              </CardTitle>
              <CardDescription>Customize how your invoices look and are numbered</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={invoiceForm.handleSubmit(onInvoiceSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="prefix">Invoice Prefix</Label>
                    <Input id="prefix" placeholder="INV" {...invoiceForm.register("prefix")} />
                    {invoiceForm.formState.errors.prefix && (
                      <p className="text-xs text-red-500">{invoiceForm.formState.errors.prefix.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nextNumber">Next Invoice Number</Label>
                    <Input id="nextNumber" placeholder="2026-0053" {...invoiceForm.register("nextNumber")} />
                    {invoiceForm.formState.errors.nextNumber && (
                      <p className="text-xs text-red-500">{invoiceForm.formState.errors.nextNumber.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="footerText">Invoice Footer Text</Label>
                  <Textarea
                    id="footerText"
                    placeholder="Thank you for your business!"
                    rows={2}
                    className="resize-none"
                    {...invoiceForm.register("footerText")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="termsText">Terms & Conditions</Label>
                  <Textarea
                    id="termsText"
                    placeholder="All sales are final..."
                    rows={3}
                    className="resize-none"
                    {...invoiceForm.register("termsText")}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Show logo on invoice</p>
                    <p className="text-xs text-slate-500 mt-0.5">Your shop logo will appear at the top of every invoice</p>
                  </div>
                  <Switch
                    checked={showLogoOnInvoice}
                    onCheckedChange={setShowLogoOnInvoice}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>

                <div className="pt-1">
                  <Button type="submit" className="gap-2">
                    Save Invoice Settings
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            TAB 4 — USER MANAGEMENT
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Team Members</h2>
              <p className="text-sm text-slate-500">{users.length} users registered</p>
            </div>
            <Button onClick={openAddUser} className="gap-2">
              <Plus className="w-4 h-4" /> Add User
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[540px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">User</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Last Login</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={user.name} id={user.id} />
                            <div>
                              <p className="font-medium text-slate-900">{user.name}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadgeClass[user.role]}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                            user.status === "Active"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${user.status === "Active" ? "bg-blue-500" : "bg-slate-400"}`} />
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{user.lastLogin}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Edit user"
                              onClick={() => openEditUser(user)}
                            >
                              <Pencil className="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={user.status === "Active" ? "Deactivate" : "Activate"}
                              onClick={() => setToggleTarget(user)}
                            >
                              <Power className={`w-4 h-4 ${user.status === "Active" ? "text-red-400" : "text-emerald-500"}`} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Add / Edit User Dialog */}
          <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editUser ? "Edit User" : "Add New User"}</DialogTitle>
                <DialogDescription>
                  {editUser ? "Update user details and permissions." : "Create a new team member account."}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="uname">Full Name</Label>
                  <Input id="uname" placeholder="e.g. Ahmed Khan" {...userForm.register("name")} />
                  {userForm.formState.errors.name && (
                    <p className="text-xs text-red-500">{userForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="uemail">Email</Label>
                  <Input id="uemail" type="email" placeholder="user@mobitrack.com" {...userForm.register("email")} />
                  {userForm.formState.errors.email && (
                    <p className="text-xs text-red-500">{userForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="urole">Role</Label>
                  <Select
                    defaultValue={userForm.getValues("role")}
                    onValueChange={(v) => userForm.setValue("role", v as UserRole)}
                  >
                    <SelectTrigger id="urole">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                      <SelectItem value="Cashier">Cashier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="upassword">
                    Password {editUser && <span className="text-slate-400 text-xs">(leave blank to keep current)</span>}
                  </Label>
                  <Input id="upassword" type="password" placeholder="••••••••" {...userForm.register("password")} />
                  {userForm.formState.errors.password && (
                    <p className="text-xs text-red-500">{userForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Active Status</p>
                    <p className="text-xs text-slate-500">User can log in and use the system</p>
                  </div>
                  <Switch
                    checked={userForm.watch("status")}
                    onCheckedChange={(v) => userForm.setValue("status", v)}
                    className="data-[state=checked]:bg-blue-600"
                  />
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={userForm.formState.isSubmitting}>
                    {editUser ? "Save Changes" : "Add User"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Toggle status confirm */}
          <ConfirmDialog
            open={!!toggleTarget}
            onOpenChange={(open) => !open && setToggleTarget(null)}
            title={toggleTarget?.status === "Active" ? "Deactivate User" : "Activate User"}
            description={
              toggleTarget?.status === "Active"
                ? `${toggleTarget?.name} will no longer be able to log in.`
                : `${toggleTarget?.name} will be able to log in again.`
            }
            confirmLabel={toggleTarget?.status === "Active" ? "Deactivate" : "Activate"}
            variant={toggleTarget?.status === "Active" ? "destructive" : "default"}
            onConfirm={confirmToggleStatus}
          />
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            TAB 5 — DATA MANAGEMENT
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="data" className="space-y-6">
          {/* Info strip */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                <Database className="w-5 h-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Database Size</p>
                <p className="text-sm font-semibold text-slate-800">2.4 MB</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Last Backup</p>
                <p className="text-sm font-semibold text-slate-800">2026-03-11 at 14:32</p>
              </div>
            </div>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Export */}
            <Card className="border-blue-200 bg-linear-to-br from-blue-50 to-white">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-1">
                  <Download className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle className="text-base text-blue-900">Export All Data</CardTitle>
                <CardDescription className="text-blue-700/70">
                  Download a complete CSV backup of all your inventory, sales, customers, and transactions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleExport}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </CardContent>
            </Card>

            {/* Import */}
            <Card className="border-blue-200 bg-linear-to-br from-blue-50 to-white">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-1">
                  <Upload className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle className="text-base text-slate-900">Import Data</CardTitle>
                <CardDescription className="text-slate-500">
                  Upload a CSV file to bulk import products, customers, or transactions into the system.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => importFileRef.current?.click()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload File
                </Button>
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImport}
                />
              </CardContent>
            </Card>

            {/* Reset */}
            <Card className="border-red-200 bg-linear-to-br from-red-50 to-white">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center mb-1">
                  <RotateCcw className="w-5 h-5 text-red-600" />
                </div>
                <CardTitle className="text-base text-red-900">Reset Demo Data</CardTitle>
                <CardDescription className="text-red-700/70">
                  Restore all data to factory defaults. This is irreversible and will erase all current records.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={() => setResetDialogOpen(true)}
                  className="w-full gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Defaults
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Reset confirm dialog */}
          <ConfirmDialog
            open={resetDialogOpen}
            onOpenChange={setResetDialogOpen}
            title="Reset All Demo Data?"
            description="This will reset ALL data to defaults. This action cannot be undone. All sales, inventory, customer records, and settings will be permanently erased."
            confirmLabel="Yes, Reset Everything"
            cancelLabel="Cancel"
            variant="destructive"
            onConfirm={handleReset}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

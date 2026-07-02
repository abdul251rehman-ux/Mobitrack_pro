"use client"

import { useState, useRef, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Building2, Mail, Phone, Upload, FileText, Users, Database,
  Download, Shield, RotateCcw, Plus, Pencil, Power, Settings, Eye, EyeOff,
} from "lucide-react"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { getTenant, updateTenant, getTenantSettings, updateTenantSettings, getProfiles, createProfile, updateProfileFull } from "@/lib/api/settings"

// ── Types ──────────────────────────────────────────────────────────────────────
type UserRole   = "Admin" | "Manager" | "Cashier"
type UserStatus = "Active" | "Inactive"

interface AppUser {
  id: string; name: string; email: string
  role: UserRole; status: UserStatus; lastLogin: string
}


// ── Zod schemas ────────────────────────────────────────────────────────────────
const shopSchema = z.object({
  shopName: z.string().min(2, "Shop name is required"),
  address:  z.string().min(3, "Address is required"),
  city:     z.string().min(1, "City is required"),
  phone:    z.string().min(7, "Valid phone required"),
  email:    z.string().email("Valid email required"),
  ntn:      z.string().min(1, "NTN is required"),
  currency: z.string().min(1, "Currency symbol is required"),
})
const taxSchema = z.object({
  taxName: z.string().min(1, "Tax name is required"),
  taxRate: z.number().min(0).max(100),
})
const invoiceSchema = z.object({
  prefix:     z.string().min(1, "Prefix is required"),
  nextNumber: z.string().min(1, "Next number is required"),
  footerText: z.string(),
  termsText:  z.string(),
})
const userSchema = z.object({
  name:     z.string().min(2, "Name is required"),
  email:    z.string().email("Valid email required"),
  role:     z.enum(["Admin", "Manager", "Cashier"]),
  password: z.string().min(6, "Min 6 chars").optional().or(z.literal("")),
  status:   z.boolean(),
})

type ShopForm    = z.infer<typeof shopSchema>
type TaxForm     = z.infer<typeof taxSchema>
type InvoiceForm = z.infer<typeof invoiceSchema>
type UserForm    = z.infer<typeof userSchema>

// ── Helpers ────────────────────────────────────────────────────────────────────
const avatarPalette = ["bg-blue-600", "bg-blue-500", "bg-blue-700", "bg-slate-600", "bg-blue-800", "bg-slate-700"]

function UserAvatar({ name, id }: { name: string; id: string }) {
  const idx      = parseInt(id.replace(/\D/g, ""), 10) % avatarPalette.length
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
  return (
    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${avatarPalette[idx]}`}>
      {initials}
    </div>
  )
}

const roleBadgeCls: Record<UserRole, string> = {
  Admin:   "bg-slate-800 text-white",
  Manager: "bg-blue-50 text-blue-700 border border-blue-200",
  Cashier: "bg-slate-50 text-slate-600 border border-slate-200",
}

function SectionCard({ title, description, children, className }: {
  title: React.ReactNode; description?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className ?? ""}`}>
      <div className="px-3 py-2.5 border-b border-slate-100">
        <h3 className="text-xs font-bold text-slate-800">{title}</h3>
        {description && <p className="text-[10px] text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const shopForm = useForm<ShopForm>({
    resolver: zodResolver(shopSchema),
    defaultValues: { shopName: "MobiTrack Pro", address: "123 Main Market, Liberty", city: "Lahore", phone: "+92 42 35761234", email: "info@mobitrackpro.com", ntn: "1234567-8", currency: "₨" },
  })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [customShopCity, setCustomShopCity] = useState("")
  const watchedCity = shopForm.watch("city")

  function handleLogoFile(file: File) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error("File too large — max 2 MB"); return }
    const reader = new FileReader()
    reader.onload = (e) => setLogoPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const taxForm = useForm<TaxForm>({ resolver: zodResolver(taxSchema), defaultValues: { taxName: "GST", taxRate: 17 } })
  const [taxEnabled, setTaxEnabled] = useState(true)

  const invoiceForm = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { prefix: "INV", nextNumber: "2026-0053", footerText: "Thank you for your business!", termsText: "All sales are final. No returns after 7 days." },
  })
  const [showLogoOnInvoice, setShowLogoOnInvoice] = useState(true)

  const [users, setUsers] = useState<AppUser[]>([])
  const [userDialogOpen, setUserDialogOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [toggleTarget, setToggleTarget] = useState<AppUser | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  const userForm = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", role: "Cashier", password: "", status: true },
  })

  useEffect(() => {
    async function load() {
      try {
        const [tenant, settings, profiles] = await Promise.all([getTenant(), getTenantSettings(), getProfiles()])
        shopForm.reset({ shopName: tenant.name || "MobiTrack Pro", address: tenant.address || "", city: tenant.city || "Lahore", phone: tenant.phone || "", email: tenant.email || "", ntn: "1234567-8", currency: tenant.currency || "₨" })
        if (tenant.logo) setLogoPreview(tenant.logo)
        taxForm.reset({ taxName: "GST", taxRate: settings.taxRate ?? 17 })
        setTaxEnabled(settings.taxEnabled ?? true)
        invoiceForm.reset({ prefix: settings.invoicePrefix || "INV", nextNumber: "2026-0053", footerText: settings.receiptFooter || "Thank you for your business!", termsText: "All sales are final. No returns after 7 days." })
        setUsers(profiles.map((p: any) => ({
          id: p.id, name: p.name || "Unknown", email: p.email || "",
          role: (p.role || "Cashier") as UserRole,
          status: (p.status?.toLowerCase() === "active" ? "Active" : "Inactive") as UserStatus,
          lastLogin: p.lastLogin || "Never",
        })))
      } catch (err) {
        toast.error("Failed to load settings"); console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function onShopSubmit(data: ShopForm) {
    if (data.city === "Other" && !customShopCity.trim()) { toast.error("Please enter a city name"); return }
    const finalCity = data.city === "Other" ? customShopCity.trim() : data.city
    setSaving(true)
    try {
      await updateTenant({ name: data.shopName, address: data.address, city: finalCity, phone: data.phone, email: data.email, currency: data.currency, logo: logoPreview ?? "" })
      toast.success("Shop profile saved successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save shop profile")
    } finally { setSaving(false) }
  }

  async function onTaxSubmit(data: TaxForm) {
    setSaving(true)
    try {
      await updateTenantSettings({ taxEnabled, taxRate: data.taxRate })
      toast.success(`Tax settings saved — ${data.taxName} at ${data.taxRate}%`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tax settings")
    } finally { setSaving(false) }
  }

  async function onInvoiceSubmit(data: InvoiceForm) {
    setSaving(true)
    try {
      await updateTenantSettings({ invoicePrefix: data.prefix, receiptFooter: data.footerText })
      toast.success("Invoice settings saved successfully")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save invoice settings")
    } finally { setSaving(false) }
  }

  function openAddUser() {
    setEditUser(null)
    userForm.reset({ name: "", email: "", role: "Cashier", password: "", status: true })
    setShowPassword(false)
    setUserDialogOpen(true)
  }
  function openEditUser(user: AppUser) {
    setEditUser(user)
    userForm.reset({ name: user.name, email: user.email, role: user.role, password: "", status: user.status === "Active" })
    setShowPassword(false)
    setUserDialogOpen(true)
  }
  async function onUserSubmit(data: UserForm) {
    const status = data.status ? "Active" : "Inactive"
    try {
      if (editUser) {
        if (!data.password && !editUser) {
          // editing — password optional
        }
        await updateProfileFull(editUser.id, {
          name: data.name, email: data.email, role: data.role,
          password: data.password || undefined, status,
        })
        setUsers(prev => prev.map(u => u.id === editUser.id
          ? { ...u, name: data.name, email: data.email, role: data.role, status }
          : u))
        toast.success(`${data.name} updated`)
      } else {
        if (!data.password) { toast.error("Password is required for new users"); return }
        const created = await createProfile({ name: data.name, email: data.email, role: data.role, password: data.password, status })
        setUsers(prev => [{ id: created.id, name: data.name, email: data.email, role: data.role as UserRole, status, lastLogin: "Never" }, ...prev])
        toast.success(`${data.name} added — they can now log in`)
      }
      setUserDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user")
    }
  }
  async function confirmToggleStatus() {
    if (!toggleTarget) return
    const next: UserStatus = toggleTarget.status === "Active" ? "Inactive" : "Active"
    try {
      await updateProfileFull(toggleTarget.id, {
        name: toggleTarget.name, email: toggleTarget.email,
        role: toggleTarget.role, status: next,
      })
      setUsers(prev => prev.map(u => u.id === toggleTarget.id ? { ...u, status: next } : u))
      toast.success(`${toggleTarget.name} is now ${next.toLowerCase()}`)
    } catch {
      toast.error("Failed to update status")
    }
    setToggleTarget(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">

      {/* ── Compact header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <Settings className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 leading-none">Settings</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">Manage shop profile, taxes, invoices, users, and data</p>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="shop" className="space-y-3">
        <TabsList className="h-8 p-0.5 rounded-xl bg-slate-100">
          <TabsTrigger value="shop"    className="h-7 text-xs gap-1.5 px-3"><Building2 className="w-3 h-3" />Shop Profile</TabsTrigger>
          <TabsTrigger value="tax"     className="h-7 text-xs gap-1.5 px-3"><Shield className="w-3 h-3" />Tax Config</TabsTrigger>
          <TabsTrigger value="invoice" className="h-7 text-xs gap-1.5 px-3"><FileText className="w-3 h-3" />Invoice</TabsTrigger>
          <TabsTrigger value="users"   className="h-7 text-xs gap-1.5 px-3"><Users className="w-3 h-3" />Users</TabsTrigger>
          <TabsTrigger value="data"    className="h-7 text-xs gap-1.5 px-3"><Database className="w-3 h-3" />Data</TabsTrigger>
        </TabsList>

        {/* ════ TAB 1 — SHOP PROFILE ════ */}
        <TabsContent value="shop" className="mt-3">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Shop Details */}
            <div className="lg:col-span-2">
              <SectionCard
                title={<span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-blue-600" />Shop Details</span>}
                description="Basic information about your business"
              >
                <form onSubmit={shopForm.handleSubmit(onShopSubmit)} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Shop Name</Label>
                      <Input placeholder="Your shop name" {...shopForm.register("shopName")} className="h-8 text-xs" />
                      {shopForm.formState.errors.shopName && <p className="text-[10px] text-red-500">{shopForm.formState.errors.shopName.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">City</Label>
                      <Select defaultValue={shopForm.getValues("city")} onValueChange={(v) => { shopForm.setValue("city", v); if (v !== "Other") setCustomShopCity("") }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select city" /></SelectTrigger>
                        <SelectContent className="max-h-60">
                          {["Lahore","Karachi","Islamabad","Rawalpindi","Faisalabad","Peshawar","Multan","Quetta","Sialkot","Gujranwala","Bahawalpur","Sargodha","Sukkur","Larkana","Sheikhupura","Rahim Yar Khan","Jhang","Dera Ghazi Khan","Gujrat","Mirpur","Hyderabad","Abbottabad","Mardan","Kasur","Dera Ismail Khan","Okara","Mingora","Nawabshah","Chiniot","Sahiwal","Muzaffarabad","Turbat","Wah Cantt","Attock","Jhelum","Mandi Bahauddin","Hafizabad","Narowal","Muzaffargarh","Layyah","Mianwali","Bhakkar","Toba Tek Singh","Pakpattan","Vehari","Other"].map((c) => (
                            <SelectItem key={c} value={c} className={c === "Other" ? "font-medium text-blue-600 border-t border-slate-100 mt-1 pt-1" : ""}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {watchedCity === "Other" && (
                        <Input
                          placeholder="Enter city name..."
                          value={customShopCity}
                          onChange={e => setCustomShopCity(e.target.value)}
                          className={`h-8 text-xs mt-1 ${!customShopCity.trim() ? "border-amber-400" : ""}`}
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Address</Label>
                    <Input placeholder="Street address" {...shopForm.register("address")} className="h-8 text-xs" />
                    {shopForm.formState.errors.address && <p className="text-[10px] text-red-500">{shopForm.formState.errors.address.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" />Phone</Label>
                      <Input placeholder="+92 42 35761234" {...shopForm.register("phone")} className="h-8 text-xs" />
                      {shopForm.formState.errors.phone && <p className="text-[10px] text-red-500">{shopForm.formState.errors.phone.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" />Email</Label>
                      <Input type="email" placeholder="info@yourshop.com" {...shopForm.register("email")} className="h-8 text-xs" />
                      {shopForm.formState.errors.email && <p className="text-[10px] text-red-500">{shopForm.formState.errors.email.message}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Tax Reg # NTN</Label>
                      <Input placeholder="1234567-8" {...shopForm.register("ntn")} className="h-8 text-xs" />
                      {shopForm.formState.errors.ntn && <p className="text-[10px] text-red-500">{shopForm.formState.errors.ntn.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Currency Symbol</Label>
                      <Input placeholder="₨" maxLength={5} {...shopForm.register("currency")} className="h-8 text-xs" />
                      {shopForm.formState.errors.currency && <p className="text-[10px] text-red-500">{shopForm.formState.errors.currency.message}</p>}
                    </div>
                  </div>

                  <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs mt-1 min-w-[110px]">
                    {saving ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5 inline-block" />Saving…</> : "Save Changes"}
                  </Button>
                </form>
              </SectionCard>
            </div>

            {/* Logo upload */}
            <SectionCard title="Shop Logo" description="Shown on invoices and receipts">
              {logoPreview ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoPreview} alt="Logo preview" className="w-full max-h-28 object-contain rounded-lg border border-slate-200 bg-slate-50" />
                  <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setLogoPreview(null)}>Remove</Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleLogoFile(f) }}
                  className={`w-full rounded-xl border-2 border-dashed transition-colors p-5 flex flex-col items-center gap-2 cursor-pointer ${isDragging ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/50"}`}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-700">Drag & drop or click to upload</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, SVG up to 2MB</p>
                  </div>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/svg+xml" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }} />
            </SectionCard>
          </div>
        </TabsContent>

        {/* ════ TAB 2 — TAX CONFIG ════ */}
        <TabsContent value="tax" className="mt-3">
          <SectionCard
            title={<span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-amber-600" />Tax Configuration</span>}
            description="Configure how tax is applied to sales and invoices"
            className="max-w-sm"
          >
            <form onSubmit={taxForm.handleSubmit(onTaxSubmit)} className="space-y-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Tax Name</Label>
                <Input placeholder="e.g. GST, VAT" {...taxForm.register("taxName")} className="h-8 text-xs" />
                {taxForm.formState.errors.taxName && <p className="text-[10px] text-red-500">{taxForm.formState.errors.taxName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tax Rate (%)</Label>
                <div className="relative">
                  <Input type="number" step="0.01" min="0" max="100" placeholder="17" className="h-8 text-xs pr-8" {...taxForm.register("taxRate", { valueAsNumber: true })} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                <div>
                  <p className="text-xs font-medium text-slate-800">Enable Tax</p>
                  <p className="text-[10px] text-slate-400">Apply tax to all new transactions</p>
                </div>
                <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} className="data-[state=checked]:bg-blue-600" />
              </div>
              <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs min-w-[120px]">
                {saving ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5 inline-block" />Saving…</> : "Save Tax Settings"}
              </Button>
            </form>
          </SectionCard>
        </TabsContent>

        {/* ════ TAB 3 — INVOICE ════ */}
        <TabsContent value="invoice" className="mt-3">
          <SectionCard
            title={<span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-blue-600" />Invoice Settings</span>}
            description="Customize how your invoices look and are numbered"
            className="max-w-lg"
          >
            <form onSubmit={invoiceForm.handleSubmit(onInvoiceSubmit)} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Invoice Prefix</Label>
                  <Input placeholder="INV" {...invoiceForm.register("prefix")} className="h-8 text-xs" />
                  {invoiceForm.formState.errors.prefix && <p className="text-[10px] text-red-500">{invoiceForm.formState.errors.prefix.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Next Invoice Number</Label>
                  <Input placeholder="2026-0053" {...invoiceForm.register("nextNumber")} className="h-8 text-xs" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invoice Footer Text</Label>
                <Textarea placeholder="Thank you for your business!" rows={2} className="resize-none text-xs" {...invoiceForm.register("footerText")} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Terms & Conditions</Label>
                <Textarea placeholder="All sales are final..." rows={2} className="resize-none text-xs" {...invoiceForm.register("termsText")} />
              </div>
              <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                <div>
                  <p className="text-xs font-medium text-slate-800">Show logo on invoice</p>
                  <p className="text-[10px] text-slate-400">Logo appears at the top of every invoice</p>
                </div>
                <Switch checked={showLogoOnInvoice} onCheckedChange={setShowLogoOnInvoice} className="data-[state=checked]:bg-blue-600" />
              </div>
              <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs min-w-[140px]">
                {saving ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5 inline-block" />Saving…</> : "Save Invoice Settings"}
              </Button>
            </form>
          </SectionCard>
        </TabsContent>

        {/* ════ TAB 4 — USERS ════ */}
        <TabsContent value="users" className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">Team Members</p>
              <p className="text-[10px] text-slate-400">{users.length} users registered</p>
            </div>
            <Button onClick={openAddUser} size="sm" className="h-8 text-xs gap-1.5 px-3">
              <Plus className="w-3.5 h-3.5" />Add User
            </Button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-125">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">User</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Last Login</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <UserAvatar name={user.name} id={user.id} />
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{user.name}</p>
                            <p className="text-[10px] text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${roleBadgeCls[user.role]}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
                          user.status === "Active" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.status === "Active" ? "bg-blue-500" : "bg-slate-400"}`} />
                          {user.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 whitespace-nowrap">{user.lastLogin}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-0.5 justify-end">
                          <button onClick={() => openEditUser(user)} title="Edit" className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setToggleTarget(user)} title={user.status === "Active" ? "Deactivate" : "Activate"} className="p-1 rounded-md hover:bg-slate-100 transition-colors">
                            <Power className={`w-3.5 h-3.5 ${user.status === "Active" ? "text-red-400 hover:text-red-600" : "text-emerald-500 hover:text-emerald-600"}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add/Edit User Dialog */}
          <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold">{editUser ? "Edit User" : "Add New User"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-2.5 mt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name</Label>
                  <Input placeholder="e.g. Ahmed Khan" {...userForm.register("name")} className="h-8 text-xs" />
                  {userForm.formState.errors.name && <p className="text-[10px] text-red-500">{userForm.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" placeholder="user@mobitrack.com" {...userForm.register("email")} className="h-8 text-xs" />
                  {userForm.formState.errors.email && <p className="text-[10px] text-red-500">{userForm.formState.errors.email.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Role</Label>
                    <Select defaultValue={userForm.getValues("role")} onValueChange={(v) => userForm.setValue("role", v as UserRole)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Manager">Manager</SelectItem>
                        <SelectItem value="Cashier">Cashier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Password {editUser && <span className="text-slate-400 font-normal">(blank = keep)</span>}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...userForm.register("password")}
                        className="h-8 text-xs pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {userForm.formState.errors.password && <p className="text-[10px] text-red-500">{userForm.formState.errors.password.message}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                  <div>
                    <p className="text-xs font-medium text-slate-800">Active Status</p>
                    <p className="text-[10px] text-slate-400">User can log in and use the system</p>
                  </div>
                  <Switch checked={userForm.watch("status")} onCheckedChange={(v) => userForm.setValue("status", v)} className="data-[state=checked]:bg-blue-600" />
                </div>
                <DialogFooter className="gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" size="sm" className="h-8 text-xs">{editUser ? "Save Changes" : "Add User"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <ConfirmDialog
            open={!!toggleTarget} onOpenChange={(open) => !open && setToggleTarget(null)}
            title={toggleTarget?.status === "Active" ? "Deactivate User" : "Activate User"}
            description={toggleTarget?.status === "Active" ? `${toggleTarget?.name} will no longer be able to log in.` : `${toggleTarget?.name} will be able to log in again.`}
            confirmLabel={toggleTarget?.status === "Active" ? "Deactivate" : "Activate"}
            variant={toggleTarget?.status === "Active" ? "destructive" : "default"}
            onConfirm={confirmToggleStatus}
          />
        </TabsContent>

        {/* ════ TAB 5 — DATA ════ */}
        <TabsContent value="data" className="mt-3 space-y-2.5">
          {/* Info chips */}
          <div className="flex gap-2">
            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
              <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
                <Database className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Database Size</p>
                <p className="text-xs font-bold text-slate-800">2.4 MB</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2 shadow-sm">
              <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400">Last Backup</p>
                <p className="text-xs font-bold text-slate-800">2026-03-11 at 14:32</p>
              </div>
            </div>
          </div>

          {/* Action cards */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Export */}
            <div className="bg-white rounded-xl border border-blue-200 p-3 flex flex-col gap-2 bg-linear-to-br from-blue-50 to-white">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Download className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-900">Export All Data</p>
                <p className="text-[10px] text-blue-700/70 mt-0.5">Download a complete CSV backup of all inventory, sales, customers, and transactions.</p>
              </div>
              <Button onClick={() => toast.success("Export started")} size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 mt-auto">
                <Download className="w-3 h-3" />Export CSV
              </Button>
            </div>

            {/* Import */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Import Data</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Upload a CSV file to bulk import products, customers, or transactions.</p>
              </div>
              <Button onClick={() => importFileRef.current?.click()} size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 mt-auto">
                <Upload className="w-3 h-3" />Upload File
              </Button>
              <input ref={importFileRef} type="file" accept=".csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { toast.success(`${f.name} queued`); e.target.value = "" } }} />
            </div>

            {/* Reset */}
            <div className="bg-white rounded-xl border border-red-200 p-3 flex flex-col gap-2 bg-linear-to-br from-red-50 to-white">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                <RotateCcw className="w-3.5 h-3.5 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-red-900">Reset Demo Data</p>
                <p className="text-[10px] text-red-700/70 mt-0.5">Restore all data to factory defaults. This is irreversible.</p>
              </div>
              <Button variant="destructive" size="sm" className="h-7 text-xs gap-1 mt-auto" onClick={() => setResetDialogOpen(true)}>
                <RotateCcw className="w-3 h-3" />Reset to Defaults
              </Button>
            </div>
          </div>

          <ConfirmDialog
            open={resetDialogOpen} onOpenChange={setResetDialogOpen}
            title="Reset All Demo Data?"
            description="This will reset ALL data to defaults. This action cannot be undone. All sales, inventory, customer records, and settings will be permanently erased."
            confirmLabel="Yes, Reset Everything" cancelLabel="Cancel" variant="destructive"
            onConfirm={() => { setResetDialogOpen(false); toast.success("Demo data reset") }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

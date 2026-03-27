"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Trash2, Search, Package, Smartphone, Building2, ShoppingCart,
  ChevronLeft, CreditCard, AlertCircle, Headphones, Hash,
} from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { getSuppliers } from "@/lib/api/suppliers"
import { createPurchase } from "@/lib/api/purchases"
import type { Supplier } from "@/data/types"

import { PageWrapper } from "@/components/layout/page-wrapper"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, generatePONumber } from "@/lib/utils"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MobileLineItem {
  id: string
  type: "Mobile"
  brand: string
  model: string
  color: string
  storage: string
  ram: string
  category: string
  condition: string
  imei: string
  buyPrice: number
  sellPrice: number
}

interface AccessoryLineItem {
  id: string
  type: "Accessory"
  name: string
  brand: string
  category: string
  quantity: number
  buyPrice: number
  sellPrice: number
}

type PurchaseLineItem = MobileLineItem | AccessoryLineItem

function uid() {
  return `li-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewPurchasePage() {
  const router = useRouter()

  // ── Data loading ──────────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Dynamic dropdown data
  const [brands, setBrands] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [storageOpts, setStorageOpts] = useState<string[]>([])
  const [ramOpts, setRamOpts] = useState<string[]>([])
  const [mobileCategories, setMobileCategories] = useState<string[]>([])
  const [accessoryCategories, setAccessoryCategories] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      try {
        setDataLoading(true)
        const tenantId = await getTenantId()
        const [suppData, brandsRes, colorsRes, storageRes, ramRes, catRes] = await Promise.all([
          getSuppliers(),
          supabase.from("brands").select("name").eq("tenant_id", tenantId).eq("status", "Active").order("name"),
          supabase.from("colors").select("name").eq("tenant_id", tenantId).order("name"),
          supabase.from("storage_options").select("name").eq("tenant_id", tenantId).order("name"),
          supabase.from("ram_options").select("name").eq("tenant_id", tenantId).order("name"),
          supabase.from("categories").select("name, type").eq("tenant_id", tenantId).order("name"),
        ])
        setSuppliers(suppData)
        if (brandsRes.data) setBrands(brandsRes.data.map(d => d.name))
        if (colorsRes.data) setColors(colorsRes.data.map(d => d.name))
        if (storageRes.data) setStorageOpts(storageRes.data.map(d => d.name))
        if (ramRes.data) setRamOpts(ramRes.data.map(d => d.name))
        if (catRes.data) {
          setMobileCategories(catRes.data.filter(c => c.type === "Mobile" || c.type === "Both").map(c => c.name))
          setAccessoryCategories(catRes.data.filter(c => c.type === "Accessory" || c.type === "Both").map(c => c.name))
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setDataLoading(false)
      }
    }
    load()
  }, [])

  // ── Inline Add handlers ─────────────────────────────────────────────────
  async function handleAddBrand(name: string): Promise<boolean> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("brands").insert({ tenant_id: tenantId, name, logo_initials: name.substring(0, 2).toUpperCase(), status: "Active" })
    if (error) { toast.error("Failed: " + error.message); return false }
    setBrands(prev => [...new Set([...prev, name])].sort())
    toast.success(`Brand "${name}" added!`); return true
  }
  async function handleAddColor(name: string): Promise<boolean> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("colors").insert({ tenant_id: tenantId, name })
    if (error) { toast.error("Failed: " + error.message); return false }
    setColors(prev => [...new Set([...prev, name])].sort())
    toast.success(`Color "${name}" added!`); return true
  }
  async function handleAddStorage(name: string): Promise<boolean> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("storage_options").insert({ tenant_id: tenantId, name })
    if (error) { toast.error("Failed: " + error.message); return false }
    setStorageOpts(prev => [...new Set([...prev, name])].sort())
    toast.success(`Storage "${name}" added!`); return true
  }
  async function handleAddRam(name: string): Promise<boolean> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("ram_options").insert({ tenant_id: tenantId, name })
    if (error) { toast.error("Failed: " + error.message); return false }
    setRamOpts(prev => [...new Set([...prev, name])].sort())
    toast.success(`RAM "${name}" added!`); return true
  }
  async function handleAddCategory(name: string, type: string): Promise<boolean> {
    const tenantId = await getTenantId()
    const { error } = await supabase.from("categories").insert({ tenant_id: tenantId, name, type, item_count: 0 })
    if (error) { toast.error("Failed: " + error.message); return false }
    if (type === "Mobile" || type === "Both") setMobileCategories(prev => [...new Set([...prev, name])].sort())
    if (type === "Accessory" || type === "Both") setAccessoryCategories(prev => [...new Set([...prev, name])].sort())
    toast.success(`Category "${name}" added!`); return true
  }

  // ── Section 1: Supplier ─────────────────────────────────────────────────
  const [supplierSearch, setSupplierSearch] = useState("")
  const [selectedSupplierId, setSelectedSupplierId] = useState("")
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false)

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.toLowerCase().trim()
    if (!q) return suppliers
    return suppliers.filter(s =>
      s.companyName.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q)
    )
  }, [supplierSearch, suppliers])

  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === selectedSupplierId),
    [selectedSupplierId, suppliers]
  )

  // ── Section 2: Item Adder ───────────────────────────────────────────────
  const [itemTab, setItemTab] = useState<"Mobile" | "Accessory">("Mobile")
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([])

  // Mobile form state
  const [mBrand, setMBrand] = useState("")
  const [mModel, setMModel] = useState("")
  const [mColor, setMColor] = useState("")
  const [mStorage, setMStorage] = useState("")
  const [mRam, setMRam] = useState("")
  const [mCategory, setMCategory] = useState("")
  const [mCondition, setMCondition] = useState("New")
  const [mImei, setMImei] = useState("")
  const [mBuyPrice, setMBuyPrice] = useState("")
  const [mSellPrice, setMSellPrice] = useState("")

  // Accessory form state
  const [aName, setAName] = useState("")
  const [aBrand, setABrand] = useState("")
  const [aCategory, setACategory] = useState("")
  const [aQty, setAQty] = useState("1")
  const [aBuyPrice, setABuyPrice] = useState("")
  const [aSellPrice, setASellPrice] = useState("")

  // Inline add toggles
  const [showNew, setShowNew] = useState<Record<string, boolean>>({})
  const [newVal, setNewVal] = useState<Record<string, string>>({})

  function toggleNew(key: string) { setShowNew(p => ({ ...p, [key]: !p[key] })); setNewVal(p => ({ ...p, [key]: "" })) }
  function closeNew(key: string) { setShowNew(p => ({ ...p, [key]: false })); setNewVal(p => ({ ...p, [key]: "" })) }

  function resetMobileForm(keepContext = false) {
    if (!keepContext) { setMBrand(""); setMCategory(""); setMCondition("New"); setMColor(""); setMStorage(""); setMRam("") }
    setMModel(""); setMImei(""); setMBuyPrice(""); setMSellPrice("")
  }
  function resetAccessoryForm() {
    setAName(""); setABrand(""); setACategory(""); setAQty("1"); setABuyPrice(""); setASellPrice("")
  }

  function handleAddMobile() {
    if (!mBrand) { toast.error("Select a brand"); return }
    if (!mModel.trim()) { toast.error("Enter model name"); return }
    if (!mImei.trim() || mImei.trim().length !== 15 || !/^\d{15}$/.test(mImei.trim())) {
      toast.error("IMEI must be exactly 15 digits"); return
    }
    if (lineItems.some(i => i.type === "Mobile" && i.imei === mImei.trim())) {
      toast.error("This IMEI is already added"); return
    }
    const buy = parseFloat(mBuyPrice) || 0
    const sell = parseFloat(mSellPrice) || 0
    if (buy <= 0) { toast.error("Enter a valid buy price"); return }

    const item: MobileLineItem = {
      id: uid(), type: "Mobile", brand: mBrand, model: mModel.trim(),
      color: mColor, storage: mStorage, ram: mRam, category: mCategory,
      condition: mCondition, imei: mImei.trim(), buyPrice: buy, sellPrice: sell,
    }
    setLineItems(prev => [...prev, item])
    toast.success(`${mBrand} ${mModel.trim()} added`)
    resetMobileForm(true)
  }

  function handleAddAccessory() {
    if (!aName.trim()) { toast.error("Enter accessory name"); return }
    const buy = parseFloat(aBuyPrice) || 0
    const sell = parseFloat(aSellPrice) || 0
    const qty = parseInt(aQty, 10) || 0
    if (buy <= 0) { toast.error("Enter a valid buy price"); return }
    if (qty < 1) { toast.error("Quantity must be at least 1"); return }

    const item: AccessoryLineItem = {
      id: uid(), type: "Accessory", name: aName.trim(), brand: aBrand,
      category: aCategory, quantity: qty, buyPrice: buy, sellPrice: sell,
    }
    setLineItems(prev => [...prev, item])
    toast.success(`${aName.trim()} added`)
    resetAccessoryForm()
  }

  // ── Section 3: Totals ───────────────────────────────────────────────────
  const [shippingCost, setShippingCost] = useState("0")
  const [tax, setTax] = useState("0")
  const [amountPaid, setAmountPaid] = useState("0")
  const [paymentMethod, setPaymentMethod] = useState("Cash")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")

  const subtotal = useMemo(() =>
    lineItems.reduce((sum, item) => sum + (item.type === "Mobile" ? item.buyPrice : item.buyPrice * item.quantity), 0)
  , [lineItems])

  const shippingNum = parseFloat(shippingCost) || 0
  const taxNum = parseFloat(tax) || 0
  const grandTotal = subtotal + shippingNum + taxNum
  const amountPaidNum = parseFloat(amountPaid) || 0
  const balanceDue = Math.max(0, grandTotal - amountPaidNum)
  const paymentStatus = amountPaidNum <= 0 ? "Unpaid" : amountPaidNum >= grandTotal ? "Paid" : "Partial"

  // ── Submit ──────────────────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit() {
    if (submitting) return
    if (!selectedSupplierId) { toast.error("Please select a supplier"); return }
    if (lineItems.length === 0) { toast.error("Add at least one item"); return }
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    if (submitting) return
    setConfirmOpen(false)
    setSubmitting(true)
    const poNumber = generatePONumber(Math.floor(Math.random() * 100) + 50)
    try {
      const tenantId = await getTenantId()

      // Build purchase items for the API
      const purchaseItems = lineItems.map(item => ({
        productId: "",
        productName: item.type === "Mobile" ? `${item.brand} ${item.model}` : item.name,
        productType: item.type,
        quantity: item.type === "Mobile" ? 1 : item.quantity,
        unitCost: item.buyPrice,
        total: item.type === "Mobile" ? item.buyPrice : item.buyPrice * item.quantity,
        imeis: item.type === "Mobile" ? [item.imei] : [],
      }))

      const purchaseData = {
        poNumber, date: new Date().toISOString().split("T")[0],
        supplierId: selectedSupplierId,
        supplierName: selectedSupplier?.companyName ?? "",
        subtotal, shippingCost: shippingNum, tax: taxNum, total: grandTotal,
        amountPaid: amountPaidNum, balanceDue, paymentMethod, paymentStatus,
        deliveryStatus: "Received", dueDate: dueDate || null, notes: notes || null,
        items: [],
      }

      await createPurchase(purchaseData as any, purchaseItems as any)

      // Create mobiles + IMEI records for each mobile item
      for (const item of lineItems) {
        if (item.type === "Mobile") {
          await supabase.from("mobiles").insert({
            tenant_id: tenantId, brand: item.brand, model: item.model,
            imei: item.imei, color: item.color || "", storage: item.storage || "",
            ram: item.ram || "", purchase_price: item.buyPrice, selling_price: item.sellPrice,
            supplier_id: selectedSupplierId, stock: 1, condition: item.condition || "New",
            category: item.category || "", date_added: new Date().toISOString().split("T")[0],
          })
          await supabase.from("imei_records").insert({
            tenant_id: tenantId, imei_number: item.imei, brand: item.brand,
            model: item.model, color: item.color || "", storage_capacity: item.storage || "",
            pta_status: "pending", device_status: "in_stock",
            purchase_price: item.buyPrice, selling_price: item.sellPrice,
            supplier_id: selectedSupplierId, supplier_name: selectedSupplier?.companyName ?? "",
            purchase_date: new Date().toISOString().split("T")[0],
          })
        } else {
          await supabase.from("accessories").insert({
            tenant_id: tenantId, name: item.name, brand: item.brand || "",
            sku: `ACC-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            category: item.category || "", purchase_price: item.buyPrice,
            selling_price: item.sellPrice, stock: item.quantity,
            supplier_id: selectedSupplierId, compatible_models: [],
            date_added: new Date().toISOString().split("T")[0],
          })
        }
      }

      // Create payment record if amount was paid
      if (amountPaidNum > 0) {
        await supabase.from("payments").insert({
          tenant_id: tenantId,
          date: new Date().toISOString().split("T")[0],
          type: "Paid",
          entity_type: "Supplier",
          entity_id: selectedSupplierId,
          entity_name: selectedSupplier?.companyName ?? "",
          reference_type: "Purchase",
          reference_number: poNumber,
          amount: amountPaidNum,
          method: paymentMethod,
          status: "Completed",
          processed_by: "Admin",
          notes: `Payment for ${poNumber}`,
        })
      }

      toast.success(`Purchase order ${poNumber} recorded!`, {
        description: `${lineItems.length} item(s) · ${formatCurrency(grandTotal)} · ${paymentStatus}`,
        duration: 5000,
      })
      router.push("/purchases")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create purchase")
      setSubmitting(false)
    }
  }

  // ── Inline Add Field Component ──────────────────────────────────────────
  function InlineAdd({ k, placeholder, onAdd }: { k: string; placeholder: string; onAdd: (name: string) => Promise<boolean> }) {
    if (!showNew[k]) {
      return (
        <button type="button" onClick={() => toggleNew(k)}
          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium mt-1">
          <Plus className="w-3 h-3" /> Add New
        </button>
      )
    }
    return (
      <div className="flex gap-1.5 mt-1">
        <Input placeholder={placeholder} value={newVal[k] || ""} autoFocus
          onChange={e => setNewVal(p => ({ ...p, [k]: e.target.value }))}
          onKeyDown={async e => {
            if (e.key === "Enter" && (newVal[k] || "").trim()) {
              e.preventDefault()
              const ok = await onAdd((newVal[k] || "").trim())
              if (ok) closeNew(k)
            }
          }}
          className="h-7 text-xs flex-1" />
        <Button size="sm" className="h-7 px-2 text-[10px]" disabled={!(newVal[k] || "").trim()}
          onClick={async () => { const ok = await onAdd((newVal[k] || "").trim()); if (ok) closeNew(k) }}>Save</Button>
        <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px]" onClick={() => closeNew(k)}>✕</Button>
      </div>
    )
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (dataLoading) {
    return <PageWrapper><div className="text-center py-20 text-slate-500 text-sm">Loading...</div></PageWrapper>
  }

  const mobileCount = lineItems.filter(i => i.type === "Mobile").length
  const accCount = lineItems.filter(i => i.type === "Accessory").length

  return (
    <PageWrapper>
      <PageHeader title="Create New Purchase" description="Record a new stock purchase from a supplier"
        action={<Link href="/purchases"><Button variant="outline" className="gap-2"><ChevronLeft className="w-4 h-4" /> Back</Button></Link>} />

      <div className="space-y-6">

          {/* ═══ Purchase Items (with Supplier inline) ════════════════════ */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Package className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-[15px] font-semibold text-slate-900">Purchase Items</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">Add individual mobile phones or accessories</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* ── Added Items ─────────────────────────────────────────── */}
              {lineItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Added Items ({lineItems.length})</p>
                  {lineItems.map(item => (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${item.type === "Mobile" ? "bg-blue-100" : "bg-emerald-100"}`}>
                        {item.type === "Mobile" ? <Smartphone className="w-3.5 h-3.5 text-blue-600" /> : <Headphones className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="text-sm font-semibold text-slate-800">
                          {item.type === "Mobile" ? `${item.brand} ${item.model}` : item.name}
                        </span>
                        {item.type === "Mobile" && (
                          <>
                            {item.color && <span className="text-[11px] text-slate-400">{item.color}</span>}
                            {item.storage && <span className="text-[11px] text-slate-400">{item.storage}{item.ram ? `/${item.ram}` : ""}</span>}
                            <span className="text-[11px] text-slate-400 font-mono">IMEI: {item.imei}</span>
                          </>
                        )}
                        {item.type === "Accessory" && (
                          <span className="text-[11px] text-slate-400">Qty: {item.quantity}</span>
                        )}
                        <span className="text-[11px] text-slate-600">Buy: <span className="font-semibold">{formatCurrency(item.buyPrice)}</span></span>
                        {item.sellPrice > 0 && <span className="text-[11px] text-emerald-600">Sell: {formatCurrency(item.sellPrice)}</span>}
                      </div>
                      <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                        onClick={() => setLineItems(p => p.filter(i => i.id !== item.id))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab Switcher */}
              <div className="flex rounded-lg bg-slate-100 p-1 gap-1">
                <button type="button" onClick={() => setItemTab("Mobile")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${itemTab === "Mobile" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
                  <Smartphone className="w-4 h-4" /> Mobile Phone
                </button>
                <button type="button" onClick={() => setItemTab("Accessory")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${itemTab === "Accessory" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-800"}`}>
                  <Headphones className="w-4 h-4" /> Accessory
                </button>
              </div>

              {/* ── Mobile Form ──────────────────────────────────────────── */}
              {itemTab === "Mobile" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-blue-500" /> Add Mobile Phone
                  </p>
                  {/* Row 1: Brand, Model, Color, Storage, RAM, Category, Condition — all in one row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Brand <span className="text-red-500">*</span></Label>
                      <Select value={mBrand} onValueChange={setMBrand}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Brand" /></SelectTrigger>
                        <SelectContent>{brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                      <InlineAdd k="mBrand" placeholder="e.g. Huawei" onAdd={async n => { const ok = await handleAddBrand(n); if (ok) setMBrand(n); return ok }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Model <span className="text-red-500">*</span></Label>
                      <Input placeholder="e.g. Galaxy A54" value={mModel} onChange={e => setMModel(e.target.value)} className="h-9 text-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Color</Label>
                      <Select value={mColor} onValueChange={setMColor}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Color" /></SelectTrigger>
                        <SelectContent>{colors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      <InlineAdd k="mColor" placeholder="e.g. Midnight" onAdd={async n => { const ok = await handleAddColor(n); if (ok) setMColor(n); return ok }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Storage</Label>
                      <Select value={mStorage} onValueChange={setMStorage}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Storage" /></SelectTrigger>
                        <SelectContent>{storageOpts.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <InlineAdd k="mStorage" placeholder="e.g. 512GB" onAdd={async n => { const ok = await handleAddStorage(n); if (ok) setMStorage(n); return ok }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">RAM</Label>
                      <Select value={mRam} onValueChange={setMRam}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="RAM" /></SelectTrigger>
                        <SelectContent>{ramOpts.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                      <InlineAdd k="mRam" placeholder="e.g. 12GB" onAdd={async n => { const ok = await handleAddRam(n); if (ok) setMRam(n); return ok }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Category</Label>
                      <Select value={mCategory} onValueChange={setMCategory}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>{mobileCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      <InlineAdd k="mCat" placeholder="e.g. Gaming" onAdd={async n => { const ok = await handleAddCategory(n, "Mobile"); if (ok) setMCategory(n); return ok }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Condition</Label>
                      <Select value={mCondition} onValueChange={setMCondition}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Refurbished">Refurbished</SelectItem>
                          <SelectItem value="Used">Used</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 2: Supplier, IMEI, Buy Price, Sell Price */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" /> Supplier <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input placeholder="Search supplier..." value={supplierSearch}
                          onChange={e => { setSupplierSearch(e.target.value); setSupplierDropdownOpen(true); if (!e.target.value) setSelectedSupplierId("") }}
                          onFocus={() => setSupplierDropdownOpen(true)} className="h-9 text-sm bg-white" />
                        {supplierDropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {filteredSuppliers.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-slate-400 text-center">No suppliers</div>
                            ) : filteredSuppliers.map(s => (
                              <button key={s.id} type="button" disabled={s.status === "Inactive"}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${s.id === selectedSupplierId ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
                                onClick={() => { setSelectedSupplierId(s.id); setSupplierSearch(s.companyName); setSupplierDropdownOpen(false) }}>
                                <span className="font-medium">{s.companyName}</span>
                                <span className="text-slate-400 ml-1">{s.city}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {supplierDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setSupplierDropdownOpen(false)} />}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <Hash className="w-3 h-3" /> IMEI <span className="text-red-500">*</span>
                      </Label>
                      <Input placeholder="15-digit IMEI" value={mImei} onChange={e => setMImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
                        className="h-9 text-sm bg-white font-mono" maxLength={15} />
                      <p className="text-[10px] text-slate-400">Dial *#06# to find IMEI</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Buy Price (Rs) <span className="text-red-500">*</span></Label>
                      <Input type="number" min={0} placeholder="0" value={mBuyPrice} onChange={e => setMBuyPrice(e.target.value)} className="h-9 text-sm bg-white" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Sell Price (Rs)</Label>
                      <Input type="number" min={0} placeholder="0" value={mSellPrice} onChange={e => setMSellPrice(e.target.value)} className="h-9 text-sm bg-white" />
                    </div>
                  </div>
                  <Button type="button" onClick={handleAddMobile} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9" size="sm">
                    <Plus className="w-4 h-4" /> Add to Purchase List
                  </Button>
                </div>
              )}

              {/* ── Accessory Form ───────────────────────────────────────── */}
              {itemTab === "Accessory" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5 text-blue-500" /> Add Accessory
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Supplier */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" /> Supplier <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input placeholder="Search supplier..." value={supplierSearch}
                          onChange={e => { setSupplierSearch(e.target.value); setSupplierDropdownOpen(true); if (!e.target.value) setSelectedSupplierId("") }}
                          onFocus={() => setSupplierDropdownOpen(true)} className="h-9 text-sm bg-white" />
                        {supplierDropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                            {filteredSuppliers.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-slate-400 text-center">No suppliers</div>
                            ) : filteredSuppliers.map(s => (
                              <button key={s.id} type="button" disabled={s.status === "Inactive"}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${s.id === selectedSupplierId ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
                                onClick={() => { setSelectedSupplierId(s.id); setSupplierSearch(s.companyName); setSupplierDropdownOpen(false) }}>
                                <span className="font-medium">{s.companyName}</span>
                                <span className="text-slate-400 ml-1">{s.city}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {supplierDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setSupplierDropdownOpen(false)} />}
                    </div>
                    {/* Name */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Name <span className="text-red-500">*</span></Label>
                      <Input placeholder="e.g. Galaxy Buds2 Pro" value={aName} onChange={e => setAName(e.target.value)} className="h-9 text-sm bg-white" />
                    </div>
                    {/* Brand */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Brand</Label>
                      <Select value={aBrand} onValueChange={setABrand}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Select brand" /></SelectTrigger>
                        <SelectContent>{brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                      <InlineAdd k="aBrand" placeholder="e.g. Anker" onAdd={async n => { const ok = await handleAddBrand(n); if (ok) setABrand(n); return ok }} />
                    </div>
                    {/* Category */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Category</Label>
                      <Select value={aCategory} onValueChange={setACategory}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>{accessoryCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                      <InlineAdd k="aCat" placeholder="e.g. Earbuds" onAdd={async n => { const ok = await handleAddCategory(n, "Accessory"); if (ok) setACategory(n); return ok }} />
                    </div>
                    {/* Quantity */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Quantity <span className="text-red-500">*</span></Label>
                      <Input type="number" min={1} value={aQty} onChange={e => setAQty(e.target.value)} className="h-9 text-sm bg-white" />
                    </div>
                    {/* Buy Price */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Buy Price (Rs) <span className="text-red-500">*</span></Label>
                      <Input type="number" min={0} placeholder="0" value={aBuyPrice} onChange={e => setABuyPrice(e.target.value)} className="h-9 text-sm bg-white" />
                    </div>
                    {/* Sell Price */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-600">Sell Price (Rs)</Label>
                      <Input type="number" min={0} placeholder="0" value={aSellPrice} onChange={e => setASellPrice(e.target.value)} className="h-9 text-sm bg-white" />
                    </div>
                  </div>
                  <Button type="button" onClick={handleAddAccessory} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9" size="sm">
                    <Plus className="w-4 h-4" /> Add to Purchase List
                  </Button>
                </div>
              )}

              {/* Items count summary */}
              {lineItems.length > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{mobileCount} mobile(s) · {accCount} accessory(ies) · {lineItems.length} total</span>
                  <span className="font-semibold text-slate-700">Subtotal: {formatCurrency(subtotal)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══ SECTION 3: Totals & Payment ═══════════════════════════════ */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-[15px] font-semibold text-slate-900">Totals & Payment</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">Review costs and record payment details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Row 1: All 7 fields in one row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Subtotal</Label>
                  <div className="h-9 flex items-center px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">{formatCurrency(subtotal)}</div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Shipping (Rs)</Label>
                  <Input type="number" min={0} value={shippingCost} onChange={e => setShippingCost(e.target.value)} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Tax / Other (Rs)</Label>
                  <Input type="number" min={0} value={tax} onChange={e => setTax(e.target.value)} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Grand Total</Label>
                  <div className="h-9 flex items-center px-3 rounded-lg border-2 border-blue-300 bg-blue-50 text-sm font-bold text-blue-800">{formatCurrency(grandTotal)}</div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Paid (Rs)</Label>
                  <Input type="number" min={0} value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="h-9 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Balance Due</Label>
                  <div className={`h-9 flex items-center px-3 rounded-lg border text-sm font-bold ${balanceDue > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                    {balanceDue > 0 ? formatCurrency(balanceDue) : "—"}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="JazzCash">JazzCash</SelectItem>
                      <SelectItem value="EasyPaisa">EasyPaisa</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Due date — only when balance > 0 */}
              {balanceDue > 0 && (
                <div className="max-w-xs space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Payment Due Date</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-sm" />
                </div>
              )}
              {/* Row 2: Notes + Record Purchase button */}
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs font-medium text-slate-700">Notes <span className="text-xs text-slate-400 font-normal ml-1">(optional)</span></Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." className="h-9 text-sm" />
                </div>
                <Button type="button" onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9 px-6 shrink-0">
                  <ShoppingCart className="w-4 h-4" /> {submitting ? "Saving..." : "Record Purchase"}
                </Button>
              </div>
            </CardContent>
          </Card>
      </div>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Confirm Purchase Order"
        description={`Record this purchase? ${selectedSupplier ? `Supplier: ${selectedSupplier.companyName}. ` : ""}${lineItems.length} item(s) · Grand Total: ${formatCurrency(grandTotal)} · Payment: ${paymentStatus}.`}
        confirmLabel="Yes, Record Purchase" cancelLabel="Review Again" onConfirm={handleConfirm} />
    </PageWrapper>
  )
}

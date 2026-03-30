"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Search, Trash2, Plus, ShoppingCart, Smartphone, Package,
  User, UserPlus, ChevronLeft, Headphones,
} from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { getCustomers, createCustomer } from "@/lib/api/customers"
import { getMobiles, getAccessories } from "@/lib/api/products"
import { createSale } from "@/lib/api/sales"
import type { Customer, Mobile, Accessory } from "@/data/types"
import { formatCurrency, generateInvoiceNumber } from "@/lib/utils"

import { PageWrapper } from "@/components/layout/page-wrapper"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  id: string
  productId: string
  productName: string
  productType: "Mobile" | "Accessory"
  quantity: number
  unitPrice: number
  discount: number
  lineTotal: number
  imei?: string
  color?: string
  storage?: string
}

type ProductResult = {
  id: string
  name: string
  type: "Mobile" | "Accessory"
  price: number
  stock: number
  imei?: string
  color?: string
  storage?: string
}

function uid() {
  return `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewSalePage() {
  const router = useRouter()

  // ── Data ────────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([])
  const [mobiles, setMobiles] = useState<Mobile[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [c, m, a] = await Promise.all([getCustomers(), getMobiles(), getAccessories()])
        setCustomers(c); setMobiles(m); setAccessories(a)
      } catch { toast.error("Failed to load data") }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // ── Customer ────────────────────────────────────────────────────────────
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing">("walkin")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)

  // New customer inline
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim()
    if (!q) return customers.slice(0, 10)
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    ).slice(0, 10)
  }, [customerSearch, customers])

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [selectedCustomerId, customers]
  )

  async function handleCreateCustomer() {
    if (!newName.trim() || !newPhone.trim()) { toast.error("Name and phone required"); return }
    try {
      const created = await createCustomer({
        name: newName.trim(), phone: newPhone.trim(), email: "", address: "",
        totalPurchases: 0, totalSpent: 0, lastPurchaseDate: new Date().toISOString().split("T")[0], loyaltyTier: "Bronze",
      } as any)
      setCustomers(prev => [created, ...prev])
      setSelectedCustomerId(created.id)
      setCustomerMode("existing")
      setCustomerSearch(created.name)
      setShowNewCustomer(false)
      setNewName(""); setNewPhone("")
      toast.success(`Customer "${created.name}" created!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create customer")
    }
  }

  // ── Products ────────────────────────────────────────────────────────────
  const [productSearch, setProductSearch] = useState("")
  const [productDropdownOpen, setProductDropdownOpen] = useState(false)

  const productResults = useMemo((): ProductResult[] => {
    const q = productSearch.toLowerCase().trim()
    const mResults: ProductResult[] = mobiles
      .filter(m => m.stock > 0 && (!q || `${m.brand} ${m.model}`.toLowerCase().includes(q) || m.imei.includes(q) || m.color.toLowerCase().includes(q) || m.storage.toLowerCase().includes(q)))
      .map(m => ({
        id: m.id, name: `${m.brand} ${m.model}`, type: "Mobile" as const,
        price: m.sellingPrice, stock: m.stock, imei: m.imei,
        color: m.color, storage: m.storage,
      }))
    const aResults: ProductResult[] = accessories
      .filter(a => a.stock > 0 && (!q || `${a.name} ${a.brand} ${a.category}`.toLowerCase().includes(q)))
      .map(a => ({
        id: a.id, name: `${a.name} — ${a.brand}`, type: "Accessory" as const,
        price: a.sellingPrice, stock: a.stock,
      }))
    return [...mResults, ...aResults].slice(0, 20)
  }, [productSearch, mobiles, accessories])

  // ── Cart ────────────────────────────────────────────────────────────────
  const [cartItems, setCartItems] = useState<CartItem[]>([])

  function addToCart(p: ProductResult) {
    // For mobiles, each unit is separate (has unique IMEI)
    if (p.type === "Mobile") {
      if (cartItems.some(c => c.productId === p.id)) {
        toast.error("This mobile is already in cart"); return
      }
      setCartItems(prev => [...prev, {
        id: uid(), productId: p.id, productName: p.name,
        productType: "Mobile", quantity: 1, unitPrice: p.price,
        discount: 0, lineTotal: p.price,
        imei: p.imei, color: p.color, storage: p.storage,
      }])
    } else {
      // Accessories can stack
      const existing = cartItems.find(c => c.productId === p.id)
      if (existing) {
        if (existing.quantity >= p.stock) { toast.error("Max stock reached"); return }
        setCartItems(prev => prev.map(c =>
          c.id === existing.id ? { ...c, quantity: c.quantity + 1, lineTotal: (c.quantity + 1) * c.unitPrice - c.discount } : c
        ))
      } else {
        setCartItems(prev => [...prev, {
          id: uid(), productId: p.id, productName: p.name,
          productType: "Accessory", quantity: 1, unitPrice: p.price,
          discount: 0, lineTotal: p.price,
        }])
      }
    }
    setProductSearch("")
    setProductDropdownOpen(false)
    toast.success(`${p.name} added to cart`)
  }

  function removeFromCart(id: string) {
    setCartItems(prev => prev.filter(c => c.id !== id))
  }

  function updateQty(id: string, qty: number) {
    if (qty < 1) return
    setCartItems(prev => prev.map(c =>
      c.id === id ? { ...c, quantity: qty, lineTotal: qty * c.unitPrice - c.discount } : c
    ))
  }

  // ── Totals ──────────────────────────────────────────────────────────────
  const [overallDiscount, setOverallDiscount] = useState("0")
  const [taxAmount, setTaxAmount] = useState("0")
  const [amountReceived, setAmountReceived] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("Cash")
  const [notes, setNotes] = useState("")

  const subtotal = useMemo(() => cartItems.reduce((s, i) => s + i.lineTotal, 0), [cartItems])
  const discountNum = parseFloat(overallDiscount) || 0
  const taxNum = parseFloat(taxAmount) || 0
  const grandTotal = Math.max(0, subtotal - discountNum + taxNum)
  const receivedNum = parseFloat(amountReceived) || 0
  const changeDue = receivedNum - grandTotal

  // ── Submit ──────────────────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function handleSubmit() {
    if (submitting) return
    if (cartItems.length === 0) { toast.error("Add items to cart first"); return }
    if (customerMode === "existing" && !selectedCustomerId) { toast.error("Select a customer"); return }
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    if (submitting) return
    setConfirmOpen(false)
    setSubmitting(true)

    try {
      const tenantId = await getTenantId()
      const invoiceNumber = generateInvoiceNumber(Math.floor(Math.random() * 100) + 1)
      const custName = customerMode === "walkin" ? "Walk-in Customer" : selectedCustomer?.name ?? ""
      const custPhone = customerMode === "walkin" ? "" : selectedCustomer?.phone ?? ""

      const saleData = {
        invoiceNumber,
        date: new Date().toISOString().split("T")[0],
        customerId: customerMode === "walkin" ? "" : selectedCustomerId,
        customerName: custName,
        customerPhone: custPhone,
        subtotal, discount: discountNum, tax: taxNum, total: grandTotal,
        paymentMethod, amountReceived: receivedNum,
        changeDue: Math.max(0, changeDue),
        status: "Completed",
        notes: notes || undefined,
        items: [],
      }

      const saleItems = cartItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        productType: item.productType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        lineTotal: item.lineTotal,
      }))

      await createSale(saleData as any, saleItems as any)

      // Decrement stock for sold items
      for (const item of cartItems) {
        if (item.productType === "Mobile") {
          await supabase.from("mobiles").update({ stock: 0 }).eq("id", item.productId).eq("tenant_id", tenantId)
          // Update IMEI record status
          if (item.imei) {
            await supabase.from("imei_records")
              .update({ device_status: "sold", sold_date: new Date().toISOString().split("T")[0], customer_name: custName, customer_phone: custPhone })
              .eq("imei_number", item.imei).eq("tenant_id", tenantId)
          }
        } else {
          // Decrement accessory stock
          const acc = accessories.find(a => a.id === item.productId)
          if (acc) {
            await supabase.from("accessories").update({ stock: Math.max(0, acc.stock - item.quantity) }).eq("id", item.productId).eq("tenant_id", tenantId)
          }
        }
      }

      // Create payment record
      if (receivedNum > 0 && customerMode === "existing" && selectedCustomerId) {
        await supabase.from("payments").insert({
          tenant_id: tenantId, date: new Date().toISOString().split("T")[0],
          type: "Received", entity_type: "Customer", entity_id: selectedCustomerId,
          entity_name: custName, reference_type: "Sale", reference_number: invoiceNumber,
          amount: receivedNum, method: paymentMethod, status: "Completed",
          notes: `Payment for ${invoiceNumber}`,
        })
      }

      toast.success(`Sale ${invoiceNumber} completed!`, {
        description: `${cartItems.length} item(s) · ${formatCurrency(grandTotal)}`,
        duration: 5000,
      })
      router.push("/sales")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create sale")
      setSubmitting(false)
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return <PageWrapper><div className="text-center py-20 text-slate-500 text-sm">Loading...</div></PageWrapper>
  }

  return (
    <PageWrapper>
      <PageHeader title="New Sale" description="Create a new sales transaction"
        action={<Link href="/sales"><Button variant="outline" className="gap-2"><ChevronLeft className="w-4 h-4" /> Back</Button></Link>} />

      <div className="space-y-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-[15px] font-semibold text-slate-900">Point of Sale</CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">Select customer, add products, and complete sale</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* ── Row 1: Customer ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Customer Type</Label>
                <Select value={customerMode} onValueChange={(v: "walkin" | "existing") => { setCustomerMode(v); if (v === "walkin") { setSelectedCustomerId(""); setCustomerSearch("") } }}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walkin">Walk-in Customer</SelectItem>
                    <SelectItem value="existing">Existing Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {customerMode === "existing" && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Customer <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <Input placeholder="Search by name or phone..." value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); if (!e.target.value) setSelectedCustomerId("") }}
                      onFocus={() => setCustomerDropdownOpen(true)} className="h-9 text-sm pl-9" />
                    {customerDropdownOpen && customerSearch.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {filteredCustomers.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-400 text-center">No customers found</div>
                        ) : filteredCustomers.map(c => (
                          <button key={c.id} type="button"
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 ${c.id === selectedCustomerId ? "bg-blue-50 text-blue-700" : "text-slate-700"}`}
                            onClick={() => { setSelectedCustomerId(c.id); setCustomerSearch(c.name); setCustomerDropdownOpen(false) }}>
                            <span className="font-medium">{c.name}</span>
                            <span className="text-slate-400 ml-2">{c.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {customerDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setCustomerDropdownOpen(false)} />}
                </div>
              )}

              {customerMode === "existing" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-600">&nbsp;</Label>
                  {!showNewCustomer ? (
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs w-full" onClick={() => setShowNewCustomer(true)}>
                      <UserPlus className="w-3.5 h-3.5" /> New Customer
                    </Button>
                  ) : (
                    <div className="flex gap-1.5">
                      <Input placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} className="h-9 text-xs flex-1" />
                      <Input placeholder="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="h-9 text-xs w-28" />
                      <Button size="sm" className="h-9 px-2 text-[10px]" onClick={handleCreateCustomer}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-9 px-1.5" onClick={() => setShowNewCustomer(false)}>✕</Button>
                    </div>
                  )}
                </div>
              )}

              {selectedCustomer && (
                <div className="sm:col-span-4 flex items-center gap-3 text-xs text-slate-500 bg-blue-50 rounded-lg px-3 py-2">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-slate-800">{selectedCustomer.name}</span>
                  <span>{selectedCustomer.phone}</span>
                  <Badge variant="outline" className="text-[10px]">{selectedCustomer.loyaltyTier}</Badge>
                  <span>Total Spent: {formatCurrency(selectedCustomer.totalSpent)}</span>
                </div>
              )}
            </div>

            {/* ── Row 2: Product Search ───────────────────────────────── */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Search className="w-3 h-3" /> Search Products
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input placeholder="Search by name, brand, model, IMEI..." value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setProductDropdownOpen(true) }}
                  onFocus={() => setProductDropdownOpen(true)}
                  className="h-10 pl-10 text-sm" />
                {productDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-y-auto">
                    {productResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400 text-center">No in-stock products found</div>
                    ) : (
                      <>
                        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            {productSearch.trim() ? `${productResults.length} result(s)` : `All In-Stock Products (${productResults.length})`}
                          </span>
                        </div>
                        {productResults.map(p => (
                          <button key={p.id + (p.imei || "")} type="button"
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                            onClick={() => addToCart(p)}>
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${p.type === "Mobile" ? "bg-blue-100" : "bg-emerald-100"}`}>
                              {p.type === "Mobile" ? <Smartphone className="w-4 h-4 text-blue-600" /> : <Headphones className="w-4 h-4 text-emerald-600" />}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="font-medium text-slate-800 block truncate">{p.name}</span>
                              <span className="text-[11px] text-slate-400 flex flex-wrap gap-x-2">
                                <span className={`font-semibold ${p.type === "Mobile" ? "text-blue-600" : "text-emerald-600"}`}>{p.type}</span>
                                <span className="font-bold text-slate-700">{formatCurrency(p.price)}</span>
                                <span>Stock: {p.stock}</span>
                                {p.imei && <span className="font-mono">IMEI: {p.imei}</span>}
                                {p.color && <span>{p.color}</span>}
                                {p.storage && <span>{p.storage}</span>}
                              </span>
                            </span>
                            <Plus className="w-4 h-4 text-blue-500 shrink-0" />
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              {productDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setProductDropdownOpen(false)} />}
            </div>

            {/* ── Cart Items ──────────────────────────────────────────── */}
            {cartItems.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cart ({cartItems.length} items)</p>
                {cartItems.map(item => (
                  <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${item.productType === "Mobile" ? "bg-blue-100" : "bg-emerald-100"}`}>
                      {item.productType === "Mobile" ? <Smartphone className="w-3.5 h-3.5 text-blue-600" /> : <Headphones className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="text-sm font-semibold text-slate-800">{item.productName}</span>
                      {item.color && <span className="text-[11px] text-slate-400">{item.color}</span>}
                      {item.storage && <span className="text-[11px] text-slate-400">{item.storage}</span>}
                      {item.imei && <span className="text-[11px] text-slate-400 font-mono">IMEI: {item.imei}</span>}
                    </div>
                    {item.productType === "Accessory" && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">−</button>
                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50">+</button>
                      </div>
                    )}
                    <span className="text-sm font-bold text-slate-800 shrink-0">{formatCurrency(item.lineTotal)}</span>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                      onClick={() => removeFromCart(item.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-8 flex flex-col items-center justify-center gap-2 text-center">
                <ShoppingCart className="w-8 h-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-400">Cart is empty</p>
                <p className="text-xs text-slate-300">Search and add products above</p>
              </div>
            )}

            {/* ── Totals Row ──────────────────────────────────────────── */}
            {cartItems.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Subtotal</Label>
                    <div className="h-9 flex items-center px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">{formatCurrency(subtotal)}</div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Discount (Rs)</Label>
                    <Input type="number" min={0} value={overallDiscount} onChange={e => setOverallDiscount(e.target.value)} className="h-9 text-sm" placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Tax (Rs)</Label>
                    <Input type="number" min={0} value={taxAmount} onChange={e => setTaxAmount(e.target.value)} className="h-9 text-sm" placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Grand Total</Label>
                    <div className="h-9 flex items-center px-3 rounded-lg border-2 border-blue-300 bg-blue-50 text-sm font-bold text-blue-800">{formatCurrency(grandTotal)}</div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Received (Rs)</Label>
                    <Input type="number" min={0} value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="h-9 text-sm" placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Change</Label>
                    <div className={`h-9 flex items-center px-3 rounded-lg border text-sm font-bold ${changeDue >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                      {changeDue >= 0 ? formatCurrency(changeDue) : "—"}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Card">Card</SelectItem>
                        <SelectItem value="JazzCash">JazzCash</SelectItem>
                        <SelectItem value="EasyPaisa">EasyPaisa</SelectItem>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes + Complete */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Notes <span className="text-xs text-slate-400 font-normal">(optional)</span></Label>
                    <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any notes..." className="h-9 text-sm" />
                  </div>
                  <Button type="button" onClick={handleSubmit} disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-9 px-6 shrink-0">
                    <ShoppingCart className="w-4 h-4" /> {submitting ? "Processing..." : "Complete Sale"}
                  </Button>
                </div>
              </>
            )}

          </CardContent>
        </Card>
      </div>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}
        title="Confirm Sale"
        description={`Complete this sale? ${cartItems.length} item(s) · Grand Total: ${formatCurrency(grandTotal)} · Payment: ${paymentMethod}`}
        confirmLabel="Yes, Complete Sale" cancelLabel="Review" onConfirm={handleConfirm} />
    </PageWrapper>
  )
}

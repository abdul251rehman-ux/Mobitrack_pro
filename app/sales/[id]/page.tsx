"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Download, Printer, FileText, RotateCcw,
  CheckCircle2, Clock, XCircle, Banknote, CreditCard,
  Smartphone, Building2, Wallet, Package, Tag, User,
  Phone, Calendar, Hash, ShoppingBag,
} from "lucide-react"
import { toast } from "sonner"

import { getSaleById, updateSaleStatus } from "@/lib/api/sales"
import { getTenant } from "@/lib/api/settings"
import { generateInvoicePDF } from "@/lib/pdf/invoice"
import type { ShopInfo } from "@/lib/pdf/invoice"
import type { Sale, SaleItem } from "@/data/types"
import { StatusBadge } from "@/components/shared/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDatePKT } from "@/lib/utils"

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAYMENT_ICONS: Record<string, React.ElementType> = {
  Cash: Banknote,
  Card: CreditCard,
  JazzCash: Smartphone,
  EasyPaisa: Wallet,
  "Bank Transfer": Building2,
}
function PaymentIcon({ method }: { method: string }) {
  const Icon = PAYMENT_ICONS[method] ?? CreditCard
  return <Icon className="w-4 h-4" />
}

const TYPE_STYLES: Record<string, string> = {
  Mobile: "bg-blue-100 text-blue-700",
  UsedPhone: "bg-amber-100 text-amber-700",
  Accessory: "bg-slate-100 text-slate-600",
}

function paymentStatusLabel(sale: Sale) {
  if (sale.amountReceived >= sale.total) return { label: "Paid in Full", color: "bg-emerald-100 text-emerald-700" }
  if (sale.amountReceived > 0) return { label: "Partial Payment", color: "bg-amber-100 text-amber-700" }
  return { label: "Unpaid", color: "bg-red-100 text-red-700" }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SaleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [sale, setSale] = useState<Sale | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmRefund, setConfirmRefund] = useState(false)
  const [shopInfo, setShopInfo] = useState<ShopInfo>({ shopName: "Mobile Shop", shopAddress: "", shopPhone: "" })

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const [data, tenant] = await Promise.all([getSaleById(id), getTenant()])
        if (!data) { toast.error("Sale not found"); router.push("/sales"); return }
        setSale(data)
        if (tenant) setShopInfo({ shopName: tenant.name, shopAddress: tenant.address ?? "", shopPhone: tenant.phone ?? "", shopLogo: tenant.logo ?? "" })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load sale")
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id, router])

  async function handleRefund() {
    if (!sale) return
    try {
      await updateSaleStatus(sale.id, "Refunded")
      setSale(prev => prev ? { ...prev, status: "Refunded" } : prev)
      toast.success("Sale marked as Refunded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refund")
    }
    setConfirmRefund(false)
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-500">Loading invoice…</p>
        </div>
      </div>
    )
  }

  if (!sale) return null

  const outstanding = sale.total - sale.amountReceived
  const payStatus = paymentStatusLabel(sale)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-slate-600 hover:text-slate-900 -ml-1"
          onClick={() => router.push("/sales")}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sales
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            onClick={() => generateInvoicePDF(sale, shopInfo, "save")}
          >
            <Download className="w-3.5 h-3.5" /> Download PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={async () => generateInvoicePDF(sale, shopInfo, "print")}
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={async () => generateInvoicePDF(sale, shopInfo, "preview")}
          >
            <FileText className="w-3.5 h-3.5" /> Preview
          </Button>
          {sale.status === "Completed" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setConfirmRefund(true)}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Refund
            </Button>
          )}
        </div>
      </div>

      {/* ── Invoice header card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Gradient banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-emerald-100 mb-0.5">Invoice Number</p>
                <p className="text-xl font-bold font-mono tracking-wide">{sale.invoiceNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <StatusBadge status={sale.status} />
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${payStatus.color}`}>
                {payStatus.label}
              </span>
            </div>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100">
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Date</p>
            </div>
            <p className="font-semibold text-slate-800 text-sm">{formatDatePKT(sale.date)}</p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <PaymentIcon method={sale.paymentMethod} />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Payment</p>
            </div>
            <p className="font-semibold text-slate-800 text-sm">{sale.paymentMethod}</p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Items</p>
            </div>
            <p className="font-semibold text-slate-800 text-sm">
              {sale.items.length} line{sale.items.length !== 1 ? "s" : ""} ·{" "}
              {sale.items.reduce((s, i) => s + i.quantity, 0)} unit{sale.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Banknote className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Grand Total</p>
            </div>
            <p className="font-bold text-slate-900 text-base">{formatCurrency(sale.total)}</p>
          </div>
        </div>
      </div>

      {/* ── Customer + Payment info ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Customer */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Customer
          </h3>
          <p className="font-bold text-slate-800 text-base">{sale.customerName}</p>
          {sale.customerPhone && (
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
              <Phone className="w-3.5 h-3.5" /> {sale.customerPhone}
            </p>
          )}
        </div>

        {/* Payment summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Banknote className="w-3.5 h-3.5" /> Payment Summary
          </h3>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total</span>
              <span className="font-semibold text-slate-800">{formatCurrency(sale.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Received</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(sale.amountReceived)}</span>
            </div>
            {sale.changeDue > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Change Given</span>
                <span className="font-semibold text-slate-700">{formatCurrency(sale.changeDue)}</span>
              </div>
            )}
            {outstanding > 0 && (
              <div className="flex justify-between text-sm border-t border-slate-100 pt-1.5 mt-1.5">
                <span className="font-semibold text-amber-600">Outstanding</span>
                <span className="font-bold text-amber-600">{formatCurrency(outstanding)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Items ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-700">Items Sold</h3>
          <span className="ml-auto text-xs text-slate-400">{sale.items.length} line{sale.items.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Mobile card layout */}
        <div className="sm:hidden divide-y divide-slate-100">
          {sale.items.map((item: SaleItem, idx: number) => (
            <div key={idx} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 text-sm leading-tight">{item.productName}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_STYLES[item.productType] ?? TYPE_STYLES.Accessory}`}>
                  <Tag className="w-2.5 h-2.5" />
                  {item.productType === "UsedPhone" ? "Used Phone" : item.productType}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Qty: <strong className="text-slate-700">{item.quantity}</strong> × {formatCurrency(item.unitPrice)}</span>
                {item.discount > 0 && <span className="text-red-500">−{formatCurrency(item.discount)}</span>}
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span className="text-xs text-slate-400">Line Total</span>
                <span className="font-bold text-sm text-slate-900">{formatCurrency(item.lineTotal)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 w-8">#</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Unit Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Discount</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item: SaleItem, idx: number) => (
                <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{idx + 1}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-800">{item.productName}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_STYLES[item.productType] ?? TYPE_STYLES.Accessory}`}>
                      {item.productType === "UsedPhone" ? "Used Phone" : item.productType}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-3.5 text-right text-slate-700">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3.5 text-right text-red-500">
                    {item.discount > 0 ? `−${formatCurrency(item.discount)}` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-900">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Totals ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
        <div className="max-w-xs ml-auto space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between text-sm text-red-500">
              <span>Discount</span>
              <span>−{formatCurrency(sale.discount)}</span>
            </div>
          )}
          {sale.tax > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tax</span>
              <span>{formatCurrency(sale.tax)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-base font-bold text-slate-900">
            <span>Total</span>
            <span>{formatCurrency(sale.total)}</span>
          </div>
          <div className="flex justify-between text-sm text-emerald-600">
            <span>Amount Received</span>
            <span className="font-semibold">{formatCurrency(sale.amountReceived)}</span>
          </div>
          {sale.changeDue > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Change Given</span>
              <span>{formatCurrency(sale.changeDue)}</span>
            </div>
          )}
          {outstanding > 0 && (
            <div className="flex justify-between text-sm font-semibold text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-1">
              <span>Outstanding Balance</span>
              <span>{formatCurrency(outstanding)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Notes ── */}
      {sale.notes && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{sale.notes}</p>
        </div>
      )}

      {/* ── Refund confirm ── */}
      <ConfirmDialog
        open={confirmRefund}
        onOpenChange={(open) => !open && setConfirmRefund(false)}
        title="Process Refund"
        description={`Are you sure you want to refund ${sale.invoiceNumber}? This will mark the sale as Refunded.`}
        confirmLabel="Yes, Refund"
        cancelLabel="Cancel"
        onConfirm={handleRefund}
        variant="destructive"
      />
    </div>
  )
}

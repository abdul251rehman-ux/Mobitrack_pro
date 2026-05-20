import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Sale } from "@/data/types"

// ── Brand colours (matches reference template) ───────────────────────────────
const NAVY:   [number, number, number] = [30,  58,  138]   // #1e3a8a
const BLUE:   [number, number, number] = [37,  99,  235]   // #2563eb
const INDIGO: [number, number, number] = [79,  70,  229]   // #4f46e5
const WHITE:  [number, number, number] = [255, 255, 255]
const SLATE9: [number, number, number] = [15,  23,  42]    // #0f172a
const SLATE7: [number, number, number] = [51,  65,  85]    // #334155
const SLATE5: [number, number, number] = [100, 116, 139]   // #64748b
const SLATE4: [number, number, number] = [148, 163, 184]   // #94a3b8
const BG_LT:  [number, number, number] = [248, 250, 255]   // off-white tinted
const BG_BOX: [number, number, number] = [240, 244, 255]   // #f0f4ff
const RED:    [number, number, number] = [220, 38,  38]
const GREEN:  [number, number, number] = [22,  163, 74]

export type ShopInfo = {
  shopName:    string
  shopAddress: string
  shopPhone:   string
  shopEmail?:  string
  shopLogo?:   string   // URL or base64 data URL
}

export type InvoiceOptions = ShopInfo

function formatPKR(n: number) {
  return "Rs " + n.toLocaleString("en-PK")
}

const PKT_FMT = new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" })
function formatDate(d: string) {
  try { return PKT_FMT.format(new Date(d)) } catch { return d }
}

// ── Draw a horizontal gradient rule ─────────────────────────────────────────
function gradientRule(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const steps = 60
  const sw = w / steps
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const r = Math.round(NAVY[0] + (INDIGO[0] - NAVY[0]) * t)
    const g = Math.round(NAVY[1] + (INDIGO[1] - NAVY[1]) * t)
    const b = Math.round(NAVY[2] + (INDIGO[2] - NAVY[2]) * t)
    doc.setFillColor(r, g, b)
    doc.rect(x + i * sw, y, sw + 0.3, h, "F")
  }
}

// ── Rounded rect helper (jsPDF has roundedRect but let's be explicit) ────────
function rr(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, style: "F" | "S" | "FD" = "F") {
  doc.roundedRect(x, y, w, h, r, r, style)
}

export function generateInvoicePDF(
  sale: Sale,
  opts: Partial<InvoiceOptions> = {},
  action: "save" | "print" | "preview" = "save"
): void {
  const shopName    = opts.shopName    || "MobiTrack Pro"
  const shopAddress = opts.shopAddress || ""
  const shopPhone   = opts.shopPhone   || ""
  const shopEmail   = opts.shopEmail   || ""
  const shopLogo    = opts.shopLogo    || ""

  const doc = new jsPDF("p", "mm", "a4")
  const W = 210
  const M = 14   // margin
  let y = 0

  // ══════════════════════════════════════════════════════════════════════
  // 1. HEADER BAND — blue gradient, shop branding on left, contact right
  // ══════════════════════════════════════════════════════════════════════
  const headerH = 38
  // gradient fill
  const hSteps = 80
  for (let i = 0; i < hSteps; i++) {
    const t = i / (hSteps - 1)
    const r = Math.round(NAVY[0] + (BLUE[0] - NAVY[0]) * t * 0.7 + (INDIGO[0] - NAVY[0]) * t * 0.3)
    const g = Math.round(NAVY[1] + (BLUE[1] - NAVY[1]) * t * 0.7 + (INDIGO[1] - NAVY[1]) * t * 0.3)
    const b = Math.round(NAVY[2] + (BLUE[2] - NAVY[2]) * t * 0.7 + (INDIGO[2] - NAVY[2]) * t * 0.3)
    doc.setFillColor(r, g, b)
    doc.rect((i / hSteps) * W, 0, W / hSteps + 0.5, headerH, "F")
  }

  // Decorative circle top-right
  doc.setFillColor(255, 255, 255)
  doc.setGState(new (doc as any).GState({ opacity: 0.05 }))
  doc.circle(W - 30, -20, 55, "F")
  doc.circle(W - 80, 42, 35, "F")
  doc.setGState(new (doc as any).GState({ opacity: 1 }))

  // Logo box — show actual logo if available, otherwise phone-icon placeholder
  if (shopLogo) {
    // white rounded bg behind logo
    doc.setFillColor(255, 255, 255)
    doc.setGState(new (doc as any).GState({ opacity: 0.95 }))
    rr(doc, M, 8, 22, 22, 4, "F")
    doc.setGState(new (doc as any).GState({ opacity: 1 }))
    try {
      const fmt = shopLogo.startsWith("data:image/png") ? "PNG" : "JPEG"
      doc.addImage(shopLogo, fmt, M + 1, 9, 20, 20)
    } catch {
      // if image fails to load (bad URL, CORS), fall back to initials
      doc.setFillColor(...NAVY)
      doc.setGState(new (doc as any).GState({ opacity: 0.9 }))
      rr(doc, M, 8, 22, 22, 4, "F")
      doc.setGState(new (doc as any).GState({ opacity: 1 }))
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(...WHITE)
      const initials = shopName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
      doc.text(initials, M + 11, 21, { align: "center" })
    }
  } else {
    // Placeholder: white-tinted box with initials
    doc.setFillColor(255, 255, 255)
    doc.setGState(new (doc as any).GState({ opacity: 0.15 }))
    rr(doc, M, 8, 22, 22, 4, "F")
    doc.setGState(new (doc as any).GState({ opacity: 1 }))
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(...WHITE)
    const initials = shopName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    doc.text(initials, M + 11, 21, { align: "center" })
  }

  // Shop name
  doc.setTextColor(...WHITE)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.text(shopName, M + 28, 17)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.setGState(new (doc as any).GState({ opacity: 0.55 }))
  doc.text("MANAGEMENT SYSTEM", M + 28, 22)
  doc.setGState(new (doc as any).GState({ opacity: 1 }))

  // Contact info — right side
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text(shopName, W - M, 14, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setGState(new (doc as any).GState({ opacity: 0.65 }))
  doc.setTextColor(...WHITE)
  if (shopPhone)   doc.text(shopPhone,   W - M, 19.5, { align: "right" })
  if (shopAddress) doc.text(shopAddress, W - M, 25,   { align: "right" })
  if (shopEmail)   doc.text(shopEmail,   W - M, 30.5, { align: "right" })
  doc.setGState(new (doc as any).GState({ opacity: 1 }))

  y = headerH

  // ══════════════════════════════════════════════════════════════════════
  // 2. DOC IDENTITY STRIP — "SALES INVOICE" + invoice# / date / status
  // ══════════════════════════════════════════════════════════════════════
  const stripH = 16
  doc.setFillColor(...BG_LT)
  doc.rect(0, y, W, stripH, "F")
  doc.setDrawColor(228, 233, 245)
  doc.setLineWidth(0.3)
  doc.line(0, y, W, y)
  doc.line(0, y + stripH, W, y + stripH)

  // "SALES INVOICE" title
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text("SALES INVOICE", M, y + 10)

  // Meta items right-aligned
  const metas = [
    { label: "INVOICE NO", value: sale.invoiceNumber },
    { label: "DATE",        value: formatDate(sale.date) },
    { label: "STATUS",      value: sale.status.toUpperCase() },
  ]
  let mx = W - M
  metas.reverse().forEach(m => {
    const w = 38
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.setTextColor(...SLATE4)
    doc.text(m.label, mx, y + 5, { align: "right" })
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(m.label === "STATUS" && sale.status === "Completed" ? GREEN[0] : SLATE9[0],
                     m.label === "STATUS" && sale.status === "Completed" ? GREEN[1] : SLATE9[1],
                     m.label === "STATUS" && sale.status === "Completed" ? GREEN[2] : SLATE9[2])
    doc.text(m.value, mx, y + 11, { align: "right" })
    mx -= w + 4
  })

  y += stripH

  // Gradient rule
  gradientRule(doc, 0, y, W, 2)
  y += 2

  // ══════════════════════════════════════════════════════════════════════
  // 3. BODY
  // ══════════════════════════════════════════════════════════════════════
  y += 8

  // ── Party cards (Billed To + Payment Details) ─────────────────────────
  const cardY = y
  const cardW = (W - M * 2 - 6) / 2
  const cardH = 32

  ;[
    {
      label: "BILLED TO",
      name:  sale.customerName || "Walk-in Customer",
      lines: [sale.customerPhone || "", ""],
    },
    {
      label: "PAYMENT DETAILS",
      name:  sale.paymentMethod,
      lines: [`Date: ${formatDate(sale.date)}`, `Ref: ${sale.invoiceNumber}`],
    },
  ].forEach((card, i) => {
    const cx = M + i * (cardW + 6)
    // card bg
    doc.setFillColor(...BG_LT)
    doc.setDrawColor(228, 233, 245)
    doc.setLineWidth(0.3)
    rr(doc, cx, cardY, cardW, cardH, 3, "FD")
    // top accent rule
    gradientRule(doc, cx, cardY, cardW, 2)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.5)
    doc.setTextColor(...BLUE)
    doc.text(card.label, cx + 5, cardY + 7)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(...SLATE9)
    doc.text(card.name, cx + 5, cardY + 15)

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...SLATE5)
    card.lines.filter(Boolean).forEach((l, li) => {
      doc.text(l, cx + 5, cardY + 21 + li * 5)
    })
  })

  y = cardY + cardH + 8

  // ── Items Table ───────────────────────────────────────────────────────
  // Table header bar
  doc.setFillColor(...BG_BOX)
  doc.setDrawColor(228, 233, 245)
  doc.setLineWidth(0.3)
  rr(doc, M, y, W - M * 2, 10, 2, "FD")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...SLATE5)
  doc.text("PRODUCTS & ITEMS", M + 5, y + 6.5)

  // item count badge
  const countText = `${sale.items.length} item${sale.items.length !== 1 ? "s" : ""}`
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...BLUE)
  const badgeX = W - M - 5 - doc.getTextWidth(countText) - 4
  doc.setFillColor(219, 234, 254)
  doc.setDrawColor(191, 219, 254)
  rr(doc, badgeX - 4, y + 1.5, doc.getTextWidth(countText) + 8, 7, 3, "FD")
  doc.text(countText, badgeX, y + 6.5)

  y += 10

  // autoTable
  // usable width = 210 - 14*2 = 182mm
  // col widths:  #=9  Description=auto  IMEI=26  Qty=14  Unit Rate=33  Amount=33
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    tableWidth: W - M * 2,
    head: [["#", "Description", "IMEI / Code", "Qty", "Unit Rate", "Amount"]],
    body: sale.items.map((item, i) => {
      const imeiLine = (item as any).imei ? (item as any).imei : (item.productType === "Mobile" ? "Verified" : "–")
      return [
        String(i + 1).padStart(2, "0"),
        item.productName,
        imeiLine,
        String(item.quantity),
        formatPKR(item.unitPrice),
        formatPKR(item.lineTotal),
      ]
    }),
    headStyles: {
      fillColor: BG_LT,
      textColor: SLATE4,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      lineColor: [228, 233, 245] as [number,number,number],
      lineWidth: 0.3,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: SLATE7,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
      lineColor: [241, 245, 251] as [number,number,number],
      lineWidth: 0.2,
      minCellHeight: 0,
    },
    alternateRowStyles: { fillColor: BG_LT },
    columnStyles: {
      0: { halign: "center", cellWidth: 9,  fontStyle: "bold", textColor: [191, 219, 254] as [number,number,number] },
      1: { cellWidth: "auto", fontStyle: "bold", textColor: SLATE9, overflow: "linebreak" },
      2: { cellWidth: 26, halign: "center", fontSize: 7.5, textColor: SLATE5 },
      3: { cellWidth: 14, halign: "center", fontStyle: "bold", overflow: "hidden" },
      4: { cellWidth: 33, halign: "right" },
      5: { cellWidth: 33, halign: "right", fontStyle: "bold", textColor: SLATE9 },
    },
  })

  const tableEndY: number = (doc as any).lastAutoTable.finalY + 6

  // ── Bottom section: Terms (left) + Totals (right) ─────────────────────
  const totalsW = 72
  const totalsX = W - M - totalsW
  const termsX  = M
  const termsW  = totalsX - M - 6

  // Terms block
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...SLATE4)
  doc.text("TERMS & CONDITIONS", termsX, tableEndY + 5)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...SLATE5)
  const terms = "Goods once sold will not be returned. Warranty claims are subject to manufacturer policy. All prices are in Pakistani Rupees (PKR). Thank you for choosing " + shopName + "."
  const termLines = doc.splitTextToSize(terms, termsW)
  doc.text(termLines, termsX, tableEndY + 11)

  // Totals block
  let ty = tableEndY
  function tLine(label: string, value: string, opts: { bold?: boolean; color?: [number,number,number]; sep?: boolean } = {}) {
    if (opts.sep) {
      doc.setDrawColor(241, 245, 251)
      doc.setLineWidth(0.3)
      doc.line(totalsX, ty, totalsX + totalsW, ty)
    }
    doc.setFont("helvetica", opts.bold ? "bold" : "normal")
    doc.setFontSize(opts.bold ? 9 : 8.5)
    doc.setTextColor(...(opts.color ?? SLATE5))
    doc.text(label, totalsX, ty + 5.5)
    doc.setFont("helvetica", opts.bold ? "bold" : "normal")
    doc.setTextColor(...(opts.color ?? SLATE7))
    doc.text(value, totalsX + totalsW, ty + 5.5, { align: "right" })
    ty += 7
  }

  tLine("Subtotal", formatPKR(sale.subtotal))
  if (sale.discount > 0) tLine("Discount", "- " + formatPKR(sale.discount), { color: RED, sep: true })
  if (sale.tax > 0)      tLine("Tax / GST", formatPKR(sale.tax), { sep: true })
  tLine("Amount Received", formatPKR(sale.amountReceived), { sep: true })
  const pending = sale.total - sale.amountReceived
  if (pending > 0) tLine("Outstanding", formatPKR(pending), { color: RED, sep: true })
  if (sale.changeDue > 0) tLine("Change Due", formatPKR(sale.changeDue), { color: GREEN as [number,number,number], sep: true })

  // Grand Total box — gradient
  ty += 2
  const grandH = 18
  const hS2 = 60
  for (let i = 0; i < hS2; i++) {
    const t = i / (hS2 - 1)
    const r = Math.round(NAVY[0] + (BLUE[0] - NAVY[0]) * t * 0.7 + (INDIGO[0] - NAVY[0]) * t * 0.3)
    const g = Math.round(NAVY[1] + (BLUE[1] - NAVY[1]) * t * 0.7 + (INDIGO[1] - NAVY[1]) * t * 0.3)
    const b = Math.round(NAVY[2] + (BLUE[2] - NAVY[2]) * t * 0.7 + (INDIGO[2] - NAVY[2]) * t * 0.3)
    doc.setFillColor(r, g, b)
    doc.rect(totalsX + (i / hS2) * totalsW, ty, totalsW / hS2 + 0.5, grandH, "F")
  }
  rr(doc, totalsX, ty, totalsW, grandH, 3, "S")

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(255, 255, 255)
  doc.setGState(new (doc as any).GState({ opacity: 0.6 }))
  doc.text("GRAND TOTAL", totalsX + 5, ty + 7)
  doc.setGState(new (doc as any).GState({ opacity: 1 }))
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text(formatPKR(sale.total), totalsX + totalsW - 4, ty + 13, { align: "right" })

  // ══════════════════════════════════════════════════════════════════════
  // 4. FOOTER
  // ══════════════════════════════════════════════════════════════════════
  const footY = 274
  gradientRule(doc, 0, footY, W, 2)

  doc.setFillColor(...BG_LT)
  doc.rect(0, footY + 2, W, 13, "F")

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...SLATE4)
  doc.text(shopName, M, footY + 10)

  doc.setFont("helvetica", "normal")
  doc.setTextColor(...SLATE5)
  doc.text(`${sale.invoiceNumber}  ·  ${formatDate(sale.date)}`, W / 2, footY + 10, { align: "center" })

  if (shopPhone) {
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...SLATE4)
    doc.text(shopPhone, W - M, footY + 10, { align: "right" })
  }

  // ── Output ────────────────────────────────────────────────────────────
  const filename = `Invoice-${sale.invoiceNumber}.pdf`
  if (action === "save") {
    doc.save(filename)
  } else if (action === "print") {
    const url = doc.output("bloburl") as unknown as string
    const win = window.open(url, "_blank")
    if (win) win.onload = () => win.print()
  } else {
    window.open(doc.output("bloburl") as unknown as string, "_blank")
  }
}

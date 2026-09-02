import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { Sale } from "@/data/types"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  navy:   [15,  23,  60]  as [number,number,number],
  blue:   [37,  99,  235] as [number,number,number],
  white:  [255, 255, 255] as [number,number,number],
  ink:    [15,  23,  42]  as [number,number,number],
  ink2:   [30,  41,  59]  as [number,number,number],
  muted:  [71,  85,  105] as [number,number,number],
  light:  [148, 163, 184] as [number,number,number],
  border: [220, 226, 236] as [number,number,number],
  bg:     [248, 250, 252] as [number,number,number],
  bgBlue: [239, 246, 255] as [number,number,number],
  green:  [22,  163, 74]  as [number,number,number],
  greenBg:[220, 252, 231] as [number,number,number],
  red:    [220, 38,  38]  as [number,number,number],
  redBg:  [254, 226, 226] as [number,number,number],
  amber:  [180, 100, 0]   as [number,number,number],
  amberBg:[254, 243, 199] as [number,number,number],
}

export type ShopInfo = {
  shopName:    string
  shopAddress: string
  shopPhone:   string
  shopEmail?:  string
  shopLogo?:   string
}
export type InvoiceOptions = ShopInfo

const PKT_FMT = new Intl.DateTimeFormat("en-PK", {
  timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric"
})
function fDate(d: string) { try { return PKT_FMT.format(new Date(d)) } catch { return d } }
function fPKR(n: number)  { return "Rs " + Math.round(n).toLocaleString("en-PK") }

function rr(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, style: "F"|"S"|"FD" = "F") {
  doc.roundedRect(x, y, w, h, r, r, style)
}
function gs(doc: jsPDF, opacity: number) {
  doc.setGState(new (doc as any).GState({ opacity }))
}
function hLine(doc: jsPDF, y: number, x1: number, x2: number, col = C.border, lw = 0.25) {
  doc.setDrawColor(...col); doc.setLineWidth(lw); doc.line(x1, y, x2, y)
}

async function urlToBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url); const blob = await res.blob()
    return await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(blob)
    })
  } catch { return "" }
}

type ItemDetail = { color: string; category: string; batteryHealth: number | null; storage: string; ram: string; isUsed: boolean }

function ptaLabel(s: string) {
  if (s === "approved") return "PTA Approved"
  if (s === "non_pta") return "Non-PTA"
  if (s === "jv") return "JV"
  if (s === "mdm") return "MDM"
  if (s === "cpid_approved") return "CPID Approved"
  if (s === "pending") return "PTA Pending"
  return "PTA Blocked"
}

/**
 * sale_items only persists productId/name/qty/price/imei - color, category,
 * battery% and storage/RAM live on imei_records (new phones) / used_phones
 * (used phones) and have to be looked up by IMEI at print time instead.
 * Used-phone rows show "Used" in place of their PTA category - that column
 * is about compliance status on new stock, not relevant once resold as used.
 */
async function fetchItemDetailsByImei(imeis: string[]): Promise<Map<string, ItemDetail>> {
  const map = new Map<string, ItemDetail>()
  if (imeis.length === 0) return map
  try {
    const tenantId = await getTenantId()
    const [{ data: imeiRows }, { data: usedRows }] = await Promise.all([
      supabase.from("imei_records")
        .select("imei_number, color, category, battery_health, storage_capacity")
        .eq("tenant_id", tenantId).in("imei_number", imeis),
      supabase.from("used_phones")
        .select("imei_number, color, pta_status, battery_health, storage, ram")
        .eq("tenant_id", tenantId).in("imei_number", imeis),
    ])
    for (const r of (imeiRows ?? []) as any[]) {
      if (!r.imei_number) continue
      map.set(r.imei_number, {
        color: r.color ?? "", category: r.category ?? "", batteryHealth: r.battery_health ?? null,
        storage: r.storage_capacity ?? "", ram: "", isUsed: false,
      })
    }
    for (const r of (usedRows ?? []) as any[]) {
      if (!r.imei_number || map.has(r.imei_number)) continue
      map.set(r.imei_number, {
        color: r.color ?? "", category: r.pta_status ? ptaLabel(r.pta_status) : "", batteryHealth: r.battery_health ?? null,
        storage: r.storage ?? "", ram: r.ram ?? "", isUsed: true,
      })
    }
  } catch { /* invoice still renders without color/category/battery on lookup failure */ }
  return map
}

function isIphoneName(productName: string): boolean {
  return productName.trim().toLowerCase().startsWith("apple") || productName.toLowerCase().includes("iphone")
}

// sale_items bakes the condition grade into the name at sale time, e.g. "iPhone 14 Pro (Used - B+)" -
// redundant on the invoice since the Category column already shows "Used", so it's stripped for print.
function stripUsedGrade(productName: string): string {
  return productName.replace(/\s*\(Used\s*-\s*[^)]*\)\s*$/i, "").trim()
}

export async function generateInvoicePDF(
  sale: Sale,
  opts: Partial<InvoiceOptions> = {},
  action: "save" | "print" | "preview" = "save"
): Promise<void> {
  const shopName    = opts.shopName    || "Mobile Shop"
  const shopAddress = opts.shopAddress || ""
  const shopPhone   = opts.shopPhone   || ""
  const shopEmail   = opts.shopEmail   || ""
  const rawLogo     = opts.shopLogo    || ""
  const shopLogo    = rawLogo && !rawLogo.startsWith("data:") ? await urlToBase64(rawLogo) : rawLogo

  const itemDetails = await fetchItemDetailsByImei(
    Array.from(new Set(sale.items.map(i => (i as any).imei).filter(Boolean)))
  )

  const doc = new jsPDF("p", "mm", "a4")
  const W = 210, M = 13, IW = W - M * 2   // 184mm usable

  // ══════════════════════════════════════════════════════════════════════════
  // 1. HEADER — compact navy band
  // ══════════════════════════════════════════════════════════════════════════
  const HDR = 34
  doc.setFillColor(...C.navy); doc.rect(0, 0, W, HDR, "F")

  // subtle circle watermark
  gs(doc, 0.06); doc.setFillColor(...C.white)
  doc.circle(W - 14, -6, 42, "F")
  doc.circle(W - 58, HDR + 2, 24, "F")
  gs(doc, 1)

  // Logo box
  const LS = 24, LX = M, LY = 5
  if (shopLogo) {
    doc.setFillColor(...C.white); rr(doc, LX, LY, LS, LS, 3, "F")
    try {
      doc.addImage(shopLogo, shopLogo.startsWith("data:image/png") ? "PNG" : "JPEG", LX+1, LY+1, LS-2, LS-2)
    } catch {
      doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...C.navy)
      doc.text(shopName.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase(), LX+LS/2, LY+15, { align:"center" })
    }
  } else {
    gs(doc, 0.15); doc.setFillColor(...C.white); rr(doc, LX, LY, LS, LS, 3, "F"); gs(doc, 1)
    doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...C.white)
    doc.text(shopName.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase(), LX+LS/2, LY+15, { align:"center" })
  }

  // Contact right (measured first so shop name knows how much room it has)
  const contactLines: string[] = []
  if (shopPhone)   contactLines.push(shopPhone)
  if (shopAddress) contactLines.push(shopAddress)
  if (shopEmail)   contactLines.push(shopEmail)
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5)
  const contactMaxW = contactLines.length
    ? Math.max(...contactLines.map(ln => doc.getTextWidth(ln)))
    : 0

  // Shop name + subtitle — shrink font if the name would run into the contact block
  const nameX = LX + LS + 5
  const nameMaxW = W - M - contactMaxW - 8 - nameX
  doc.setFont("helvetica", "bold"); doc.setFontSize(14)
  let nameSize = 14
  while (nameSize > 9 && doc.getTextWidth(shopName) > nameMaxW) {
    nameSize -= 0.5
    doc.setFontSize(nameSize)
  }
  doc.setTextColor(...C.white)
  doc.text(shopName, nameX, LY+10)
  gs(doc, 0.45); doc.setFont("helvetica","normal"); doc.setFontSize(7)
  doc.text("OFFICIAL SALES INVOICE", nameX, LY+16); gs(doc, 1)

  contactLines.forEach((ln, i) => {
    doc.setFont("helvetica", i===0 ? "bold" : "normal")
    doc.setFontSize(i===0 ? 8.5 : 7.5)
    gs(doc, i===0 ? 1 : 0.6); doc.setTextColor(...C.white)
    doc.text(ln, W-M, LY + 8 + i*6, { align:"right" })
  }); gs(doc, 1)

  let y = HDR

  // ══════════════════════════════════════════════════════════════════════════
  // 2. META STRIP — invoice# / date / status in one tight row
  // ══════════════════════════════════════════════════════════════════════════
  const STRIP = 12
  doc.setFillColor(...C.bg); doc.rect(0, y, W, STRIP, "F")
  hLine(doc, y, 0, W, C.border, 0.4)
  hLine(doc, y+STRIP, 0, W, C.border, 0.4)

  // Left: doc type
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(...C.navy)
  doc.text("SALES INVOICE", M, y+8)

  // Right: invoice# — date — status pill
  const isPaid    = sale.status === "Completed"
  const isPending = sale.status === "Pending"
  const pillBg: [number,number,number] = isPaid ? C.greenBg : isPending ? C.amberBg : C.bg
  const pillTx: [number,number,number] = isPaid ? C.green   : isPending ? C.amber   : C.muted
  const statusTxt = sale.status.toUpperCase()

  // Status pill — rightmost
  const pw = doc.getTextWidth(statusTxt) + 8
  const pillX = W - M - pw
  doc.setFillColor(...pillBg); rr(doc, pillX, y+2.5, pw, 7, 3.5, "F")
  doc.setFont("helvetica","bold"); doc.setFontSize(6.5); doc.setTextColor(...pillTx)
  doc.text(statusTxt, pillX + pw/2, y+7.5, { align:"center" })

  // Date — left of pill
  const dateStr = fDate(sale.date)
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(...C.ink)
  doc.text(dateStr, pillX - 5, y+8, { align:"right" })
  doc.setFont("helvetica","normal"); doc.setFontSize(6); doc.setTextColor(...C.light)
  doc.text("DATE", pillX - 5, y+3.5, { align:"right" })

  // Invoice# — left of date
  const invW = doc.getTextWidth(dateStr) + 20
  const invX = pillX - 5 - invW
  doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(...C.ink)
  doc.text(sale.invoiceNumber, invX, y+8, { align:"right" })
  doc.setFont("helvetica","normal"); doc.setFontSize(6); doc.setTextColor(...C.light)
  doc.text("INVOICE NO", invX, y+3.5, { align:"right" })

  y += STRIP + 6

  // ══════════════════════════════════════════════════════════════════════════
  // 3. BILLED TO + PAYMENT — compact two-column cards
  // ══════════════════════════════════════════════════════════════════════════
  const CW = (IW - 4) / 2
  const CH = 26

  const warrantyDays: number = (sale as any).warrantyDays ?? 0

  const cardDefs = [
    {
      tag:  "BILLED TO",
      main: sale.customerName || "Walk-in Customer",
      sub1: sale.customerPhone || "",
      sub2: warrantyDays > 0 ? `Warranty: ${warrantyDays} day${warrantyDays !== 1 ? "s" : ""}` : "",
    },
    {
      tag:  "PAYMENT METHOD",
      main: sale.paymentMethod,
      sub1: `Date: ${fDate(sale.date)}`,
      sub2: `Ref: ${sale.invoiceNumber}`,
    },
  ]

  cardDefs.forEach((card, i) => {
    const CX = M + i * (CW + 4)
    doc.setFillColor(...C.white); doc.setDrawColor(...C.border); doc.setLineWidth(0.3)
    rr(doc, CX, y, CW, CH, 2.5, "FD")
    // left accent
    doc.setFillColor(...C.blue); doc.rect(CX, y, 3, CH, "F")
    rr(doc, CX, y, 3, CH, 1.5, "F")

    doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.setTextColor(...C.blue)
    doc.text(card.tag, CX+6, y+5.5)

    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...C.ink)
    const mainMaxW = CW - 9
    const mainFitted = doc.getTextWidth(card.main) > mainMaxW
      ? doc.splitTextToSize(card.main, mainMaxW)[0].replace(/\s+\S*$/, "") + "..."
      : card.main
    doc.text(mainFitted, CX+6, y+13)

    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...C.muted)
    if (card.sub1) doc.text(doc.splitTextToSize(card.sub1, mainMaxW)[0], CX+6, y+19)
    if (card.sub2) doc.text(doc.splitTextToSize(card.sub2, mainMaxW)[0], CX+6, y+24)
  })

  y += CH + 7

  // ══════════════════════════════════════════════════════════════════════════
  // 4. ITEMS TABLE — compact, fits many items per page
  // ══════════════════════════════════════════════════════════════════════════
  // Thin section label
  doc.setFont("helvetica","bold"); doc.setFontSize(6.5); doc.setTextColor(...C.light)
  doc.text("PRODUCTS & ITEMS", M, y)
  const badge = `${sale.items.length} item${sale.items.length!==1?"s":""}`
  const bw = doc.getTextWidth(badge) + 6
  doc.setFillColor(...C.navy); rr(doc, M+IW-bw, y-4.5, bw, 6, 3, "F")
  doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.setTextColor(...C.white)
  doc.text(badge, M+IW-bw/2, y-0.5, { align:"center" })
  y += 2

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    tableWidth: IW,
    head: [["#", "Description", "IMEI / Code", "Color", "Batt.", "Category", "Qty", "Unit Price", "Amount"]],
    body: sale.items.map((item, i) => {
      const imei = (item as any).imei || ""
      const detail = imei ? itemDetails.get(imei) : undefined
      const isIphone = isIphoneName(item.productName)
      const battery = detail?.batteryHealth != null && isIphone ? `${detail.batteryHealth}%` : "-"
      // RAM is an Android spec - iPhones only ever show storage, even on used-phone rows that have a RAM value on file.
      const spec = detail
        ? [detail.storage, !isIphone && detail.ram ? `${detail.ram} RAM` : ""].filter(Boolean).join(" · ")
        : ""
      // Condition grade (A+/B/C...) is baked into the name at sale time - redundant next to the "Used" category tag below.
      const name = detail?.isUsed ? stripUsedGrade(item.productName) : item.productName
      const description = spec ? `${name}\n${spec}` : name
      const category = detail ? (detail.isUsed ? "Used" : detail.category || "-") : "-"
      return [
        String(i+1),
        description,
        imei || "-",
        detail?.color || "-",
        battery,
        category,
        String(item.quantity),
        fPKR(item.unitPrice),
        fPKR(item.lineTotal),
      ]
    }),
    headStyles: {
      fillColor: [22, 31, 72] as [number,number,number],
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
      cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
      lineWidth: 0,
      minCellHeight: 0,
      valign: "middle",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: C.ink2,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineColor: C.border,
      lineWidth: 0.2,
      minCellHeight: 0,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: C.bg },
    columnStyles: {
      0: { cellWidth: 7,    halign: "center", fontStyle: "bold", textColor: C.light, valign: "middle" },
      1: { cellWidth: "auto", fontStyle: "bold", textColor: C.ink, overflow: "linebreak", valign: "middle" },
      2: { cellWidth: 25,   halign: "center", fontSize: 6.5, textColor: C.muted, valign: "middle" },
      3: { cellWidth: 17,   halign: "center", fontSize: 6.5, textColor: C.muted, overflow: "linebreak", valign: "middle" },
      4: { cellWidth: 14,   halign: "center", fontStyle: "bold", textColor: C.ink, valign: "middle" },
      5: { cellWidth: 21,   halign: "center", fontSize: 6.5, textColor: C.muted, overflow: "linebreak", valign: "middle" },
      6: { cellWidth: 12,   halign: "center", fontStyle: "bold", valign: "middle" },
      7: { cellWidth: 24,   halign: "right",  textColor: C.muted, valign: "middle" },
      8: { cellWidth: 24,   halign: "right",  fontStyle: "bold", textColor: C.ink, valign: "middle" },
    },
    showHead: "everyPage",
  })

  const tableEnd: number = (doc as any).lastAutoTable.finalY

  // ══════════════════════════════════════════════════════════════════════════
  // 5. TOTALS (right) + NOTES/TERMS (left) — compact side by side
  // ══════════════════════════════════════════════════════════════════════════
  const TOT_W = 70
  const TOT_X = W - M - TOT_W
  const LFT_W = TOT_X - M - 5

  let ty = tableEnd + 5
  let leftY = ty

  // ── Totals rows ────────────────────────────────────────────────────────
  function tRow(
    label: string, val: string,
    bold = false,
    valColor = C.ink as [number,number,number],
  ) {
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setFontSize(8); doc.setTextColor(...C.muted)
    doc.text(label, TOT_X, ty)
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setTextColor(...valColor)
    doc.text(val, TOT_X + TOT_W, ty, { align:"right" })
    ty += 6
  }
  function tDiv() {
    hLine(doc, ty - 2, TOT_X, TOT_X+TOT_W, C.border, 0.25)
  }

  tRow("Subtotal", fPKR(sale.subtotal))
  if (sale.discount > 0) { tDiv(); tRow("Discount", "- "+fPKR(sale.discount), false, C.red) }
  if (sale.tax > 0)       { tDiv(); tRow("Tax / GST", fPKR(sale.tax)) }
  tDiv()
  tRow("Amount Received", fPKR(sale.amountReceived), true, C.green)
  const outstanding = sale.total - sale.amountReceived
  if (outstanding > 0) { tDiv(); tRow("Outstanding", fPKR(outstanding), true, C.red) }
  if (sale.changeDue > 0) { tDiv(); tRow("Change Due", fPKR(sale.changeDue), false, C.green) }

  // Grand total bar
  ty += 2
  const GT_H = 13
  doc.setFillColor(...C.navy); rr(doc, TOT_X, ty, TOT_W, GT_H, 3, "F")
  gs(doc, 0.5); doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(...C.white)
  doc.text("GRAND TOTAL", TOT_X+4, ty+5); gs(doc, 1)
  doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(...C.white)
  doc.text(fPKR(sale.total), TOT_X+TOT_W-4, ty+10, { align:"right" })
  ty += GT_H + 3

  // Payment status tag
  const tagTxt = isPaid ? "PAID IN FULL" : outstanding > 0 ? "PAYMENT PENDING" : "PARTIAL PAYMENT"
  const tagBg: [number,number,number] = isPaid ? C.greenBg : isPending ? C.amberBg : C.bg
  const tagTx: [number,number,number] = isPaid ? C.green   : C.amber
  const tw = doc.getTextWidth(tagTxt) + 10
  doc.setFillColor(...tagBg); rr(doc, TOT_X+TOT_W-tw, ty, tw, 7, 3.5, "F")
  doc.setFont("helvetica","bold"); doc.setFontSize(6.5); doc.setTextColor(...tagTx)
  doc.text(tagTxt, TOT_X+TOT_W-tw/2, ty+5, { align:"center" })

  // ── Left: warranty + notes + terms ────────────────────────────────────
  if (warrantyDays > 0) {
    doc.setFillColor(...C.bgBlue); doc.setDrawColor(...C.border); doc.setLineWidth(0.25)
    rr(doc, M, leftY, LFT_W, 13, 2.5, "FD")
    doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(...C.blue)
    doc.text(`WARRANTY: ${warrantyDays} DAY${warrantyDays!==1?"S":""}`, M+4, leftY+6)
    doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(...C.muted)
    doc.text("Subject to manufacturer terms & conditions.", M+4, leftY+11)
    leftY += 16
  }

  if (sale.notes) {
    doc.setFont("helvetica","bold"); doc.setFontSize(6.5); doc.setTextColor(...C.light)
    doc.text("NOTES", M, leftY)
    leftY += 4
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...C.muted)
    const noteLines = doc.splitTextToSize(sale.notes, LFT_W)
    doc.text(noteLines, M, leftY)
    leftY += noteLines.length * 4.5 + 3
  }

  doc.setFont("helvetica","bold"); doc.setFontSize(6); doc.setTextColor(...C.light)
  doc.text("TERMS & CONDITIONS", M, leftY)
  leftY += 3.5
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(...C.light)
  const terms = `Goods once sold will not be returned without valid reason. All prices are in PKR (Pakistani Rupees). Thank you for choosing ${shopName}.`
  doc.text(doc.splitTextToSize(terms, LFT_W), M, leftY)

  // ══════════════════════════════════════════════════════════════════════════
  // 6. FOOTER — on every page, stick to bottom
  // ══════════════════════════════════════════════════════════════════════════
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg)
    const FY = 282
    doc.setFillColor(...C.navy); doc.rect(0, FY, W, 15, "F")
    // left
    doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...C.white)
    doc.text(shopName, M, FY+6)
    gs(doc, 0.5); doc.setFont("helvetica","normal"); doc.setFontSize(7)
    if (shopPhone) doc.text(shopPhone, M, FY+11); gs(doc, 1)
    // center
    gs(doc, 0.8); doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(...C.white)
    doc.text("Thank you for your business!", W/2, FY+7, { align:"center" }); gs(doc, 1)
    gs(doc, 0.4); doc.setFont("helvetica","normal"); doc.setFontSize(6.5)
    doc.text(`${sale.invoiceNumber}  |  ${fDate(sale.date)}`, W/2, FY+12, { align:"center" }); gs(doc, 1)
    // right
    gs(doc, 0.45); doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(...C.white)
    doc.text(`Page ${pg} of ${totalPages}`, W-M, FY+9, { align:"right" }); gs(doc, 1)
  }

  // ── Output ────────────────────────────────────────────────────────────────
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

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// ── Brand palette ────────────────────────────────────────────────────────────
const NAVY:   [number,number,number] = [30,  58,  138]
const BLUE:   [number,number,number] = [37,  99,  235]
const INDIGO: [number,number,number] = [79,  70,  229]
const WHITE:  [number,number,number] = [255, 255, 255]
const SLATE9: [number,number,number] = [15,  23,  42]
const SLATE5: [number,number,number] = [100, 116, 139]
const SLATE4: [number,number,number] = [148, 163, 184]
const BG_LT:  [number,number,number] = [248, 250, 255]

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

function headerBand(doc: jsPDF, W: number, shopName: string, shopAddress: string, shopPhone: string) {
  const H = 32
  // gradient fill
  const steps = 80
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const r = Math.round(NAVY[0] + (BLUE[0] - NAVY[0]) * t * 0.7 + (INDIGO[0] - NAVY[0]) * t * 0.3)
    const g = Math.round(NAVY[1] + (BLUE[1] - NAVY[1]) * t * 0.7 + (INDIGO[1] - NAVY[1]) * t * 0.3)
    const b = Math.round(NAVY[2] + (BLUE[2] - NAVY[2]) * t * 0.7 + (INDIGO[2] - NAVY[2]) * t * 0.3)
    doc.setFillColor(r, g, b)
    doc.rect((i / steps) * W, 0, W / steps + 0.5, H, "F")
  }
  const M = 14
  // Shop name left
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.text(shopName, M, 14)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setGState(new (doc as any).GState({ opacity: 0.6 }))
  doc.setTextColor(...WHITE)
  doc.text("MANAGEMENT SYSTEM", M, 20)
  doc.setGState(new (doc as any).GState({ opacity: 1 }))

  // contact right
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text(shopName, W - M, 12, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setGState(new (doc as any).GState({ opacity: 0.65 }))
  if (shopPhone)   doc.text(shopPhone,   W - M, 18, { align: "right" })
  if (shopAddress) doc.text(shopAddress, W - M, 24, { align: "right" })
  doc.setGState(new (doc as any).GState({ opacity: 1 }))
  return H
}

export interface ReportColumn {
  header: string
  dataKey: string
  width?: number
  halign?: "left" | "center" | "right"
  bold?: boolean
}

export interface ReportSummary {
  label: string
  value: string
}

export interface ReportOptions {
  shopName:    string
  shopAddress: string
  shopPhone:   string
  title:       string          // e.g. "Sales Report"
  subtitle?:   string          // e.g. "Period: May 2026 | 42 records"
  columns:     ReportColumn[]
  rows:        Record<string, unknown>[]
  summary?:    ReportSummary[]
  filename:    string
  action?:     "save" | "print" | "preview"
}

export function generateReportPDF(opts: ReportOptions): void {
  const { shopName, shopAddress, shopPhone, title, subtitle, columns, rows, summary, filename } = opts
  const action = opts.action ?? "save"

  const doc = new jsPDF("p", "mm", "a4")
  const W = 210
  const M = 14

  // Header
  let y = headerBand(doc, W, shopName, shopAddress, shopPhone)

  // Doc title strip
  const stripH = 14
  doc.setFillColor(...BG_LT)
  doc.rect(0, y, W, stripH, "F")
  doc.setDrawColor(228, 233, 245)
  doc.setLineWidth(0.3)
  doc.line(0, y, W, y)
  doc.line(0, y + stripH, W, y + stripH)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  doc.text(title.toUpperCase(), M, y + 9.5)

  if (subtitle) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE5)
    doc.text(subtitle, W - M, y + 9.5, { align: "right" })
  }

  y += stripH
  gradientRule(doc, 0, y, W, 2)
  y += 2 + 6

  // Table
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [columns.map(c => c.header)],
    body: rows.map(row => columns.map(c => row[c.dataKey] ?? "")),
    headStyles: {
      fillColor: NAVY,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: SLATE9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
      lineColor: [241, 245, 251],
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: BG_LT },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, {
        halign: c.halign ?? "left",
        cellWidth: c.width ?? "auto",
        fontStyle: c.bold ? "bold" : "normal",
      }])
    ),
  })

  const tableEndY: number = (doc as any).lastAutoTable.finalY + 6

  // Summary block (right-aligned totals)
  if (summary?.length) {
    const sumW = 90
    const sumX = W - M - sumW
    let sy = tableEndY + 2

    summary.forEach((s, i) => {
      const isLast = i === summary.length - 1
      if (isLast) {
        // Grand total box
        const boxH = 10
        for (let j = 0; j < 50; j++) {
          const t = j / 49
          const r = Math.round(NAVY[0] + (BLUE[0] - NAVY[0]) * t)
          const g = Math.round(NAVY[1] + (BLUE[1] - NAVY[1]) * t)
          const b = Math.round(NAVY[2] + (BLUE[2] - NAVY[2]) * t)
          doc.setFillColor(r, g, b)
          doc.rect(sumX + (j / 50) * sumW, sy, sumW / 50 + 0.5, boxH, "F")
        }
        doc.roundedRect(sumX, sy, sumW, boxH, 2, 2, "S")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(8)
        doc.setTextColor(...WHITE)
        doc.text(s.label, sumX + 5, sy + 6.5)
        doc.setFontSize(10)
        doc.text(s.value, sumX + sumW - 4, sy + 6.5, { align: "right" })
      } else {
        doc.setDrawColor(241, 245, 251)
        doc.setLineWidth(0.3)
        doc.line(sumX, sy, sumX + sumW, sy)
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8.5)
        doc.setTextColor(...SLATE5)
        doc.text(s.label, sumX + 5, sy + 5.5)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...SLATE9)
        doc.text(s.value, sumX + sumW - 4, sy + 5.5, { align: "right" })
        sy += 7
      }
    })
  }

  // Footer
  const footY = 272
  doc.setFillColor(...BG_LT)
  doc.setDrawColor(228, 233, 245)
  doc.setLineWidth(0.3)
  doc.rect(0, footY, W, 15, "F")
  doc.line(0, footY, W, footY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(...SLATE4)
  doc.text("Generated by", M, footY + 9)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...BLUE)
  doc.text(shopName, M + doc.getTextWidth("Generated by ") + 1, footY + 9)

  doc.setFont("helvetica", "normal")
  doc.setTextColor(...SLATE4)
  doc.text(
    `${rows.length} record${rows.length !== 1 ? "s" : ""}  ·  Printed ${new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric" }).format(new Date())}`,
    W / 2, footY + 9, { align: "center" }
  )
  doc.text(title, W - M, footY + 9, { align: "right" })

  gradientRule(doc, 0, footY + 15, W, 2.5)

  // Output
  const fname = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
  if (action === "save") {
    doc.save(fname)
  } else if (action === "print") {
    const url = doc.output("bloburl") as unknown as string
    const win = window.open(url, "_blank")
    if (win) win.onload = () => win.print()
  } else {
    window.open(doc.output("bloburl") as unknown as string, "_blank")
  }
}

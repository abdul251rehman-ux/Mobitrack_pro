import * as XLSX from "xlsx"

export interface ExcelColumn {
  key: string
  header: string
  width?: number          // minimum character width — auto-expands to fit content
  numFmt?: string         // e.g. "#,##0" for numbers
  align?: "left" | "center" | "right"
}

export interface ExcelExportOptions {
  sheetName?: string
  title?: string
  subtitle?: string
  summaryRows?: Array<{ label: string; value: string | number }>
}

// ── Styles ────────────────────────────────────────────────────────────────────

const HEADER_FILL  = { patternType: "solid", fgColor: { rgb: "1E3A8A" } }
const HEADER_FONT  = { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" }
const TITLE_FONT   = { bold: true, sz: 14, color: { rgb: "1E3A8A" }, name: "Calibri" }
const SUBTITLE_FONT = { sz: 9, color: { rgb: "64748B" }, name: "Calibri", italic: true }
const BODY_FONT    = { sz: 10, name: "Calibri" }
const ALT_FILL     = { patternType: "solid", fgColor: { rgb: "F0F4FF" } }
const BORDER       = {
  top:    { style: "thin", color: { rgb: "D1D9F0" } },
  bottom: { style: "thin", color: { rgb: "D1D9F0" } },
  left:   { style: "thin", color: { rgb: "D1D9F0" } },
  right:  { style: "thin", color: { rgb: "D1D9F0" } },
}
const SUMMARY_LABEL_FONT = { bold: true, sz: 10, name: "Calibri", color: { rgb: "334155" } }
const SUMMARY_VALUE_FONT = { bold: true, sz: 11, name: "Calibri", color: { rgb: "1E3A8A" } }
const GRAND_FILL   = { patternType: "solid", fgColor: { rgb: "EFF6FF" } }
const GRAND_BORDER = {
  top:    { style: "medium", color: { rgb: "1E3A8A" } },
  bottom: { style: "medium", color: { rgb: "1E3A8A" } },
  left:   { style: "thin",   color: { rgb: "D1D9F0" } },
  right:  { style: "thin",   color: { rgb: "D1D9F0" } },
}

function makeCell(
  v: unknown,
  font: object,
  fill?: object,
  align?: "left" | "center" | "right",
  numFmt?: string,
  border?: object,
  bold?: boolean,
): XLSX.CellObject {
  const isNum = typeof v === "number"
  return {
    v: v as XLSX.CellObject["v"],
    t: isNum ? "n" : "s",
    s: {
      font: bold ? { ...font, bold: true } : font,
      fill: fill ?? { patternType: "none" },
      border: border ?? BORDER,
      alignment: {
        horizontal: align ?? (isNum ? "right" : "left"),
        vertical: "center",
        wrapText: false,
      },
      ...(numFmt ? { numFmt } : {}),
    },
  }
}

// ── Width auto-fit ────────────────────────────────────────────────────────────

function textLen(v: unknown): number {
  if (v == null) return 0
  return String(v).length
}

const PKT_DATE_FMT = new Intl.DateTimeFormat("en-PK", {
  timeZone: "Asia/Karachi", day: "2-digit", month: "short", year: "numeric",
})

function formatValue(v: unknown): string {
  if (v == null || v === "") return ""
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    try { return PKT_DATE_FMT.format(new Date(v)) } catch { return String(v) }
  }
  return String(v)
}

// ── Main export ───────────────────────────────────────────────────────────────

export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  columns: ExcelColumn[],
  opts: ExcelExportOptions = {},
): void {
  if (!data.length) return

  const sheetName = (opts.sheetName ?? "Sheet1").slice(0, 31)
  const rows: XLSX.CellObject[][] = []
  let dataStartRow = 0

  // ── Pre-compute display values for auto-width ────────────────────────────────
  // For each column, track max character length seen
  const maxLen: number[] = columns.map(col => textLen(col.header))

  const displayData = data.map(row =>
    columns.map((col, ci) => {
      const raw = row[col.key]
      const display = formatValue(raw)
      // Use numeric value if no numFmt (we store number type), else display string
      const cellVal: unknown = (typeof raw === "number" && !col.numFmt) ? raw
        : (typeof raw === "number" && col.numFmt) ? raw
        : display
      if (textLen(display) > maxLen[ci]) maxLen[ci] = textLen(display)
      return { raw, display, cellVal }
    })
  )

  // Also check summary rows in width calc
  if (opts.summaryRows?.length) {
    opts.summaryRows.forEach(sr => {
      const lastIdx = columns.length - 1
      const secLastIdx = columns.length - 2
      if (textLen(sr.label)  > maxLen[secLastIdx]) maxLen[secLastIdx] = textLen(sr.label)
      if (textLen(sr.value)  > maxLen[lastIdx])    maxLen[lastIdx]    = textLen(sr.value)
    })
  }

  // ── Title row ────────────────────────────────────────────────────────────────
  if (opts.title) {
    const titleRow: XLSX.CellObject[] = [
      { v: opts.title, t: "s", s: { font: TITLE_FONT, fill: { patternType: "none" }, alignment: { horizontal: "left", vertical: "center" } } },
      ...Array(columns.length - 1).fill({ v: "", t: "s", s: { fill: { patternType: "none" } } }),
    ]
    rows.push(titleRow)
    dataStartRow++
  }

  // ── Subtitle row ─────────────────────────────────────────────────────────────
  if (opts.subtitle) {
    const subRow: XLSX.CellObject[] = [
      { v: opts.subtitle, t: "s", s: { font: SUBTITLE_FONT, fill: { patternType: "none" }, alignment: { horizontal: "left", vertical: "center" } } },
      ...Array(columns.length - 1).fill({ v: "", t: "s", s: { fill: { patternType: "none" } } }),
    ]
    rows.push(subRow)
    dataStartRow++
  }

  // Blank separator
  if (dataStartRow > 0) {
    rows.push(columns.map(() => ({ v: "", t: "s", s: { fill: { patternType: "none" } } } as XLSX.CellObject)))
    dataStartRow++
  }

  // ── Header row ───────────────────────────────────────────────────────────────
  rows.push(columns.map(col =>
    makeCell(col.header, HEADER_FONT, HEADER_FILL, col.align ?? "center")
  ))
  dataStartRow++

  // ── Data rows ────────────────────────────────────────────────────────────────
  displayData.forEach((rowCells, ri) => {
    const isAlt = ri % 2 === 1
    rows.push(
      rowCells.map(({ cellVal }, ci) => {
        const col = columns[ci]
        return makeCell(
          cellVal,
          BODY_FONT,
          isAlt ? ALT_FILL : { patternType: "none" },
          col.align,
          col.numFmt,
        )
      })
    )
  })

  // ── Summary rows ─────────────────────────────────────────────────────────────
  if (opts.summaryRows?.length) {
    // Spacer
    rows.push(columns.map(() => ({ v: "", t: "s", s: { fill: { patternType: "none" } } } as XLSX.CellObject)))

    opts.summaryRows.forEach((sr, idx) => {
      const isLast = idx === opts.summaryRows!.length - 1
      const border = isLast ? GRAND_BORDER : BORDER
      const fill   = GRAND_FILL
      const sumRow: XLSX.CellObject[] = columns.map((_, ci) => {
        if (ci === columns.length - 2)
          return makeCell(sr.label, SUMMARY_LABEL_FONT, fill, "right", undefined, border)
        if (ci === columns.length - 1)
          return makeCell(
            typeof sr.value === "number" ? sr.value : sr.value,
            SUMMARY_VALUE_FONT, fill, "right",
            typeof sr.value === "number" ? "#,##0" : undefined,
            border,
          )
        return { v: "", t: "s", s: { fill, border } } as XLSX.CellObject
      })
      rows.push(sumRow)
    })
  }

  // ── Build worksheet ──────────────────────────────────────────────────────────
  const ws: XLSX.WorkSheet = {}
  rows.forEach((row, ri) => {
    row.forEach((cellObj, ci) => {
      ws[XLSX.utils.encode_cell({ r: ri, c: ci })] = cellObj
    })
  })

  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: columns.length - 1 } })

  // Auto-fit widths: max of specified minimum, measured content length, +2 padding
  ws["!cols"] = columns.map((col, ci) => {
    const minW = col.width ?? 10
    const autoW = maxLen[ci] + 2
    return { wch: Math.max(minW, autoW) }
  })

  // Freeze pane below header (and title/subtitle rows)
  ws["!freeze"] = { xSplit: 0, ySplit: dataStartRow } as any

  // Row heights
  ws["!rows"] = rows.map((_, ri) => {
    if (opts.title && ri === 0) return { hpt: 24 }          // title
    if (opts.subtitle && ri === (opts.title ? 1 : 0)) return { hpt: 16 }  // subtitle
    if (ri === dataStartRow - 1) return { hpt: 20 }         // header row
    return { hpt: 17 }                                       // data rows
  })

  // Merge title & subtitle across all columns
  const merges: XLSX.Range[] = []
  let mr = 0
  if (opts.title)    { merges.push({ s: { r: mr, c: 0 }, e: { r: mr, c: columns.length - 1 } }); mr++ }
  if (opts.subtitle) { merges.push({ s: { r: mr, c: 0 }, e: { r: mr, c: columns.length - 1 } }) }
  if (merges.length) ws["!merges"] = merges

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`)
}

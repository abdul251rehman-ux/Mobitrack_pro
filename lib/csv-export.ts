// ─── CSV Export Utility ─────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const YYYY_MM_DD  = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(s: string): string {
  // Replace common mojibake sequences that appear from UTF-8 mis-read as Latin-1
  return s
    .replace(/â€"/g, "-")   // em-dash
    .replace(/â€™/g, "'")   // right single quote
    .replace(/â€œ/g, '"')   // left double quote
    .replace(/â€/g,  '"')   // right double quote
    .replace(/â€¢/g, "-")   // bullet
    .replace(/Â·/g,  ".")   // middle dot
    .replace(/Â /g,  " ")   // non-breaking space
    .replace(/âˆ'/g, "-")   // minus sign
}

function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  let str = String(value);

  // Format full ISO timestamps to readable date
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      str = d.toLocaleDateString("en-GB", {
        year: "numeric", month: "2-digit", day: "2-digit",
      }); // dd/mm/yyyy — universally readable in Excel
    }
  }

  // Format YYYY-MM-DD to dd/mm/yyyy for Excel
  if (typeof value === "string" && YYYY_MM_DD.test(value)) {
    const [y, m, d] = value.split("-");
    str = `${d}/${m}/${y}`;
  }

  str = cleanText(str);

  // Wrap in quotes if needed
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export interface CSVColumn {
  key: string;
  header: string;
}

/**
 * Export an array of objects to a UTF-8 BOM CSV (opens correctly in Excel without encoding issues).
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns?: CSVColumn[]
): void {
  if (!data.length) return;

  const cols: CSVColumn[] =
    columns ??
    Object.keys(data[0]).map((key) => ({
      key,
      header: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .trim(),
    }));

  const headerRow = cols.map((c) => `"${c.header}"`).join(",");
  const rows = data.map((row) =>
    cols.map((c) => formatCSVValue(row[c.key])).join(",")
  );

  // UTF-8 BOM (﻿) makes Excel open the file correctly without re-encoding
  const csvContent = "﻿" + [headerRow, ...rows].join("\r\n");

  const safeName = filename.endsWith(".csv") ? filename : `${filename}.csv`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ─── CSV Export Utility ─────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  let str = String(value);

  // Format ISO dates to a readable form
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      str = d.toLocaleDateString("en-PK", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    }
  }

  // Wrap in quotes if the value contains commas, quotes, or newlines
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export interface CSVColumn {
  key: string;
  header: string;
}

/**
 * Export an array of objects to a CSV file and trigger a browser download.
 *
 * @param data    - Array of row objects
 * @param filename - Desired file name (without extension is fine; .csv will be ensured)
 * @param columns - Optional column definitions. If omitted, all keys from the first row are used.
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

  const headerRow = cols.map((c) => formatCSVValue(c.header)).join(",");

  const rows = data.map((row) =>
    cols.map((c) => formatCSVValue(row[c.key])).join(",")
  );

  const csvContent = [headerRow, ...rows].join("\n");

  // Ensure filename ends with .csv
  const safeName = filename.endsWith(".csv") ? filename : `${filename}.csv`;

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();

  // Cleanup
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

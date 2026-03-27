// ─── PDF Invoice Generation (browser print) ────────────────────────────────

import type { Sale, SaleItem } from "@/data/types";

export interface ShopInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  ntn: string;
}

const DEFAULT_SHOP: ShopInfo = {
  name: "MobiTrack Pro",
  address: "Main Market, Lahore, Pakistan",
  phone: "+92 300 1234567",
  email: "info@mobitrackpro.pk",
  ntn: "1234567-8",
};

function currency(amount: number): string {
  return `₨ ${amount.toLocaleString("en-PK")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function buildItemRows(items: SaleItem[]): string {
  return items
    .map(
      (item, i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${i + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${item.productName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(item.unitPrice)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${currency(item.discount)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${currency(item.lineTotal)}</td>
      </tr>`
    )
    .join("");
}

/**
 * Generate a printable invoice in a new browser window using window.print().
 */
export function generateInvoicePDF(sale: Sale, shopInfo?: ShopInfo): void {
  const shop = shopInfo ?? DEFAULT_SHOP;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${sale.invoiceNumber}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #1f2937;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <table style="width:100%;margin-bottom:32px">
    <tr>
      <td style="vertical-align:top">
        <h1 style="font-size:28px;color:#111827;margin-bottom:4px">${shop.name}</h1>
        <p style="font-size:13px;color:#6b7280;line-height:1.6">
          ${shop.address}<br/>
          Phone: ${shop.phone}<br/>
          Email: ${shop.email}<br/>
          NTN: ${shop.ntn}
        </p>
      </td>
      <td style="text-align:right;vertical-align:top">
        <h2 style="font-size:24px;color:#4f46e5;margin-bottom:8px">INVOICE</h2>
        <p style="font-size:14px;color:#374151;line-height:1.8">
          <strong>Invoice #:</strong> ${sale.invoiceNumber}<br/>
          <strong>Date:</strong> ${fmtDate(sale.date)}<br/>
          <strong>Status:</strong> ${sale.status}
        </p>
      </td>
    </tr>
  </table>

  <!-- Customer Info -->
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px">
    <h3 style="font-size:13px;text-transform:uppercase;color:#6b7280;margin-bottom:8px;letter-spacing:0.5px">Bill To</h3>
    <p style="font-size:15px;font-weight:600;color:#111827;margin-bottom:2px">${sale.customerName}</p>
    <p style="font-size:13px;color:#6b7280">Phone: ${sale.customerPhone}</p>
  </div>

  <!-- Items Table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead>
      <tr style="background:#4f46e5;color:#fff">
        <th style="padding:10px 12px;text-align:center;font-size:13px;font-weight:600">#</th>
        <th style="padding:10px 12px;text-align:left;font-size:13px;font-weight:600">Product</th>
        <th style="padding:10px 12px;text-align:center;font-size:13px;font-weight:600">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600">Unit Price</th>
        <th style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600">Discount</th>
        <th style="padding:10px 12px;text-align:right;font-size:13px;font-weight:600">Total</th>
      </tr>
    </thead>
    <tbody>
      ${buildItemRows(sale.items)}
    </tbody>
  </table>

  <!-- Totals -->
  <table style="width:320px;margin-left:auto;margin-bottom:32px">
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6b7280">Subtotal</td>
      <td style="padding:6px 0;text-align:right;font-size:14px">${currency(sale.subtotal)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6b7280">Discount</td>
      <td style="padding:6px 0;text-align:right;font-size:14px;color:#dc2626">- ${currency(sale.discount)}</td>
    </tr>
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#6b7280">Tax</td>
      <td style="padding:6px 0;text-align:right;font-size:14px">${currency(sale.tax)}</td>
    </tr>
    <tr style="border-top:2px solid #111827">
      <td style="padding:10px 0;font-size:16px;font-weight:700">Grand Total</td>
      <td style="padding:10px 0;text-align:right;font-size:16px;font-weight:700;color:#4f46e5">${currency(sale.total)}</td>
    </tr>
  </table>

  <!-- Payment Info -->
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin-bottom:32px">
    <h3 style="font-size:13px;text-transform:uppercase;color:#16a34a;margin-bottom:8px;letter-spacing:0.5px">Payment Details</h3>
    <table style="font-size:14px;color:#374151">
      <tr>
        <td style="padding:3px 16px 3px 0;color:#6b7280">Method:</td>
        <td style="padding:3px 0;font-weight:600">${sale.paymentMethod}</td>
      </tr>
      <tr>
        <td style="padding:3px 16px 3px 0;color:#6b7280">Amount Received:</td>
        <td style="padding:3px 0;font-weight:600">${currency(sale.amountReceived)}</td>
      </tr>
      <tr>
        <td style="padding:3px 16px 3px 0;color:#6b7280">Change Due:</td>
        <td style="padding:3px 0;font-weight:600">${currency(sale.changeDue)}</td>
      </tr>
    </table>
  </div>

  ${sale.notes ? `<p style="font-size:13px;color:#6b7280;margin-bottom:24px"><strong>Notes:</strong> ${sale.notes}</p>` : ""}

  <!-- Footer -->
  <div style="border-top:1px solid #e5e7eb;padding-top:16px;font-size:12px;color:#9ca3af;line-height:1.6">
    <p><strong>Warranty Terms:</strong></p>
    <ul style="margin:4px 0 0 20px">
      <li>Mobile phones carry manufacturer warranty as per brand policy.</li>
      <li>Accessories are covered for 7 days replacement (unused & original packaging).</li>
      <li>No warranty on physical damage, water damage, or unauthorized repairs.</li>
      <li>Original invoice is required for all warranty claims.</li>
    </ul>
    <p style="margin-top:12px;text-align:center;color:#6b7280">Thank you for your business!</p>
  </div>

</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to render, then print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

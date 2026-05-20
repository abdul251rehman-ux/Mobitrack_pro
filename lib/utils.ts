import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `₨ ${amount.toLocaleString("en-PK")}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: PKT, day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(date))
}

// Pakistan Standard Time (UTC+5) — used for all display timestamps
const PKT = "Asia/Karachi"

export function formatDatePKT(date: string | Date): string {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: PKT, day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(date))
}

export function formatDateTimePKT(date: string | Date): string {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: PKT, day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(date))
}

export function nowPKT(): string {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: PKT, day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date())
}

/** Returns today's date as YYYY-MM-DD in Pakistan Standard Time (UTC+5). */
export function todayPKT(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: PKT, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
  return parts // en-CA locale gives YYYY-MM-DD format natively
}

export function calculateMargin(purchasePrice: number, sellingPrice: number): number {
  if (sellingPrice === 0) return 0;
  return ((sellingPrice - purchasePrice) / sellingPrice) * 100;
}

export function generateInvoiceNumber(lastNumber: number): string {
  return `INV-${new Date().getFullYear()}-${String(lastNumber + 1).padStart(4, "0")}`;
}

export function generatePONumber(lastNumber: number): string {
  return `PO-${new Date().getFullYear()}-${String(lastNumber + 1).padStart(4, "0")}`;
}

export function getLoyaltyTier(totalSpent: number): "Bronze" | "Silver" | "Gold" | "Platinum" {
  if (totalSpent >= 500000) return "Platinum";
  if (totalSpent >= 200000) return "Gold";
  if (totalSpent >= 50000) return "Silver";
  return "Bronze";
}

export function getStockStatus(stock: number): "In Stock" | "Low Stock" | "Out of Stock" {
  if (stock === 0) return "Out of Stock";
  if (stock <= 5) return "Low Stock";
  return "In Stock";
}

export function generateSKU(category: string, brand: string, index: number): string {
  const cat = category.substring(0, 3).toUpperCase();
  const br = brand.substring(0, 3).toUpperCase();
  return `${cat}-${br}-${String(index).padStart(4, "0")}`;
}

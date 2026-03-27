import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `₨ ${amount.toLocaleString("en-PK")}`;
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd MMM yyyy");
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

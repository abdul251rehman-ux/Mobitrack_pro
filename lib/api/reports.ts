import { supabase } from '../supabase'
import { getTenantId } from './helpers'

export interface SalesReportData {
  totalSales: number
  totalRevenue: number
  totalDiscount: number
  totalTax: number
  averageOrderValue: number
  salesByDay: { date: string; count: number; revenue: number }[]
  salesByPaymentMethod: { method: string; count: number; total: number }[]
  topProducts: { productName: string; quantity: number; revenue: number }[]
}

export interface PurchasesReportData {
  totalPurchases: number
  totalCost: number
  totalPaid: number
  totalOutstanding: number
  purchasesByDay: { date: string; count: number; cost: number }[]
  topSuppliers: { supplierName: string; count: number; total: number }[]
}

export interface ExpensesReportData {
  totalExpenses: number
  expensesByCategory: { category: string; total: number; count: number }[]
  expensesByDay: { date: string; total: number }[]
  expensesByPaymentMethod: { method: string; total: number }[]
}

export interface ProfitLossReportData {
  totalRevenue: number
  totalCostOfGoods: number
  grossProfit: number
  totalExpenses: number
  netProfit: number
  profitMargin: number
  revenueByDay: { date: string; revenue: number; cost: number; profit: number }[]
}

export async function getSalesReport(
  startDate: string,
  endDate: string
): Promise<SalesReportData> {
  try {
    const tenantId = await getTenantId()
    // Fetch sales within date range
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'Completed')

    if (salesError) throw new Error(`Failed to fetch sales report: ${salesError.message}`)

    const saleIds = (sales ?? []).map((s: { id: string }) => s.id)

    let saleItems: { product_name: string; quantity: number; line_total: number }[] = []
    if (saleIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('product_name, quantity, line_total')
        .in('sale_id', saleIds)

      if (itemsError) throw new Error(`Failed to fetch sale items: ${itemsError.message}`)
      saleItems = items ?? []
    }

    const totalRevenue = (sales ?? []).reduce((sum: number, s: { total: number }) => sum + s.total, 0)
    const totalDiscount = (sales ?? []).reduce((sum: number, s: { discount: number }) => sum + s.discount, 0)
    const totalTax = (sales ?? []).reduce((sum: number, s: { tax: number }) => sum + s.tax, 0)

    // Sales by day
    const byDay = new Map<string, { count: number; revenue: number }>()
    for (const s of (sales ?? []) as { date: string; total: number }[]) {
      const existing = byDay.get(s.date) ?? { count: 0, revenue: 0 }
      existing.count++
      existing.revenue += s.total
      byDay.set(s.date, existing)
    }

    // Sales by payment method
    const byMethod = new Map<string, { count: number; total: number }>()
    for (const s of (sales ?? []) as { payment_method: string; total: number }[]) {
      const existing = byMethod.get(s.payment_method) ?? { count: 0, total: 0 }
      existing.count++
      existing.total += s.total
      byMethod.set(s.payment_method, existing)
    }

    // Top products
    const byProduct = new Map<string, { quantity: number; revenue: number }>()
    for (const item of saleItems) {
      const existing = byProduct.get(item.product_name) ?? { quantity: 0, revenue: 0 }
      existing.quantity += item.quantity
      existing.revenue += item.line_total
      byProduct.set(item.product_name, existing)
    }

    return {
      totalSales: (sales ?? []).length,
      totalRevenue,
      totalDiscount,
      totalTax,
      averageOrderValue: (sales ?? []).length > 0 ? totalRevenue / (sales ?? []).length : 0,
      salesByDay: Array.from(byDay.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      salesByPaymentMethod: Array.from(byMethod.entries())
        .map(([method, data]) => ({ method, ...data }))
        .sort((a, b) => b.total - a.total),
      topProducts: Array.from(byProduct.entries())
        .map(([productName, data]) => ({ productName, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 20),
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to generate sales report')
  }
}

export async function getPurchasesReport(
  startDate: string,
  endDate: string
): Promise<PurchasesReportData> {
  try {
    const tenantId = await getTenantId()
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) throw new Error(`Failed to fetch purchases report: ${error.message}`)

    const totalCost = (purchases ?? []).reduce((sum: number, p: { total: number }) => sum + p.total, 0)
    const totalPaid = (purchases ?? []).reduce((sum: number, p: { amount_paid: number }) => sum + p.amount_paid, 0)

    const byDay = new Map<string, { count: number; cost: number }>()
    for (const p of (purchases ?? []) as { date: string; total: number }[]) {
      const existing = byDay.get(p.date) ?? { count: 0, cost: 0 }
      existing.count++
      existing.cost += p.total
      byDay.set(p.date, existing)
    }

    const bySupplier = new Map<string, { count: number; total: number }>()
    for (const p of (purchases ?? []) as { supplier_name: string; total: number }[]) {
      const existing = bySupplier.get(p.supplier_name) ?? { count: 0, total: 0 }
      existing.count++
      existing.total += p.total
      bySupplier.set(p.supplier_name, existing)
    }

    return {
      totalPurchases: (purchases ?? []).length,
      totalCost,
      totalPaid,
      totalOutstanding: totalCost - totalPaid,
      purchasesByDay: Array.from(byDay.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topSuppliers: Array.from(bySupplier.entries())
        .map(([supplierName, data]) => ({ supplierName, ...data }))
        .sort((a, b) => b.total - a.total),
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to generate purchases report')
  }
}

export async function getExpensesReport(
  startDate: string,
  endDate: string
): Promise<ExpensesReportData> {
  try {
    const tenantId = await getTenantId()
    const { data: expenses, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (error) throw new Error(`Failed to fetch expenses report: ${error.message}`)

    const totalExpenses = (expenses ?? []).reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)

    const byCategory = new Map<string, { total: number; count: number }>()
    for (const e of (expenses ?? []) as { category: string; amount: number }[]) {
      const existing = byCategory.get(e.category) ?? { total: 0, count: 0 }
      existing.total += e.amount
      existing.count++
      byCategory.set(e.category, existing)
    }

    const byDay = new Map<string, number>()
    for (const e of (expenses ?? []) as { date: string; amount: number }[]) {
      byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.amount)
    }

    const byMethod = new Map<string, number>()
    for (const e of (expenses ?? []) as { payment_method: string; amount: number }[]) {
      byMethod.set(e.payment_method, (byMethod.get(e.payment_method) ?? 0) + e.amount)
    }

    return {
      totalExpenses,
      expensesByCategory: Array.from(byCategory.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.total - a.total),
      expensesByDay: Array.from(byDay.entries())
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      expensesByPaymentMethod: Array.from(byMethod.entries())
        .map(([method, total]) => ({ method, total }))
        .sort((a, b) => b.total - a.total),
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to generate expenses report')
  }
}

export async function getProfitLossReport(
  startDate: string,
  endDate: string
): Promise<ProfitLossReportData> {
  try {
    const tenantId = await getTenantId()
    // Fetch completed sales
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('date, total')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'Completed')

    if (salesError) throw new Error(`Failed to fetch sales: ${salesError.message}`)

    // Fetch received purchases (cost of goods)
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('date, total')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('delivery_status', 'Received')

    if (purchasesError) throw new Error(`Failed to fetch purchases: ${purchasesError.message}`)

    // Fetch paid expenses
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('date, amount')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'Paid')

    if (expensesError) throw new Error(`Failed to fetch expenses: ${expensesError.message}`)

    const totalRevenue = (sales ?? []).reduce((sum: number, s: { total: number }) => sum + s.total, 0)
    const totalCostOfGoods = (purchases ?? []).reduce((sum: number, p: { total: number }) => sum + p.total, 0)
    const grossProfit = totalRevenue - totalCostOfGoods
    const totalExpensesAmount = (expenses ?? []).reduce((sum: number, e: { amount: number }) => sum + e.amount, 0)
    const netProfit = grossProfit - totalExpensesAmount

    // Build daily breakdown
    const dailyData = new Map<string, { revenue: number; cost: number; expenses: number }>()

    for (const s of (sales ?? []) as { date: string; total: number }[]) {
      const day = dailyData.get(s.date) ?? { revenue: 0, cost: 0, expenses: 0 }
      day.revenue += s.total
      dailyData.set(s.date, day)
    }

    for (const p of (purchases ?? []) as { date: string; total: number }[]) {
      const day = dailyData.get(p.date) ?? { revenue: 0, cost: 0, expenses: 0 }
      day.cost += p.total
      dailyData.set(p.date, day)
    }

    for (const e of (expenses ?? []) as { date: string; amount: number }[]) {
      const day = dailyData.get(e.date) ?? { revenue: 0, cost: 0, expenses: 0 }
      day.expenses += e.amount
      dailyData.set(e.date, day)
    }

    return {
      totalRevenue,
      totalCostOfGoods,
      grossProfit,
      totalExpenses: totalExpensesAmount,
      netProfit,
      profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      revenueByDay: Array.from(dailyData.entries())
        .map(([date, data]) => ({
          date,
          revenue: data.revenue,
          cost: data.cost + data.expenses,
          profit: data.revenue - data.cost - data.expenses,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to generate profit/loss report')
  }
}

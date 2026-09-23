import { supabase } from '../supabase'
import type { Purchase, Sale, Payment } from '@/data/types'

/**
 * Checks whether a Completed payment already exists for this exact
 * entity + reference number - a lightweight guard against the same
 * real-world payment being recorded twice through two different screens
 * (Ledger, Finance page's "Record Payment", a customer/supplier detail
 * page's own payment dialog - all four now independently apply payments to
 * purchases/sales balances, so a duplicate entry double-applies, not just
 * double-counts a display total). Returns the existing payment if found, so
 * the caller can show its amount/date in a confirmation prompt rather than
 * a bare "are you sure?". Not a hard block - a legitimate second, separate
 * payment can share the same reference number (e.g. two partial payments
 * against one invoice), so this only warns.
 */
export async function findExistingPayment(
  tenantId: string,
  entityType: 'Customer' | 'Supplier',
  entityId: string,
  referenceNumber: string
): Promise<{ amount: number; date: string } | null> {
  if (!referenceNumber) return null
  const { data } = await supabase
    .from('payments')
    .select('amount, date')
    .eq('tenant_id', tenantId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('reference_number', referenceNumber)
    .eq('status', 'Completed')
    .limit(1)
    .maybeSingle()
  return data ? { amount: Number((data as any).amount), date: (data as any).date } : null
}

/**
 * Live "amount received so far" per customer sale, computed from `payments`
 * instead of trusted from sales.amountReceived - mirrors
 * computePaidPerPurchase (see its comment for the full rationale). A
 * "Received" payment is matched to its sale by referenceId, falling back to
 * invoice-number string matching for payments recorded before that link
 * existed (invoice numbers are generated atomically inside fn_create_sale,
 * so this fallback carries none of the race risk PO numbers had). Sales with
 * no customerId (walk-in sales) never get a `payments` row tied back to
 * them the same way, so they're left out of the returned map; callers
 * should fall back to the sale's own cached fields for those rows.
 */
export function computeReceivedPerSale(sales: Sale[], customerPayments: Payment[]): Map<string, number> {
  const receivedBySaleId = new Map<string, number>()
  customerPayments.forEach((cp) => {
    if (cp.type !== 'Received') return
    const sale = sales.find(s => (cp.referenceId ? cp.referenceId === s.id : cp.referenceNumber === s.invoiceNumber))
    if (!sale) return
    receivedBySaleId.set(sale.id, (receivedBySaleId.get(sale.id) ?? 0) + cp.amount)
  })
  return receivedBySaleId
}

/** Same sale list, with amountReceived/changeDue/status replaced by the live
 *  payments-based numbers for every non-Refunded row. Refunded sales are
 *  returned unchanged - their balance is settled by definition. */
export function withLiveSaleBalances(sales: Sale[], customerPayments: Payment[]): Sale[] {
  const receivedBySaleId = computeReceivedPerSale(sales, customerPayments)
  return sales.map((s) => {
    if (s.status === 'Refunded') return s
    const receivedSoFar = receivedBySaleId.get(s.id) ?? 0
    const changeDue = Math.max(0, receivedSoFar - s.total)
    const status: Sale['status'] = receivedSoFar >= s.total ? 'Completed' : s.status
    return { ...s, amountReceived: receivedSoFar, changeDue, status }
  })
}

/**
 * Live "amount paid so far" per supplier purchase, computed from `payments`
 * instead of trusted from purchases.amountPaid/balanceDue - those cached
 * fields can drift from what was actually paid (a real production bug let
 * "Pay Supplier" write only to `payments` while never touching `purchases`
 * rows; see supabase/fix_purchase_payment_sync.sql). A payment is matched to
 * its purchase by referenceId (a real foreign key, set since
 * supabase/fix_po_number_race.sql), falling back to PO-number string
 * matching for payments recorded before that link existed. Walk-in
 * purchases (no supplierId - used-phone buybacks from an individual, not a
 * ledger supplier) never get a `payments` row at all, so they're left out of
 * the returned map entirely; callers should fall back to the purchase's own
 * cached fields for those rows.
 */
export function computePaidPerPurchase(purchases: Purchase[], supplierPayments: Payment[]): Map<string, number> {
  const paidByPurchaseId = new Map<string, number>()
  const linkedPurchases = purchases.filter(p => p.supplierId)
  supplierPayments.forEach((sp) => {
    if (sp.type !== 'Paid') return
    const purchase = linkedPurchases.find(p => (sp.referenceId ? sp.referenceId === p.id : sp.referenceNumber === p.poNumber))
    if (!purchase) return
    paidByPurchaseId.set(purchase.id, (paidByPurchaseId.get(purchase.id) ?? 0) + sp.amount)
  })
  return paidByPurchaseId
}

/** Same purchase list, with amountPaid/balanceDue/paymentStatus replaced by
 *  the live payments-based numbers for every supplier-linked row. Walk-in
 *  rows (no supplierId) are returned unchanged - see computePaidPerPurchase. */
export function withLivePurchaseBalances(purchases: Purchase[], supplierPayments: Payment[]): Purchase[] {
  const paidByPurchaseId = computePaidPerPurchase(purchases, supplierPayments)
  return purchases.map((p) => {
    if (!p.supplierId) return p
    const paidSoFar = paidByPurchaseId.get(p.id) ?? 0
    const liveBalanceDue = Math.max(0, p.total - paidSoFar)
    const paymentStatus: Purchase['paymentStatus'] = liveBalanceDue <= 0 ? 'Paid' : paidSoFar > 0 ? 'Partial' : 'Unpaid'
    return { ...p, amountPaid: paidSoFar, balanceDue: liveBalanceDue, paymentStatus }
  })
}

/** Net amount paid to a supplier across ALL their purchases (Paid minus
 *  Received), keyed by supplierId. Used for aggregate totals (Dashboard,
 *  supplier list pages) rather than per-purchase breakdowns. */
export function computeNetPaidBySupplier(supplierPayments: Payment[]): Map<string, number> {
  const map = new Map<string, number>()
  supplierPayments.forEach((p) => {
    if (p.entityType !== 'Supplier' || p.status !== 'Completed') return
    const delta = p.type === 'Paid' ? p.amount : -p.amount
    map.set(p.entityId, (map.get(p.entityId) ?? 0) + delta)
  })
  return map
}

/** Net amount received from a customer across ALL their sales (Received
 *  minus Paid/refunds), keyed by customerId. */
export function computeNetReceivedByCustomer(customerPayments: Payment[]): Map<string, number> {
  const map = new Map<string, number>()
  customerPayments.forEach((p) => {
    if (p.entityType !== 'Customer' || p.status !== 'Completed') return
    const delta = p.type === 'Received' ? p.amount : -p.amount
    map.set(p.entityId, (map.get(p.entityId) ?? 0) + delta)
  })
  return map
}

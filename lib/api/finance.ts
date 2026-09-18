import { supabase } from '../supabase'
import { getTenantId, getCurrentUserId } from './helpers'
import {
  toFinanceAccount,
  toFinanceTransaction,
  type DbFinanceAccount,
  type DbFinanceTransaction,
  type FinanceAccount,
  type FinanceTransaction,
  type FinanceAccountType,
} from './types'

// ─── Balance adjustment (atomic) ───────────────────────────────────────────
// Wraps the adjust_account_balance RPC (supabase/fix_balance_race_condition.sql),
// which does the read-lock-write inside one DB statement (SELECT ... FOR
// UPDATE) instead of the old pattern of reading current_balance client-side
// and writing back a computed number - that pattern let two concurrent
// payments against the same account silently overwrite each other, with one
// payment's effect on the balance lost with no error anywhere. delta is
// signed: positive credits the account, negative debits it. Pass minBalance
// (e.g. 0) to reject a debit that would take the balance below that floor;
// omit it for adjustments with no floor (deposits, refunds in).
export async function adjustAccountBalance(
  accountId: string,
  delta: number,
  minBalance?: number
): Promise<number> {
  const tenantId = await getTenantId()
  const { data, error } = await supabase.rpc('adjust_account_balance', {
    p_account_id: accountId,
    p_tenant_id: tenantId,
    p_delta: delta,
    p_min_balance: minBalance ?? null,
  })
  if (error) throw new Error(error.message)
  return data as number
}

// Same as adjustAccountBalance but for suppliers.outstanding_balance - see
// adjust_supplier_balance in supabase/fix_balance_race_condition.sql.
export async function adjustSupplierBalance(
  supplierId: string,
  delta: number,
  minBalance?: number
): Promise<number> {
  const tenantId = await getTenantId()
  const { data, error } = await supabase.rpc('adjust_supplier_balance', {
    p_supplier_id: supplierId,
    p_tenant_id: tenantId,
    p_delta: delta,
    p_min_balance: minBalance ?? null,
  })
  if (error) throw new Error(error.message)
  return data as number
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function getFinanceAccounts(): Promise<FinanceAccount[]> {
  const tenantId = await getTenantId()
  const { data, error } = await supabase
    .from('finance_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to fetch accounts: ${error.message}`)
  return (data as DbFinanceAccount[]).map(toFinanceAccount)
}

export async function createFinanceAccount(params: {
  name: string
  type: FinanceAccountType
  accountTitle?: string
  bankName?: string
  accountNumber?: string
  openingBalance: number
}): Promise<FinanceAccount> {
  const tenantId = await getTenantId()

  const { data, error } = await supabase
    .from('finance_accounts')
    .insert({
      tenant_id: tenantId,
      name: params.name,
      type: params.type,
      account_title: params.accountTitle ?? null,
      bank_name: params.bankName ?? null,
      account_number: params.accountNumber ?? null,
      opening_balance: params.openingBalance,
      current_balance: params.openingBalance,
      is_default_cash: false,
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create account: ${error.message}`)

  const account = toFinanceAccount(data as DbFinanceAccount)

  // Record opening balance as a transaction if non-zero
  if (params.openingBalance > 0) {
    await supabase.from('finance_transactions').insert({
      tenant_id: tenantId,
      date: new Date().toISOString().split('T')[0],
      type: 'opening_balance',
      account_id: account.id,
      amount: params.openingBalance,
      description: 'Opening balance',
    })
  }

  return account
}

export async function updateFinanceAccount(
  id: string,
  params: { name?: string; accountTitle?: string; bankName?: string; accountNumber?: string; isActive?: boolean }
): Promise<FinanceAccount> {
  const tenantId = await getTenantId()
  const update: Record<string, unknown> = {}
  if (params.name !== undefined) update.name = params.name
  if (params.accountTitle !== undefined) update.account_title = params.accountTitle || null
  if (params.bankName !== undefined) update.bank_name = params.bankName || null
  if (params.accountNumber !== undefined) update.account_number = params.accountNumber || null
  if (params.isActive !== undefined) update.is_active = params.isActive

  const { data, error } = await supabase
    .from('finance_accounts')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()
  if (error) throw new Error(`Failed to update account: ${error.message}`)
  return toFinanceAccount(data as DbFinanceAccount)
}

// ─── Ensure Cash account exists (called on Finance page mount) ───────────────

export async function ensureDefaultCashAccount(): Promise<FinanceAccount> {
  const tenantId = await getTenantId()

  // Check if a default cash account already exists
  const { data: existing } = await supabase
    .from('finance_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_default_cash', true)
    .single()

  if (existing) return toFinanceAccount(existing as DbFinanceAccount)

  // Compute opening balance from existing transactions attributed to Cash
  const [salesRes, purchasesRes, expensesRes] = await Promise.all([
    supabase.from('sales').select('amount_received').eq('tenant_id', tenantId).eq('payment_method', 'Cash').is('account_id', null),
    supabase.from('purchases').select('amount_paid').eq('tenant_id', tenantId).eq('payment_method', 'Cash').is('account_id', null),
    supabase.from('expenses').select('amount').eq('tenant_id', tenantId).eq('payment_method', 'Cash').eq('status', 'Paid').is('account_id', null),
  ])
  const cashIn = (salesRes.data ?? []).reduce((s: number, r: Record<string, number>) => s + (r.amount_received ?? 0), 0)
  const cashOut = (purchasesRes.data ?? []).reduce((s: number, r: Record<string, number>) => s + (r.amount_paid ?? 0), 0)
    + (expensesRes.data ?? []).reduce((s: number, r: Record<string, number>) => s + (r.amount ?? 0), 0)
  const computedBalance = Math.max(0, cashIn - cashOut)

  // Create it
  const { data, error } = await supabase
    .from('finance_accounts')
    .insert({
      tenant_id: tenantId,
      name: 'Cash',
      type: 'cash',
      opening_balance: computedBalance,
      current_balance: computedBalance,
      is_default_cash: true,
    })
    .select()
    .single()
  if (error) throw new Error(`Failed to create cash account: ${error.message}`)

  // Backfill existing sales/purchases/expenses to point to this cash account
  const cashId = (data as DbFinanceAccount).id
  await Promise.all([
    supabase.from('sales').update({ account_id: cashId }).eq('tenant_id', tenantId).is('account_id', null),
    supabase.from('purchases').update({ account_id: cashId }).eq('tenant_id', tenantId).is('account_id', null),
    supabase.from('expenses').update({ account_id: cashId }).eq('tenant_id', tenantId).is('account_id', null),
    supabase.from('payments').update({ account_id: cashId }).eq('tenant_id', tenantId).is('account_id', null),
  ])

  return toFinanceAccount(data as DbFinanceAccount)
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export async function getFinanceTransactions(accountId?: string): Promise<FinanceTransaction[]> {
  const tenantId = await getTenantId()
  let query = supabase
    .from('finance_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (accountId) query = query.eq('account_id', accountId)

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`)
  return (data as DbFinanceTransaction[]).map(toFinanceTransaction)
}

// ─── Deposit ──────────────────────────────────────────────────────────────────

export async function createDeposit(params: {
  accountId: string
  amount: number
  date: string
  description?: string
  notes?: string
}): Promise<FinanceTransaction> {
  const tenantId = await getTenantId()
  const userId = await getCurrentUserId().catch(() => '')

  const { data: txData, error: txError } = await supabase
    .from('finance_transactions')
    .insert({
      tenant_id: tenantId,
      date: params.date,
      type: 'deposit',
      account_id: params.accountId,
      amount: params.amount,
      description: params.description ?? 'Deposit',
      notes: params.notes ?? null,
      created_by: userId,
    })
    .select()
    .single()
  if (txError) throw new Error(`Failed to create deposit: ${txError.message}`)

  await adjustAccountBalance(params.accountId, params.amount)

  return toFinanceTransaction(txData as DbFinanceTransaction)
}

// ─── Withdrawal ───────────────────────────────────────────────────────────────

export async function createWithdrawal(params: {
  accountId: string
  amount: number
  date: string
  description?: string
  notes?: string
}): Promise<FinanceTransaction> {
  const tenantId = await getTenantId()
  const userId = await getCurrentUserId().catch(() => '')

  // Debit first (atomically, locked against concurrent writers) so an
  // insufficient-balance rejection happens before any transaction row is
  // written - matches the old check-then-insert order without the old
  // pattern's race window between checking and writing the new balance.
  await adjustAccountBalance(params.accountId, -params.amount, 0)

  const { data: txData, error: txError } = await supabase
    .from('finance_transactions')
    .insert({
      tenant_id: tenantId,
      date: params.date,
      type: 'withdrawal',
      account_id: params.accountId,
      amount: params.amount,
      description: params.description ?? 'Withdrawal',
      notes: params.notes ?? null,
      created_by: userId,
    })
    .select()
    .single()
  if (txError) {
    // Roll back the debit since the transaction row failed to write - keeps
    // the account balance and the finance_transactions ledger consistent.
    await adjustAccountBalance(params.accountId, params.amount).catch(() => {})
    throw new Error(`Failed to create withdrawal: ${txError.message}`)
  }

  return toFinanceTransaction(txData as DbFinanceTransaction)
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

export async function createTransfer(params: {
  fromAccountId: string
  toAccountId: string
  amount: number
  date: string
  notes?: string
}): Promise<{ out: FinanceTransaction; into: FinanceTransaction }> {
  const tenantId = await getTenantId()
  const userId = await getCurrentUserId().catch(() => '')

  // Names only, for the transaction descriptions - balances are no longer
  // read here since adjustAccountBalance below does its own locked read.
  const { data: fromAcc } = await supabase.from('finance_accounts').select('name').eq('id', params.fromAccountId).single()
  const { data: toAcc } = await supabase.from('finance_accounts').select('name').eq('id', params.toAccountId).single()
  if (!fromAcc) throw new Error('Source account not found')
  if (!toAcc) throw new Error('Destination account not found')

  const desc = `Transfer to ${(toAcc as DbFinanceAccount).name}`
  const descIn = `Transfer from ${(fromAcc as DbFinanceAccount).name}`

  // Debit the source first (atomically, locked, floored at 0) so an
  // insufficient-balance rejection happens before any row is written.
  await adjustAccountBalance(params.fromAccountId, -params.amount, 0)

  const [outRes, inRes] = await Promise.all([
    supabase.from('finance_transactions').insert({
      tenant_id: tenantId,
      date: params.date,
      type: 'transfer_out',
      account_id: params.fromAccountId,
      to_account_id: params.toAccountId,
      amount: params.amount,
      description: desc,
      notes: params.notes ?? null,
      created_by: userId,
    }).select().single(),
    supabase.from('finance_transactions').insert({
      tenant_id: tenantId,
      date: params.date,
      type: 'transfer_in',
      account_id: params.toAccountId,
      to_account_id: params.fromAccountId,
      amount: params.amount,
      description: descIn,
      notes: params.notes ?? null,
      created_by: userId,
    }).select().single(),
  ])

  if (outRes.error || inRes.error) {
    // Roll back the debit if either transaction row failed to write.
    await adjustAccountBalance(params.fromAccountId, params.amount).catch(() => {})
    throw new Error(`Transfer failed: ${(outRes.error ?? inRes.error)!.message}`)
  }

  await adjustAccountBalance(params.toAccountId, params.amount)

  return {
    out: toFinanceTransaction(outRes.data as DbFinanceTransaction),
    into: toFinanceTransaction(inRes.data as DbFinanceTransaction),
  }
}

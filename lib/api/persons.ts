import { supabase } from '../supabase'
import { getTenantId } from './helpers'

export interface Person {
  id: string
  tenantId: string
  name: string
  phone: string
  notes: string
  openingBalance: number
  status: 'Active' | 'Inactive'
  createdAt: string
}

export interface PersonTransaction {
  id: string
  tenantId: string
  personId: string
  date: string
  type: 'gave' | 'took'
  amount: number
  method: string
  accountId: string | null
  notes: string
  createdAt: string
}

export async function getPersons(): Promise<Person[]> {
  const tenantId = await getTenantId()
  const { data, error } = await supabase
    .from('persons')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(d => ({
    id: d.id,
    tenantId: d.tenant_id,
    name: d.name,
    phone: d.phone ?? '',
    notes: d.notes ?? '',
    openingBalance: d.opening_balance ?? 0,
    status: d.status as Person['status'],
    createdAt: d.created_at,
  }))
}

export async function createPerson(p: Omit<Person, 'id' | 'tenantId' | 'createdAt'>): Promise<Person> {
  const tenantId = await getTenantId()
  const { data, error } = await supabase
    .from('persons')
    .insert({
      tenant_id: tenantId,
      name: p.name,
      phone: p.phone || null,
      notes: p.notes || null,
      opening_balance: p.openingBalance ?? 0,
      status: p.status ?? 'Active',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return {
    id: data.id,
    tenantId: data.tenant_id,
    name: data.name,
    phone: data.phone ?? '',
    notes: data.notes ?? '',
    openingBalance: data.opening_balance ?? 0,
    status: data.status,
    createdAt: data.created_at,
  }
}

export async function updatePerson(id: string, p: Partial<Omit<Person, 'id' | 'tenantId' | 'createdAt'>>): Promise<void> {
  const tenantId = await getTenantId()
  const update: Record<string, unknown> = {}
  if (p.name !== undefined) update.name = p.name
  if (p.phone !== undefined) update.phone = p.phone || null
  if (p.notes !== undefined) update.notes = p.notes || null
  if (p.openingBalance !== undefined) update.opening_balance = p.openingBalance
  if (p.status !== undefined) update.status = p.status
  const { error } = await supabase
    .from('persons')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (error) throw new Error(error.message)
}

export async function deletePerson(id: string): Promise<void> {
  const tenantId = await getTenantId()
  const { error } = await supabase
    .from('persons')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (error) throw new Error(error.message)
}

export async function getPersonTransactions(personId?: string): Promise<PersonTransaction[]> {
  const tenantId = await getTenantId()
  let q = supabase
    .from('person_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: true })
  if (personId) q = q.eq('person_id', personId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map(d => ({
    id: d.id,
    tenantId: d.tenant_id,
    personId: d.person_id,
    date: d.date,
    type: d.type as PersonTransaction['type'],
    amount: d.amount,
    method: d.method ?? 'Cash',
    accountId: d.account_id ?? null,
    notes: d.notes ?? '',
    createdAt: d.created_at,
  }))
}

export async function createPersonTransaction(
  t: Omit<PersonTransaction, 'id' | 'tenantId' | 'createdAt'>
): Promise<PersonTransaction> {
  const tenantId = await getTenantId()
  const { data, error } = await supabase
    .from('person_transactions')
    .insert({
      tenant_id: tenantId,
      person_id: t.personId,
      date: t.date,
      type: t.type,
      amount: t.amount,
      method: t.method,
      notes: t.notes || null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  // Full double-entry: update account balance + insert finance_transactions audit row
  if (t.accountId) {
    const { data: acc } = await supabase
      .from('finance_accounts')
      .select('current_balance')
      .eq('id', t.accountId)
      .single()
    if (acc) {
      const delta = t.type === 'gave' ? -t.amount : t.amount
      const newBalance = (acc as { current_balance: number }).current_balance + delta
      await supabase
        .from('finance_accounts')
        .update({ current_balance: newBalance })
        .eq('id', t.accountId)
    }
    // Audit trail in finance_transactions so Finance page shows this movement
    await supabase.from('finance_transactions').insert({
      tenant_id: tenantId,
      date: t.date,
      type: t.type === 'gave' ? 'person_gave' : 'person_took',
      account_id: t.accountId,
      amount: t.amount,
      reference_type: 'Person',
      reference_number: data.id,
      description: `${t.type === 'gave' ? 'Gave to' : 'Took from'} person${t.notes ? ` — ${t.notes}` : ''}`,
    })
  }

  return {
    id: data.id,
    tenantId: data.tenant_id,
    personId: data.person_id,
    date: data.date,
    type: data.type,
    amount: data.amount,
    method: data.method ?? 'Cash',
    accountId: data.account_id ?? null,
    notes: data.notes ?? '',
    createdAt: data.created_at,
  }
}

export async function deletePersonTransaction(id: string): Promise<void> {
  const tenantId = await getTenantId()
  const { error } = await supabase
    .from('person_transactions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (error) throw new Error(error.message)
}

import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toExpense, toDbExpense } from './types'
import type { DbExpense } from './types'
import type { Expense } from '@/data/types'

export async function getExpenses(): Promise<Expense[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })

    if (error) throw new Error(`Failed to fetch expenses: ${error.message}`)
    return (data as DbExpense[]).map(toExpense)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch expenses')
  }
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch expense: ${error.message}`)
    }
    return toExpense(data as DbExpense)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch expense')
  }
}

export async function createExpense(data: Omit<Expense, 'id'>): Promise<Expense> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbExpense(data as Partial<Expense>, tenantId)

    const { data: created, error } = await supabase
      .from('expenses')
      .insert(dbData)
      .select()
      .single()

    if (error) throw new Error(`Failed to create expense: ${error.message}`)
    return toExpense(created as DbExpense)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create expense')
  }
}

export async function updateExpense(id: string, data: Partial<Expense>): Promise<Expense> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbExpense(data, tenantId)
    const { tenant_id: _, ...updateData } = dbData as DbExpense

    const { data: updated, error } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update expense: ${error.message}`)
    return toExpense(updated as DbExpense)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update expense')
  }
}

export async function deleteExpense(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Failed to delete expense: ${error.message}`)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to delete expense')
  }
}

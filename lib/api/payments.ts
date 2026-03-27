import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toPayment, toDbPayment } from './types'
import type { DbPayment } from './types'
import type { Payment } from '@/data/types'

export async function getPayments(): Promise<Payment[]> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch payments: ${error.message}`)
    return (data as DbPayment[]).map(toPayment)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch payments')
  }
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  try {
    const tenantId = await getTenantId()
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch payment: ${error.message}`)
    }
    return toPayment(data as DbPayment)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch payment')
  }
}

export async function createPayment(data: Omit<Payment, 'id'>): Promise<Payment> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbPayment(data as Partial<Payment>, tenantId)

    const { data: created, error } = await supabase
      .from('payments')
      .insert(dbData)
      .select()
      .single()

    if (error) throw new Error(`Failed to create payment: ${error.message}`)
    return toPayment(created as DbPayment)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create payment')
  }
}

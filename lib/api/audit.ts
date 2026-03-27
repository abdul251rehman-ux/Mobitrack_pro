import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toAuditLog, toDbAuditLog } from './types'
import type { DbAuditLog } from './types'
import type { AuditLog } from '@/data/types'

export async function getAuditLogs(options?: {
  module?: string
  action?: string
  userId?: string
  limit?: number
  offset?: number
}): Promise<AuditLog[]> {
  try {
    const tenantId = await getTenantId()
    let query = supabase
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('timestamp', { ascending: false })

    if (options?.module) {
      query = query.eq('module', options.module)
    }
    if (options?.action) {
      query = query.eq('action', options.action)
    }
    if (options?.userId) {
      query = query.eq('user_id', options.userId)
    }
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1)
    }

    const { data, error } = await query

    if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`)
    return (data as DbAuditLog[]).map(toAuditLog)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch audit logs')
  }
}

export async function createAuditLog(data: Omit<AuditLog, 'id'>): Promise<void> {
  try {
    const tenantId = await getTenantId()
    const dbData = toDbAuditLog(data as Partial<AuditLog>, tenantId)

    const { error } = await supabase
      .from('audit_logs')
      .insert(dbData)

    if (error) throw new Error(`Failed to create audit log: ${error.message}`)
  } catch (err) {
    // Audit log failures should not break the application flow.
    // Log to console in development but swallow the error.
    console.error('Audit log write failed:', err)
  }
}

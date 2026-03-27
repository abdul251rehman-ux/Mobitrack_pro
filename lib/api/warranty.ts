import { supabase } from '../supabase'
import { getTenantId } from './helpers'
import { toWarrantyRecord, toWarrantyClaim, toRepairTicket } from './types'
import type {
  DbWarrantyRecord,
  DbWarrantyClaim,
  DbRepairTicket,
  DbRepairPart,
} from './types'
import type { WarrantyRecord, WarrantyClaim, RepairTicket, RepairPart } from '@/data/types'

// ─── Warranty Records ───────────────────────────────────────────────────────

export async function getWarrantyRecords(): Promise<WarrantyRecord[]> {
  try {
    const tenantId = await getTenantId()
    const { data: records, error } = await supabase
      .from('warranty_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch warranty records: ${error.message}`)

    const recordIds = (records as DbWarrantyRecord[]).map((r) => r.id)
    if (recordIds.length === 0) return []

    const { data: allClaims, error: claimsError } = await supabase
      .from('warranty_claims')
      .select('*')
      .in('warranty_id', recordIds)

    if (claimsError) throw new Error(`Failed to fetch warranty claims: ${claimsError.message}`)

    const claimsByWarranty = new Map<string, DbWarrantyClaim[]>()
    for (const claim of (allClaims as DbWarrantyClaim[])) {
      const list = claimsByWarranty.get(claim.warranty_id) ?? []
      list.push(claim)
      claimsByWarranty.set(claim.warranty_id, list)
    }

    return (records as DbWarrantyRecord[]).map((r) =>
      toWarrantyRecord(r, claimsByWarranty.get(r.id) ?? [])
    )
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch warranty records')
  }
}

export async function getWarrantyRecordById(id: string): Promise<WarrantyRecord | null> {
  try {
    const tenantId = await getTenantId()
    const { data: record, error } = await supabase
      .from('warranty_records')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch warranty record: ${error.message}`)
    }

    const { data: claims, error: claimsError } = await supabase
      .from('warranty_claims')
      .select('*')
      .eq('warranty_id', id)

    if (claimsError) throw new Error(`Failed to fetch warranty claims: ${claimsError.message}`)

    return toWarrantyRecord(record as DbWarrantyRecord, (claims as DbWarrantyClaim[]) ?? [])
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch warranty record')
  }
}

export async function createWarrantyRecord(
  data: Omit<WarrantyRecord, 'id' | 'claims'>
): Promise<WarrantyRecord> {
  try {
    const tenantId = await getTenantId()

    const dbRecord = {
      tenant_id: tenantId,
      product_id: data.productId,
      product_name: data.productName,
      product_type: data.productType,
      imei: data.imei || null,
      customer_id: data.customerId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      sale_id: data.saleId,
      invoice_number: data.invoiceNumber,
      purchase_date: data.purchaseDate,
      warranty_months: data.warrantyMonths,
      expiry_date: data.expiryDate,
      status: data.status,
    }

    const { data: created, error } = await supabase
      .from('warranty_records')
      .insert(dbRecord)
      .select()
      .single()

    if (error) throw new Error(`Failed to create warranty record: ${error.message}`)
    return toWarrantyRecord(created as DbWarrantyRecord, [])
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create warranty record')
  }
}

// ─── Warranty Claims ────────────────────────────────────────────────────────

export async function createWarrantyClaim(
  warrantyId: string,
  data: Omit<WarrantyClaim, 'id'>
): Promise<WarrantyClaim> {
  try {
    const tenantId = await getTenantId()

    const dbClaim = {
      tenant_id: tenantId,
      warranty_id: warrantyId,
      date: data.date,
      issue: data.issue,
      resolution: data.resolution,
      status: data.status,
      repair_ticket_id: data.repairTicketId || null,
      notes: data.notes || null,
    }

    const { data: created, error } = await supabase
      .from('warranty_claims')
      .insert(dbClaim)
      .select()
      .single()

    if (error) throw new Error(`Failed to create warranty claim: ${error.message}`)

    // Update warranty status to 'Claimed'
    await supabase
      .from('warranty_records')
      .update({ status: 'Claimed' })
      .eq('id', warrantyId)

    return toWarrantyClaim(created as DbWarrantyClaim)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create warranty claim')
  }
}

// ─── Repair Tickets ─────────────────────────────────────────────────────────

export async function getRepairTickets(): Promise<RepairTicket[]> {
  try {
    const tenantId = await getTenantId()
    const { data: tickets, error } = await supabase
      .from('repair_tickets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch repair tickets: ${error.message}`)

    const ticketIds = (tickets as DbRepairTicket[]).map((t) => t.id)
    if (ticketIds.length === 0) return []

    const { data: allParts, error: partsError } = await supabase
      .from('repair_parts')
      .select('*')
      .in('repair_ticket_id', ticketIds)

    if (partsError) throw new Error(`Failed to fetch repair parts: ${partsError.message}`)

    const partsByTicket = new Map<string, DbRepairPart[]>()
    for (const part of (allParts as DbRepairPart[])) {
      const list = partsByTicket.get(part.repair_ticket_id) ?? []
      list.push(part)
      partsByTicket.set(part.repair_ticket_id, list)
    }

    return (tickets as DbRepairTicket[]).map((t) =>
      toRepairTicket(t, partsByTicket.get(t.id) ?? [])
    )
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch repair tickets')
  }
}

export async function getRepairTicketById(id: string): Promise<RepairTicket | null> {
  try {
    const tenantId = await getTenantId()
    const { data: ticket, error } = await supabase
      .from('repair_tickets')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch repair ticket: ${error.message}`)
    }

    const { data: parts, error: partsError } = await supabase
      .from('repair_parts')
      .select('*')
      .eq('repair_ticket_id', id)

    if (partsError) throw new Error(`Failed to fetch repair parts: ${partsError.message}`)

    return toRepairTicket(ticket as DbRepairTicket, (parts as DbRepairPart[]) ?? [])
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to fetch repair ticket')
  }
}

export async function createRepairTicket(
  data: Omit<RepairTicket, 'id' | 'parts'>,
  parts: RepairPart[]
): Promise<RepairTicket> {
  try {
    const tenantId = await getTenantId()

    const dbTicket = {
      tenant_id: tenantId,
      ticket_number: data.ticketNumber,
      date: data.date,
      customer_id: data.customerId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      device_brand: data.deviceBrand,
      device_model: data.deviceModel,
      imei: data.imei || null,
      issue: data.issue,
      diagnosis: data.diagnosis || null,
      priority: data.priority,
      status: data.status,
      estimated_cost: data.estimatedCost,
      actual_cost: data.actualCost,
      warranty_claim_id: data.warrantyClaimId || null,
      technician_name: data.technicianName,
      received_date: data.receivedDate,
      estimated_completion_date: data.estimatedCompletionDate || null,
      completed_date: data.completedDate || null,
      delivered_date: data.deliveredDate || null,
      notes: data.notes || null,
    }

    const { data: created, error } = await supabase
      .from('repair_tickets')
      .insert(dbTicket)
      .select()
      .single()

    if (error) throw new Error(`Failed to create repair ticket: ${error.message}`)

    const ticketId = (created as DbRepairTicket).id
    let createdParts: DbRepairPart[] = []

    if (parts.length > 0) {
      const dbParts = parts.map((p) => ({
        tenant_id: tenantId,
        repair_ticket_id: ticketId,
        name: p.name,
        cost: p.cost,
        quantity: p.quantity,
      }))

      const { data: partsData, error: partsError } = await supabase
        .from('repair_parts')
        .insert(dbParts)
        .select()

      if (partsError) throw new Error(`Failed to create repair parts: ${partsError.message}`)
      createdParts = (partsData as DbRepairPart[]) ?? []
    }

    return toRepairTicket(created as DbRepairTicket, createdParts)
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to create repair ticket')
  }
}

export async function updateRepairTicket(
  id: string,
  data: Partial<RepairTicket>
): Promise<RepairTicket> {
  try {
    const updatePayload: Record<string, unknown> = {}
    if (data.status !== undefined) updatePayload.status = data.status
    if (data.diagnosis !== undefined) updatePayload.diagnosis = data.diagnosis
    if (data.priority !== undefined) updatePayload.priority = data.priority
    if (data.estimatedCost !== undefined) updatePayload.estimated_cost = data.estimatedCost
    if (data.actualCost !== undefined) updatePayload.actual_cost = data.actualCost
    if (data.technicianName !== undefined) updatePayload.technician_name = data.technicianName
    if (data.estimatedCompletionDate !== undefined) updatePayload.estimated_completion_date = data.estimatedCompletionDate
    if (data.completedDate !== undefined) updatePayload.completed_date = data.completedDate
    if (data.deliveredDate !== undefined) updatePayload.delivered_date = data.deliveredDate
    if (data.notes !== undefined) updatePayload.notes = data.notes

    const { data: updated, error } = await supabase
      .from('repair_tickets')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Failed to update repair ticket: ${error.message}`)

    const { data: parts, error: partsError } = await supabase
      .from('repair_parts')
      .select('*')
      .eq('repair_ticket_id', id)

    if (partsError) throw new Error(`Failed to fetch repair parts: ${partsError.message}`)

    return toRepairTicket(updated as DbRepairTicket, (parts as DbRepairPart[]) ?? [])
  } catch (err) {
    throw err instanceof Error ? err : new Error('Failed to update repair ticket')
  }
}

// ─── Audit Log & ID Generation Helpers ──────────────────────────────────────

import type { AuditLog, AuditAction, AuditModule } from "@/data/types";

export interface CreateAuditEntryParams {
  action: AuditAction;
  module: AuditModule;
  entityId?: string;
  entityName?: string;
  description: string;
  oldValue?: Record<string, unknown> | string | number | null;
  newValue?: Record<string, unknown> | string | number | null;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

function stringifyValue(
  value: Record<string, unknown> | string | number | null | undefined
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

/**
 * Create an audit log entry with auto-generated ID and timestamp.
 * User fields are set to placeholders — they will be overwritten
 * once the auth context is wired up.
 */
export function createAuditEntry(params: CreateAuditEntryParams): AuditLog {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    userId: "system",
    userName: "Current User",
    userRole: "Admin",
    action: params.action,
    module: params.module,
    entityId: params.entityId,
    entityName: params.entityName,
    description: params.description,
    oldValue: stringifyValue(params.oldValue),
    newValue: stringifyValue(params.newValue),
  };
}

// ─── Number / ID Generators ─────────────────────────────────────────────────

/**
 * Generate a return number in the format RET-YYYY-NNNN.
 */
export function generateReturnNumber(lastNumber: number): string {
  return `RET-${new Date().getFullYear()}-${String(lastNumber + 1).padStart(4, "0")}`;
}

/**
 * Generate a repair ticket number in the format RPR-YYYY-NNNN.
 */
export function generateTicketNumber(lastNumber: number): string {
  return `RPR-${new Date().getFullYear()}-${String(lastNumber + 1).padStart(4, "0")}`;
}

/**
 * Generate a unique payment ID prefixed with PAY-.
 */
export function generatePaymentId(): string {
  return `PAY-${generateId()}`;
}

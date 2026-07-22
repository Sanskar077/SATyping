import { db, auditLogsTable } from "@workspace/db";

/**
 * Records an Owner mutation to audit_logs. Call this, don't inline db.insert(auditLogsTable, ...)
 * calls at each route — this is the single source of truth for the shape of an audit entry.
 * Fire-and-forget by design: a logging failure should never fail the underlying mutation, so
 * errors are swallowed (and would show up in normal error logging via the DB driver/logger).
 */
export async function logAudit(
  userId: number,
  action: string,
  targetType: string,
  targetId: number | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId,
      action,
      targetType,
      targetId,
      metadata: metadata ?? null,
    });
  } catch {
    // Never let audit logging break the actual mutation it's describing.
  }
}

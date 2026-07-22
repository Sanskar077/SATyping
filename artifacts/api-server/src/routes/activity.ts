import { Router } from "express";
import { eq, and, SQL, count } from "drizzle-orm";
import { db, auditLogsTable, loginLogsTable } from "@workspace/db";
import { ListAuditLogsQueryParams, ListLoginLogsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireOwner } from "../lib/roles";

const router = Router();

function formatAuditLog(l: typeof auditLogsTable.$inferSelect) {
  return {
    id: l.id,
    userId: l.userId,
    action: l.action,
    targetType: l.targetType,
    targetId: l.targetId ?? null,
    metadata: l.metadata ?? null,
    createdAt: l.createdAt.toISOString(),
  };
}

function formatLoginLog(l: typeof loginLogsTable.$inferSelect) {
  return {
    id: l.id,
    userId: l.userId ?? null,
    email: l.email,
    success: l.success,
    ipAddress: l.ipAddress ?? null,
    userAgent: l.userAgent ?? null,
    createdAt: l.createdAt.toISOString(),
  };
}

router.get("/audit-logs", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const params = ListAuditLogsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { action, targetType, page = 1, limit = 50 } = params.data;
  const conditions: SQL[] = [];
  if (action) conditions.push(eq(auditLogsTable.action, action));
  if (targetType) conditions.push(eq(auditLogsTable.targetType, targetType));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const offset = (page - 1) * limit;
  const logs = await db.select().from(auditLogsTable).where(where).limit(limit).offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(auditLogsTable).where(where);

  // Most recent first.
  logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json({ logs: logs.map(formatAuditLog), total, page, limit });
});

router.get("/login-logs", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const params = ListLoginLogsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { email, success, page = 1, limit = 50 } = params.data;
  const conditions: SQL[] = [];
  if (email) conditions.push(eq(loginLogsTable.email, email));
  if (success !== undefined) conditions.push(eq(loginLogsTable.success, success));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const offset = (page - 1) * limit;
  const logs = await db.select().from(loginLogsTable).where(where).limit(limit).offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(loginLogsTable).where(where);

  logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  res.json({ logs: logs.map(formatLoginLog), total, page, limit });
});

export default router;

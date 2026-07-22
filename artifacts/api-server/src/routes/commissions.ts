import { Router } from "express";
import { eq, and, gte, lte, SQL, count } from "drizzle-orm";
import { db, commissionsTable, usersTable } from "@workspace/db";
import { ListMyCommissionsQueryParams, ListCommissionsQueryParams, UpdateCommissionStatusParams, UpdateCommissionStatusBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireInstituteAdmin, requireOwner } from "../lib/roles";
import { logAudit } from "../lib/audit";
import { notify } from "../lib/notifications";

const router = Router();

function formatCommission(c: typeof commissionsTable.$inferSelect) {
  return {
    id: c.id,
    instituteId: c.instituteId,
    paymentId: c.paymentId,
    studentUserId: c.studentUserId,
    amountInPaise: c.amountInPaise,
    commissionType: c.commissionType,
    commissionRate: c.commissionRate,
    status: c.status,
    paidAt: c.paidAt ? c.paidAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

// Institute admin: commissions for THEIR OWN institute only. Never trust a client-supplied
// instituteId here — always scope to req.user.instituteId from the authenticated token.
router.get("/commissions/my", requireAuth, requireInstituteAdmin, async (req, res): Promise<void> => {
  const params = ListMyCommissionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const instituteId = req.user!.instituteId;
  if (!instituteId) {
    // An institute_admin with no instituteId is a data-integrity problem, not a valid state —
    // fail closed rather than accidentally returning cross-institute data.
    res.status(403).json({ error: "No institute associated with this account" });
    return;
  }

  const { status, page = 1, limit = 20 } = params.data;
  const conditions: SQL[] = [eq(commissionsTable.instituteId, instituteId)];
  if (status) conditions.push(eq(commissionsTable.status, status));

  const offset = (page - 1) * limit;
  const where = and(...conditions);

  const commissions = await db.select().from(commissionsTable).where(where).limit(limit).offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(commissionsTable).where(where);

  res.json({ commissions: commissions.map(formatCommission), total, page, limit });
});

// Owner: commissions across ALL institutes, filterable.
router.get("/commissions", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const params = ListCommissionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { instituteId, status, fromDate, toDate, page = 1, limit = 20 } = params.data;
  const conditions: SQL[] = [];
  if (instituteId) conditions.push(eq(commissionsTable.instituteId, instituteId));
  if (status) conditions.push(eq(commissionsTable.status, status));
  if (fromDate) conditions.push(gte(commissionsTable.createdAt, fromDate));
  if (toDate) conditions.push(lte(commissionsTable.createdAt, toDate));

  const offset = (page - 1) * limit;
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const commissions = await db.select().from(commissionsTable).where(where).limit(limit).offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(commissionsTable).where(where);

  res.json({ commissions: commissions.map(formatCommission), total, page, limit });
});

router.patch("/commissions/:id", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const parsedParams = UpdateCommissionStatusParams.safeParse(req.params);
  const parsed = UpdateCommissionStatusBody.safeParse(req.body);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [commission] = await db.update(commissionsTable).set({
    status: parsed.data.status,
    ...(parsed.data.status === "paid" && { paidAt: new Date() }),
  }).where(eq(commissionsTable.id, parsedParams.data.id)).returning();

  if (!commission) {
    res.status(404).json({ error: "Commission not found" });
    return;
  }
  await logAudit(req.user!.userId, "update_commission_status", "commission", commission.id, { status: parsed.data.status });

  if (parsed.data.status === "paid") {
    const [instituteAdmin] = await db.select().from(usersTable)
      .where(and(eq(usersTable.instituteId, commission.instituteId), eq(usersTable.role, "institute_admin")));
    if (instituteAdmin) {
      await notify(
        instituteAdmin.id,
        "commission_paid",
        "Commission paid out",
        `Your commission of ₹${(commission.amountInPaise / 100).toFixed(2)} has been paid out.`,
        { commissionId: commission.id },
      );
    }
  }

  res.json(formatCommission(commission));
});

export default router;

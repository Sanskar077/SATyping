import { Router } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, plansTable, subscriptionsTable } from "@workspace/db";
import { ListPlansQueryParams, CreatePlanBody, GetPlanParams, UpdatePlanParams, UpdatePlanBody, DeletePlanParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireOwner } from "../lib/roles";
import { normalizeBoolQueryParams } from "../lib/query-params";
import { logAudit } from "../lib/audit";

const router = Router();

function formatPlan(p: typeof plansTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    priceInPaise: p.priceInPaise,
    currency: p.currency,
    durationDays: p.durationDays,
    forInstitute: p.forInstitute,
    features: p.features,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  };
}

// Public: list active plans, optionally filtered by audience (student vs institute).
router.get("/plans", async (req, res): Promise<void> => {
  // forInstitute arrives as the string "true"/"false"; normalise before validation so
  // ?forInstitute=false is not misread as true (see lib/query-params.ts).
  const params = ListPlansQueryParams.safeParse(normalizeBoolQueryParams(req.query, ["forInstitute"]));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions: SQL[] = [eq(plansTable.isActive, true)];
  if (params.data.forInstitute !== undefined) {
    conditions.push(eq(plansTable.forInstitute, params.data.forInstitute));
  }

  const plans = await db.select().from(plansTable).where(and(...conditions));
  res.json({ plans: plans.map(formatPlan) });
});

// Public: get a single plan by id (no isActive filter here — an admin surface fetching an
// individual plan to edit it, e.g. via a direct link, should still be able to see inactive ones;
// callers that only want purchasable plans use the list endpoint instead).
router.get("/plans/:id", async (req, res): Promise<void> => {
  const parsedParams = GetPlanParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, parsedParams.data.id));
  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  res.json(formatPlan(plan));
});

router.post("/plans", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const parsed = CreatePlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plan] = await db.insert(plansTable).values({
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    priceInPaise: parsed.data.priceInPaise,
    currency: parsed.data.currency ?? "INR",
    durationDays: parsed.data.durationDays,
    forInstitute: parsed.data.forInstitute ?? false,
    features: parsed.data.features ?? [],
  }).returning();

  await logAudit(req.user!.userId, "create_plan", "plan", plan.id, { name: plan.name });

  res.status(201).json(formatPlan(plan));
});

router.patch("/plans/:id", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const parsedParams = UpdatePlanParams.safeParse(req.params);
  const parsed = UpdatePlanBody.safeParse(req.body);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plan] = await db.update(plansTable).set({
    ...(parsed.data.name !== undefined && { name: parsed.data.name }),
    ...(parsed.data.description !== undefined && { description: parsed.data.description }),
    ...(parsed.data.priceInPaise !== undefined && { priceInPaise: parsed.data.priceInPaise }),
    ...(parsed.data.durationDays !== undefined && { durationDays: parsed.data.durationDays }),
    ...(parsed.data.features !== undefined && { features: parsed.data.features }),
    ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
  }).where(eq(plansTable.id, parsedParams.data.id)).returning();

  if (!plan) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  await logAudit(req.user!.userId, "update_plan", "plan", plan.id, parsed.data);
  res.json(formatPlan(plan));
});

router.delete("/plans/:id", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const parsedParams = DeletePlanParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }

  const [inUse] = await db.select().from(subscriptionsTable)
    .where(and(eq(subscriptionsTable.planId, parsedParams.data.id), eq(subscriptionsTable.status, "active")));

  if (inUse) {
    // Soft-delete: a plan with active subscriptions must keep existing subscribers working.
    await db.update(plansTable).set({ isActive: false }).where(eq(plansTable.id, parsedParams.data.id));
    await logAudit(req.user!.userId, "soft_delete_plan", "plan", parsedParams.data.id);
    res.sendStatus(204);
    return;
  }

  await db.delete(plansTable).where(eq(plansTable.id, parsedParams.data.id));
  await logAudit(req.user!.userId, "delete_plan", "plan", parsedParams.data.id);
  res.sendStatus(204);
});

export default router;

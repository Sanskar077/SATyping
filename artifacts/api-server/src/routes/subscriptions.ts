import { Router } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { ListSubscriptionsQueryParams, UpgradeSubscriptionBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    "Unlimited practice sessions",
    "English typing only",
    "Basic WPM tracking",
    "5 test attempts per month",
  ],
  pro_student: [
    "All languages (English, Hindi, Marathi)",
    "Unlimited test attempts",
    "Advanced analytics & trends",
    "Certificate generation",
    "Performance history",
    "Priority support",
  ],
  institute: [
    "All Pro Student features",
    "Institute management dashboard",
    "Batch/student management",
    "Custom passages",
    "Institute-wide analytics",
    "Branded certificates",
    "API access",
  ],
};

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    billingPeriod: "forever",
    features: PLAN_FEATURES.free,
    isPopular: false,
  },
  {
    id: "pro_student",
    name: "Pro Student",
    price: 299,
    billingPeriod: "month",
    features: PLAN_FEATURES.pro_student,
    isPopular: true,
  },
  {
    id: "institute",
    name: "Institute",
    price: 2999,
    billingPeriod: "month",
    features: PLAN_FEATURES.institute,
    isPopular: false,
  },
];

function formatSubscription(s: typeof subscriptionsTable.$inferSelect) {
  return {
    id: s.id, userId: s.userId, plan: s.plan, status: s.status,
    startedAt: s.startedAt.toISOString(),
    expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
    features: PLAN_FEATURES[s.plan] ?? [],
  };
}

router.get("/subscriptions/plans", async (_req, res): Promise<void> => {
  res.json(PLANS);
});

router.get("/subscriptions/my", requireAuth, async (req, res): Promise<void> => {
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, req.user!.userId));

  if (!sub) {
    const [created] = await db.insert(subscriptionsTable).values({
      userId: req.user!.userId,
      plan: "free",
      status: "active",
      startedAt: new Date(),
    }).returning();
    res.json(formatSubscription(created));
    return;
  }

  res.json(formatSubscription(sub));
});

router.get("/subscriptions", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const params = ListSubscriptionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { userId, plan, page = 1, limit = 20 } = params.data;
  const conditions: SQL[] = [];
  if (userId) conditions.push(eq(subscriptionsTable.userId, userId));
  if (plan) conditions.push(eq(subscriptionsTable.plan, plan));

  const offset = (page - 1) * limit;
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const subs = await db.select().from(subscriptionsTable).where(where).limit(limit).offset(offset);
  const all = await db.select().from(subscriptionsTable).where(where);

  res.json({ subscriptions: subs.map(formatSubscription), total: all.length, page, limit });
});

router.post("/subscriptions/upgrade", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpgradeSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, req.user!.userId));

  let sub;
  if (existing) {
    [sub] = await db.update(subscriptionsTable).set({
      plan: parsed.data.plan,
      status: "active",
      startedAt: new Date(),
      expiresAt,
    }).where(eq(subscriptionsTable.userId, req.user!.userId)).returning();
  } else {
    [sub] = await db.insert(subscriptionsTable).values({
      userId: req.user!.userId,
      plan: parsed.data.plan,
      status: "active",
      startedAt: new Date(),
      expiresAt,
    }).returning();
  }

  await db.update(usersTable).set({ subscriptionPlan: parsed.data.plan }).where(eq(usersTable.id, req.user!.userId));

  res.json(formatSubscription(sub));
});

export default router;

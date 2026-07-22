import { Router } from "express";
import { eq, and, SQL, count } from "drizzle-orm";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { ListSubscriptionsQueryParams, UpgradeSubscriptionBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requirePermission, PERMISSIONS } from "../lib/permissions";
import { logAudit } from "../lib/audit";

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

router.get("/subscriptions", requireAuth, requirePermission(PERMISSIONS.MANAGE_SUBSCRIPTION), async (req, res): Promise<void> => {
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
  const [{ value: total }] = await db.select({ value: count() }).from(subscriptionsTable).where(where);

  res.json({ subscriptions: subs.map(formatSubscription), total, page, limit });
});

// GAP #2 FIX: this used to let ANY authenticated user upgrade their OWN plan with zero payment
// check — a straight payment bypass. Real upgrades now go through POST /api/payments/checkout +
// the Razorpay webhook (routes/payments.ts). This endpoint survives ONLY as an owner tool for
// granting free/lifetime access to a specific user, e.g. promo accounts or manual comps.
router.post("/subscriptions/upgrade", requireAuth, requirePermission(PERMISSIONS.MANAGE_SUBSCRIPTION), async (req, res): Promise<void> => {
  const parsed = UpgradeSubscriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const durationDays = parsed.data.durationDays ?? 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, parsed.data.userId));

  let sub;
  if (existing) {
    [sub] = await db.update(subscriptionsTable).set({
      plan: parsed.data.plan,
      status: "active",
      startedAt: new Date(),
      expiresAt,
    }).where(eq(subscriptionsTable.userId, parsed.data.userId)).returning();
  } else {
    [sub] = await db.insert(subscriptionsTable).values({
      userId: parsed.data.userId,
      plan: parsed.data.plan,
      status: "active",
      startedAt: new Date(),
      expiresAt,
    }).returning();
  }

  await db.update(usersTable).set({ subscriptionPlan: parsed.data.plan, accountStatus: "active" }).where(eq(usersTable.id, parsed.data.userId));

  await logAudit(req.user!.userId, "grant_subscription", "user", parsed.data.userId, { plan: parsed.data.plan, durationDays });

  res.json(formatSubscription(sub));
});

export default router;

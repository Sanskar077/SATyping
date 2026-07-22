import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, paymentsTable, usersTable, institutesTable, subscriptionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { requireOwner } from "../lib/roles";

const router = Router();

router.get("/analytics/overview", requireAuth, requireOwner, async (_req, res): Promise<void> => {
  const [payments, students, institutes, subscriptions] = await Promise.all([
    db.select().from(paymentsTable),
    db.select().from(usersTable).where(eq(usersTable.role, "student")),
    db.select().from(institutesTable),
    db.select().from(subscriptionsTable),
  ]);

  const successfulPayments = payments.filter((p) => p.status === "success");
  const totalRevenueInPaise = successfulPayments.reduce((sum, p) => sum + p.amountInPaise, 0);

  const independentStudents = students.filter((s) => s.instituteId === null).length;
  const activeInstitutes = institutes.filter((i) => i.accountStatus === "active").length;
  const inactiveAccounts =
    students.filter((s) => s.accountStatus === "inactive").length +
    institutes.filter((i) => i.accountStatus === "inactive").length;

  // Revenue for each of the last 6 months (oldest first).
  const now = new Date();
  const revenueByMonth = Array.from({ length: 6 }, (_, idx) => {
    const monthsAgo = 5 - idx;
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const revenueInPaise = successfulPayments
      .filter((p) => p.createdAt.getFullYear() === d.getFullYear() && p.createdAt.getMonth() === d.getMonth())
      .reduce((sum, p) => sum + p.amountInPaise, 0);
    return { month: monthLabel, revenueInPaise };
  });

  const planCounts = new Map<string, number>();
  for (const sub of subscriptions) {
    planCounts.set(sub.plan, (planCounts.get(sub.plan) ?? 0) + 1);
  }
  const planDistribution = Array.from(planCounts.entries()).map(([plan, count]) => ({ plan, count }));

  res.json({
    totalRevenueInPaise,
    totalStudents: students.length,
    independentStudents,
    totalInstitutes: institutes.length,
    activeInstitutes,
    inactiveAccounts,
    revenueByMonth,
    planDistribution,
  });
});

export default router;

import { Router } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, usersTable, institutesTable } from "@workspace/db";
import { ListUsersQueryParams, GetUserParams, UpdateUserParams, UpdateUserBody, DeleteUserParams, SetUserPremiumParams, SetUserPremiumBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";
import { requirePermission, PERMISSIONS } from "../lib/permissions";
import { computeHasAccess } from "../lib/account-status";
import { logAudit } from "../lib/audit";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect, instituteName?: string | null, instituteAccountStatus: string | null = null) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone ?? null,
    isActive: user.isActive,
    subscriptionPlan: user.subscriptionPlan,
    accountStatus: user.accountStatus,
    premiumGrantedByOwner: user.premiumGrantedByOwner,
    hasAccess: computeHasAccess(user.role, user.accountStatus, instituteAccountStatus),
    emailVerified: user.emailVerified,
    instituteId: user.instituteId ?? null,
    instituteName: instituteName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/users", requireAuth, requirePermission(PERMISSIONS.MANAGE_USERS), async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { role, instituteId, search, page = 1, limit = 20 } = params.data;
  const conditions: SQL[] = [];

  if (role) conditions.push(eq(usersTable.role, role));

  if (req.user!.role === "institute_admin") {
    // Never let an institute_admin see another institute's users, regardless of what
    // instituteId they pass (or omit) — always force-scope to their own.
    conditions.push(eq(usersTable.instituteId, req.user!.instituteId ?? -1));
  } else if (instituteId) {
    conditions.push(eq(usersTable.instituteId, instituteId));
  }

  if (search) conditions.push(ilike(usersTable.name, `%${search}%`));

  const offset = (page - 1) * limit;
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const users = await db.select().from(usersTable).where(where).limit(limit).offset(offset);
  const total = await db.select({ count: usersTable.id }).from(usersTable).where(where);

  const formatted = users.map(u => formatUser(u));
  res.json({ users: formatted, total: total.length, page, limit });
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const isSelf = req.user!.userId === id;
  const isOwner = req.user!.role === "super_admin";

  if (!isSelf && !isOwner) {
    if (req.user!.role !== "institute_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target || target.instituteId !== req.user!.instituteId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  let instituteName: string | null = null;
  if (user.instituteId) {
    const [inst] = await db.select().from(institutesTable).where(eq(institutesTable.id, user.instituteId));
    instituteName = inst?.name ?? null;
  }

  res.json(formatUser(user, instituteName));
});

router.patch("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const isSelf = req.user!.userId === id;
  const isOwner = req.user!.role === "super_admin";

  if (!isSelf && !isOwner) {
    // Only an institute_admin managing a user IN THEIR OWN institute may edit someone else —
    // never another institute's user, and never a bare "teacher" role (no blanket edit rights).
    if (req.user!.role !== "institute_admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!target || target.instituteId !== req.user!.instituteId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.update(usersTable).set({
    ...(parsed.data.name && { name: parsed.data.name }),
    phone: parsed.data.phone ?? null,
    avatarUrl: parsed.data.avatarUrl ?? null,
    ...(parsed.data.isActive !== undefined && isOwner && { isActive: parsed.data.isActive }),
  }).where(eq(usersTable.id, id)).returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (!isSelf) {
    await logAudit(req.user!.userId, "update_user", "user", user.id, parsed.data);
  }

  res.json(formatUser(user));
});

router.delete("/users/:id", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(usersTable).where(eq(usersTable.id, id));
  await logAudit(req.user!.userId, "delete_user", "user", id);
  res.sendStatus(204);
});

// Student self-service: leave their institute, demoting to independent. Never deletes the
// account, history, or results — reuses the same membership-field logic as the admin add/remove
// path (membershipFieldsForLeave), just sets instituteId to null.
router.post("/users/me/leave-institute", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.instituteId === null) {
    res.sendStatus(204);
    return;
  }

  await db.update(usersTable).set({ instituteId: null }).where(eq(usersTable.id, user.id));
  res.sendStatus(204);
});

// Owner-only: manually grant or revoke Premium — bypasses payment/subscription entirely. This is
// the ONLY way (besides a real payment) a user gets accountStatus: "active". No institute admin
// or teacher role can do this, for any user, including their own institute's students.
router.patch("/users/:id/premium", requireAuth, requirePermission(PERMISSIONS.GRANT_PREMIUM), async (req, res): Promise<void> => {
  const parsedParams = SetUserPremiumParams.safeParse(req.params);
  const parsed = SetUserPremiumBody.safeParse(req.body);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, parsedParams.data.id));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Revoking only downgrades accountStatus if access came FROM the manual grant — never
  // accidentally downgrade someone who separately has a real, paid, active subscription.
  const updateData = parsed.data.premium
    ? { accountStatus: "active" as const, premiumGrantedByOwner: true }
    : existing.premiumGrantedByOwner
      ? { accountStatus: "inactive" as const, premiumGrantedByOwner: false }
      : { premiumGrantedByOwner: false };

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, parsedParams.data.id)).returning();

  await logAudit(req.user!.userId, parsed.data.premium ? "grant_premium" : "revoke_premium", "user", user.id);
  res.json(formatUser(user));
});

export default router;

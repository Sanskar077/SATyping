import { Router } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, usersTable, institutesTable } from "@workspace/db";
import { ListUsersQueryParams, GetUserParams, UpdateUserParams, UpdateUserBody, DeleteUserParams } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect, instituteName?: string | null) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone ?? null,
    isActive: user.isActive,
    subscriptionPlan: user.subscriptionPlan,
    instituteId: user.instituteId ?? null,
    instituteName: instituteName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/users", requireAuth, requireRole("institute_admin", "super_admin"), async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { role, instituteId, search, page = 1, limit = 20 } = params.data;
  const conditions: SQL[] = [];

  if (role) conditions.push(eq(usersTable.role, role));
  if (instituteId) conditions.push(eq(usersTable.instituteId, instituteId));
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

  if (req.user!.role === "student" && req.user!.userId !== id) {
    res.status(403).json({ error: "Forbidden" });
    return;
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

  if (req.user!.role === "student" && req.user!.userId !== id) {
    res.status(403).json({ error: "Forbidden" });
    return;
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
    ...(parsed.data.isActive !== undefined && req.user!.role === "super_admin" && { isActive: parsed.data.isActive }),
  }).where(eq(usersTable.id, id)).returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(formatUser(user));
});

router.delete("/users/:id", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

export default router;

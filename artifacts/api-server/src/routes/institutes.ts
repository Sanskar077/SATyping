import { Router } from "express";
import { eq, ilike, and, SQL, sql } from "drizzle-orm";
import { db, institutesTable, usersTable, batchesTable, testAttemptsTable, resultsTable, subscriptionsTable } from "@workspace/db";
import {
  ListInstitutesQueryParams, CreateInstituteBody, GetInstituteParams, UpdateInstituteParams,
  UpdateInstituteBody, DeleteInstituteParams, GetInstituteStudentsParams, GetInstituteStatsParams,
  ListBatchesQueryParams, CreateBatchBody, GetBatchParams, UpdateBatchParams, UpdateBatchBody, DeleteBatchParams,
  AddInstituteStudentBody, RemoveInstituteStudentParams, SetInstitutePremiumParams, SetInstitutePremiumBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole, hashPassword } from "../lib/auth";
import { requireOwner } from "../lib/roles";
import { requirePermission, PERMISSIONS } from "../lib/permissions";
import { membershipFieldsForJoin } from "../lib/institute-membership";
import { logAudit } from "../lib/audit";
import { notify } from "../lib/notifications";

const router = Router();

function formatInstitute(inst: typeof institutesTable.$inferSelect, studentCount = 0) {
  return {
    id: inst.id,
    name: inst.name,
    address: inst.address ?? null,
    phone: inst.phone ?? null,
    email: inst.email ?? null,
    logoUrl: inst.logoUrl ?? null,
    isActive: inst.isActive,
    subscriptionPlan: inst.subscriptionPlan,
    accountStatus: inst.accountStatus,
    premiumGrantedByOwner: inst.premiumGrantedByOwner,
    referralCode: inst.referralCode ?? null,
    studentCount,
    createdAt: inst.createdAt.toISOString(),
  };
}

// ─── INSTITUTES ─────────────────────────────────────────────────────────────

// Public: institute directory (name/address/logo only, via formatInstitute) so an unauthenticated
// student registering can search for and select an institute to join. No sensitive data exposed here.
router.get("/institutes", async (req, res): Promise<void> => {
  const params = ListInstitutesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { search, page = 1, limit = 20 } = params.data;
  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(institutesTable.name, `%${search}%`));

  const offset = (page - 1) * limit;
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const institutes = await db.select().from(institutesTable).where(where).limit(limit).offset(offset);
  const total = await db.select().from(institutesTable).where(where);

  const formatted = await Promise.all(institutes.map(async (inst) => {
    const students = await db.select().from(usersTable).where(eq(usersTable.instituteId, inst.id));
    return formatInstitute(inst, students.length);
  }));

  res.json({ institutes: formatted, total: total.length, page, limit });
});

router.post("/institutes", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const parsed = CreateInstituteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [inst] = await db.insert(institutesTable).values(parsed.data).returning();
  await logAudit(req.user!.userId, "create_institute", "institute", inst.id, { name: inst.name });
  res.status(201).json(formatInstitute(inst));
});

router.get("/institutes/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [inst] = await db.select().from(institutesTable).where(eq(institutesTable.id, id));
  if (!inst) {
    res.status(404).json({ error: "Institute not found" });
    return;
  }

  const students = await db.select().from(usersTable).where(eq(usersTable.instituteId, id));
  res.json(formatInstitute(inst, students.length));
});

router.patch("/institutes/:id", requireAuth, requirePermission(PERMISSIONS.MANAGE_INSTITUTE), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  // An institute_admin may only edit THEIR OWN institute, never another's — the role check above
  // only confirms they ARE an institute_admin, not which one.
  if (req.user!.role === "institute_admin" && req.user!.instituteId !== id) {
    res.status(403).json({ error: "Cannot manage another institute" });
    return;
  }

  const parsed = UpdateInstituteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address;
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
  if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
  if (parsed.data.logoUrl !== undefined) updateData.logoUrl = parsed.data.logoUrl;
  // isActive is an Owner-level lever (deactivating an institute account entirely) — never let an
  // institute_admin flip their own institute active/inactive.
  if (parsed.data.isActive !== undefined && req.user!.role === "super_admin") updateData.isActive = parsed.data.isActive;

  const [inst] = await db.update(institutesTable).set(updateData).where(eq(institutesTable.id, id)).returning();
  if (!inst) {
    res.status(404).json({ error: "Institute not found" });
    return;
  }

  if (req.user!.role === "super_admin") {
    await logAudit(req.user!.userId, "update_institute", "institute", inst.id, updateData);
  }

  const students = await db.select().from(usersTable).where(eq(usersTable.instituteId, id));
  res.json(formatInstitute(inst, students.length));
});

// Owner approves an institute — used after manual/offline payment verification, flips
// inactive to active. Never touches a student's own subscription status independently (an
// institute's access is separate from any individual student's own paid subscription).
router.post("/institutes/:id/approve", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [inst] = await db.update(institutesTable).set({ accountStatus: "active" }).where(eq(institutesTable.id, id)).returning();
  if (!inst) {
    res.status(404).json({ error: "Institute not found" });
    return;
  }
  await logAudit(req.user!.userId, "approve_institute", "institute", inst.id);

  const [instituteAdmin] = await db.select().from(usersTable)
    .where(and(eq(usersTable.instituteId, id), eq(usersTable.role, "institute_admin")));
  if (instituteAdmin) {
    await notify(instituteAdmin.id, "institute_approved", "Institute approved", `${inst.name} has been approved and is now active.`);
  }

  const students = await db.select().from(usersTable).where(eq(usersTable.instituteId, id));
  res.json(formatInstitute(inst, students.length));
});

router.post("/institutes/:id/suspend", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [inst] = await db.update(institutesTable).set({ accountStatus: "suspended" }).where(eq(institutesTable.id, id)).returning();
  if (!inst) {
    res.status(404).json({ error: "Institute not found" });
    return;
  }
  await logAudit(req.user!.userId, "suspend_institute", "institute", inst.id);

  const [instituteAdmin] = await db.select().from(usersTable)
    .where(and(eq(usersTable.instituteId, id), eq(usersTable.role, "institute_admin")));
  if (instituteAdmin) {
    await notify(instituteAdmin.id, "institute_suspended", "Institute suspended", `${inst.name} has been suspended. Contact support for details.`);
  }

  const students = await db.select().from(usersTable).where(eq(usersTable.instituteId, id));
  res.json(formatInstitute(inst, students.length));
});

// Owner-only: manually grant or revoke Premium for an ENTIRE institute — covers its whole
// roster (students/teachers inherit access via requireActiveAccess), bypassing payment entirely.
router.patch("/institutes/:id/premium", requireAuth, requirePermission(PERMISSIONS.GRANT_PREMIUM), async (req, res): Promise<void> => {
  const parsedParams = SetInstitutePremiumParams.safeParse(req.params);
  const parsed = SetInstitutePremiumBody.safeParse(req.body);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(institutesTable).where(eq(institutesTable.id, parsedParams.data.id));
  if (!existing) {
    res.status(404).json({ error: "Institute not found" });
    return;
  }

  const updateData = parsed.data.premium
    ? { accountStatus: "active" as const, premiumGrantedByOwner: true }
    : existing.premiumGrantedByOwner
      ? { accountStatus: "inactive" as const, premiumGrantedByOwner: false }
      : { premiumGrantedByOwner: false };

  const [inst2] = await db.update(institutesTable).set(updateData).where(eq(institutesTable.id, parsedParams.data.id)).returning();

  await logAudit(req.user!.userId, parsed.data.premium ? "grant_premium" : "revoke_premium", "institute", inst2.id);

  const premiumStudents = await db.select().from(usersTable).where(eq(usersTable.instituteId, inst2.id));
  res.json(formatInstitute(inst2, premiumStudents.length));
});

router.delete("/institutes/:id", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(institutesTable).where(eq(institutesTable.id, id));
  await logAudit(req.user!.userId, "delete_institute", "institute", id);
  res.sendStatus(204);
});

// Only the institute's own admin (or the owner) may list its students — previously this had no
// role/scope check at all, letting ANY authenticated user list ANY institute's students by id.
router.get("/institutes/:id/students", requireAuth, requirePermission(PERMISSIONS.MANAGE_STUDENTS), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (req.user!.role === "institute_admin" && req.user!.instituteId !== id) {
    res.status(403).json({ error: "Cannot view another institute's students" });
    return;
  }

  const students = await db.select().from(usersTable).where(
    and(eq(usersTable.instituteId, id), eq(usersTable.role, "student"))
  );

  const formatted = students.map(u => ({
    id: u.id, email: u.email, name: u.name, role: u.role,
    phone: u.phone ?? null, isActive: u.isActive, subscriptionPlan: u.subscriptionPlan,
    instituteId: u.instituteId ?? null, instituteName: null, avatarUrl: u.avatarUrl ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  res.json({ users: formatted, total: formatted.length, page: 1, limit: formatted.length });
});

// Reuses the exact same membership-assignment helper as student self-registration's "join" path —
// no forked logic for admin-added students.
router.post("/institutes/:id/students", requireAuth, requirePermission(PERMISSIONS.MANAGE_STUDENTS), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const instituteId = parseInt(raw, 10);

  // An institute_admin may only add students to THEIR OWN institute, never another's.
  if (req.user!.role === "institute_admin" && req.user!.instituteId !== instituteId) {
    res.status(403).json({ error: "Cannot manage another institute's students" });
    return;
  }

  const parsed = AddInstituteStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [institute] = await db.select().from(institutesTable).where(eq(institutesTable.id, instituteId));
  if (!institute) {
    res.status(404).json({ error: "Institute not found" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (existing) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const [student] = await db.insert(usersTable).values({
    email: parsed.data.email,
    passwordHash,
    name: parsed.data.name,
    role: "student",
    phone: parsed.data.phone ?? null,
    subscriptionPlan: "free",
    accountStatus: "inactive", // inherits access from the institute's accountStatus instead
    ...membershipFieldsForJoin(institute.id),
  }).returning();

  await db.insert(subscriptionsTable).values({
    userId: student.id,
    plan: "free",
    status: "active",
    startedAt: new Date(),
  });

  res.status(201).json({
    id: student.id, email: student.email, name: student.name, role: student.role,
    phone: student.phone ?? null, isActive: student.isActive, subscriptionPlan: student.subscriptionPlan,
    instituteId: student.instituteId ?? null, instituteName: institute.name, avatarUrl: student.avatarUrl ?? null,
    createdAt: student.createdAt.toISOString(),
  });
});

// Demotes to independent — never deletes the account, its history, or its results.
router.delete("/institutes/:id/students/:userId", requireAuth, requirePermission(PERMISSIONS.MANAGE_STUDENTS), async (req, res): Promise<void> => {
  const parsedParams = RemoveInstituteStudentParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }
  const { id: instituteId, userId } = parsedParams.data;

  if (req.user!.role === "institute_admin" && req.user!.instituteId !== instituteId) {
    res.status(403).json({ error: "Cannot manage another institute's students" });
    return;
  }

  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!student || student.instituteId !== instituteId) {
    res.status(404).json({ error: "Student not found in this institute" });
    return;
  }

  await db.update(usersTable).set({ instituteId: null }).where(eq(usersTable.id, userId));
  res.sendStatus(204);
});

router.get("/institutes/:id/stats", requireAuth, requirePermission(PERMISSIONS.VIEW_REPORTS), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  if (req.user!.role === "institute_admin" && req.user!.instituteId !== id) {
    res.status(403).json({ error: "Cannot view another institute's stats" });
    return;
  }

  const students = await db.select().from(usersTable).where(
    and(eq(usersTable.instituteId, id), eq(usersTable.role, "student"))
  );

  const studentIds = students.map(s => s.id);

  const results = await db.select().from(resultsTable).where(
    studentIds.length > 0 ? sql`${resultsTable.userId} = ANY(${studentIds})` : sql`false`
  );

  const avgWpm = results.length > 0 ? results.reduce((s, r) => s + r.netWpm, 0) / results.length : 0;
  const avgAccuracy = results.length > 0 ? results.reduce((s, r) => s + r.accuracy, 0) / results.length : 0;
  const passed = results.filter(r => r.passed).length;
  const passRate = results.length > 0 ? (passed / results.length) * 100 : 0;

  res.json({
    totalStudents: students.length,
    totalTests: results.length,
    avgAccuracy: Math.round(avgAccuracy * 100) / 100,
    avgWpm: Math.round(avgWpm * 100) / 100,
    passRate: Math.round(passRate * 100) / 100,
    recentActivity: [],
  });
});

// ─── BATCHES ─────────────────────────────────────────────────────────────────

router.get("/batches", requireAuth, async (req, res): Promise<void> => {
  const params = ListBatchesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { instituteId } = params.data;
  const batches = instituteId
    ? await db.select().from(batchesTable).where(eq(batchesTable.instituteId, instituteId))
    : await db.select().from(batchesTable);

  const formatted = batches.map(b => ({
    id: b.id, name: b.name, instituteId: b.instituteId,
    description: b.description ?? null, studentCount: 0,
    createdAt: b.createdAt.toISOString(),
  }));

  res.json(formatted);
});

router.post("/batches", requireAuth, requirePermission(PERMISSIONS.MANAGE_STUDENTS), async (req, res): Promise<void> => {
  const parsed = CreateBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // An institute_admin's batch is ALWAYS created under their own institute — never trust a
  // client-sent instituteId for that role (previously this let them create batches under
  // another institute's id entirely). Only super_admin may target an arbitrary institute.
  const instituteId = req.user!.role === "institute_admin" ? (req.user!.instituteId ?? -1) : parsed.data.instituteId;

  const [batch] = await db.insert(batchesTable).values({ ...parsed.data, instituteId }).returning();
  res.status(201).json({
    id: batch.id, name: batch.name, instituteId: batch.instituteId,
    description: batch.description ?? null, studentCount: 0,
    createdAt: batch.createdAt.toISOString(),
  });
});

router.get("/batches/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [batch] = await db.select().from(batchesTable).where(eq(batchesTable.id, id));
  if (!batch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  res.json({
    id: batch.id, name: batch.name, instituteId: batch.instituteId,
    description: batch.description ?? null, studentCount: 0,
    createdAt: batch.createdAt.toISOString(),
  });
});

router.patch("/batches/:id", requireAuth, requirePermission(PERMISSIONS.MANAGE_STUDENTS), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingBatch] = await db.select().from(batchesTable).where(eq(batchesTable.id, id));
  if (!existingBatch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }
  if (req.user!.role === "institute_admin" && existingBatch.instituteId !== req.user!.instituteId) {
    res.status(403).json({ error: "Cannot manage another institute's batch" });
    return;
  }

  const [batch] = await db.update(batchesTable).set(parsed.data).where(eq(batchesTable.id, id)).returning();
  if (!batch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  res.json({
    id: batch.id, name: batch.name, instituteId: batch.instituteId,
    description: batch.description ?? null, studentCount: 0,
    createdAt: batch.createdAt.toISOString(),
  });
});

router.delete("/batches/:id", requireAuth, requirePermission(PERMISSIONS.MANAGE_STUDENTS), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existingBatch] = await db.select().from(batchesTable).where(eq(batchesTable.id, id));
  if (!existingBatch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }
  if (req.user!.role === "institute_admin" && existingBatch.instituteId !== req.user!.instituteId) {
    res.status(403).json({ error: "Cannot manage another institute's batch" });
    return;
  }

  await db.delete(batchesTable).where(eq(batchesTable.id, id));
  res.sendStatus(204);
});

export default router;

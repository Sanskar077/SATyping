import { Router } from "express";
import { eq, ilike, and, SQL, sql } from "drizzle-orm";
import { db, institutesTable, usersTable, batchesTable, testAttemptsTable, resultsTable } from "@workspace/db";
import {
  ListInstitutesQueryParams, CreateInstituteBody, GetInstituteParams, UpdateInstituteParams,
  UpdateInstituteBody, DeleteInstituteParams, GetInstituteStudentsParams, GetInstituteStatsParams,
  ListBatchesQueryParams, CreateBatchBody, GetBatchParams, UpdateBatchParams, UpdateBatchBody, DeleteBatchParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";

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
    studentCount,
    createdAt: inst.createdAt.toISOString(),
  };
}

// ─── INSTITUTES ─────────────────────────────────────────────────────────────

router.get("/institutes", requireAuth, async (req, res): Promise<void> => {
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

router.patch("/institutes/:id", requireAuth, requireRole("institute_admin", "super_admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

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
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const [inst] = await db.update(institutesTable).set(updateData).where(eq(institutesTable.id, id)).returning();
  if (!inst) {
    res.status(404).json({ error: "Institute not found" });
    return;
  }

  const students = await db.select().from(usersTable).where(eq(usersTable.instituteId, id));
  res.json(formatInstitute(inst, students.length));
});

router.delete("/institutes/:id", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  await db.delete(institutesTable).where(eq(institutesTable.id, id));
  res.sendStatus(204);
});

router.get("/institutes/:id/students", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

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

router.get("/institutes/:id/stats", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

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

router.post("/batches", requireAuth, requireRole("institute_admin", "super_admin"), async (req, res): Promise<void> => {
  const parsed = CreateBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [batch] = await db.insert(batchesTable).values(parsed.data).returning();
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

router.patch("/batches/:id", requireAuth, requireRole("institute_admin", "super_admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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

router.delete("/batches/:id", requireAuth, requireRole("institute_admin", "super_admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(batchesTable).where(eq(batchesTable.id, id));
  res.sendStatus(204);
});

export default router;

import { Router } from "express";
import { eq, and, ilike, SQL, sql, count } from "drizzle-orm";
import { db, passagesTable } from "@workspace/db";
import {
  ListPassagesQueryParams, CreatePassageBody, GetPassageParams,
  UpdatePassageParams, UpdatePassageBody, DeletePassageParams, GetRandomPassageQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireActiveAccess } from "../lib/roles";
import { requirePermission, PERMISSIONS } from "../lib/permissions";
import { getOwnAccountAccess } from "../lib/account-status";
import { z } from "zod";

const router = Router();

const bulkPassageRowSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  language: z.enum(["english", "hindi", "marathi"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  speedCategory: z.union([z.literal(30), z.literal(40), z.literal(50), z.literal(60)]),
});

const bulkValidateBodySchema = z.object({ passages: z.array(z.unknown()) });
const bulkImportBodySchema = z.object({ passages: z.array(z.unknown()).min(1), skipDuplicates: z.boolean().optional() });

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatPassage(p: typeof passagesTable.$inferSelect) {
  return {
    id: p.id, title: p.title, content: p.content, language: p.language,
    difficulty: p.difficulty, speedCategory: p.speedCategory, wordCount: p.wordCount,
    isActive: p.isActive, createdBy: p.createdBy ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/passages", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
  const params = ListPassagesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { language, difficulty, speedCategory, search, page = 1, limit = 20 } = params.data;
  const conditions: SQL[] = [eq(passagesTable.isActive, true)];

  if (language) conditions.push(eq(passagesTable.language, language));
  if (difficulty) conditions.push(eq(passagesTable.difficulty, difficulty));
  if (speedCategory) conditions.push(eq(passagesTable.speedCategory, speedCategory));
  if (search) conditions.push(ilike(passagesTable.title, `%${search}%`));

  const offset = (page - 1) * limit;
  const where = and(...conditions);

  const passages = await db.select().from(passagesTable).where(where).limit(limit).offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(passagesTable).where(where);

  res.json({ passages: passages.map(formatPassage), total, page, limit });
});

router.get("/passages/random", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
  const params = GetRandomPassageQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { language, speedCategory, difficulty } = params.data;
  const conditions: SQL[] = [
    eq(passagesTable.isActive, true),
    eq(passagesTable.language, language),
    eq(passagesTable.speedCategory, speedCategory),
  ];
  if (difficulty) conditions.push(eq(passagesTable.difficulty, difficulty));

  const passages = await db.select().from(passagesTable).where(and(...conditions));
  if (passages.length === 0) {
    res.status(404).json({ error: "No passage found matching criteria" });
    return;
  }

  const random = passages[Math.floor(Math.random() * passages.length)];
  res.json(formatPassage(random));
});

router.post("/passages", requireAuth, requireActiveAccess(getOwnAccountAccess), requirePermission(PERMISSIONS.MANAGE_PASSAGES), async (req, res): Promise<void> => {
  const parsed = CreatePassageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const wordCount = countWords(parsed.data.content);
  const [passage] = await db.insert(passagesTable).values({
    ...parsed.data,
    wordCount,
    createdBy: req.user!.userId,
  }).returning();

  res.status(201).json(formatPassage(passage));
});

router.get("/passages/:id", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [passage] = await db.select().from(passagesTable).where(eq(passagesTable.id, id));
  if (!passage) {
    res.status(404).json({ error: "Passage not found" });
    return;
  }

  res.json(formatPassage(passage));
});

router.patch("/passages/:id", requireAuth, requireActiveAccess(getOwnAccountAccess), requirePermission(PERMISSIONS.MANAGE_PASSAGES), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdatePassageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.content) {
    updateData.wordCount = countWords(parsed.data.content);
  }

  const [passage] = await db.update(passagesTable).set(updateData).where(eq(passagesTable.id, id)).returning();
  if (!passage) {
    res.status(404).json({ error: "Passage not found" });
    return;
  }

  res.json(formatPassage(passage));
});

router.delete("/passages/:id", requireAuth, requireActiveAccess(getOwnAccountAccess), requirePermission(PERMISSIONS.DELETE_PASSAGES), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(passagesTable).where(eq(passagesTable.id, id));
  res.sendStatus(204);
});

// Feature 9: Admin Passage Bulk Import Matrix
router.post("/passages/bulk-validate", requireAuth, requireActiveAccess(getOwnAccountAccess), requirePermission(PERMISSIONS.MANAGE_PASSAGES), async (req, res): Promise<void> => {
  const parsedBody = bulkValidateBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "passages must be an array" });
    return;
  }
  const { passages } = parsedBody.data;

  const errors: Array<{row: number; field: string; message: string}> = [];
  const duplicates: Array<{row: number; title: string; existingId: number}> = [];
  const valid: Array<z.infer<typeof bulkPassageRowSchema>> = [];

  for (let i = 0; i < passages.length; i++) {
    const rowResult = bulkPassageRowSchema.safeParse(passages[i]);
    if (!rowResult.success) {
      for (const issue of rowResult.error.issues) {
        errors.push({ row: i + 1, field: String(issue.path[0] ?? "unknown"), message: issue.message });
      }
      continue;
    }

    const p = rowResult.data;
    const [existing] = await db.select().from(passagesTable).where(ilike(passagesTable.title, p.title.trim()));
    if (existing) {
      duplicates.push({ row: i + 1, title: p.title, existingId: existing.id });
    } else {
      valid.push(p);
    }
  }

  res.json({
    valid,
    errors,
    duplicates,
    validCount: valid.length,
    errorCount: errors.length,
    duplicateCount: duplicates.length,
  });
});

router.post("/passages/bulk-import", requireAuth, requireActiveAccess(getOwnAccountAccess), requirePermission(PERMISSIONS.MANAGE_PASSAGES), async (req, res): Promise<void> => {
  const parsedBody = bulkImportBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: "passages must be a non-empty array" });
    return;
  }
  const { passages, skipDuplicates = true } = parsedBody.data;

  const imported: typeof passagesTable.$inferSelect[] = [];
  const errors: Array<{row: number; field: string; message: string}> = [];
  let skipped = 0;

  for (let i = 0; i < passages.length; i++) {
    const rowResult = bulkPassageRowSchema.safeParse(passages[i]);
    if (!rowResult.success) {
      for (const issue of rowResult.error.issues) {
        errors.push({ row: i + 1, field: String(issue.path[0] ?? "unknown"), message: issue.message });
      }
      continue;
    }
    const p = rowResult.data;

    try {
      if (skipDuplicates) {
        const [existing] = await db.select().from(passagesTable).where(ilike(passagesTable.title, p.title.trim()));
        if (existing) { skipped++; continue; }
      }

      const wordCount = countWords(p.content);
      const [passage] = await db.insert(passagesTable).values({
        title: p.title.trim(),
        content: p.content.trim(),
        language: p.language,
        difficulty: p.difficulty,
        speedCategory: p.speedCategory,
        wordCount,
        createdBy: req.user!.userId,
      }).returning();

      imported.push(passage);
    } catch (err) {
      errors.push({ row: i + 1, field: "db", message: `Import failed: ${(err as Error).message}` });
    }
  }

  res.status(201).json({
    imported: imported.length,
    skipped,
    errors,
    passages: imported.map(formatPassage),
  });
});

export default router;

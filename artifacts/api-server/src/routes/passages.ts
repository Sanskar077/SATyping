import { Router } from "express";
import { eq, and, ilike, SQL, sql } from "drizzle-orm";
import { db, passagesTable } from "@workspace/db";
import {
  ListPassagesQueryParams, CreatePassageBody, GetPassageParams,
  UpdatePassageParams, UpdatePassageBody, DeletePassageParams, GetRandomPassageQueryParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

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

router.get("/passages", requireAuth, async (req, res): Promise<void> => {
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
  const all = await db.select().from(passagesTable).where(where);

  res.json({ passages: passages.map(formatPassage), total: all.length, page, limit });
});

router.get("/passages/random", requireAuth, async (req, res): Promise<void> => {
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

router.post("/passages", requireAuth, requireRole("teacher", "institute_admin", "super_admin"), async (req, res): Promise<void> => {
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

router.get("/passages/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [passage] = await db.select().from(passagesTable).where(eq(passagesTable.id, id));
  if (!passage) {
    res.status(404).json({ error: "Passage not found" });
    return;
  }

  res.json(formatPassage(passage));
});

router.patch("/passages/:id", requireAuth, requireRole("teacher", "institute_admin", "super_admin"), async (req, res): Promise<void> => {
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

router.delete("/passages/:id", requireAuth, requireRole("teacher", "institute_admin", "super_admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(passagesTable).where(eq(passagesTable.id, id));
  res.sendStatus(204);
});

export default router;

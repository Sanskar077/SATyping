import { Router } from "express";
import { eq, and, desc, SQL } from "drizzle-orm";
import { db, testsTable, testAttemptsTable, passagesTable, resultsTable, usersTable } from "@workspace/db";
import {
  ListTestsQueryParams, CreateTestBody, GetTestParams, UpdateTestParams,
  UpdateTestBody, DeleteTestParams, ListTestAttemptsQueryParams, CreateTestAttemptBody,
  GetTestAttemptParams, SubmitTestAttemptBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../lib/auth";
import { randomUUID } from "crypto";

const router = Router();

function formatPassage(p: typeof passagesTable.$inferSelect) {
  return {
    id: p.id, title: p.title, content: p.content, language: p.language,
    difficulty: p.difficulty, speedCategory: p.speedCategory, wordCount: p.wordCount,
    isActive: p.isActive, createdBy: p.createdBy ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

function formatTest(t: typeof testsTable.$inferSelect) {
  return {
    id: t.id, name: t.name, description: t.description ?? null,
    language: t.language, speedCategory: t.speedCategory, durationMinutes: t.durationMinutes,
    isActive: t.isActive, instituteId: t.instituteId ?? null, passageId: t.passageId ?? null,
    useRandomPassage: t.useRandomPassage, minAccuracy: t.minAccuracy,
    createdAt: t.createdAt.toISOString(),
  };
}

function formatAttempt(
  a: typeof testAttemptsTable.$inferSelect,
  test?: typeof testsTable.$inferSelect,
  passage?: typeof passagesTable.$inferSelect,
) {
  return {
    id: a.id, userId: a.userId, testId: a.testId, passageId: a.passageId,
    status: a.status, grossWpm: a.grossWpm ?? null, netWpm: a.netWpm ?? null,
    accuracy: a.accuracy ?? null, totalChars: a.totalChars ?? null,
    correctChars: a.correctChars ?? null, incorrectChars: a.incorrectChars ?? null,
    wrongWords: a.wrongWords ?? null, backspaceCount: a.backspaceCount ?? null,
    durationSeconds: a.durationSeconds ?? null, passed: a.passed ?? null,
    resultId: a.resultId ?? null,
    startedAt: a.startedAt.toISOString(),
    completedAt: a.completedAt ? a.completedAt.toISOString() : null,
    test: test ? formatTest(test) : undefined,
    passage: passage ? formatPassage(passage) : undefined,
  };
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

router.get("/tests", requireAuth, async (req, res): Promise<void> => {
  const params = ListTestsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { language, speedCategory, instituteId, page = 1, limit = 20 } = params.data;
  const conditions: SQL[] = [eq(testsTable.isActive, true)];
  if (language) conditions.push(eq(testsTable.language, language));
  if (speedCategory) conditions.push(eq(testsTable.speedCategory, speedCategory));
  if (instituteId) conditions.push(eq(testsTable.instituteId, instituteId));

  const offset = (page - 1) * limit;
  const where = and(...conditions);

  const tests = await db.select().from(testsTable).where(where).limit(limit).offset(offset);
  const all = await db.select().from(testsTable).where(where);

  res.json({ tests: tests.map(formatTest), total: all.length, page, limit });
});

router.post("/tests", requireAuth, requireRole("teacher", "institute_admin", "super_admin"), async (req, res): Promise<void> => {
  const parsed = CreateTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [test] = await db.insert(testsTable).values(parsed.data).returning();
  res.status(201).json(formatTest(test));
});

router.get("/tests/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [test] = await db.select().from(testsTable).where(eq(testsTable.id, id));
  if (!test) {
    res.status(404).json({ error: "Test not found" });
    return;
  }

  res.json(formatTest(test));
});

router.patch("/tests/:id", requireAuth, requireRole("teacher", "institute_admin", "super_admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateTestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [test] = await db.update(testsTable).set(parsed.data).where(eq(testsTable.id, id)).returning();
  if (!test) {
    res.status(404).json({ error: "Test not found" });
    return;
  }

  res.json(formatTest(test));
});

router.delete("/tests/:id", requireAuth, requireRole("teacher", "institute_admin", "super_admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(testsTable).where(eq(testsTable.id, id));
  res.sendStatus(204);
});

// ─── TEST ATTEMPTS ────────────────────────────────────────────────────────────

router.get("/test-attempts", requireAuth, async (req, res): Promise<void> => {
  const params = ListTestAttemptsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { userId, testId, language, page = 1, limit = 20 } = params.data;
  const targetUserId = userId ?? req.user!.userId;
  const conditions: SQL[] = [eq(testAttemptsTable.userId, targetUserId)];
  if (testId) conditions.push(eq(testAttemptsTable.testId, testId));

  const offset = (page - 1) * limit;
  const where = and(...conditions);

  const attempts = await db.select().from(testAttemptsTable).where(where)
    .orderBy(desc(testAttemptsTable.startedAt)).limit(limit).offset(offset);
  const all = await db.select().from(testAttemptsTable).where(where);

  const withDetails = await Promise.all(attempts.map(async (a) => {
    const [test] = await db.select().from(testsTable).where(eq(testsTable.id, a.testId));
    const [passage] = await db.select().from(passagesTable).where(eq(passagesTable.id, a.passageId));
    return formatAttempt(a, test, passage);
  }));

  res.json({ attempts: withDetails, total: all.length, page, limit });
});

router.post("/test-attempts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTestAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [test] = await db.select().from(testsTable).where(eq(testsTable.id, parsed.data.testId));
  if (!test) {
    res.status(404).json({ error: "Test not found" });
    return;
  }

  let passageId = test.passageId;
  let passage: typeof passagesTable.$inferSelect | undefined;

  if (test.useRandomPassage || !passageId) {
    const passages = await db.select().from(passagesTable).where(
      and(eq(passagesTable.language, test.language), eq(passagesTable.speedCategory, test.speedCategory), eq(passagesTable.isActive, true))
    );
    if (passages.length === 0) {
      res.status(400).json({ error: "No passages available for this test" });
      return;
    }
    passage = passages[Math.floor(Math.random() * passages.length)];
    passageId = passage.id;
  } else {
    const [p] = await db.select().from(passagesTable).where(eq(passagesTable.id, passageId!));
    passage = p;
  }

  const [attempt] = await db.insert(testAttemptsTable).values({
    userId: req.user!.userId,
    testId: parsed.data.testId,
    passageId: passageId!,
    status: "active",
  }).returning();

  res.status(201).json(formatAttempt(attempt, test, passage));
});

router.get("/test-attempts/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [attempt] = await db.select().from(testAttemptsTable).where(eq(testAttemptsTable.id, id));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }

  const [test] = await db.select().from(testsTable).where(eq(testsTable.id, attempt.testId));
  const [passage] = await db.select().from(passagesTable).where(eq(passagesTable.id, attempt.passageId));
  res.json(formatAttempt(attempt, test, passage));
});

router.patch("/test-attempts/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = SubmitTestAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existingAttempt] = await db.select().from(testAttemptsTable).where(eq(testAttemptsTable.id, id));
  if (!existingAttempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }

  const [test] = await db.select().from(testsTable).where(eq(testsTable.id, existingAttempt.testId));

  const passed = parsed.data.status === "completed"
    ? (parsed.data.netWpm >= test.speedCategory && parsed.data.accuracy >= test.minAccuracy)
    : false;

  let resultId: number | null = null;
  if (parsed.data.status === "completed") {
    const [result] = await db.insert(resultsTable).values({
      userId: req.user!.userId,
      testAttemptId: id,
      grossWpm: parsed.data.grossWpm,
      netWpm: parsed.data.netWpm,
      accuracy: parsed.data.accuracy,
      totalChars: parsed.data.totalChars,
      correctChars: parsed.data.correctChars,
      incorrectChars: parsed.data.incorrectChars,
      wrongWords: parsed.data.wrongWords ?? 0,
      backspaceCount: parsed.data.backspaceCount ?? 0,
      durationSeconds: parsed.data.durationSeconds ?? 0,
      language: test.language,
      speedCategory: test.speedCategory,
      passed,
    }).returning();
    resultId = result.id;
  }

  const [attempt] = await db.update(testAttemptsTable).set({
    ...parsed.data,
    passed,
    resultId,
    completedAt: new Date(),
  }).where(eq(testAttemptsTable.id, id)).returning();

  if (resultId) {
    await db.update(testAttemptsTable).set({ resultId }).where(eq(testAttemptsTable.id, id));
  }

  const [passage] = await db.select().from(passagesTable).where(eq(passagesTable.id, attempt.passageId));
  res.json(formatAttempt(attempt, test, passage));
});

export default router;

import { Router } from "express";
import { eq, and, desc, SQL } from "drizzle-orm";
import { db, resultsTable, usersTable, testAttemptsTable, testsTable, typingSessionsTable, certificatesTable } from "@workspace/db";
import { ListResultsQueryParams, GetResultParams, GetLeaderboardQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();

async function formatResult(r: typeof resultsTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId));
  const [attempt] = await db.select().from(testAttemptsTable).where(eq(testAttemptsTable.id, r.testAttemptId));
  const [test] = attempt ? await db.select().from(testsTable).where(eq(testsTable.id, attempt.testId)) : [null];

  return {
    id: r.id, userId: r.userId, testAttemptId: r.testAttemptId,
    grossWpm: r.grossWpm, netWpm: r.netWpm, accuracy: r.accuracy,
    totalChars: r.totalChars, correctChars: r.correctChars, incorrectChars: r.incorrectChars,
    wrongWords: r.wrongWords, backspaceCount: r.backspaceCount, durationSeconds: r.durationSeconds,
    language: r.language, speedCategory: r.speedCategory, passed: r.passed,
    certificateId: r.certificateId ?? null,
    userName: user?.name ?? "Unknown",
    testName: test?.name ?? "Unknown Test",
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/results/dashboard", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const sessions = await db.select().from(typingSessionsTable)
    .where(and(eq(typingSessionsTable.userId, userId), eq(typingSessionsTable.status, "completed")));

  const attempts = await db.select().from(testAttemptsTable)
    .where(eq(testAttemptsTable.userId, userId));

  const results = await db.select().from(resultsTable)
    .where(eq(resultsTable.userId, userId))
    .orderBy(desc(resultsTable.createdAt));

  const certs = await db.select().from(certificatesTable).where(eq(certificatesTable.userId, userId));

  const bestNetWpm = results.length > 0 ? Math.max(...results.map(r => r.netWpm)) : 0;
  const avgAccuracy = results.length > 0 ? results.reduce((s, r) => s + r.accuracy, 0) / results.length : 0;
  const passRate = results.length > 0 ? (results.filter(r => r.passed).length / results.length) * 100 : 0;

  const languages = ["english", "hindi", "marathi"];
  const byLanguage = languages.map(lang => {
    const langResults = results.filter(r => r.language === lang);
    return {
      language: lang,
      avgWpm: langResults.length > 0 ? langResults.reduce((s, r) => s + r.netWpm, 0) / langResults.length : 0,
      avgAccuracy: langResults.length > 0 ? langResults.reduce((s, r) => s + r.accuracy, 0) / langResults.length : 0,
      sessionCount: langResults.length,
    };
  });

  const wpmProgress = results.slice(0, 30).reverse().map(r => ({
    date: r.createdAt.toISOString().split("T")[0],
    wpm: r.netWpm,
    accuracy: r.accuracy,
  }));

  const recentFormatted = await Promise.all(results.slice(0, 5).map(formatResult));

  res.json({
    totalPracticeSessions: sessions.length,
    totalTestAttempts: attempts.length,
    bestNetWpm,
    avgAccuracy: Math.round(avgAccuracy * 100) / 100,
    certificatesEarned: certs.length,
    streakDays: 0,
    recentResults: recentFormatted,
    wpmProgress,
    passRate: Math.round(passRate * 100) / 100,
    byLanguage,
  });
});

router.get("/results/leaderboard", requireAuth, async (req, res): Promise<void> => {
  const params = GetLeaderboardQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { language, speedCategory, limit = 10 } = params.data;
  const conditions: SQL[] = [eq(resultsTable.passed, true)];
  if (language) conditions.push(eq(resultsTable.language, language));
  if (speedCategory) conditions.push(eq(resultsTable.speedCategory, speedCategory));

  const results = await db.select().from(resultsTable)
    .where(and(...conditions))
    .orderBy(desc(resultsTable.netWpm))
    .limit(limit);

  const entries = await Promise.all(results.map(async (r, idx) => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId));
    return {
      rank: idx + 1,
      userId: r.userId,
      userName: user?.name ?? "Unknown",
      netWpm: r.netWpm,
      accuracy: r.accuracy,
      language: r.language,
      instituteName: null,
    };
  }));

  res.json(entries);
});

router.get("/results", requireAuth, async (req, res): Promise<void> => {
  const params = ListResultsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { userId, testAttemptId, language, passed, page = 1, limit = 20 } = params.data;
  const targetUserId = userId ?? req.user!.userId;
  const conditions: SQL[] = [eq(resultsTable.userId, targetUserId)];
  if (testAttemptId) conditions.push(eq(resultsTable.testAttemptId, testAttemptId));
  if (language) conditions.push(eq(resultsTable.language, language));
  if (passed !== undefined) conditions.push(eq(resultsTable.passed, passed));

  const offset = (page - 1) * limit;
  const where = and(...conditions);

  const results = await db.select().from(resultsTable)
    .where(where).orderBy(desc(resultsTable.createdAt)).limit(limit).offset(offset);
  const all = await db.select().from(resultsTable).where(where);

  const formatted = await Promise.all(results.map(formatResult));
  res.json({ results: formatted, total: all.length, page, limit });
});

router.get("/results/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [result] = await db.select().from(resultsTable).where(eq(resultsTable.id, id));
  if (!result) {
    res.status(404).json({ error: "Result not found" });
    return;
  }

  res.json(await formatResult(result));
});

export default router;

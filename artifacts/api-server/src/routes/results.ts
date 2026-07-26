import { Router } from "express";
import { eq, and, desc, SQL, count } from "drizzle-orm";
import { db, resultsTable, usersTable, testAttemptsTable, testsTable, typingSessionsTable } from "@workspace/db";
import { ListResultsQueryParams, GetResultParams, GetLeaderboardQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireActiveAccess } from "../lib/roles";
import { getOwnAccountAccess } from "../lib/account-status";
import { canReadUserData } from "../lib/ownership";
import { normalizeBoolQueryParams } from "../lib/query-params";

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
    userName: user?.name ?? "Unknown",
    testName: test?.name ?? "Unknown Test",
    createdAt: r.createdAt.toISOString(),
  };
}

// Feature 6: Personal Best Tracker Dashboard Widget
router.get("/results/personal-bests", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const sessions = await db.select().from(typingSessionsTable)
    .where(and(eq(typingSessionsTable.userId, userId), eq(typingSessionsTable.status, "completed")));

  const results = await db.select().from(resultsTable)
    .where(eq(resultsTable.userId, userId))
    .orderBy(desc(resultsTable.createdAt));

  const highestWpm = results.length > 0 ? Math.max(...results.map(r => r.netWpm)) : 0;
  const highestAccuracy = results.length > 0 ? Math.max(...results.map(r => r.accuracy)) : 0;
  const bestGrossWpm = results.length > 0 ? Math.max(...results.map(r => r.grossWpm)) : 0;
  const bestNetWpm = highestWpm;
  const totalPracticeMinutes = Math.round(sessions.reduce((s, sess) => s + (sess.durationSeconds ?? 0), 0) / 60);
  const totalCompletedTests = results.length;

  // Weekly best (last 7 days)
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyResults = results.filter(r => r.createdAt >= weekAgo);
  const weeklyBest = weeklyResults.length > 0 ? Math.max(...weeklyResults.map(r => r.netWpm)) : null;

  // Monthly best (last 30 days)
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
  const monthlyResults = results.filter(r => r.createdAt >= monthAgo);
  const monthlyBest = monthlyResults.length > 0 ? Math.max(...monthlyResults.map(r => r.netWpm)) : null;

  // Fastest improvement: biggest single-session WPM jump
  let fastestImprovement = 0;
  for (let i = 1; i < results.length; i++) {
    const improvement = results[i - 1].netWpm - results[i].netWpm; // ordered desc
    if (improvement > fastestImprovement) fastestImprovement = improvement;
  }

  // Longest streak: consecutive days with at least one completed session
  let longestStreak = 0;
  if (sessions.length > 0) {
    const days = new Set(sessions.map(s => s.createdAt.toISOString().split("T")[0]));
    const sorted = Array.from(days).sort();
    let streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]);
      const curr = new Date(sorted[i]);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) { streak++; longestStreak = Math.max(longestStreak, streak); }
      else streak = 1;
    }
    longestStreak = Math.max(longestStreak, streak);
  }

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

  res.json({
    highestWpm,
    highestAccuracy,
    bestGrossWpm,
    bestNetWpm,
    longestStreak,
    totalPracticeMinutes,
    totalCompletedTests,
    fastestImprovement,
    weeklyBest,
    monthlyBest,
    byLanguage,
  });
});

router.get("/results/dashboard", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const sessions = await db.select().from(typingSessionsTable)
    .where(and(eq(typingSessionsTable.userId, userId), eq(typingSessionsTable.status, "completed")));

  const attempts = await db.select().from(testAttemptsTable)
    .where(eq(testAttemptsTable.userId, userId));

  const results = await db.select().from(resultsTable)
    .where(eq(resultsTable.userId, userId))
    .orderBy(desc(resultsTable.createdAt));


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
    streakDays: 0,
    recentResults: recentFormatted,
    wpmProgress,
    passRate: Math.round(passRate * 100) / 100,
    byLanguage,
  });
});

router.get("/results/leaderboard", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
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

router.get("/results", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
  const params = ListResultsQueryParams.safeParse(normalizeBoolQueryParams(req.query, ["passed"]));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { userId, testAttemptId, language, passed, page = 1, limit = 20 } = params.data;
  const targetUserId = userId ?? req.user!.userId;
  // A caller may only read someone else's results if they own them, are the Owner, or run the
  // target's institute — otherwise any authenticated user could enumerate other students' results
  // by passing an arbitrary userId.
  if (!(await canReadUserData(req, targetUserId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const conditions: SQL[] = [eq(resultsTable.userId, targetUserId)];
  if (testAttemptId) conditions.push(eq(resultsTable.testAttemptId, testAttemptId));
  if (language) conditions.push(eq(resultsTable.language, language));
  if (passed !== undefined) conditions.push(eq(resultsTable.passed, passed));

  const offset = (page - 1) * limit;
  const where = and(...conditions);

  const results = await db.select().from(resultsTable)
    .where(where).orderBy(desc(resultsTable.createdAt)).limit(limit).offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(resultsTable).where(where);

  const formatted = await Promise.all(results.map(formatResult));
  res.json({ results: formatted, total, page, limit });
});

router.get("/results/:id", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [result] = await db.select().from(resultsTable).where(eq(resultsTable.id, id));
  if (!result) {
    res.status(404).json({ error: "Result not found" });
    return;
  }

  // Same ownership rule as the list endpoint — a raw result id must not expose another
  // student's score to anyone who guesses/enumerates it.
  if (!(await canReadUserData(req, result.userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json(await formatResult(result));
});

export default router;

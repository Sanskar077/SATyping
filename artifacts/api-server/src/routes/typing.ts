import { Router } from "express";
import { eq, and, desc, SQL, avg, max, sum, sql } from "drizzle-orm";
import { db, typingSessionsTable, passagesTable } from "@workspace/db";
import {
  ListTypingSessionsQueryParams, CreateTypingSessionBody,
  GetTypingSessionParams, UpdateTypingSessionParams, UpdateTypingSessionBody, GetTypingStatsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();

function formatPassage(p: typeof passagesTable.$inferSelect) {
  return {
    id: p.id, title: p.title, content: p.content, language: p.language,
    difficulty: p.difficulty, speedCategory: p.speedCategory, wordCount: p.wordCount,
    isActive: p.isActive, createdBy: p.createdBy ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

function formatSession(s: typeof typingSessionsTable.$inferSelect, passage?: typeof passagesTable.$inferSelect) {
  return {
    id: s.id, userId: s.userId, passageId: s.passageId, language: s.language,
    status: s.status, grossWpm: s.grossWpm ?? null, netWpm: s.netWpm ?? null,
    accuracy: s.accuracy ?? null, totalChars: s.totalChars ?? null,
    correctChars: s.correctChars ?? null, incorrectChars: s.incorrectChars ?? null,
    backspaceCount: s.backspaceCount ?? null, durationSeconds: s.durationSeconds ?? null,
    passage: passage ? formatPassage(passage) : undefined,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/typing-sessions/stats", requireAuth, async (req, res): Promise<void> => {
  const params = GetTypingStatsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = params.data.userId ?? req.user!.userId;
  const conditions: SQL[] = [eq(typingSessionsTable.userId, userId), eq(typingSessionsTable.status, "completed")];
  if (params.data.language) conditions.push(eq(typingSessionsTable.language, params.data.language));

  const sessions = await db.select().from(typingSessionsTable).where(and(...conditions));

  const totalSessions = sessions.length;
  const avgWpm = totalSessions > 0 ? sessions.reduce((s, sess) => s + (sess.netWpm ?? 0), 0) / totalSessions : 0;
  const avgAccuracy = totalSessions > 0 ? sessions.reduce((s, sess) => s + (sess.accuracy ?? 0), 0) / totalSessions : 0;
  const bestWpm = totalSessions > 0 ? Math.max(...sessions.map(s => s.netWpm ?? 0)) : 0;
  const totalMinutes = Math.round(sessions.reduce((s, sess) => s + (sess.durationSeconds ?? 0), 0) / 60);

  const languages = ["english", "hindi", "marathi"];
  const byLanguage = languages.map(lang => {
    const langSessions = sessions.filter(s => s.language === lang);
    return {
      language: lang,
      avgWpm: langSessions.length > 0 ? langSessions.reduce((s, sess) => s + (sess.netWpm ?? 0), 0) / langSessions.length : 0,
      avgAccuracy: langSessions.length > 0 ? langSessions.reduce((s, sess) => s + (sess.accuracy ?? 0), 0) / langSessions.length : 0,
      sessionCount: langSessions.length,
    };
  });

  const wpmTrend = sessions.slice(-30).map(s => ({
    date: s.createdAt.toISOString().split("T")[0],
    wpm: s.netWpm ?? 0,
    accuracy: s.accuracy ?? 0,
  }));

  res.json({ totalSessions, avgWpm, avgAccuracy, bestWpm, totalPracticeMinutes: totalMinutes, byLanguage, wpmTrend });
});

router.get("/typing-sessions", requireAuth, async (req, res): Promise<void> => {
  const params = ListTypingSessionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { userId, language, page = 1, limit = 20 } = params.data;
  const targetUserId = userId ?? req.user!.userId;
  const conditions: SQL[] = [eq(typingSessionsTable.userId, targetUserId)];
  if (language) conditions.push(eq(typingSessionsTable.language, language));

  const offset = (page - 1) * limit;
  const where = and(...conditions);

  const sessions = await db.select().from(typingSessionsTable).where(where)
    .orderBy(desc(typingSessionsTable.createdAt)).limit(limit).offset(offset);
  const all = await db.select().from(typingSessionsTable).where(where);

  const withPassages = await Promise.all(sessions.map(async (s) => {
    const [passage] = await db.select().from(passagesTable).where(eq(passagesTable.id, s.passageId));
    return formatSession(s, passage);
  }));

  res.json({ sessions: withPassages, total: all.length, page, limit });
});

router.post("/typing-sessions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTypingSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [passage] = await db.select().from(passagesTable).where(eq(passagesTable.id, parsed.data.passageId));
  if (!passage) {
    res.status(404).json({ error: "Passage not found" });
    return;
  }

  const [session] = await db.insert(typingSessionsTable).values({
    userId: req.user!.userId,
    passageId: parsed.data.passageId,
    language: parsed.data.language,
    status: "active",
  }).returning();

  res.status(201).json(formatSession(session, passage));
});

router.get("/typing-sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [session] = await db.select().from(typingSessionsTable).where(eq(typingSessionsTable.id, id));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const [passage] = await db.select().from(passagesTable).where(eq(passagesTable.id, session.passageId));
  res.json(formatSession(session, passage));
});

router.patch("/typing-sessions/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateTypingSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [session] = await db.update(typingSessionsTable).set(parsed.data)
    .where(eq(typingSessionsTable.id, id)).returning();
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const [passage] = await db.select().from(passagesTable).where(eq(passagesTable.id, session.passageId));
  res.json(formatSession(session, passage));
});

export default router;

import { Router } from "express";
import { eq, and, SQL, count } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { ListMyNotificationsQueryParams, MarkNotificationReadParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router = Router();

function formatNotification(n: typeof notificationsTable.$inferSelect) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/notifications/my", requireAuth, async (req, res): Promise<void> => {
  const params = ListMyNotificationsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { unreadOnly, page = 1, limit = 20 } = params.data;

  const conditions: SQL[] = [eq(notificationsTable.userId, req.user!.userId)];
  if (unreadOnly) conditions.push(eq(notificationsTable.isRead, false));
  const where = and(...conditions);

  const offset = (page - 1) * limit;
  const notifications = await db.select().from(notificationsTable).where(where).limit(limit).offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(notificationsTable).where(where);

  res.json({ notifications: notifications.map(formatNotification), total, page, limit });
});

router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const unread = await db.select().from(notificationsTable).where(
    and(eq(notificationsTable.userId, req.user!.userId), eq(notificationsTable.isRead, false)),
  );
  res.json({ count: unread.length });
});

router.post("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const parsedParams = MarkNotificationReadParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }

  const [existing] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, parsedParams.data.id));
  if (!existing || existing.userId !== req.user!.userId) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const [updated] = await db.update(notificationsTable).set({ isRead: true })
    .where(eq(notificationsTable.id, parsedParams.data.id)).returning();

  res.json(formatNotification(updated));
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, req.user!.userId));
  res.sendStatus(204);
});

export default router;

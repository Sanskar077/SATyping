import { db, notificationsTable } from "@workspace/db";

export type NotificationType =
  | "payment_success"
  | "commission_credited"
  | "commission_paid"
  | "institute_approved"
  | "institute_suspended";

/**
 * Creates an in-app notification for a user. Call this at real event triggers only (payment
 * success, commission status changes, institute approval, etc) — never invent notifications
 * speculatively. Fire-and-forget: never let a notification failure break the mutation it
 * describes.
 */
export async function notify(
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(notificationsTable).values({ userId, type, title, message, metadata: metadata ?? null });
  } catch {
    // Never let a notification failure break the underlying mutation.
  }
}

import { and, eq, lt, isNotNull } from "drizzle-orm";
import { db, subscriptionsTable, usersTable, institutesTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Periodic reconciliation between subscription expiry and account access.
 *
 * Access is gated on usersTable.accountStatus / institutesTable.accountStatus, which the payment
 * webhook flips to "active" on a successful payment. Nothing, however, flips them back when a
 * subscription's expiresAt passes — so without this sweep the stored accountStatus (which dashboards
 * and admin views read directly) would drift out of sync with reality. requireActiveAccess already
 * denies lapsed subscriptions in real time; this keeps the DB state consistent so everything else
 * doesn't have to re-derive it.
 *
 * Owner-granted Premium accounts are never touched — those grants deliberately have no expiry.
 * A renewal webhook re-activates accountStatus and writes a fresh future expiresAt, so a renewed
 * subscription is never in scope here.
 */
export async function sweepExpiredSubscriptions(): Promise<{ subscriptions: number; users: number; institutes: number }> {
  const now = new Date();

  // 1. Flip any active-but-lapsed subscription rows to "expired".
  const expired = await db.update(subscriptionsTable)
    .set({ status: "expired" })
    .where(and(
      eq(subscriptionsTable.status, "active"),
      isNotNull(subscriptionsTable.expiresAt),
      lt(subscriptionsTable.expiresAt, now),
    ))
    .returning({ userId: subscriptionsTable.userId });

  let usersDowngraded = 0;
  let institutesDowngraded = 0;

  // 2. For each lapsed subscription, downgrade the backing account(s) to "inactive" unless the
  //    account is Premium-granted. The subscription owner is either an independent user or an
  //    institute admin (whose subscription covers the whole institute).
  for (const { userId } of expired) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) continue;

    if (!user.premiumGrantedByOwner && user.accountStatus === "active") {
      await db.update(usersTable).set({ accountStatus: "inactive" }).where(eq(usersTable.id, user.id));
      usersDowngraded++;
    }

    if (user.instituteId) {
      const [institute] = await db.select().from(institutesTable).where(eq(institutesTable.id, user.instituteId));
      if (institute && !institute.premiumGrantedByOwner && institute.accountStatus === "active") {
        await db.update(institutesTable).set({ accountStatus: "inactive" }).where(eq(institutesTable.id, institute.id));
        institutesDowngraded++;
      }
    }
  }

  return { subscriptions: expired.length, users: usersDowngraded, institutes: institutesDowngraded };
}

/**
 * Runs the sweep once immediately, then on a fixed interval. Failures are logged and swallowed so a
 * transient DB error never crashes the process. Returns the timer so callers could clear it in tests.
 */
export function startSubscriptionSweep(intervalMs = 15 * 60 * 1000): NodeJS.Timeout {
  const run = () => {
    sweepExpiredSubscriptions()
      .then((result) => {
        if (result.subscriptions > 0) {
          logger.info(result, "Subscription sweep: downgraded lapsed accounts");
        }
      })
      .catch((err) => logger.error({ err }, "Subscription sweep failed"));
  };

  run();
  const timer = setInterval(run, intervalMs);
  // Don't keep the event loop alive solely for the sweep (matters for graceful shutdown / tests).
  timer.unref?.();
  return timer;
}

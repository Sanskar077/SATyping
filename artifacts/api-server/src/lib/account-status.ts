import type { Request } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, institutesTable, subscriptionsTable } from "@workspace/db";

/**
 * Single source of truth for "does this user currently have software access" — used to compute
 * the `hasAccess` field returned to the frontend (which drives ProtectedRoute's gating) and
 * mirrors the exact same rule requireActiveAccess enforces server-side on every protected route.
 * Owner always has access; everyone else needs their own accountStatus active OR (if they belong
 * to an institute) that institute's accountStatus active.
 *
 * Note: this operates on the stored accountStatus strings, which the subscription sweep keeps in
 * sync with subscription expiry. The authoritative real-time expiry check lives in
 * getOwnAccountAccess below (used by requireActiveAccess); this display-oriented value catches up
 * once the sweep next runs.
 */
export function computeHasAccess(role: string, ownAccountStatus: string, instituteAccountStatus: string | null): boolean {
  if (role === "super_admin") return true;
  return ownAccountStatus === "active" || instituteAccountStatus === "active";
}

/**
 * Pure rule: does this subscription row currently grant access? True only for an "active" row whose
 * expiresAt is either absent (legacy free tier / non-expiring) or still in the future. Exported so
 * both the request-time check and the sweep share ONE definition of "expired", and so it can be
 * unit-tested without a DB.
 */
export function subscriptionGrantsAccess(
  sub: { status: string; expiresAt: Date | null } | undefined | null,
  now: number = Date.now(),
): boolean {
  if (!sub || sub.status !== "active") return false;
  return !sub.expiresAt || sub.expiresAt.getTime() > now;
}

/**
 * Is there a paid subscription for this user that is currently active AND not past its expiry?
 * One row per user (subscriptions.userId is unique).
 */
async function hasValidSubscription(userId: number): Promise<boolean> {
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  return subscriptionGrantsAccess(sub);
}

/**
 * Collapses a stored accountStatus to its EFFECTIVE value at request time, folding in subscription
 * expiry. "active" only survives if the account is either Owner-granted Premium (never expires) or
 * backed by a non-expired active subscription; a lapsed paid account collapses to "inactive" even
 * though its stored accountStatus may still read "active" (until the sweep flips it). "suspended"
 * and "inactive" pass through unchanged.
 */
async function effectiveStatus(
  storedStatus: string,
  premiumGrantedByOwner: boolean,
  subscriptionOwnerId: number,
): Promise<string> {
  if (storedStatus !== "active") return storedStatus;
  if (premiumGrantedByOwner) return "active";
  return (await hasValidSubscription(subscriptionOwnerId)) ? "active" : "inactive";
}

/**
 * Fetches the CALLER's own access-relevant status for requireActiveAccess: their own
 * accountStatus, plus their institute's accountStatus if they belong to one. Reads fresh from the
 * DB rather than trusting the JWT, since accountStatus can change (a payment webhook, or an Owner
 * premium grant) between token issuance and this request — AND additionally re-derives each status
 * against live subscription expiry, so a lapsed subscription is denied immediately rather than
 * waiting for the periodic sweep to flip the stored accountStatus.
 */
export async function getOwnAccountAccess(req: Request): Promise<{ ownAccountStatus: string; instituteAccountStatus: string | null }> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    // No row = nothing to gate on; let requireAuth's own checks be the source of truth for
    // missing users. Treat as active so this never becomes an unexpected 403 for an edge case
    // it's not meant to police.
    return { ownAccountStatus: "active", instituteAccountStatus: null };
  }

  const ownAccountStatus = await effectiveStatus(user.accountStatus, user.premiumGrantedByOwner, user.id);

  if (!user.instituteId) {
    return { ownAccountStatus, instituteAccountStatus: null };
  }

  const [institute] = await db.select().from(institutesTable).where(eq(institutesTable.id, user.instituteId));
  if (!institute) {
    return { ownAccountStatus, instituteAccountStatus: null };
  }

  // An institute's paid subscription lives on its admin's user row (the webhook records the
  // subscription against the paying institute-admin). Re-derive the institute's effective status
  // against that subscription's expiry.
  const instituteAccountStatus = await effectiveInstituteStatus(institute);
  return { ownAccountStatus, instituteAccountStatus };
}

/** Effective (expiry-aware) accountStatus for an institute, using its admin's subscription. */
async function effectiveInstituteStatus(institute: typeof institutesTable.$inferSelect): Promise<string> {
  if (institute.accountStatus !== "active") return institute.accountStatus;
  if (institute.premiumGrantedByOwner) return "active";

  const [admin] = await db.select().from(usersTable)
    .where(and(eq(usersTable.instituteId, institute.id), eq(usersTable.role, "institute_admin")));
  if (!admin) return "inactive";
  return (await hasValidSubscription(admin.id)) ? "active" : "inactive";
}

/** Convenience wrapper: fetch a user's institute accountStatus (or null if independent). */
export async function getInstituteAccountStatus(instituteId: number | null): Promise<string | null> {
  if (!instituteId) return null;
  const [institute] = await db.select().from(institutesTable).where(eq(institutesTable.id, instituteId));
  return institute?.accountStatus ?? null;
}

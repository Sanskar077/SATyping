import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, institutesTable } from "@workspace/db";

/**
 * Single source of truth for "does this user currently have software access" — used to compute
 * the `hasAccess` field returned to the frontend (which drives ProtectedRoute's gating) and
 * mirrors the exact same rule requireActiveAccess enforces server-side on every protected route.
 * Owner always has access; everyone else needs their own accountStatus active OR (if they belong
 * to an institute) that institute's accountStatus active.
 */
export function computeHasAccess(role: string, ownAccountStatus: string, instituteAccountStatus: string | null): boolean {
  if (role === "super_admin") return true;
  return ownAccountStatus === "active" || instituteAccountStatus === "active";
}

/**
 * Fetches the CALLER's own access-relevant status for requireActiveAccess: their own
 * accountStatus, plus their institute's accountStatus if they belong to one. Reads fresh from the
 * DB rather than trusting the JWT, since accountStatus can change (a payment webhook, or an Owner
 * premium grant) between token issuance and this request.
 */
export async function getOwnAccountAccess(req: Request): Promise<{ ownAccountStatus: string; instituteAccountStatus: string | null }> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    // No row = nothing to gate on; let requireAuth's own checks be the source of truth for
    // missing users. Treat as active so this never becomes an unexpected 403 for an edge case
    // it's not meant to police.
    return { ownAccountStatus: "active", instituteAccountStatus: null };
  }

  if (!user.instituteId) {
    return { ownAccountStatus: user.accountStatus, instituteAccountStatus: null };
  }

  const [institute] = await db.select().from(institutesTable).where(eq(institutesTable.id, user.instituteId));
  return { ownAccountStatus: user.accountStatus, instituteAccountStatus: institute?.accountStatus ?? null };
}

/** Convenience wrapper: fetch a user's institute accountStatus (or null if independent). */
export async function getInstituteAccountStatus(instituteId: number | null): Promise<string | null> {
  if (!instituteId) return null;
  const [institute] = await db.select().from(institutesTable).where(eq(institutesTable.id, instituteId));
  return institute?.accountStatus ?? null;
}

import type { Request } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { ROLES } from "./roles";

/**
 * Can the caller read data belonging to `targetUserId`?
 *
 * Used by list/detail endpoints that accept a `userId` filter (results, typing sessions). Without
 * this, passing an arbitrary userId returns another student's records to any authenticated user.
 *
 * Rules:
 *  - Always yes for your own data.
 *  - Owner sees everything.
 *  - Institute admins and teachers see members of THEIR OWN institute only (they legitimately need
 *    this for reports — VIEW_REPORTS — but must never read another institute's roster).
 *  - Students never see anyone else's data.
 */
export async function canReadUserData(req: Request, targetUserId: number): Promise<boolean> {
  const caller = req.user!;
  if (caller.userId === targetUserId) return true;
  if (caller.role === ROLES.OWNER) return true;

  if (caller.role !== ROLES.INSTITUTE_ADMIN && caller.role !== ROLES.TEACHER) return false;

  // Re-read the caller's institute from the DB rather than trusting the JWT's convenience copy,
  // which can be stale if their membership changed after the token was issued.
  const [callerRow] = await db.select().from(usersTable).where(eq(usersTable.id, caller.userId));
  const callerInstituteId = callerRow?.instituteId ?? null;
  if (!callerInstituteId) return false;

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));
  return !!target && target.instituteId === callerInstituteId;
}

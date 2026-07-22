import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, institutesTable } from "@workspace/db";

/**
 * Short, human-shareable referral code: institute-name slug + random suffix.
 * Uses Node's built-in crypto (no new dependency) rather than a slug/nanoid library.
 */
export function generateReferralCode(instituteName: string): string {
  const slug = instituteName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8) || "INST";
  const suffix = randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars
  return `${slug}-${suffix}`;
}

/**
 * Assign a student to an institute (membership), reused by BOTH registration ("join an institute"
 * self-selection) and an institute admin's "Add Student" action — same code path, no forking.
 * Joining an institute always implies the referral relationship, so referredByInstituteId is set to
 * match. Never construct these fields by hand elsewhere.
 */
export function membershipFieldsForJoin(instituteId: number): { instituteId: number; referredByInstituteId: number } {
  return { instituteId, referredByInstituteId: instituteId };
}

/** A student leaving/being removed from an institute is demoted to independent — instituteId only. */
export function membershipFieldsForLeave(): { instituteId: null } {
  return { instituteId: null };
}

/**
 * Resolves the institute a student wants to JOIN, from either a directly selected id or a pasted
 * referral code. Returns null if neither resolves to a real, active institute — the caller (an
 * explicit "join" request) should treat that as an error, since the student's stated intent can't be
 * silently dropped the way an optional referral-only code can.
 */
export async function resolveInstituteToJoin(input: {
  instituteId?: number;
  referralCode?: string;
}): Promise<typeof institutesTable.$inferSelect | null> {
  if (input.instituteId !== undefined) {
    const [inst] = await db.select().from(institutesTable).where(eq(institutesTable.id, input.instituteId));
    return inst ?? null;
  }
  if (input.referralCode) {
    const [inst] = await db.select().from(institutesTable).where(eq(institutesTable.referralCode, input.referralCode));
    return inst ?? null;
  }
  return null;
}

/**
 * Resolves a referral code for COMMISSION-ONLY attribution on an independent student's signup.
 * Deliberately silent on invalid codes — never errors, never leaks whether a code was valid, since
 * this is an optional field on the independent-signup path.
 */
export async function resolveReferralCodeSilently(referralCode: string | undefined): Promise<number | null> {
  if (!referralCode) return null;
  const [inst] = await db.select().from(institutesTable).where(eq(institutesTable.referralCode, referralCode));
  return inst?.id ?? null;
}

import type { Request, Response, NextFunction } from "express";

/**
 * Single source of truth for role constants and role/account guards.
 * Never duplicate these string literals elsewhere — import from here.
 */
export const ROLES = {
  OWNER: "super_admin",
  INSTITUTE_ADMIN: "institute_admin",
  TEACHER: "teacher",
  STUDENT: "student",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

function guard(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role as Role)) {
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
      return;
    }
    next();
  };
}

/** Exactly one Owner account ever exists; nothing can self-register or be promoted into this role. */
export const requireOwner = guard(ROLES.OWNER);

/** Owner or the admin of an institute. Route handlers must still scope queries to req.user.instituteId
 * for institute admins (this guard only checks role, not which institute). */
export const requireInstituteAdmin = guard(ROLES.OWNER, ROLES.INSTITUTE_ADMIN);

/** Any staff-level role: owner, institute admin, or teacher. */
export const requireStaff = guard(ROLES.OWNER, ROLES.INSTITUTE_ADMIN, ROLES.TEACHER);

/** Students only. */
export const requireStudent = guard(ROLES.STUDENT);

/**
 * Defense-in-depth middleware: blocks any request body that tries to set/change a role to Owner.
 * The zod schemas (RegisterInput, UpdateUserBody) already omit/restrict this at the type level —
 * this guard catches it even if a body schema is loosened later or a route bypasses zod.
 */
export function blockOwnerRoleAssignment(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as { role?: unknown } | undefined;
  if (body && typeof body === "object" && "role" in body && body.role === ROLES.OWNER) {
    res.status(403).json({ error: "Cannot assign the owner role" });
    return;
  }
  next();
}

/**
 * Blocks every real software feature unless the account has access — either a successful payment
 * or an Owner manual "Premium" grant. There is no trial: `accountStatus` starts "inactive" and
 * stays that way until one of those two things happens.
 *
 * Owner (super_admin) always passes — the owner account is exempt by definition. Everyone else
 * needs EITHER their own accountStatus === "active" OR, if they belong to an institute, that
 * institute's accountStatus === "active" (an institute's paid/granted plan covers its whole
 * roster — students and teachers don't need their own separate subscription on top of it).
 */
export function requireActiveAccess(
  getAccess: (req: Request) => Promise<{ ownAccountStatus: string; instituteAccountStatus: string | null }>,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (req.user.role === ROLES.OWNER) {
      next();
      return;
    }

    const access = await getAccess(req);

    if (access.ownAccountStatus === "suspended") {
      res.status(403).json({ error: "Account suspended", code: "ACCOUNT_SUSPENDED" });
      return;
    }

    const hasAccess = access.ownAccountStatus === "active" || access.instituteAccountStatus === "active";
    if (!hasAccess) {
      res.status(403).json({ error: "An active subscription is required to use this feature", code: "SUBSCRIPTION_REQUIRED" });
      return;
    }
    next();
  };
}

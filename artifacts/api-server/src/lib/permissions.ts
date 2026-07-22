import type { Request, Response, NextFunction } from "express";
import { ROLES, type Role } from "./roles";

/**
 * Centralized RBAC: Permissions → Roles → Users.
 *
 * Route handlers should ask `requirePermission("manage_passages")`, never hardcode a role list
 * inline. This is the single source of truth for "which roles can do what" — to change who's
 * allowed to do something, edit ROLE_PERMISSIONS here, not the route file.
 *
 * Super Admin implicitly holds every permission (see hasPermission below) — it is never listed
 * explicitly in ROLE_PERMISSIONS, so a newly-added permission is automatically available to the
 * owner without this file needing an edit for that role.
 */
export const PERMISSIONS = {
  MANAGE_USERS: "manage_users",
  MANAGE_STUDENTS: "manage_students",
  MANAGE_TEACHERS: "manage_teachers",
  MANAGE_PASSAGES: "manage_passages",
  DELETE_PASSAGES: "delete_passages",
  MANAGE_TESTS: "manage_tests",
  VIEW_REPORTS: "view_reports",
  MANAGE_PAYMENTS: "manage_payments",
  MANAGE_SUBSCRIPTION: "manage_subscription",
  MANAGE_INSTITUTE: "manage_institute",
  MANAGE_ADMINS: "manage_admins",
  GRANT_PREMIUM: "grant_premium",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Which permissions each NON-owner role holds. Institute admins manage their own institute's
 * roster/content only — this table grants the ACTION, route handlers still separately enforce
 * WHICH institute/resource (e.g. requireInstituteAdmin + an id-match check), exactly as they do
 * today. This file only answers "can this role attempt this kind of action at all."
 */
const ROLE_PERMISSIONS: Record<Exclude<Role, "super_admin">, Permission[]> = {
  institute_admin: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_STUDENTS,
    PERMISSIONS.MANAGE_TEACHERS,
    PERMISSIONS.MANAGE_PASSAGES,
    PERMISSIONS.DELETE_PASSAGES,
    PERMISSIONS.MANAGE_TESTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_INSTITUTE,
  ],
  teacher: [
    PERMISSIONS.MANAGE_PASSAGES,
    PERMISSIONS.DELETE_PASSAGES,
    PERMISSIONS.MANAGE_TESTS,
    PERMISSIONS.VIEW_REPORTS,
  ],
  student: [],
};

/** Owner holds every permission that exists, always — never enumerated by hand above. */
export function hasPermission(role: string, permission: Permission): boolean {
  if (role === ROLES.OWNER) return true;
  return (ROLE_PERMISSIONS[role as Exclude<Role, "super_admin">] ?? []).includes(permission);
}

/**
 * Route middleware: `requirePermission("manage_passages")`. Controllers/route files should use
 * this instead of an inline requireRole(...) list wherever the action maps to a named permission
 * below — it keeps "who can do what" centralized here rather than scattered across route files.
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({ error: "Forbidden: missing permission", permission });
      return;
    }
    next();
  };
}

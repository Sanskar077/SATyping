import { describe, it, expect } from "vitest";
import { hasPermission, requirePermission, PERMISSIONS, type Permission } from "../lib/permissions";
import { ROLES } from "../lib/roles";
import { mockReq, mockRes, mockNext } from "./helpers";

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// Expected permission set per non-owner role — the authoritative table lives in permissions.ts;
// this mirrors it so any drift breaks a test.
const EXPECTED: Record<string, Permission[]> = {
  [ROLES.INSTITUTE_ADMIN]: [
    PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.MANAGE_TEACHERS,
    PERMISSIONS.MANAGE_PASSAGES, PERMISSIONS.DELETE_PASSAGES, PERMISSIONS.MANAGE_TESTS,
    PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_INSTITUTE,
  ],
  [ROLES.TEACHER]: [
    PERMISSIONS.MANAGE_PASSAGES, PERMISSIONS.DELETE_PASSAGES, PERMISSIONS.MANAGE_TESTS,
    PERMISSIONS.VIEW_REPORTS,
  ],
  [ROLES.STUDENT]: [],
};

describe("hasPermission", () => {
  it("grants the Owner every permission that exists (implicitly)", () => {
    for (const p of ALL_PERMISSIONS) {
      expect(hasPermission(ROLES.OWNER, p)).toBe(true);
    }
  });

  it("grants each non-owner role exactly its documented permissions and nothing else", () => {
    for (const role of Object.keys(EXPECTED)) {
      const granted = EXPECTED[role];
      for (const p of ALL_PERMISSIONS) {
        expect(hasPermission(role, p)).toBe(granted.includes(p));
      }
    }
  });

  it("denies unknown roles everything", () => {
    for (const p of ALL_PERMISSIONS) {
      expect(hasPermission("intruder", p)).toBe(false);
    }
  });

  it("does not let a teacher manage payments, admins, or grant premium", () => {
    expect(hasPermission(ROLES.TEACHER, PERMISSIONS.MANAGE_PAYMENTS)).toBe(false);
    expect(hasPermission(ROLES.TEACHER, PERMISSIONS.MANAGE_ADMINS)).toBe(false);
    expect(hasPermission(ROLES.TEACHER, PERMISSIONS.GRANT_PREMIUM)).toBe(false);
  });

  it("does not let an institute admin manage admins, payments, or grant premium", () => {
    expect(hasPermission(ROLES.INSTITUTE_ADMIN, PERMISSIONS.MANAGE_ADMINS)).toBe(false);
    expect(hasPermission(ROLES.INSTITUTE_ADMIN, PERMISSIONS.MANAGE_PAYMENTS)).toBe(false);
    expect(hasPermission(ROLES.INSTITUTE_ADMIN, PERMISSIONS.GRANT_PREMIUM)).toBe(false);
  });
});

describe("requirePermission middleware", () => {
  it("401s when there is no authenticated user", () => {
    const res = mockRes();
    const next = mockNext();
    requirePermission(PERMISSIONS.MANAGE_TESTS)(mockReq(undefined), res as never, next);
    expect(res.statusCode).toBe(401);
    expect(next.called).toBe(false);
  });

  it("calls next() when the role holds the permission", () => {
    const res = mockRes();
    const next = mockNext();
    requirePermission(PERMISSIONS.MANAGE_TESTS)(mockReq({ role: ROLES.TEACHER }), res as never, next);
    expect(next.called).toBe(true);
    expect(res.statusCode).toBe(0);
  });

  it("403s when the role lacks the permission", () => {
    const res = mockRes();
    const next = mockNext();
    requirePermission(PERMISSIONS.MANAGE_ADMINS)(mockReq({ role: ROLES.TEACHER }), res as never, next);
    expect(res.statusCode).toBe(403);
    expect(next.called).toBe(false);
  });

  it("lets the Owner through MANAGE_ADMINS (implicit permission)", () => {
    const res = mockRes();
    const next = mockNext();
    requirePermission(PERMISSIONS.MANAGE_ADMINS)(mockReq({ role: ROLES.OWNER }), res as never, next);
    expect(next.called).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  ROLES, requireActiveAccess, requireOwner, requireInstituteAdmin, requireStaff, requireStudent,
} from "../lib/roles";
import { computeHasAccess, subscriptionGrantsAccess } from "../lib/account-status";
import { mockReq, mockRes, mockNext } from "./helpers";

// A canned getAccess for requireActiveAccess — represents whatever getOwnAccountAccess would have
// resolved to (including the expiry-downgrade already folded in).
const access = (own: string, institute: string | null = null) => async () => ({
  ownAccountStatus: own,
  instituteAccountStatus: institute,
});

describe("requireActiveAccess", () => {
  it("401s when unauthenticated", async () => {
    const res = mockRes();
    const next = mockNext();
    await requireActiveAccess(access("active"))(mockReq(undefined), res as never, next);
    expect(res.statusCode).toBe(401);
    expect(next.called).toBe(false);
  });

  it("always lets the Owner through, without even consulting access", async () => {
    const res = mockRes();
    const next = mockNext();
    let consulted = false;
    const getAccess = async () => { consulted = true; return { ownAccountStatus: "inactive", instituteAccountStatus: null }; };
    await requireActiveAccess(getAccess)(mockReq({ role: ROLES.OWNER }), res as never, next);
    expect(next.called).toBe(true);
    expect(consulted).toBe(false);
  });

  it("allows an active independent user", async () => {
    const res = mockRes();
    const next = mockNext();
    await requireActiveAccess(access("active"))(mockReq({ role: ROLES.STUDENT }), res as never, next);
    expect(next.called).toBe(true);
  });

  it("blocks a suspended user with ACCOUNT_SUSPENDED", async () => {
    const res = mockRes();
    const next = mockNext();
    await requireActiveAccess(access("suspended"))(mockReq({ role: ROLES.STUDENT }), res as never, next);
    expect(res.statusCode).toBe(403);
    expect((res.body as { code?: string }).code).toBe("ACCOUNT_SUSPENDED");
    expect(next.called).toBe(false);
  });

  it("blocks a lapsed/expired subscription with SUBSCRIPTION_REQUIRED (post-2.1 downgrade)", async () => {
    // An expired subscription is surfaced by getOwnAccountAccess as ownAccountStatus "inactive".
    const res = mockRes();
    const next = mockNext();
    await requireActiveAccess(access("inactive"))(mockReq({ role: ROLES.STUDENT }), res as never, next);
    expect(res.statusCode).toBe(403);
    expect((res.body as { code?: string }).code).toBe("SUBSCRIPTION_REQUIRED");
    expect(next.called).toBe(false);
  });

  it("allows an institute member whose own status is inactive but institute is active", async () => {
    const res = mockRes();
    const next = mockNext();
    await requireActiveAccess(access("inactive", "active"))(mockReq({ role: ROLES.STUDENT }), res as never, next);
    expect(next.called).toBe(true);
  });

  it("allows a user whose own status is active even if their institute is inactive", async () => {
    const res = mockRes();
    const next = mockNext();
    await requireActiveAccess(access("active", "inactive"))(mockReq({ role: ROLES.STUDENT }), res as never, next);
    expect(next.called).toBe(true);
  });

  it("blocks when both own and institute status are inactive", async () => {
    const res = mockRes();
    const next = mockNext();
    await requireActiveAccess(access("inactive", "inactive"))(mockReq({ role: ROLES.STUDENT }), res as never, next);
    expect(res.statusCode).toBe(403);
    expect(next.called).toBe(false);
  });
});

describe("computeHasAccess", () => {
  it("is always true for the Owner regardless of status", () => {
    expect(computeHasAccess(ROLES.OWNER, "inactive", null)).toBe(true);
    expect(computeHasAccess(ROLES.OWNER, "suspended", "inactive")).toBe(true);
  });

  it("is true when own status is active", () => {
    expect(computeHasAccess(ROLES.STUDENT, "active", null)).toBe(true);
  });

  it("is true when institute status is active", () => {
    expect(computeHasAccess(ROLES.STUDENT, "inactive", "active")).toBe(true);
  });

  it("is false when neither is active", () => {
    expect(computeHasAccess(ROLES.STUDENT, "inactive", null)).toBe(false);
    expect(computeHasAccess(ROLES.STUDENT, "inactive", "inactive")).toBe(false);
    expect(computeHasAccess(ROLES.STUDENT, "suspended", "suspended")).toBe(false);
  });
});

describe("subscriptionGrantsAccess (expiry rule)", () => {
  const now = 1_000_000_000_000;

  it("grants for an active subscription expiring in the future", () => {
    expect(subscriptionGrantsAccess({ status: "active", expiresAt: new Date(now + 1000) }, now)).toBe(true);
  });

  it("grants for an active subscription with no expiry (legacy free tier)", () => {
    expect(subscriptionGrantsAccess({ status: "active", expiresAt: null }, now)).toBe(true);
  });

  it("denies once expiresAt has passed", () => {
    expect(subscriptionGrantsAccess({ status: "active", expiresAt: new Date(now - 1) }, now)).toBe(false);
  });

  it("denies a non-active subscription regardless of expiry", () => {
    expect(subscriptionGrantsAccess({ status: "expired", expiresAt: new Date(now + 1000) }, now)).toBe(false);
    expect(subscriptionGrantsAccess({ status: "cancelled", expiresAt: null }, now)).toBe(false);
  });

  it("denies when there is no subscription row", () => {
    expect(subscriptionGrantsAccess(undefined, now)).toBe(false);
    expect(subscriptionGrantsAccess(null, now)).toBe(false);
  });
});

// Integration-style: each role hitting a guard it must not pass should be rejected with 403,
// exercising the real role-guard code paths from roles.ts.
describe("role guards reject the wrong role (403)", () => {
  const nonOwners = [ROLES.STUDENT, ROLES.TEACHER, ROLES.INSTITUTE_ADMIN];

  it("requireOwner rejects every non-owner role", () => {
    for (const role of nonOwners) {
      const res = mockRes();
      const next = mockNext();
      requireOwner(mockReq({ role }), res as never, next);
      expect(res.statusCode).toBe(403);
      expect(next.called).toBe(false);
    }
  });

  it("requireOwner admits the Owner", () => {
    const res = mockRes();
    const next = mockNext();
    requireOwner(mockReq({ role: ROLES.OWNER }), res as never, next);
    expect(next.called).toBe(true);
  });

  it("requireInstituteAdmin rejects students and teachers", () => {
    for (const role of [ROLES.STUDENT, ROLES.TEACHER]) {
      const res = mockRes();
      const next = mockNext();
      requireInstituteAdmin(mockReq({ role }), res as never, next);
      expect(res.statusCode).toBe(403);
    }
  });

  it("requireStaff rejects a student but admits teacher/institute_admin/owner", () => {
    const denied = mockRes();
    requireStaff(mockReq({ role: ROLES.STUDENT }), denied as never, mockNext());
    expect(denied.statusCode).toBe(403);

    for (const role of [ROLES.TEACHER, ROLES.INSTITUTE_ADMIN, ROLES.OWNER]) {
      const res = mockRes();
      const next = mockNext();
      requireStaff(mockReq({ role }), res as never, next);
      expect(next.called).toBe(true);
    }
  });

  it("requireStudent rejects staff roles", () => {
    for (const role of [ROLES.TEACHER, ROLES.INSTITUTE_ADMIN, ROLES.OWNER]) {
      const res = mockRes();
      const next = mockNext();
      requireStudent(mockReq({ role }), res as never, next);
      expect(res.statusCode).toBe(403);
    }
  });

  it("guards 401 when unauthenticated", () => {
    const res = mockRes();
    requireOwner(mockReq(undefined), res as never, mockNext());
    expect(res.statusCode).toBe(401);
  });
});

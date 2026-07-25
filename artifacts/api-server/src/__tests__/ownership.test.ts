import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * canReadUserData hits the DB to resolve institute membership, so @workspace/db is mocked with a
 * tiny in-memory users table. The point of these tests is the AUTHORIZATION RULE, not Drizzle.
 */
const usersById = new Map<number, { id: number; instituteId: number | null; role: string }>();

vi.mock("@workspace/db", () => {
  const usersTable = { id: "id", instituteId: "institute_id" };
  return {
    usersTable,
    // Minimal fluent stub: db.select().from(usersTable).where(eq(usersTable.id, N)) → [row].
    db: {
      select: () => ({
        from: () => ({
          where: (predicate: { __id?: number }) => {
            const row = usersById.get(predicate.__id ?? -1);
            return Promise.resolve(row ? [row] : []);
          },
        }),
      }),
    },
  };
});

vi.mock("drizzle-orm", () => ({
  // Captures the id being filtered on so the stub above can look it up.
  eq: (_col: unknown, value: number) => ({ __id: value }),
}));

const { canReadUserData } = await import("../lib/ownership");
const { ROLES } = await import("../lib/roles");

const req = (user: { userId: number; role: string }) => ({ user }) as never;

beforeEach(() => {
  usersById.clear();
  usersById.set(1, { id: 1, instituteId: 10, role: ROLES.STUDENT });   // student in institute 10
  usersById.set(2, { id: 2, instituteId: 10, role: ROLES.TEACHER });   // teacher in institute 10
  usersById.set(3, { id: 3, instituteId: 99, role: ROLES.STUDENT });   // student in ANOTHER institute
  usersById.set(4, { id: 4, instituteId: null, role: ROLES.STUDENT }); // independent student
  usersById.set(5, { id: 5, instituteId: 10, role: ROLES.INSTITUTE_ADMIN });
});

describe("canReadUserData", () => {
  it("always allows reading your own data", async () => {
    for (const role of [ROLES.STUDENT, ROLES.TEACHER, ROLES.INSTITUTE_ADMIN, ROLES.OWNER]) {
      expect(await canReadUserData(req({ userId: 1, role }), 1)).toBe(true);
    }
  });

  it("allows the Owner to read anyone's data", async () => {
    expect(await canReadUserData(req({ userId: 999, role: ROLES.OWNER }), 3)).toBe(true);
  });

  it("denies a student reading another student's data", async () => {
    expect(await canReadUserData(req({ userId: 1, role: ROLES.STUDENT }), 3)).toBe(false);
    // Even a same-institute peer is off limits for a student.
    expect(await canReadUserData(req({ userId: 1, role: ROLES.STUDENT }), 2)).toBe(false);
  });

  it("allows a teacher to read a student in their OWN institute", async () => {
    expect(await canReadUserData(req({ userId: 2, role: ROLES.TEACHER }), 1)).toBe(true);
  });

  it("denies a teacher reading a student in a DIFFERENT institute", async () => {
    expect(await canReadUserData(req({ userId: 2, role: ROLES.TEACHER }), 3)).toBe(false);
  });

  it("allows an institute admin to read their own institute's students", async () => {
    expect(await canReadUserData(req({ userId: 5, role: ROLES.INSTITUTE_ADMIN }), 1)).toBe(true);
  });

  it("denies an institute admin reading another institute's students", async () => {
    expect(await canReadUserData(req({ userId: 5, role: ROLES.INSTITUTE_ADMIN }), 3)).toBe(false);
  });

  it("denies staff with no institute of their own", async () => {
    usersById.set(6, { id: 6, instituteId: null, role: ROLES.TEACHER });
    expect(await canReadUserData(req({ userId: 6, role: ROLES.TEACHER }), 1)).toBe(false);
  });

  it("denies reading an independent student who belongs to no institute", async () => {
    expect(await canReadUserData(req({ userId: 2, role: ROLES.TEACHER }), 4)).toBe(false);
  });

  it("denies when the target user does not exist", async () => {
    expect(await canReadUserData(req({ userId: 2, role: ROLES.TEACHER }), 12345)).toBe(false);
  });
});

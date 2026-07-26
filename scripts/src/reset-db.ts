/**
 * Wipes ALL application data except one preserved super_admin account.
 *
 * This is a destructive, irreversible operation. It exists as a script (never a hand-edit of the
 * DB, and never an API endpoint) so the exact set of tables cleared is reviewable in version
 * control and the operation is reproducible.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run reset-db                 # prompts for confirmation
 *   RESET_DB_CONFIRM=yes pnpm --filter @workspace/scripts run reset-db   # non-interactive
 *
 * Override the preserved account with KEEP_EMAIL=someone@example.com.
 *
 * The preserved user is forced to role=super_admin / accountStatus=active, and is given a fresh
 * "institute" subscription row so the Owner is never left in a half-provisioned state. Their
 * password is left untouched — this script never changes credentials (use create-owner for that).
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// pnpm runs this script with CWD = scripts/, so dotenv's default `.env` lookup finds nothing.
// Resolve the workspace-root .env explicitly from this file's own location instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", "..", ".env") });

import {
  db,
  usersTable, institutesTable, batchesTable, passagesTable,
  typingSessionsTable, testsTable, testAttemptsTable, resultsTable,
  subscriptionsTable, refreshTokensTable, lessonsTable, lessonCompletionsTable,
  certificatesTable, plansTable, offersTable, paymentsTable, invoicesTable,
  commissionsTable, auditLogsTable, loginLogsTable, notificationsTable,
} from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const KEEP_EMAIL = (process.env.KEEP_EMAIL || "sanskaralave40@gmail.com").trim().toLowerCase();

/**
 * Deletion order matters: children before parents.
 *
 * The schema declares no DB-level foreign keys (no `references()` anywhere in
 * lib/db/src/schema), so Postgres would not stop us deleting in any order — but the columns are
 * still logical references. Clearing children first means that if this script fails partway
 * through, the DB is never left with rows pointing at ids that no longer exist.
 *
 * `passages` and `lessons` are global reference content with no per-user rows, but they are wiped
 * too: the task requires a clean slate, and seed.ts repopulates passages immediately afterwards.
 */
const TABLES_IN_DELETION_ORDER = [
  // ── Leaf records: reference a user, a payment, an attempt, etc. ──
  { name: "results", table: resultsTable },
  { name: "test_attempts", table: testAttemptsTable },
  { name: "certificates", table: certificatesTable },
  { name: "lesson_completions", table: lessonCompletionsTable },
  { name: "typing_sessions", table: typingSessionsTable },
  { name: "notifications", table: notificationsTable },
  { name: "refresh_tokens", table: refreshTokensTable },
  { name: "invoices", table: invoicesTable },
  { name: "commissions", table: commissionsTable },
  { name: "payments", table: paymentsTable },
  { name: "subscriptions", table: subscriptionsTable },
  { name: "audit_logs", table: auditLogsTable },
  { name: "login_logs", table: loginLogsTable },

  // ── Content / configuration ──
  { name: "tests", table: testsTable },
  { name: "passages", table: passagesTable },
  { name: "lessons", table: lessonsTable },
  { name: "offers", table: offersTable },
  { name: "plans", table: plansTable },
  { name: "batches", table: batchesTable },

  // ── Parents last ──
  { name: "institutes", table: institutesTable },
  // users is handled separately — one row survives.
] as const;

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set. Add it to the workspace-root .env first.");
    process.exit(1);
  }

  // Show which database is about to be wiped, with credentials stripped.
  let target = "(unparseable DATABASE_URL)";
  try {
    const u = new URL(dbUrl);
    target = `${u.host}${u.pathname}`;
  } catch {
    /* keep the placeholder */
  }

  console.log("=== DATABASE RESET ===\n");
  console.log(`  Target database : ${target}`);
  console.log(`  Preserving user : ${KEEP_EMAIL}`);
  console.log(`  Tables to clear : ${TABLES_IN_DELETION_ORDER.length + 1} (incl. users)\n`);
  console.log("  This deletes ALL other users, institutes, sessions, results, payments,");
  console.log("  subscriptions, notifications, tokens and logs. It cannot be undone.\n");

  const [keeper] = await db.select().from(usersTable).where(eq(usersTable.email, KEEP_EMAIL));
  if (!keeper) {
    console.error(`Refusing to run: no user found with email ${KEEP_EMAIL}.`);
    console.error("Create that account first (pnpm --filter @workspace/scripts run create-owner),");
    console.error("otherwise this reset would leave the platform with no way to log in.");
    process.exit(1);
  }
  console.log(`  Found user #${keeper.id} (${keeper.name}) — will be kept as super_admin.\n`);

  if (process.env.RESET_DB_CONFIRM !== "yes") {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = (await rl.question('Type "RESET" to proceed: ')).trim();
    rl.close();
    if (answer !== "RESET") {
      console.log("Aborted — nothing was deleted.");
      process.exit(0);
    }
  }

  console.log("\nClearing tables...");

  // One transaction: either the whole reset lands or none of it does. A partial wipe would be
  // far worse than no wipe at all.
  await db.transaction(async (tx) => {
    for (const { name, table } of TABLES_IN_DELETION_ORDER) {
      await tx.delete(table);
      console.log(`  cleared ${name}`);
    }

    // Every user EXCEPT the preserved one.
    await tx.delete(usersTable).where(ne(usersTable.id, keeper.id));
    console.log("  cleared users (except preserved account)");

    // Normalise the survivor: Owner, active, no institute membership (its institute is gone),
    // and no stale referral attribution.
    await tx.update(usersTable).set({
      role: "super_admin",
      accountStatus: "active",
      isActive: true,
      subscriptionPlan: "institute",
      instituteId: null,
      referredByInstituteId: null,
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    }).where(eq(usersTable.id, keeper.id));

    // Re-create the Owner's subscription row (the old one was just deleted).
    await tx.insert(subscriptionsTable).values({
      userId: keeper.id,
      plan: "institute",
      status: "active",
      startedAt: new Date(),
    });
    console.log("  restored preserved account + subscription");
  });

  // Verify the end state rather than assuming it.
  const remainingUsers = await db.select().from(usersTable);
  const [survivor] = remainingUsers;

  console.log("\n=== RESULT ===");
  console.log(`  users remaining : ${remainingUsers.length}`);
  if (remainingUsers.length !== 1 || !survivor) {
    console.error("  UNEXPECTED: exactly one user should remain. Inspect the database.");
    process.exit(1);
  }
  console.log(`  email           : ${survivor.email}`);
  console.log(`  role            : ${survivor.role}`);
  console.log(`  accountStatus   : ${survivor.accountStatus}`);

  if (survivor.email !== KEEP_EMAIL || survivor.role !== "super_admin" || survivor.accountStatus !== "active") {
    console.error("\n  UNEXPECTED: surviving account is not the expected active super_admin.");
    process.exit(1);
  }

  console.log("\nReset complete. Run the seed next:");
  console.log("  pnpm --filter @workspace/scripts run seed\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Reset failed (no changes were committed):", err);
  process.exit(1);
});

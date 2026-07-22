/**
 * Creates (or updates) the platform's ONE owner/super_admin account.
 *
 * This is deliberately a standalone script, not an API endpoint — nothing in the API can ever
 * create or promote to super_admin (see blockOwnerRoleAssignment), by design. This is the only
 * supported way to provision the owner account.
 *
 * Usage (interactive):
 *   pnpm --filter @workspace/scripts run create-owner
 *
 * Usage (non-interactive, e.g. in a deploy script — skips all prompts):
 *   OWNER_EMAIL=you@example.com OWNER_NAME="Jane Doe" OWNER_PASSWORD='S3cret!' \
 *     pnpm --filter @workspace/scripts run create-owner
 *
 * Safe to re-run: if the email already exists, it updates that row to role=super_admin and resets
 * the password, rather than erroring or creating a duplicate.
 *
 * Note: the password prompt is NOT masked (it echoes to the terminal). This is a one-off admin
 * provisioning tool run directly by a developer, not a public-facing form — keep that in mind if
 * running it somewhere your terminal history/screen could be observed, or just use the env-var
 * form above instead.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// pnpm runs this script with CWD = scripts/, so dotenv's default `.env` lookup finds nothing.
// Resolve the workspace-root .env explicitly from this file's own location instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", "..", ".env") });

import { db, usersTable, subscriptionsTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== Create/reset the owner (super_admin) account ===\n");

  const rl = createInterface({ input: stdin, output: stdout });

  const email = (process.env.OWNER_EMAIL || (await rl.question("Owner email: "))).trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("A valid email is required.");
    process.exit(1);
  }

  const name = (process.env.OWNER_NAME || (await rl.question("Owner name: "))).trim() || "Owner";

  const password = process.env.OWNER_PASSWORD || (await rl.question("Owner password (min 6 chars, shown in plain text): "));
  rl.close();

  if (!password || password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  let owner;
  if (existing) {
    [owner] = await db.update(usersTable).set({
      passwordHash,
      name,
      role: "super_admin",
      isActive: true,
      accountStatus: "active",
    }).where(eq(usersTable.id, existing.id)).returning();
    console.log(`\nUpdated existing user ${email} → role=super_admin, password reset.`);
  } else {
    [owner] = await db.insert(usersTable).values({
      email,
      passwordHash,
      name,
      role: "super_admin",
      isActive: true,
      accountStatus: "active",
      subscriptionPlan: "institute",
    }).returning();

    await db.insert(subscriptionsTable).values({
      userId: owner.id,
      plan: "institute",
      status: "active",
      startedAt: new Date(),
    }).onConflictDoNothing();

    console.log(`\nCreated owner account: ${email}`);
  }

  console.log(`\nLog in at /owner-login with:\n  ${email} / (the password you entered)\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to create owner account:", err);
  process.exit(1);
});

import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

// pnpm runs this script with CWD = scripts/, so dotenv's default `.env` lookup finds nothing.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", "..", ".env") });

import { db, usersTable, institutesTable, batchesTable, passagesTable, subscriptionsTable, plansTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * The typing corpus is generated offline by `fetch-passages.ts` (fetch → clean → split from
 * public-domain / CC BY-SA sources) and committed as JSON. Seeding just imports it, so the run
 * needs no network access and the exact text in the DB is reviewable in version control.
 *
 * Read at runtime rather than `import ... assert { type: "json" }` so typecheck doesn't have to
 * inline the whole file (and so we don't need resolveJsonModule across the workspace).
 */
interface GeneratedPassage {
  title: string;
  content: string;
  language: "english" | "marathi";
  difficulty: "easy" | "medium" | "hard";
  speedCategory: number;
  wordCount: number;
  source: string;
}

function loadGeneratedCorpus(): GeneratedPassage[] {
  const file = path.resolve(__dirname, "data", "passages.generated.json");
  try {
    return JSON.parse(readFileSync(file, "utf8")) as GeneratedPassage[];
  } catch (err) {
    throw new Error(
      `Could not read the generated passage corpus at ${file}. ` +
        `Run \`pnpm --filter @workspace/scripts run fetch-passages\` first. (${(err as Error).message})`,
    );
  }
}

/**
 * Demo accounts (admin/teacher/student + a demo institute) are OPT-IN.
 *
 * They exist to make a fresh local install usable immediately, but they must never be created on
 * a production database: `admin@satyping.local` is a second super_admin with a published password, and
 * the platform is designed around exactly one Owner account. Running this straight after
 * `reset-db` would therefore silently undo the "exactly one super_admin" guarantee.
 *
 * Enable explicitly for local development:
 *   SEED_DEMO_ACCOUNTS=yes pnpm --filter @workspace/scripts run seed
 */
const SEED_DEMO_ACCOUNTS = process.env.SEED_DEMO_ACCOUNTS === "yes";

async function seedDemoAccounts() {
  // Create super admin
  const [superAdmin] = await db.insert(usersTable).values({
    email: "admin@satyping.local",
    passwordHash: await bcrypt.hash("Admin@1234", 10),
    name: "Super Admin",
    role: "super_admin",
    subscriptionPlan: "institute",
    accountStatus: "active",
    isActive: true,
  }).onConflictDoNothing().returning();

  if (superAdmin) {
    await db.insert(subscriptionsTable).values({
      userId: superAdmin.id,
      plan: "institute",
      status: "active",
      startedAt: new Date(),
    }).onConflictDoNothing();
    console.log("Created super admin: admin@satyping.local / Admin@1234");
  }

  // Create a demo institute — Premium-granted (not a real payment) so the seeded teacher/student
  // aren't locked out under the no-trial access model (they inherit access from the institute).
  const [institute] = await db.insert(institutesTable).values({
    name: "SATyping Demo Academy",
    address: "Mumbai, Maharashtra",
    phone: "+91-9876543210",
    email: "demo@satyping.local",
    subscriptionPlan: "institute",
    accountStatus: "active",
    premiumGrantedByOwner: true,
  }).onConflictDoNothing().returning();

  let instituteId = institute?.id;

  if (!institute) {
    const [existing] = await db.select().from(institutesTable);
    instituteId = existing?.id;
  } else {
    console.log("Created institute: SATyping Demo Academy");
  }

  // Create a teacher
  const [teacher] = await db.insert(usersTable).values({
    email: "teacher@satyping.local",
    passwordHash: await bcrypt.hash("Teacher@1234", 10),
    name: "Ramesh Kumar",
    role: "teacher",
    subscriptionPlan: "pro_student",
    isActive: true,
    instituteId: instituteId ?? null,
  }).onConflictDoNothing().returning();

  if (teacher) {
    await db.insert(subscriptionsTable).values({
      userId: teacher.id,
      plan: "pro_student",
      status: "active",
    }).onConflictDoNothing();
    console.log("Created teacher: teacher@satyping.local / Teacher@1234");
  }

  // Create a student
  const [student] = await db.insert(usersTable).values({
    email: "student@satyping.local",
    passwordHash: await bcrypt.hash("Student@1234", 10),
    name: "Priya Sharma",
    role: "student",
    subscriptionPlan: "pro_student",
    isActive: true,
    instituteId: instituteId ?? null,
  }).onConflictDoNothing().returning();

  if (student) {
    await db.insert(subscriptionsTable).values({
      userId: student.id,
      plan: "pro_student",
      status: "active",
    }).onConflictDoNothing();
    console.log("Created student: student@satyping.local / Student@1234");
  }

  // Create a batch
  if (instituteId) {
    await db.insert(batchesTable).values({
      name: "Batch A - Morning",
      instituteId,
      description: "Morning batch for 30 WPM students",
    }).onConflictDoNothing();
    console.log("Created batch: Batch A - Morning");
  }
}

async function seed() {
  console.log("Seeding database...");

  if (SEED_DEMO_ACCOUNTS) {
    console.log("SEED_DEMO_ACCOUNTS=yes — creating demo accounts (local development only).");
    await seedDemoAccounts();
  } else {
    console.log(
      "Skipping demo accounts (set SEED_DEMO_ACCOUNTS=yes to create them for local development).",
    );
  }

  // Sample plans — /plans is empty until at least one exists; these give a fresh install
  // something to show immediately. Edit/replace freely via /admin/plans once you're set up.
  const plans = [
    {
      name: "Student Monthly",
      description: "Full access for one month — practice, exams, curriculum, certificates.",
      priceInPaise: 19900, // ₹199
      currency: "INR",
      durationDays: 30,
      forInstitute: false,
      features: ["Unlimited practice sessions", "Full exam simulator", "English + Marathi + Hindi", "Certificates"],
    },
    {
      name: "Student Quarterly",
      description: "Best value for exam preparation — 3 months of full access.",
      priceInPaise: 49900, // ₹499
      currency: "INR",
      durationDays: 90,
      forInstitute: false,
      features: ["Everything in Monthly", "Priority support", "Save 16% vs monthly"],
    },
    {
      name: "Institute Annual",
      description: "Full-roster access for an institute — covers every enrolled student for a year.",
      priceInPaise: 499900, // ₹4,999
      currency: "INR",
      durationDays: 365,
      forInstitute: true,
      features: ["Unlimited students", "Batch management", "Institute analytics", "Referral commissions"],
    },
  ];

  const [existingPlan] = await db.select().from(plansTable);
  if (existingPlan) {
    console.log("Plans already seeded, skipping.");
  } else {
    for (const p of plans) {
      await db.insert(plansTable).values(p);
    }
    console.log(`Seeded ${plans.length} plans`);
  }

  // Typing passages — the committed corpus generated offline by fetch-passages.ts.
  // The passages table has no natural unique key, so onConflictDoNothing can't dedupe; a naive
  // re-run would double the row count. Seed deterministically instead: only populate when the
  // table is empty, so a fresh install lands exactly the generated corpus (50 English + 50
  // Marathi) and a re-run is a no-op. Use reset-db to wipe and re-seed from scratch.
  const corpus = loadGeneratedCorpus();

  const enCount = corpus.filter((p) => p.language === "english").length;
  const mrCount = corpus.filter((p) => p.language === "marathi").length;
  if (enCount !== 50 || mrCount !== 50) {
    throw new Error(
      `Generated corpus is not the expected 50 English + 50 Marathi (got ${enCount} + ${mrCount}). ` +
        `Re-run \`pnpm --filter @workspace/scripts run fetch-passages\`.`,
    );
  }

  const [existingPassage] = await db.select({ id: passagesTable.id }).from(passagesTable).limit(1);
  if (existingPassage) {
    const [{ count: total } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(passagesTable);
    console.log(`Passages already seeded (${total} rows), skipping. Use reset-db to re-seed.`);
  } else {
    // Insert in chunks — a single 100-row multi-values insert is fine, but chunking keeps the
    // statement well under any parameter limit if the corpus grows.
    for (const p of corpus) {
      await db.insert(passagesTable).values({
        title: p.title,
        content: p.content,
        language: p.language,
        difficulty: p.difficulty,
        speedCategory: p.speedCategory,
        wordCount: p.wordCount,
        isActive: true,
      });
    }
    console.log(`Seeded ${corpus.length} passages (${enCount} English + ${mrCount} Marathi)`);
  }

  console.log("\n✅ Seeding complete!");
  if (SEED_DEMO_ACCOUNTS) {
    console.log("\nDemo accounts:");
    console.log("  admin@satyping.local    / Admin@1234    (Super Admin)");
    console.log("  teacher@satyping.local  / Teacher@1234  (Teacher)");
    console.log("  student@satyping.local  / Student@1234  (Student)");
  }

  process.exit(0);
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});

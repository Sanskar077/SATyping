import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "url";
import path from "path";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// drizzle-kit runs with CWD = lib/db (pnpm changes CWD to the package dir).
// The .env file lives at the workspace root (two levels up from lib/db).
const rootEnvPath = path.resolve(__dirname, "..", "..", ".env");
config({ path: rootEnvPath });

if (!process.env.DATABASE_URL) {
  throw new Error(
    `DATABASE_URL is not set.\n` +
    `Looked for .env at: ${rootEnvPath}\n` +
    `Ensure the file exists and contains DATABASE_URL.`
  );
}

// drizzle-kit passes schema paths directly into glob.sync() which requires
// forward slashes on ALL platforms — Windows backslashes cause "No schema
// files found" even when the files exist. Convert every path explicitly.
const toSlash = (p: string) => p.replace(/\\/g, "/");

const s = toSlash(path.join(__dirname, "src", "schema"));

export default defineConfig({
  schema: [
    `${s}/users.ts`,
    `${s}/institutes.ts`,
    `${s}/batches.ts`,
    `${s}/passages.ts`,
    `${s}/tests.ts`,
    `${s}/test_attempts.ts`,
    `${s}/typing_sessions.ts`,
    `${s}/results.ts`,
    `${s}/certificates.ts`,
    `${s}/subscriptions.ts`,
    `${s}/refresh_tokens.ts`,
    `${s}/lessons.ts`,
    `${s}/lesson_completions.ts`,
    `${s}/plans.ts`,
    `${s}/offers.ts`,
    `${s}/payments.ts`,
    `${s}/invoices.ts`,
    `${s}/commissions.ts`,
    `${s}/audit_logs.ts`,
    `${s}/notifications.ts`,
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  out: toSlash(path.join(__dirname, "drizzle")),
});

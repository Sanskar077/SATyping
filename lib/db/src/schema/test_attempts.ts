import { pgTable, serial, integer, text, real, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const testAttemptsTable = pgTable("test_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  testId: integer("test_id").notNull(),
  passageId: integer("passage_id").notNull(),
  status: text("status").notNull().default("active"), // active | completed | abandoned | timed_out
  grossWpm: real("gross_wpm"),
  netWpm: real("net_wpm"),
  accuracy: real("accuracy"),
  totalChars: integer("total_chars"),
  correctChars: integer("correct_chars"),
  incorrectChars: integer("incorrect_chars"),
  wrongWords: integer("wrong_words"),
  backspaceCount: integer("backspace_count"),
  durationSeconds: integer("duration_seconds"),
  passed: boolean("passed"),
  resultId: integer("result_id"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  userIdIdx: index("test_attempts_user_id_idx").on(table.userId),
  testIdIdx: index("test_attempts_test_id_idx").on(table.testId),
}));

export const insertTestAttemptSchema = createInsertSchema(testAttemptsTable).omit({ id: true, startedAt: true });
export type InsertTestAttempt = z.infer<typeof insertTestAttemptSchema>;
export type TestAttempt = typeof testAttemptsTable.$inferSelect;

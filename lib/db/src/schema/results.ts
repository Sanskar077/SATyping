import { pgTable, serial, integer, real, boolean, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resultsTable = pgTable("results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  testAttemptId: integer("test_attempt_id").notNull().unique(),
  grossWpm: real("gross_wpm").notNull(),
  netWpm: real("net_wpm").notNull(),
  accuracy: real("accuracy").notNull(),
  totalChars: integer("total_chars").notNull().default(0),
  correctChars: integer("correct_chars").notNull().default(0),
  incorrectChars: integer("incorrect_chars").notNull().default(0),
  wrongWords: integer("wrong_words").notNull().default(0),
  backspaceCount: integer("backspace_count").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  language: text("language").notNull(),
  speedCategory: integer("speed_category").notNull(),
  passed: boolean("passed").notNull(),
  certificateId: integer("certificate_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResultSchema = createInsertSchema(resultsTable).omit({ id: true, createdAt: true });
export type InsertResult = z.infer<typeof insertResultSchema>;
export type Result = typeof resultsTable.$inferSelect;

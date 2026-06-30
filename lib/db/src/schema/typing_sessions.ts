import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const typingSessionsTable = pgTable("typing_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  passageId: integer("passage_id").notNull(),
  language: text("language").notNull(),
  status: text("status").notNull().default("active"), // active | completed | abandoned
  grossWpm: real("gross_wpm"),
  netWpm: real("net_wpm"),
  accuracy: real("accuracy"),
  totalChars: integer("total_chars"),
  correctChars: integer("correct_chars"),
  incorrectChars: integer("incorrect_chars"),
  backspaceCount: integer("backspace_count"),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTypingSessionSchema = createInsertSchema(typingSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTypingSession = z.infer<typeof insertTypingSessionSchema>;
export type TypingSession = typeof typingSessionsTable.$inferSelect;

import { pgTable, serial, integer, text, real, boolean, timestamp, index } from "drizzle-orm/pg-core";
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
  // Feature 1: Keystroke replay data (JSON array of {key, timestamp, isCorrect, composedText})
  keystrokeData: text("keystroke_data"),
  // Feature 4: WPM timeline for real-time graph (JSON array of {time, wpm, accuracy, errors})
  wpmTimeline: text("wpm_timeline"),
  // Feature 2: Raw user input for error diff analysis
  userInput: text("user_input"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  userIdIdx: index("typing_sessions_user_id_idx").on(table.userId),
  passageIdIdx: index("typing_sessions_passage_id_idx").on(table.passageId),
}));

export const insertTypingSessionSchema = createInsertSchema(typingSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTypingSession = z.infer<typeof insertTypingSessionSchema>;
export type TypingSession = typeof typingSessionsTable.$inferSelect;

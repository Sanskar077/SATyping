import { pgTable, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Lesson completion tracking for Feature 5: Lesson-Based Typing Curriculum
export const lessonCompletionsTable = pgTable("lesson_completions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  lessonId: integer("lesson_id").notNull(),
  accuracy: real("accuracy").notNull(),
  wpm: real("wpm").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLessonCompletionSchema = createInsertSchema(lessonCompletionsTable).omit({ id: true, completedAt: true });
export type InsertLessonCompletion = z.infer<typeof insertLessonCompletionSchema>;
export type LessonCompletion = typeof lessonCompletionsTable.$inferSelect;

import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Lesson curriculum table for Feature 5: Lesson-Based Typing Curriculum
export const lessonsTable = pgTable("lessons", {
  id: serial("id").primaryKey(),
  language: text("language").notNull(), // english | hindi | marathi
  category: text("category").notNull(),
  // English: home_row | top_row | bottom_row | numbers | symbols | words | sentences | paragraphs
  // Marathi: swar | vyanjan | matras | jodakshar | common_words | sentences | paragraphs
  // Hindi:   swar | vyanjan | matras | common_words | sentences | paragraphs
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull(), // practice text for this lesson
  targetKeys: text("target_keys"),    // e.g., "asdf jkl;" for home row
  orderIndex: integer("order_index").notNull().default(0),
  minAccuracy: real("min_accuracy").notNull().default(80),
  minWpm: real("min_wpm").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLessonSchema = createInsertSchema(lessonsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessonsTable.$inferSelect;

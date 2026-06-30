import { pgTable, serial, text, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const testsTable = pgTable("tests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  language: text("language").notNull(), // english | hindi | marathi
  speedCategory: integer("speed_category").notNull(), // 30 | 40 | 50 | 60
  durationMinutes: integer("duration_minutes").notNull().default(5),
  isActive: boolean("is_active").notNull().default(true),
  instituteId: integer("institute_id"),
  passageId: integer("passage_id"),
  useRandomPassage: boolean("use_random_passage").notNull().default(true),
  minAccuracy: real("min_accuracy").notNull().default(80),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTestSchema = createInsertSchema(testsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTest = z.infer<typeof insertTestSchema>;
export type Test = typeof testsTable.$inferSelect;

import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const passagesTable = pgTable("passages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  language: text("language").notNull(), // english | hindi | marathi
  difficulty: text("difficulty").notNull().default("medium"), // easy | medium | hard
  speedCategory: integer("speed_category").notNull(), // 30 | 40 | 50 | 60
  wordCount: integer("word_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPassageSchema = createInsertSchema(passagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPassage = z.infer<typeof insertPassageSchema>;
export type Passage = typeof passagesTable.$inferSelect;

import { pgTable, serial, text, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  // Price stored in the smallest currency unit (e.g. paise for INR) to avoid float rounding.
  priceInPaise: integer("price_in_paise").notNull(),
  currency: text("currency").notNull().default("INR"),
  durationDays: integer("duration_days").notNull(),
  // Whether this plan is purchasable by institutes (vs individual students).
  forInstitute: boolean("for_institute").notNull().default(false),
  features: jsonb("features").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;

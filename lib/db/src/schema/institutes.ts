import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const institutesTable = pgTable("institutes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").notNull().default(true),
  subscriptionPlan: text("subscription_plan").notNull().default("free"), // free | institute
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInstituteSchema = createInsertSchema(institutesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInstitute = z.infer<typeof insertInstituteSchema>;
export type Institute = typeof institutesTable.$inferSelect;

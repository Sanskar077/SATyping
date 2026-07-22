import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  plan: text("plan").notNull().default("free"), // free | pro_student | institute
  // planId links to the commerce plans table once a real paid plan is active; null while on the
  // legacy free tier. paymentId links to the payment that most recently activated/renewed this row.
  planId: integer("plan_id"),
  paymentId: integer("payment_id"),
  status: text("status").notNull().default("active"), // active | expired | cancelled
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  planIdIdx: index("subscriptions_plan_id_idx").on(table.planId),
}));

export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  payerType: text("payer_type").notNull(), // student | institute
  planId: integer("plan_id").notNull(),
  offerId: integer("offer_id"),
  // Amount actually charged, in the smallest currency unit, computed server-side.
  amountInPaise: integer("amount_in_paise").notNull(),
  currency: text("currency").notNull().default("INR"),
  status: text("status").notNull().default("pending"), // pending | success | failed | refunded
  gateway: text("gateway").notNull().default("razorpay"),
  gatewayOrderId: text("gateway_order_id").unique(),
  gatewayPaymentId: text("gateway_payment_id"),
  gatewaySignature: text("gateway_signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  userIdIdx: index("payments_user_id_idx").on(table.userId),
  planIdIdx: index("payments_plan_id_idx").on(table.planId),
  statusIdx: index("payments_status_idx").on(table.status),
}));

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;

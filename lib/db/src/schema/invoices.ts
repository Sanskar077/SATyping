import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id").notNull().unique(),
  userId: integer("user_id").notNull(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  amountInPaise: integer("amount_in_paise").notNull(),
  currency: text("currency").notNull().default("INR"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("invoices_user_id_idx").on(table.userId),
}));

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, issuedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

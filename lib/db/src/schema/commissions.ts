import { pgTable, serial, text, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commissionsTable = pgTable("commissions", {
  id: serial("id").primaryKey(),
  instituteId: integer("institute_id").notNull(),
  paymentId: integer("payment_id").notNull(),
  studentUserId: integer("student_user_id").notNull(),
  amountInPaise: integer("amount_in_paise").notNull(),
  commissionType: text("commission_type").notNull(), // percent | flat
  commissionRate: real("commission_rate").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | paid
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  instituteIdIdx: index("commissions_institute_id_idx").on(table.instituteId),
  paymentIdIdx: index("commissions_payment_id_idx").on(table.paymentId),
  studentUserIdIdx: index("commissions_student_user_id_idx").on(table.studentUserId),
  statusIdx: index("commissions_status_idx").on(table.status),
}));

export const insertCommissionSchema = createInsertSchema(commissionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissionsTable.$inferSelect;

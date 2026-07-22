import { pgTable, serial, text, integer, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
  targetTypeIdx: index("audit_logs_target_type_idx").on(table.targetType),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;

export const loginLogsTable = pgTable("login_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  email: text("email").notNull(),
  success: boolean("success").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Every login attempt runs a brute-force check filtering by email + recent createdAt — this is
  // the hottest query in the whole schema, hit on every single login.
  emailIdx: index("login_logs_email_idx").on(table.email),
  createdAtIdx: index("login_logs_created_at_idx").on(table.createdAt),
}));

export const insertLoginLogSchema = createInsertSchema(loginLogsTable).omit({ id: true, createdAt: true });
export type InsertLoginLog = z.infer<typeof insertLoginLogSchema>;
export type LoginLog = typeof loginLogsTable.$inferSelect;

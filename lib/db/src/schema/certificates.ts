import { pgTable, serial, integer, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  resultId: integer("result_id").notNull().unique(),
  certificateNumber: text("certificate_number").notNull().unique(),
  verificationId: text("verification_id").notNull().unique(),
  language: text("language").notNull(),
  speedCategory: integer("speed_category").notNull(),
  netWpm: real("net_wpm").notNull(),
  accuracy: real("accuracy").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("certificates_user_id_idx").on(table.userId),
}));

export const insertCertificateSchema = createInsertSchema(certificatesTable).omit({ id: true, issuedAt: true });
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificatesTable.$inferSelect;

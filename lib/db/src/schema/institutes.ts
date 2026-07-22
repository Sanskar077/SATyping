import { pgTable, serial, text, boolean, integer, real, timestamp } from "drizzle-orm/pg-core";
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
  // accountStatus drives access-gating middleware — an institute (and by extension its students —
  // see requireActiveAccess) has NO software access until this is "active", either via a
  // successful payment or an Owner manual grant. Never trust a client-supplied value for this.
  accountStatus: text("account_status").notNull().default("inactive"), // inactive | active | suspended
  premiumGrantedByOwner: boolean("premium_granted_by_owner").notNull().default(false),
  // Short, human-shareable code generated at institute creation. Used both for student signup
  // referral attribution (referredByInstituteId) and for "join this institute" membership.
  referralCode: text("referral_code").unique(),
  commissionType: text("commission_type").notNull().default("percent"), // percent | flat
  commissionRate: real("commission_rate").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInstituteSchema = createInsertSchema(institutesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInstitute = z.infer<typeof insertInstituteSchema>;
export type Institute = typeof institutesTable.$inferSelect;

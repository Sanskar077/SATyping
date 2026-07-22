import { pgTable, serial, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("student"), // student | teacher | institute_admin | super_admin
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  subscriptionPlan: text("subscription_plan").notNull().default("free"), // free | pro_student | institute
  // instituteId = institute this user is a MEMBER of (null = independent student). Never both member of
  // multiple institutes; a student is either independent or belongs to exactly one institute.
  instituteId: integer("institute_id"),
  // accountStatus drives access-gating middleware — a user has NO software access until this is
  // "active", either via a successful payment or an Owner manual grant. Never trust a
  // client-supplied value for this.
  accountStatus: text("account_status").notNull().default("inactive"), // inactive | active | suspended
  // True only when an Owner manually flipped this to active (not via payment) — purely for
  // display/audit in the admin UI, distinct from a paid subscription.
  premiumGrantedByOwner: boolean("premium_granted_by_owner").notNull().default(false),
  // referredByInstituteId = which institute's referral code was used at signup, for commission
  // attribution ONLY. Distinct from instituteId (membership) — see USER HIERARCHY rules. Set alongside
  // instituteId when a student formally joins an institute; set alone when a student stays independent
  // but used a referral code (commission-only, no membership).
  referredByInstituteId: integer("referred_by_institute_id"),
  avatarUrl: text("avatar_url"),
  // Email verification — informational, does NOT gate access (subscription/premium already does
  // that separately). Token + expiry are cleared once verified or once a new one is issued.
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at", { withTimezone: true }),
  // Password reset — single-use token, short expiry, cleared after use or once a new one is issued.
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  // Every "which institute is this student/admin in" lookup and every "who referred this signup"
  // commission lookup filters on these — full table scans without an index as the user base grows.
  instituteIdIdx: index("users_institute_id_idx").on(table.instituteId),
  referredByInstituteIdIdx: index("users_referred_by_institute_id_idx").on(table.referredByInstituteId),
  roleIdx: index("users_role_idx").on(table.role),
  emailVerificationTokenIdx: index("users_email_verification_token_idx").on(table.emailVerificationToken),
  passwordResetTokenIdx: index("users_password_reset_token_idx").on(table.passwordResetToken),
}));

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

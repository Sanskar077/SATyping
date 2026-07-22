import { Router } from "express";
import { eq, and, gte } from "drizzle-orm";
import { db, usersTable, refreshTokensTable, subscriptionsTable, institutesTable, loginLogsTable } from "@workspace/db";
import {
  RegisterBody,
  RegisterStudentBody,
  RegisterInstituteBody,
  LoginBody,
  RefreshTokenBody,
  ChangePasswordBody,
  VerifyEmailBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  GetMeResponse,
} from "@workspace/api-zod";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  getRefreshTokenExpiry,
  requireAuth,
} from "../lib/auth";
import { blockOwnerRoleAssignment } from "../lib/roles";
import { generateReferralCode, resolveInstituteToJoin, resolveReferralCodeSilently, membershipFieldsForJoin } from "../lib/institute-membership";
import { computeHasAccess, getInstituteAccountStatus } from "../lib/account-status";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email";
import { randomBytes } from "crypto";

const EMAIL_VERIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

// Brute-force protection reads recent login_logs rather than an in-memory counter — see login handler.
const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000;
const BRUTE_FORCE_MAX_FAILURES = 5;

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect, instituteName?: string | null, instituteAccountStatus: string | null = null) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone ?? null,
    isActive: user.isActive,
    subscriptionPlan: user.subscriptionPlan,
    accountStatus: user.accountStatus,
    hasAccess: computeHasAccess(user.role, user.accountStatus, instituteAccountStatus),
    emailVerified: user.emailVerified,
    instituteId: user.instituteId ?? null,
    instituteName: instituteName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", blockOwnerRoleAssignment, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, name, role, phone, instituteId } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    name,
    role: role as string,
    phone: phone ?? null,
    instituteId: instituteId ?? null,
    subscriptionPlan: "free",
  }).returning();

  await db.insert(subscriptionsTable).values({
    userId: user.id,
    plan: "free",
    status: "active",
    startedAt: new Date(),
  });

  const payload = { userId: user.id, email: user.email, role: user.role, instituteId: user.instituteId };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  res.status(201).json({
    accessToken,
    refreshToken,
    user: formatUser(user, undefined, await getInstituteAccountStatus(user.instituteId)),
  });
});

// New accounts start with NO software access (accountStatus: "inactive") — there is no trial.
// Access is granted only by a successful payment or an Owner manual Premium grant. Never trust a
// client-supplied accountStatus, regardless of body.
router.post("/auth/register/student", blockOwnerRoleAssignment, async (req, res): Promise<void> => {
  const parsed = RegisterStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, name, phone, membershipMode, instituteId, referralCode } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  // Resolve institute membership BEFORE creating the user, per the USER HIERARCHY rules:
  // "join" must resolve to a real institute or the request fails; "independent" silently
  // ignores an invalid/missing referral code rather than erroring.
  let membershipFields: { instituteId: number | null; referredByInstituteId: number | null } = {
    instituteId: null,
    referredByInstituteId: null,
  };

  if (membershipMode === "join") {
    const institute = await resolveInstituteToJoin({ instituteId, referralCode });
    if (!institute) {
      res.status(400).json({ error: "Institute not found. Check the institute or referral code." });
      return;
    }
    membershipFields = membershipFieldsForJoin(institute.id);
  } else {
    const referredByInstituteId = await resolveReferralCodeSilently(referralCode);
    membershipFields = { instituteId: null, referredByInstituteId };
  }

  const passwordHash = await hashPassword(password);
  const emailVerificationToken = generateToken();

  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    name,
    role: "student",
    phone: phone ?? null,
    subscriptionPlan: "free",
    accountStatus: "inactive",
    emailVerificationToken,
    emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_WINDOW_MS),
    ...membershipFields,
  }).returning();

  await db.insert(subscriptionsTable).values({
    userId: user.id,
    plan: "free",
    status: "active",
    startedAt: new Date(),
  });

  await sendVerificationEmail(user.email, user.name, emailVerificationToken);

  const payload = { userId: user.id, email: user.email, role: user.role, instituteId: user.instituteId };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  res.status(201).json({ accessToken, refreshToken, user: formatUser(user, undefined, await getInstituteAccountStatus(user.instituteId)) });
});

// Creates the institute row AND its first institute_admin user in one transaction, per Phase 3.
router.post("/auth/register/institute", blockOwnerRoleAssignment, async (req, res): Promise<void> => {
  const parsed = RegisterInstituteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { instituteName, address, phone, email, adminName, adminEmail, adminPassword } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail));
  if (existing) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(adminPassword);
  const emailVerificationToken = generateToken();

  const { user, institute } = await db.transaction(async (tx) => {
    // Regenerate on the rare collision rather than trusting a single attempt.
    let referralCode = generateReferralCode(instituteName);
    for (let attempt = 0; attempt < 5; attempt++) {
      const [clash] = await tx.select().from(institutesTable).where(eq(institutesTable.referralCode, referralCode));
      if (!clash) break;
      referralCode = generateReferralCode(instituteName);
    }

    const [institute] = await tx.insert(institutesTable).values({
      name: instituteName,
      address: address ?? null,
      phone: phone ?? null,
      email: email ?? null,
      subscriptionPlan: "free",
      accountStatus: "inactive",
      referralCode,
    }).returning();

    const [user] = await tx.insert(usersTable).values({
      email: adminEmail,
      passwordHash,
      name: adminName,
      role: "institute_admin",
      instituteId: institute.id,
      referredByInstituteId: institute.id,
      subscriptionPlan: "free",
      accountStatus: "inactive",
      emailVerificationToken,
      emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_WINDOW_MS),
    }).returning();

    await tx.insert(subscriptionsTable).values({
      userId: user.id,
      plan: "free",
      status: "active",
      startedAt: new Date(),
    });

    return { user, institute };
  });

  await sendVerificationEmail(user.email, user.name, emailVerificationToken);

  const payload = { userId: user.id, email: user.email, role: user.role, instituteId: user.instituteId };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  res.status(201).json({ accessToken, refreshToken, user: formatUser(user, institute.name, institute.accountStatus) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const ipAddress = req.ip ?? null;
  const userAgent = req.headers["user-agent"] ?? null;

  // Brute-force protection: check login_logs for recent failures on this email, rather than an
  // in-memory counter, so it stays correct across Render's autoscaled/replaced instances.
  const windowStart = new Date(Date.now() - BRUTE_FORCE_WINDOW_MS);
  const recentAttempts = await db.select().from(loginLogsTable).where(
    and(eq(loginLogsTable.email, email), gte(loginLogsTable.createdAt, windowStart)),
  );
  const recentFailures = recentAttempts.filter((a) => !a.success).length;

  if (recentFailures >= BRUTE_FORCE_MAX_FAILURES) {
    res.status(429).json({ error: "Too many failed attempts. Please try again in a few minutes." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || !user.isActive) {
    await db.insert(loginLogsTable).values({ userId: user?.id ?? null, email, success: false, ipAddress, userAgent: userAgent ?? null });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await db.insert(loginLogsTable).values({ userId: user.id, email, success: false, ipAddress, userAgent: userAgent ?? null });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  await db.insert(loginLogsTable).values({ userId: user.id, email, success: true, ipAddress, userAgent: userAgent ?? null });

  const payload = { userId: user.id, email: user.email, role: user.role, instituteId: user.instituteId };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await db.insert(refreshTokensTable).values({
    userId: user.id,
    token: refreshToken,
    expiresAt: getRefreshTokenExpiry(),
  });

  res.json({
    accessToken,
    refreshToken,
    user: formatUser(user, undefined, await getInstituteAccountStatus(user.instituteId)),
  });
});

router.post("/auth/logout", requireAuth, async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.slice(7) ?? "";
  await db
    .update(refreshTokensTable)
    .set({ isRevoked: true })
    .where(eq(refreshTokensTable.userId, req.user!.userId));
  res.sendStatus(204);
});

// Email verification is informational only — it never gates access (the subscription/premium
// system already does that separately). It just lets the frontend show a "please verify" nudge.
router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.emailVerificationToken, parsed.data.token));
  if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "Invalid or expired verification link" });
    return;
  }

  await db.update(usersTable).set({
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpiresAt: null,
  }).where(eq(usersTable.id, user.id));

  res.json({ message: "Email verified successfully" });
});

router.post("/auth/resend-verification", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (user.emailVerified) {
    res.json({ message: "Email is already verified" });
    return;
  }

  const token = generateToken();
  await db.update(usersTable).set({
    emailVerificationToken: token,
    emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_WINDOW_MS),
  }).where(eq(usersTable.id, user.id));

  await sendVerificationEmail(user.email, user.name, token);
  res.json({ message: "Verification email sent" });
});

// Deliberately returns the SAME response whether or not the email exists — never leak which
// emails are registered via response timing/content differences.
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (user) {
    const token = generateToken();
    await db.update(usersTable).set({
      passwordResetToken: token,
      passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_WINDOW_MS),
    }).where(eq(usersTable.id, user.id));
    await sendPasswordResetEmail(user.email, user.name, token);
  }

  res.json({ message: "If an account with that email exists, a password reset link has been sent." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.passwordResetToken, parsed.data.token));
  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "Invalid or expired reset link" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.update(usersTable).set({
    passwordHash,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
  }).where(eq(usersTable.id, user.id));

  // Resetting the password invalidates every existing session — force re-login everywhere,
  // since the old password (and any session obtained under it) can no longer be trusted.
  await db.update(refreshTokensTable).set({ isRevoked: true }).where(eq(refreshTokensTable.userId, user.id));

  res.json({ message: "Password reset successfully. Please log in with your new password." });
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const parsed = RefreshTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { refreshToken } = parsed.data;
  const [storedToken] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.token, refreshToken));

  if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  try {
    const payload = verifyToken(refreshToken);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, storedToken.userId));
    if (!user || !user.isActive) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }

    await db.update(refreshTokensTable).set({ isRevoked: true }).where(eq(refreshTokensTable.token, refreshToken));

    const newPayload = { userId: user.id, email: user.email, role: user.role, instituteId: user.instituteId };
    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    await db.insert(refreshTokensTable).values({
      userId: user.id,
      token: newRefreshToken,
      expiresAt: getRefreshTokenExpiry(),
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: formatUser(user, undefined, await getInstituteAccountStatus(user.instituteId)),
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const instituteAccountStatus = await getInstituteAccountStatus(user.instituteId);
  res.json(GetMeResponse.parse(formatUser(user, undefined, instituteAccountStatus)));
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));

  res.json({ message: "Password changed successfully" });
});

export default router;

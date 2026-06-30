import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, refreshTokensTable, subscriptionsTable } from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
  RefreshTokenBody,
  ChangePasswordBody,
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

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect, instituteName?: string | null) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone ?? null,
    isActive: user.isActive,
    subscriptionPlan: user.subscriptionPlan,
    instituteId: user.instituteId ?? null,
    instituteName: instituteName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
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

  const payload = { userId: user.id, email: user.email, role: user.role };
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
    user: formatUser(user),
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const payload = { userId: user.id, email: user.email, role: user.role };
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
    user: formatUser(user),
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

    const newPayload = { userId: user.id, email: user.email, role: user.role };
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
      user: formatUser(user),
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
  res.json(GetMeResponse.parse(formatUser(user)));
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

import { Router } from "express";
import { eq, and, SQL, count } from "drizzle-orm";
import { db, certificatesTable, resultsTable, usersTable, institutesTable } from "@workspace/db";
import { ListCertificatesQueryParams, GenerateCertificateBody, GetCertificateParams, VerifyCertificateParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireActiveAccess } from "../lib/roles";
import { getOwnAccountAccess } from "../lib/account-status";
import { canReadUserData } from "../lib/ownership";
import { randomUUID } from "crypto";

const router = Router();

function generateCertNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `GCC-TBC-${year}-${rand}`;
}

async function formatCertificate(c: typeof certificatesTable.$inferSelect) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, c.userId));
  let instituteName: string | null = null;
  if (user?.instituteId) {
    const [inst] = await db.select().from(institutesTable).where(eq(institutesTable.id, user.instituteId));
    instituteName = inst?.name ?? null;
  }

  return {
    id: c.id, userId: c.userId, resultId: c.resultId,
    certificateNumber: c.certificateNumber, verificationId: c.verificationId,
    userName: user?.name ?? "Unknown",
    language: c.language, speedCategory: c.speedCategory,
    netWpm: c.netWpm, accuracy: c.accuracy,
    instituteName,
    issuedAt: c.issuedAt.toISOString(),
  };
}

router.get("/certificates", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
  const params = ListCertificatesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { userId, language, page = 1, limit = 20 } = params.data;
  const targetUserId = userId ?? req.user!.userId;
  if (!(await canReadUserData(req, targetUserId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const conditions: SQL[] = [eq(certificatesTable.userId, targetUserId)];
  if (language) conditions.push(eq(certificatesTable.language, language));

  const offset = (page - 1) * limit;
  const where = and(...conditions);

  const certs = await db.select().from(certificatesTable).where(where).limit(limit).offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(certificatesTable).where(where);

  const formatted = await Promise.all(certs.map(formatCertificate));
  res.json({ certificates: formatted, total, page, limit });
});

router.post("/certificates", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
  const parsed = GenerateCertificateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [result] = await db.select().from(resultsTable).where(eq(resultsTable.id, parsed.data.resultId));
  if (!result) {
    res.status(404).json({ error: "Result not found" });
    return;
  }

  if (!result.passed) {
    res.status(400).json({ error: "Can only generate certificate for passing results" });
    return;
  }

  if (result.userId !== req.user!.userId && req.user!.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const existing = await db.select().from(certificatesTable).where(eq(certificatesTable.resultId, parsed.data.resultId));
  if (existing.length > 0) {
    const formatted = await formatCertificate(existing[0]);
    res.status(201).json(formatted);
    return;
  }

  const [cert] = await db.insert(certificatesTable).values({
    userId: result.userId,
    resultId: result.id,
    certificateNumber: generateCertNumber(),
    verificationId: randomUUID(),
    language: result.language,
    speedCategory: result.speedCategory,
    netWpm: result.netWpm,
    accuracy: result.accuracy,
  }).returning();

  await db.update(resultsTable).set({ certificateId: cert.id }).where(eq(resultsTable.id, result.id));

  const formatted = await formatCertificate(cert);
  res.status(201).json(formatted);
});

router.get("/certificates/verify/:verificationId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.verificationId) ? req.params.verificationId[0] : req.params.verificationId;

  const [cert] = await db.select().from(certificatesTable).where(eq(certificatesTable.verificationId, raw));
  if (!cert) {
    res.status(404).json({ error: "Certificate not found or invalid" });
    return;
  }

  const formatted = await formatCertificate(cert);
  res.json({ valid: true, certificate: formatted });
});

router.get("/certificates/:id", requireAuth, requireActiveAccess(getOwnAccountAccess), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [cert] = await db.select().from(certificatesTable).where(eq(certificatesTable.id, id));
  if (!cert) {
    res.status(404).json({ error: "Certificate not found" });
    return;
  }

  // Note: the PUBLIC verification route above (/certificates/verify/...) is intentionally open —
  // that's the point of a verifiable certificate. This authenticated by-id route is not, so it
  // must not leak another user's certificate to anyone who guesses an id.
  if (!(await canReadUserData(req, cert.userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const formatted = await formatCertificate(cert);
  res.json(formatted);
});

export default router;

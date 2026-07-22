import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, offersTable, plansTable } from "@workspace/db";
import {
  ValidateOfferQueryParams, CreateOfferBody, UpdateOfferParams, UpdateOfferBody, DeleteOfferParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requireOwner } from "../lib/roles";
import { logAudit } from "../lib/audit";

const router = Router();

function formatOffer(o: typeof offersTable.$inferSelect) {
  return {
    id: o.id,
    code: o.code,
    description: o.description ?? null,
    discountType: o.discountType,
    discountValue: o.discountValue,
    planId: o.planId ?? null,
    maxRedemptions: o.maxRedemptions ?? null,
    redemptionCount: o.redemptionCount,
    expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
    isActive: o.isActive,
    createdAt: o.createdAt.toISOString(),
  };
}

export function computeDiscountedAmount(priceInPaise: number, discountType: string, discountValue: number): number {
  const raw = discountType === "percent" ? priceInPaise * (1 - discountValue / 100) : priceInPaise - discountValue;
  return Math.max(0, Math.round(raw));
}

// Authenticated: validate a code against a plan and return the computed discount only — never
// leak the existence/details of any OTHER offer (invalid/expired/exhausted all return the same
// generic 404 shape).
router.get("/offers/validate", requireAuth, async (req, res): Promise<void> => {
  const params = ValidateOfferQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { code, planId } = params.data;
  const genericError = { error: "Offer not found, expired, or exhausted" };

  const [offer] = await db.select().from(offersTable).where(eq(offersTable.code, code));
  if (!offer || !offer.isActive) {
    res.status(404).json(genericError);
    return;
  }
  if (offer.planId !== null && offer.planId !== planId) {
    res.status(404).json(genericError);
    return;
  }
  if (offer.expiresAt && offer.expiresAt.getTime() < Date.now()) {
    res.status(404).json(genericError);
    return;
  }
  if (offer.maxRedemptions !== null && offer.redemptionCount >= offer.maxRedemptions) {
    res.status(404).json(genericError);
    return;
  }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!plan) {
    res.status(404).json(genericError);
    return;
  }

  const finalAmountInPaise = computeDiscountedAmount(plan.priceInPaise, offer.discountType, offer.discountValue);
  res.json({
    code: offer.code,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    finalAmountInPaise,
  });
});

router.get("/offers", requireAuth, requireOwner, async (_req, res): Promise<void> => {
  const offers = await db.select().from(offersTable);
  res.json({ offers: offers.map(formatOffer) });
});

router.post("/offers", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const parsed = CreateOfferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(offersTable).where(eq(offersTable.code, parsed.data.code));
  if (existing) {
    res.status(400).json({ error: "An offer with this code already exists" });
    return;
  }

  const [offer] = await db.insert(offersTable).values({
    code: parsed.data.code,
    description: parsed.data.description ?? null,
    discountType: parsed.data.discountType,
    discountValue: parsed.data.discountValue,
    planId: parsed.data.planId ?? null,
    maxRedemptions: parsed.data.maxRedemptions ?? null,
    expiresAt: parsed.data.expiresAt ?? null,
  }).returning();

  await logAudit(req.user!.userId, "create_offer", "offer", offer.id, { code: offer.code });

  res.status(201).json(formatOffer(offer));
});

router.patch("/offers/:id", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const parsedParams = UpdateOfferParams.safeParse(req.params);
  const parsed = UpdateOfferBody.safeParse(req.body);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [offer] = await db.update(offersTable).set({
    ...(parsed.data.description !== undefined && { description: parsed.data.description }),
    ...(parsed.data.discountType !== undefined && { discountType: parsed.data.discountType }),
    ...(parsed.data.discountValue !== undefined && { discountValue: parsed.data.discountValue }),
    ...(parsed.data.maxRedemptions !== undefined && { maxRedemptions: parsed.data.maxRedemptions }),
    ...(parsed.data.expiresAt !== undefined && { expiresAt: parsed.data.expiresAt }),
    ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
  }).where(eq(offersTable.id, parsedParams.data.id)).returning();

  if (!offer) {
    res.status(404).json({ error: "Offer not found" });
    return;
  }
  await logAudit(req.user!.userId, "update_offer", "offer", offer.id, parsed.data);
  res.json(formatOffer(offer));
});

router.delete("/offers/:id", requireAuth, requireOwner, async (req, res): Promise<void> => {
  const parsedParams = DeleteOfferParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }

  await db.delete(offersTable).where(eq(offersTable.id, parsedParams.data.id));
  await logAudit(req.user!.userId, "delete_offer", "offer", parsedParams.data.id);
  res.sendStatus(204);
});

export default router;

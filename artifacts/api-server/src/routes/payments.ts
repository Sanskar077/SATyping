import { Router } from "express";
import { eq, and, sql, SQL, count } from "drizzle-orm";
import {
  db, paymentsTable, invoicesTable, plansTable, offersTable, subscriptionsTable,
  usersTable, institutesTable, commissionsTable,
} from "@workspace/db";
import { CreateCheckoutBody, ListMyPaymentsQueryParams, ListPaymentsQueryParams, RefundPaymentParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { requirePermission, PERMISSIONS } from "../lib/permissions";
import { razorpayGateway, verifyRazorpayWebhookSignature } from "../lib/payments/razorpay";
import { computeDiscountedAmount } from "./offers";
import { logAudit } from "../lib/audit";
import { notify } from "../lib/notifications";

const router = Router();

function formatPayment(p: typeof paymentsTable.$inferSelect) {
  return {
    id: p.id,
    payerType: p.payerType,
    planId: p.planId,
    offerId: p.offerId ?? null,
    amountInPaise: p.amountInPaise,
    currency: p.currency,
    status: p.status,
    gateway: p.gateway,
    gatewayOrderId: p.gatewayOrderId ?? null,
    gatewayPaymentId: p.gatewayPaymentId ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

function formatInvoice(i: typeof invoicesTable.$inferSelect) {
  return {
    id: i.id,
    paymentId: i.paymentId,
    invoiceNumber: i.invoiceNumber,
    amountInPaise: i.amountInPaise,
    currency: i.currency,
    issuedAt: i.issuedAt.toISOString(),
  };
}

// Authenticated: creates a Razorpay order for a plan purchase. The server ALWAYS computes the
// real amount from the plan (+ offer, if any) — never trusts a client-sent amount (gap #2's fix).
router.post("/payments/checkout", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { planId, offerCode } = parsed.data;

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId));
  if (!plan || !plan.isActive) {
    res.status(400).json({ error: "Plan not found or inactive" });
    return;
  }

  const payerType = req.user!.role === "institute_admin" ? "institute" : "student";
  if (plan.forInstitute && payerType !== "institute") {
    res.status(400).json({ error: "This plan is for institutes only" });
    return;
  }
  if (!plan.forInstitute && payerType === "institute") {
    res.status(400).json({ error: "Institute admins must choose an institute plan" });
    return;
  }

  let amountInPaise = plan.priceInPaise;
  let offerId: number | null = null;

  if (offerCode) {
    const [offer] = await db.select().from(offersTable).where(eq(offersTable.code, offerCode));
    const invalid =
      !offer || !offer.isActive ||
      (offer.planId !== null && offer.planId !== planId) ||
      (offer.expiresAt !== null && offer.expiresAt.getTime() < Date.now()) ||
      (offer.maxRedemptions !== null && offer.redemptionCount >= offer.maxRedemptions);

    if (invalid) {
      res.status(400).json({ error: "Offer code is invalid, expired, or exhausted" });
      return;
    }
    amountInPaise = computeDiscountedAmount(plan.priceInPaise, offer!.discountType, offer!.discountValue);
    offerId = offer!.id;
  }

  const [payment] = await db.insert(paymentsTable).values({
    userId: req.user!.userId,
    payerType,
    planId: plan.id,
    offerId,
    amountInPaise,
    currency: plan.currency,
    status: "pending",
    gateway: "razorpay",
  }).returning();

  try {
    const order = await razorpayGateway.createOrder(amountInPaise, plan.currency, `payment_${payment.id}`);
    await db.update(paymentsTable).set({ gatewayOrderId: order.orderId }).where(eq(paymentsTable.id, payment.id));

    res.status(201).json({
      paymentId: payment.id,
      gatewayOrderId: order.orderId,
      amount: amountInPaise,
      currency: plan.currency,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
    });
  } catch (err) {
    await db.update(paymentsTable).set({ status: "failed" }).where(eq(paymentsTable.id, payment.id));
    res.status(502).json({ error: "Failed to create payment order with gateway" });
  }
});

// Razorpay webhook receiver — verified by HMAC signature over the raw body, NOT by requireAuth
// (Razorpay's servers call this directly, they can't hold a user session token).
router.post("/payments/webhook", async (req, res): Promise<void> => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;

  if (typeof signature !== "string" || !rawBody || !verifyRazorpayWebhookSignature(rawBody.toString("utf-8"), signature)) {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  const body = req.body as {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
  };

  const isSuccessEvent = body.event === "payment.captured" || body.event === "order.paid";
  const orderId = body.payload?.payment?.entity?.order_id;
  const gatewayPaymentId = body.payload?.payment?.entity?.id;

  if (!isSuccessEvent || !orderId || !gatewayPaymentId) {
    // Not an event we act on (e.g. payment.failed) — acknowledge so Razorpay doesn't retry.
    res.sendStatus(200);
    return;
  }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.gatewayOrderId, orderId));
  if (!payment || payment.status === "success") {
    // Unknown order, or already processed — idempotent no-op, still acknowledge.
    res.sendStatus(200);
    return;
  }

  await db.transaction(async (tx) => {
    await tx.update(paymentsTable).set({
      status: "success",
      gatewayPaymentId,
      gatewaySignature: signature,
    }).where(eq(paymentsTable.id, payment.id));

    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(payment.id).padStart(6, "0")}`;
    await tx.insert(invoicesTable).values({
      paymentId: payment.id,
      userId: payment.userId,
      invoiceNumber,
      amountInPaise: payment.amountInPaise,
      currency: payment.currency,
    });

    const [plan] = await tx.select().from(plansTable).where(eq(plansTable.id, payment.planId));
    const durationDays = plan?.durationDays ?? 30;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const [existingSub] = await tx.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, payment.userId));
    if (existingSub) {
      await tx.update(subscriptionsTable).set({
        plan: plan?.forInstitute ? "institute" : "pro_student",
        planId: payment.planId,
        paymentId: payment.id,
        status: "active",
        startedAt: new Date(),
        expiresAt,
      }).where(eq(subscriptionsTable.userId, payment.userId));
    } else {
      await tx.insert(subscriptionsTable).values({
        userId: payment.userId,
        plan: plan?.forInstitute ? "institute" : "pro_student",
        planId: payment.planId,
        paymentId: payment.id,
        status: "active",
        startedAt: new Date(),
        expiresAt,
      });
    }

    if (payment.offerId) {
      await tx.update(offersTable)
        .set({ redemptionCount: sql`${offersTable.redemptionCount} + 1` })
        .where(eq(offersTable.id, payment.offerId));
    }

    const [payer] = await tx.select().from(usersTable).where(eq(usersTable.id, payment.userId));
    if (payer) {
      // Access starts the moment a real payment succeeds — never leave a paying user gated.
      await tx.update(usersTable).set({ accountStatus: "active" }).where(eq(usersTable.id, payer.id));

      if (payment.payerType === "institute" && payer.instituteId) {
        await tx.update(institutesTable).set({ accountStatus: "active" }).where(eq(institutesTable.id, payer.instituteId));
      }

      // Commission ALWAYS credits via referredByInstituteId, regardless of current instituteId —
      // per the USER HIERARCHY rules, this is independent of current membership.
      if (payment.payerType === "student" && payer.referredByInstituteId) {
        const [institute] = await tx.select().from(institutesTable).where(eq(institutesTable.id, payer.referredByInstituteId));
        if (institute) {
          const amount = institute.commissionType === "percent"
            ? Math.round(payment.amountInPaise * (institute.commissionRate / 100))
            : Math.round(institute.commissionRate);

          await tx.insert(commissionsTable).values({
            instituteId: institute.id,
            paymentId: payment.id,
            studentUserId: payer.id,
            amountInPaise: amount,
            commissionType: institute.commissionType,
            commissionRate: institute.commissionRate,
            status: "pending",
          });

          const [instituteAdmin] = await tx.select().from(usersTable)
            .where(and(eq(usersTable.instituteId, institute.id), eq(usersTable.role, "institute_admin")));
          if (instituteAdmin) {
            await notify(
              instituteAdmin.id,
              "commission_credited",
              "New commission credited",
              `You earned ₹${(amount / 100).toFixed(2)} commission from a referred student's payment.`,
              { paymentId: payment.id, amountInPaise: amount },
            );
          }
        }
      }
    }
  });

  const [paidUser] = await db.select().from(usersTable).where(eq(usersTable.id, payment.userId));
  if (paidUser) {
    await notify(
      paidUser.id,
      "payment_success",
      "Payment successful",
      `Your payment of ₹${(payment.amountInPaise / 100).toFixed(2)} was successful and your plan is now active.`,
      { paymentId: payment.id },
    );
  }

  res.sendStatus(200);
});

router.get("/payments/my", requireAuth, async (req, res): Promise<void> => {
  const params = ListMyPaymentsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { page = 1, limit = 20 } = params.data;
  const offset = (page - 1) * limit;

  const where = eq(paymentsTable.userId, req.user!.userId);
  const payments = await db.select().from(paymentsTable).where(where).limit(limit).offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(paymentsTable).where(where);

  res.json({ payments: payments.map(formatPayment), total, page, limit });
});

router.get("/payments", requireAuth, requirePermission(PERMISSIONS.MANAGE_PAYMENTS), async (req, res): Promise<void> => {
  const params = ListPaymentsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { userId, status, page = 1, limit = 20 } = params.data;
  const conditions: SQL[] = [];
  if (userId) conditions.push(eq(paymentsTable.userId, userId));
  if (status) conditions.push(eq(paymentsTable.status, status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const offset = (page - 1) * limit;
  const payments = await db.select().from(paymentsTable).where(where).limit(limit).offset(offset);
  const [{ value: total }] = await db.select({ value: count() }).from(paymentsTable).where(where);

  res.json({ payments: payments.map(formatPayment), total, page, limit });
});

router.post("/payments/:id/refund", requireAuth, requirePermission(PERMISSIONS.MANAGE_PAYMENTS), async (req, res): Promise<void> => {
  const parsedParams = RefundPaymentParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }

  const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, parsedParams.data.id));
  if (!payment || payment.status !== "success" || !payment.gatewayPaymentId) {
    res.status(400).json({ error: "Payment cannot be refunded" });
    return;
  }

  await razorpayGateway.refund(payment.gatewayPaymentId, payment.amountInPaise);
  const [updated] = await db.update(paymentsTable).set({ status: "refunded" }).where(eq(paymentsTable.id, payment.id)).returning();

  await logAudit(req.user!.userId, "refund_payment", "payment", payment.id, { amountInPaise: payment.amountInPaise });

  res.json(formatPayment(updated));
});

export default router;

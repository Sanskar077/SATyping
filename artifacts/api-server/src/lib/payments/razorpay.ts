import { createHmac, timingSafeEqual } from "crypto";
import type { PaymentGateway } from "./gateway";

/**
 * Razorpay gateway.
 *
 * ── Test (sandbox) vs production ──────────────────────────────────────────────
 * There is NO separate sandbox URL — https://api.razorpay.com/v1 serves both. The mode is
 * decided purely by which key pair you supply:
 *
 *   Test mode : RAZORPAY_KEY_ID starts with `rzp_test_`  → no real money moves
 *   Live mode : RAZORPAY_KEY_ID starts with `rzp_live_`  → real charges
 *
 * So "going to production" means swapping the three env vars below; no code change is needed.
 *
 *   RAZORPAY_KEY_ID         Dashboard → Account & Settings → API Keys
 *   RAZORPAY_KEY_SECRET     shown ONCE when the key is generated — store it immediately
 *   RAZORPAY_WEBHOOK_SECRET Dashboard → Settings → Webhooks, set when creating the webhook
 *
 * Test cards (test mode only): card 4111 1111 1111 1111, any future expiry, any CVV, OTP 1234.
 * Full list: https://razorpay.com/docs/payments/payments/test-card-details/
 *
 * ── Two different signature schemes (easy to confuse) ─────────────────────────
 *   verifySignature()                 HMAC(`order_id|payment_id`) with the KEY secret.
 *                                     Used by POST /api/payments/verify (browser callback).
 *   verifyRazorpayWebhookSignature()  HMAC(raw request body) with the WEBHOOK secret.
 *                                     Used by POST /api/payments/webhook (Razorpay's servers).
 * They use different secrets and different payloads; a value signed for one never validates
 * against the other (see __tests__/razorpay-signature.test.ts).
 */
const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function basicAuthHeader(): string {
  const keyId = requireEnv("RAZORPAY_KEY_ID");
  const keySecret = requireEnv("RAZORPAY_KEY_SECRET");
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export class RazorpayGateway implements PaymentGateway {
  async createOrder(amountInPaise: number, currency: string, receipt?: string): Promise<{ orderId: string }> {
    const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuthHeader(),
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Razorpay order creation failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { id: string };
    return { orderId: data.id };
  }

  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const keySecret = requireEnv("RAZORPAY_KEY_SECRET");
    const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    return safeCompare(expected, signature);
  }

  async refund(gatewayPaymentId: string, amountInPaise: number): Promise<{ refundId: string }> {
    const response = await fetch(`${RAZORPAY_API_BASE}/payments/${gatewayPaymentId}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuthHeader(),
      },
      body: JSON.stringify({ amount: amountInPaise }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Razorpay refund failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { id: string };
    return { refundId: data.id };
  }
}

/** Verifies a Razorpay webhook payload's x-razorpay-signature against RAZORPAY_WEBHOOK_SECRET.
 * Distinct scheme from checkout-completion signatures: HMAC over the RAW request body using the
 * webhook secret (not the key secret), so this stays a standalone helper rather than part of the
 * generic PaymentGateway interface. */
export function verifyRazorpayWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  const webhookSecret = requireEnv("RAZORPAY_WEBHOOK_SECRET");
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeCompare(expected, signatureHeader);
}

export const razorpayGateway = new RazorpayGateway();

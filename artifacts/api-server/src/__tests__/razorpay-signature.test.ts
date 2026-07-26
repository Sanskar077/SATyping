import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

/**
 * Razorpay signature verification.
 *
 * These two schemes are easy to conflate and a mix-up silently breaks payments:
 *   - checkout completion : HMAC(`order_id|payment_id`) keyed with RAZORPAY_KEY_SECRET
 *   - webhook             : HMAC(raw request body)      keyed with RAZORPAY_WEBHOOK_SECRET
 *
 * Verified here against independently computed HMACs, so a regression in either scheme fails
 * the suite rather than silently rejecting (or worse, accepting) real payments.
 */

const KEY_SECRET = "test_key_secret_abc123";
const WEBHOOK_SECRET = "test_webhook_secret_xyz789";

let razorpay: typeof import("../lib/payments/razorpay");

beforeEach(async () => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
  process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  // Import after the env is in place — the module reads secrets lazily per call, but this also
  // keeps each test independent of import order.
  razorpay = await import("../lib/payments/razorpay");
});

afterEach(() => {
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
});

const checkoutSignature = (orderId: string, paymentId: string, secret = KEY_SECRET) =>
  createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");

const webhookSignature = (body: string, secret = WEBHOOK_SECRET) =>
  createHmac("sha256", secret).update(body).digest("hex");

describe("checkout signature verification", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";

  it("accepts a correctly signed checkout result", () => {
    const signature = checkoutSignature(orderId, paymentId);
    expect(razorpay.razorpayGateway.verifySignature(orderId, paymentId, signature)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const signature = checkoutSignature(orderId, paymentId, "attacker_guess");
    expect(razorpay.razorpayGateway.verifySignature(orderId, paymentId, signature)).toBe(false);
  });

  it("rejects when the order id has been tampered with", () => {
    const signature = checkoutSignature(orderId, paymentId);
    expect(razorpay.razorpayGateway.verifySignature("order_TAMPERED", paymentId, signature)).toBe(false);
  });

  it("rejects when the payment id has been tampered with", () => {
    const signature = checkoutSignature(orderId, paymentId);
    expect(razorpay.razorpayGateway.verifySignature(orderId, "pay_TAMPERED", signature)).toBe(false);
  });

  it("rejects an empty or malformed signature instead of throwing", () => {
    expect(razorpay.razorpayGateway.verifySignature(orderId, paymentId, "")).toBe(false);
    expect(razorpay.razorpayGateway.verifySignature(orderId, paymentId, "not-hex")).toBe(false);
  });

  it("does not confuse the two secrets — a webhook-signed value must not pass", () => {
    const signature = checkoutSignature(orderId, paymentId, WEBHOOK_SECRET);
    expect(razorpay.razorpayGateway.verifySignature(orderId, paymentId, signature)).toBe(false);
  });
});

describe("webhook signature verification", () => {
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_XYZ789", order_id: "order_ABC123" } } },
  });

  it("accepts a correctly signed webhook body", () => {
    expect(razorpay.verifyRazorpayWebhookSignature(body, webhookSignature(body))).toBe(true);
  });

  it("rejects a body that was modified after signing", () => {
    const signature = webhookSignature(body);
    const tampered = body.replace("pay_XYZ789", "pay_ATTACKER");
    expect(razorpay.verifyRazorpayWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects a signature made with the checkout key secret", () => {
    expect(razorpay.verifyRazorpayWebhookSignature(body, webhookSignature(body, KEY_SECRET))).toBe(false);
  });

  it("is byte-exact — whitespace changes invalidate the signature", () => {
    // Why the raw body must be preserved rather than re-serialised from parsed JSON.
    const signature = webhookSignature(body);
    const reserialised = JSON.stringify(JSON.parse(body), null, 2);
    expect(razorpay.verifyRazorpayWebhookSignature(reserialised, signature)).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(razorpay.verifyRazorpayWebhookSignature(body, "")).toBe(false);
  });
});

describe("secret configuration", () => {
  it("throws a named error when the webhook secret is missing", () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    // Fails loudly rather than silently accepting/rejecting every webhook — an empty
    // RAZORPAY_WEBHOOK_SECRET is a misconfiguration, not a valid state.
    expect(() => razorpay.verifyRazorpayWebhookSignature("{}", "abc")).toThrow(/RAZORPAY_WEBHOOK_SECRET/);
  });

  it("throws a named error when the key secret is missing", () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    expect(() => razorpay.razorpayGateway.verifySignature("o", "p", "s")).toThrow(/RAZORPAY_KEY_SECRET/);
  });
});

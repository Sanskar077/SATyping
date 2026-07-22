/**
 * Minimal seam so a future gateway (Stripe, PhonePe, etc.) can be swapped in without touching
 * routes/payments.ts. Deliberately NOT a generic plugin registry — YAGNI until a second gateway
 * is actually needed.
 */
export interface PaymentGateway {
  /** Creates an order with the gateway and returns its order id, in the smallest currency unit. */
  createOrder(amountInPaise: number, currency: string, receipt?: string): Promise<{ orderId: string }>;

  /** Verifies the checkout-completion signature (order id + payment id) the client posts back. */
  verifySignature(orderId: string, paymentId: string, signature: string): boolean;

  /** Issues a refund for a captured payment. */
  refund(gatewayPaymentId: string, amountInPaise: number): Promise<{ refundId: string }>;
}

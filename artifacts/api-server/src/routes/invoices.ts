import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, invoicesTable } from "@workspace/db";
import { GetInvoiceParams } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { ROLES } from "../lib/roles";

const router = Router();

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

router.get("/invoices/my", requireAuth, async (req, res): Promise<void> => {
  const invoices = await db.select().from(invoicesTable).where(eq(invoicesTable.userId, req.user!.userId));
  res.json({ invoices: invoices.map(formatInvoice) });
});

router.get("/invoices/:id", requireAuth, async (req, res): Promise<void> => {
  const parsedParams = GetInvoiceParams.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ error: parsedParams.error.message });
    return;
  }

  const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, parsedParams.data.id));
  if (!invoice) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  if (invoice.userId !== req.user!.userId && req.user!.role !== ROLES.OWNER) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  res.json(formatInvoice(invoice));
});

export default router;

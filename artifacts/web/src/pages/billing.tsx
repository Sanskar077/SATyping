import { useListMyPayments, useListMyInvoices } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageLoading } from "@/components/page-loading";
import { Receipt } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  pending: "secondary",
  failed: "destructive",
  refunded: "outline",
};

export default function Billing() {
  const { data: paymentsData, isLoading: paymentsLoading } = useListMyPayments({ limit: 50 });
  const { data: invoicesData } = useListMyInvoices();

  const payments = paymentsData?.payments ?? [];
  const invoices = invoicesData?.invoices ?? [];
  const invoiceByPaymentId = new Map(invoices.map((inv) => [inv.paymentId, inv]));

  return (
    <div className="space-y-6" data-testid="billing-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1">Your payment history and invoices</p>
      </div>

      {paymentsLoading ? (
        <PageLoading label="Loading payments..." />
      ) : payments.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No payments yet.</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => {
                const invoice = invoiceByPaymentId.get(p.id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="font-medium">₹{(p.amountInPaise / 100).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[p.status] ?? "secondary"} className="capitalize text-xs">
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {invoice ? invoice.invoiceNumber : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

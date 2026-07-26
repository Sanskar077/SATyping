import { useListPayments, useRefundPayment, getListPaymentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoading } from "@/components/page-loading";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  pending: "secondary",
  failed: "destructive",
  refunded: "outline",
};

export default function AdminPayments() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = { page: 1, limit: 50, ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}) };
  const { data, isLoading } = useListPayments(params);
  const refundPayment = useRefundPayment();

  const payments = data?.payments ?? [];

  const handleRefund = (id: number) => {
    refundPayment.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPaymentsQueryKey() });
        toast({ title: "Payment refunded" });
      },
      onError: (err: any) => toast({ title: err?.data?.error || "Refund failed", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-payments-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground mt-1">All payments across the platform</p>
      </div>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="success">Success</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="refunded">Refunded</SelectItem>
        </SelectContent>
      </Select>

      {isLoading ? (
        <PageLoading label="Loading payments..." />
      ) : payments.length === 0 ? (
        <div className="text-center py-16">
          <CreditCard className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No payments yet.</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-sm">#{p.id}</TableCell>
                  <TableCell className="font-medium">₹{(p.amountInPaise / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status] ?? "secondary"} className="capitalize text-xs">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.status === "success" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" disabled={refundPayment.isPending}>Refund</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Refund this payment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will refund ₹{(p.amountInPaise / 100).toFixed(2)} via Razorpay and mark the
                              payment as refunded. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRefund(p.id)}>Refund</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

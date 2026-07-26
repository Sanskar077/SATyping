import { useListCommissions, useUpdateCommissionStatus, getListCommissionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoading } from "@/components/page-loading";
import { Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  paid: "default",
  approved: "secondary",
  pending: "outline",
};

export default function AdminCommissions() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = { page: 1, limit: 50, ...(statusFilter && statusFilter !== "all" ? { status: statusFilter } : {}) };
  const { data, isLoading } = useListCommissions(params);
  const updateStatus = useUpdateCommissionStatus();

  const commissions = data?.commissions ?? [];

  const nextStatus: Record<string, string> = { pending: "approved", approved: "paid" };

  const advance = (id: number, current: string) => {
    const next = nextStatus[current];
    if (!next) return;
    updateStatus.mutate({ id, data: { status: next as "approved" | "paid" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCommissionsQueryKey() });
        toast({ title: `Commission marked as ${next}` });
      },
      onError: () => toast({ title: "Failed to update commission", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-commissions-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Commissions</h1>
        <p className="text-muted-foreground mt-1">Institute referral commissions across the platform</p>
      </div>

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
        </SelectContent>
      </Select>

      {isLoading ? (
        <PageLoading label="Loading commissions..." />
      ) : commissions.length === 0 ? (
        <div className="text-center py-16">
          <Wallet className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No commissions yet.</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Institute</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-sm">#{c.instituteId}</TableCell>
                  <TableCell className="font-medium">₹{(c.amountInPaise / 100).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[c.status] ?? "outline"} className="capitalize text-xs">
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {nextStatus[c.status] && (
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => advance(c.id, c.status)}
                        disabled={updateStatus.isPending}
                      >
                        Mark as {nextStatus[c.status]}
                      </button>
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

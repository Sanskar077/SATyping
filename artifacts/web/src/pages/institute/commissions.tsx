import { useListMyCommissions } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageLoading } from "@/components/page-loading";
import { Wallet } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  paid: "default",
  approved: "secondary",
  pending: "outline",
};

export default function InstituteCommissions() {
  const { data, isLoading } = useListMyCommissions({ limit: 50 });
  const commissions = data?.commissions ?? [];

  const totalPending = commissions.filter((c) => c.status === "pending").reduce((sum, c) => sum + c.amountInPaise, 0);
  const totalPaid = commissions.filter((c) => c.status === "paid").reduce((sum, c) => sum + c.amountInPaise, 0);

  return (
    <div className="space-y-6" data-testid="institute-commissions-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Commissions</h1>
        <p className="text-muted-foreground mt-1">Earnings from students you've referred</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold mt-1">₹{(totalPending / 100).toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Paid out</p>
          <p className="text-2xl font-bold mt-1">₹{(totalPaid / 100).toFixed(2)}</p>
        </Card>
      </div>

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
                <TableHead>Amount</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="font-medium">₹{(c.amountInPaise / 100).toFixed(2)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.commissionType === "percent" ? `${c.commissionRate}%` : `₹${c.commissionRate} flat`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[c.status] ?? "outline"} className="capitalize text-xs">
                      {c.status}
                    </Badge>
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

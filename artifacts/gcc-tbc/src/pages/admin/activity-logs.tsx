import { useListAuditLogs, useListLoginLogs } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollText, ShieldCheck } from "lucide-react";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminActivityLogs() {
  const { data: auditData, isLoading: auditLoading } = useListAuditLogs({ limit: 50 });
  const { data: loginData, isLoading: loginLoading } = useListLoginLogs({ limit: 50 });

  const auditLogs = auditData?.logs ?? [];
  const loginLogs = loginData?.logs ?? [];

  return (
    <div className="space-y-6" data-testid="admin-activity-logs-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground mt-1">Owner mutations and login history across the platform</p>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="logins">Login History</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="mt-6">
          {auditLoading ? (
            <div className="text-center py-16 text-muted-foreground">Loading audit log...</div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-16">
              <ScrollText className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No audit log entries yet.</p>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(l.createdAt)}</TableCell>
                      <TableCell className="text-sm">User #{l.userId}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{l.action}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {l.targetType}{l.targetId ? ` #${l.targetId}` : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logins" className="mt-6">
          {loginLoading ? (
            <div className="text-center py-16 text-muted-foreground">Loading login history...</div>
          ) : loginLogs.length === 0 ? (
            <div className="text-center py-16">
              <ShieldCheck className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">No login attempts yet.</p>
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(l.createdAt)}</TableCell>
                      <TableCell className="text-sm">{l.email}</TableCell>
                      <TableCell>
                        <Badge variant={l.success ? "default" : "destructive"} className="text-xs">
                          {l.success ? "Success" : "Failed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono">{l.ipAddress ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

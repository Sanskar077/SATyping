import { useListUsers, useUpdateUser, useSetUserPremium, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoading } from "@/components/page-loading";
import { Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = {
    page: 1,
    limit: 50,
    ...(roleFilter && roleFilter !== "all" ? { role: roleFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading } = useListUsers(params as Parameters<typeof useListUsers>[0], {
    query: { queryKey: getListUsersQueryKey(params as Parameters<typeof useListUsers>[0]) },
  });

  const updateUser = useUpdateUser();
  const setPremium = useSetUserPremium();

  const handlePremiumToggle = (userId: number, premium: boolean) => {
    setPremium.mutate({ id: userId, data: { premium } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: premium ? "Premium granted" : "Premium revoked" });
      },
      onError: () => toast({ title: "Failed to update Premium status", variant: "destructive" }),
    });
  };

  const handleRoleChange = (userId: number, newRole: string) => {
    updateUser.mutate({ id: userId, data: { role: newRole } as Parameters<typeof updateUser.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "User role updated" });
      },
      onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
    });
  };

  const roleColors: Record<string, string> = {
    student: "secondary",
    teacher: "default",
    institute_admin: "default",
    super_admin: "default",
  };

  return (
    <div className="space-y-6" data-testid="admin-users-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-1">Manage all platform users</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="institute_admin">Institute Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageLoading label="Loading users..." />
      ) : !data?.users.length ? (
        <div className="text-center py-16">
          <Users className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No users found.</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Premium (Manual)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(val) => handleRoleChange(u.id, val)}
                    >
                      <SelectTrigger className="h-7 w-36 text-xs" data-testid={`select-role-${u.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                        <SelectItem value="institute_admin">Institute Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">{u.subscriptionPlan}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? "default" : "secondary"} className="text-xs">
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.hasAccess ? "default" : "outline"} className="text-xs">
                      {u.hasAccess ? "Has access" : "No access"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.role === "super_admin" ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.premiumGrantedByOwner}
                          onCheckedChange={(checked) => handlePremiumToggle(u.id, checked)}
                          disabled={setPremium.isPending}
                          data-testid={`switch-premium-${u.id}`}
                        />
                        <span className="text-xs text-muted-foreground">
                          {u.premiumGrantedByOwner ? "Premium" : "Normal"}
                        </span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        Showing {data?.users.length ?? 0} of {data?.total ?? 0} users
      </p>
    </div>
  );
}

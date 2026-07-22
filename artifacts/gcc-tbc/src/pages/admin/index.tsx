import { useListInstitutes, useListUsers } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Shield, BookOpen, Upload, Package, Tag, CreditCard, Wallet, ScrollText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const { data: institutesData } = useListInstitutes();
  const { data: usersData } = useListUsers({ page: 1, limit: 1 });

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Super Admin</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">Manage institutes, users, and platform settings.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{institutesData?.institutes.length ?? "—"}</p>
              <p className="text-sm text-muted-foreground">Institutes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{usersData?.total ?? "—"}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Institutes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View and manage all registered typing institutes on the platform.
            </p>
            <Button asChild>
              <Link href="/admin/institutes">Manage Institutes</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View all users, manage roles, and handle account issues.
            </p>
            <Button asChild>
              <Link href="/admin/users">Manage Users</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Passages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Manage the global passage library for English, Hindi, and Marathi.
            </p>
            <Button variant="outline" asChild>
              <Link href="/passages">Manage Passages</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Bulk Import
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Import passages in bulk from CSV or JSON. Validate before import.
            </p>
            <Button asChild>
              <Link href="/admin/bulk-import">Open Bulk Import</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Manage pricing plans for students and institutes.
            </p>
            <Button asChild>
              <Link href="/admin/plans">Manage Plans</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              Offers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create and manage discount codes used at checkout.
            </p>
            <Button variant="outline" asChild>
              <Link href="/admin/offers">Manage Offers</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View all payments across the platform and process refunds.
            </p>
            <Button variant="outline" asChild>
              <Link href="/admin/payments">View Payments</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Review and pay out institute referral commissions.
            </p>
            <Button variant="outline" asChild>
              <Link href="/admin/commissions">Manage Commissions</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Revenue, student growth, and plan distribution at a glance.
            </p>
            <Button asChild>
              <Link href="/admin/analytics">View Analytics</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-primary" />
              Activity Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Audit trail of Owner actions and login history.
            </p>
            <Button variant="outline" asChild>
              <Link href="/admin/activity-logs">View Activity Logs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

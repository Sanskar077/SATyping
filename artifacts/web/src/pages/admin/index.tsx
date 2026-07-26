import {
  useListInstitutes, useListUsers, useListPayments, useListSubscriptions,
  useGetAnalyticsOverview,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield, Building2, Users, IndianRupee, CreditCard, BadgeCheck,
  Upload, Package, Tag, Wallet, BarChart3, ScrollText, BookOpen, ArrowRight, Clock,
} from "lucide-react";

const QUICK_LINKS = [
  { href: "/admin/users",         label: "Users",         icon: Users },
  { href: "/admin/institutes",    label: "Institutes",    icon: Building2 },
  { href: "/passages",            label: "Passages",      icon: BookOpen },
  { href: "/admin/bulk-import",   label: "Bulk Import",   icon: Upload },
  { href: "/admin/plans",         label: "Plans",         icon: Package },
  { href: "/admin/offers",        label: "Offers",        icon: Tag },
  { href: "/admin/payments",      label: "Payments",      icon: CreditCard },
  { href: "/admin/commissions",   label: "Commissions",   icon: Wallet },
  { href: "/admin/analytics",     label: "Analytics",     icon: BarChart3 },
  { href: "/admin/activity-logs", label: "Activity Logs", icon: ScrollText },
];

function formatMoney(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function AdminDashboard() {
  const { data: analytics } = useGetAnalyticsOverview();
  const { data: institutesData } = useListInstitutes();
  const { data: usersData } = useListUsers({ page: 1, limit: 5 });
  const { data: paymentsData } = useListPayments({ page: 1, limit: 5 });
  const { data: subscriptionsData } = useListSubscriptions({ page: 1, limit: 1 });

  const institutes = institutesData?.institutes ?? [];
  // Newly-registered institutes await Owner approval as "inactive" (there is no separate
  // "pending" status); "suspended" ones were explicitly disabled, so exclude them here.
  const pendingInstitutes = institutes.filter((i) => i.accountStatus === "inactive");
  const recentPayments = paymentsData?.payments ?? [];
  const recentSignups = usersData?.users ?? [];

  const stats = [
    {
      label: "Total Revenue",
      value: analytics ? formatMoney(analytics.totalRevenueInPaise) : "—",
      icon: IndianRupee,
    },
    {
      label: "Subscriptions",
      value: subscriptionsData ? String(subscriptionsData.total) : "—",
      icon: BadgeCheck,
    },
    {
      label: "Institutes",
      value: analytics ? `${analytics.activeInstitutes} / ${analytics.totalInstitutes}` : "—",
      sub: "active / total",
      icon: Building2,
    },
    {
      label: "Total Users",
      value: usersData ? String(usersData.total) : "—",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Super Admin</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-muted-foreground mt-1">Run the business — approvals, revenue, and management at a glance.</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
                {s.sub && <p className="text-[11px] text-muted-foreground">{s.sub}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending institute approvals */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Pending Institute Approvals
            {pendingInstitutes.length > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingInstitutes.length}</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/institutes">Manage <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pendingInstitutes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No institutes are waiting for approval.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pendingInstitutes.slice(0, 5).map((inst) => (
                <li key={inst.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inst.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{inst.email}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/admin/institutes">Review</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent payments */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Recent Payments
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/payments">All <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{formatMoney(p.amountInPaise)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{p.payerType} · {formatDate(p.createdAt)}</p>
                    </div>
                    <Badge
                      variant={p.status === "success" ? "default" : p.status === "failed" ? "destructive" : "secondary"}
                      className="capitalize text-xs"
                    >
                      {p.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent signups */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Recent Signups
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/users">All <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentSignups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentSignups.map((u) => (
                  <li key={u.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">{u.role.replace("_", " ")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="glass glass-interactive flex flex-col items-center gap-2 rounded-xl border p-4 text-center"
              >
                <l.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">{l.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

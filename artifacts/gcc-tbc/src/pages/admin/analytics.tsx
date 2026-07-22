import { useGetAnalyticsOverview } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { IndianRupee, Users, Building2, Clock } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro_student: "Pro Student",
  institute: "Institute",
};

export default function AdminAnalytics() {
  const { data, isLoading } = useGetAnalyticsOverview();

  if (isLoading || !data) {
    return <div className="text-center py-20 text-muted-foreground">Loading analytics...</div>;
  }

  const chartData = data.revenueByMonth.map((p) => ({ month: p.month, revenue: p.revenueInPaise / 100 }));

  const cards = [
    { label: "Total Revenue", value: `₹${(data.totalRevenueInPaise / 100).toLocaleString("en-IN")}`, icon: IndianRupee },
    { label: "Students", value: `${data.totalStudents} (${data.independentStudents} independent)`, icon: Users },
    { label: "Institutes", value: `${data.activeInstitutes} / ${data.totalInstitutes} active`, icon: Building2 },
    { label: "Inactive Accounts", value: String(data.inactiveAccounts), icon: Clock },
  ];

  return (
    <div className="space-y-6" data-testid="admin-analytics-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Platform-wide performance at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-lg font-bold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue — last 6 months</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {data.planDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {data.planDistribution.map((p) => (
                <Badge key={p.plan} variant="outline" className="text-sm px-3 py-1.5">
                  {PLAN_LABELS[p.plan] ?? p.plan}: <span className="font-bold ml-1">{p.count}</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

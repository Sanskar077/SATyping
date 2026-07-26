import { useGetDashboardStats, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Target, Trophy, Clock, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PersonalBestWidget } from "@/components/personal-best-widget";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { GettingStarted } from "@/components/getting-started";
import { useAuth } from "@/context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useGetDashboardStats({
    query: {
      queryKey: getGetDashboardStatsQueryKey(),
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-10"></CardHeader>
              <CardContent className="h-20"></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Brand-new account: no completed sessions AND no test attempts. A stats grid of zeros right
  // after someone paid reads as "nothing works" — show the guided path in instead. The moment
  // their first session completes, the normal dashboard takes over for good.
  const hasActivity =
    (stats?.totalPracticeSessions ?? 0) > 0 || (stats?.totalTestAttempts ?? 0) > 0;

  if (stats && !hasActivity) {
    return (
      <div className="space-y-6">
        <EmailVerificationBanner emailVerified={user?.emailVerified} />
        <GettingStarted userName={user?.name} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <EmailVerificationBanner emailVerified={user?.emailVerified} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your typing performance.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/practice/drills">Speed Drills</Link>
          </Button>
          <Button asChild>
            <Link href="/practice">Practice Now</Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-rise">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best WPM</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold stat-pop">{stats?.bestNetWpm || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Highest net words per minute</p>
          </CardContent>
        </Card>
        
        <Card className="glass-rise">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Accuracy</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold stat-pop">{stats?.avgAccuracy ? `${stats.avgAccuracy.toFixed(1)}%` : '0%'}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all sessions</p>
          </CardContent>
        </Card>

        <Card className="glass-rise">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Practice Sessions</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold stat-pop">{stats?.totalPracticeSessions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed sessions</p>
          </CardContent>
        </Card>

        <Card className="glass-rise">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Test Pass Rate</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold stat-pop">{stats?.passRate ? `${stats.passRate.toFixed(0)}%` : '0%'}</div>
            <p className="text-xs text-muted-foreground mt-1">Of all test attempts</p>
          </CardContent>
        </Card>
      </div>

      {/* Feature 6: Personal Best Widget */}
      <PersonalBestWidget />

      {/* WPM Progress Chart */}
      {stats?.wpmProgress && stats.wpmProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">WPM Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.wpmProgress}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                />
                <Line type="monotone" dataKey="wpm" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* By Language */}
      {stats?.byLanguage && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Performance by Language</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.byLanguage.map((lang) => (
              <Card key={lang.language} className={lang.sessionCount === 0 ? "opacity-50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium capitalize">{lang.language}</span>
                    <span className="text-xs text-muted-foreground">{lang.sessionCount} sessions</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg WPM</span>
                      <span className="font-mono font-bold">{Math.round(lang.avgWpm)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg Accuracy</span>
                      <span className="font-mono">{Math.round(lang.avgAccuracy)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { href: "/practice",       label: "Free Practice",    sub: "Choose any passage" },
            { href: "/practice/drills", label: "Speed Drills",    sub: "Timed tier practice" },
            { href: "/curriculum",     label: "Curriculum",       sub: "Structured lessons" },
            { href: "/exams",          label: "Take an Exam",     sub: "Official test mode" },
          ].map(({ href, label, sub }) => (
            <Link key={href} href={href}>
              <Card className="glass-interactive cursor-pointer h-full">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Results */}
      {stats?.recentResults && stats.recentResults.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recent Results</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/results">View All <ChevronRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>
          <div className="space-y-2">
            {stats.recentResults.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{r.testName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()} · {r.language}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-mono font-bold">{Math.round(r.netWpm)} WPM</p>
                      <p className="text-xs text-muted-foreground">{Math.round(r.accuracy)}% acc</p>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/results/${r.id}`}><ChevronRight className="h-4 w-4" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

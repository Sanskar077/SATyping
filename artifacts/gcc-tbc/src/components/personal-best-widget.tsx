/**
 * Feature 6: Personal Best Tracker Dashboard Widget
 * Shows key personal records with trend indicators.
 */
import { useGetPersonalBests, getGetPersonalBestsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Target, Clock, Zap, Award, Flame } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function StatCell({ icon, label, value, sub, highlight = false }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-primary/10 border border-primary/20" : "bg-muted/30"}`}>
      <div className={`flex items-center gap-1.5 mb-1.5 ${highlight ? "text-primary" : "text-muted-foreground"}`}>
        <span className="h-4 w-4">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold font-mono ${highlight ? "text-primary" : ""}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function PersonalBestWidget() {
  const { data, isLoading } = useGetPersonalBests({
    query: { queryKey: getGetPersonalBestsQueryKey(), staleTime: 60_000 },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" /> Personal Bests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const weeklyImprovement = data.weeklyBest != null && data.monthlyBest != null
    ? data.weeklyBest - data.monthlyBest
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" /> Personal Bests
          {data.longestStreak > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs font-normal text-orange-500">
              <Flame className="h-3 w-3" />
              {data.longestStreak}-day streak
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCell
            icon={<Zap className="h-4 w-4" />}
            label="Best WPM"
            value={Math.round(data.highestWpm)}
            sub="All time net WPM"
            highlight
          />
          <StatCell
            icon={<Target className="h-4 w-4" />}
            label="Best Accuracy"
            value={`${Math.round(data.highestAccuracy)}%`}
            sub="All time accuracy"
          />
          <StatCell
            icon={<Clock className="h-4 w-4" />}
            label="Practice Time"
            value={`${data.totalPracticeMinutes}m`}
            sub="Total minutes"
          />
          <StatCell
            icon={<Award className="h-4 w-4" />}
            label="Tests Passed"
            value={data.totalCompletedTests}
            sub="Completed exams"
          />
          {data.weeklyBest != null && (
            <StatCell
              icon={<TrendingUp className="h-4 w-4" />}
              label="This Week"
              value={Math.round(data.weeklyBest)}
              sub={weeklyImprovement != null
                ? weeklyImprovement > 0
                  ? `↑ ${Math.round(weeklyImprovement)} from last month`
                  : weeklyImprovement < 0
                    ? `↓ ${Math.round(Math.abs(weeklyImprovement))} from last month`
                    : "Same as last month"
                : "Weekly best WPM"}
            />
          )}
          {(data.fastestImprovement ?? 0) > 0 && (
            <StatCell
              icon={<TrendingUp className="h-4 w-4" />}
              label="Best Jump"
              value={`+${Math.round(data.fastestImprovement ?? 0)}`}
              sub="WPM in one session"
            />
          )}
        </div>

        {/* Per-language breakdown */}
        {data.byLanguage && data.byLanguage.some(l => l.sessionCount > 0) && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">By Language</p>
            <div className="grid grid-cols-3 gap-2">
              {data.byLanguage.filter(l => l.sessionCount > 0).map(lang => (
                <div key={lang.language} className="rounded-lg bg-muted/20 p-2 text-center">
                  <p className="text-xs font-medium capitalize">{lang.language}</p>
                  <p className="text-base font-bold font-mono">{Math.round(lang.avgWpm)}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(lang.avgAccuracy)}% acc</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Result Detail — enhanced with Feature 2: Error analysis stats breakdown.
 */
import { useParams, Link } from "wouter";
import { useGetResult, getGetResultQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle, XCircle, Clock, Zap, Target, AlertTriangle } from "lucide-react";

export default function ResultDetail() {
  const { id } = useParams<{ id: string }>();
  const resultId = parseInt(id, 10);

  const { data: result, isLoading } = useGetResult(resultId, {
    query: { enabled: !!resultId, queryKey: getGetResultQueryKey(resultId) },
  });

  const langLabel: Record<string, string> = {
    english: "English", hindi: "Hindi", marathi: "Marathi",
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Result not found.</p>
        <Button asChild className="mt-4"><Link href="/results">Back to Results</Link></Button>
      </div>
    );
  }

  const dur = result.durationSeconds ?? 0;
  const totalChars = result.totalChars ?? 0;
  const errorRate = totalChars > 0
    ? Math.round(((result.incorrectChars ?? 0) / totalChars) * 100)
    : 0;
  const accuracyPct = Math.round(result.accuracy);
  const wrongWords  = result.wrongWords ?? 0;

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/results"><ArrowLeft className="mr-2 h-4 w-4" />Back to Results</Link>
      </Button>

      {/* Pass / Fail banner */}
      <div className={`rounded-xl border p-6 ${result.passed
        ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/10"
        : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/10"}`}>
        <div className="flex items-center gap-3">
          {result.passed
            ? <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            : <XCircle     className="h-8 w-8 text-red-600 dark:text-red-400" />}
          <div>
            <h2 className="text-xl font-bold">{result.passed ? "Passed!" : "Not Passed"}</h2>
            <p className="text-sm text-muted-foreground">
              {result.testName} — {(result.language && langLabel[result.language]) ?? result.language}
            </p>
          </div>
          <Badge variant={result.passed ? "default" : "destructive"} className="ml-auto">
            {result.passed ? "PASS" : "FAIL"}
          </Badge>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: <Zap className="h-5 w-5" />,             label: "Net WPM",   value: `${Math.round(result.netWpm)}`,      mono: true  },
          { icon: <Target className="h-5 w-5" />,          label: "Accuracy",  value: `${accuracyPct}%`,                   mono: true  },
          { icon: <Zap className="h-5 w-5 opacity-50" />,  label: "Gross WPM", value: `${Math.round(result.grossWpm)}`,    mono: true  },
          { icon: <Clock className="h-5 w-5" />,           label: "Duration",  value: `${Math.floor(dur/60)}m ${dur%60}s`, mono: false },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-2 text-primary">{s.icon}</div>
              <p className={`text-2xl font-bold ${s.mono ? "font-mono" : ""}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Character analysis */}
      <Card>
        <CardHeader><CardTitle className="text-base">Character Analysis</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
          {[
            { value: totalChars,                   label: "Total Chars",  color: "" },
            { value: result.correctChars,          label: "Correct",      color: "text-green-600" },
            { value: result.incorrectChars ?? 0,   label: "Incorrect",    color: "text-red-500" },
            { value: result.backspaceCount ?? 0,   label: "Backspaces",   color: "text-orange-500" },
          ].map(({ value, label, color }) => (
            <div key={label}>
              <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Feature 2: Error Word Analysis (stats-based — no passage text in API response) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Error Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xl font-bold font-mono text-red-500">{wrongWords}</p>
              <p className="text-xs text-muted-foreground">Wrong Words</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xl font-bold font-mono text-orange-500">{errorRate}%</p>
              <p className="text-xs text-muted-foreground">Error Rate</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xl font-bold font-mono text-green-600">{accuracyPct}%</p>
              <p className="text-xs text-muted-foreground">Accuracy</p>
            </div>
          </div>

          {/* Visual accuracy bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Accuracy breakdown</span>
              <span>{accuracyPct}% correct · {errorRate}% errors</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-muted flex">
              <div
                className="bg-green-500 h-full transition-all"
                style={{ width: `${accuracyPct}%` }}
              />
              <div
                className="bg-red-400 h-full transition-all"
                style={{ width: `${errorRate}%` }}
              />
            </div>
          </div>

          {/* WPM speed category context */}
          {result.speedCategory != null && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium mb-1">Speed Category: {result.speedCategory} WPM</p>
              <p className="text-muted-foreground">
                You typed at <span className="font-mono font-medium text-foreground">{Math.round(result.netWpm)}</span> net WPM
                {result.netWpm >= result.speedCategory
                  ? <span className="text-green-600"> — exceeded the category target!</span>
                  : <span className="text-orange-500"> — {Math.round(result.speedCategory - result.netWpm)} WPM below target.</span>}
              </p>
            </div>
          )}

          {/* Tip for practice */}
          {!result.passed && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm">
              <p className="font-medium mb-1">💡 Improvement Tips</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                {wrongWords > 5 && <li>• You had {wrongWords} wrong words — focus on accuracy before speed.</li>}
                {(result.backspaceCount ?? 0) > 10 && <li>• {result.backspaceCount} backspaces used — try to type slowly and correctly rather than correcting.</li>}
                {result.speedCategory != null && result.netWpm < result.speedCategory - 5 && <li>• Drill with the {result.speedCategory} WPM tier in <a href="/practice/drills" className="underline text-primary">Speed Drills</a>.</li>}
                <li>• Use the <a href="/curriculum" className="underline text-primary">Curriculum</a> to strengthen weak key areas.</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" asChild>
          <Link href="/results">All Results</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/practice/drills">Speed Drills</Link>
        </Button>
        <Button asChild>
          <Link href="/exams">Try Another Exam</Link>
        </Button>
      </div>
    </div>
  );
}

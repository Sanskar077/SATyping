import { useGetResult, useGenerateCertificate, getGetResultQueryKey, getListCertificatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Award, CheckCircle, XCircle, Clock, Zap, Target, Type, Delete } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResultDetail() {
  const { id } = useParams<{ id: string }>();
  const resultId = parseInt(id, 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: result, isLoading } = useGetResult(resultId, {
    query: { enabled: !!resultId, queryKey: getGetResultQueryKey(resultId) },
  });

  const generateCert = useGenerateCertificate();

  const handleGenerateCert = () => {
    generateCert.mutate({ data: { resultId } }, {
      onSuccess: (cert) => {
        queryClient.invalidateQueries({ queryKey: getListCertificatesQueryKey() });
        toast({ title: "Certificate generated!", description: cert.certificateNumber });
      },
      onError: () => toast({ title: "Failed to generate certificate", variant: "destructive" }),
    });
  };

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

  return (
    <div className="max-w-2xl space-y-6" data-testid="result-detail-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/results"><ArrowLeft className="mr-2 h-4 w-4" />Back to Results</Link>
        </Button>
      </div>

      <div className={`rounded-xl border p-6 ${result.passed ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/10" : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/10"}`}>
        <div className="flex items-center gap-3">
          {result.passed ? (
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          ) : (
            <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          )}
          <div>
            <h2 className="text-xl font-bold">{result.passed ? "Passed!" : "Not Passed"}</h2>
            <p className="text-sm text-muted-foreground">{result.testName} — {langLabel[result.language] ?? result.language}</p>
          </div>
          <Badge variant={result.passed ? "default" : "destructive"} className="ml-auto">
            {result.passed ? "PASS" : "FAIL"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: <Zap className="h-5 w-5" />, label: "Net WPM", value: `${Math.round(result.netWpm)}`, mono: true },
          { icon: <Target className="h-5 w-5" />, label: "Accuracy", value: `${Math.round(result.accuracy)}%`, mono: true },
          { icon: <Zap className="h-5 w-5 opacity-50" />, label: "Gross WPM", value: `${Math.round(result.grossWpm)}`, mono: true },
          { icon: <Clock className="h-5 w-5" />, label: "Duration", value: `${Math.round(result.durationSeconds / 60)}m ${result.durationSeconds % 60}s`, mono: false },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-2 text-primary">{stat.icon}</div>
              <p className={`text-2xl font-bold ${stat.mono ? "font-mono" : ""}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Character Analysis</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
          <div>
            <p className="text-2xl font-bold font-mono">{result.totalChars}</p>
            <p className="text-xs text-muted-foreground">Total Chars</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-green-600">{result.correctChars}</p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-red-500">{result.incorrectChars}</p>
            <p className="text-xs text-muted-foreground">Incorrect</p>
          </div>
          <div>
            <p className="text-2xl font-bold font-mono text-orange-500">{result.backspaceCount}</p>
            <p className="text-xs text-muted-foreground">Backspaces</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {result.passed && !result.certificateId && (
          <Button onClick={handleGenerateCert} disabled={generateCert.isPending}>
            <Award className="mr-2 h-4 w-4" />
            {generateCert.isPending ? "Generating..." : "Get Certificate"}
          </Button>
        )}
        {result.certificateId && (
          <Button variant="outline" asChild>
            <Link href={`/certificates/${result.certificateId}`}>
              <Award className="mr-2 h-4 w-4" />
              View Certificate
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/exams">Try Another Exam</Link>
        </Button>
      </div>
    </div>
  );
}

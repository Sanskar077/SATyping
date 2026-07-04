import { useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetTestAttempt,
  getGetTestAttemptQueryKey,
  useSubmitTestAttempt,
  useCreateTestAttempt,
  TestAttemptSubmitStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTypingEngine, type TypingStats } from "@/hooks/use-typing-engine";
import { TypingArea } from "@/components/typing-area";

export default function ExamSession() {
  const { testId } = useParams();
  const id = parseInt(testId ?? "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [attemptId, setAttemptId]   = useState<number | null>(null);
  const [examReady, setExamReady]   = useState(false);
  const [durationSec, setDurationSec] = useState(300);

  const createAttempt = useCreateTestAttempt();
  const submitAttempt = useSubmitTestAttempt();

  const { data: attempt, isLoading } = useGetTestAttempt(attemptId ?? 0, {
    query: { enabled: !!attemptId, queryKey: getGetTestAttemptQueryKey(attemptId ?? 0) },
  });

  const passageText = attempt?.passage?.content ?? "";
  const passageLanguage = attempt?.passage?.language ?? "marathi";

  const handleComplete = useCallback(
    (s: TypingStats, elapsed: number) => {
      if (!attemptId) return;
      submitAttempt.mutate(
        {
          id: attemptId,
          data: {
            status: elapsed >= durationSec
              ? TestAttemptSubmitStatus.timed_out
              : TestAttemptSubmitStatus.completed,
            grossWpm: s.grossWpm, netWpm: s.wpm, accuracy: s.accuracy,
            totalChars: s.totalTyped, correctChars: s.correctChars,
            incorrectChars: s.incorrectChars, durationSeconds: elapsed,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Exam submitted", description: "Results recorded." });
            setLocation("/results");
          },
          onError: () => toast({ title: "Submit failed", variant: "destructive" }),
        }
      );
    },
    [attemptId, durationSec, submitAttempt, setLocation, toast]
  );

  const engine = useTypingEngine({
    language: passageLanguage,
    passageText,
    durationSeconds: examReady ? durationSec : undefined,
    onComplete: handleComplete,
  });

  const timeLeft   = Math.max(0, durationSec - engine.elapsedSeconds);
  const isLowTime  = timeLeft <= 60 && examReady && !engine.isCompleted;

  // ── Pre-start ─────────────────────────────────────────────────────────
  if (!examReady) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card>
          <CardHeader>
            <CardTitle>Start Exam</CardTitle>
            <CardDescription>Read before you begin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="bg-muted rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <ul className="text-sm text-muted-foreground list-disc pl-3 space-y-1">
                <li>Timer starts immediately when you click Start.</li>
                <li>Do not refresh the page during the exam.</li>
                <li>Backspace removes the last full character (entire akshara for Marathi).</li>
                <li>For Marathi (ISM): activate your ISM layout before clicking Start.</li>
                <li>Click anywhere on the passage area to keep the input focused.</li>
              </ul>
            </div>
            <Button
              className="w-full" size="lg"
              disabled={createAttempt.isPending}
              onClick={() =>
                createAttempt.mutate(
                  { data: { testId: id } },
                  {
                    onSuccess: (data) => {
                      setDurationSec((data.test?.durationMinutes ?? 5) * 60);
                      setAttemptId(data.id);
                      setExamReady(true);
                    },
                    onError: () => toast({ title: "Could not start exam", variant: "destructive" }),
                  }
                )
              }
            >
              {createAttempt.isPending ? "Preparing…" : "I am ready — Start Exam"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading attempt data ──────────────────────────────────────────────
  if (isLoading || !passageText) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 mt-4">
        <div className="h-12 bg-muted rounded animate-pulse" />
        <Card className="border-2">
          <CardContent className="p-8">
            <div className="animate-pulse space-y-3">
              <div className="h-8 bg-muted rounded w-full" />
              <div className="h-8 bg-muted rounded w-11/12" />
              <div className="h-8 bg-muted rounded w-4/5" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Active exam ───────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* Timer header */}
      <div className="flex items-center justify-between bg-card px-6 py-3 rounded-lg border shadow-sm sticky top-0 z-20">
        <div>
          <p className="font-semibold">{attempt?.test?.name}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {attempt?.test?.language} · Target: {attempt?.test?.speedCategory} WPM
          </p>
        </div>
        <div className={`flex items-center gap-2 text-2xl font-mono font-bold tabular-nums ${
          isLowTime ? "text-destructive animate-pulse" : "text-primary"
        }`}>
          <Clock className="h-5 w-5" />
          {fmt(timeLeft)}
        </div>
      </div>

      <Progress value={engine.stats.progress} className="h-1.5" />

      {/* Passage card */}
      <Card className="shadow-md border-2">
        <CardContent className="p-8 min-h-[280px]">
          <TypingArea engine={engine} fontSize="text-2xl" />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          {engine.stats.totalTyped} / {engine.stats.totalPassage} chars
          &nbsp;·&nbsp; Acc: {engine.stats.accuracy}%
          &nbsp;·&nbsp; WPM: {engine.stats.wpm}
        </span>
        <Button
          variant="secondary" size="sm"
          disabled={submitAttempt.isPending}
          onClick={engine.complete}
        >
          Submit Early
        </Button>
      </div>
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

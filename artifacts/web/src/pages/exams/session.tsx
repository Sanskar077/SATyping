/**
 * Exam Session — split-panel transcription flow, matching Practice.
 *
 * Same layout and grading model as practice/session.tssx (passage left, free-typing answer right,
 * word-aligned diff on submit via gradeTranscription) so students face ONE consistent interface —
 * the GCC-TBC pattern of retyping a printed passage into a separate answer field.
 *
 * Exam-specific differences, all deliberate:
 *   • Pre-start gate with instructions; the attempt (and timer) begins on explicit click.
 *   • Countdown always runs (tests always have a duration) and auto-submits at zero.
 *   • NO on-screen keyboard guide — knowing the layout is part of what the exam tests.
 *   • Clipboard stays blocked in the answer area (AnswerTypingArea's default).
 *   • Results are recorded server-side and shown on /results, not inline.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { Clock, AlertCircle, FileText, PenLine, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTypingEngine } from "@/hooks/use-typing-engine";
import { AnswerTypingArea } from "@/components/answer-typing-area";
import { gradeTranscription } from "@/lib/transcription-grading";

export default function ExamSession() {
  const { testId } = useParams();
  const id = parseInt(testId ?? "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [examReady, setExamReady] = useState(false);
  const [durationSec, setDurationSec] = useState(300);

  const createAttempt = useCreateTestAttempt();
  const submitAttempt = useSubmitTestAttempt();

  const { data: attempt, isLoading } = useGetTestAttempt(attemptId ?? 0, {
    query: { enabled: !!attemptId, queryKey: getGetTestAttemptQueryKey(attemptId ?? 0) },
  });

  const passageText = attempt?.passage?.content ?? "";
  const passageLanguage = attempt?.passage?.language ?? "marathi";

  // freeMode: the answer box must not cap input at the passage length nor auto-complete on
  // matching length — the candidate decides when they're done, or the clock does.
  const engine = useTypingEngine({ passageText, language: passageLanguage, freeMode: true });
  const { typedText, elapsedSeconds, hasStarted } = engine;

  const isSubmittingRef = useRef(false);

  const liveStats = useMemo(
    () => gradeTranscription(passageText, typedText, elapsedSeconds),
    [passageText, typedText, elapsedSeconds],
  );

  const handleSubmit = useCallback(
    (timedOut: boolean) => {
      if (!attemptId || isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      const graded = gradeTranscription(passageText, typedText, elapsedSeconds);
      submitAttempt.mutate(
        {
          id: attemptId,
          data: {
            status: timedOut ? TestAttemptSubmitStatus.timed_out : TestAttemptSubmitStatus.completed,
            grossWpm: graded.grossWpm,
            netWpm: graded.netWpm,
            accuracy: graded.accuracy,
            totalChars: graded.totalTyped,
            correctChars: graded.correctChars,
            incorrectChars: graded.incorrectChars,
            wrongWords: graded.wrongWords,
            durationSeconds: elapsedSeconds,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Exam submitted", description: "Results recorded." });
            setLocation("/results");
          },
          onError: () => {
            isSubmittingRef.current = false; // allow retrying a failed submit
            toast({ title: "Submit failed", description: "Please try again.", variant: "destructive" });
          },
        },
      );
    },
    [attemptId, passageText, typedText, elapsedSeconds, submitAttempt, setLocation, toast],
  );

  // Countdown + auto-submit. The exam clock runs from the first keystroke (hasStarted) — matching
  // the previous behaviour where the engine's own timer began on first input.
  const timeLeft = Math.max(0, durationSec - elapsedSeconds);
  const isLowTime = timeLeft <= 60 && examReady && hasStarted;

  useEffect(() => {
    if (!examReady || !hasStarted) return;
    if (elapsedSeconds >= durationSec) handleSubmit(true);
  }, [examReady, hasStarted, elapsedSeconds, durationSec, handleSubmit]);

  // ── Pre-start ─────────────────────────────────────────────────────────
  if (!examReady) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card className="glass-rise">
          <CardHeader>
            <CardTitle>Start Exam</CardTitle>
            <CardDescription>Read before you begin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="bg-muted rounded-lg p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <ul className="text-sm text-muted-foreground list-disc pl-3 space-y-1">
                <li>The passage appears on the left; type it into the answer box on the right.</li>
                <li>The timer starts at your first keystroke and submits automatically at zero.</li>
                <li>Backspace removes the last full character (entire akshara for Marathi).</li>
                <li>Copy, paste, and the on-screen keyboard guide are disabled during exams.</li>
                <li>Do not refresh the page during the exam.</li>
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
      <div className="w-full max-w-7xl mx-auto space-y-4 mt-4">
        <div className="h-12 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardContent className="p-6"><div className="animate-pulse space-y-3">
            <div className="h-6 bg-muted rounded w-full" />
            <div className="h-6 bg-muted rounded w-11/12" />
            <div className="h-6 bg-muted rounded w-4/5" />
          </div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="h-48 bg-muted rounded animate-pulse" /></CardContent></Card>
        </div>
      </div>
    );
  }

  // ── Active exam — split panel ─────────────────────────────────────────
  const isDevanagari = passageLanguage === "marathi" || passageLanguage === "hindi";

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Timer header */}
      <div className="flex items-center justify-between glass px-6 py-3 rounded-lg border flex-wrap gap-3">
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

      <Progress value={liveStats.progress} className="h-1.5" />

      {/* Split panels — viewport-capped so the answer box and Submit never scroll off
          screen (see practice/session.tsx for the same pattern + rationale). */}
      <div className="grid gap-4 lg:grid-cols-2 lg:h-[calc(100vh-13rem)] lg:min-h-[24rem]">
        {/* Left: question */}
        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/50 border-b py-3 shrink-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />Exam Question
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-y-auto">
            <div
              className="whitespace-pre-wrap break-words text-foreground/90 select-none"
              style={{
                fontFamily: isDevanagari
                  ? "'Noto Sans Devanagari', 'Mangal', 'Kokila', 'Arial Unicode MS', sans-serif"
                  : "'Courier New', 'Courier', monospace",
                lineHeight: "2",
                letterSpacing: isDevanagari ? "0.03em" : "0.05em",
                fontSize: "1.125rem",
              }}
            >
              {passageText}
            </div>
          </CardContent>
        </Card>

        {/* Right: answer */}
        <Card className="overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/50 border-b py-3 flex-row items-center justify-between space-y-0 shrink-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PenLine className="h-4 w-4 text-primary" />Your Answer
            </CardTitle>
            <span className={`font-mono text-sm font-semibold ${
              isLowTime ? "text-destructive" : "text-muted-foreground"
            }`}>
              {fmt(timeLeft)}
            </span>
          </CardHeader>
          <CardContent className="p-4 flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AnswerTypingArea engine={engine} language={passageLanguage} fontSize="text-lg" />
            </div>
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground">
                {hasStarted
                  ? `${liveStats.totalTyped} / ${liveStats.totalPassage} characters`
                  : "The timer starts at your first keystroke."}
              </span>
              <Button
                onClick={() => handleSubmit(false)}
                disabled={!hasStarted || submitAttempt.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {submitAttempt.isPending ? "Submitting..." : "Submit Exam"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

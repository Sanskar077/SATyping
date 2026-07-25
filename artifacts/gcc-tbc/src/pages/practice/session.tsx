/**
 * Practice Session — split-panel GCC-TBC transcription flow.
 *
 * Left panel shows the passage as clean readable text; the right panel is a free-typing answer
 * box the user transcribes into, with a countdown (timed) or count-up (untimed) clock and a
 * Submit button. This mirrors the actual government exam interface, where you retype a printed
 * passage into a separate answer field rather than overlay-typing on top of it.
 *
 * Scoring is recomputed on submit from a word-aligned diff of the passage against the final
 * committed Unicode text (see lib/transcription-grading.ts) — positional character comparison
 * can't be used here because a single omitted word would shift every later character.
 *
 * Retained from the previous overlay flow: the live WPM timeline (Feature 4) and the error-word
 * breakdown (Feature 2). Dropped for this mode: keystroke replay and the key heatmap (Feature 1) —
 * see the note above `KEYSTROKE_ANALYSIS_ENABLED` below.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetTypingSession,
  getGetTypingSessionQueryKey,
  useUpdateTypingSession,
  TypingSessionUpdateStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, Activity, Target, Zap, BarChart2, FileText, PenLine, Send } from "lucide-react";
import { useTypingEngine } from "@/hooks/use-typing-engine";
import { AnswerTypingArea } from "@/components/answer-typing-area";
import { WpmLiveChart, type WpmSnapshot } from "@/components/wpm-live-chart";
import { ErrorWordList } from "@/components/error-word-list";
import { gradeTranscription } from "@/lib/transcription-grading";
import { readPracticeConfig } from "@/lib/practice-config";

/**
 * Keystroke replay + heatmap are intentionally NOT rendered in the split-panel practice mode.
 *
 * Tradeoff: both features were built for overlay typing, where every keystroke maps to a known
 * passage position, so a replay could show "typed the right/wrong character HERE" and the heatmap
 * could attribute errors to specific keys. In free transcription there is no such positional
 * anchor — the user may omit, reorder, or re-type whole words — so a replay degrades to "keys in
 * the order pressed" and the heatmap to raw key frequency, neither of which teaches anything.
 * The word-level error breakdown below is the meaningful analysis for this mode. Exams still use
 * the overlay flow and keep both features.
 */

export default function PracticeSession() {
  const { sessionId } = useParams();
  const id = parseInt(sessionId ?? "0", 10);
  const [, setLocation] = useLocation();

  const { data: session, isLoading } = useGetTypingSession(id, {
    query: { enabled: !!id, queryKey: getGetTypingSessionQueryKey(id) },
  });

  const updateSession = useUpdateTypingSession();
  const passageText = session?.passage?.content ?? "";
  const passageLanguage = session?.passage?.language ?? "marathi";

  // Timing choice made in the setup wizard. Absent (deep link) → untimed.
  const config = useMemo(() => readPracticeConfig(id), [id]);
  const isTimed = config?.isTimed ?? false;
  const limitSeconds = isTimed && config?.durationMinutes ? config.durationMinutes * 60 : null;

  // freeMode: the answer box must not be capped at the passage length, and must not auto-complete
  // the moment the grapheme count matches — the user decides when they're done (or the clock does).
  const engine = useTypingEngine({
    passageText,
    language: passageLanguage,
    freeMode: true,
  });
  const { typedText, elapsedSeconds, hasStarted } = engine;

  const [isSubmitted, setIsSubmitted] = useState(false);
  const isSubmittedRef = useRef(false);

  // Live stats, recomputed from the word-aligned diff so the on-screen WPM/accuracy match exactly
  // what the final submitted score will be.
  const liveStats = useMemo(
    () => gradeTranscription(passageText, typedText, elapsedSeconds),
    [passageText, typedText, elapsedSeconds],
  );
  const liveStatsRef = useRef(liveStats);
  useEffect(() => { liveStatsRef.current = liveStats; });

  const elapsedSecondsRef = useRef(elapsedSeconds);
  useEffect(() => { elapsedSecondsRef.current = elapsedSeconds; });

  const [wpmSnapshots, setWpmSnapshots] = useState<WpmSnapshot[]>([]);
  const [finalStats, setFinalStats] = useState<ReturnType<typeof gradeTranscription> | null>(null);
  const [finalElapsed, setFinalElapsed] = useState(0);

  const handleSubmit = useCallback(() => {
    if (isSubmittedRef.current) return;
    isSubmittedRef.current = true;

    const elapsed = elapsedSeconds;
    const graded = gradeTranscription(passageText, typedText, elapsed);
    setFinalStats(graded);
    setFinalElapsed(elapsed);
    setIsSubmitted(true);

    updateSession.mutate({
      id,
      data: {
        status: TypingSessionUpdateStatus.completed,
        grossWpm: graded.grossWpm,
        netWpm: graded.netWpm,
        accuracy: graded.accuracy,
        totalChars: graded.totalTyped,
        correctChars: graded.correctChars,
        incorrectChars: graded.incorrectChars,
        durationSeconds: elapsed,
        wpmTimeline: JSON.stringify(wpmSnapshots),
        userInput: typedText,
      },
    });
  }, [id, passageText, typedText, elapsedSeconds, wpmSnapshots, updateSession]);

  // Sample the WPM timeline every 3s while typing.
  useEffect(() => {
    if (!hasStarted || isSubmitted) return undefined;
    const timerId = setInterval(() => {
      if (isSubmittedRef.current) return;
      const s = liveStatsRef.current;
      setWpmSnapshots((prev) => [
        ...prev,
        { time: elapsedSecondsRef.current, wpm: s.netWpm, accuracy: s.accuracy, errors: s.incorrectChars },
      ]);
    }, 3000);
    return () => clearInterval(timerId);
  }, [hasStarted, isSubmitted]);

  // Timed mode: auto-submit the moment the clock hits zero.
  const remainingSeconds = limitSeconds !== null ? Math.max(0, limitSeconds - elapsedSeconds) : null;
  useEffect(() => {
    if (limitSeconds === null || isSubmitted || !hasStarted) return;
    if (elapsedSeconds >= limitSeconds) handleSubmit();
  }, [elapsedSeconds, limitSeconds, isSubmitted, hasStarted, handleSubmit]);

  if (isLoading) {
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

  // ── Results ────────────────────────────────────────────────────────────────
  if (isSubmitted && finalStats) {
    return (
      <div className="max-w-4xl mx-auto mt-6 space-y-6">
        <Card>
          <CardContent className="pt-8 pb-6 px-8">
            <h2 className="text-2xl font-bold text-center mb-6">Practice Complete</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <Stat label="Net WPM" value={finalStats.netWpm} color="text-primary" />
              <Stat label="Gross WPM" value={finalStats.grossWpm} />
              <Stat label="Accuracy" value={`${finalStats.accuracy}%`} />
              <Stat label="Time" value={fmt(finalElapsed)} />
              <Stat label="CPM" value={finalStats.cpm} />
              <Stat label="Correct" value={finalStats.correctChars} color="text-green-600" />
              <Stat label="Errors" value={finalStats.incorrectChars} color="text-destructive" />
              <Stat label="Wrong words" value={finalStats.wrongWords} color="text-destructive" />
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <Button variant="outline" onClick={() => setLocation("/dashboard")}>Dashboard</Button>
              <Button onClick={() => setLocation("/practice")}>Practice Again</Button>
            </div>
          </CardContent>
        </Card>

        {wpmSnapshots.length >= 2 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />WPM Progress During Session
              </CardTitle>
            </CardHeader>
            <CardContent><WpmLiveChart snapshots={wpmSnapshots} /></CardContent>
          </Card>
        )}

        <ErrorWordList passageText={passageText} userInput={typedText} />
      </div>
    );
  }

  // ── Active split-panel session ─────────────────────────────────────────────
  const isDevanagari = passageLanguage === "marathi" || passageLanguage === "hindi";

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between bg-card px-6 py-3 rounded-lg border shadow-sm flex-wrap gap-3">
        <div className="flex gap-8">
          <Pill icon={<Activity className="h-4 w-4 text-primary" />} label="WPM" value={liveStats.netWpm} />
          <Pill icon={<Target className="h-4 w-4 text-primary" />} label="Acc" value={`${liveStats.accuracy}%`} />
          <Pill icon={<Zap className="h-4 w-4 text-primary" />} label="CPM" value={liveStats.cpm} />
        </div>
        <div className="flex items-center gap-2 font-mono text-lg font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {remainingSeconds !== null ? fmt(remainingSeconds) : fmt(elapsedSeconds)}
          <span className="text-xs font-sans font-normal text-muted-foreground">
            {remainingSeconds !== null ? "left" : "elapsed"}
          </span>
        </div>
      </div>

      <Progress value={liveStats.progress} className="h-1.5" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: question */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 border-b py-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />Speed Practice Question
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div
              className="min-h-[20rem] whitespace-pre-wrap break-words text-foreground/90 select-none"
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
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 border-b py-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PenLine className="h-4 w-4 text-primary" />Speed Practice Answer
            </CardTitle>
            <span className={`font-mono text-sm font-semibold ${
              remainingSeconds !== null && remainingSeconds <= 30 ? "text-destructive" : "text-muted-foreground"
            }`}>
              {remainingSeconds !== null ? fmt(remainingSeconds) : fmt(elapsedSeconds)}
            </span>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <AnswerTypingArea engine={engine} language={passageLanguage} fontSize="text-lg" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {hasStarted
                  ? `${liveStats.totalTyped} / ${liveStats.totalPassage} characters`
                  : "Start typing to begin."}
              </span>
              <Button onClick={handleSubmit} disabled={!hasStarted}>
                <Send className="h-4 w-4 mr-2" />Submit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {hasStarted && (
        <Card>
          <CardHeader className="pb-0 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Live WPM</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1">
            <WpmLiveChart snapshots={wpmSnapshots} className="h-[120px]" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Stat({ label, value, color = "" }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function Pill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xl font-bold font-mono">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

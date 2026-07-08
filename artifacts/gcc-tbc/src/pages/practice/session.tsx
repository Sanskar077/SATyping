/**
 * Practice Session page — enhanced with:
 * Feature 1: Live keystroke logging → Replay + Heatmap on completion
 * Feature 2: User input capture → Error Word List on completion
 * Feature 4: Real-time WPM graph during typing
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Activity, Target, Zap, BarChart2, Keyboard, AlertTriangle } from "lucide-react";
import { useTypingEngine, type TypingStats } from "@/hooks/use-typing-engine";
import { TypingArea } from "@/components/typing-area";
import { WpmLiveChart, type WpmSnapshot } from "@/components/wpm-live-chart";
import { ReplayPlayer } from "@/components/replay-player";
import { KeystrokeHeatmap, type KeystrokeEntry } from "@/components/keystroke-heatmap";
import { ErrorWordList } from "@/components/error-word-list";

export default function PracticeSession() {
  const { sessionId } = useParams();
  const id = parseInt(sessionId ?? "0", 10);
  const [, setLocation] = useLocation();

  const { data: session, isLoading } = useGetTypingSession(id, {
    query: { enabled: !!id, queryKey: getGetTypingSessionQueryKey(id) },
  });

  const updateSession = useUpdateTypingSession();
  const passageText    = session?.passage?.content ?? "";
  const passageLanguage = session?.passage?.language ?? "marathi";

  // ─── Feature 1: Keystroke log ────────────────────────────────────────────────
  const keystrokeLogRef = useRef<KeystrokeEntry[]>([]);
  // Keep a stable ref to avoid re-creating the listener
  const isCompletedRef  = useRef(false);

  // ─── Feature 4: WPM timeline ─────────────────────────────────────────────────
  const [wpmSnapshots, setWpmSnapshots] = useState<WpmSnapshot[]>([]);
  const statsRef        = useRef<TypingStats | null>(null);
  const elapsedRef      = useRef(0);
  const hasStartedRef   = useRef(false);

  // ─── Feature 2: User input capture ───────────────────────────────────────────
  const typedTextRef    = useRef("");

  const handleComplete = useCallback(
    (s: TypingStats, elapsedSeconds: number) => {
      isCompletedRef.current = true;
      updateSession.mutate({
        id,
        data: {
          status: TypingSessionUpdateStatus.completed,
          grossWpm:      s.grossWpm,
          netWpm:        s.wpm,
          accuracy:      s.accuracy,
          totalChars:    s.totalTyped,
          correctChars:  s.correctChars,
          incorrectChars: s.incorrectChars,
          durationSeconds: elapsedSeconds,
          // Feature 1
          keystrokeData: JSON.stringify(
            keystrokeLogRef.current.map(k => ({ ...k, timestamp: k.timestamp - (keystrokeLogRef.current[0]?.timestamp ?? 0) }))
          ),
          // Feature 4
          wpmTimeline: JSON.stringify(wpmSnapshots),
          // Feature 2
          userInput: typedTextRef.current,
        },
      });
    },
    [id, updateSession, wpmSnapshots],
  );

  const engine = useTypingEngine({ passageText, language: passageLanguage, onComplete: handleComplete });
  const { stats, elapsedSeconds, isCompleted, hasStarted } = engine;

  // Keep refs in sync (no-dep effects so they always update)
  useEffect(() => { statsRef.current    = stats; });
  useEffect(() => { elapsedRef.current  = elapsedSeconds; });
  useEffect(() => { hasStartedRef.current = hasStarted; });
  useEffect(() => { typedTextRef.current = engine.typedText; });

  // ─── Feature 1: Attach keystroke listener — scoped to textarea focus ────────
  useEffect(() => {
    const IGNORE = new Set(["Shift","Control","Alt","Meta","CapsLock","Tab","Escape","Enter","Process"]);

    const onKey = (e: KeyboardEvent) => {
      if (isCompletedRef.current) return;
      if (IGNORE.has(e.key)) return;
      // Only capture when the typing textarea actually has focus (prevents
      // logging nav keystrokes, modal keys, etc.)
      if (document.activeElement?.tagName !== "TEXTAREA") return;

      keystrokeLogRef.current.push({
        key: e.key,
        char: e.key === "Backspace" ? "" : e.key,
        timestamp: Date.now(),
        isCorrect: true, // refined during replay
      });
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []); // mount-once — all mutable state accessed via stable refs

  // ─── Feature 4: WPM sampling every 3 s — stops as soon as session ends ──────
  useEffect(() => {
    // Guard both: must be started AND not yet complete
    if (!hasStarted || isCompleted) return;
    const timerId = setInterval(() => {
      // Double-check via ref so the callback itself is always safe
      if (isCompletedRef.current) return;
      const s = statsRef.current;
      const t = elapsedRef.current;
      if (!s) return;
      setWpmSnapshots(prev => [...prev, { time: t, wpm: s.wpm, accuracy: s.accuracy, errors: s.incorrectChars }]);
    }, 3000);
    return () => clearInterval(timerId);
  }, [hasStarted, isCompleted]); // re-evaluates when either flag flips

  // ── Full-screen loading ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-4 mt-4 overflow-hidden">
        <div className="h-12 bg-muted rounded animate-pulse" />
        <Card className="border-2 w-full overflow-hidden">
          <CardContent className="p-6 md:p-8">
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

  // ── Completed screen ──────────────────────────────────────────────────────────
  if (isCompleted) {
    const finalKeystrokes = keystrokeLogRef.current;
    return (
      <div className="max-w-4xl mx-auto mt-6 space-y-6">
        <Card>
          <CardContent className="pt-8 pb-6 px-8">
            <h2 className="text-2xl font-bold text-center mb-6">Session Complete!</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <Stat label="Net WPM"   value={stats.wpm}              color="text-primary" />
              <Stat label="Gross WPM" value={stats.grossWpm} />
              <Stat label="Accuracy"  value={`${stats.accuracy}%`} />
              <Stat label="Time"      value={fmt(elapsedSeconds)} />
              <Stat label="CPM"       value={stats.cpm} />
              <Stat label="Correct"   value={stats.correctChars}   color="text-green-600" />
              <Stat label="Errors"    value={stats.incorrectChars} color="text-destructive" />
              <Stat label="Total"     value={stats.totalTyped} />
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <Button variant="outline" onClick={() => setLocation("/dashboard")}>Dashboard</Button>
              <Button onClick={() => setLocation("/practice")}>Practice Again</Button>
            </div>
          </CardContent>
        </Card>

        {/* Feature 4: WPM chart recap */}
        {wpmSnapshots.length >= 2 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                WPM Progress During Session
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WpmLiveChart snapshots={wpmSnapshots} />
            </CardContent>
          </Card>
        )}

        {/* Features 1, 2 — Tabs */}
        <Tabs defaultValue="errors">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="errors">
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />Error Words
            </TabsTrigger>
            <TabsTrigger value="replay">
              <Activity className="h-3.5 w-3.5 mr-1" />Replay
            </TabsTrigger>
            <TabsTrigger value="heatmap">
              <Keyboard className="h-3.5 w-3.5 mr-1" />Key Heatmap
            </TabsTrigger>
          </TabsList>

          {/* Feature 2: Error Word List */}
          <TabsContent value="errors">
            <ErrorWordList
              passageText={passageText}
              userInput={typedTextRef.current}
            />
          </TabsContent>

          {/* Feature 1a: Replay */}
          <TabsContent value="replay">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Session Replay</CardTitle>
              </CardHeader>
              <CardContent>
                <ReplayPlayer keystrokes={finalKeystrokes} passageText={passageText} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feature 1b: Heatmap */}
          <TabsContent value="heatmap">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Keystroke Heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                <KeystrokeHeatmap keystrokes={finalKeystrokes} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ── Active session ────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 overflow-hidden">

      {/* Stats bar */}
      <div className="flex items-center justify-between bg-card px-6 py-3 rounded-lg border shadow-sm sticky top-0 z-20 w-full overflow-hidden">
        <div className="flex gap-8">
          <Pill icon={<Activity className="h-4 w-4 text-primary" />} label="WPM" value={stats.wpm} />
          <Pill icon={<Target   className="h-4 w-4 text-primary" />} label="Acc" value={`${stats.accuracy}%`} />
          <Pill icon={<Zap      className="h-4 w-4 text-primary" />} label="CPM" value={stats.cpm} />
        </div>
        <div className="flex items-center gap-2 font-mono text-lg font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {fmt(elapsedSeconds)}
        </div>
      </div>

      <Progress value={stats.progress} className="h-1.5" />

      {/* Passage card */}
      <Card className="shadow-md border-2 w-full overflow-hidden">
        <CardContent className="p-6 md:p-8 min-h-[280px]">
          <TypingArea engine={engine} fontSize="text-2xl" />
        </CardContent>
      </Card>

      {/* Feature 4: Live WPM chart */}
      {hasStarted && (
        <Card className="w-full">
          <CardHeader className="pb-0 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Live WPM</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-1">
            <WpmLiveChart snapshots={wpmSnapshots} className="h-[120px]" />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          {hasStarted
            ? `${stats.totalTyped} / ${stats.totalPassage} chars typed`
            : "Start typing to begin the session. Press ? for keyboard reference."}
        </span>
        <Button variant="ghost" size="sm" onClick={engine.complete}>End Early</Button>
      </div>
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

function Stat({ label, value, color="" }: { label:string; value:string|number; color?:string }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function Pill({ icon, label, value }: { icon:React.ReactNode; label:string; value:string|number }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xl font-bold font-mono">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

import { useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetTypingSession,
  getGetTypingSessionQueryKey,
  useUpdateTypingSession,
  TypingSessionUpdateStatus,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, Activity, Target, Zap } from "lucide-react";
import { useTypingEngine, type TypingStats } from "@/hooks/use-typing-engine";
import { TypingArea } from "@/components/typing-area";

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

  const handleComplete = useCallback(
    (s: TypingStats, elapsedSeconds: number) => {
      updateSession.mutate({
        id,
        data: {
          status: TypingSessionUpdateStatus.completed,
          grossWpm: s.grossWpm, netWpm: s.wpm, accuracy: s.accuracy,
          totalChars: s.totalTyped, correctChars: s.correctChars,
          incorrectChars: s.incorrectChars, durationSeconds: elapsedSeconds,
        },
      });
    },
    [id, updateSession]
  );

  // Engine always created with current passageText.
  // When passageText="" (loading), appendChars rejects all input (passLen=0).
  // Once passage loads, passageTextRef updates and typing starts working.
  const engine = useTypingEngine({ passageText, language: passageLanguage, onComplete: handleComplete });
  const { stats, elapsedSeconds, isCompleted } = engine;

  // ── Full-screen loading ───────────────────────────────────────────────
  if (isLoading) {
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

  // ── Completed screen ──────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="max-w-3xl mx-auto mt-12">
        <Card>
          <CardContent className="pt-8 pb-10 px-10">
            <h2 className="text-2xl font-bold text-center mb-8">Session Complete!</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <Stat label="Net WPM"    value={stats.wpm}              color="text-primary" />
              <Stat label="Gross WPM"  value={stats.grossWpm} />
              <Stat label="Accuracy"   value={`${stats.accuracy}%`} />
              <Stat label="Time"       value={fmt(elapsedSeconds)} />
              <Stat label="CPM"        value={stats.cpm} />
              <Stat label="Correct"    value={stats.correctChars}   color="text-green-600" />
              <Stat label="Errors"     value={stats.incorrectChars} color="text-destructive" />
              <Stat label="Total"      value={stats.totalTyped} />
            </div>
            <div className="mt-10 flex justify-center gap-4">
              <Button variant="outline" onClick={() => setLocation("/dashboard")}>Dashboard</Button>
              <Button onClick={() => setLocation("/practice")}>Practice Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Active session ────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-4">

      {/* Stats bar */}
      <div className="flex items-center justify-between bg-card px-6 py-3 rounded-lg border shadow-sm sticky top-0 z-20">
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

      {/* Passage card — TypingArea mounts HERE, textarea is definitely present */}
      <Card className="shadow-md border-2">
        <CardContent className="p-8 min-h-[280px]">
          <TypingArea engine={engine} fontSize="text-2xl" />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          {engine.hasStarted
            ? `${stats.totalTyped} / ${stats.totalPassage} chars typed`
            : "Start typing to begin the session."}
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

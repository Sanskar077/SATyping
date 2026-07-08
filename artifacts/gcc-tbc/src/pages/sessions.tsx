/**
 * Feature 8: Session History with Passage Recall
 * Shows all practice sessions with the passage text, WPM, and a retry button.
 */
import { useState } from "react";
import { useListTypingSessions, getListTypingSessionsQueryKey, useCreateTypingSession, TypingSessionInputLanguage } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Clock, Zap, Target, RotateCcw, BookOpen, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  completed:  "Completed",
  active:     "In Progress",
  abandoned:  "Abandoned",
};

const LANG_LABELS: Record<string, string> = {
  english: "English",
  hindi:   "Hindi",
  marathi: "Marathi",
};

export default function SessionHistory() {
  const [language, setLanguage] = useState<string>("all");
  const [page, setPage]         = useState(1);
  const [, setLocation]         = useLocation();
  const { toast }               = useToast();

  const params = { language: language !== "all" ? language as any : undefined, page, limit: 15 };
  const { data, isLoading } = useListTypingSessions(params, {
    query: { queryKey: getListTypingSessionsQueryKey(params) },
  });

  const createSession = useCreateTypingSession();

  const handleRetry = (session: { passageId: number; language: string }) => {
    createSession.mutate(
      { data: { passageId: session.passageId, language: session.language as TypingSessionInputLanguage } },
      {
        onSuccess: (s) => setLocation(`/practice/${s.id}`),
        onError:   () => toast({ title: "Error", description: "Could not start session.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            Session History
          </h1>
          <p className="text-muted-foreground mt-1">Review your past practice sessions and retry passages.</p>
        </div>

        <Select value={language} onValueChange={(v) => { setLanguage(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All languages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            <SelectItem value="english">English</SelectItem>
            <SelectItem value="marathi">Marathi</SelectItem>
            <SelectItem value="hindi">Hindi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sessions list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : data?.sessions.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              No sessions found. Start a practice session to see your history here.
            </CardContent>
          </Card>
        ) : (
          data?.sessions.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              onRetry={() => handleRetry({ passageId: session.passageId, language: session.language })}
              isRetrying={createSession.isPending}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {data && data.total > 15 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={page * 15 >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SessionRowProps {
  session: {
    id: number;
    language: string;
    status: string;
    netWpm?: number | null;
    accuracy?: number | null;
    durationSeconds?: number | null;
    createdAt: string;
    passage?: { title: string; content: string } | undefined;
    passageId: number;
  };
  onRetry: () => void;
  isRetrying: boolean;
}

function SessionRow({ session, onRetry, isRetrying }: SessionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const dur = session.durationSeconds ?? 0;
  const statusVariant = session.status === "completed" ? "default" : session.status === "active" ? "secondary" : "outline";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          {/* Left: passage title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{session.passage?.title ?? `Passage #${session.passageId}`}</span>
              <Badge variant={statusVariant} className="text-xs">{STATUS_LABELS[session.status] ?? session.status}</Badge>
              <Badge variant="outline" className="text-xs capitalize">{LANG_LABELS[session.language] ?? session.language}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(session.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}{" "}
              {new Date(session.createdAt).toLocaleTimeString(undefined, { timeStyle: "short" })}
            </p>

            {/* Stats chips */}
            {session.status === "completed" && (
              <div className="flex gap-4 mt-2 flex-wrap">
                {session.netWpm != null && (
                  <span className="flex items-center gap-1 text-xs">
                    <Zap className="h-3 w-3 text-primary" />
                    <span className="font-mono font-medium">{Math.round(session.netWpm)}</span> WPM
                  </span>
                )}
                {session.accuracy != null && (
                  <span className="flex items-center gap-1 text-xs">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono">{Math.round(session.accuracy)}%</span> acc
                  </span>
                )}
                {dur > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {Math.floor(dur / 60)}m {dur % 60}s
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {session.passage && (
              <Button size="sm" variant="ghost" onClick={() => setExpanded(e => !e)}>
                <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                <span className="sr-only">Show passage</span>
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={isRetrying}
              className="gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        </div>

        {/* Expandable passage preview */}
        {expanded && session.passage && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Passage</p>
            <p className="text-sm leading-relaxed text-foreground/80 line-clamp-4 font-mono">
              {session.passage.content}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

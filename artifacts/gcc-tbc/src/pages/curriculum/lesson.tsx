/**
 * Feature 5: Lesson Practice Page
 * Full typing interface for a single curriculum lesson.
 */
import { useCallback, useState, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useListLessons, getListLessonsQueryKey, useCompleteLesson, ListLessonsLanguage } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, XCircle, Target, Zap } from "lucide-react";
import { useTypingEngine } from "@/hooks/use-typing-engine";
import { TypingArea } from "@/components/typing-area";
import { cn } from "@/lib/utils";

interface StatProps { label: string; value: string | number; color?: string }
function Stat({ label, value, color = "" }: StatProps) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function LessonPage() {
  const { language, id } = useParams<{ language: string; id: string }>();
  const lessonId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const completeLesson = useCompleteLesson();
  const [saved, setSaved] = useState(false);

  const { data: lessonsData, isLoading } = useListLessons(
    { language: language as ListLessonsLanguage },
    { query: { queryKey: getListLessonsQueryKey({ language: language as ListLessonsLanguage }) } },
  );

  const lesson = lessonsData?.lessons.find(l => l.id === lessonId);
  const passageText = lesson?.content ?? "";

  const handleComplete = useCallback(
    (stats: { wpm: number; accuracy: number }, _elapsed: number) => {
      if (!lesson || saved) return;
      setSaved(true);
      completeLesson.mutate(
        { id: lessonId, data: { accuracy: stats.accuracy, wpm: stats.wpm } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLessonsQueryKey({ language: language as ListLessonsLanguage }) });
          },
        },
      );
    },
    [lesson, lessonId, language, saved, completeLesson, queryClient],
  );

  const engine = useTypingEngine({ passageText, language, onComplete: handleComplete });
  const { stats, elapsedSeconds, isCompleted, typedText } = engine;

  const passed = stats.accuracy >= (lesson?.minAccuracy ?? 80) &&
    (lesson?.minWpm ?? 0) === 0 || stats.wpm >= (lesson?.minWpm ?? 0);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto mt-8 space-y-4">
        <div className="h-10 bg-muted rounded animate-pulse w-40" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Lesson not found.</p>
        <Button asChild className="mt-4">
          <Link href={`/curriculum`}>Back to Curriculum</Link>
        </Button>
      </div>
    );
  }

  if (isCompleted) {
    const isPass = stats.accuracy >= lesson.minAccuracy && (lesson.minWpm === 0 || stats.wpm >= lesson.minWpm);
    return (
      <div className="max-w-2xl mx-auto mt-12 space-y-6">
        <Card>
          <CardContent className="pt-8 pb-10 px-10">
            <div className="flex items-center justify-center gap-3 mb-6">
              {isPass
                ? <CheckCircle2 className="h-10 w-10 text-green-500" />
                : <XCircle className="h-10 w-10 text-red-500" />}
              <div>
                <h2 className="text-2xl font-bold">{isPass ? "Lesson Complete!" : "Keep Practicing"}</h2>
                <p className="text-muted-foreground text-sm">{lesson.title}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <Stat label="Net WPM"   value={stats.wpm}                color={isPass ? "text-primary" : ""} />
              <Stat label="Accuracy"  value={`${stats.accuracy}%`} />
              <Stat label="Duration"  value={`${elapsedSeconds}s`} />
            </div>

            {!isPass && (
              <div className="rounded-lg bg-muted/30 border p-3 mb-6 text-sm text-muted-foreground text-center">
                Required: ≥{lesson.minAccuracy}% accuracy
                {lesson.minWpm > 0 ? ` and ≥${lesson.minWpm} WPM` : ""}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button variant="outline" asChild>
                <Link href="/curriculum">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Curriculum
                </Link>
              </Button>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/curriculum">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Curriculum
          </Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{lesson.title}</span>
        {lesson.targetKeys && (
          <Badge variant="outline" className="text-xs font-mono">{lesson.targetKeys}</Badge>
        )}
      </div>

      {/* Live stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "WPM",      value: stats.wpm,             icon: <Zap className="h-3 w-3" /> },
          { label: "Accuracy", value: `${stats.accuracy}%`,  icon: <Target className="h-3 w-3" /> },
          { label: "Progress", value: `${stats.progress}%`,  icon: null },
          { label: "Time",     value: `${elapsedSeconds}s`,  icon: null },
        ].map(s => (
          <Card key={s.label} className="py-0">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold font-mono">{s.value}</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">{s.icon}{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Progress value={stats.progress} className="h-1.5" />

      {/* Typing area */}
      <Card className="border-2">
        <CardContent className="p-6">
          <TypingArea engine={engine} fontSize="text-xl" />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Pass with ≥{lesson.minAccuracy}% accuracy{lesson.minWpm > 0 ? ` at ${lesson.minWpm}+ WPM` : ""} to unlock the next lesson.
      </p>
    </div>
  );
}

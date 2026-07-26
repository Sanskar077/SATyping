/**
 * Feature 5: Lesson-Based Typing Curriculum
 * Shows curriculum paths for each language with lesson cards and progress.
 */
import { useState } from "react";
import { Link } from "wouter";
import { useGetCurriculumPath, getGetCurriculumPathQueryKey, CurriculumPathLanguage } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, CheckCircle2, PlayCircle, BookOpen, ChevronRight } from "lucide-react";

const LANGS = [
  { value: CurriculumPathLanguage.english, label: "English", flag: "🇬🇧" },
  { value: CurriculumPathLanguage.marathi,  label: "Marathi",  flag: "🇮🇳" },
  { value: CurriculumPathLanguage.hindi,    label: "Hindi",    flag: "🇮🇳" },
] as const;

type LangKey = (typeof LANGS)[number]["value"];

export default function CurriculumPage() {
  const [language, setLanguage] = useState<LangKey>(CurriculumPathLanguage.english);

  const { data, isLoading } = useGetCurriculumPath(language, {
    query: { queryKey: getGetCurriculumPathQueryKey(language) },
  });

  const progressPct = data
    ? Math.round((data.completedLessons / Math.max(1, data.totalLessons)) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" />
          Typing Curriculum
        </h1>
        <p className="text-muted-foreground mt-1">
          Structured lessons to build your typing skills from the ground up.
        </p>
      </div>

      {/* Language tabs */}
      <div className="flex gap-2 flex-wrap">
        {LANGS.map(lang => (
          <Button
            key={lang.value}
            variant={language === lang.value ? "default" : "outline"}
            size="sm"
            onClick={() => setLanguage(lang.value)}
          >
            {lang.flag} {lang.label}
          </Button>
        ))}
      </div>

      {/* Progress bar */}
      {data && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">
                {data.completedLessons} / {data.totalLessons} lessons completed
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{progressPct}% complete</p>
          </CardContent>
        </Card>
      )}

      {/* Categories */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : data?.categories.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No curriculum content is available for this language yet.</p>
        </div>
      ) : (
        data?.categories.map(category => {
          const done  = category.lessons.filter(l => l.isCompleted).length;
          const total = category.lessons.length;
          return (
            <Card key={category.name} className="overflow-hidden">
              <CardHeader className="pb-3 bg-muted/20">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">{category.label}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {done}/{total} done
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {category.lessons.map(lesson => (
                    <LessonCard key={lesson.id} lesson={lesson} language={language} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

interface LessonCardProps {
  lesson: {
    id: number;
    title: string;
    description?: string | null;
    isLocked: boolean;
    isCompleted?: boolean;
    bestAccuracy?: number | null;
    bestWpm?: number | null;
    completionCount?: number;
    minAccuracy?: number;
    minWpm?: number;
    targetKeys?: string | null;
  };
  language: LangKey;
}

function LessonCard({ lesson, language }: LessonCardProps) {
  const icon = lesson.isLocked
    ? <Lock className="h-4 w-4 text-muted-foreground" />
    : lesson.isCompleted
      ? <CheckCircle2 className="h-4 w-4 text-green-500" />
      : <PlayCircle className="h-4 w-4 text-primary" />;

  const borderClass = lesson.isLocked
    ? "border-muted opacity-60"
    : lesson.isCompleted
      ? "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-900/10"
      : "border-primary/20 hover:border-primary/40 hover:shadow-sm transition-all";

  return (
    <div className={`rounded-lg border p-3 ${borderClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="mt-0.5 flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{lesson.title}</p>
            {lesson.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{lesson.description}</p>
            )}
            {lesson.targetKeys && (
              <p className="text-xs font-mono text-muted-foreground mt-1">
                Keys: <span className="text-foreground">{lesson.targetKeys}</span>
              </p>
            )}
          </div>
        </div>
        {!lesson.isLocked && (
          <Link href={`/curriculum/${language}/${lesson.id}`}>
            <Button size="sm" variant={lesson.isCompleted ? "outline" : "default"} className="flex-shrink-0 h-7 px-2 text-xs gap-1">
              {lesson.isCompleted ? "Retry" : "Start"}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        )}
      </div>

      {/* Best stats */}
      {lesson.isCompleted && (
        <div className="flex gap-3 mt-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            Best: <span className="font-mono font-medium text-foreground">{Math.round(lesson.bestWpm ?? 0)} WPM</span>
          </span>
          <span className="text-xs text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{Math.round(lesson.bestAccuracy ?? 0)}%</span> acc
          </span>
          <span className="text-xs text-muted-foreground ml-auto">×{lesson.completionCount}</span>
        </div>
      )}

      {/* Requirements hint */}
      {!lesson.isCompleted && !lesson.isLocked && (
        <p className="text-xs text-muted-foreground mt-2">
          Pass with ≥{lesson.minAccuracy ?? 80}% accuracy{(lesson.minWpm ?? 0) > 0 ? ` at ${lesson.minWpm}+ WPM` : ""}
        </p>
      )}
    </div>
  );
}

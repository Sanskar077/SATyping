/**
 * Feature 3: Timed Practice Drills by Speed Category
 * Speed-focused drill mode where users pick a WPM target tier and get
 * appropriately difficult passages with a countdown timer.
 */
import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetRandomPassage, GetRandomPassageLanguage, GetRandomPassageDifficulty,
  getGetRandomPassageQueryKey, useCreateTypingSession, TypingSessionInputLanguage,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Timer, Zap, Target, TrendingUp } from "lucide-react";

const SPEED_TIERS = [
  {
    wpm: 30,
    label: "Beginner",
    color: "border-green-400 bg-green-50 dark:bg-green-900/20",
    badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    difficulty: GetRandomPassageDifficulty.easy,
    description: "Short passages, simple words. Build speed from scratch.",
    durationMinutes: 5,
    icon: <Target className="h-5 w-5 text-green-600" />,
  },
  {
    wpm: 40,
    label: "Intermediate",
    color: "border-blue-400 bg-blue-50 dark:bg-blue-900/20",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    difficulty: GetRandomPassageDifficulty.medium,
    description: "Moderate passages. Standard exam level.",
    durationMinutes: 5,
    icon: <Zap className="h-5 w-5 text-blue-600" />,
  },
  {
    wpm: 50,
    label: "Advanced",
    color: "border-orange-400 bg-orange-50 dark:bg-orange-900/20",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    difficulty: GetRandomPassageDifficulty.medium,
    description: "Longer passages with complex vocabulary.",
    durationMinutes: 5,
    icon: <TrendingUp className="h-5 w-5 text-orange-600" />,
  },
  {
    wpm: 60,
    label: "Expert",
    color: "border-purple-400 bg-purple-50 dark:bg-purple-900/20",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    difficulty: GetRandomPassageDifficulty.hard,
    description: "Hard passages with technical content. Elite level.",
    durationMinutes: 5,
    icon: <Timer className="h-5 w-5 text-purple-600" />,
  },
] as const;

const LANGUAGES = [
  { value: GetRandomPassageLanguage.english, label: "English",  flag: "🇬🇧" },
  { value: GetRandomPassageLanguage.marathi,  label: "Marathi",  flag: "🇮🇳" },
  { value: GetRandomPassageLanguage.hindi,    label: "Hindi",    flag: "🇮🇳" },
] as const;

export default function Drills() {
  const [language, setLanguage] = useState<GetRandomPassageLanguage>(GetRandomPassageLanguage.english);
  const [selectedTier, setSelectedTier] = useState<(typeof SPEED_TIERS)[number] | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const queryParams = selectedTier
    ? { language, speedCategory: selectedTier.wpm, difficulty: selectedTier.difficulty }
    : { language, speedCategory: 30, difficulty: GetRandomPassageDifficulty.easy };

  const { refetch: fetchPassage, isFetching } = useGetRandomPassage(queryParams, {
    query: { enabled: false, queryKey: getGetRandomPassageQueryKey(queryParams) },
  });

  const createSession = useCreateTypingSession();

  const handleStartDrill = async (tier: (typeof SPEED_TIERS)[number]) => {
    setSelectedTier(tier);
    try {
      const res = await fetchPassage();
      const passage = res.data;
      if (!passage) {
        toast({ title: "No passage found", description: "No passage found for this tier. Try another language.", variant: "destructive" });
        return;
      }
      createSession.mutate(
        { data: { passageId: passage.id, language: language as unknown as TypingSessionInputLanguage } },
        {
          onSuccess: (session) => setLocation(`/practice/${session.id}`),
          onError: () => toast({ title: "Error", description: "Could not start drill.", variant: "destructive" }),
        },
      );
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Timer className="h-7 w-7 text-primary" />
          Speed Drills
        </h1>
        <p className="text-muted-foreground mt-1">
          Choose a speed tier to practice with appropriately challenging passages.
        </p>
      </div>

      {/* Language selector */}
      <div>
        <p className="text-sm font-medium mb-2">Language</p>
        <div className="flex gap-2">
          {LANGUAGES.map(lang => (
            <Button
              key={lang.value}
              size="sm"
              variant={language === lang.value ? "default" : "outline"}
              onClick={() => setLanguage(lang.value)}
            >
              {lang.flag} {lang.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Speed tiers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SPEED_TIERS.map(tier => (
          <Card
            key={tier.wpm}
            className={`cursor-pointer border-2 transition-all hover:shadow-md ${tier.color}`}
            onClick={() => handleStartDrill(tier)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {tier.icon}
                  <CardTitle className="text-lg">{tier.label}</CardTitle>
                </div>
                <Badge className={tier.badge}>{tier.wpm} WPM</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {tier.durationMinutes} min · {tier.difficulty} passage
                </span>
                <Button
                  size="sm"
                  disabled={isFetching || createSession.isPending}
                  onClick={(e) => { e.stopPropagation(); handleStartDrill(tier); }}
                >
                  {(isFetching || createSession.isPending) && selectedTier?.wpm === tier.wpm
                    ? "Starting…"
                    : "Start Drill"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <h3 className="font-medium mb-2">How Speed Drills Work</h3>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>• Each drill selects a passage calibrated to your chosen speed tier.</li>
            <li>• Aim to type the full passage within the allotted time.</li>
            <li>• Your WPM, accuracy, and completion data are saved automatically.</li>
            <li>• Practice the same tier repeatedly until you consistently exceed the target WPM.</li>
            <li>• Then graduate to the next tier!</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

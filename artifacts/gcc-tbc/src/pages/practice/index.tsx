import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stepper } from "@/components/stepper";
import {
  useCreateTypingSession, useGetRandomPassage,
  GetRandomPassageLanguage, GetRandomPassageDifficulty, getGetRandomPassageQueryKey,
} from "@workspace/api-client-react";
import { Play, ArrowLeft, ArrowRight, Languages, Gauge, Timer, ClipboardCheck, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { writePracticeConfig } from "@/lib/practice-config";

const STEPS = ["Language", "Speed", "Timing", "Ready"];

const LANGUAGES = [
  { value: GetRandomPassageLanguage.english, label: "English", hint: "QWERTY, standard English passages" },
  { value: GetRandomPassageLanguage.marathi, label: "Marathi (मराठी)", hint: "ISM V6 Remington Devanagari layout" },
  { value: GetRandomPassageLanguage.hindi, label: "Hindi (हिन्दी)", hint: "Same Remington layout as Marathi" },
];

// Only these speed categories exist server-side (see openapi.yaml: speedCategory is 30|40|50|60).
const SPEEDS = [30, 40, 50, 60];
const DURATIONS = [5, 7, 10, 15];

export default function Practice() {
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<GetRandomPassageLanguage>(GetRandomPassageLanguage.english);
  const [speedCategory, setSpeedCategory] = useState("30");
  const [isTimed, setIsTimed] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState("7");

  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createSession = useCreateTypingSession();

  // Difficulty is no longer a user-facing step (the wizard is Language → Speed → Timing → Ready);
  // the speed category already expresses how demanding the passage is.
  const randomPassageParams = {
    language,
    speedCategory: Number(speedCategory),
    difficulty: GetRandomPassageDifficulty.easy,
  };
  const { refetch: fetchPassage, isFetching } = useGetRandomPassage(randomPassageParams, {
    query: { enabled: false, queryKey: getGetRandomPassageQueryKey(randomPassageParams) },
  });

  const handleStart = async () => {
    try {
      const passageRes = await fetchPassage();
      const passage = passageRes.data;
      if (!passage) {
        toast({
          title: "No passage found",
          description: "Could not find a passage matching these settings.",
          variant: "destructive",
        });
        return;
      }

      createSession.mutate(
        { data: { passageId: passage.id, language: language as never } },
        {
          onSuccess: (session) => {
            // The typing-session API has no duration field, so the timing choice is handed to the
            // session page out-of-band, keyed by session id.
            writePracticeConfig(session.id, {
              isTimed,
              durationMinutes: isTimed ? Number(durationMinutes) : null,
              speedCategory: Number(speedCategory),
            });
            setLocation(`/practice/${session.id}`);
          },
          onError: () =>
            toast({ title: "Error", description: "Failed to create practice session.", variant: "destructive" }),
        },
      );
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    }
  };

  const isBusy = isFetching || createSession.isPending;
  const languageLabel = LANGUAGES.find((l) => l.value === language)?.label ?? language;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Speed Practice</h1>
        <p className="text-muted-foreground mt-1">Set up your practice to match real exam conditions.</p>
      </div>

      <Card>
        <CardHeader className="pb-6">
          <Stepper steps={STEPS} current={step} />
        </CardHeader>

        <CardContent className="space-y-6 min-h-[260px]">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Languages className="h-5 w-5 text-primary" />Choose your language
                </CardTitle>
                <CardDescription className="mt-1">
                  Marathi and Hindi share one Devanagari Remington layout, matching CDAC GIST.
                </CardDescription>
              </div>
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Language">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    role="radio"
                    aria-checked={language === l.value}
                    onClick={() => setLanguage(l.value)}
                    className={`text-left rounded-xl border-2 p-4 transition-colors ${
                      language === l.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{l.label}</span>
                      {language === l.value && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{l.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />Target speed
                </CardTitle>
                <CardDescription className="mt-1">
                  Picks a passage graded for this words-per-minute category.
                </CardDescription>
              </div>
              <div className="max-w-xs space-y-2">
                <label className="text-sm font-medium" htmlFor="speed-select">Words per minute</label>
                <Select value={speedCategory} onValueChange={setSpeedCategory}>
                  <SelectTrigger id="speed-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPEEDS.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s} WPM</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Timer className="h-5 w-5 text-primary" />Practice with a time limit?
                </CardTitle>
                <CardDescription className="mt-1">
                  A timed run auto-submits when the clock runs out, exactly like the real exam.
                </CardDescription>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 max-w-lg" role="radiogroup" aria-label="Timed practice">
                {[
                  { value: true, label: "Yes, timed", hint: "Countdown, auto-submit at zero" },
                  { value: false, label: "No, untimed", hint: "Counts up; submit when you're done" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="radio"
                    aria-checked={isTimed === opt.value}
                    onClick={() => setIsTimed(opt.value)}
                    className={`text-left rounded-xl border-2 p-4 transition-colors ${
                      isTimed === opt.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{opt.label}</span>
                      {isTimed === opt.value && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{opt.hint}</p>
                  </button>
                ))}
              </div>
              {isTimed && (
                <div className="max-w-xs space-y-2 pt-2">
                  <label className="text-sm font-medium" htmlFor="duration-select">Duration</label>
                  <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                    <SelectTrigger id="duration-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATIONS.map((d) => (
                        <SelectItem key={d} value={String(d)}>{d} minutes</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />Ready to start
                </CardTitle>
                <CardDescription className="mt-1">Review your setup, then begin.</CardDescription>
              </div>
              <dl className="rounded-xl border divide-y">
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-muted-foreground">Language</dt>
                  <dd className="text-sm font-medium">{languageLabel}</dd>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-muted-foreground">Target speed</dt>
                  <dd className="text-sm font-medium">{speedCategory} WPM</dd>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-muted-foreground">Time limit</dt>
                  <dd className="text-sm font-medium">{isTimed ? `${durationMinutes} minutes` : "Untimed"}</dd>
                </div>
              </dl>
            </div>
          )}
        </CardContent>

        <CardFooter className="bg-muted/50 flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || isBusy}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Next<ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={isBusy} size="lg">
              {isBusy ? "Preparing..." : (<><Play className="h-4 w-4 mr-2" />Start Practice</>)}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

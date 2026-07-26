import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stepper } from "@/components/stepper";
import { GetRandomPassageLanguage } from "@workspace/api-client-react";
import { Play, ArrowLeft, ArrowRight, Languages, Gauge, Timer, ClipboardCheck, Check, Zap } from "lucide-react";
import { useStartPracticeSession } from "@/hooks/use-start-practice-session";
import { readLastSettings, type LastPracticeSettings } from "@/lib/practice-config";

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
  // Returning students shouldn't re-answer four questions every session: the wizard opens
  // pre-filled with their last-used settings, and a one-click quick-start card skips it entirely.
  const lastSettings = useMemo(() => readLastSettings(), []);

  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<GetRandomPassageLanguage>(
    (lastSettings?.language as GetRandomPassageLanguage) ?? GetRandomPassageLanguage.english,
  );
  const [speedCategory, setSpeedCategory] = useState(String(lastSettings?.speedCategory ?? 30));
  const [isTimed, setIsTimed] = useState(lastSettings?.isTimed ?? true);
  const [durationMinutes, setDurationMinutes] = useState(String(lastSettings?.durationMinutes ?? 7));

  const { start, isStarting } = useStartPracticeSession();

  const settingsFromWizard = (): LastPracticeSettings => ({
    language: language as LastPracticeSettings["language"],
    speedCategory: Number(speedCategory),
    isTimed,
    durationMinutes: isTimed ? Number(durationMinutes) : null,
  });

  const handleStart = () => start(settingsFromWizard());

  const isBusy = isStarting;
  const languageLabel = LANGUAGES.find((l) => l.value === language)?.label ?? language;

  const describe = (s: LastPracticeSettings) =>
    `${LANGUAGES.find((l) => l.value === s.language)?.label ?? s.language} · ${s.speedCategory} WPM · ${
      s.isTimed ? `${s.durationMinutes} min` : "untimed"
    }`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Speed Practice</h1>
        <p className="text-muted-foreground mt-1">Set up your practice to match real exam conditions.</p>
      </div>

      {/* One-click resume with last-used settings */}
      {lastSettings && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 px-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary flex-shrink-0">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Continue where you left off</p>
                <p className="text-xs text-muted-foreground">{describe(lastSettings)}</p>
              </div>
            </div>
            <Button onClick={() => start(lastSettings)} disabled={isBusy} className="gap-2">
              {isBusy ? "Starting..." : (<><Play className="h-4 w-4" /> Start now</>)}
            </Button>
          </CardContent>
        </Card>
      )}

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

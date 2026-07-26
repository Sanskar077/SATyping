/**
 * GettingStarted — what a brand-new student sees instead of a dashboard full of zeros.
 *
 * Rendered by dashboard.tsx when the account has no completed sessions or test attempts. This is
 * the moment right after someone paid — a grid of "0 WPM / 0% / 0 sessions" reads as "nothing
 * works", which is exactly the wrong first impression. Instead: a clear three-step path into the
 * product, ordered the way a Remington novice should actually proceed.
 */
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Keyboard, GraduationCap, Play, ArrowRight, Sparkles } from "lucide-react";

const STEPS = [
  {
    icon: Keyboard,
    step: "Step 1",
    title: "Meet the keyboard",
    desc: "See which key produces which Marathi character on the official ISM Remington layout.",
    href: "/keyboard",
    cta: "Open keyboard reference",
  },
  {
    icon: GraduationCap,
    step: "Step 2",
    title: "Learn key by key",
    desc: "Guided lessons build finger memory from the home row outward — no guessing.",
    href: "/curriculum",
    cta: "Start the curriculum",
  },
  {
    icon: Play,
    step: "Step 3",
    title: "Type your first passage",
    desc: "A real exam-style passage with the on-screen keyboard guiding every keystroke.",
    href: "/practice",
    cta: "Start practicing",
    primary: true,
  },
] as const;

export function GettingStarted({ userName }: { userName?: string }) {
  return (
    <div className="space-y-8" data-testid="getting-started">
      <div className="text-center max-w-xl mx-auto pt-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-5">
          <Sparkles className="h-3.5 w-3.5" />
          Welcome{userName ? `, ${userName.split(" ")[0]}` : ""}!
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Let's get you typing</h1>
        <p className="text-muted-foreground">
          Three steps from zero to your first scored passage. Your stats will appear here once you
          complete a session.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
        {STEPS.map(({ icon: Icon, step, title, desc, href, cta, ...rest }) => {
          const primary = "primary" in rest && rest.primary === true;
          return (
            <Card
              key={href}
              className={`flex flex-col glass-rise glass-interactive ${primary ? "border-primary/40 shadow-md" : ""}`}
            >
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-4">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${primary ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{step}</span>
                </div>
                <h3 className="font-semibold mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-4">{desc}</p>
                <Button variant={primary ? "default" : "outline"} size="sm" className="w-full gap-1.5" asChild>
                  <Link href={href}>
                    {cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Already know the layout? Jump straight to{" "}
        <Link href="/practice" className="text-primary hover:underline">practice</Link> or the{" "}
        <Link href="/notepad" className="text-primary hover:underline">free-typing notepad</Link>.
      </p>
    </div>
  );
}

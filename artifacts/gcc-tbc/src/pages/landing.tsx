import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Keyboard,
  Award,
  TrendingUp,
  BookOpen,
  BarChart2,
  History,
  Zap,
  Users,
  CheckCircle2,
  ArrowRight,
  Target,
  Clock,
  Shield,
} from "lucide-react";

// ─── Feature data ────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Keyboard,
    title: "Real Exam Environment",
    desc: "Practice in an interface that exactly mimics the GCC-TBC testing software — same timer, same layout, same pressure.",
  },
  {
    icon: Activity,
    title: "ISM Remington Support",
    desc: "Full ISM Remington V6 (CDAC) keyboard engine for Marathi typing — including the ि pre-consonant buffer and all standard matras.",
  },
  {
    icon: TrendingUp,
    title: "Live WPM & Accuracy Chart",
    desc: "Watch your speed and accuracy evolve in real time during every session with an in-session WPM timeline graph.",
  },
  {
    icon: BarChart2,
    title: "Performance Analytics",
    desc: "Deep insights into WPM, accuracy, and error patterns across sessions. Spot weak spots before the exam does.",
  },
  {
    icon: BookOpen,
    title: "Structured Curriculum",
    desc: "Guided learning paths for Marathi and English — from individual key groups to full exam-speed passages.",
  },
  {
    icon: Zap,
    title: "Targeted Drills",
    desc: "Finger-specific and character-group drills that isolate the exact keys slowing you down.",
  },
  {
    icon: History,
    title: "Full Session History",
    desc: "Every practice session is saved with a detailed replay and per-keystroke breakdown you can review anytime.",
  },
  {
    icon: Award,
    title: "Exam & Mock Tests",
    desc: "Full-length timed mock tests that mirror the official GCC-TBC pattern — compete, submit, and see your grade.",
  },
  {
    icon: Users,
    title: "Institute Management",
    desc: "Institutes can enrol students, assign tests, and track batch progress from a dedicated admin dashboard.",
  },
];

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "9", label: "Core Features", sub: "built for GCC-TBC" },
  { value: "ISM V6", label: "Keyboard Engine", sub: "CDAC Remington" },
  { value: "Real-time", label: "Analytics", sub: "per keystroke" },
  { value: "Free", label: "Trial", sub: "no card needed" },
];

// ─── Plan highlights ──────────────────────────────────────────────────────────

const PLAN_HIGHLIGHTS = [
  "Unlimited practice sessions",
  "Full exam simulation mode",
  "Curriculum + drills access",
  "Performance analytics dashboard",
  "Session history & replay",
  "ISM Remington keyboard engine",
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-16 border-b border-border flex items-center justify-between px-6 lg:px-16 sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl tracking-tight">GCC-TBC Pro</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#plans" className="hover:text-foreground transition-colors">Plans</a>
          <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden md:block">
            Sign In
          </Link>
          <Button asChild size="sm">
            <Link href="/register">
              Get Started <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col">

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="py-24 lg:py-32 px-6 lg:px-16 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-8 gap-2">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            The Standard for GCC-TBC Preparation
          </div>

          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-foreground mb-6 max-w-4xl leading-[1.08]">
            Master the keyboard.<br />
            <span className="text-primary">Clear the exam.</span>
          </h1>

          <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
            GCC-TBC Pro is a full-stack Marathi typing platform built for Maharashtra government exam aspirants.
            Practice with the official ISM Remington layout, track every keystroke, and walk into your exam confident.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Button size="lg" className="text-base px-8 h-13 gap-2" asChild>
              <Link href="/register">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 h-13" asChild>
              <Link href="/plans">View Plans</Link>
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-3xl">
            {STATS.map(({ value, label, sub }) => (
              <div key={label} className="flex flex-col items-center p-4 rounded-xl border border-border bg-card shadow-sm">
                <span className="text-2xl font-extrabold text-primary leading-none mb-0.5">{value}</span>
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground">{sub}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────────────────── */}
        <section id="features" className="py-24 px-6 lg:px-16 bg-muted/30 border-y border-border">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Everything you need</p>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-4">
                9 features, one goal — pass GCC-TBC
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto text-base">
                Every feature is designed around real exam requirements, so you practise exactly what the test demands.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="group bg-card p-7 rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
                >
                  <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 mb-5 group-hover:bg-primary/15 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Why section ────────────────────────────────────────────────────── */}
        <section className="py-24 px-6 lg:px-16">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Built for the exam</p>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-6">
                Why GCC-TBC Pro beats random typing sites
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Generic typing tutors teach you QWERTY English. GCC-TBC Pro is laser-focused on the official ISM Remington
                Marathi layout and the exact passage difficulty used in Maharashtra government exams.
              </p>
              <ul className="space-y-4">
                {[
                  { icon: Target,  text: "Passages curated to match real GCC-TBC difficulty" },
                  { icon: Clock,   text: "Timed exam simulation with auto-submit" },
                  { icon: Shield,  text: "CDAC ISM V6 Remington engine — no shortcuts" },
                  { icon: BarChart2, text: "Per-character error analytics, not just WPM" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-3 w-3 text-primary" />
                    </span>
                    <span className="text-muted-foreground">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Visual card mock */}
            <div className="relative">
              <div className="rounded-2xl border border-border bg-card shadow-lg p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Live Session</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">● Active</span>
                </div>
                {/* Fake WPM bar */}
                <div className="space-y-2">
                  {[
                    { label: "WPM", val: 42, max: 60 },
                    { label: "Accuracy", val: 96, max: 100 },
                    { label: "Progress", val: 68, max: 100 },
                  ].map(({ label, val, max }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{label}</span>
                        <span className="font-medium text-foreground">{val}{label !== "WPM" ? "%" : ""}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(val / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Fake typing area */}
                <div className="rounded-lg bg-muted/60 p-4 text-sm font-mono leading-7 text-muted-foreground select-none">
                  <span className="text-foreground bg-primary/10 rounded px-0.5">महाराष्ट्र</span>{" "}
                  <span className="text-foreground">शासनाच्या</span>{" "}
                  <span className="border-l-2 border-primary animate-pulse">&nbsp;</span>
                  <span className="opacity-40"> सेवेत आपले स्वागत आहे।</span>
                </div>
                {/* Keyboard row hint */}
                <div className="flex gap-1.5 flex-wrap">
                  {["s→क", "k→त", "j→र", "x→ी", "f→ि"].map((hint) => (
                    <span key={hint} className="text-[10px] px-2 py-0.5 rounded border border-border bg-muted font-mono text-muted-foreground">
                      {hint}
                    </span>
                  ))}
                </div>
              </div>
              {/* decorative blur */}
              <div className="absolute -z-10 -bottom-6 -right-6 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            </div>
          </div>
        </section>

        {/* ── Plans teaser ──────────────────────────────────────────────────── */}
        <section id="plans" className="py-24 px-6 lg:px-16 bg-muted/30 border-y border-border">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Simple pricing</p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-4">
              Start free. Upgrade when ready.
            </h2>
            <p className="text-muted-foreground mb-10">
              Every plan includes the full ISM Remington engine, curriculum, and exam simulation.
              No feature gating — just more practice time.
            </p>

            <div className="bg-card rounded-2xl border border-border shadow-sm p-8 text-left mb-8">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold">What's included in every plan</h3>
                  <p className="text-sm text-muted-foreground">All features, no partial access</p>
                </div>
                <Button asChild>
                  <Link href="/plans">See Full Pricing</Link>
                </Button>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLAN_HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="px-10 gap-2" asChild>
                <Link href="/register">
                  Create Free Account <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="px-10" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="py-8 px-6 lg:px-16 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">GCC-TBC Pro</span>
            <span className="ml-2">&copy; {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <Link href="/plans" className="hover:text-foreground transition-colors">Plans</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Register</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

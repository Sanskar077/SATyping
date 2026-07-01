import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Activity, Keyboard, Award, TrendingUp, CheckCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-16 border-b border-border flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl tracking-tight">SATyping</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </Link>
          <Button asChild>
            <Link href="/register">Get Started</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="py-24 px-6 lg:px-12 flex flex-col items-center text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-8">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2"></span>
            The Standard for GCC-TBC Preparation
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-foreground mb-6">
            Master the keyboard.<br/>Clear the exam.
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl">
            A professional training cockpit for English, Hindi, and Marathi typing exams. Track your WPM, analyze accuracy, and earn certificates.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="text-base px-8 h-14" asChild>
              <Link href="/register">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 h-14" asChild>
              <Link href="/plans">View Plans</Link>
            </Button>
          </div>
        </section>

        <section className="py-20 bg-muted/30 px-6 lg:px-12 border-y border-border">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-xl border border-border shadow-sm">
              <Keyboard className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Real Exam Environment</h3>
              <p className="text-muted-foreground">Practice in an interface that exactly mimics the actual GCC-TBC testing software.</p>
            </div>
            <div className="bg-card p-8 rounded-xl border border-border shadow-sm">
              <TrendingUp className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Performance Analytics</h3>
              <p className="text-muted-foreground">Deep insights into your WPM, accuracy, and error patterns across different speed categories.</p>
            </div>
            <div className="bg-card p-8 rounded-xl border border-border shadow-sm">
              <Award className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">Verified Certificates</h3>
              <p className="text-muted-foreground">Earn publicly verifiable certificates as you pass speed tests at 30, 40, 50, and 60 WPM.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 px-6 lg:px-12 border-t border-border flex flex-col md:flex-row items-center justify-between text-sm text-muted-foreground">
        <div>&copy; 2026 SATyping. All rights reserved.</div>
        <div className="flex gap-4 mt-4 md:mt-0">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}

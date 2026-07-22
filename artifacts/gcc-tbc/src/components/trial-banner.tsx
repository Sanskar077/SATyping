import { Link } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TrialBannerProps {
  accountStatus?: string;
  trialEndsAt?: string | null;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function TrialBanner({ accountStatus, trialEndsAt }: TrialBannerProps) {
  if (accountStatus !== "trial" || !trialEndsAt) return null;

  const endsAt = new Date(trialEndsAt).getTime();
  const msRemaining = endsAt - Date.now();
  if (msRemaining > THREE_DAYS_MS) return null;

  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));
  const expired = msRemaining <= 0;

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 ${
        expired ? "border-destructive/40 bg-destructive/10" : "border-amber-500/40 bg-amber-500/10"
      }`}
      data-testid="trial-banner"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className={`h-5 w-5 flex-shrink-0 ${expired ? "text-destructive" : "text-amber-600"}`} />
        <p className="text-sm">
          {expired
            ? "Your trial has ended. Upgrade to keep practicing and taking exams."
            : `Your trial ends in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`}
        </p>
      </div>
      <Button size="sm" asChild>
        <Link href="/plans">Upgrade now</Link>
      </Button>
    </div>
  );
}

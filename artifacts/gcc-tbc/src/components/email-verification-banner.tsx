import { useState } from "react";
import { useResendVerification } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { MailWarning } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailVerificationBannerProps {
  emailVerified?: boolean;
}

export function EmailVerificationBanner({ emailVerified }: EmailVerificationBannerProps) {
  const { toast } = useToast();
  const resendVerification = useResendVerification();
  const [sent, setSent] = useState(false);

  if (emailVerified !== false) return null;

  const handleResend = () => {
    resendVerification.mutate(undefined, {
      onSuccess: () => {
        setSent(true);
        toast({ title: "Verification email sent", description: "Check your inbox for the link." });
      },
      onError: () => toast({ title: "Failed to send email", variant: "destructive" }),
    });
  };

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3"
      data-testid="email-verification-banner"
    >
      <div className="flex items-center gap-3">
        <MailWarning className="h-5 w-5 flex-shrink-0 text-amber-600" />
        <p className="text-sm">Please verify your email address.</p>
      </div>
      <Button size="sm" variant="outline" onClick={handleResend} disabled={resendVerification.isPending || sent}>
        {sent ? "Sent" : resendVerification.isPending ? "Sending..." : "Resend email"}
      </Button>
    </div>
  );
}

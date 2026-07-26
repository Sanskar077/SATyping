import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useVerifyEmail } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token");
  const verifyEmail = useVerifyEmail();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token found in the link.");
      return;
    }
    verifyEmail.mutate(
      { data: { token } },
      {
        onSuccess: () => setStatus("success"),
        onError: (err: any) => {
          setStatus("error");
          setErrorMessage(err?.data?.error || "This verification link is invalid or has expired.");
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-4">
        {status === "pending" && (
          <>
            <Loader2 className="h-14 w-14 text-primary mx-auto animate-spin" />
            <h1 className="text-2xl font-bold">Verifying your email...</h1>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Email verified</h1>
            <p className="text-muted-foreground">Your email address has been verified successfully.</p>
            <Link href="/dashboard">
              <Button className="mt-2">Go to dashboard</Button>
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-14 w-14 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold">Verification failed</h1>
            <p className="text-muted-foreground">{errorMessage}</p>
            <Link href="/dashboard">
              <Button variant="outline" className="mt-2">Go to dashboard</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

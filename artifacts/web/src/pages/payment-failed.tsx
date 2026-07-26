import { Link } from "wouter";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentFailed() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-4">
        <XCircle className="h-14 w-14 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">Payment not completed</h1>
        <p className="text-muted-foreground">
          Your payment was cancelled or didn't go through. No amount has been charged. You can try
          again anytime.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link href="/plans">
            <Button>Try again</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Go to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

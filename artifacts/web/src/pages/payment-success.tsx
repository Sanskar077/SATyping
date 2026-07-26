import { useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey, getListMyPaymentsQueryKey } from "@workspace/api-client-react";

export default function PaymentSuccess() {
  const search = useSearch();
  const paymentId = new URLSearchParams(search).get("paymentId");
  const queryClient = useQueryClient();

  useEffect(() => {
    // The webhook is what actually activates the subscription server-side, often a few seconds
    // after this redirect — refresh the cached user/payment state so the UI catches up.
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListMyPaymentsQueryKey() });
  }, [queryClient]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md space-y-4">
        <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
        <h1 className="text-2xl font-bold">Payment received</h1>
        <p className="text-muted-foreground">
          {paymentId ? `Payment #${paymentId} is being confirmed. ` : ""}
          Your plan will activate automatically once the payment is verified — usually within a
          few seconds.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link href="/billing">
            <Button variant="outline">View billing</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

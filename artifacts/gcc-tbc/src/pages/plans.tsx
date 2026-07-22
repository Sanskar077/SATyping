import { useState } from "react";
import { useLocation } from "wouter";
import { useListPlans, useValidateOffer, useCreateCheckout, useGetMySubscription, getValidateOfferQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Building2, Star, ShieldCheck, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Plans() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const forInstitute = user?.role === "institute_admin";
  const { data: plansData, isLoading: plansLoading } = useListPlans({ forInstitute });
  const { data: subscription } = useGetMySubscription();

  const [offerCodeDraft, setOfferCodeDraft] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [appliedOfferCode, setAppliedOfferCode] = useState<string | undefined>(undefined);

  const offerParams = { code: appliedOfferCode ?? "", planId: selectedPlanId ?? 0 };
  const { data: offerPreview, isFetching: validatingOffer } = useValidateOffer(
    offerParams,
    { query: { enabled: !!appliedOfferCode && !!selectedPlanId, retry: false, queryKey: getValidateOfferQueryKey(offerParams) } }
  );

  const checkoutMutation = useCreateCheckout();

  const plans = plansData?.plans ?? [];

  const handleApplyOffer = (planId: number) => {
    setSelectedPlanId(planId);
    setAppliedOfferCode(offerCodeDraft.trim() || undefined);
  };

  const handleCheckout = (planId: number) => {
    checkoutMutation.mutate(
      { data: { planId, ...(appliedOfferCode && selectedPlanId === planId ? { offerCode: appliedOfferCode } : {}) } },
      {
        onSuccess: (checkout) => {
          loadRazorpayCheckout(checkout, toast, setLocation);
        },
        onError: (err: any) => {
          const msg = err?.data?.error || "Could not start checkout. Please try again.";
          toast({ title: "Checkout failed", description: msg, variant: "destructive" });
          setLocation("/payment-failed");
        },
      }
    );
  };

  if (plansLoading) {
    return <div className="text-center py-20 text-muted-foreground">Loading plans...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Choose your plan</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          An active plan is required to practice, take exams, and access every feature.
        </p>
      </div>

      <CurrentPlanCard subscription={subscription} user={user} />

      <div className="max-w-sm mx-auto flex gap-2">
        <Input
          placeholder="Have an offer code?"
          value={offerCodeDraft}
          onChange={(e) => setOfferCodeDraft(e.target.value)}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isFree = plan.priceInPaise === 0;
          const showingDiscount = selectedPlanId === plan.id && appliedOfferCode && offerPreview;

          return (
            <Card
              key={plan.id}
              className="relative flex flex-col"
              data-testid={`plan-card-${plan.id}`}
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto p-3 rounded-xl mb-3 w-fit bg-muted text-muted-foreground">
                  {plan.forInstitute ? <Building2 className="h-6 w-6" /> : <Star className="h-6 w-6" />}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-2">
                  {isFree ? (
                    <p className="text-4xl font-black">Free</p>
                  ) : showingDiscount ? (
                    <div>
                      <span className="text-sm text-muted-foreground line-through mr-2">
                        ₹{(plan.priceInPaise / 100).toFixed(0)}
                      </span>
                      <span className="text-4xl font-black">₹{(offerPreview!.finalAmountInPaise / 100).toFixed(0)}</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-4xl font-black">₹{(plan.priceInPaise / 100).toFixed(0)}</span>
                      <span className="text-muted-foreground text-sm">/{plan.durationDays}d</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                <ul className="space-y-2.5 flex-1">
                  {plan.features?.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {!isFree && offerCodeDraft && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline self-start"
                    onClick={() => handleApplyOffer(plan.id)}
                    disabled={validatingOffer && selectedPlanId === plan.id}
                  >
                    {validatingOffer && selectedPlanId === plan.id ? "Checking code..." : "Apply offer code"}
                  </button>
                )}

                <Button
                  className="w-full mt-2"
                  disabled={isFree || checkoutMutation.isPending}
                  onClick={() => handleCheckout(plan.id)}
                  data-testid={`button-upgrade-${plan.id}`}
                >
                  {isFree ? "Included" : checkoutMutation.isPending ? "Starting checkout..." : "Checkout"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Paid plans are billed once for the plan's full duration — no recurring auto-renewal.
      </p>
    </div>
  );
}

function loadRazorpayCheckout(
  checkout: { paymentId: number; gatewayOrderId: string; amount: number; currency: string; razorpayKeyId: string },
  toast: ReturnType<typeof useToast>["toast"],
  setLocation: (path: string) => void
) {
  const existingScript = document.getElementById("razorpay-checkout-js");
  const open = () => openRazorpayModal(checkout, toast, setLocation);

  if (existingScript) {
    open();
    return;
  }

  const script = document.createElement("script");
  script.id = "razorpay-checkout-js";
  script.src = "https://checkout.razorpay.com/v1/checkout.js";
  script.onload = open;
  script.onerror = () => {
    toast({ title: "Checkout failed", description: "Could not load the payment widget.", variant: "destructive" });
    setLocation("/payment-failed");
  };
  document.body.appendChild(script);
}

function openRazorpayModal(
  checkout: { paymentId: number; gatewayOrderId: string; amount: number; currency: string; razorpayKeyId: string },
  toast: ReturnType<typeof useToast>["toast"],
  setLocation: (path: string) => void
) {
  const Razorpay = (window as unknown as { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay;
  if (!Razorpay) {
    toast({ title: "Checkout failed", description: "Payment widget unavailable.", variant: "destructive" });
    setLocation("/payment-failed");
    return;
  }

  const rzp = new Razorpay({
    key: checkout.razorpayKeyId,
    order_id: checkout.gatewayOrderId,
    amount: checkout.amount,
    currency: checkout.currency,
    name: "GCC-TBC Pro",
    description: "Plan purchase",
    handler: () => {
      // Final activation happens via the server-verified webhook, not this client callback —
      // this redirect is just UX; payment-success.tsx polls for the real status.
      setLocation(`/payment-success?paymentId=${checkout.paymentId}`);
    },
    modal: {
      ondismiss: () => {
        setLocation("/payment-failed");
      },
    },
  });
  rzp.open();
}

function CurrentPlanCard({ subscription, user }: { subscription?: { plan: string; status: string; expiresAt?: string | null }; user: ReturnType<typeof useAuth>["user"] }) {
  if (!user) return null;

  const isPremiumGrant = user.premiumGrantedByOwner;
  const isOwner = user.role === "super_admin";

  if (isOwner) {
    return (
      <div className="max-w-2xl mx-auto flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
        <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
        <p className="text-sm">You're the platform Owner — full access, always.</p>
      </div>
    );
  }

  if (isPremiumGrant) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">Premium access</span> — granted manually by the Owner.
          </p>
        </div>
        <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Premium</Badge>
      </div>
    );
  }

  if (user.hasAccess && subscription && subscription.status === "active") {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
          <p className="text-sm">
            <span className="font-semibold capitalize">{subscription.plan.replace("_", " ")}</span> plan is active
            {subscription.expiresAt && (
              <> — renews/expires {new Date(subscription.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>
            )}
          </p>
        </div>
        <Badge>Active</Badge>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4">
      <p className="text-sm">No active plan — practice, exams, and other features are locked until you subscribe.</p>
      <Badge variant="destructive">No access</Badge>
    </div>
  );
}

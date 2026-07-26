import { useState } from "react";
import { useLocation } from "wouter";
import { useListPlans, useValidateOffer, useCreateCheckout, useGetMySubscription, useVerifyPayment, getValidateOfferQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageLoading } from "@/components/page-loading";
import { Check, Building2, Star, ShieldCheck, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Plans() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  // Show EVERY active plan to everyone — students should be able to see what an institute plan
  // offers (and vice versa) even though checkout enforces the audience server-side. Purchasability
  // is handled per-card below, not by hiding plans.
  const { data: plansData, isLoading: plansLoading } = useListPlans();
  const { data: subscription } = useGetMySubscription();

  // The server rejects a checkout whose plan audience doesn't match the buyer's role
  // (routes/payments.ts): institute plans are purchasable only by institute admins, student plans
  // by everyone else. Mirror that rule here so the button state is honest instead of letting the
  // user click into a guaranteed 400.
  const canPurchase = (plan: { forInstitute: boolean }) =>
    plan.forInstitute ? user?.role === "institute_admin" : user?.role !== "institute_admin";

  const [offerCodeDraft, setOfferCodeDraft] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [appliedOfferCode, setAppliedOfferCode] = useState<string | undefined>(undefined);

  const offerParams = { code: appliedOfferCode ?? "", planId: selectedPlanId ?? 0 };
  const { data: offerPreview, isFetching: validatingOffer } = useValidateOffer(
    offerParams,
    { query: { enabled: !!appliedOfferCode && !!selectedPlanId, retry: false, queryKey: getValidateOfferQueryKey(offerParams) } }
  );

  const checkoutMutation = useCreateCheckout();
  const verifyPaymentMutation = useVerifyPayment();
  const queryClient = useQueryClient();

  const plans = plansData?.plans ?? [];

  /**
   * Sends Razorpay's signed checkout result to the server for verification. Failure here is not
   * fatal — the webhook performs the identical activation — so the user still lands on the
   * success page and the plan activates a moment later.
   */
  const verifyPayment = (response: RazorpayHandlerResponse) => {
    verifyPaymentMutation.mutate(
      {
        data: {
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        },
      },
      {
        onSuccess: () => {
          // hasAccess flips server-side on activation; refresh so gated routes unlock immediately.
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
      },
    );
  };

  const handleApplyOffer = (planId: number) => {
    setSelectedPlanId(planId);
    setAppliedOfferCode(offerCodeDraft.trim() || undefined);
  };

  const handleCheckout = (planId: number) => {
    checkoutMutation.mutate(
      { data: { planId, ...(appliedOfferCode && selectedPlanId === planId ? { offerCode: appliedOfferCode } : {}) } },
      {
        onSuccess: (checkout) => {
          loadRazorpayCheckout(checkout, toast, setLocation, verifyPayment);
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
    return <PageLoading label="Loading plans..." />;
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
          const purchasable = canPurchase(plan);

          return (
            <Card
              key={plan.id}
              className="relative flex flex-col"
              data-testid={`plan-card-${plan.id}`}
            >
              {plan.forInstitute && (
                <Badge variant="secondary" className="absolute top-3 right-3">For institutes</Badge>
              )}
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
                  disabled={isFree || !purchasable || checkoutMutation.isPending}
                  onClick={() => handleCheckout(plan.id)}
                  data-testid={`button-upgrade-${plan.id}`}
                >
                  {isFree
                    ? "Included"
                    : !purchasable
                      ? plan.forInstitute ? "Institute accounts only" : "Student accounts only"
                      : checkoutMutation.isPending ? "Starting checkout..." : "Checkout"}
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
  setLocation: (path: string) => void,
  verifyPayment: VerifyPaymentFn,
) {
  const existingScript = document.getElementById("razorpay-checkout-js");
  const open = () => openRazorpayModal(checkout, toast, setLocation, verifyPayment);

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

/** The three fields Razorpay hands back once the customer completes payment. */
interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

type VerifyPaymentFn = (payload: RazorpayHandlerResponse) => void;

function openRazorpayModal(
  checkout: { paymentId: number; gatewayOrderId: string; amount: number; currency: string; razorpayKeyId: string },
  toast: ReturnType<typeof useToast>["toast"],
  setLocation: (path: string) => void,
  verifyPayment: VerifyPaymentFn,
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
    name: "SATyping",
    description: "Plan purchase",
    handler: (response: RazorpayHandlerResponse) => {
      // Post the signed result back for server-side verification. The webhook performs the same
      // activation and the two are idempotent, so whichever lands first wins — but the webhook
      // can't reach a localhost server, which is why this path is what makes sandbox testing
      // work at all. The signature is verified server-side; nothing here is trusted.
      verifyPayment(response);
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

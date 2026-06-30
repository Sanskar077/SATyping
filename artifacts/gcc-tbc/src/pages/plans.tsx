import { useGetPlans, useUpgradeSubscription, useGetMySubscription, getGetMySubscriptionQueryKey, getGetPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Zap, Building2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Plans() {
  const { data: plans, isLoading: plansLoading } = useGetPlans({
    query: { queryKey: getGetPlansQueryKey() },
  });
  const { data: mySubscription } = useGetMySubscription({
    query: { queryKey: getGetMySubscriptionQueryKey() },
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const upgradeMutation = useUpgradeSubscription();

  const planIcons: Record<string, React.ReactNode> = {
    free: <Zap className="h-6 w-6" />,
    pro_student: <Star className="h-6 w-6" />,
    institute: <Building2 className="h-6 w-6" />,
  };

  const handleUpgrade = (planId: string) => {
    upgradeMutation.mutate({ data: { plan: planId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMySubscriptionQueryKey() });
        toast({ title: "Subscription upgraded!", description: `You are now on the ${planId} plan.` });
      },
      onError: () => {
        toast({ title: "Upgrade failed", description: "Please try again.", variant: "destructive" });
      },
    });
  };

  if (plansLoading) {
    return <div className="text-center py-20 text-muted-foreground">Loading plans...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-10 py-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Choose your plan</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Invest in your typing career. Start free, upgrade when ready.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans?.map((plan) => {
          const isCurrent = mySubscription?.plan === plan.id;
          const isPopular = plan.isPopular;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${isPopular ? "border-primary shadow-lg ring-2 ring-primary/30" : ""}`}
              data-testid={`plan-card-${plan.id}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <div className={`mx-auto p-3 rounded-xl mb-3 w-fit ${isPopular ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {planIcons[plan.id] ?? <Zap className="h-6 w-6" />}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-2">
                  {plan.price === 0 ? (
                    <p className="text-4xl font-black">Free</p>
                  ) : (
                    <div>
                      <span className="text-4xl font-black">₹{plan.price}</span>
                      <span className="text-muted-foreground text-sm">/{plan.billingPeriod}</span>
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
                <Button
                  className="w-full mt-4"
                  variant={isPopular ? "default" : "outline"}
                  disabled={isCurrent || upgradeMutation.isPending}
                  onClick={() => !isCurrent && plan.price > 0 && handleUpgrade(plan.id)}
                  data-testid={`button-upgrade-${plan.id}`}
                >
                  {isCurrent ? "Current Plan" : plan.price === 0 ? "Get Started Free" : "Upgrade Now"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        All plans include a 7-day free trial. No credit card required for Free plan.
        GST applicable on paid plans.
      </p>
    </div>
  );
}

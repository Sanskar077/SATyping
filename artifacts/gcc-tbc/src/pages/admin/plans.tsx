import { useListPlans, useCreatePlan, useUpdatePlan, getListPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const planSchema = z.object({
  name: z.string().min(2, "Name is required"),
  priceInPaise: z.coerce.number().min(0),
  durationDays: z.coerce.number().min(1),
  forInstitute: z.boolean().default(false),
});

export default function AdminPlans() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListPlans(undefined, { query: { queryKey: getListPlansQueryKey() } });
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();

  const form = useForm<z.infer<typeof planSchema>>({
    resolver: zodResolver(planSchema),
    defaultValues: { name: "", priceInPaise: 0, durationDays: 30, forInstitute: false },
  });

  const plans = data?.plans ?? [];

  const onSubmit = (values: z.infer<typeof planSchema>) => {
    createPlan.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() });
        toast({ title: "Plan created" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ title: "Failed to create plan", variant: "destructive" }),
    });
  };

  const toggleActive = (id: number, isActive: boolean) => {
    updatePlan.mutate({ id, data: { isActive: !isActive } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlansQueryKey() });
        toast({ title: !isActive ? "Plan activated" : "Plan deactivated" });
      },
      onError: () => toast({ title: "Failed to update plan", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-plans-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plans</h1>
          <p className="text-muted-foreground mt-1">Manage pricing plans for students and institutes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-plan"><Plus className="mr-2 h-4 w-4" />New Plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Plan</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Pro Student — Quarterly" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="priceInPaise" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (paise)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="durationDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (days)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="forInstitute" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="mb-0">For institutes</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createPlan.isPending}>
                  {createPlan.isPending ? "Creating..." : "Create Plan"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading plans...</div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16">
          <Package className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No plans yet.</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>₹{(plan.priceInPaise / 100).toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{plan.durationDays} days</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{plan.forInstitute ? "Institute" : "Student"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={plan.isActive} onCheckedChange={() => toggleActive(plan.id, plan.isActive)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

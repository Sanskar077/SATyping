import { useListOffers, useCreateOffer, useUpdateOffer, getListOffersQueryKey } from "@workspace/api-client-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const offerSchema = z.object({
  code: z.string().min(3, "Code must be at least 3 characters").toUpperCase(),
  discountType: z.enum(["percent", "flat"]),
  discountValue: z.coerce.number().min(0),
});

export default function AdminOffers() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListOffers({ query: { queryKey: getListOffersQueryKey() } });
  const createOffer = useCreateOffer();
  const updateOffer = useUpdateOffer();

  const form = useForm<z.infer<typeof offerSchema>>({
    resolver: zodResolver(offerSchema),
    defaultValues: { code: "", discountType: "percent", discountValue: 10 },
  });

  const offers = data?.offers ?? [];

  const onSubmit = (values: z.infer<typeof offerSchema>) => {
    createOffer.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOffersQueryKey() });
        toast({ title: "Offer created" });
        setOpen(false);
        form.reset();
      },
      onError: (err: any) => toast({ title: err?.data?.error || "Failed to create offer", variant: "destructive" }),
    });
  };

  const toggleActive = (id: number, isActive: boolean) => {
    updateOffer.mutate({ id, data: { isActive: !isActive } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOffersQueryKey() });
        toast({ title: !isActive ? "Offer activated" : "Offer deactivated" });
      },
      onError: () => toast({ title: "Failed to update offer", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-offers-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offers</h1>
          <p className="text-muted-foreground mt-1">Discount codes for checkout</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-offer"><Plus className="mr-2 h-4 w-4" />New Offer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Offer</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. LAUNCH20" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="discountType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="percent">Percent</SelectItem>
                          <SelectItem value="flat">Flat (paise)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="discountValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={createOffer.isPending}>
                  {createOffer.isPending ? "Creating..." : "Create Offer"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading offers...</div>
      ) : offers.length === 0 ? (
        <div className="text-center py-16">
          <Tag className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No offers yet.</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Redeemed</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium font-mono">{offer.code}</TableCell>
                  <TableCell>
                    {offer.discountType === "percent" ? `${offer.discountValue}%` : `₹${(offer.discountValue / 100).toFixed(2)}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {offer.redemptionCount}{offer.maxRedemptions ? ` / ${offer.maxRedemptions}` : ""}
                  </TableCell>
                  <TableCell>
                    <Switch checked={offer.isActive} onCheckedChange={() => toggleActive(offer.id, offer.isActive)} />
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

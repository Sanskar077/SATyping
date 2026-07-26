import {
  useListInstitutes, useCreateInstitute, useApproveInstitute, useSuspendInstitute, useSetInstitutePremium, getListInstitutesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PageLoading } from "@/components/page-loading";
import { Plus, Search, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const instituteSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export default function AdminInstitutes() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListInstitutes(undefined, {
    query: { queryKey: getListInstitutesQueryKey() },
  });

  const createInstitute = useCreateInstitute();
  const approveInstitute = useApproveInstitute();
  const suspendInstitute = useSuspendInstitute();
  const setPremium = useSetInstitutePremium();

  const handlePremiumToggle = (id: number, premium: boolean) => {
    setPremium.mutate({ id, data: { premium } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInstitutesQueryKey() });
        toast({ title: premium ? "Premium granted" : "Premium revoked" });
      },
      onError: () => toast({ title: "Failed to update Premium status", variant: "destructive" }),
    });
  };

  const handleApprove = (id: number) => {
    approveInstitute.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInstitutesQueryKey() });
        toast({ title: "Institute approved" });
      },
      onError: () => toast({ title: "Failed to approve institute", variant: "destructive" }),
    });
  };

  const handleSuspend = (id: number) => {
    suspendInstitute.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInstitutesQueryKey() });
        toast({ title: "Institute suspended" });
      },
      onError: () => toast({ title: "Failed to suspend institute", variant: "destructive" }),
    });
  };

  const form = useForm<z.infer<typeof instituteSchema>>({
    resolver: zodResolver(instituteSchema),
    defaultValues: { name: "", email: "", phone: "", address: "" },
  });

  const institutes = (data?.institutes ?? []).filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || (i.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const onSubmit = (values: z.infer<typeof instituteSchema>) => {
    createInstitute.mutate({ data: values as Parameters<typeof createInstitute.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInstitutesQueryKey() });
        toast({ title: "Institute created" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ title: "Failed to create institute", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-institutes-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Institutes</h1>
          <p className="text-muted-foreground mt-1">All registered institutes on the platform</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-institute"><Plus className="mr-2 h-4 w-4" />New Institute</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Institute</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Institute Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Pune Typing Academy" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createInstitute.isPending}>
                  {createInstitute.isPending ? "Creating..." : "Create Institute"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search institutes..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <PageLoading label="Loading institutes..." />
      ) : institutes.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{search ? "No institutes match your search." : "No institutes registered."}</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Premium (Manual)</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutes.map(inst => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{inst.email}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize text-xs">{inst.subscriptionPlan}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={inst.isActive ? "default" : "secondary"} className="text-xs">
                      {inst.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={inst.accountStatus === "active" ? "default" : inst.accountStatus === "suspended" ? "destructive" : "secondary"}
                      className="capitalize text-xs"
                    >
                      {inst.accountStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={inst.premiumGrantedByOwner}
                        onCheckedChange={(checked) => handlePremiumToggle(inst.id, checked)}
                        disabled={setPremium.isPending}
                        data-testid={`switch-premium-institute-${inst.id}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {inst.premiumGrantedByOwner ? "Premium" : "Normal"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {inst.accountStatus !== "active" && (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => handleApprove(inst.id)}
                          disabled={approveInstitute.isPending}
                        >
                          Approve
                        </button>
                      )}
                      {inst.accountStatus !== "suspended" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="text-xs text-destructive hover:underline">Suspend</button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Suspend {inst.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This blocks the institute admin and its students from practicing or
                                taking exams until reactivated.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleSuspend(inst.id)}>Suspend</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
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

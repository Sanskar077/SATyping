import { useListInstitutes, useCreateInstitute, getListInstitutesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Search, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const instituteSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  affiliationCode: z.string().optional(),
});

export default function AdminInstitutes() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListInstitutes({
    query: { queryKey: getListInstitutesQueryKey() },
  });

  const createInstitute = useCreateInstitute();

  const form = useForm<z.infer<typeof instituteSchema>>({
    resolver: zodResolver(instituteSchema),
    defaultValues: { name: "", email: "", phone: "", address: "", city: "", state: "", affiliationCode: "" },
  });

  const institutes = (data?.institutes ?? []).filter(i =>
    !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.email.toLowerCase().includes(search.toLowerCase())
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="affiliationCode" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Affiliation Code</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. GCC-001" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
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
        <div className="text-center py-16 text-muted-foreground">Loading institutes...</div>
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
                <TableHead>City</TableHead>
                <TableHead>Affiliation Code</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutes.map(inst => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{inst.email}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{inst.city ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{inst.affiliationCode ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize text-xs">{inst.subscriptionPlan}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={inst.isActive ? "default" : "secondary"} className="text-xs">
                      {inst.isActive ? "Active" : "Inactive"}
                    </Badge>
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

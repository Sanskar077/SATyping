import { useListTests, useCreateTest, useDeleteTest, getListTestsQueryKey, TestInputSpeedCategory } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoading } from "@/components/page-loading";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const testSchema = z.object({
  name: z.string().min(2, "Title is required"),
  language: z.string().min(1, "Language is required"),
  durationMinutes: z.coerce.number().int().min(1).max(120),
  passageId: z.coerce.number().int().positive("Passage is required"),
  speedCategory: z.coerce.number().int().min(1) as unknown as z.ZodType<typeof TestInputSpeedCategory[keyof typeof TestInputSpeedCategory]>,
  minAccuracy: z.coerce.number().min(1).max(100),
});

type TestFormValues = z.infer<typeof testSchema>;

export default function InstituteTests() {
  const { user } = useAuth();
  const instituteId = user?.instituteId ?? 0;
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const testParams = { instituteId: instituteId || undefined };

  const { data, isLoading } = useListTests(testParams, {
    query: { enabled: !!instituteId, queryKey: getListTestsQueryKey(testParams) },
  });

  const createTest = useCreateTest();
  const deleteTest = useDeleteTest();

  const form = useForm<TestFormValues>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      name: "",
      language: "english",
      durationMinutes: 10,
      passageId: 1,
      speedCategory: TestInputSpeedCategory.NUMBER_30,
      minAccuracy: 80,
    },
  });

  const onSubmit = (values: TestFormValues) => {
    createTest.mutate(
      {
        data: {
          ...values,
          instituteId,
        } as Parameters<typeof createTest.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTestsQueryKey(testParams) });
          toast({ title: "Test created" });
          setOpen(false);
          form.reset();
        },
        onError: () => toast({ title: "Failed to create test", variant: "destructive" }),
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteTest.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTestsQueryKey(testParams) });
          toast({ title: "Test deleted" });
        },
        onError: () => toast({ title: "Failed to delete test", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6" data-testid="institute-tests-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tests</h1>
          <p className="text-muted-foreground mt-1">Create and manage typing exams for students</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-test">
              <Plus className="mr-2 h-4 w-4" />New Test
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Test</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Title</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. English Typing Test - Batch A" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="language" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="hindi">Hindi</SelectItem>
                          <SelectItem value="marathi">Marathi</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="durationMinutes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (min)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="speedCategory" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Speed Category (WPM)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="minAccuracy" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min Accuracy %</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="passageId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passage ID</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} placeholder="ID from passages library" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createTest.isPending}>
                  {createTest.isPending ? "Creating..." : "Create Test"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <PageLoading label="Loading tests..." />
      ) : !data?.tests.length ? (
        <div className="text-center py-16">
          <BookOpen className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">No tests created yet.</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Speed Cat.</TableHead>
                <TableHead>Min Acc</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tests.map(test => (
                <TableRow key={test.id}>
                  <TableCell className="font-medium">{test.name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{test.language}</TableCell>
                  <TableCell className="text-muted-foreground">{test.durationMinutes}m</TableCell>
                  <TableCell className="font-mono">{test.speedCategory}</TableCell>
                  <TableCell className="font-mono">{test.minAccuracy}%</TableCell>
                  <TableCell>
                    <Badge variant={test.isActive ? "default" : "secondary"} className="text-xs">
                      {test.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(test.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

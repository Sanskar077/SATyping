import { useCreatePassage, getListPassagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const passageSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  language: z.string().min(1, "Language is required"),
  difficulty: z.string().min(1, "Difficulty is required"),
  speedCategory: z.coerce.number().int().positive("Speed category is required"),
});

export default function NewPassage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof passageSchema>>({
    resolver: zodResolver(passageSchema),
    defaultValues: { title: "", content: "", language: "english", difficulty: "medium", speedCategory: 30 },
  });

  const createPassage = useCreatePassage();

  const onSubmit = (values: z.infer<typeof passageSchema>) => {
    createPassage.mutate({ data: { ...values, speedCategory: Number(values.speedCategory) } as Parameters<typeof createPassage.mutate>[0]["data"] }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPassagesQueryKey() });
        toast({ title: "Passage created" });
        setLocation("/passages");
      },
      onError: () => toast({ title: "Failed to create passage", variant: "destructive" }),
    });
  };

  const wordCount = form.watch("content")?.trim().split(/\s+/).filter(Boolean).length || 0;

  return (
    <div className="max-w-2xl space-y-6" data-testid="new-passage-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/passages"><ArrowLeft className="mr-2 h-4 w-4" />Back to Passages</Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Passage</h1>
        <p className="text-muted-foreground mt-1">Add a typing passage to the library</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Passage Details</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} placeholder="Enter passage title" data-testid="input-title" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="language" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-language"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="hindi">Hindi</SelectItem>
                        <SelectItem value="marathi">Marathi</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="difficulty" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Difficulty</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-difficulty"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="speedCategory" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Speed (WPM)</FormLabel>
                    <Select onValueChange={val => field.onChange(parseInt(val, 10))} defaultValue={String(field.value)}>
                      <FormControl>
                        <SelectTrigger data-testid="select-speed"><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="30">30 WPM</SelectItem>
                        <SelectItem value="40">40 WPM</SelectItem>
                        <SelectItem value="50">50 WPM</SelectItem>
                        <SelectItem value="60">60 WPM</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormLabel>Passage Content <span className="text-muted-foreground font-normal ml-1">({wordCount} words)</span></FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={8}
                      placeholder="Type or paste the passage text here..."
                      className="font-mono text-sm"
                      data-testid="textarea-content"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex gap-3">
                <Button type="submit" disabled={createPassage.isPending} data-testid="button-create">
                  {createPassage.isPending ? "Creating..." : "Create Passage"}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/passages">Cancel</Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

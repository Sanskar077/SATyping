import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  newPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

export default function ResetPassword() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const resetPassword = useResetPassword();
  const [done, setDone] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "" },
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <XCircle className="h-14 w-14 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Invalid link</h1>
          <p className="text-muted-foreground">No reset token found. Request a new password reset link.</p>
          <Link href="/forgot-password"><Button className="mt-2">Request reset link</Button></Link>
        </div>
      </div>
    );
  }

  const onSubmit = (data: z.infer<typeof schema>) => {
    resetPassword.mutate(
      { data: { token, newPassword: data.newPassword } },
      {
        onSuccess: () => setDone(true),
        onError: (err: any) => {
          toast({
            title: "Reset failed",
            description: err?.data?.error || "This link is invalid or has expired.",
            variant: "destructive",
          });
        },
      }
    );
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
          <h1 className="text-2xl font-bold">Password reset</h1>
          <p className="text-muted-foreground">
            Your password has been changed. You've been signed out everywhere for security — sign in with your new password.
          </p>
          <Button className="mt-2" onClick={() => setLocation("/login")}>Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <KeyRound className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Set a new password</h2>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input placeholder="••••••••" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Resetting..." : "Reset password"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

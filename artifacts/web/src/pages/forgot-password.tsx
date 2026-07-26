import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForgotPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Mail, MailCheck } from "lucide-react";

const schema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
});

export default function ForgotPassword() {
  const forgotPassword = useForgotPassword();
  const [sent, setSent] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    forgotPassword.mutate({ data }, { onSuccess: () => setSent(true), onError: () => setSent(true) });
    // Always show the same "check your email" state regardless of outcome — the backend
    // deliberately returns identical responses either way to avoid leaking registered emails.
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            {sent ? <MailCheck className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {sent ? "Check your email" : "Forgot your password?"}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {sent
              ? "If an account with that email exists, a password reset link is on its way."
              : "Enter your email and we'll send you a link to reset your password."}
          </p>
        </div>

        {!sent && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="name@example.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                {forgotPassword.isPending ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          </Form>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

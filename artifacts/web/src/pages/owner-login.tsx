import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Deliberately NOT linked from layout.tsx's nav or register.tsx — reached only via direct URL.
export default function OwnerLogin() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          if (res.user.role !== "super_admin") {
            toast({
              title: "Access denied",
              description: "This login is reserved for the owner account.",
              variant: "destructive",
            });
            return;
          }
          login(res.accessToken, res.refreshToken);
          toast({ title: "Success", description: "Logged in as owner" });
          setLocation("/admin");
        },
        onError: (err: any) => {
          const msg =
            err?.data?.error ||
            (err?.status === 401 ? "Invalid email or password." : "Failed to sign in.");
          toast({ title: "Sign in failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4">
      <BackLink />
      <div className="w-full max-w-md space-y-8 glass p-8 rounded-xl border shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Owner sign in</h2>
          <p className="text-sm text-muted-foreground mt-2">Restricted access</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="owner@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input placeholder="••••••••" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

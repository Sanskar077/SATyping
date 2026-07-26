import { useState } from "react";
import { Link, useLocation } from "wouter";
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
import { Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          login(res.accessToken, res.refreshToken);
          toast({
            title: "Success",
            description: "Logged in successfully",
          });
          const destinationByRole: Record<string, string> = {
            teacher: "/teacher/dashboard",
            institute_admin: "/institute/dashboard",
            super_admin: "/admin",
          };
          setLocation(destinationByRole[res.user.role] ?? "/dashboard");
        },
        onError: (err: any) => {
          const msg =
            err?.data?.error ||
            err?.data?.message ||
            (err?.status === 401 ? "Invalid email or password." :
             err?.status === 404 || err?.status === 0 ? "Server unavailable. Please try again in a moment." :
             err?.message?.replace(/^HTTP \d+ \S+:\s*/, "").slice(0, 120) ||
             "Failed to sign in. Please try again.");
          toast({
            title: "Sign in failed",
            description: msg,
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4">
      <BackLink />
      <div className="w-full max-w-md space-y-8 glass p-8 rounded-xl border shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Activity className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign in to your account</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Enter your credentials to access the platform
          </p>
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
                    <Input placeholder="name@example.com" type="email" {...field} />
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
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

        <div className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}

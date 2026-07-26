import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegisterStudent, useListInstitutes } from "@workspace/api-client-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  membershipMode: z.enum(["join", "independent"]),
  instituteId: z.string().optional(),
  referralCode: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterStudent() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegisterStudent();
  const [joinMethod, setJoinMethod] = useState<"pick" | "code">("pick");

  const { data: institutesData } = useListInstitutes({ limit: 100 });

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      membershipMode: "independent",
      instituteId: undefined,
      referralCode: "",
    },
  });

  const membershipMode = form.watch("membershipMode");

  const onSubmit = (data: RegisterFormValues) => {
    const payload = {
      name: data.name,
      email: data.email,
      password: data.password,
      membershipMode: data.membershipMode,
      ...(data.membershipMode === "join" && joinMethod === "pick" && data.instituteId
        ? { instituteId: parseInt(data.instituteId, 10) }
        : {}),
      ...(data.referralCode ? { referralCode: data.referralCode } : {}),
    };

    registerMutation.mutate(
      { data: payload },
      {
        onSuccess: (res) => {
          login(res.accessToken, res.refreshToken);
          toast({ title: "Success", description: "Account created successfully" });
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          const msg =
            err?.data?.error ||
            err?.data?.message ||
            (err?.status === 409 ? "An account with this email already exists." :
             err?.status === 404 || err?.status === 0 ? "Server unavailable. Please try again in a moment." :
             err?.message?.replace(/^HTTP \d+ \S+:\s*/, "").slice(0, 120) ||
             "Failed to create account. Please try again.");
          toast({ title: "Registration failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  const institutes = institutesData?.institutes ?? [];

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <BackLink />
      <div className="w-full max-w-md space-y-8 glass p-8 rounded-xl border shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Activity className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Create your student account</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Join SATyping to start your typing journey
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input placeholder="••••••••" type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="membershipMode"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>How would you like to sign up?</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-2">
                      <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
                        <RadioGroupItem value="independent" className="mt-0.5" />
                        <span>
                          <span className="block font-medium text-sm">Continue independently</span>
                          <span className="block text-xs text-muted-foreground">
                            Your own account, not tied to any institute. You can optionally enter a
                            referral code below.
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer">
                        <RadioGroupItem value="join" className="mt-0.5" />
                        <span>
                          <span className="block font-medium text-sm">Join an institute</span>
                          <span className="block text-xs text-muted-foreground">
                            Your institute manages your batch and can see your reports.
                          </span>
                        </span>
                      </label>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {membershipMode === "join" && (
              <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setJoinMethod("pick")}
                    className={`px-2 py-1 rounded ${joinMethod === "pick" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    Select from list
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinMethod("code")}
                    className={`px-2 py-1 rounded ${joinMethod === "code" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    Paste referral code
                  </button>
                </div>

                {joinMethod === "pick" ? (
                  <FormField
                    control={form.control}
                    name="instituteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Institute</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select your institute" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {institutes.map((inst) => (
                              <SelectItem key={inst.id} value={String(inst.id)}>
                                {inst.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="referralCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Referral code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. GREENFIELD-A1B2C3" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            {membershipMode === "independent" && (
              <FormField
                control={form.control}
                name="referralCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referral code (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Have a referral code? Enter it here." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" className="w-full mt-6" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </Form>

        <div className="text-center text-sm text-muted-foreground mt-6 space-y-1">
          <div>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
          <div>
            Registering an institute instead?{" "}
            <Link href="/register/institute" className="font-medium text-primary hover:underline">
              Register your institute
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

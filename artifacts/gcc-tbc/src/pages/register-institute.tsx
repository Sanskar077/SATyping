import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegisterInstitute } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
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

const registerSchema = z.object({
  instituteName: z.string().min(2, { message: "Institute name must be at least 2 characters" }),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal("")),
  adminName: z.string().min(2, { message: "Name must be at least 2 characters" }),
  adminEmail: z.string().email({ message: "Invalid email address" }),
  adminPassword: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterInstitute() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegisterInstitute();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      instituteName: "",
      address: "",
      phone: "",
      email: "",
      adminName: "",
      adminEmail: "",
      adminPassword: "",
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    const payload = {
      instituteName: data.instituteName,
      ...(data.address ? { address: data.address } : {}),
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.email ? { email: data.email } : {}),
      adminName: data.adminName,
      adminEmail: data.adminEmail,
      adminPassword: data.adminPassword,
    };

    registerMutation.mutate(
      { data: payload },
      {
        onSuccess: (res) => {
          login(res.accessToken, res.refreshToken);
          toast({ title: "Success", description: "Institute account created successfully" });
          setLocation("/institute/dashboard");
        },
        onError: (err: any) => {
          const msg =
            err?.data?.error ||
            err?.data?.message ||
            (err?.status === 409 ? "An account with this email already exists." :
             err?.status === 404 || err?.status === 0 ? "Server unavailable. Please try again in a moment." :
             err?.message?.replace(/^HTTP \d+ \S+:\s*/, "").slice(0, 120) ||
             "Failed to create institute account. Please try again.");
          toast({ title: "Registration failed", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-xl border border-border shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Activity className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Register your institute</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Set up your institute and its first admin account, and get a
            referral code to share with your students.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="instituteName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Institute name</FormLabel>
                  <FormControl>
                    <Input placeholder="Greenfield Typing Institute" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Street, city" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+91 98765 43210" {...field} />
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
                    <FormLabel>Institute email (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="contact@institute.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t border-border pt-4 mt-2">
              <p className="text-sm font-medium mb-3">First admin account</p>

              <FormField
                control={form.control}
                name="adminName"
                render={({ field }) => (
                  <FormItem className="mb-3">
                    <FormLabel>Your name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem className="mb-3">
                    <FormLabel>Your email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@institute.com" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminPassword"
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
            </div>

            <Button type="submit" className="w-full mt-6" disabled={registerMutation.isPending}>
              {registerMutation.isPending ? "Creating institute..." : "Register institute"}
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
            Registering as a student instead?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Student registration
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useGetMe, useUpdateUser, useChangePassword, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageLoading } from "@/components/page-loading";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Shield } from "lucide-react";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  avatarUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function Profile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: me, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const updateUser = useUpdateUser();
  const changePassword = useChangePassword();

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: {
      name: me?.name ?? "",
      phone: me?.phone ?? "",
      avatarUrl: me?.avatarUrl ?? "",
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onProfileSubmit = (values: z.infer<typeof profileSchema>) => {
    if (!me) return;
    updateUser.mutate({ id: me.id, data: { name: values.name, phone: values.phone ?? null, avatarUrl: values.avatarUrl ?? null } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Profile updated" });
      },
      onError: () => toast({ title: "Update failed", variant: "destructive" }),
    });
  };

  const onPasswordSubmit = (values: z.infer<typeof passwordSchema>) => {
    changePassword.mutate({ data: { currentPassword: values.currentPassword, newPassword: values.newPassword } }, {
      onSuccess: () => {
        toast({ title: "Password changed successfully" });
        passwordForm.reset();
      },
      onError: () => toast({ title: "Failed to change password", description: "Check your current password", variant: "destructive" }),
    });
  };

  const roleLabel: Record<string, string> = {
    student: "Student",
    teacher: "Teacher",
    institute_admin: "Institute Admin",
    super_admin: "Super Admin",
  };

  if (isLoading) return <PageLoading label="Loading profile..." />;

  return (
    <div className="max-w-2xl space-y-6" data-testid="profile-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your account information</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Account Info</CardTitle>
                <CardDescription className="text-xs">{me?.email}</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary">{roleLabel[me?.role ?? "student"] ?? me?.role}</Badge>
              <Badge variant="outline" className="capitalize">{me?.subscriptionPlan}</Badge>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <FormField control={profileForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={profileForm.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input {...field} placeholder="+91 9876543210" data-testid="input-phone" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={profileForm.control} name="avatarUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar URL</FormLabel>
                  <FormControl><Input {...field} placeholder="https://example.com/avatar.jpg" data-testid="input-avatar" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={updateUser.isPending} data-testid="button-save-profile">
                {updateUser.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription className="text-xs">Keep your account secure</CardDescription>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl><Input type="password" {...field} data-testid="input-current-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl><Input type="password" {...field} data-testid="input-new-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl><Input type="password" {...field} data-testid="input-confirm-password" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={changePassword.isPending} data-testid="button-change-password">
                {changePassword.isPending ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

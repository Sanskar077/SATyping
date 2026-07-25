import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { toast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { configureApi } from "@/lib/api";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout";
import { AdminLayout } from "@/components/admin-layout";
import { KeyboardOverlay } from "@/components/keyboard-overlay";
import { ThemeProvider } from "@/components/theme-provider";

// Public pages
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import RegisterStudent from "@/pages/register-student";
import RegisterInstitute from "@/pages/register-institute";
import OwnerLogin from "@/pages/owner-login";

// Student pages
import Dashboard from "@/pages/dashboard";
import Practice from "@/pages/practice/index";
import PracticeSession from "@/pages/practice/session";
import Drills from "@/pages/practice/drills";           // Feature 3
import Exams from "@/pages/exams/index";
import ExamSession from "@/pages/exams/session";
import Results from "@/pages/results/index";
import ResultDetail from "@/pages/results/detail";
import Sessions from "@/pages/sessions";               // Feature 8
import Plans from "@/pages/plans";
import Billing from "@/pages/billing";
import PaymentSuccess from "@/pages/payment-success";
import PaymentFailed from "@/pages/payment-failed";
import VerifyEmail from "@/pages/verify-email";
import VerifyCertificate from "@/pages/verify";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Profile from "@/pages/profile";
import Notepad from "@/pages/notepad";                  // Typing Notepad

// Passages
import Passages from "@/pages/passages/index";
import NewPassage from "@/pages/passages/new";

// Curriculum (Feature 5)
import CurriculumPage from "@/pages/curriculum/index";
import LessonPage from "@/pages/curriculum/lesson";
import KeyboardReference from "@/pages/keyboard-reference";

// Teacher
import TeacherDashboard from "@/pages/teacher/dashboard";

// Institute admin
import InstituteDashboard from "@/pages/institute/dashboard";
import InstituteStudents from "@/pages/institute/students";
import InstituteTests from "@/pages/institute/tests";
import InstituteCommissions from "@/pages/institute/commissions";

// Super admin
import AdminDashboard from "@/pages/admin/index";
import AdminInstitutes from "@/pages/admin/institutes";
import AdminUsers from "@/pages/admin/users";
import BulkImport from "@/pages/admin/bulk-import";     // Feature 9
import AdminPlans from "@/pages/admin/plans";
import AdminOffers from "@/pages/admin/offers";
import AdminPayments from "@/pages/admin/payments";
import AdminCommissions from "@/pages/admin/commissions";
import AdminActivityLogs from "@/pages/admin/activity-logs";
import AdminAnalytics from "@/pages/admin/analytics";

configureApi();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onError: (error) => {
      const code = (error as { data?: { code?: string } } | undefined)?.data?.code;
      // The Owner (super_admin) always has access and lives entirely within /admin; never
      // bounce them to /plans even if some request unexpectedly returns this code.
      if (code === "SUBSCRIPTION_REQUIRED" && !window.location.pathname.startsWith("/admin")) {
        toast({
          title: "Subscription required",
          description: "An active plan is required to use this feature.",
          variant: "destructive",
        });
        if (!window.location.pathname.startsWith("/plans")) {
          window.location.assign("/plans");
        }
      }
    },
  }),
});

function ProtectedRoute({
  component: Component, roles, requiresAccess = true, ownerAllowed = false,
}: {
  component: React.ComponentType;
  roles?: string[];
  /** Whether an active subscription/institute membership/Owner Premium grant is required to view
   * this page. Set to false ONLY for pages a locked-out user must still reach: billing, profile, plans. */
  requiresAccess?: boolean;
  /** Whether the Owner (super_admin) may view this page. Defaults to false: the Owner has a
   * management-only experience and is redirected to /admin from every student/institute route.
   * Set true on management pages (all /admin/*, plus shared tools like /passages) and account
   * pages the Owner still needs (/profile). */
  ownerAllowed?: boolean;
}) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  const isOwner = user?.role === "super_admin";

  // The Owner runs the business from a dedicated management shell — they never practice typing.
  // Block them out of the entire student/institute surface (not just hide nav links) and send
  // them home to /admin. Management pages opt back in via ownerAllowed.
  if (isOwner && !ownerAllowed) {
    return <Redirect to="/admin" />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  // No trial — a user with no active subscription and no Owner Premium grant cannot use any
  // protected feature. They're redirected to /plans, which (along with /billing and /profile)
  // remains reachable regardless so they have a path to actually subscribe. The Owner is exempt:
  // they always have access and manage plans rather than consuming them.
  if (requiresAccess && !isOwner && user && !user.hasAccess) {
    return <Redirect to="/plans" />;
  }

  const Layout = isOwner ? AdminLayout : AppLayout;
  return (
    <Layout>
      <Component />
    </Layout>
  );
}

const ADMIN_ROLES     = ["super_admin"];
const INSTITUTE_ROLES = ["institute_admin", "super_admin"];
const MANAGE_ROLES    = ["teacher", "institute_admin", "super_admin"];

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={RegisterStudent} />
      <Route path="/register/institute" component={RegisterInstitute} />
      {/* Not linked from any nav — reached only via direct URL. */}
      <Route path="/owner-login" component={OwnerLogin} />
      <Route path="/plans" component={Plans} />
      {/* Razorpay redirects here — no session required to view them. */}
      <Route path="/payment-success" component={PaymentSuccess} />
      <Route path="/payment-failed" component={PaymentFailed} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/verify/:verificationId" component={VerifyCertificate} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Student routes */}
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/practice"><ProtectedRoute component={Practice} /></Route>
      <Route path="/practice/drills"><ProtectedRoute component={Drills} /></Route>
      <Route path="/practice/:sessionId"><ProtectedRoute component={PracticeSession} /></Route>
      <Route path="/notepad"><ProtectedRoute component={Notepad} /></Route>
      <Route path="/exams"><ProtectedRoute component={Exams} /></Route>
      <Route path="/exam/:testId"><ProtectedRoute component={ExamSession} /></Route>
      <Route path="/results"><ProtectedRoute component={Results} /></Route>
      <Route path="/results/:id"><ProtectedRoute component={ResultDetail} /></Route>
      <Route path="/sessions"><ProtectedRoute component={Sessions} /></Route>
      <Route path="/profile"><ProtectedRoute component={Profile} requiresAccess={false} ownerAllowed /></Route>
      <Route path="/billing"><ProtectedRoute component={Billing} requiresAccess={false} /></Route>

      {/* Curriculum (Feature 5) */}
      <Route path="/curriculum"><ProtectedRoute component={CurriculumPage} /></Route>
      <Route path="/curriculum/:language/:id"><ProtectedRoute component={LessonPage} /></Route>
      <Route path="/keyboard"><ProtectedRoute component={KeyboardReference} /></Route>

      {/* Passages — shared management tool; the Owner reaches these from the admin shell. */}
      <Route path="/passages"><ProtectedRoute component={Passages} ownerAllowed /></Route>
      <Route path="/passages/new"><ProtectedRoute component={NewPassage} roles={MANAGE_ROLES} ownerAllowed /></Route>

      {/* Teacher routes */}
      <Route path="/teacher"><ProtectedRoute component={TeacherDashboard} roles={MANAGE_ROLES} /></Route>
      <Route path="/teacher/dashboard"><ProtectedRoute component={TeacherDashboard} roles={MANAGE_ROLES} /></Route>

      {/* Institute admin routes */}
      <Route path="/institute"><ProtectedRoute component={InstituteDashboard} roles={INSTITUTE_ROLES} /></Route>
      <Route path="/institute/dashboard"><ProtectedRoute component={InstituteDashboard} roles={INSTITUTE_ROLES} /></Route>
      <Route path="/institute/students"><ProtectedRoute component={InstituteStudents} roles={INSTITUTE_ROLES} /></Route>
      <Route path="/institute/tests"><ProtectedRoute component={InstituteTests} roles={INSTITUTE_ROLES} /></Route>
      <Route path="/institute/commissions"><ProtectedRoute component={InstituteCommissions} roles={INSTITUTE_ROLES} /></Route>

      {/* Super admin routes — all render inside the Owner's AdminLayout (ownerAllowed). */}
      <Route path="/admin"><ProtectedRoute component={AdminDashboard} roles={ADMIN_ROLES} ownerAllowed /></Route>
      <Route path="/admin/institutes"><ProtectedRoute component={AdminInstitutes} roles={ADMIN_ROLES} ownerAllowed /></Route>
      <Route path="/admin/users"><ProtectedRoute component={AdminUsers} roles={ADMIN_ROLES} ownerAllowed /></Route>
      <Route path="/admin/bulk-import"><ProtectedRoute component={BulkImport} roles={MANAGE_ROLES} ownerAllowed /></Route>
      <Route path="/admin/plans"><ProtectedRoute component={AdminPlans} roles={ADMIN_ROLES} ownerAllowed /></Route>
      <Route path="/admin/offers"><ProtectedRoute component={AdminOffers} roles={ADMIN_ROLES} ownerAllowed /></Route>
      <Route path="/admin/payments"><ProtectedRoute component={AdminPayments} roles={ADMIN_ROLES} ownerAllowed /></Route>
      <Route path="/admin/commissions"><ProtectedRoute component={AdminCommissions} roles={ADMIN_ROLES} ownerAllowed /></Route>
      <Route path="/admin/activity-logs"><ProtectedRoute component={AdminActivityLogs} roles={ADMIN_ROLES} ownerAllowed /></Route>
      <Route path="/admin/analytics"><ProtectedRoute component={AdminAnalytics} roles={ADMIN_ROLES} ownerAllowed /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
              {/* Feature 7: Global keyboard shortcut overlay */}
              <KeyboardOverlay />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;

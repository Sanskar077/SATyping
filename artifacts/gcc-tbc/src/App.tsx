import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { configureApi } from "@/lib/api";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppLayout } from "@/components/layout";

// Public pages
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import VerifyCertificate from "@/pages/verify";

// Student pages
import Dashboard from "@/pages/dashboard";
import Practice from "@/pages/practice/index";
import PracticeSession from "@/pages/practice/session";
import Exams from "@/pages/exams/index";
import ExamSession from "@/pages/exams/session";
import Results from "@/pages/results/index";
import ResultDetail from "@/pages/results/detail";
import Certificates from "@/pages/certificates/index";
import CertificateDetail from "@/pages/certificates/detail";
import Plans from "@/pages/plans";
import Profile from "@/pages/profile";

// Passages
import Passages from "@/pages/passages/index";
import NewPassage from "@/pages/passages/new";

// Institute admin
import InstituteDashboard from "@/pages/institute/dashboard";
import InstituteStudents from "@/pages/institute/students";
import InstituteTests from "@/pages/institute/tests";

// Super admin
import AdminDashboard from "@/pages/admin/index";
import AdminInstitutes from "@/pages/admin/institutes";
import AdminUsers from "@/pages/admin/users";

configureApi();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
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

  if (roles && user && !roles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

const ADMIN_ROLES = ["super_admin"];
const INSTITUTE_ROLES = ["institute_admin", "super_admin"];
const MANAGE_ROLES = ["teacher", "institute_admin", "super_admin"];

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/verify/:verificationId" component={VerifyCertificate} />
      <Route path="/plans" component={Plans} />

      {/* Student routes */}
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/practice"><ProtectedRoute component={Practice} /></Route>
      <Route path="/practice/:sessionId"><ProtectedRoute component={PracticeSession} /></Route>
      <Route path="/exams"><ProtectedRoute component={Exams} /></Route>
      <Route path="/exam/:testId"><ProtectedRoute component={ExamSession} /></Route>
      <Route path="/results"><ProtectedRoute component={Results} /></Route>
      <Route path="/results/:id"><ProtectedRoute component={ResultDetail} /></Route>
      <Route path="/certificates"><ProtectedRoute component={Certificates} /></Route>
      <Route path="/certificates/:id"><ProtectedRoute component={CertificateDetail} /></Route>
      <Route path="/profile"><ProtectedRoute component={Profile} /></Route>

      {/* Passages (teachers + admins manage, students can view) */}
      <Route path="/passages"><ProtectedRoute component={Passages} /></Route>
      <Route path="/passages/new"><ProtectedRoute component={NewPassage} roles={MANAGE_ROLES} /></Route>

      {/* Institute admin routes */}
      <Route path="/institute"><ProtectedRoute component={InstituteDashboard} roles={INSTITUTE_ROLES} /></Route>
      <Route path="/institute/dashboard"><ProtectedRoute component={InstituteDashboard} roles={INSTITUTE_ROLES} /></Route>
      <Route path="/institute/students"><ProtectedRoute component={InstituteStudents} roles={INSTITUTE_ROLES} /></Route>
      <Route path="/institute/tests"><ProtectedRoute component={InstituteTests} roles={INSTITUTE_ROLES} /></Route>

      {/* Super admin routes */}
      <Route path="/admin"><ProtectedRoute component={AdminDashboard} roles={ADMIN_ROLES} /></Route>
      <Route path="/admin/institutes"><ProtectedRoute component={AdminInstitutes} roles={ADMIN_ROLES} /></Route>
      <Route path="/admin/users"><ProtectedRoute component={AdminUsers} roles={ADMIN_ROLES} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

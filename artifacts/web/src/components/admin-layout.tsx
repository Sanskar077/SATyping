import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Shield, User, BookOpen, LogOut, LayoutDashboard, Settings,
  Building2, Users, Menu, X, Upload, Package, Tag, CreditCard,
  Wallet, ScrollText, BarChart3,
} from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { useState } from "react";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandWordmark } from "@/components/brand-logo";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Match only on exact path (used for the overview root so it isn't active on every /admin/* page). */
  exact?: boolean;
}

/**
 * Management-only navigation for the Owner (super_admin). Deliberately contains NO
 * student/institute concepts (Practice, Exams, Results, Notepad, Curriculum) — the Owner
 * runs the business, they don't practice typing. Keep this list in sync with the routes
 * that pass `ownerAllowed` in App.tsx.
 */
const ADMIN_NAV: NavItem[] = [
  { href: "/admin",               label: "Overview",      icon: LayoutDashboard, exact: true },
  { href: "/admin/users",         label: "Users",         icon: Users },
  { href: "/admin/institutes",    label: "Institutes",    icon: Building2 },
  { href: "/passages",            label: "Passages",      icon: BookOpen },
  { href: "/admin/bulk-import",   label: "Bulk Import",   icon: Upload },
  { href: "/admin/plans",         label: "Plans",         icon: Package },
  { href: "/admin/offers",        label: "Offers",        icon: Tag },
  { href: "/admin/payments",      label: "Payments",      icon: CreditCard },
  { href: "/admin/commissions",   label: "Commissions",   icon: Wallet },
  { href: "/admin/analytics",     label: "Analytics",     icon: BarChart3 },
  { href: "/admin/activity-logs", label: "Activity Logs", icon: ScrollText },
];

interface SidebarProps { onClose?: () => void; }

function SidebarContent({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => { logout(); setLocation("/login"); },
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-border">
        <BrandWordmark className="text-base" caret={false} />
        <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          <Shield className="h-3 w-3" />
          Admin
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <ThemeToggle />
          <NotificationBell />
          {onClose && (
            <button className="text-muted-foreground hover:text-foreground" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-0.5">
        {ADMIN_NAV.map((item) => {
          const isActive = item.exact
            ? location === item.href
            : location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-colors group ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <item.icon className={`h-4 w-4 mr-3 flex-shrink-0 ${isActive ? "" : "group-hover:text-foreground"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg bg-muted/50">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <User className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">Owner</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm" className="flex-1 text-xs"
            onClick={() => { setLocation("/profile"); onClose?.(); }}
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Profile
          </Button>
          <Button variant="outline" size="sm" className="px-2.5" onClick={handleLogout} title="Sign out">
            <LogOut className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="w-60 glass border-r flex-col hidden md:flex flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 glass-overlay border-r">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="h-14 glass border-b flex items-center justify-between px-4 md:hidden flex-shrink-0">
          <div className="flex items-center gap-2">
            <BrandWordmark className="text-sm" caret={false} />
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Shield className="h-3 w-3" />
              Admin
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <NotificationBell />
            <button
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-x-hidden overflow-y-auto p-5 md:p-8 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}

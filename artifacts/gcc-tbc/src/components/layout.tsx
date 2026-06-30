import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Activity, User, BookOpen, FileText, Award, LogOut,
  LayoutDashboard, Settings, Building2, Shield, Zap, Menu, X,
} from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function buildNavItems(role: string): NavItem[] {
  const base: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/practice", label: "Practice", icon: Activity },
    { href: "/exams", label: "Exams", icon: FileText },
    { href: "/results", label: "Results", icon: BookOpen },
    { href: "/certificates", label: "Certificates", icon: Award },
  ];

  if (role === "teacher" || role === "institute_admin" || role === "super_admin") {
    base.push({ href: "/passages", label: "Passages", icon: BookOpen });
  }

  if (role === "institute_admin" || role === "super_admin") {
    base.push({ href: "/institute/dashboard", label: "Institute", icon: Building2 });
  }

  if (role === "super_admin") {
    base.push({ href: "/admin", label: "Admin", icon: Shield });
  }

  return base;
}

interface SidebarProps {
  onClose?: () => void;
}

function SidebarContent({ onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();

  const navItems = buildNavItems(user?.role ?? "student");

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        logout();
        setLocation("/login");
      },
    });
  };

  const roleLabel: Record<string, string> = {
    student: "Student",
    teacher: "Teacher",
    institute_admin: "Institute Admin",
    super_admin: "Super Admin",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-border">
        <Activity className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
        <span className="font-bold text-base tracking-tight">GCC-TBC Pro</span>
        {onClose && (
          <button className="ml-auto text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
            <p className="text-xs text-muted-foreground truncate">{roleLabel[user?.role ?? "student"] ?? user?.role}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
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

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="w-60 bg-card border-r border-border flex-col hidden md:flex flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 md:hidden flex-shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm tracking-tight">GCC-TBC Pro</span>
          </div>
          <button
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-5 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

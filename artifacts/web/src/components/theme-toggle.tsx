import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Light/dark toggle. Swaps between the two Warm Study token sets.
 * Renders a stable placeholder until mounted so the icon never flips on first paint.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={mounted ? (isDark ? "Light mode" : "Dark mode") : "Toggle theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "text-muted-foreground hover:text-foreground rounded-full",
        className,
      )}
    >
      {/* Cross-fade the two glyphs; guard against pre-mount mismatch. */}
      {mounted ? (
        isDark ? <Sun className="h-[1.15rem] w-[1.15rem]" /> : <Moon className="h-[1.15rem] w-[1.15rem]" />
      ) : (
        <Sun className="h-[1.15rem] w-[1.15rem] opacity-0" />
      )}
    </Button>
  );
}

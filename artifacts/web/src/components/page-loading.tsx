/**
 * PageLoading — the one loading state for list/detail pages.
 *
 * Replaces the bare centred "Loading..." text that had drifted across ~16 pages, so every surface
 * shows the same calm skeleton (pages with bespoke skeletons matching their real layout — the
 * dashboard grid, the split-panel sessions — keep those; this is for the generic case).
 */
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  /** Screen-reader announcement and subtle caption, e.g. "Loading payments...". */
  label?: string;
  /** Number of skeleton rows. */
  rows?: number;
  className?: string;
}

export function PageLoading({ label = "Loading...", rows = 4, className = "" }: Props) {
  return (
    <div className={`py-8 space-y-3 ${className}`} role="status" aria-live="polite">
      <Card>
        <CardContent className="p-4 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-9 w-9 rounded-lg bg-muted flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-muted rounded" style={{ width: `${70 - i * 9}%` }} />
                <div className="h-2.5 bg-muted rounded" style={{ width: `${45 - i * 5}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

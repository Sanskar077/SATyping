/**
 * Feature 1: Keystroke Heatmap
 * Shows a QWERTY keyboard with keys colored by frequency of use.
 * Also supports viewing Devanagari ISM Remington mappings.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface KeystrokeEntry {
  key: string;       // physical key pressed (e.g. "a", "s", "Backspace")
  char: string;      // resulting character (translated if Marathi)
  timestamp: number; // ms since epoch
  isCorrect: boolean;
}

const QWERTY_ROWS = [
  ["`","1","2","3","4","5","6","7","8","9","0","-","=","Backspace"],
  ["Tab","q","w","e","r","t","y","u","i","o","p","[","]","\\"],
  ["CapsLock","a","s","d","f","g","h","j","k","l",";","'","Enter"],
  ["Shift","z","x","c","v","b","n","m",",",".","/","Shift"],
  ["Space"],
];

const KEY_WIDTHS: Record<string, string> = {
  Backspace: "w-16",
  Tab: "w-14",
  CapsLock: "w-16",
  Enter: "w-16",
  Shift: "w-20",
  Space: "w-72",
};

function heatColor(count: number, max: number, isError: boolean): string {
  if (max === 0 || count === 0) return "";
  const ratio = count / max;
  if (isError) {
    if (ratio > 0.6) return "bg-red-500 text-white";
    if (ratio > 0.3) return "bg-red-300 text-red-900";
    return "bg-red-100 text-red-800 dark:bg-red-900/40";
  }
  if (ratio > 0.6) return "bg-primary text-primary-foreground";
  if (ratio > 0.3) return "bg-primary/60 text-primary-foreground";
  if (ratio > 0.1) return "bg-primary/25";
  return "bg-primary/10";
}

interface KeystrokeHeatmapProps {
  keystrokes: KeystrokeEntry[];
  className?: string;
}

export function KeystrokeHeatmap({ keystrokes, className = "" }: KeystrokeHeatmapProps) {
  const { freqMap, errMap, maxFreq } = useMemo(() => {
    const freqMap: Record<string, number> = {};
    const errMap: Record<string, number> = {};
    for (const ks of keystrokes) {
      const k = ks.key.toLowerCase();
      freqMap[k] = (freqMap[k] ?? 0) + 1;
      if (!ks.isCorrect) errMap[k] = (errMap[k] ?? 0) + 1;
    }
    const maxFreq = Math.max(0, ...Object.values(freqMap));
    return { freqMap, errMap, maxFreq };
  }, [keystrokes]);

  // Top 5 most-pressed keys
  const topKeys = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className={className}>
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-max space-y-1">
          {QWERTY_ROWS.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1">
              {row.map((key) => {
                const k = key.toLowerCase();
                const count = freqMap[k] ?? 0;
                const errors = errMap[k] ?? 0;
                const hasErrors = errors > 0;
                const color = heatColor(count, maxFreq, hasErrors);

                return (
                  <div
                    key={key}
                    title={count > 0 ? `${key}: ${count} press${count !== 1 ? "es" : ""}${errors ? `, ${errors} errors` : ""}` : key}
                    className={cn(
                      "relative h-9 rounded border border-border text-xs font-mono flex items-center justify-center cursor-default transition-all select-none",
                      KEY_WIDTHS[key] ?? "w-9",
                      count > 0 ? color : "bg-muted/30 text-muted-foreground",
                    )}
                  >
                    <span className="truncate px-1">{key === "Space" ? "⎵" : key === "Backspace" ? "⌫" : key === "CapsLock" ? "⇪" : key === "Enter" ? "↵" : key}</span>
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 text-[9px] bg-background border border-border rounded-full px-1 leading-tight font-bold">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend & top keys */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-medium">Most pressed:</span>
          {topKeys.map(([key, count]) => (
            <span key={key} className="px-2 py-0.5 bg-primary/15 rounded font-mono">
              {key} × {count}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 flex gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary inline-block" /> High freq</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/40 inline-block" /> Mid freq</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Error prone</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted inline-block" /> Unused</span>
      </div>
    </div>
  );
}

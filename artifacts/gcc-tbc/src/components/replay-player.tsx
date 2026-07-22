/**
 * Feature 1: Live Typing Test Replay
 * Replays stored keystroke data to animate the original typing session.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, FastForward } from "lucide-react";
import type { KeystrokeEntry } from "@/components/keystroke-heatmap";
import { toGraphemes, clusterMatch } from "@/lib/grapheme-utils";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 1, 1.5, 2, 3] as const;

interface ReplayPlayerProps {
  keystrokes: KeystrokeEntry[];
  passageText: string;
  className?: string;
}

export function ReplayPlayer({ keystrokes, passageText, className = "" }: ReplayPlayerProps) {
  const [playing, setPlaying]         = useState(false);
  const [cursorIdx, setCursorIdx]     = useState(0);   // index into keystroke array
  const [speed, setSpeed]             = useState<(typeof SPEEDS)[number]>(1);
  const rafRef                        = useRef<number>(0);
  const lastRealTimeRef               = useRef<number>(0);
  const lastKsTimeRef                 = useRef<number>(0);

  // Reconstruct typed text at cursorIdx
  const typedText = useMemo(() => {
    let text = "";
    for (let i = 0; i < cursorIdx; i++) {
      const ks = keystrokes[i];
      if (!ks) break;
      if (ks.key === "Backspace") {
        const g = toGraphemes(text);
        text = g.length ? g.slice(0, -1).join("") : "";
      } else if (ks.char) {
        text += ks.char;
      }
    }
    return text;
  }, [cursorIdx, keystrokes]);

  const passageGraphemes = useMemo(() => toGraphemes(passageText.normalize("NFC")), [passageText]);
  const typedGraphemes   = useMemo(() => toGraphemes(typedText), [typedText]);

  const done = cursorIdx >= keystrokes.length;

  const reset = useCallback(() => {
    setPlaying(false);
    setCursorIdx(0);
    cancelAnimationFrame(rafRef.current);
  }, []);

  // RAF-based playback at configurable speed
  useEffect(() => {
    if (!playing || done) { cancelAnimationFrame(rafRef.current); return; }

    const tick = (realNow: number) => {
      if (!lastRealTimeRef.current) {
        lastRealTimeRef.current = realNow;
        lastKsTimeRef.current   = keystrokes[cursorIdx]?.timestamp ?? 0;
      }

      const realDelta = realNow - lastRealTimeRef.current;
      const ksDelta   = realDelta * speed;
      const ksTarget  = lastKsTimeRef.current + ksDelta;

      setCursorIdx((prev) => {
        let next = prev;
        while (next < keystrokes.length && (keystrokes[next]?.timestamp ?? 0) <= ksTarget) {
          next++;
        }
        if (next !== prev) {
          lastRealTimeRef.current = realNow;
          lastKsTimeRef.current   = keystrokes[next - 1]?.timestamp ?? ksTarget;
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); lastRealTimeRef.current = 0; };
  }, [playing, done, speed, keystrokes, cursorIdx]);

  // Normalise keystroke timestamps relative to first event
  const normalizedKeystrokes = useMemo(() => {
    if (!keystrokes.length) return keystrokes;
    const t0 = keystrokes[0].timestamp;
    return keystrokes.map(ks => ({ ...ks, timestamp: ks.timestamp - t0 }));
  }, [keystrokes]);

  const totalDurationMs = normalizedKeystrokes.length
    ? (normalizedKeystrokes[normalizedKeystrokes.length - 1]?.timestamp ?? 0)
    : 0;

  const currentMs = normalizedKeystrokes[Math.min(cursorIdx, normalizedKeystrokes.length - 1)]?.timestamp ?? 0;

  const seek = (pct: number) => {
    const targetMs = (pct / 100) * totalDurationMs;
    let idx = 0;
    while (idx < normalizedKeystrokes.length && normalizedKeystrokes[idx].timestamp < targetMs) idx++;
    setCursorIdx(idx);
    lastRealTimeRef.current = 0;
  };

  if (!keystrokes.length) {
    return (
      <div className={cn("flex items-center justify-center h-24 text-muted-foreground text-sm", className)}>
        No keystroke data available for replay.
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Passage display */}
      <div
        className="p-4 bg-muted/30 rounded-lg border font-mono text-lg leading-relaxed break-words select-none"
        style={{ whiteSpace: "pre-wrap", minHeight: "6rem" }}
      >
        {passageGraphemes.map((cluster, i) => {
          const typed = typedGraphemes[i];
          let cls = "text-foreground/40";
          if (i < typedGraphemes.length) {
            const isLastTyped = i === typedGraphemes.length - 1;
            const match = clusterMatch(typed ?? "", cluster);
            if (match === "exact") {
              cls = "text-green-600 dark:text-green-400";
            } else if (match === "prefix" && isLastTyped) {
              // Same in-progress Devanagari cluster case as the live engine — a consonant typed
              // just before its matra shouldn't flash red for one keystroke during replay either.
              cls = "bg-blue-100 dark:bg-blue-900 border-b-2 border-blue-600 dark:border-blue-400";
            } else {
              cls = "text-white bg-red-500 dark:bg-red-600 rounded-sm";
            }
          } else if (i === typedGraphemes.length) {
            cls = "bg-blue-100 dark:bg-blue-900 border-b-2 border-blue-600 dark:border-blue-400";
          }
          return <span key={i} className={cls}>{cluster}</span>;
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Slider
          value={[totalDurationMs > 0 ? Math.round((currentMs / totalDurationMs) * 100) : 0]}
          onValueChange={([v]) => { seek(v); setPlaying(false); }}
          min={0} max={100} step={1}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(currentMs / 1000)}s</span>
          <span>{Math.round(totalDurationMs / 1000)}s</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button size="sm" variant="ghost" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={() => { if (done) { reset(); setTimeout(() => setPlaying(true), 50); } else setPlaying(p => !p); }}
        >
          {playing ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
          {done ? "Replay" : playing ? "Pause" : "Play"}
        </Button>

        {/* Speed controls */}
        <div className="flex items-center gap-1 ml-auto">
          <FastForward className="h-3 w-3 text-muted-foreground" />
          {SPEEDS.map(s => (
            <Button
              key={s}
              size="sm"
              variant={speed === s ? "default" : "outline"}
              className="h-7 px-2 text-xs"
              onClick={() => setSpeed(s)}
            >
              {s}×
            </Button>
          ))}
        </div>
      </div>

      {/* Stats overlay */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Chars typed", value: typedGraphemes.length },
          { label: "Progress", value: `${Math.min(100, Math.round((typedGraphemes.length / Math.max(1, passageGraphemes.length)) * 100))}%` },
          { label: "Keystroke", value: `${cursorIdx}/${keystrokes.length}` },
        ].map(({ label, value }) => (
          <div key={label} className="p-2 bg-muted/20 rounded">
            <div className="text-sm font-bold font-mono">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

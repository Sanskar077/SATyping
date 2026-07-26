/**
 * SessionKeyboard — compact in-session on-screen keyboard with next-key guidance.
 *
 * Renders the four typing rows from KEYBOARD_ROWS (geometry) labelled via getKeyChar (characters —
 * always derived from REMINGTON_MAP, never a second copy of the layout), and highlights the key(s)
 * the typist must press next, in order, including the Shift key when the next key is a shifted one.
 *
 * This is a LEARNING aid for practice mode. It is deliberately not rendered in exams — knowing
 * where keys are is part of what the exam tests.
 */
import { useMemo } from "react";
import { NUMBER_ROW, TAB_ROW, HOME_ROW, SHIFT_ROW, type PhysicalKey } from "@/lib/keyboard-layout";
import { getKeyChar } from "@/lib/keyboard-metadata";

interface Props {
  /** Physical keys to press, in order (from nextKeyHint). Empty/undefined = nothing highlighted. */
  hintKeys?: string[];
  /** The cluster being built, shown as the guidance label (e.g. "को"). */
  hintCluster?: string;
  /** english mode renders plain QWERTY labels and no Devanagari sub-labels. */
  language: string;
  className?: string;
}

const TYPING_ROWS: PhysicalKey[][] = [NUMBER_ROW, TAB_ROW, HOME_ROW, SHIFT_ROW];

/** True when `key` is the SHIFTED output of a physical key (e.g. "D", "{", "!"). */
function isShiftedKey(key: string): boolean {
  if (/^[A-Z]$/.test(key)) return true;
  return '~!@#$%^&*()_+{}|:"<>?'.includes(key) && key.length === 1;
}

export function SessionKeyboard({ hintKeys = [], hintCluster, language, className = "" }: Props) {
  const isDevanagari = language === "marathi" || language === "hindi";

  // The key to press RIGHT NOW is the first of the sequence; later keys get a dimmer highlight so
  // multi-keystroke clusters (को = d k s) read as an ordered path, not three random glowing keys.
  const { current, upcoming, shiftActive } = useMemo(() => {
    const cur = hintKeys[0];
    return {
      current: cur,
      upcoming: new Set(hintKeys.slice(1)),
      shiftActive: cur !== undefined && isShiftedKey(cur),
    };
  }, [hintKeys]);

  /** Highlight state for one physical key cap. */
  const stateFor = (k: PhysicalKey): "now" | "next" | "idle" => {
    if (k.functional) {
      if (k.key === "Shift" && shiftActive) return "now";
      return "idle";
    }
    if (current !== undefined && (k.key === current || k.shiftKey === current)) return "now";
    if (upcoming.has(k.key) || (k.shiftKey !== undefined && upcoming.has(k.shiftKey))) return "next";
    return "idle";
  };

  const capClass = (state: "now" | "next" | "idle") =>
    state === "now"
      ? "bg-primary text-primary-foreground border-primary shadow-md scale-105 z-10"
      : state === "next"
        ? "bg-primary/15 text-foreground border-primary/40"
        : // Idle caps are neumorphic (soft-extruded, like physical keys — see .neu-key in
          // index.css); highlighted caps keep flat primary fills so the hint stays unmissable.
          "neu-key text-foreground";

  return (
    <div className={`select-none ${className}`} aria-hidden data-testid="session-keyboard">
      {/* Guidance line */}
      <div className="flex items-center justify-center gap-2 mb-2 min-h-[1.5rem] text-sm">
        {hintCluster && hintKeys.length > 0 ? (
          <>
            <span className="text-muted-foreground">Next:</span>
            <span
              className="font-bold text-base"
              style={isDevanagari ? { fontFamily: "'Noto Sans Devanagari', 'Mangal', sans-serif" } : undefined}
            >
              {hintCluster === " " ? "␣ (space)" : hintCluster}
            </span>
            {isDevanagari && (
              <span className="flex items-center gap-1">
                {hintKeys.map((k, i) => (
                  <kbd
                    key={i}
                    className={`px-1.5 py-0.5 rounded border font-mono text-xs ${
                      i === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    {k === " " ? "␣" : k}
                  </kbd>
                ))}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground/60 text-xs">Keyboard guide</span>
        )}
      </div>

      {/* Key rows */}
      <div className="space-y-1">
        {TYPING_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1">
            {row.map((k, ki) => {
              const state = stateFor(k);
              const width = (k.width ?? 1) * 2.4;
              const base = getKeyChar(k.key);
              const shifted = k.shiftKey ? getKeyChar(k.shiftKey) : "";

              return (
                <div
                  key={`${k.key}-${ki}`}
                  className={`relative flex flex-col items-center justify-center rounded-md border text-center transition-all duration-100 h-11 ${capClass(state)}`}
                  style={{ width: `${width}rem`, minWidth: `${width}rem` }}
                >
                  {k.functional ? (
                    <span className="text-[9px] font-medium opacity-70">{k.label ?? k.key}</span>
                  ) : isDevanagari ? (
                    <>
                      {/* Shifted Devanagari output, top-right, small */}
                      {shifted && (
                        <span
                          className="absolute top-0.5 right-1 text-[9px] leading-none opacity-60"
                          style={{ fontFamily: "'Noto Sans Devanagari', 'Mangal', sans-serif" }}
                        >
                          {shifted}
                        </span>
                      )}
                      {/* QWERTY label, top-left, tiny — the physical key the finger knows */}
                      <span className="absolute top-0.5 left-1 text-[8px] leading-none font-mono opacity-50 uppercase">
                        {k.key === " " ? "" : k.key}
                      </span>
                      {/* Primary Devanagari output, centred */}
                      <span
                        className="text-sm leading-none mt-1"
                        style={{ fontFamily: "'Noto Sans Devanagari', 'Mangal', sans-serif" }}
                      >
                        {base || (k.key === " " ? "" : k.key)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-mono uppercase">{k.key === " " ? "" : k.key}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {/* Space bar row */}
        <div className="flex justify-center">
          <div
            className={`h-8 rounded-md border transition-all duration-100 ${capClass(
              current === " " ? "now" : upcoming.has(" ") ? "next" : "idle",
            )}`}
            style={{ width: "16rem" }}
          />
        </div>
      </div>
    </div>
  );
}

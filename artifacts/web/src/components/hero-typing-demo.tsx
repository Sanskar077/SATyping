/**
 * HeroTypingDemo — a LIVE Marathi (ISM Remington) typing surface on the landing page.
 *
 * This is the real product engine, not a mock: the same useTypingEngine + attachTypingKeyHandlers
 * pipeline that powers practice, exams, and the notepad (single source of truth — see CLAUDE.md).
 * A visitor can press keys and watch Devanagari appear before ever creating an account, which is
 * the strongest possible proof that "works exactly like the exam software" isn't marketing copy.
 *
 * freeMode: no passage, no grading — just the layout responding. Deliberately tiny surface: no
 * clipboard, no persistence, English toggle included so QWERTY users see their familiar echo.
 */
import { useEffect, useRef, useState } from "react";
import { useTypingEngine } from "@/hooks/use-typing-engine";
import { attachTypingKeyHandlers } from "@/lib/typing-key-handler";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

type DemoLanguage = "marathi" | "english";

/**
 * Key-hint chips for typing "नमस्कार" — every mapping here is imported behaviour from
 * REMINGTON_MAP via the live engine, and displayed in strike order. (The previous landing page
 * hand-wrote hints like "s→क" that did not match the real layout at all.)
 */
const NAMASKAR_HINTS: { key: string; out: string }[] = [
  { key: "u", out: "न" },
  { key: "e", out: "म" },
  { key: "l", out: "स" },
  { key: "+", out: "्" },
  { key: "d", out: "क" },
  { key: "k", out: "ा" },
  { key: "j", out: "र" },
];

export function HeroTypingDemo() {
  const [language, setLanguage] = useState<DemoLanguage>("marathi");

  const engine = useTypingEngine({ passageText: "", language, freeMode: true });
  const { textareaRef, typedText, stats, appendChars, handleBackspace, deleteTrailing, composeChars, reset } = engine;

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return undefined;
    return attachTypingKeyHandlers(ta, {
      language,
      isCompleted: false,
      appendChars,
      handleBackspace,
      deleteTrailing,
      composeChars,
    });
  }, [language, appendChars, handleBackspace, deleteTrailing, composeChars, textareaRef]);

  // Focus-on-click, same pattern as the notepad surface — but never steal focus on mount:
  // this is a landing page, and yanking focus into a demo box on load is hostile.
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  useEffect(() => {
    const surface = surfaceRef.current;
    const ta = textareaRef.current;
    if (!surface || !ta) return undefined;
    const focus = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (["button", "a"].includes(tag)) return;
      setTimeout(() => ta.focus(), 0);
    };
    surface.addEventListener("mousedown", focus);
    return () => surface.removeEventListener("mousedown", focus);
  }, [textareaRef]);

  const switchLanguage = (next: DemoLanguage) => {
    if (next === language) return;
    reset();
    setLanguage(next);
  };

  const isMarathi = language === "marathi";

  return (
    <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live demo — try it now
          </span>
        </div>
        <div className="flex items-center gap-1" role="tablist" aria-label="Demo language">
          {(["marathi", "english"] as const).map((lang) => (
            <button
              key={lang}
              role="tab"
              aria-selected={language === lang}
              onClick={() => switchLanguage(lang)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                language === lang
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {lang === "marathi" ? "मराठी" : "English"}
            </button>
          ))}
        </div>
      </div>

      {/* Typing surface */}
      <div
        ref={surfaceRef}
        className={`relative min-h-[10rem] cursor-text transition-shadow ${
          isFocused ? "ring-2 ring-ring ring-inset" : ""
        }`}
      >
        <textarea
          ref={textareaRef}
          aria-label={isMarathi ? "Try Marathi typing (ISM Remington layout)" : "Try English typing"}
          className="absolute inset-0 w-full h-full opacity-0 resize-none z-10 cursor-text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <div
          className="relative z-0 p-4 whitespace-pre-wrap break-words text-xl min-h-[10rem]"
          style={{
            fontFamily: isMarathi
              ? "'Noto Sans Devanagari', 'Mangal', 'Kokila', 'Arial Unicode MS', sans-serif"
              : "var(--app-font-mono)",
            lineHeight: "1.9",
          }}
        >
          {typedText.length ? (
            typedText
          ) : (
            <span className="text-muted-foreground/60 select-none">
              {isMarathi
                ? "Click here, then press  u e l + d k j  on your keyboard…"
                : "Click here and start typing…"}
            </span>
          )}
          <span className="inline-block w-0.5 h-[1.1em] align-middle bg-primary/70 animate-pulse ml-0.5" aria-hidden />
        </div>
      </div>

      {/* Footer: hints + live stats */}
      <div className="px-4 py-3 border-t border-border bg-muted/30 space-y-2.5">
        {isMarathi && (
          <div className="flex items-center gap-1.5 flex-wrap" aria-label="Keys to type नमस्कार">
            <span className="text-[11px] text-muted-foreground mr-0.5">नमस्कार =</span>
            {NAMASKAR_HINTS.map(({ key, out }, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-border bg-card font-mono"
              >
                <kbd className="font-semibold text-foreground">{key}</kbd>
                <span className="text-muted-foreground">→{out}</span>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-xs text-muted-foreground font-mono">
            <span>
              <span className="font-bold text-foreground">{stats.grossWpm}</span> WPM
            </span>
            <span>
              <span className="font-bold text-foreground">{stats.totalTyped}</span> chars
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => { reset(); textareaRef.current?.focus(); }}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * TypingArea — passage display + keyboard input handler
 *
 * ── Why event listeners live here (not in useTypingEngine) ──────────────────
 * The engine hook runs in the parent page. During loading, TypingArea renders
 * a skeleton with no textarea → textareaRef.current is null → any engine
 * useEffect exits early and never re-runs (stable deps). By placing listeners
 * in THIS component's useEffect, the textarea is always mounted first. ✓
 *
 * ── Marathi mode (ISM Remington) ─────────────────────────────────────────────
 * • ALL keydown events are intercepted via preventDefault().
 * • Physical keys are looked up in REMINGTON_MAP → Devanagari Unicode.
 * • The ि (U+093F) pre-consonant buffer is managed here via pendingPreI ref.
 * • input events are ignored in Marathi mode.
 *
 * ── English mode ─────────────────────────────────────────────────────────────
 * • keydown: only Backspace and navigation keys handled; rest pass through.
 * • input event: read e.data → append to engine.
 *
 * ── ि pre-consonant logic ─────────────────────────────────────────────────────
 * User types 'w' (= ि) THEN 's' (= क):
 *   1. 'w' pressed → pendingPreI = true, nothing appended yet
 *   2. 's' pressed → pendingPreI = false → append "क" + "ि" = "कि" ✓
 * If 'w' pressed before a vowel or non-consonant: flush ि first then char.
 * If Backspace pressed while pendingPreI: cancel buffer (nothing removed).
 */
import { useEffect } from "react";
import type { TypingEngineResult } from "@/hooks/use-typing-engine";
import { REMINGTON_MAP } from "@/lib/ism-remington-map";
import { attachTypingKeyHandlers } from "@/lib/typing-key-handler";

interface Props {
  engine:     TypingEngineResult;
  className?: string;
  fontSize?:  string;
  isLoading?: boolean;
}

export function TypingArea({
  engine,
  className = "",
  fontSize  = "text-xl",
  isLoading = false,
}: Props) {
  const {
    textareaRef, passageGraphemes, getClusterState, isCompleted,
    appendChars, handleBackspace, language,
  } = engine;

  // ── Attach DOM event listeners ────────────────────────────────────────
  // Delegates to the SAME key-resolution logic used by the Typing Notepad —
  // see src/lib/typing-key-handler.ts. Exam/practice mode keeps the default
  // anti-cheat behaviour (allowClipboard is omitted → defaults to false).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return undefined;

    return attachTypingKeyHandlers(ta, {
      language, isCompleted, appendChars, handleBackspace,
    });
  }, [language, isCompleted, appendChars, handleBackspace, textareaRef]);

  // ── Focus management ──────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || isCompleted) return undefined;

    ta.focus();

    const refocus = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (["button","input","select","a","label"].includes(tag)) return;
      setTimeout(() => ta.focus(), 0);
    };

    window.addEventListener("mousedown", refocus);
    return () => window.removeEventListener("mousedown", refocus);
  }, [isCompleted, textareaRef]);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-muted rounded w-full" />
        <div className="h-8 bg-muted rounded w-11/12" />
        <div className="h-8 bg-muted rounded w-4/5" />
      </div>
    );
  }

  const isMarathi = language === "marathi";

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      {/*
        UNCONTROLLED textarea — full-size transparent overlay.
        - In Marathi mode: captures keydown; prevents all ASCII insertion.
        - In English mode: allows natural input events.
        - NEVER set value= here.
      */}
      <textarea
        ref={textareaRef}
        aria-label={isMarathi ? "Marathi typing area (ISM Remington)" : "English typing area"}
        tabIndex={0}
        className="absolute inset-0 w-full h-full opacity-0 resize-none z-10 cursor-text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
      />

      {/*
        Passage rendered grapheme-cluster by cluster.
        Each Devanagari akshara (including multi-codepoint conjuncts)
        gets one <span> so highlighting is visually exact.

        IMPORTANT layout rules:
        - whiteSpace: pre-wrap   → preserves spacing while allowing line wraps
        - overflowWrap: break-word → breaks long conjuncts at container edge
        - wordBreak: break-word  → fallback for older engines
        Spaces are rendered as regular U+0020 (not \u00A0) so the browser
        can wrap lines at word boundaries. Non-breaking space prevented wrapping
        and caused the horizontal scroll seen in the screenshot.
      */}
      <div
        className="relative z-0 select-none w-full"
        style={{
          fontFamily:    isMarathi
            ? "'Noto Sans Devanagari', 'Mangal', 'Kokila', 'Arial Unicode MS', sans-serif"
            : "'Courier New', 'Courier', monospace",
          lineHeight:    "2.4",
          letterSpacing: isMarathi ? "0.03em" : "0.05em",
          whiteSpace:    "pre-wrap",
          overflowWrap:  "break-word",
          wordBreak:     "break-word",
        }}
      >
        {passageGraphemes.map((cluster, i) => (
          <span key={i} className={clusterClass(getClusterState(i), fontSize)}>
            {cluster}
          </span>
        ))}
      </div>
    </div>
  );
}

function clusterClass(
  state: "correct" | "incorrect" | "cursor" | "pending",
  fontSize: string
): string {
  switch (state) {
    case "correct":   return `${fontSize} text-green-600 dark:text-green-400`;
    case "incorrect": return `${fontSize} text-white bg-red-500 dark:bg-red-600 rounded-sm px-px`;
    case "cursor":    return `${fontSize} text-foreground bg-blue-100 dark:bg-blue-900 border-b-2 border-blue-600 dark:border-blue-400`;
    case "pending":   return `${fontSize} text-foreground/80`;
  }
}

// Export for external use (e.g. passage preview)
export { REMINGTON_MAP };

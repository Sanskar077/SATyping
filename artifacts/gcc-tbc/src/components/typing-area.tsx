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
import { useEffect, useRef } from "react";
import type { TypingEngineResult } from "@/hooks/use-typing-engine";
import {
  REMINGTON_MAP,
  PRE_I_SENTINEL,
  PRE_I_MATRA,
  DEVANAGARI_CONSONANTS,
  resolveKey,
} from "@/lib/ism-remington-map";

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

  // ── Pre-consonant ि buffer (Marathi mode only) ────────────────────────
  const pendingPreI = useRef(false);

  // ── Attach DOM event listeners ────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return undefined;

    // ── MARATHI MODE ──────────────────────────────────────────────────────
    if (language === "marathi") {

      const onKeyDown = (e: KeyboardEvent) => {
        if (isCompleted) return;

        // Always block paste / undo / cut / select-all
        if ((e.ctrlKey || e.metaKey) && ["a","c","v","x","z","y"].includes(e.key.toLowerCase())) {
          e.preventDefault(); return;
        }

        // Block cursor movement (we own the caret model)
        if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","Delete","Tab"].includes(e.key)) {
          e.preventDefault(); return;
        }

        // ── Backspace ──────────────────────────────────────────────────
        if (e.key === "Backspace") {
          e.preventDefault();
          if (pendingPreI.current) {
            // Cancel the buffered ि — nothing removed from typedText
            pendingPreI.current = false;
          } else {
            handleBackspace();
          }
          return;
        }

        // ── Space ─────────────────────────────────────────────────────
        if (e.code === "Space" || e.key === " ") {
          e.preventDefault();
          if (pendingPreI.current) {
            pendingPreI.current = false;
            appendChars(PRE_I_MATRA + " "); // flush ि then space
          } else {
            appendChars(" ");
          }
          return;
        }

        // ── Ignore pure modifier key presses ──────────────────────────
        if (["Shift","Control","Alt","Meta","CapsLock","Escape","Enter","Process"].includes(e.key)) {
          return;
        }

        // ── Look up in Remington map ───────────────────────────────────
        const mapped = resolveKey(e);
        if (mapped === null) { e.preventDefault(); return; }

        e.preventDefault(); // Always prevent ASCII insertion in Marathi mode

        // ── PRE-CONSONANT ि handling ─────────────────────────────────
        if (mapped === PRE_I_SENTINEL) {
          if (pendingPreI.current) {
            // Double ि press: commit first ि, stay buffered for second
            appendChars(PRE_I_MATRA);
            // pendingPreI stays true
          } else {
            pendingPreI.current = true;
          }
          return;
        }

        // ── Regular character ─────────────────────────────────────────
        if (pendingPreI.current) {
          pendingPreI.current = false;
          if (DEVANAGARI_CONSONANTS.has(mapped)) {
            // Consonant: reorder → consonant FIRST, then ि
            appendChars(mapped + PRE_I_MATRA);
          } else {
            // Vowel / matra / digit / punctuation: flush ि, then new char
            appendChars(PRE_I_MATRA + mapped);
          }
        } else {
          appendChars(mapped);
        }
      };

      // In Marathi mode, ignore input events entirely (we handle via keydown)
      const onInput = (e: Event) => { e.stopPropagation(); };

      ta.addEventListener("keydown", onKeyDown);
      ta.addEventListener("input",   onInput, true); // capture phase

      return () => {
        ta.removeEventListener("keydown", onKeyDown);
        ta.removeEventListener("input",   onInput, true);
        pendingPreI.current = false;
      };
    }

    // ── ENGLISH MODE ──────────────────────────────────────────────────────
    {
      let composing = false;

      const onCompositionStart = () => { composing = true; };
      const onCompositionEnd   = (e: CompositionEvent) => {
        composing = false;
        if (e.data) appendChars(e.data);
        requestAnimationFrame(() => { ta.value = ""; });
      };

      const onInput = (e: Event) => {
        if (composing) return;
        const data = (e as InputEvent).data;
        if (!data) return;
        appendChars(data);
        requestAnimationFrame(() => { ta.value = ""; });
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (isCompleted) return;
        if (e.key === "Backspace") { e.preventDefault(); handleBackspace(); return; }
        if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","Delete"].includes(e.key))
          e.preventDefault();
        if ((e.ctrlKey || e.metaKey) && ["a","c","v","x","z","y"].includes(e.key.toLowerCase()))
          e.preventDefault();
      };

      ta.addEventListener("compositionstart", onCompositionStart);
      ta.addEventListener("compositionend",   onCompositionEnd);
      ta.addEventListener("input",            onInput);
      ta.addEventListener("keydown",          onKeyDown);

      return () => {
        ta.removeEventListener("compositionstart", onCompositionStart);
        ta.removeEventListener("compositionend",   onCompositionEnd);
        ta.removeEventListener("input",            onInput);
        ta.removeEventListener("keydown",          onKeyDown);
      };
    }
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
    <div className={`relative ${className}`}>
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
      */}
      <div
        className="relative z-0 select-none"
        style={{
          fontFamily:    isMarathi
            ? "'Noto Sans Devanagari', 'Mangal', 'Kokila', 'Arial Unicode MS', sans-serif"
            : "'Courier New', 'Courier', monospace",
          lineHeight:    "2.4",
          letterSpacing: isMarathi ? "0.03em" : "0.05em",
        }}
      >
        {passageGraphemes.map((cluster, i) => (
          <span key={i} className={clusterClass(getClusterState(i), fontSize)}>
            {cluster === " " ? "\u00A0" : cluster}
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

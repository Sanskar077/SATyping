/**
 * NotepadTypingArea — free-typing surface for the Typing Notepad.
 *
 * Uses the EXACT same key-resolution engine as exams/practice/drills
 * (attachTypingKeyHandlers from src/lib/typing-key-handler.ts — the single
 * source of truth for turning physical keys into committed Unicode text).
 * The only difference from <TypingArea> is `allowClipboard: true`, which
 * hands Ctrl+A/C/V/X/Z/Y to the Notepad's own copy/paste/undo/redo instead
 * of blocking them (exams intentionally block these; a scratch notepad
 * should not).
 */
import { useEffect } from "react";
import type { TypingEngineResult } from "@/hooks/use-typing-engine";
import { attachTypingKeyHandlers } from "@/lib/typing-key-handler";

interface Props {
  engine: TypingEngineResult;
  language: string;
  onPaste: (text: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectAll: () => void;
  onCopy: () => void;
  fontSize?: string;
}

export function NotepadTypingArea({
  engine, language, onPaste, onUndo, onRedo, onSelectAll, onCopy,
  fontSize = "text-xl",
}: Props) {
  const { textareaRef, typedText, appendChars, handleBackspace, isCompleted } = engine;

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return undefined;

    return attachTypingKeyHandlers(ta, {
      language, isCompleted, appendChars, handleBackspace,
      allowClipboard: true,
      onPaste, onUndo, onRedo, onSelectAll, onCopy,
    });
  }, [language, isCompleted, appendChars, handleBackspace, textareaRef, onPaste, onUndo, onRedo, onSelectAll, onCopy]);

  // Keep focus on the invisible capture textarea so keys are always caught.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return undefined;
    ta.focus();
    const refocus = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (["button", "input", "select", "a", "label", "textarea"].includes(tag)) return;
      setTimeout(() => ta.focus(), 0);
    };
    const container = ta.closest("[data-notepad-surface]");
    container?.addEventListener("mousedown", refocus as EventListener);
    return () => container?.removeEventListener("mousedown", refocus as EventListener);
  }, [textareaRef]);

  const isDevanagari = language === "marathi" || language === "hindi";

  return (
    <div data-notepad-surface className="relative w-full min-h-[16rem] rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
      <textarea
        ref={textareaRef}
        aria-label={isDevanagari ? "Marathi/Hindi typing notepad (ISM Remington)" : "English typing notepad"}
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
      <div
        id="notepad-text-display"
        className={`relative z-0 w-full h-full min-h-[16rem] p-4 whitespace-pre-wrap break-words text-foreground ${fontSize}`}
        style={{
          fontFamily: isDevanagari
            ? "'Noto Sans Devanagari', 'Mangal', 'Kokila', 'Arial Unicode MS', sans-serif"
            : "'Courier New', 'Courier', monospace",
          lineHeight: "2",
          letterSpacing: isDevanagari ? "0.03em" : "0.05em",
        }}
      >
        {typedText.length ? typedText : (
          <span className="text-muted-foreground/60 select-none">
            Start typing… (physical keys map to {isDevanagari ? "Devanagari (ISM Remington)" : "English"})
          </span>
        )}
        <span className="inline-block w-0.5 h-[1.1em] align-middle bg-primary/70 animate-pulse ml-0.5" />
      </div>
    </div>
  );
}

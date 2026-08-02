/**
 * Answer panel for the split-panel practice flow.
 *
 * Renders a bordered, visible typing surface the user transcribes INTO (the real GCC-TBC exam
 * pattern), rather than overlay-typing on top of the passage. It reuses attachTypingKeyHandlers —
 * the single source of truth for physical-key → Devanagari resolution — exactly like
 * <TypingArea> and <NotepadTypingArea> do, so ISM Remington behaviour is identical everywhere.
 *
 * Clipboard is deliberately NOT allowed here (allowClipboard defaults to false): pasting the
 * passage into the answer box would trivially defeat the exercise.
 */
import { useEffect } from "react";
import type { TypingEngineResult } from "@/hooks/use-typing-engine";
import { attachTypingKeyHandlers } from "@/lib/typing-key-handler";

interface Props {
  engine: TypingEngineResult;
  language: string;
  fontSize?: string;
  disabled?: boolean;
}

export function AnswerTypingArea({ engine, language, fontSize = "text-xl", disabled = false }: Props) {
  const { textareaRef, typedText, appendChars, handleBackspace, deleteTrailing, composeChars, isCompleted } = engine;

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return undefined;
    return attachTypingKeyHandlers(ta, {
      language,
      isCompleted: isCompleted || disabled,
      appendChars,
      handleBackspace,
      deleteTrailing,
      composeChars,
    });
  }, [language, isCompleted, disabled, appendChars, handleBackspace, deleteTrailing, composeChars, textareaRef]);

  // Keep the invisible capture textarea focused so keystrokes are never dropped, but don't steal
  // focus back from real controls (Submit button, etc.).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || isCompleted || disabled) return undefined;
    ta.focus();
    const refocus = (e: MouseEvent) => {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (["button", "input", "select", "a", "label", "textarea"].includes(tag)) return;
      setTimeout(() => ta.focus(), 0);
    };
    const container = ta.closest("[data-answer-surface]");
    container?.addEventListener("mousedown", refocus as EventListener);
    return () => container?.removeEventListener("mousedown", refocus as EventListener);
  }, [textareaRef, isCompleted, disabled]);

  const isDevanagari = language === "marathi" || language === "hindi";

  return (
    <div
      data-answer-surface
      className="relative w-full h-full min-h-[20rem] rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring"
    >
      <textarea
        ref={textareaRef}
        aria-label={isDevanagari ? "Answer area (ISM Remington)" : "Answer area"}
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
        className={`relative z-0 w-full h-full min-h-[20rem] p-4 whitespace-pre-wrap break-words text-foreground ${fontSize}`}
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
            Start typing the passage here…
          </span>
        )}
        {!isCompleted && !disabled && (
          <span className="inline-block w-0.5 h-[1.1em] align-middle bg-primary/70 animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}

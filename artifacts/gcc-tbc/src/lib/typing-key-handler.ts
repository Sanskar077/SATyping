/**
 * attachTypingKeyHandlers — the SINGLE source of truth for turning physical
 * key presses into committed Unicode text.
 *
 * This logic used to live only inside <TypingArea> (exams / practice / drills).
 * It has been extracted here, unchanged in behaviour, so that the Typing
 * Notepad (free-typing surface) can reuse the *exact same* Marathi/Hindi
 * ISM-Remington key resolution and English input handling — never a
 * second implementation.
 *
 * ── Design ────────────────────────────────────────────────────────────────
 * - Marathi & Hindi both use the ISM Remington Devanagari layout (the
 *   official CDAC GIST software uses one physical layout for both
 *   languages; only the passage/dictionary differs). "hindi" is treated
 *   as an alias of "marathi" for key-resolution purposes.
 * - English uses composition-aware input events (IME safe) exactly as
 *   before.
 * - Validation of what was typed (correct/incorrect, exam anti-cheat)
 *   NEVER happens here and never inspects raw keys — callers validate the
 *   committed `typedText` string only, matching ISM V6 behaviour.
 *
 * ── Notepad-only extensions ─────────────────────────────────────────────
 * Exams/practice must block clipboard & undo/redo (anti-cheat). The
 * Notepad explicitly wants paste / undo / redo support. Rather than fork
 * the key-resolution logic, we keep it 100% identical and only make the
 * *blocking* of Ctrl/Cmd shortcuts conditional via `allowClipboard`.
 */
import {
  PRE_I_SENTINEL,
  PRE_I_MATRA,
  DEVANAGARI_CONSONANTS,
  resolveKey,
  isDevanagariLanguage,
} from "@/lib/ism-remington-map";

export interface TypingKeyHandlerOptions {
  /** Resolved language: 'marathi' | 'hindi' | 'english' (anything else falls back to english). */
  language: string;
  isCompleted: boolean;
  appendChars: (chars: string) => void;
  handleBackspace: () => void;

  /**
   * When false (default — exams/practice/drills): Ctrl/Cmd+A/C/V/X/Z/Y are
   * blocked, matching the anti-cheat behaviour of the official test engine.
   * When true (Notepad only): those shortcuts are handed to the callbacks
   * below instead of being blocked.
   */
  allowClipboard?: boolean;
  /** Notepad: called with the pasted, already-committed Unicode text. */
  onPaste?: (text: string) => void;
  /** Notepad: Ctrl+Z */
  onUndo?: () => void;
  /** Notepad: Ctrl+Y */
  onRedo?: () => void;
  /** Notepad: Ctrl+A (select all rendered text) */
  onSelectAll?: () => void;
  /** Notepad: Ctrl+C (copy rendered text) */
  onCopy?: () => void;
}

/**
 * Attach the typing key handlers to a (usually invisible/uncontrolled)
 * <textarea>. Returns a cleanup function — call it on unmount / deps change.
 */
export function attachTypingKeyHandlers(
  ta: HTMLTextAreaElement,
  opts: TypingKeyHandlerOptions,
): () => void {
  const {
    language, isCompleted, appendChars, handleBackspace,
    allowClipboard = false, onPaste, onUndo, onRedo, onSelectAll, onCopy,
  } = opts;

  // Pre-consonant ि buffer — scoped to this attachment, matching the
  // lifetime of the previous useRef-based implementation.
  let pendingPreI = false;

  // ── DEVANAGARI (Marathi / Hindi) — ISM Remington physical layout ───────
  if (isDevanagariLanguage(language)) {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;

      const isShortcut = e.ctrlKey || e.metaKey;
      if (isShortcut) {
        const k = e.key.toLowerCase();
        if (allowClipboard) {
          if (k === "z") { e.preventDefault(); onUndo?.();  return; }
          if (k === "y") { e.preventDefault(); onRedo?.();  return; }
          if (k === "a") { e.preventDefault(); onSelectAll?.(); return; }
          if (k === "c") { e.preventDefault(); onCopy?.();  return; }
          if (k === "v" || k === "x") { return; } // let native 'paste'/'cut' fire
        } else if (["a", "c", "v", "x", "z", "y"].includes(k)) {
          e.preventDefault();
          return;
        }
      }

      // Block cursor movement (the engine owns the caret model)
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Delete", "Tab"].includes(e.key)) {
        e.preventDefault();
        return;
      }

      // ── Backspace ──────────────────────────────────────────────────
      if (e.key === "Backspace") {
        e.preventDefault();
        if (pendingPreI) {
          pendingPreI = false; // cancel buffered ि, nothing removed
        } else {
          handleBackspace();
        }
        return;
      }

      // ── Space ─────────────────────────────────────────────────────
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (pendingPreI) {
          pendingPreI = false;
          appendChars(PRE_I_MATRA + " ");
        } else {
          appendChars(" ");
        }
        return;
      }

      // ── Enter (Notepad allows newlines; exams don't use this branch) ─
      if (e.key === "Enter" && allowClipboard) {
        e.preventDefault();
        if (pendingPreI) {
          pendingPreI = false;
          appendChars(PRE_I_MATRA + "\n");
        } else {
          appendChars("\n");
        }
        return;
      }

      // ── Ignore pure modifier / IME composition keys ─────────────────
      if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Escape", "Process"].includes(e.key)) {
        return;
      }
      if (e.key === "Enter") return; // exams: no newline key handling

      // ── Look up in Remington map ────────────────────────────────────
      const mapped = resolveKey(e);
      if (mapped === null) { e.preventDefault(); return; }

      e.preventDefault();

      if (mapped === PRE_I_SENTINEL) {
        if (pendingPreI) {
          appendChars(PRE_I_MATRA); // double press: commit first, stay buffered
        } else {
          pendingPreI = true;
        }
        return;
      }

      if (pendingPreI) {
        pendingPreI = false;
        if (DEVANAGARI_CONSONANTS.has(mapped)) {
          appendChars(mapped + PRE_I_MATRA); // reorder: consonant THEN ि
        } else {
          appendChars(PRE_I_MATRA + mapped);
        }
      } else {
        appendChars(mapped);
      }
    };

    // Ignore native 'input' entirely — we own committed text via keydown.
    const onInput = (e: Event) => { e.stopPropagation(); };

    const onPasteEvent = (e: ClipboardEvent) => {
      if (!allowClipboard) { e.preventDefault(); return; }
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      // Only the final committed Unicode is ever validated/inserted — never
      // raw keys — matching ISM V6 behaviour.
      if (text) onPaste?.(text);
    };

    ta.addEventListener("keydown", onKeyDown);
    ta.addEventListener("input", onInput, true);
    ta.addEventListener("paste", onPasteEvent);

    return () => {
      ta.removeEventListener("keydown", onKeyDown);
      ta.removeEventListener("input", onInput, true);
      ta.removeEventListener("paste", onPasteEvent);
      pendingPreI = false;
    };
  }

  // ── ENGLISH — composition-aware, IME safe ───────────────────────────────
  {
    let composing = false;

    const onCompositionStart = () => { composing = true; };
    const onCompositionUpdate = () => { /* no-op: we commit on compositionend */ };
    const onCompositionEnd = (e: CompositionEvent) => {
      composing = false;
      if (e.data) appendChars(e.data);
      requestAnimationFrame(() => { ta.value = ""; });
    };

    const onBeforeInput = (e: InputEvent) => {
      // Let deletion / composition-driven input types pass through to the
      // native 'input'/'compositionend' handlers; nothing to validate here —
      // we never inspect raw keys, only the resulting committed text.
      if (e.inputType?.startsWith("history")) e.preventDefault(); // block native undo/redo in exam mode
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
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "Delete"].includes(e.key)) {
        e.preventDefault();
      }

      const isShortcut = e.ctrlKey || e.metaKey;
      if (isShortcut) {
        const k = e.key.toLowerCase();
        if (allowClipboard) {
          if (k === "z") { e.preventDefault(); onUndo?.(); return; }
          if (k === "y") { e.preventDefault(); onRedo?.(); return; }
          if (k === "a") { e.preventDefault(); onSelectAll?.(); return; }
          if (k === "c") { e.preventDefault(); onCopy?.(); return; }
          // 'v'/'x' fall through to native paste/cut
        } else if (["a", "c", "v", "x", "z", "y"].includes(k)) {
          e.preventDefault();
        }
      }
    };

    const onPasteEvent = (e: ClipboardEvent) => {
      if (!allowClipboard) { e.preventDefault(); return; }
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain") ?? "";
      if (text) onPaste?.(text);
    };

    ta.addEventListener("compositionstart", onCompositionStart);
    ta.addEventListener("compositionupdate", onCompositionUpdate);
    ta.addEventListener("compositionend", onCompositionEnd);
    ta.addEventListener("beforeinput", onBeforeInput as EventListener);
    ta.addEventListener("input", onInput);
    ta.addEventListener("keydown", onKeyDown);
    ta.addEventListener("paste", onPasteEvent);

    return () => {
      ta.removeEventListener("compositionstart", onCompositionStart);
      ta.removeEventListener("compositionupdate", onCompositionUpdate);
      ta.removeEventListener("compositionend", onCompositionEnd);
      ta.removeEventListener("beforeinput", onBeforeInput as EventListener);
      ta.removeEventListener("input", onInput);
      ta.removeEventListener("keydown", onKeyDown);
      ta.removeEventListener("paste", onPasteEvent);
    };
  }
}

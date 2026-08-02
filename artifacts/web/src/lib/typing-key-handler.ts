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
  PENDING_PRE_I,
  REPH_SENTINEL,
  REPH,
  DEVANAGARI_CONSONANTS,
  resolveKey,
  isDevanagariLanguage,
} from "@/lib/ism-remington-map";

export interface TypingKeyHandlerOptions {
  /** Resolved language: 'marathi' | 'hindi' | 'english' (anything else falls back to english). */
  language: string;
  isCompleted: boolean;
  /** Returns whether the characters were actually committed (false at the passage cap). */
  appendChars: (chars: string) => boolean;
  handleBackspace: () => void;
  /**
   * Removes exactly `count` trailing UTF-16 code units from the committed text. Used to strip
   * a visibly-committed pre-consonant mark before re-emitting it in Unicode order.
   */
  deleteTrailing: (count: number) => void;

  /**
   * Applies Remington two-keystroke composition (ा + े -> ो, half-letter + ा -> full
   * consonant, etc). Given the character this keystroke produced, the engine rewrites the
   * tail of the committed text if a rule fires and returns true; returns false if the
   * character should just be appended.
   *
   * Supplied by the engine because composition must inspect and rewrite text the engine
   * owns — this module never holds the committed string itself.
   */
  composeChars?: (incoming: string) => boolean;

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
    language, isCompleted, appendChars, handleBackspace, deleteTrailing, composeChars,
    allowClipboard = false, onPaste, onUndo, onRedo, onSelectAll, onCopy,
  } = opts;

  // ── Pre-consonant marks (velanti ि and reph र्) ─────────────────────────────
  // Both are struck BEFORE the consonant they attach to (typewriter order) but Unicode wants
  // them in logical order around it. The official ISM software shows the mark IMMEDIATELY on
  // its own keystroke, then reorders it when the consonant lands. We match that exactly:
  //
  //   press f      → "ि" appears at once (rendered on a dotted circle — no base yet)
  //   press d      → the ि is stripped and re-emitted after क → "कि"
  //   press Bksp   → the visible ि is deleted like any other character — ONE press
  //
  // The old design buffered the mark invisibly instead, which is what produced the reported
  // "first key press is ignored / needs pressing twice / backspace needs two presses" bug:
  // nothing appeared on the first press (the mark sat in a hidden buffer), and the first
  // backspace silently cancelled that hidden buffer instead of deleting visible text.
  //
  // `pendingMarks` records which trailing characters of the committed text are reorderable
  // marks still awaiting their consonant, in strike order, with their UTF-16 widths (ि = 1
  // unit, र् = 2) so they can be stripped precisely. Invariant: while non-empty, these marks
  // ARE the tail of the committed text — every other keystroke either consumes the stack
  // (consonant), detaches it (space/other), or pops it (backspace deletes the visible mark).
  type PendingMark = { kind: "preI" | "reph"; units: number };
  let pendingMarks: PendingMark[] = [];

  /**
   * Commits a resolved character, first giving the composition engine a chance to
   * rewrite the tail (ा + े -> ो, half-letter + ा -> full consonant). Falls back to a
   * plain append when no rule fires.
   */
  const commit = (chars: string) => {
    if (composeChars?.(chars)) return;
    appendChars(chars);
  };

  // ── DEVANAGARI (Marathi / Hindi) — ISM Remington physical layout ───────
  if (isDevanagariLanguage(language)) {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isCompleted) return;

      const isShortcut = e.ctrlKey || e.metaKey;
      if (isShortcut) {
        const k = e.key.toLowerCase();
        if (allowClipboard) {
          if (k === "z") { e.preventDefault(); pendingMarks = []; onUndo?.();  return; }
          if (k === "y") { e.preventDefault(); pendingMarks = []; onRedo?.();  return; }
          if (k === "a") { e.preventDefault(); onSelectAll?.(); return; }
          if (k === "c") { e.preventDefault(); onCopy?.();  return; }
          if (k === "v" || k === "x") { pendingMarks = []; return; } // let native 'paste'/'cut' fire
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
      // A pending pre-consonant mark is VISIBLE committed text, so one press removes it.
      // It is stripped by code units, not graphemes: an unattached mark can fuse into the
      // preceding cluster ("अ"+"ि" segments as one cluster), and grapheme backspace would
      // take the whole cluster with it. With no marks pending, normal grapheme backspace
      // deletes the last composed character in a single press.
      if (e.key === "Backspace") {
        e.preventDefault();
        const last = pendingMarks.pop();
        if (last) deleteTrailing(last.units);
        else handleBackspace();
        return;
      }

      // ── Space ─────────────────────────────────────────────────────
      // A pending velanti is emitted BEFORE the space in proper Unicode order (no consonant
      // base, so just the matra). Reph is already in proper order.
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (pendingMarks.length > 0) {
          deleteTrailing(pendingMarks.reduce((n, m) => n + m.units, 0));
          const reph = pendingMarks.some((m) => m.kind === "reph") ? REPH : "";
          const preI = pendingMarks.some((m) => m.kind === "preI") ? PRE_I_MATRA : "";
          appendChars(reph + preI + " ");
          pendingMarks = [];
        } else {
          appendChars(" ");
        }
        return;
      }

      // ── Enter (Notepad allows newlines; exams don't use this branch) ─
      if (e.key === "Enter" && allowClipboard) {
        e.preventDefault();
        pendingMarks = [];
        appendChars("\n");
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

      // ── Pre-consonant keys (velanti ि, reph र्) ─────────────────────
      // Committed IMMEDIATELY so the first key press is always visible — this is the fix
      // for the "first press ignored" bug. The velanti is shown on a dotted circle (◌ि,
      // the Unicode-standard display for an unattached mark, and what official ISM shows);
      // reph is already a valid standalone sequence (र्). The stack records what was
      // committed so the next consonant can strip and reorder it.
      //
      // At most ONE pending mark per kind: pressing the same key twice strands the first
      // occurrence as permanent text (dropping it from the stack) and keeps the new one
      // pending — so f f d yields a stray ◌ि followed by कि, as the old engine did.
      if (mapped === PRE_I_SENTINEL) {
        if (appendChars(PENDING_PRE_I)) {
          pendingMarks = pendingMarks.filter((m) => m.kind !== "preI");
          pendingMarks.push({ kind: "preI", units: PENDING_PRE_I.length });
        }
        return;
      }

      if (mapped === REPH_SENTINEL) {
        if (appendChars(REPH)) {
          pendingMarks = pendingMarks.filter((m) => m.kind !== "reph");
          pendingMarks.push({ kind: "reph", units: REPH.length });
        }
        return;
      }

      // ── Reorder visible pre-consonant marks around this keystroke ──
      if (pendingMarks.length > 0) {
        const marks = pendingMarks;
        pendingMarks = [];
        if (DEVANAGARI_CONSONANTS.has(mapped)) {
          // Strip the visible placeholder forms, then re-emit in Unicode order: reph
          // before the consonant, velanti after it (◌ि + र् on screen → र् + क + ि = "र्कि").
          deleteTrailing(marks.reduce((n, m) => n + m.units, 0));
          const reph = marks.some((m) => m.kind === "reph") ? REPH : "";
          const preI = marks.some((m) => m.kind === "preI") ? PRE_I_MATRA : "";
          appendChars(reph + mapped + preI);
          return;
        }
        // Non-consonant: the stranded marks keep their visible form exactly as typed
        // (matching the official software) and the key applies normally — but plain
        // append, never composition, which must not fire across a stranded mark.
        appendChars(mapped);
        return;
      }

      commit(mapped);
    };

    // Ignore native 'input' entirely — we own committed text via keydown.
    const onInput = (e: Event) => { e.stopPropagation(); };

    const onPasteEvent = (e: ClipboardEvent) => {
      if (!allowClipboard) { e.preventDefault(); return; }
      e.preventDefault();
      pendingMarks = [];
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
      pendingMarks = [];
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

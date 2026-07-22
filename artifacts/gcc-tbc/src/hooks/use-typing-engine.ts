/**
 * useTypingEngine — Marathi (ISM Remington) & English typing engine
 *
 * This hook owns state only: typedText, timer, stats, completion.
 * All DOM event handling lives in <TypingArea> where the textarea is
 * guaranteed to be mounted before any effect runs.
 *
 * ── Language modes ────────────────────────────────────────────────────────────
 * "marathi" → TypingArea intercepts keydown, applies Remington map
 * "english" → TypingArea uses input events (natural browser behaviour)
 *
 * ── Grapheme model ────────────────────────────────────────────────────────────
 * typedText is a raw Unicode string.
 * typedGraphemes = Intl.Segmenter(typedText) — grapheme clusters.
 * One cluster = one visual character (e.g. "कि", "क्ष", "ष्ट्र" are each 1).
 * Comparison, WPM, accuracy, completion all use grapheme counts.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { toGraphemes, clusterMatch, VOWEL_LENGTHENING } from "@/lib/grapheme-utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TypingStats {
  grossWpm:      number;
  wpm:           number;   // net WPM (GCC-TBC formula)
  cpm:           number;
  accuracy:      number;   // 0-100
  correctChars:  number;
  incorrectChars: number;
  totalTyped:    number;
  totalPassage:  number;
  progress:      number;   // 0-100
}

export interface TypingEngineResult {
  textareaRef:      React.RefObject<HTMLTextAreaElement | null>;
  typedText:        string;
  passageGraphemes: string[];
  typedGraphemes:   string[];
  stats:            TypingStats;
  elapsedSeconds:   number;
  hasStarted:       boolean;
  isCompleted:      boolean;
  language:         string;        // resolved: 'marathi' | 'english'
  complete:         () => void;
  getClusterState:  (i: number) => "correct" | "incorrect" | "cursor" | "pending";
  // ── Called by TypingArea ──────────────────────────────────────────────────
  appendChars:    (chars: string) => void;
  handleBackspace: () => void;
  // ── Free-mode only (Notepad): direct text control ─────────────────────────
  setText:        (text: string) => void;
  reset:          () => void;
}

interface Options {
  passageText:      string;
  language?:        string;    // 'marathi' | 'hindi' | 'english' | undefined (auto-detect)
  durationSeconds?: number;
  onComplete?:      (stats: TypingStats, elapsed: number) => void;
  /**
   * Free-typing mode (Typing Notepad): disables the passage-length cap and
   * completion-on-finish behaviour. Exams/practice/drills never pass this.
   */
  freeMode?:        boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTypingEngine({
  passageText,
  language: langProp,
  durationSeconds,
  onComplete,
  freeMode = false,
}: Options): TypingEngineResult {

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [typedText,       setTypedText]       = useState("");
  const [startTime,       setStartTime]       = useState<number | null>(null);
  const [elapsedSeconds,  setElapsedSeconds]  = useState(0);
  const [isCompleted,     setIsCompleted]     = useState(false);

  // Stable ref so event-handler closures always see the latest passage length
  const passageTextRef = useRef(passageText);
  useEffect(() => { passageTextRef.current = passageText; }, [passageText]);

  // ── Language resolution ────────────────────────────────────────────────
  const language = useMemo(() => {
    if (langProp) return langProp.toLowerCase();
    // Auto-detect: if passage contains Devanagari, treat as Marathi
    if (/[\u0900-\u097F]/.test(passageText)) return "marathi";
    return "english";
  }, [langProp, passageText]);

  // ── Derived graphemes ─────────────────────────────────────────────────
  const passageGraphemes = useMemo(
    () => toGraphemes(passageText.normalize("NFC")),
    [passageText]
  );

  const typedGraphemes = useMemo(
    () => toGraphemes(typedText),
    [typedText]
  );

  const hasStarted = startTime !== null;

  // ── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!startTime || isCompleted) return undefined;
    const id = setInterval(
      () => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)),
      500
    );
    return () => clearInterval(id);
  }, [startTime, isCompleted]);

  // ── Stats ─────────────────────────────────────────────────────────────
  const stats = useMemo((): TypingStats => {
    const totalPassage = passageGraphemes.length;
    const totalTyped   = typedGraphemes.length;

    // Notepad (freeMode): no passage to compare against — just speed/volume.
    if (freeMode) {
      const mins = elapsedSeconds > 0 ? elapsedSeconds / 60 : 1 / 60;
      const grossWpm = totalTyped ? Math.max(0, Math.round((totalTyped / 5) / mins)) : 0;
      const cpm      = totalTyped ? Math.max(0, Math.round(totalTyped / mins)) : 0;
      return {
        grossWpm, wpm: grossWpm, cpm, accuracy: 100,
        correctChars: totalTyped, incorrectChars: 0,
        totalTyped, totalPassage: 0, progress: 0,
      };
    }

    if (!totalTyped || !totalPassage) {
      return {
        grossWpm: 0, wpm: 0, cpm: 0, accuracy: 100,
        correctChars: 0, incorrectChars: 0, totalTyped: 0, totalPassage, progress: 0,
      };
    }

    let correct = 0, incorrect = 0;
    for (let i = 0; i < totalTyped; i++) {
      const t = typedGraphemes[i]  ?? "";
      const p = passageGraphemes[i] ?? "";
      const isLastTyped = i === totalTyped - 1;
      const match = clusterMatch(t, p);
      if (match === "exact") { correct++; continue; }
      if (match === "prefix" && isLastTyped) continue; // still composing — not a mistake (yet)
      incorrect++;
    }

    const mins     = elapsedSeconds > 0 ? elapsedSeconds / 60 : 1 / 60;
    const grossWpm = Math.max(0, Math.round((totalTyped  / 5) / mins));
    // GCC-TBC net WPM: (correct_chars − incorrect_chars) / 5 / mins
    const wpm      = Math.max(0, Math.round(((correct - incorrect) / 5) / mins));
    const cpm      = Math.max(0, Math.round(correct / mins));
    const accuracy = Math.round((correct / totalTyped) * 100);
    const progress = Math.min(100, Math.round((totalTyped / totalPassage) * 100));

    return {
      grossWpm, wpm, cpm, accuracy,
      correctChars: correct, incorrectChars: incorrect,
      totalTyped, totalPassage, progress,
    };
  }, [typedGraphemes, passageGraphemes, elapsedSeconds, freeMode]);

  // ── Complete ──────────────────────────────────────────────────────────
  const handleComplete = useCallback(() => {
    if (isCompleted) return;
    setIsCompleted(true);
    const elapsed = startTime
      ? Math.floor((Date.now() - startTime) / 1000)
      : elapsedSeconds;
    setElapsedSeconds(elapsed);
    onComplete?.(stats, elapsed);
  }, [isCompleted, startTime, elapsedSeconds, stats, onComplete]);

  // Auto-complete when passage finished. Cluster COUNT reaching the passage's length is not
  // sufficient on its own — if the passage's LAST character is a consonant+matra sequence, the
  // count matches as soon as the bare consonant is typed (क alone is already 1 cluster, same as
  // target का), which would end the exam before the matra was actually typed. Require the last
  // cluster to be an exact match too.
  useEffect(() => {
    if (freeMode || isCompleted || passageGraphemes.length === 0) return;
    if (typedGraphemes.length < passageGraphemes.length) return;
    const lastIndex = passageGraphemes.length - 1;
    const typedLast  = (typedGraphemes[lastIndex] ?? "").normalize("NFC");
    const targetLast = (passageGraphemes[lastIndex] ?? "").normalize("NFC");
    if (typedLast !== targetLast) return;
    handleComplete();
  }, [typedGraphemes, passageGraphemes, isCompleted, handleComplete, freeMode]);

  // Countdown auto-complete (exam mode)
  useEffect(() => {
    if (!durationSeconds || !startTime || isCompleted) return undefined;
    if (elapsedSeconds >= durationSeconds) handleComplete();
    return undefined;
  }, [elapsedSeconds, durationSeconds, startTime, isCompleted, handleComplete]);

  // ── Public handlers called by TypingArea ──────────────────────────────
  // `freeMode` (used by the Typing Notepad) disables the passage-length cap
  // so typing is never blocked — there is no passage to finish against.
  const appendChars = useCallback((chars: string) => {
    if (!chars || isCompleted) return;
    const norm = chars.normalize("NFC");
    setStartTime((p) => p ?? Date.now());
    setTypedText((prev) => {
      const lengthened = VOWEL_LENGTHENING[prev.slice(-1)]?.[norm];
      const next = lengthened ? prev.slice(0, -1) + lengthened : prev + norm;
      if (freeMode) return next;
      const nextG   = toGraphemes(next);
      const passLen = toGraphemes(passageTextRef.current.normalize("NFC")).length;
      return nextG.length > passLen ? prev : next;
    });
  }, [isCompleted, freeMode]);

  const handleBackspace = useCallback(() => {
    if (isCompleted) return;
    setTypedText((prev) => {
      const g = toGraphemes(prev);
      return g.length ? g.slice(0, -1).join("") : "";
    });
  }, [isCompleted]);

  // ── Free-mode only helpers (Notepad: load/clear/paste/undo-redo) ───────
  // Never used by exams/practice — those only ever call appendChars/
  // handleBackspace above, preserving existing anti-cheat guarantees.
  const setText = useCallback((text: string) => {
    setStartTime((p) => p ?? (text ? Date.now() : p));
    setTypedText(text.normalize("NFC"));
  }, []);

  const reset = useCallback(() => {
    setTypedText("");
    setStartTime(null);
    setElapsedSeconds(0);
    setIsCompleted(false);
  }, []);

  // ── Cluster state for rendering ───────────────────────────────────────
  const getClusterState = useCallback(
    (i: number): "correct" | "incorrect" | "cursor" | "pending" => {
      if (i < typedGraphemes.length) {
        const t = typedGraphemes[i]  ?? "";
        const p = passageGraphemes[i] ?? "";
        const isLastTyped = i === typedGraphemes.length - 1;
        const match = clusterMatch(t, p);
        if (match === "exact") return "correct";
        if (match === "prefix" && isLastTyped) return "cursor"; // still composing a matra
        return "incorrect";
      }
      return i === typedGraphemes.length ? "cursor" : "pending";
    },
    [typedGraphemes, passageGraphemes]
  );

  return {
    textareaRef, typedText, passageGraphemes, typedGraphemes,
    stats, elapsedSeconds, hasStarted, isCompleted, language,
    complete: handleComplete, getClusterState,
    appendChars, handleBackspace, setText, reset,
  };
}

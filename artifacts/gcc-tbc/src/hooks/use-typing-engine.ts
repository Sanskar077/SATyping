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
import { toGraphemes } from "@/lib/grapheme-utils";

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
}

interface Options {
  passageText:      string;
  language?:        string;    // 'marathi' | 'english' | undefined (auto-detect)
  durationSeconds?: number;
  onComplete?:      (stats: TypingStats, elapsed: number) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTypingEngine({
  passageText,
  language: langProp,
  durationSeconds,
  onComplete,
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

    if (!totalTyped || !totalPassage) {
      return {
        grossWpm: 0, wpm: 0, cpm: 0, accuracy: 100,
        correctChars: 0, incorrectChars: 0, totalTyped: 0, totalPassage, progress: 0,
      };
    }

    let correct = 0, incorrect = 0;
    for (let i = 0; i < totalTyped; i++) {
      const t = (typedGraphemes[i]  ?? "").normalize("NFC");
      const p = (passageGraphemes[i] ?? "").normalize("NFC");
      if (t === p) correct++; else incorrect++;
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
  }, [typedGraphemes, passageGraphemes, elapsedSeconds]);

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

  // Auto-complete when passage finished
  useEffect(() => {
    if (!isCompleted && passageGraphemes.length > 0 &&
        typedGraphemes.length >= passageGraphemes.length)
      handleComplete();
  }, [typedGraphemes.length, passageGraphemes.length, isCompleted, handleComplete]);

  // Countdown auto-complete (exam mode)
  useEffect(() => {
    if (!durationSeconds || !startTime || isCompleted) return undefined;
    if (elapsedSeconds >= durationSeconds) handleComplete();
    return undefined;
  }, [elapsedSeconds, durationSeconds, startTime, isCompleted, handleComplete]);

  // ── Public handlers called by TypingArea ──────────────────────────────
  const appendChars = useCallback((chars: string) => {
    if (!chars || isCompleted) return;
    const norm = chars.normalize("NFC");
    setStartTime((p) => p ?? Date.now());
    setTypedText((prev) => {
      const next    = prev + norm;
      const nextG   = toGraphemes(next);
      const passLen = toGraphemes(passageTextRef.current.normalize("NFC")).length;
      return nextG.length > passLen ? prev : next;
    });
  }, [isCompleted]);

  const handleBackspace = useCallback(() => {
    if (isCompleted) return;
    setTypedText((prev) => {
      const g = toGraphemes(prev);
      return g.length ? g.slice(0, -1).join("") : "";
    });
  }, [isCompleted]);

  // ── Cluster state for rendering ───────────────────────────────────────
  const getClusterState = useCallback(
    (i: number): "correct" | "incorrect" | "cursor" | "pending" => {
      if (i < typedGraphemes.length) {
        const t = (typedGraphemes[i]  ?? "").normalize("NFC");
        const p = (passageGraphemes[i] ?? "").normalize("NFC");
        return t === p ? "correct" : "incorrect";
      }
      return i === typedGraphemes.length ? "cursor" : "pending";
    },
    [typedGraphemes, passageGraphemes]
  );

  return {
    textareaRef, typedText, passageGraphemes, typedGraphemes,
    stats, elapsedSeconds, hasStarted, isCompleted, language,
    complete: handleComplete, getClusterState,
    appendChars, handleBackspace,
  };
}

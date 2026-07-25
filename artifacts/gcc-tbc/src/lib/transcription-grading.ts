/**
 * Grading for FREE-TRANSCRIPTION typing (GCC-TBC exam pattern): the user reads the passage in one
 * panel and retypes it into a separate answer box, rather than overlay-typing on top of it.
 *
 * Why this exists separately from useTypingEngine's stats: the engine compares typed[i] against
 * passage[i] positionally, which is correct for overlay typing (where input is capped at the
 * passage length and can't drift). In free transcription the user can omit or insert a word, after
 * which every later character shifts and a positional compare would report ~0% accuracy for what is
 * really one mistake. So we align WORD BY WORD first — matching how GCC-TBC actually marks scripts
 * (wrong words) — and only compare graphemes within each aligned word pair.
 *
 * Grading always runs on the final committed Unicode text, never on raw key presses.
 */
import { toGraphemes } from "@/lib/grapheme-utils";

export interface TranscriptionStats {
  grossWpm: number;
  netWpm: number;
  cpm: number;
  accuracy: number;
  correctChars: number;
  incorrectChars: number;
  totalTyped: number;
  totalPassage: number;
  wrongWords: number;
  progress: number;
}

const splitWords = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

/**
 * Compares two aligned words grapheme-by-grapheme.
 * Returns how many graphemes matched and how many were wrong (a length difference counts as wrong).
 */
function compareWord(expected: string, actual: string): { correct: number; incorrect: number } {
  const e = toGraphemes(expected.normalize("NFC"));
  const a = toGraphemes(actual.normalize("NFC"));
  let correct = 0;
  for (let i = 0; i < Math.min(e.length, a.length); i++) {
    if (e[i] === a[i]) correct++;
  }
  // Everything the user typed beyond the matches is wrong, and so is anything they left out.
  const incorrect = Math.max(e.length, a.length) - correct;
  return { correct, incorrect };
}

type Op =
  | { kind: "match" | "substitute"; expected: string; actual: string }
  | { kind: "omit"; expected: string }
  | { kind: "insert"; actual: string };

/**
 * Word-level alignment via Levenshtein edit distance with backtracking.
 *
 * Index-based pairing (expected[i] vs actual[i]) is wrong here: omit one word early on and every
 * later word is compared against its neighbour, turning a single mistake into a total mismatch.
 * Aligning first means an omission costs one word, and the rest of the transcription still scores
 * as correct — which is how a GCC-TBC script is actually marked.
 */
function alignWords(expected: string[], actual: string[]): Op[] {
  const n = expected.length;
  const m = actual.length;
  // cost[i][j] = edit distance between expected[i..] and actual[j..]
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) cost[i]![m] = n - i;
  for (let j = m - 1; j >= 0; j--) cost[n]![j] = m - j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const sub = cost[i + 1]![j + 1]! + (expected[i] === actual[j] ? 0 : 1);
      cost[i]![j] = Math.min(sub, cost[i + 1]![j]! + 1, cost[i]![j + 1]! + 1);
    }
  }

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const sub = cost[i + 1]![j + 1]! + (expected[i] === actual[j] ? 0 : 1);
    if (cost[i]![j] === sub) {
      ops.push({
        kind: expected[i] === actual[j] ? "match" : "substitute",
        expected: expected[i]!,
        actual: actual[j]!,
      });
      i++; j++;
    } else if (cost[i]![j] === cost[i + 1]![j]! + 1) {
      ops.push({ kind: "omit", expected: expected[i]! });
      i++;
    } else {
      ops.push({ kind: "insert", actual: actual[j]! });
      j++;
    }
  }
  while (i < n) ops.push({ kind: "omit", expected: expected[i++]! });
  while (j < m) ops.push({ kind: "insert", actual: actual[j++]! });
  return ops;
}

export function gradeTranscription(
  passageText: string,
  typedText: string,
  elapsedSeconds: number,
): TranscriptionStats {
  const passageGraphemes = toGraphemes(passageText.normalize("NFC"));
  const typedGraphemes = toGraphemes(typedText.normalize("NFC"));
  const totalPassage = passageGraphemes.length;
  const totalTyped = typedGraphemes.length;

  if (!totalTyped) {
    return {
      grossWpm: 0, netWpm: 0, cpm: 0, accuracy: 0,
      correctChars: 0, incorrectChars: 0, totalTyped: 0, totalPassage,
      wrongWords: 0, progress: 0,
    };
  }

  const expectedWords = splitWords(passageText);
  const actualWords = splitWords(typedText);

  let correct = 0;
  let incorrect = 0;
  let wrongWords = 0;

  for (const op of alignWords(expectedWords, actualWords)) {
    if (op.kind === "match") {
      correct += toGraphemes(op.expected.normalize("NFC")).length;
      continue;
    }
    wrongWords++;
    if (op.kind === "substitute") {
      const r = compareWord(op.expected, op.actual);
      correct += r.correct;
      incorrect += r.incorrect;
    } else if (op.kind === "omit") {
      incorrect += toGraphemes(op.expected.normalize("NFC")).length;
    } else {
      incorrect += toGraphemes(op.actual.normalize("NFC")).length;
    }
  }

  // The whitespace BETWEEN correctly-transcribed words is part of what the user typed, so it must
  // count toward the correct total — otherwise even a flawless transcription scores well under
  // 100% simply because separators are in totalTyped but never in correctChars.
  const separatorsTyped = Math.max(0, actualWords.length - 1);
  correct += Math.min(separatorsTyped, Math.max(0, expectedWords.length - 1));

  // Guard against a zero/negative elapsed time producing Infinity.
  const mins = elapsedSeconds > 0 ? elapsedSeconds / 60 : 1 / 60;
  const grossWpm = Math.max(0, Math.round((totalTyped / 5) / mins));
  // Same GCC-TBC net formula the overlay engine uses: (correct − incorrect) / 5 / minutes.
  const netWpm = Math.max(0, Math.round(((correct - incorrect) / 5) / mins));
  const cpm = Math.max(0, Math.round(correct / mins));
  const accuracy = Math.max(0, Math.min(100, Math.round((correct / totalTyped) * 100)));
  const progress = totalPassage ? Math.min(100, Math.round((totalTyped / totalPassage) * 100)) : 0;

  return {
    grossWpm, netWpm, cpm, accuracy,
    correctChars: correct, incorrectChars: incorrect,
    totalTyped, totalPassage, wrongWords, progress,
  };
}

import { describe, it, expect } from "vitest";
import { gradeTranscription } from "../transcription-grading";

const PASSAGE = "the quick brown fox jumps over the lazy dog";
const MARATHI = "मी शाळेत जातो";

describe("gradeTranscription", () => {
  it("scores a perfect transcription at 100% with no errors", () => {
    const r = gradeTranscription(PASSAGE, PASSAGE, 60);
    expect(r.accuracy).toBe(100);
    expect(r.incorrectChars).toBe(0);
    expect(r.wrongWords).toBe(0);
  });

  it("scores a perfect Devanagari transcription at 100%", () => {
    const r = gradeTranscription(MARATHI, MARATHI, 60);
    expect(r.accuracy).toBe(100);
    expect(r.wrongWords).toBe(0);
  });

  it("counts a single mistyped word as exactly one wrong word", () => {
    // "brown" → "brawn": one substituted grapheme inside one word.
    const r = gradeTranscription(PASSAGE, "the quick brawn fox jumps over the lazy dog", 60);
    expect(r.wrongWords).toBe(1);
    expect(r.incorrectChars).toBe(1);
    expect(r.accuracy).toBeGreaterThan(90);
  });

  it("does not cascade when a word is OMITTED — the rest still scores as correct", () => {
    // This is the case index-based pairing gets catastrophically wrong: dropping "brown" shifts
    // every later word, so a naive compare reports near-zero accuracy for one real mistake.
    const r = gradeTranscription(PASSAGE, "the quick fox jumps over the lazy dog", 60);
    expect(r.wrongWords).toBe(1);
    expect(r.accuracy).toBeGreaterThan(85);
  });

  it("does not cascade when a word is INSERTED", () => {
    const r = gradeTranscription(PASSAGE, "the quick brown red fox jumps over the lazy dog", 60);
    expect(r.wrongWords).toBe(1);
    expect(r.accuracy).toBeGreaterThan(85);
  });

  it("returns zeroed stats for empty input rather than NaN/Infinity", () => {
    const r = gradeTranscription(PASSAGE, "", 60);
    expect(r.accuracy).toBe(0);
    expect(r.netWpm).toBe(0);
    expect(r.totalTyped).toBe(0);
  });

  it("scores a partial transcription accurately on what was typed", () => {
    const r = gradeTranscription(PASSAGE, "the quick brown fox", 60);
    // Everything typed is correct; the untyped remainder counts as omissions, not typing errors.
    expect(r.accuracy).toBe(100);
    expect(r.progress).toBeLessThan(100);
  });

  it("scores a completely wrong transcription near zero accuracy", () => {
    const r = gradeTranscription(PASSAGE, "zzz zzz zzz", 60);
    expect(r.accuracy).toBeLessThan(20);
  });

  it("never divides by zero when elapsed time is 0", () => {
    const r = gradeTranscription(PASSAGE, PASSAGE, 0);
    expect(Number.isFinite(r.netWpm)).toBe(true);
    expect(Number.isFinite(r.grossWpm)).toBe(true);
  });

  it("clamps accuracy to the 0-100 range", () => {
    for (const typed of ["", PASSAGE, "zzz", PASSAGE + " extra words here"]) {
      const r = gradeTranscription(PASSAGE, typed, 30);
      expect(r.accuracy).toBeGreaterThanOrEqual(0);
      expect(r.accuracy).toBeLessThanOrEqual(100);
    }
  });
});

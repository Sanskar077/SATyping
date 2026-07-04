/**
 * Grapheme cluster utilities using Intl.Segmenter (granularity: grapheme).
 * Shared by the engine, the map, and test code.
 */

const SEGMENTER = new Intl.Segmenter("hi", { granularity: "grapheme" });

/** Split a Unicode string into grapheme clusters (visual characters). */
export function toGraphemes(text: string): string[] {
  if (!text) return [];
  return [...SEGMENTER.segment(text)].map((s) => s.segment);
}

/** Remove the last grapheme cluster — correct backspace for Devanagari. */
export function removeLastGrapheme(text: string): string {
  const g = toGraphemes(text);
  return g.length ? g.slice(0, -1).join("") : "";
}

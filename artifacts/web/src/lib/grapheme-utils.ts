/**
 * Grapheme cluster utilities using Intl.Segmenter (granularity: grapheme).
 * Shared by the engine, the map, and test code.
 */
import { PENDING_PRE_I } from "./ism-remington-map";

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

/**
 * Short vowel → matra → long vowel, for the pairs where typing the independent vowel followed by
 * its matra key produces the long vowel form instead of literally concatenating them (ा/ी/ू are
 * combining marks that only attach to a consonant — after अ/इ/उ they'd be an orphaned combining
 * mark with no valid base). Single source of truth for both the live typing engine
 * (use-typing-engine.ts, which performs the substitution) and clusterMatch below (which needs to
 * know a short vowel is a valid in-progress prefix of its long form, not a mismatch).
 */
export const VOWEL_LENGTHENING: Record<string, Record<string, string>> = {
  "अ": { "ा": "आ" },
  "इ": { "ी": "ई" },
  "उ": { "ू": "ऊ" },
};

/**
 * Compares a typed grapheme cluster against its target passage cluster.
 *
 * A Devanagari consonant+matra sequence (e.g. क + ा → का) is ONE grapheme cluster but is typed
 * across TWO keystrokes. Mid-sequence — after क but before ा — the typed cluster is "क" while the
 * target is "का". Strict equality would flag that as wrong for one frame even though it's a
 * correctly-in-progress character. Since Devanagari matras only ever EXTEND a cluster (never
 * prepend to it — the one exception, ि, is reordered by the key handler), a still-forming
 * cluster is only truly wrong once it can no longer become the target, i.e. once it stops being
 * a prefix of it.
 *
 * The same in-progress tolerance applies to the vowel-lengthening pairs above: अ typed toward a
 * target of आ is a valid partial, not a mismatch, even though आ is not literally a string-prefix
 * of "अ" + anything (it's a different codepoint, not अ with something appended).
 *
 * PENDING VELANTI: a velanti struck before its consonant is committed immediately as ◌ + ि
 * (dotted circle base — PENDING_PRE_I from ism-remington-map.ts) and reordered when the
 * consonant lands. So "◌ि" on the way to "कि" — or "र्◌ि" on the way to "र्कि" — is a correctly
 * in-progress cluster: everything before the ◌ must be a prefix of the target, and the target
 * must end with the awaiting ि.
 */
export function clusterMatch(typed: string, target: string): "exact" | "prefix" | "mismatch" {
  const t = typed.normalize("NFC");
  const p = target.normalize("NFC");
  if (t === p) return "exact";
  if (t.length > 0 && p.startsWith(t)) return "prefix";
  if (Object.values(VOWEL_LENGTHENING[t] ?? {}).includes(p)) return "prefix";
  if (t.endsWith(PENDING_PRE_I)) {
    const before = t.slice(0, -PENDING_PRE_I.length);
    if (p.endsWith("ि") && (before === "" || p.startsWith(before))) return "prefix";
  }
  return "mismatch";
}

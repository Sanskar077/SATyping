/**
 * Annotation layer for REMINGTON_MAP — the Virtual Keyboard, hover details, search, filters, and
 * Learning Mode all read from THIS file for category/description/example-word metadata. It never
 * redefines a single character: every glyph still comes from `ism-remington-map.ts`'s
 * REMINGTON_MAP, the one and only source of truth for what a key produces. This file only adds
 * descriptive context on top of that.
 */
import { REMINGTON_MAP, PRE_I_SENTINEL, REPH_SENTINEL, REPH } from "@/lib/ism-remington-map";

export type KeyCategory =
  | "consonant"
  | "vowel"        // independent vowels (अ, आ, इ, ई, उ, ...)
  | "matra"        // dependent vowel signs (ा, ि, ी, ु, ू, े, ै, ृ, ॅ, ...)
  | "conjunct"      // pre-built ligatures (श्र, ज्ञ, द्य, ...) and subjoined-ra (्र)
  | "half-letter"   // explicit consonant + halant + ZWJ forms
  | "number"
  | "symbol"
  | "punctuation"
  | "special";      // nukta, bare virama, danda, anusvara/visarga, pre-i sentinel

export interface KeyMeta {
  key: string;
  category: KeyCategory;
  description: string;
  /** A couple of common Marathi words that use this character, where applicable. */
  examples?: string[];
}

const META: Record<string, Omit<KeyMeta, "key">> = {
  // ── No-shift letters ─────────────────────────────────────────────────
  a: { category: "special", description: "Anusvara — nasal sound marker", examples: ["गंगा", "रंग"] },
  b: { category: "vowel", description: "Independent vowel: short i", examples: ["इमारत"] },
  c: { category: "consonant", description: "Consonant: ba" },
  d: { category: "consonant", description: "Consonant: ka" },
  e: { category: "consonant", description: "Consonant: ma" },
  f: { category: "matra", description: "Short-i matra (ि) — the ONLY pre-consonant key; typed BEFORE the consonant", examples: ["कि", "दिवस"] },
  g: { category: "consonant", description: "Consonant: ha" },
  h: { category: "matra", description: "Long-i matra (ी) — typed after the consonant", examples: ["की", "नदी"] },
  i: { category: "consonant", description: "Consonant: pa" },
  j: { category: "consonant", description: "Consonant: ra" },
  k: { category: "matra", description: "Aa matra (ा) — typed after the consonant", examples: ["का", "मराठा"] },
  l: { category: "consonant", description: "Consonant: sa" },
  m: { category: "vowel", description: "Independent vowel: u", examples: ["उन्हाळा"] },
  n: { category: "consonant", description: "Consonant: da" },
  o: { category: "consonant", description: "Consonant: va" },
  p: { category: "consonant", description: "Consonant: cha" },
  q: { category: "matra", description: "U matra (ु) — typed after the consonant", examples: ["कु", "गुण"] },
  r: { category: "consonant", description: "Consonant: ta" },
  s: { category: "matra", description: "E matra (े) — typed after the consonant", examples: ["के", "मेणबत्ती"] },
  t: { category: "consonant", description: "Consonant: ja" },
  u: { category: "consonant", description: "Consonant: na" },
  v: { category: "vowel", description: "Independent vowel: a", examples: ["अभ्यास"] },
  w: { category: "matra", description: "Long-u matra (ू) — typed after the consonant", examples: ["कू", "भू"] },
  x: { category: "consonant", description: "Consonant: ga" },
  y: { category: "consonant", description: "Consonant: la" },
  z: { category: "conjunct", description: "Subjoined-ra conjunct (्र) — attaches to the preceding consonant", examples: ["क्रम", "प्रश्न"] },

  // ── Shift letters ────────────────────────────────────────────────────
  A: { category: "matra", description: "Aa matra (ा) — alternate key, same as 'k'" },
  B: { category: "consonant", description: "Consonant: Tha (retroflex)" },
  C: { category: "half-letter", description: "Explicit half-ba" },
  D: { category: "half-letter", description: "Explicit half-ka" },
  E: { category: "half-letter", description: "Explicit half-ma" },
  F: { category: "half-letter", description: "Explicit half-tha" },
  G: { category: "consonant", description: "Consonant: La (retroflex) — Marathi-specific", examples: ["बाळ", "फळ"] },
  H: { category: "half-letter", description: "Explicit half-bha" },
  I: { category: "half-letter", description: "Explicit half-pa" },
  J: { category: "conjunct", description: "Pre-built ligature: shra", examples: ["श्रीमंत"] },
  K: { category: "conjunct", description: "Pre-built ligature: dnya", examples: ["ज्ञान"] },
  L: { category: "half-letter", description: "Explicit half-sa" },
  M: { category: "consonant", description: "Consonant: Da (retroflex)" },
  N: { category: "consonant", description: "Consonant: cha (aspirated)" },
  O: { category: "half-letter", description: "Explicit half-va" },
  P: { category: "half-letter", description: "Explicit half-cha" },
  Q: { category: "consonant", description: "Consonant: pha" },
  R: { category: "half-letter", description: "Explicit half-ta" },
  S: { category: "matra", description: "Ai matra (ै) — typed after the consonant", examples: ["कै", "मैत्री"] },
  T: { category: "half-letter", description: "Explicit half-ja" },
  U: { category: "half-letter", description: "Explicit half-na" },
  V: { category: "consonant", description: "Consonant: Ta (retroflex)" },
  W: { category: "matra", description: "Candra-E / short-e matra (ॅ)" },
  X: { category: "half-letter", description: "Explicit half-ga" },
  Y: { category: "half-letter", description: "Explicit half-la" },
  Z: { category: "special", description: "Reph (र्) — typed BEFORE the consonant it sits above", examples: ["कर्म", "सर्व"] },

  // ── Digits ───────────────────────────────────────────────────────────
  "1": { category: "number", description: "Devanagari digit 1" },
  "2": { category: "number", description: "Devanagari digit 2" },
  "3": { category: "number", description: "Devanagari digit 3" },
  "4": { category: "number", description: "Devanagari digit 4" },
  "5": { category: "number", description: "Devanagari digit 5" },
  "6": { category: "number", description: "Devanagari digit 6" },
  "7": { category: "number", description: "Devanagari digit 7" },
  "8": { category: "number", description: "Devanagari digit 8" },
  "9": { category: "number", description: "Devanagari digit 9" },
  "0": { category: "number", description: "Devanagari digit 0" },

  // ── Symbol row, no shift ─────────────────────────────────────────────
  "`": { category: "special", description: "Nukta — modifies a consonant for a borrowed/loan sound" },
  "-": { category: "consonant", description: "Consonant: nya" },
  "=": { category: "matra", description: "Vocalic-ri matra (ृ) — typed after the consonant", examples: ["कृपा", "गृह"] },
  "[": { category: "half-letter", description: "Explicit half-kha" },
  "]": { category: "punctuation", description: "Comma (ASCII passthrough)" },
  "\\": { category: "punctuation", description: "Period (ASCII passthrough)" },
  ";": { category: "consonant", description: "Consonant: ya" },
  "'": { category: "half-letter", description: "Explicit half-sha (palatal)" },
  ",": { category: "vowel", description: "Independent vowel: e", examples: ["एक"] },
  ".": { category: "half-letter", description: "Explicit half-Na (retroflex)" },
  "/": { category: "half-letter", description: "Explicit half-dha" },

  // ── Symbol row, with shift ───────────────────────────────────────────
  "~": { category: "conjunct", description: "Pre-built ligature: dya", examples: ["विद्या"] },
  "!": { category: "punctuation", description: "Danda — Devanagari full stop (।)" },
  "@": { category: "punctuation", description: "Forward slash (ASCII passthrough)" },
  "#": { category: "punctuation", description: "Colon (ASCII passthrough)" },
  "$": { category: "half-letter", description: "Explicit half-ra (alternate key)" },
  "%": { category: "punctuation", description: "Hyphen (ASCII passthrough)" },
  "^": { category: "punctuation", description: "Double-quote (ASCII passthrough)" },
  "&": { category: "punctuation", description: "Apostrophe (ASCII passthrough)" },
  "*": { category: "conjunct", description: "Pre-built ligature: ddha", examples: ["बुद्ध"] },
  "(": { category: "conjunct", description: "Pre-built ligature: tra", examples: ["मित्र"] },
  ")": { category: "vowel", description: "Independent vowel: vocalic-ri", examples: ["ऋषी"] },
  "_": { category: "punctuation", description: "Period (alternate key, ASCII passthrough)" },
  "+": { category: "special", description: "Bare virama/halant (्) — forms conjuncts and reph when followed by a consonant" },
  "{": { category: "half-letter", description: "Explicit half of the ksha conjunct" },
  "}": { category: "conjunct", description: "Pre-built ligature: dva", examples: ["द्वार"] },
  "|": { category: "special", description: "No character assigned on the reference chart — intentionally inert" },
  ":": { category: "conjunct", description: "Ra + long-u matra (rū)", examples: ["रूप"] },
  "\"": { category: "half-letter", description: "Explicit half-sha (retroflex)" },
  "<": { category: "consonant", description: "Consonant: Dha (retroflex)" },
  ">": { category: "consonant", description: "Consonant: jha" },
  "?": { category: "half-letter", description: "Explicit half-gha" },

  " ": { category: "special", description: "Space" },
};

/** Every entry in REMINGTON_MAP, decorated with category/description/examples. Single pass over
 * the real map — if a key exists there but has no entry here, it still shows up with a generic
 * fallback rather than silently disappearing from the reference UI. */
export const KEY_METADATA: KeyMeta[] = Object.keys(REMINGTON_MAP).map((key) => {
  const meta = META[key];
  return {
    key,
    category: meta?.category ?? "symbol",
    description: meta?.description ?? "—",
    examples: meta?.examples,
  };
});

export function getKeyChar(key: string): string {
  const raw = REMINGTON_MAP[key];
  if (raw === undefined) return "";
  // Both pre-consonant keys store a control-character sentinel rather than real text —
  // substitute a displayable glyph so the on-screen keyboard never renders a control char.
  if (raw === PRE_I_SENTINEL) return "ि";
  if (raw === REPH_SENTINEL) return REPH;
  return raw;
}

export function getKeyMeta(key: string): KeyMeta | undefined {
  return KEY_METADATA.find((m) => m.key === key);
}

export const CATEGORY_LABELS: Record<KeyCategory, string> = {
  consonant: "Consonants",
  vowel: "Vowels",
  matra: "Matras",
  conjunct: "Conjuncts",
  "half-letter": "Half-letters",
  number: "Numbers",
  symbol: "Symbols",
  punctuation: "Punctuation",
  special: "Special",
};

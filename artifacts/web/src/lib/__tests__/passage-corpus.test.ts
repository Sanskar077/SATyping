import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  REMINGTON_MAP, PRE_I_SENTINEL, REPH_SENTINEL, PRE_I_MATRA, REPH,
  COMPOSITION_RULES, VIRAMA, ZWJ,
} from "../ism-remington-map";

/**
 * Guards the seeded corpus against the typing engine.
 *
 * A passage containing a character the ISM Remington layout cannot produce is impossible to
 * complete — the candidate would be stuck forever and grading could never reach 100%. This test
 * reads the ACTUAL generated corpus and asserts every Marathi character is reachable, so a future
 * re-run of fetch-passages that pulls in an exotic glyph fails CI instead of reaching students.
 */
const CORPUS = path.resolve(__dirname, "../../../../../scripts/src/data/passages.generated.json");

interface Passage {
  title: string; content: string; language: string;
  difficulty: string; speedCategory: number; wordCount: number;
}

function loadCorpus(): Passage[] {
  try {
    return JSON.parse(readFileSync(CORPUS, "utf8")) as Passage[];
  } catch {
    return [];
  }
}

/** Every character the keyboard can emit, directly or via a composition rule. */
function emittableCharacters(): Set<string> {
  const chars = new Set<string>();

  for (const value of Object.values(REMINGTON_MAP)) {
    if (value === PRE_I_SENTINEL || value === REPH_SENTINEL || value === "") continue;
    for (const ch of value) chars.add(ch);
  }

  // Buffered pre-consonant marks.
  for (const ch of PRE_I_MATRA) chars.add(ch);
  for (const ch of REPH) chars.add(ch);

  // Two-keystroke composition outputs (ो, ौ, आ, ओ, ...).
  for (const table of Object.values(COMPOSITION_RULES)) {
    for (const replacement of Object.values(table)) {
      for (const ch of replacement) chars.add(ch);
    }
  }

  chars.add(VIRAMA);
  chars.add(ZWJ);

  // Precomposed nukta forms. The layout types these as base + nukta (U+093C) — e.g. र + ़ — which
  // NFC then composes into a single codepoint (ऱ U+0931, ज़ U+095B, ...). Those single codepoints
  // never appear in REMINGTON_MAP, but they ARE reachable, so derive them rather than treating
  // them as untypeable.
  const NUKTA = "़";
  for (const base of [...chars]) {
    const composed = (base + NUKTA).normalize("NFC");
    if (composed.length === 1) chars.add(composed);
  }

  return chars;
}

/**
 * Space plus the ASCII punctuation the Marathi layout can actually emit (, . - " ' /).
 * ASCII digits and ; ? ! ( ) : are NOT here — in Marathi mode those keys produce Devanagari
 * (१२३, य, घ्, danda, त्र, ऋ, ः), so the ASCII forms are untypeable and must never appear
 * in a Devanagari passage.
 */
const NEUTRAL = /[ .,\-"'/]/;

const corpus = loadCorpus();

describe("seeded passage corpus", () => {
  it("exists — run `pnpm --filter @workspace/scripts run fetch-passages` if this fails", () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  it("contains exactly 50 English and 50 Marathi passages", () => {
    expect(corpus.filter((p) => p.language === "english")).toHaveLength(50);
    expect(corpus.filter((p) => p.language === "marathi")).toHaveLength(50);
  });

  it("spreads each language across the 30/40/50 WPM tiers", () => {
    for (const language of ["english", "marathi"]) {
      for (const speed of [30, 40, 50]) {
        const n = corpus.filter((p) => p.language === language && p.speedCategory === speed).length;
        expect(n, `${language} ${speed} WPM`).toBeGreaterThan(0);
      }
    }
  });

  it("has no duplicate passage text", () => {
    const unique = new Set(corpus.map((p) => p.content));
    expect(unique.size).toBe(corpus.length);
  });

  it("records an accurate wordCount for every passage", () => {
    for (const p of corpus) {
      const actual = p.content.trim().split(/\s+/).filter(Boolean).length;
      expect(actual, p.title).toBe(p.wordCount);
    }
  });

  it("orders tiers so higher WPM means longer passages", () => {
    const avg = (language: string, speed: number) => {
      const list = corpus.filter((p) => p.language === language && p.speedCategory === speed);
      return list.reduce((s, p) => s + p.wordCount, 0) / list.length;
    };
    for (const language of ["english", "marathi"]) {
      expect(avg(language, 30)).toBeLessThan(avg(language, 40));
      expect(avg(language, 40)).toBeLessThan(avg(language, 50));
    }
  });

  it("contains only characters the Remington keyboard can actually type (Marathi)", () => {
    const emittable = emittableCharacters();
    const offenders = new Map<string, number>();

    for (const p of corpus.filter((x) => x.language === "marathi")) {
      for (const ch of p.content) {
        if (NEUTRAL.test(ch)) continue;
        if (!emittable.has(ch)) offenders.set(ch, (offenders.get(ch) ?? 0) + 1);
      }
    }

    const report = [...offenders.entries()]
      .map(([c, n]) => `${c} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}) x${n}`)
      .join(", ");

    expect(offenders.size, `untypeable characters in corpus: ${report}`).toBe(0);
  });

  it("contains only standard ASCII in English passages", () => {
    for (const p of corpus.filter((x) => x.language === "english")) {
      expect(p.content, p.title).toMatch(/^[A-Za-z0-9 .,;:'"?!()\-]+$/);
    }
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { keySequenceForCluster, nextKeyHint } from "../keystroke-hints";
import { REMINGTON_MAP, applyComposition, PRE_I_SENTINEL, REPH_SENTINEL, PRE_I_MATRA, REPH, DEVANAGARI_CONSONANTS } from "../ism-remington-map";
import { toGraphemes } from "../grapheme-utils";

/**
 * Replays a key sequence through the same simulation rules the hint engine uses, so every test
 * asserts round-trip truth ("these keys really produce this cluster") rather than comparing the
 * search against itself.
 */
function replay(keys: string[], start = ""): string {
  let text = start;
  let preI = false;
  let reph = false;
  for (const k of keys) {
    const mapped = REMINGTON_MAP[k]!;
    if (mapped === PRE_I_SENTINEL) { preI = true; continue; }
    if (mapped === REPH_SENTINEL) { reph = true; continue; }
    if (preI || reph) {
      const isCons = DEVANAGARI_CONSONANTS.has(mapped);
      const r = reph ? REPH : "";
      const i = preI ? PRE_I_MATRA : "";
      text += isCons ? r + mapped + i : r + i + mapped;
      preI = false; reph = false;
      continue;
    }
    const composed = applyComposition(text, mapped);
    text = composed !== null ? composed : text + mapped;
  }
  return text.normalize("NFC");
}

const seq = (target: string, partial = "") => keySequenceForCluster(target, partial);

describe("keySequenceForCluster — every production mechanism", () => {
  it("direct single keys", () => {
    expect(seq("क")).toEqual(["d"]);
    expect(seq("र")).toEqual(["j"]);
    expect(seq(" ")).toEqual([" "]);
    expect(seq("१")).toEqual(["1"]);
  });

  it("consonant + matra clusters", () => {
    expect(replay(seq("का")!)).toBe("का");
    expect(replay(seq("की")!)).toBe("की");
    expect(replay(seq("कृ")!)).toBe("कृ");
  });

  it("two-keystroke composite vowels (ो ौ ॉ) — the dead-key mechanism", () => {
    expect(replay(seq("को")!)).toBe("को");
    expect(seq("को")).toEqual(["d", "k", "s"]);
    expect(replay(seq("मौ")!)).toBe("मौ");
    expect(replay(seq("कॉ")!)).toBe("कॉ");
  });

  it("independent composed vowels (आ ओ ई ऊ ऐ)", () => {
    for (const v of ["आ", "ओ", "औ", "ई", "ऊ", "ऐ"]) {
      const k = seq(v);
      expect(k, v).not.toBeNull();
      expect(replay(k!), v).toBe(v);
    }
  });

  it("pre-consonant ि — struck BEFORE the consonant", () => {
    expect(seq("कि")).toEqual(["f", "d"]);
    expect(replay(["f", "d"])).toBe("कि");
  });

  it("reph clusters — Shift+Z struck before the consonant", () => {
    const k = seq("र्क");
    expect(k).not.toBeNull();
    expect(replay(k!)).toBe("र्क".normalize("NFC"));
  });

  it("half-letter completion consonants (श ष ख घ थ ध भ ण)", () => {
    for (const c of ["श", "ष", "ख", "घ", "थ", "ध", "भ", "ण"]) {
      const k = seq(c);
      expect(k, c).not.toBeNull();
      expect(replay(k!), c).toBe(c);
      expect(k!.length, c).toBe(2); // half-form key + ा
    }
  });

  it("conjuncts via virama and dedicated ligature keys", () => {
    for (const cl of ["क्र", "श्र", "ज्ञ", "त्र", "द्ध", "द्व", "क्त", "स्व"]) {
      const k = seq(cl);
      expect(k, cl).not.toBeNull();
      expect(replay(k!), cl).toBe(cl.normalize("NFC"));
    }
  });

  it("nukta consonants (ऱ ज़)", () => {
    for (const c of ["ऱ", "ज़"]) {
      const k = seq(c);
      expect(k, c).not.toBeNull();
      expect(replay(k!), c).toBe(c.normalize("NFC"));
    }
  });

  it("anusvara/visarga/chandrabindu-bearing clusters", () => {
    for (const cl of ["कं", "कः", "बँ"]) {
      const k = seq(cl);
      expect(k, cl).not.toBeNull();
      expect(replay(k!), cl).toBe(cl.normalize("NFC"));
    }
  });

  it("resumes MID-CLUSTER from partial progress (का → को needs just s)", () => {
    expect(seq("को", "का")).toEqual(["s"]);
    expect(seq("का", "क")).toEqual(["k"]);
    expect(seq("कि", "कि")).toEqual([]); // already done
  });

  it("returns null for a genuinely untypeable character rather than lying", () => {
    expect(seq("☃")).toBeNull();
  });
});

describe("nextKeyHint — positional targeting", () => {
  const g = (s: string) => toGraphemes(s.normalize("NFC"));

  it("targets the first cluster when nothing is typed", () => {
    const hint = nextKeyHint(g("कमल"), []);
    expect(hint).toMatchObject({ cluster: "क", keys: ["d"], index: 0 });
  });

  it("advances to the next cluster after a correct one", () => {
    const hint = nextKeyHint(g("कमल"), g("क"));
    expect(hint).toMatchObject({ cluster: "म", index: 1 });
  });

  it("stays INSIDE a partially-typed cluster (क typed, का needed → hint is k)", () => {
    const hint = nextKeyHint(g("का म"), g("क"));
    expect(hint).toMatchObject({ cluster: "का", keys: ["k"], index: 0 });
  });

  it("returns null once the passage is complete", () => {
    expect(nextKeyHint(g("कमल"), g("कमल"))).toBeNull();
  });

  it("targets spaces between words", () => {
    const hint = nextKeyHint(g("कमल नमन"), g("कमल"));
    expect(hint).toMatchObject({ cluster: " ", keys: [" "] });
  });
});

describe("corpus coverage — NO seeded Marathi passage may contain an unhintable cluster", () => {
  it("every distinct cluster across all 50 Marathi passages resolves to keys", () => {
    const corpusPath = path.resolve(__dirname, "../../../../../scripts/src/data/passages.generated.json");
    let corpus: { language: string; content: string; title: string }[] = [];
    try {
      corpus = JSON.parse(readFileSync(corpusPath, "utf8"));
    } catch {
      return; // corpus not generated in this checkout — the corpus test suite covers its absence
    }

    const clusters = new Set<string>();
    for (const p of corpus.filter((x) => x.language === "marathi")) {
      for (const cl of toGraphemes(p.content.normalize("NFC"))) clusters.add(cl);
    }
    expect(clusters.size).toBeGreaterThan(50);

    const failures: string[] = [];
    for (const cl of clusters) {
      const k = keySequenceForCluster(cl);
      if (k === null) {
        failures.push(`${cl} (${[...cl].map((c) => "U+" + c.codePointAt(0)!.toString(16).toUpperCase()).join(" ")})`);
      } else if (replay(k) !== cl) {
        failures.push(`${cl}: keys [${k.join(" ")}] replay to "${replay(k)}"`);
      }
    }
    expect(failures, `unhintable clusters: ${failures.join(", ")}`).toEqual([]);
  });
});

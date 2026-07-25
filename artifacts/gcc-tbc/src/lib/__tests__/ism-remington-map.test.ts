import { describe, it, expect } from "vitest";
import {
  REMINGTON_MAP, PRE_I_SENTINEL, REPH_SENTINEL, PRE_I_MATRA, REPH,
  DEVANAGARI_CONSONANTS, applyComposition, HALF, VIRAMA,
} from "../ism-remington-map";

/**
 * Simulates the Devanagari branch of attachTypingKeyHandlers against a plain string,
 * so keystroke sequences can be asserted without a DOM. This mirrors the real handler's
 * logic: two pre-consonant buffers, composition-before-append.
 */
function type(keys: string[]): string {
  let text = "";
  let preI = false;
  let reph = false;

  for (const k of keys) {
    if (k === " ") {
      text += (reph ? REPH : "") + (preI ? PRE_I_MATRA : "") + " ";
      preI = false; reph = false;
      continue;
    }
    const mapped = REMINGTON_MAP[k];
    if (mapped === undefined || mapped === "") continue;

    if (mapped === PRE_I_SENTINEL) {
      if (preI) text += PRE_I_MATRA; else preI = true;
      continue;
    }
    if (mapped === REPH_SENTINEL) {
      if (reph) text += REPH; else reph = true;
      continue;
    }

    if (preI || reph) {
      const isCons = DEVANAGARI_CONSONANTS.has(mapped);
      const r = reph ? REPH : "";
      const i = preI ? PRE_I_MATRA : "";
      preI = false; reph = false;
      text += isCons ? r + mapped + i : r + i + mapped;
      continue;
    }

    const composed = applyComposition(text, mapped);
    text = composed !== null ? composed : text + mapped;
  }
  return text.normalize("NFC");
}

const nfc = (s: string) => s.normalize("NFC");

describe("two-keystroke composition — the characters that were previously untypeable", () => {
  // Each of these was IMPOSSIBLE to type before the composition engine existed.
  it("types ो via ा + े  (को)", () => {
    expect(type(["d", "k", "s"])).toBe(nfc("को"));
  });

  it("types ौ via ा + ै  (मौज)", () => {
    expect(type(["e", "k", "S", "t"])).toBe(nfc("मौज"));
  });

  it("types ॉ via ा + ॅ  (कॉ)", () => {
    expect(type(["d", "k", "W"])).toBe(nfc("कॉ"));
  });

  it("types the independent vowel आ via अ + ा", () => {
    expect(type(["v", "k"])).toBe(nfc("आ"));
  });

  it("types ओ via अ + ा + े", () => {
    expect(type(["v", "k", "s"])).toBe(nfc("ओ"));
  });

  it("types औ via अ + ा + ै", () => {
    expect(type(["v", "k", "S"])).toBe(nfc("औ"));
  });

  it("types ऐ via ए + े", () => {
    expect(type([",", "s"])).toBe(nfc("ऐ"));
  });

  it("types ई via इ + ी", () => {
    expect(type(["b", "h"])).toBe(nfc("ई"));
  });

  it("types ऊ via उ + ु", () => {
    expect(type(["m", "q"])).toBe(nfc("ऊ"));
  });

  it("types ँ (chandrabindu) via ॅ + ं", () => {
    expect(type(["W", "a"])).toBe(nfc("ँ"));
  });

  it("types ॥ (double danda) via । + ।", () => {
    expect(type(["!", "!"])).toBe(nfc("॥"));
  });
});

describe("half-letter + ा completes the full consonant", () => {
  // These consonants have NO full-form key on the layout — only a half-form key.
  // Without the completion rule they are untypeable, and श is very common in Marathi.
  const cases: [string, string[], string][] = [
    ["श", ["'", "k"], "sha"],
    ["ष", ['"', "k"], "ssa"],
    ["ख", ["[", "k"], "kha"],
    ["घ", ["?", "k"], "gha"],
    ["थ", ["F", "k"], "tha"],
    ["ध", ["/", "k"], "dha"],
    ["भ", ["H", "k"], "bha"],
    ["ण", [".", "k"], "Na"],
  ];

  for (const [expected, keys, name] of cases) {
    it(`completes ${expected} (${name}) from its half form + ा`, () => {
      expect(type(keys)).toBe(nfc(expected));
    });
  }

  it("completes क्ष from its half form + ा", () => {
    expect(type(["{", "k"])).toBe(nfc("क्ष"));
  });

  it("leaves the half form intact when ा does NOT follow", () => {
    // Half-ka followed by ta must stay a conjunct, not become full क.
    expect(type(["D", "r"])).toBe(nfc("क" + HALF + "त"));
  });
});

describe("pre-consonant reordering", () => {
  it("reorders the short-i matra after its consonant (कि, struck f then d)", () => {
    expect(type(["f", "d"])).toBe(nfc("कि"));
  });

  it("types दिवस with the pre-consonant i", () => {
    expect(type(["f", "n", "o", "l"])).toBe(nfc("दिवस"));
  });

  it("places reph BEFORE its consonant (र्क, struck Shift+Z then d)", () => {
    expect(type(["Z", "d"])).toBe(nfc("र्क"));
  });

  it("types कर्म — reph attaches to the FOLLOWING consonant", () => {
    // क, then reph + म  →  क + र् + म
    expect(type(["d", "Z", "e"])).toBe(nfc("कर्म"));
  });

  it("distinguishes reph (Shift+Z, before) from rakar (z, after)", () => {
    expect(type(["Z", "d"])).toBe(nfc("र्क")); // reph precedes
    expect(type(["d", "z"])).toBe(nfc("क्र")); // rakar follows
    expect(type(["Z", "d"])).not.toBe(type(["d", "z"]));
  });

  it("handles reph and pre-i together on one consonant", () => {
    // reph + pre-i + consonant → र् + क + ि
    expect(type(["Z", "f", "d"])).toBe(nfc("र्" + "कि"));
  });

  it("flushes a buffered pre-i at a space rather than losing it", () => {
    expect(type(["d", "f", " "])).toBe(nfc("क" + PRE_I_MATRA + " "));
  });

  it("commits the first mark when a pre-consonant key is pressed twice", () => {
    expect(type(["f", "f", "d"])).toBe(nfc(PRE_I_MATRA + "कि"));
  });
});

describe("composition does not fire where it must not", () => {
  it("does not compose across a space", () => {
    // ा then space then े — the े must NOT retro-compose onto the earlier ा.
    expect(type(["d", "k", " ", "s"])).toBe(nfc("का" + " " + "े"));
  });

  it("leaves a plain consonant + ा alone (का stays का)", () => {
    expect(type(["d", "k"])).toBe(nfc("का"));
  });

  it("applyComposition returns null when no rule matches", () => {
    expect(applyComposition("क", "त")).toBeNull();
    expect(applyComposition("", "ा")).toBeNull();
    expect(applyComposition("क", "")).toBeNull();
  });

  it("does not treat a full consonant ending in ा as a half letter", () => {
    // का + ा must not strip anything; no rule exists, so it appends.
    expect(applyComposition("का", "त")).toBeNull();
  });
});

describe("real Marathi words end-to-end", () => {
  const words: [string, string[]][] = [
    ["कमल", ["d", "e", "y"]],
    ["नमन", ["u", "e", "u"]],
    ["सरल", ["l", "j", "y"]],
    ["को", ["d", "k", "s"]],
    ["कोण", ["d", "k", "s", ".", "k"]],
    ["शाळा", ["'", "k", "k", "G", "k"]],
  ];

  for (const [word, keys] of words) {
    it(`types "${word}"`, () => {
      expect(type(keys)).toBe(nfc(word));
    });
  }
});

describe("map integrity", () => {
  it("has no duplicate output for the two distinct ra-cluster keys", () => {
    expect(REMINGTON_MAP["z"]).not.toBe(REMINGTON_MAP["Z"]);
  });

  it("maps every digit to a Devanagari digit", () => {
    const expected = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
    for (let d = 0; d <= 9; d++) {
      expect(REMINGTON_MAP[String(d)]).toBe(expected[d]);
    }
  });

  it("exposes the bare virama for manual conjunct building", () => {
    expect(REMINGTON_MAP["+"]).toBe(VIRAMA);
  });

  it("still reaches every core consonant either directly or by completion", () => {
    const CONS = "क ख ग घ च छ ज झ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह ळ".split(" ");
    const direct = new Set(Object.values(REMINGTON_MAP));
    for (const c of CONS) {
      const reachable =
        direct.has(c) ||
        // reachable by completing its half form with ा
        Object.values(REMINGTON_MAP).some(
          (v) => v === c + HALF || v === c + VIRAMA,
        );
      expect(reachable, `${c} must be typeable`).toBe(true);
    }
  });
});

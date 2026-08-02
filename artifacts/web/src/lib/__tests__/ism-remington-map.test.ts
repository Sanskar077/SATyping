import { describe, it, expect } from "vitest";
import {
  REMINGTON_MAP, PRE_I_SENTINEL, REPH_SENTINEL, PRE_I_MATRA, PENDING_PRE_I, REPH,
  DEVANAGARI_CONSONANTS, applyComposition, HALF, VIRAMA,
} from "../ism-remington-map";

/**
 * Simulates the Devanagari branch of attachTypingKeyHandlers against a plain string,
 * so keystroke sequences can be asserted without a DOM. Mirrors the real handler:
 * pre-consonant marks commit a VISIBLE form immediately (velanti as ◌ि on a dotted
 * circle, reph as र्) and are stripped + reordered when the consonant lands;
 * composition applies before plain appends. "<BS>" simulates a Backspace press
 * (grapheme-wise removal, or pending-mark removal by code units — as the handler does).
 */
function type(keys: string[]): string {
  let text = "";
  // Mirror of the handler's pendingMarks stack (kind + committed UTF-16 width).
  let marks: { kind: "preI" | "reph"; units: number }[] = [];

  const graphemeBackspace = (t: string): string => {
    const seg = [...new Intl.Segmenter("hi", { granularity: "grapheme" }).segment(t)].map((s) => s.segment);
    return seg.length ? seg.slice(0, -1).join("") : "";
  };

  for (const k of keys) {
    if (k === "<BS>") {
      const last = marks.pop();
      text = last ? text.slice(0, text.length - last.units) : graphemeBackspace(text);
      continue;
    }
    if (k === " ") {
      // Space emits pending marks in Unicode order (no consonant base), then the space.
      if (marks.length > 0) {
        const base = text.slice(0, text.length - marks.reduce((n, m) => n + m.units, 0));
        const r = marks.some((m) => m.kind === "reph") ? REPH : "";
        const i = marks.some((m) => m.kind === "preI") ? PRE_I_MATRA : "";
        text = base + r + i + " ";
        marks = [];
      } else {
        text += " ";
      }
      continue;
    }
    const mapped = REMINGTON_MAP[k];
    if (mapped === undefined || mapped === "") continue;

    if (mapped === PRE_I_SENTINEL) {
      text += PENDING_PRE_I;
      marks = marks.filter((m) => m.kind !== "preI");
      marks.push({ kind: "preI", units: PENDING_PRE_I.length });
      continue;
    }
    if (mapped === REPH_SENTINEL) {
      text += REPH;
      marks = marks.filter((m) => m.kind !== "reph");
      marks.push({ kind: "reph", units: REPH.length });
      continue;
    }

    if (marks.length > 0) {
      const consumed = marks;
      marks = [];
      if (DEVANAGARI_CONSONANTS.has(mapped)) {
        text = text.slice(0, text.length - consumed.reduce((n, m) => n + m.units, 0));
        const r = consumed.some((m) => m.kind === "reph") ? REPH : "";
        const i = consumed.some((m) => m.kind === "preI") ? PRE_I_MATRA : "";
        text += r + mapped + i;
      } else {
        text += mapped; // marks stay stranded; plain append, no composition across them
      }
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
    // f f d: first f commits ◌ि (visible), second f strands it (no longer pending)
    // and commits a new ◌ि (pending), then d reorders → ◌ि + कि
    expect(type(["f", "f", "d"])).toBe(nfc(PENDING_PRE_I + "कि"));
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

describe("first-press visibility & single-press backspace (bug: velanti required double press)", () => {
  it("velanti is VISIBLE after its first key press (never silently buffered)", () => {
    // The reported bug: pressing f showed nothing until a second press.
    // Now one press commits the visible pending form ◌ि immediately.
    expect(type(["f"])).toBe(nfc(PENDING_PRE_I));
  });

  it("reph is VISIBLE after its first key press", () => {
    expect(type(["Z"])).toBe(nfc(REPH));
  });

  it("velanti still reorders after the consonant lands (f d → कि)", () => {
    expect(type(["f", "d"])).toBe(nfc("कि"));
  });

  it("ONE backspace removes a just-typed velanti (bug: needed two presses)", () => {
    // The reported bug: first backspace silently cancelled a hidden buffer (nothing
    // visibly changed), needing a second press. Now one press removes the visible mark.
    expect(type(["f", "<BS>"])).toBe("");
  });

  it("ONE backspace removes a just-typed reph", () => {
    expect(type(["Z", "<BS>"])).toBe("");
  });

  it("backspace after velanti leaves preceding text intact (द f <BS> → द)", () => {
    expect(type(["n", "f", "<BS>"])).toBe(nfc("द"));
  });

  it("velanti → backspace → velanti → consonant still composes correctly", () => {
    // Cancel-and-retry must not corrupt state: f <BS> f d → कि
    expect(type(["f", "<BS>", "f", "d"])).toBe(nfc("कि"));
  });

  it("ONE backspace removes a completed consonant+matra cluster (कि → empty)", () => {
    // Grapheme backspace: कि is one cluster, one press removes it whole.
    expect(type(["f", "d", "<BS>"])).toBe("");
  });

  it("mid-word velanti stays visible then reorders (द f व → दविस)", () => {
    expect(type(["n", "f"])).toBe(nfc("द" + PENDING_PRE_I));
    // The velanti struck after द attaches to the NEXT consonant व → द + वि + स
    expect(type(["n", "f", "o", "l"])).toBe(nfc("दविस"));
  });

  it("backspace with reph + velanti both pending removes only the most recent mark", () => {
    // Z f <BS> leaves the reph pending; a following consonant still gets it.
    expect(type(["Z", "f", "<BS>", "d"])).toBe(nfc("र्क"));
  });
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

/**
 * Fetch → clean → split pipeline that generates the typing-passage corpus.
 *
 * Run this ONCE (or whenever you want to regenerate the corpus); it writes a committed JSON file
 * that seed.ts then imports. Seeding therefore needs no network access, and the exact passage text
 * that lands in the database is reviewable in version control.
 *
 *   pnpm --filter @workspace/scripts run fetch-passages
 *
 * ── Sources & licensing ──────────────────────────────────────────────────────
 * English : Project Gutenberg plain-text editions of works whose US copyright has expired
 *           (public domain). Gutenberg's own header/footer/licence block is stripped, so the
 *           emitted text is the public-domain work itself, carrying no Gutenberg trademark terms.
 * Marathi : Marathi Wikipedia article extracts, licensed CC BY-SA 4.0 — free to reuse with
 *           attribution. Attribution (article title + URL) is recorded per passage in the
 *           generated file and in ATTRIBUTION.md next to it.
 *
 * Nothing here is scraped from a copyrighted textbook or exam paper.
 *
 * ── Why the character filter matters ─────────────────────────────────────────
 * Grading compares the candidate's committed Unicode against the passage exactly. If a passage
 * contains a character the ISM Remington layout cannot produce (a curly quote, an em dash, a
 * footnote marker, stray Latin text inside Marathi prose), that passage is literally impossible to
 * complete. Every candidate passage is therefore validated against the set of characters the
 * keyboard can actually emit, and rejected if it contains anything else.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync } from "node:fs";

// Single source of truth for what the ISM Remington keyboard can actually emit. Importing it here
// (rather than re-listing Devanagari codepoints) guarantees the generator and the runtime engine
// agree on typeability; passage-corpus.test.ts cross-checks the emitted corpus against this same map.
import {
  REMINGTON_MAP,
  COMPOSITION_RULES,
  PRE_I_SENTINEL,
  REPH_SENTINEL,
  PRE_I_MATRA,
  REPH,
  VIRAMA,
  ZWJ,
} from "../../artifacts/web/src/lib/ism-remington-map";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "..", "..", ".env") });

// ─── Target shape of the corpus ──────────────────────────────────────────────
// speedCategory 60 is supported by the schema but deliberately unused: the brief asked for a
// 30/40/50 spread. Add a fourth tier here if you later want 60 WPM passages.
interface TierSpec {
  speedCategory: number;
  difficulty: "easy" | "medium" | "hard";
  /** Inclusive word-count window for this tier. */
  minWords: number;
  maxWords: number;
  count: number;
}

const TIERS: TierSpec[] = [
  { speedCategory: 30, difficulty: "easy",   minWords: 55,  maxWords: 90,  count: 17 },
  { speedCategory: 40, difficulty: "medium", minWords: 95,  maxWords: 140, count: 17 },
  { speedCategory: 50, difficulty: "hard",   minWords: 145, maxWords: 210, count: 16 },
];

const TOTAL_PER_LANGUAGE = TIERS.reduce((sum, t) => sum + t.count, 0); // 50

// ─── Character whitelists ────────────────────────────────────────────────────

/**
 * ASCII characters an English passage may contain. Mirrors what a standard keyboard produces in
 * English mode (the engine passes these through natively).
 */
const ENGLISH_ALLOWED = /^[A-Za-z0-9 .,;:'"?!()\-]+$/;

/**
 * Every Devanagari character the ISM Remington keyboard can actually emit — derived from the live
 * keyboard map, exactly as passage-corpus.test.ts computes it. A passage may only contain these
 * characters (plus the neutral punctuation/digits below), because grading compares the candidate's
 * committed Unicode to the passage character-for-character: a glyph no key can produce (visarga,
 * eyelash-ra, candra-A, a stray ZWNJ) makes the passage literally impossible to finish.
 *
 * The old approach whitelisted the entire U+0900–U+097F block, which let untypeable characters
 * through. This set is precise instead of permissive.
 */
function buildEmittableDevanagari(): Set<string> {
  const chars = new Set<string>();
  for (const value of Object.values(REMINGTON_MAP)) {
    if (value === PRE_I_SENTINEL || value === REPH_SENTINEL || value === "") continue;
    for (const ch of value) chars.add(ch);
  }
  for (const ch of PRE_I_MATRA) chars.add(ch);
  for (const ch of REPH) chars.add(ch);
  for (const table of Object.values(COMPOSITION_RULES)) {
    for (const replacement of Object.values(table)) {
      for (const ch of replacement) chars.add(ch);
    }
  }
  chars.add(VIRAMA);
  chars.add(ZWJ);

  // Precomposed nukta forms. The layout types these as base + nukta (U+093C) — e.g. र + ़ — and
  // NFC then composes them into a single codepoint (ऱ U+0931, ज़ U+095B, ...). Those codepoints
  // never appear in REMINGTON_MAP but ARE reachable, so derive them rather than rejecting them.
  const NUKTA = "़";
  for (const base of [...chars]) {
    const composed = (base + NUKTA).normalize("NFC");
    if (composed.length === 1) chars.add(composed);
  }

  return chars;
}

const EMITTABLE_DEVANAGARI = buildEmittableDevanagari();

/**
 * Space plus the ASCII punctuation the Devanagari layout can actually EMIT: , (via ]), . (via \\
 * and _), - (via %), " (via ^), ' (via &), / (via @).
 *
 * Deliberately absent — every one of these is a key that produces something else in Marathi mode,
 * making the ASCII character untypeable: ; (य), ? (घ्), ! (danda), ( (त्र), ) (ऋ), : (ः), and the
 * ASCII digits (Devanagari digits १२३...). A passage containing any of them can never be finished.
 */
const DEVANAGARI_NEUTRAL = /[ .,\-"'/]/;

/**
 * True when every character of `text` is typeable on the Remington layout. Used in place of a
 * blanket Devanagari-block regex so the generator can never emit a passage the keyboard can't type.
 */
function isTypeableDevanagari(text: string): boolean {
  for (const ch of text) {
    if (DEVANAGARI_NEUTRAL.test(ch)) continue;
    if (EMITTABLE_DEVANAGARI.has(ch)) continue;
    return false;
  }
  return true;
}

/** Characters that are almost always safe to fix rather than reject the whole passage over. */
const NORMALISATIONS: [RegExp, string][] = [
  [/[‘’‛]/g, "'"],   // curly single quotes → ASCII
  [/[“”‟]/g, '"'],   // curly double quotes → ASCII
  [/[‐-―]/g, "-"],        // various dashes → hyphen
  [/…/g, "..."],               // ellipsis
  [/ /g, " "],                 // non-breaking space
  [/[ -​]/g, " "],        // exotic spaces
  [/­/g, ""],                  // soft hyphen
  // Zero-width non-joiner: invisible formatting that no keystroke produces. Left in place it
  // makes a passage impossible to complete, since the candidate cannot type it.
  [/‌/g, ""],
];

// ─── Generic cleaning helpers ────────────────────────────────────────────────

function normalise(text: string): string {
  // NFC first: Wikipedia serves some Devanagari in decomposed form (र + ़ rather than ऱ), and the
  // typing engine commits NFC, so the corpus must be NFC too or grading would never match.
  let t = text.normalize("NFC");
  for (const [pattern, replacement] of NORMALISATIONS) t = t.replace(pattern, replacement);
  return t.replace(/[ \t]+/g, " ").trim();
}

/**
 * Rejects text that is structurally a list rather than prose — tables of contents, index pages,
 * chapter listings, bullet runs. These slip past the per-paragraph heading filters because when a
 * whole contents page is collapsed onto one line it has a perfectly normal word count.
 *
 * They matter because a candidate transcribing "I. A Scandal in Bohemia II. The Red-Headed
 * League..." is practising roman numerals, not typing.
 */
function isProse(text: string): boolean {
  // A run of roman-numeral or numeric enumerators is the signature of a contents/index block.
  const romanEnumerators = (text.match(/\b[IVXLC]{1,6}\.\s/g) ?? []).length;
  if (romanEnumerators >= 3) return false;
  const numericEnumerators = (text.match(/(?:^|\s)\d{1,3}[.)]\s/g) ?? []).length;
  if (numericEnumerators >= 4) return false;

  // Prose has sentences of reasonable length. Many very short "sentences" means a list.
  const sentences = text.split(/(?<=[.!?।])\s+/).map((s) => s.trim()).filter(Boolean);
  const veryShort = sentences.filter((s) => s.split(/\s+/).length <= 4).length;
  if (veryShort >= 5) return false;
  if (sentences.length >= 4 && veryShort / sentences.length > 0.4) return false;

  // Title Case On Almost Every Word is another contents-page signature.
  const words = text.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  if (words.length >= 12) {
    const capitalised = words.filter((w) => /^[A-Z]/.test(w)).length;
    if (capitalised / words.length > 0.6) return false;
  }

  return true;
}

const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Builds passages from a list of already-cleaned paragraphs by greedily accumulating whole
 * sentences until the target word window is satisfied. Splitting on sentence boundaries (rather
 * than a hard word cut) means passages never end mid-sentence, which matters because the candidate
 * has to read and transcribe them.
 */
function buildPassages(paragraphs: string[], tier: TierSpec, isTypeable: (s: string) => boolean, sentenceEnd: RegExp): string[] {
  const out: string[] = [];

  for (const para of paragraphs) {
    if (out.length >= tier.count) break;

    const sentences = para.split(sentenceEnd).map((s) => s.trim()).filter(Boolean);
    let buffer: string[] = [];

    for (const sentence of sentences) {
      buffer.push(sentence);
      const candidate = buffer.join(" ");
      const words = wordCount(candidate);

      if (words >= tier.minWords) {
        // Only keep it if it lands inside the window, is fully typeable, and reads as prose.
        if (words <= tier.maxWords && isTypeable(candidate) && isProse(candidate)) {
          out.push(candidate);
          if (out.length >= tier.count) break;
        }
        buffer = [];
      }
    }
  }

  return out;
}

// ─── English: Project Gutenberg ──────────────────────────────────────────────

/**
 * Public-domain works, chosen for clear modern-readable prose rather than archaic verse.
 * These are stable Gutenberg IDs.
 */
const GUTENBERG_BOOKS = [
  { id: 21,    title: "Aesop's Fables" },
  { id: 1661,  title: "The Adventures of Sherlock Holmes" },
  { id: 74,    title: "The Adventures of Tom Sawyer" },
  { id: 35,    title: "The Time Machine" },
  { id: 5200,  title: "Metamorphosis" },
  { id: 1400,  title: "Great Expectations" },
  { id: 145,   title: "Middlemarch" },
  { id: 2701,  title: "Moby Dick" },
];

async function fetchGutenberg(id: number): Promise<string> {
  // Gutenberg serves several plain-text variants; try the common ones in order.
  const urls = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
      if (res.ok) return await res.text();
    } catch {
      /* try the next variant */
    }
  }
  throw new Error(`could not fetch Gutenberg #${id}`);
}

function cleanGutenberg(raw: string): string[] {
  let text = raw.replace(/\r\n/g, "\n");

  // Strip Gutenberg's own header and footer, leaving only the public-domain work.
  const start = text.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i);
  if (start !== -1) text = text.slice(text.indexOf("\n", start) + 1);
  const end = text.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK/i);
  if (end !== -1) text = text.slice(0, end);

  return text
    .split(/\n\s*\n/)                       // paragraphs are blank-line separated
    .map((p) => normalise(p.replace(/\n/g, " ")))
    .filter((p) => {
      if (wordCount(p) < 40) return false;                 // too short to build from
      if (/^(chapter|book|part|act|scene)\b/i.test(p)) return false; // headings
      if (p === p.toUpperCase()) return false;             // ALL-CAPS headings/titles
      if (/^[IVXLC]+\.?$/.test(p.trim())) return false;    // roman-numeral headings
      if ((p.match(/"/g)?.length ?? 0) > 8) return false;  // dialogue-dense: awkward to transcribe
      if (/_/.test(p)) return false;                       // Gutenberg italics markup
      if (/\[\d+\]/.test(p)) return false;                 // footnote markers
      return true;
    });
}

// ─── Marathi: Marathi Wikipedia ──────────────────────────────────────────────

/**
 * Broad, everyday topics — the register a GCC-TBC passage actually uses (geography, civics,
 * culture, science), not devotional verse.
 */
const MARATHI_ARTICLES = [
  "महाराष्ट्र", "भारत", "पुणे", "मुंबई", "नागपूर", "कोल्हापूर", "नाशिक", "औरंगाबाद",
  "मराठी भाषा", "मराठी साहित्य", "शिक्षण", "विज्ञान", "गणित", "इतिहास", "भूगोल",
  "संगणक", "आंतरजाल", "पर्यावरण", "शेती", "आरोग्य", "क्रीडा", "संगीत", "चित्रपट",
  "अर्थशास्त्र", "राज्यशास्त्र", "लोकशाही", "संविधान", "सूर्य", "चंद्र", "पृथ्वी",
  "पाणी", "हवामान", "वृक्ष", "प्राणी", "पक्षी", "अन्न", "वस्त्र", "कुटुंब",
  "समाज", "संस्कृती", "सण", "दिवाळी", "गणेशोत्सव", "रेल्वे", "वाहतूक", "उद्योग",
  "बँक", "व्यापार", "कला", "नृत्य",
];

async function fetchWikipediaExtract(title: string): Promise<string> {
  const url = new URL("https://mr.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("format", "json");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", title);

  // Wikimedia asks API clients to identify themselves and to back off on 429. Without this the
  // run gets rate-limited roughly half way through the article list.
  const headers = {
    "User-Agent": "SATyping-passage-seeder/1.0 (typing-exam practice corpus; contact: repo maintainer)",
    "Accept-Encoding": "gzip",
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(45_000) });

    if (res.status === 429) {
      // Honour Retry-After when present, otherwise back off exponentially.
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 2000 * 2 ** attempt;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) throw new Error(`wikipedia ${res.status} for ${title}`);

    const json = (await res.json()) as {
      query?: { pages?: Record<string, { extract?: string; missing?: string }> };
    };
    const pages = json.query?.pages ?? {};
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined || !page.extract) return "";
    return page.extract;
  }

  throw new Error(`wikipedia rate-limited after retries for ${title}`);
}

function cleanWikipedia(raw: string): string[] {
  const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  return raw
    .split(/\n+/)
    .filter((line) => !/^=+.*=+$/.test(line.trim()))   // section headings (== इतिहास ==)
    .map((line) =>
      normalise(
        line
          .replace(/\([^)]*\)/g, " ")     // parentheticals: transliterations, dates, Latin names
          .replace(/\[[^\]]*\]/g, " ")    // citation markers
          .replace(/[A-Za-z]+/g, " ")     // stray Latin words inside Marathi prose
          // ASCII digits → Devanagari digits: the Marathi layout's digit keys emit १२३…, so an
          // ASCII 3 in a passage would be untypeable. Converting (rather than rejecting the
          // whole line) keeps the many date-bearing sentences usable.
          .replace(/[0-9]/g, (d) => DEVANAGARI_DIGITS[Number(d)]!)
          // Stray ZWJ: legitimate ZWJ only ever follows a virama (explicit half-letter). Wikipedia
          // markup sometimes leaves ZWJ after a plain consonant, which no keystroke can produce.
          .replace(/(?<!्)‍/g, ""),
      ),
    )
    .filter((line) => {
      if (wordCount(line) < 25) return false;
      // Require the line to be predominantly Devanagari — drops tables, lists, stray fragments.
      const deva = (line.match(/[ऀ-ॿ]/g) ?? []).length;
      if (deva < line.replace(/\s/g, "").length * 0.85) return false;
      return true;
    });
}

// ─── Assembly ────────────────────────────────────────────────────────────────

interface GeneratedPassage {
  title: string;
  content: string;
  language: "english" | "marathi";
  difficulty: "easy" | "medium" | "hard";
  speedCategory: number;
  wordCount: number;
  source: string;
}

function titleFor(base: string, index: number): string {
  return `${base} — Part ${index + 1}`;
}

async function main() {
  console.log("Generating typing-passage corpus...\n");

  // ── English ──
  console.log("English — Project Gutenberg (public domain)");
  const englishParas: { text: string; source: string; book: string }[] = [];
  for (const book of GUTENBERG_BOOKS) {
    try {
      const raw = await fetchGutenberg(book.id);
      const paras = cleanGutenberg(raw);
      for (const p of paras) {
        englishParas.push({
          text: p,
          source: `Project Gutenberg #${book.id} (${book.title}) — public domain`,
          book: book.title,
        });
      }
      console.log(`  ${book.title}: ${paras.length} usable paragraphs`);
    } catch (err) {
      console.warn(`  ${book.title}: SKIPPED (${(err as Error).message})`);
    }
  }

  // ── Marathi ──
  console.log("\nMarathi — Marathi Wikipedia (CC BY-SA 4.0)");
  const marathiParas: { text: string; source: string; book: string }[] = [];
  for (const title of MARATHI_ARTICLES) {
    try {
      const raw = await fetchWikipediaExtract(title);
      await sleep(250); // be a polite API citizen; keeps the whole run under the rate limit
      if (!raw) continue;
      const lines = cleanWikipedia(raw);
      for (const line of lines) {
        marathiParas.push({
          text: line,
          source: `Marathi Wikipedia — "${title}" (https://mr.wikipedia.org/wiki/${encodeURIComponent(title)}) CC BY-SA 4.0`,
          book: title,
        });
      }
      if (lines.length) console.log(`  ${title}: ${lines.length} usable lines`);
    } catch (err) {
      console.warn(`  ${title}: SKIPPED (${(err as Error).message})`);
    }
  }

  console.log(`\nPool: ${englishParas.length} English paragraphs, ${marathiParas.length} Marathi lines\n`);

  // ── Build the tiers ──
  const passages: GeneratedPassage[] = [];

  const assemble = (
    pool: { text: string; source: string; book: string }[],
    language: "english" | "marathi",
    isTypeable: (s: string) => boolean,
    sentenceEnd: RegExp,
  ) => {
    // Interleave sources so consecutive passages aren't all from the same book/article.
    const byBook = new Map<string, typeof pool>();
    for (const item of pool) {
      const list = byBook.get(item.book) ?? [];
      list.push(item);
      byBook.set(item.book, list);
    }
    const books = [...byBook.values()];
    const interleaved: typeof pool = [];
    for (let i = 0; interleaved.length < pool.length; i++) {
      let progressed = false;
      for (const list of books) {
        if (i < list.length) { interleaved.push(list[i]!); progressed = true; }
      }
      if (!progressed) break;
    }

    const used = new Set<string>();
    for (const tier of TIERS) {
      let made = 0;
      for (const item of interleaved) {
        if (made >= tier.count) break;
        if (used.has(item.text)) continue;
        const built = buildPassages([item.text], tier, isTypeable, sentenceEnd);
        for (const content of built) {
          if (made >= tier.count) break;
          if (passages.some((p) => p.content === content)) continue;
          used.add(item.text);
          passages.push({
            title: titleFor(item.book, made),
            content,
            language,
            difficulty: tier.difficulty,
            speedCategory: tier.speedCategory,
            wordCount: wordCount(content),
            source: item.source,
          });
          made++;
        }
      }
      const label = `${language} ${tier.speedCategory} WPM`;
      if (made < tier.count) {
        console.warn(`  WARNING: ${label} — only ${made}/${tier.count} passages built`);
      } else {
        console.log(`  ${label}: ${made} passages`);
      }
    }
  };

  console.log("Assembling tiers:");
  assemble(englishParas, "english", (s) => ENGLISH_ALLOWED.test(s), /(?<=[.!?])\s+/);
  // Marathi sentences end with danda or an ASCII period.
  assemble(marathiParas, "marathi", isTypeableDevanagari, /(?<=[।.!?])\s+/);

  // ── Verify before writing ──
  const englishCount = passages.filter((p) => p.language === "english").length;
  const marathiCount = passages.filter((p) => p.language === "marathi").length;

  console.log(`\nTotals: ${englishCount} English, ${marathiCount} Marathi`);

  const problems: string[] = [];
  if (englishCount !== TOTAL_PER_LANGUAGE) problems.push(`expected ${TOTAL_PER_LANGUAGE} English, got ${englishCount}`);
  if (marathiCount !== TOTAL_PER_LANGUAGE) problems.push(`expected ${TOTAL_PER_LANGUAGE} Marathi, got ${marathiCount}`);

  for (const p of passages) {
    const typeable = p.language === "english"
      ? ENGLISH_ALLOWED.test(p.content)
      : isTypeableDevanagari(p.content);
    if (!typeable) {
      problems.push(`untypeable characters in "${p.title}"`);
    }
    if (!isProse(p.content)) {
      problems.push(`not prose (list/contents-like): "${p.title}"`);
    }
    const tier = TIERS.find((t) => t.speedCategory === p.speedCategory);
    if (tier && (p.wordCount < tier.minWords || p.wordCount > tier.maxWords)) {
      problems.push(`"${p.title}" has ${p.wordCount} words, outside the ${tier.speedCategory} WPM window`);
    }
  }

  if (problems.length) {
    console.error("\nFAILED — corpus not written:");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("\nWiden the source list or relax the tier word windows, then re-run.");
    process.exit(1);
  }

  const outDir = path.resolve(__dirname, "data");
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "passages.generated.json");
  writeFileSync(outFile, JSON.stringify(passages, null, 2) + "\n", "utf8");

  // Attribution file — required by CC BY-SA for the Marathi material.
  const sources = [...new Set(passages.map((p) => p.source))].sort();
  writeFileSync(
    path.join(outDir, "ATTRIBUTION.md"),
    [
      "# Passage sources & attribution",
      "",
      "Generated by `scripts/src/fetch-passages.ts`. Do not edit by hand.",
      "",
      "English passages are drawn from Project Gutenberg editions of public-domain works;",
      "Gutenberg's header/footer and licence block are stripped, so only the public-domain",
      "text itself is reproduced.",
      "",
      "Marathi passages are drawn from Marathi Wikipedia and are licensed CC BY-SA 4.0.",
      "Attribution for each source article is listed below.",
      "",
      "## Sources",
      "",
      ...sources.map((s) => `- ${s}`),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`\nWrote ${passages.length} passages to ${path.relative(process.cwd(), outFile)}`);
  console.log(`Wrote attribution to ${path.relative(process.cwd(), path.join(outDir, "ATTRIBUTION.md"))}`);
  console.log("\nNext: pnpm --filter @workspace/scripts run seed");
  process.exit(0);
}

main().catch((err) => {
  console.error("Passage generation failed:", err);
  process.exit(1);
});

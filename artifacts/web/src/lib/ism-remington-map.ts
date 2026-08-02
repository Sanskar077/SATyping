/**
 * ISM V6 Remington (CDAC GIST) Marathi/Hindi keyboard layout → Unicode map
 *
 * This is the physical key mapping used in official Maharashtra government
 * typing examinations: GCC-TBC, MPSC, and MS-CIT. Source: CDAC GIST ISM V6
 * Remington keyboard reference chart (cross-verified pixel-for-pixel against
 * the published "English Keys to Marathi Words Mapping" chart).
 *
 * ── How it works ────────────────────────────────────────────────────────
 * We intercept the browser's `keydown` event, call `preventDefault()` to
 * block ASCII insertion, look up `event.key` in this map (event.key already
 * encodes Shift: 'a' vs 'A'), and insert the resulting Unicode string.
 *
 * ── Pre-consonant keys (there are TWO) ──────────────────────────────────
 * Some marks are struck BEFORE the consonant they attach to, because that is
 * where they sit visually on a mechanical typewriter. Unicode requires the
 * logical order instead, so these are buffered and re-ordered:
 *
 *   1. Short-i matra (f = ि) — Unicode wants it AFTER the consonant:
 *        f (ि) then d (क)  →  क + ि = "कि"
 *   2. Reph (Shift+Z = र्) — Unicode wants it BEFORE the consonant:
 *        Shift+Z (र्) then d (क)  →  र् + क = "र्क"
 *
 * Reph must not be confused with rakar (lowercase z = ्र), which is struck
 * AFTER its consonant: d (क) then z → "क्र".
 *
 * Every other matra (ा ी ु ू े ै ृ) is struck after the consonant and simply
 * appended — no buffering needed.
 *
 * ── Two-keystroke composition ───────────────────────────────────────────
 * Several glyphs have NO key of their own and are produced by a second key
 * that REPLACES the previous character (see COMPOSITION_RULES below):
 *   ो ौ ॉ  are built on ा;  आ ओ औ ऐ ई ऊ ँ ॥  are built likewise.
 * A half-letter followed by ा completes it into the full consonant, which is
 * the ONLY way to type ख घ थ ध भ श ष ण — they have no full-form key.
 *
 * ── Conjuncts, reph, and half-letters ───────────────────────────────────
 * There are two distinct ways to build half-letters/conjuncts, matching the
 * official software exactly:
 *
 * 1. Bare virama (Shift+= → ्) forms a conjunct/reph naturally via normal
 *    Unicode shaping when followed by another consonant:
 *      d (क) + Shift+= (्) + y (ल) → क + ् + ल → "क्ल"        ✓ conjunct
 *      j (र) + Shift+= (्) + d (क) → र + ् + क → "र्क"        ✓ reph
 *
 * 2. Shift+<consonant> keys (C,D,E,F,H,I,L,O,P,R,T,U,X,Y,Z, and the [ ' " { ? symbol
 *    keys) produce an EXPLICIT half-letter: consonant + ् + ZWJ (U+200D).
 *    The trailing Zero-Width Joiner forces the half-form glyph to render on
 *    its own, regardless of what follows — this is how the official
 *    software lets a typist force a half-letter appearance without relying
 *    on the next keystroke to trigger font shaping.
 *
 * A handful of frequently-used conjunct ligatures (श्र, ज्ञ, द्य, द्ध, त्र,
 * द्व, क्ष्‍) are assigned directly to single shift-keys, exactly as on the
 * real keyboard, rather than requiring the user to compose them manually.
 *
 * ── Language switch ──────────────────────────────────────────────────────
 * English passages bypass this map entirely — keys produce their standard
 * ASCII characters via the normal browser `input` event.
 *
 * Marathi and Hindi share this SAME physical layout: the official CDAC GIST
 * ISM V6 software uses one Devanagari Remington key layout for both
 * languages (only the linguistic dictionary/spellcheck differs, which this
 * typing platform does not implement). `resolveKey` / `attachTypingKeyHandlers`
 * treat `"hindi"` as an alias of `"marathi"` — see typing-key-handler.ts.
 *
 * ── Single source of truth ───────────────────────────────────────────────
 * Every consumer — exams, practice, drills, the Typing Notepad, and the
 * on-screen keyboard reference overlay — reads from THIS file. Never copy
 * these key→character assignments into another file; import them instead.
 */

// ─── Key output types ────────────────────────────────────────────────────

/** The pre-consonant ि matra (U+093F) — reordered after the next consonant. */
export const PRE_I_MATRA = '\u093F';
/**
 * Dotted circle (U+25CC) — the standard Unicode base for displaying a combining mark that
 * has no consonant yet. A velanti struck before its consonant is committed as ◌ + ि so the
 * FIRST key press is immediately visible (matching how the official ISM software renders a
 * standalone matra). The ◌ also keeps the bare mark from fusing into the PREVIOUS cluster,
 * and is stripped when the consonant arrives.
 */
export const DOTTED_CIRCLE = '◌';
/** Visible committed form of a velanti still awaiting its consonant. */
export const PENDING_PRE_I = DOTTED_CIRCLE + PRE_I_MATRA;
/** Bare virama / halant (U+094D) — forms conjuncts/reph via Unicode shaping. */
export const VIRAMA = '\u094D';
/** Zero-Width Joiner (U+200D) — forces an explicit, standalone half-letter. */
export const ZWJ = '\u200D';
/** Appended after a consonant to force an explicit half-letter glyph. */
export const HALF = VIRAMA + ZWJ;

/** All Devanagari consonants — used to decide whether ि goes after or before. */
export const DEVANAGARI_CONSONANTS = new Set([
  // Velar stops
  'क','ख','ग','घ','ङ',
  // Palatal stops
  'च','छ','ज','झ','ञ',
  // Retroflex stops
  'ट','ठ','ड','ढ','ण',
  // Dental stops
  'त','थ','द','ध','न',
  // Labial stops
  'प','फ','ब','भ','म',
  // Approximants / fricatives
  'य','र','ल','व','श','ष','स','ह',
  // Marathi-specific
  'ळ',   // U+0933 – retroflex la
  'ऱ',   // U+0931 – eyelash-ra
]);

// ─── The Remington key map ───────────────────────────────────────────────
// Key: event.key  (already encodes Shift — 'a' vs 'A', '1' vs '!')
// Value: Unicode string to insert, OR the PRE_I_MATRA sentinel.

export const REMINGTON_MAP: Readonly<Record<string, string>> = {

  // ── Letters, no shift (a–z) ─────────────────────────────────────────────
  'a':'ं',            // U+0902 – anusvara
  'b':'इ',            // U+0907 – short-i (independent vowel)
  'c':'ब',            // U+092C
  'd':'क',            // U+0915
  'e':'म',            // U+092E
  'f':'\u001F_PRE_I',  // ि U+093F — PRE-CONSONANT sentinel (the ONLY pre-consonant key)
  'g':'ह',            // U+0939
  'h':'ी',            // U+0940 – long-i matra (post-consonant)
  'i':'प',            // U+092A
  'j':'र',            // U+0930
  'k':'ा',            // U+093E – aa matra (post-consonant)
  'l':'स',            // U+0938
  'm':'उ',            // U+0909
  'n':'द',            // U+0926
  'o':'व',            // U+0935
  'p':'च',            // U+091A
  'q':'ु',            // U+0941 – u matra (post-consonant)
  'r':'त',            // U+0924
  's':'े',            // U+0947 – e matra (post-consonant)
  't':'ज',            // U+091C
  'u':'न',            // U+0928
  'v':'अ',            // U+0905
  'w':'ू',            // U+0942 – long-u matra (post-consonant)
  'x':'ग',            // U+0917
  'y':'ल',            // U+0932
  'z':'्र',           // U+094D U+0930 – subjoined-ra conjunct (e.g. क + ्र → क्र)

  // ── Letters, with shift (A–Z) ────────────────────────────────────────────
  'A':'ा',            // U+093E – aa matra (alternate key)
  'B':'ठ',            // U+0920
  'C':'ब'+HALF,        // explicit half-ba
  'D':'क'+HALF,        // explicit half-ka
  'E':'म'+HALF,        // explicit half-ma
  'F':'थ'+HALF,        // explicit half-tha
  'G':'ळ',            // U+0933 – retroflex la (Marathi-specific)
  'H':'भ'+HALF,        // explicit half-bha
  'I':'प'+HALF,        // explicit half-pa
  'J':'श्र',          // U+0936 U+094D U+0930 – "shra" conjunct ligature
  'K':'ज्ञ',          // U+091C U+094D U+091E – "dnya" conjunct ligature
  'L':'स'+HALF,        // explicit half-sa
  'M':'ड',            // U+0921
  'N':'छ',            // U+091B
  'O':'व'+HALF,        // explicit half-va
  'P':'च'+HALF,        // explicit half-cha
  'Q':'फ',            // U+092B
  'R':'त'+HALF,        // explicit half-ta
  'S':'ै',            // U+0948 – ai matra (post-consonant)
  'T':'ज'+HALF,        // explicit half-ja
  'U':'न'+HALF,        // explicit half-na
  'V':'ट',            // U+091F
  'W':'ॅ',            // U+0945 – candra-E / short-e matra
  'X':'ग'+HALF,        // explicit half-ga
  'Y':'ल'+HALF,        // explicit half-la
  'Z':'\u001F_REPH',   // र् REPH — PRE-CONSONANT sentinel: typed BEFORE the consonant
                       // it sits above (Shift+Z + क → र्क). Distinct from 'z' (rakar ्र),
                       // which is typed AFTER. Per the Keyman Remington GAIL source.

  // ── Digits → Devanagari digits ──────────────────────────────────────────
  '1':'१','2':'२','3':'३','4':'४','5':'५',
  '6':'६','7':'७','8':'८','9':'९','0':'०',

  // ── Symbol row, no shift ─────────────────────────────────────────────────
  '`':'़',            // U+093C – nukta
  '-':'ञ',            // U+091E – nya
  '=':'ृ',            // U+0943 – vocalic-ri matra (post-consonant)
  '[':'ख'+HALF,        // explicit half-kha
  ']':',',            // ASCII comma
  '\\':'.',           // ASCII period
  ';':'य',            // U+092F
  "'":'श'+HALF,        // explicit half-sha (palatal)
  ',':'ए',            // U+090F – independent vowel "e"
  '.':'ण'+HALF,        // explicit half-Na (retroflex)
  '/':'ध'+HALF,        // explicit half-dha

  // ── Symbol row, with shift ────────────────────────────────────────────────
  '~':'द्य',          // U+0926 U+094D U+092F – "dya" conjunct ligature
  '!':'।',            // U+0964 – danda (Devanagari full stop)
  '@':'/',            // ASCII slash
  '#':'ः',            // U+0903 – visarga. Per the Keyman Remington GAIL source (Shift+3) and the
                      // MPSC ISM V6 chart, which labels this key ':'. Marathi/Sanskrit-derived
                      // words need it (दुःख, अंतःकरण); it was previously an ASCII colon, leaving
                      // visarga untypeable.
  '$':'र'+HALF,        // explicit half-ra (alternate key)
  '%':'-',            // ASCII hyphen
  '^':'"',            // ASCII double-quote
  '&':"'",            // ASCII apostrophe
  '*':'द्ध',          // U+0926 U+094D U+0927 – "ddha" conjunct ligature
  '(':'त्र',          // U+0924 U+094D U+0930 – "tra" conjunct ligature
  ')':'ऋ',            // U+090B – vocalic-ri (independent vowel)
  '_':'.',            // ASCII period (alternate key)
  '+':'्',            // U+094D – BARE virama/halant (forms conjuncts & reph)
  '{':'क्ष'+HALF,     // explicit half of the "ksha" conjunct
  '}':'द्व',          // U+0926 U+094D U+0935 – "dva" conjunct ligature
  '|':'',             // VERIFY: no character assigned on the reference chart — intentionally inert
  ':':'रू',           // U+0930 U+0942 – र + long-u matra ("rū")
  '"':'ष'+HALF,        // explicit half-sha (retroflex)
  '<':'ढ',            // U+0922 – retroflex dha
  '>':'झ',            // U+091D
  '?':'घ'+HALF,        // explicit half-gha

  // ── Punctuation (both modes) ────────────────────────────────────────────
  ' ':' ',            // space always stays space
};

/** Sentinel value stored in the map for the pre-consonant ि key. */
export const PRE_I_SENTINEL = '\u001F_PRE_I';

/**
 * Sentinel for the reph key (Shift+Z). Like the short-i matra, reph is struck BEFORE the
 * consonant it applies to, so it must be buffered and re-ordered rather than appended:
 *
 *   Shift+Z then the ka key  ->  reph + ka  (renders as one cluster)
 *
 * This is the SECOND pre-consonant key on the layout. It is deliberately distinct from the
 * lowercase 'z' rakar, which is struck AFTER its consonant. Conflating the two -- as the
 * previous plain half-ra mapping did -- produces visually similar but incorrectly ordered
 * Unicode that fails grading.
 */
export const REPH_SENTINEL = '\u001F_REPH';

/** Reph text: ra + virama, emitted before the following consonant. */
export const REPH = '\u0930' + VIRAMA;

/** True for any language that uses the ISM Remington Devanagari layout. */
export function isDevanagariLanguage(language: string): boolean {
  return language === 'marathi' || language === 'hindi';
}

/**
 * ─── Two-keystroke composition (Remington "dead-key" behaviour) ────────────
 *
 * On the real Remington/ISM layout a number of glyphs have NO key of their own —
 * they are produced by striking a second key that REPLACES the previously committed
 * character. This mirrors the mechanical typewriter, where ो is literally the ा
 * hammer followed by the े hammer.
 *
 *   का + े  →  को      (keys: d k s)
 *   का + ै  →  कौ      (keys: d k S)
 *   का + ॅ  →  कॉ      (keys: d k W)
 *   अ  + ा  →  आ       (keys: v k)
 *   आ  + े  →  ओ       (keys: v k s)
 *
 * Verified against the Keyman "Remington GAIL (SIL)" keyboard source (an executable
 * spec, not prose) and cross-checked against the ISM V6 Remington Marathi on-screen
 * keyboard published by MPSC as an appendix to its typing skill-test notice. Both
 * agree key-for-key, and the composites are independently attested by the
 * long-published KrutiDev keystroke strings (को = "dks").
 *
 * Structure: PREVIOUS committed character → INCOMING character → REPLACEMENT.
 * The previous character is removed and the replacement inserted in its place.
 */
export const COMPOSITION_RULES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // Matras built on the ा hammer.
  'ा': { 'े': 'ो', 'ै': 'ौ', 'ॅ': 'ॉ' },

  // Independent vowels.
  // अ + ॅ -> ॲ (U+0972) is Marathi-specific: MARATHI LETTER CANDRA A, used for English loanwords
  // (ॲड, ॲनिमेशन). Hindi Remington has no such key, and the research on ISM V6's exact handling
  // here was inconclusive — but the composition is consistent with every other candra form on the
  // layout (ा+ॅ->ॉ, ए+ॅ->ऍ), and without it ॲ is untypeable in Marathi text.
  'अ': { 'ा': 'आ', 'ॅ': 'ॲ' },
  'आ': { 'े': 'ओ', 'ै': 'औ', 'ॅ': 'ऑ' },
  // Keyman specifies उ + ु; उ + ू is what a typist naturally reaches for. Both are
  // accepted — grading only ever inspects the final committed Unicode, so being
  // permissive costs nothing and avoids failing a candidate over keystroke order.
  'उ': { 'ु': 'ऊ', 'ू': 'ऊ' },
  // Likewise इ: Keyman composes ई from इ + reph (a legacy visual construction);
  // इ + ी is the intuitive form and is accepted too.
  'इ': { 'ी': 'ई' },
  'ए': { 'े': 'ऐ', 'ॅ': 'ऍ' },

  // Nasal marks: chandrabindu is ॅ + ं struck in either order.
  'ॅ': { 'ं': 'ँ' },
  'ं': { 'ॅ': 'ँ' },

  // Doubled forms.
  'ृ': { 'ृ': 'ॄ' },
  '।': { '।': '॥' },
};

/**
 * Half-letter + ा → full consonant.
 *
 * Several consonants (ख घ थ ध भ श ष ण, and क्ष) have NO full-form key on this layout —
 * only a half-form key. The full letter is produced by following the half form with ा,
 * which completes it by removing the halant. Without this rule those consonants are
 * untypeable in full form, which for श in Marathi is a showstopper.
 */
function completeHalfLetter(prev: string, incoming: string): string | null {
  if (incoming !== 'ा') return null; // only ा completes a half letter
  if (prev.endsWith(VIRAMA + ZWJ)) return prev.slice(0, -2);
  if (prev.endsWith(VIRAMA)) return prev.slice(0, -1);
  return null;
}

/**
 * Applies Remington two-keystroke composition to already-committed text.
 *
 * Returns the FULL replacement text if a rule fires, or null if the incoming
 * character should simply be appended as normal.
 */
export function applyComposition(prev: string, incoming: string): string | null {
  if (!prev || !incoming) return null;

  // Half-letter completion matches on a suffix (virama/ZWJ) rather than a single
  // character, so it is checked first and must not be shadowed by the table below.
  const completed = completeHalfLetter(prev, incoming);
  if (completed !== null) return completed;

  const last = prev.slice(-1);
  const replacement = COMPOSITION_RULES[last]?.[incoming];
  if (replacement === undefined) return null;
  return prev.slice(0, -1) + replacement;
}

/**
 * Resolve a keyboard event to a string to insert.
 * Returns null if the key should be ignored.
 * Returns PRE_I_SENTINEL if the pre-consonant ि buffer must be activated.
 */
export function resolveKey(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;

  const mapped = REMINGTON_MAP[e.key];
  if (mapped === undefined) return null;
  if (mapped === '') return null;
  return mapped; // includes PRE_I_SENTINEL when applicable
}

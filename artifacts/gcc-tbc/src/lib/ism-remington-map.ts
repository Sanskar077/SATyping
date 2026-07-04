/**
 * ISM Typewriter (Remington / Godrej) Marathi keyboard layout → Unicode map
 *
 * This is the physical key mapping used in official Maharashtra government
 * typing examinations: GCC-TBC, MPSC, and MS-CIT.
 *
 * ── How it works ─────────────────────────────────────────────────────────────
 * We intercept the browser's `keydown` event, call `preventDefault()` to block
 * ASCII insertion, look up `event.key` in this map, and insert the Devanagari
 * Unicode character(s) into the typing engine.
 *
 * ── The ि pre-consonant rule ──────────────────────────────────────────────────
 * On a physical Marathi typewriter the carriage rolls back to type ि BEFORE
 * the consonant. Unicode requires the opposite order: consonant THEN matra.
 *
 *   User types:  w (= ि)  then  s (= क)
 *   We output:   क  +  ि  =  "कि"   (reversed from typing order)
 *
 * Keys 'w' and 'f' are both marked PRE_I_MATRA so the engine buffers the ि
 * and waits for the next consonant before committing to typedText.
 *
 * ── Conjuncts & reph ──────────────────────────────────────────────────────────
 * Conjuncts form naturally through Unicode shaping:
 *   s (क) + q (्) + l (स) → क + ् + स → "क्स"  ✓
 *   j (र) + q (्) + s (क) → र + ् + क → "र्क"  (reph above क) ✓
 * No special handling beyond the virama key.
 *
 * ── Language switch ───────────────────────────────────────────────────────────
 * English passages bypass this map entirely — keys produce their standard
 * ASCII characters via the normal browser `input` event.
 */

// ─── Key output types ─────────────────────────────────────────────────────────

/** Sentinel for the pre-consonant ि that needs special buffering. */
export const PRE_I_MATRA = '\u093F';       // ि  U+093F
export const VIRAMA      = '\u094D';       // ्  U+094D

/** All Devanagari consonants — used to decide whether ि goes after or before. */
export const DEVANAGARI_CONSONANTS = new Set([
  // Velar stops
  'क','ख','ग','घ','ङ',           // U+0915–U+0919
  // Palatal stops
  'च','छ','ज','झ','ञ',           // U+091A–U+091E
  // Retroflex stops
  'ट','ठ','ड','ढ','ण',           // U+091F–U+0923
  // Dental stops
  'त','थ','द','ध','न',           // U+0924–U+0928
  // Labial stops
  'प','फ','ब','भ','म',           // U+092A–U+092E
  // Approximants / fricatives
  'य','र','ल','व','श','ष','स','ह', // U+092F–U+0939
  // Marathi-specific
  'ळ',                            // U+0933 – retroflex la
  'ऱ',                            // U+0931 – eyelash-ra
]);

// ─── The Remington key map ───────────────────────────────────────────────────
// Key: event.key  (already encodes Shift — 'a' vs 'A', '1' vs '!')
// Value: Unicode string to insert, OR the PRE_I_MATRA sentinel.

export const REMINGTON_MAP: Readonly<Record<string, string>> = {

  // ── Digits → Devanagari digits ────────────────────────────────────────────
  '1':'१','2':'२','3':'३','4':'४','5':'५',
  '6':'६','7':'७','8':'८','9':'९','0':'०',

  // ── Top-row symbols (no shift) ────────────────────────────────────────────
  '`':'ॅ',   // U+0945 – short-E matra (ऑफिस etc.)
  '-':'-',
  '=':'ृ',   // U+0943 – ri matra

  // ── Top-row symbols (shift) ───────────────────────────────────────────────
  '~':'ॐ',   // U+0950 – Om
  '!':'!','@':'@','#':'#','%':'%','^':'^','&':'&','*':'*','(':'(',')':', )','_':'_',
  '$':'रु',  // compound: र (U+0930) + ु (U+0941)
  '+':'ॄ',   // U+0944 – long ri matra

  // ── QWERTY row (no shift) ─────────────────────────────────────────────────
  'q':'्',   // U+094D – virama / halant (forms conjuncts)
  'w':'\u001F_PRE_I',   // ि U+093F — PRE-CONSONANT sentinel (see engine)
  'e':'म',   // U+092E
  'r':'ा',   // U+093E – aa matra
  't':'न',   // U+0928
  'y':'ब',   // U+092C
  'u':'ु',   // U+0941 – u matra
  'i':'व',   // U+0935
  'o':'ग',   // U+0917
  'p':'थ',   // U+0925
  '[':'ड',   // U+0921 – retroflex da
  ']':'ञ',   // U+091E – nya
  '\\':'़',  // U+093C – nukta

  // ── QWERTY row (shift) ────────────────────────────────────────────────────
  'Q':'औ',   // U+0914
  'W':'ई',   // U+0908
  'E':'ए',   // U+090F
  'R':'आ',   // U+0906
  'T':'ण',   // U+0923 – retroflex na (also comma)
  'Y':'भ',   // U+092D
  'U':'ू',   // U+0942 – long-u matra
  'I':'अ',   // U+0905
  'O':'घ',   // U+0918
  'P':'ध',   // U+0927
  '{':'ढ',   // U+0922 – retroflex dha
  '}':'ञ',   // U+091E
  '|':'ऑ',   // U+0911 – O (loanword vowel)

  // ── Home row (no shift) ───────────────────────────────────────────────────
  'a':'े',   // U+0947 – e matra
  's':'क',   // U+0915
  'd':'ट',   // U+091F – retroflex ta
  'f':'\u001F_PRE_I',   // ि U+093F — alternate PRE-CONSONANT key
  'g':'ह',   // U+0939
  'h':'प',   // U+092A
  'j':'र',   // U+0930
  'k':'त',   // U+0924
  'l':'स',   // U+0938
  ';':'ज',   // U+091C
  "'": 'ल',  // U+0932

  // ── Home row (shift) ──────────────────────────────────────────────────────
  'A':'ै',   // U+0948 – ai matra
  'S':'क',   // U+0915 (same weight consonant)
  'D':'ठ',   // U+0920 – retroflex tha
  'F':'्',   // U+094D – virama (alternate)
  'G':'ः',   // U+0903 – visarga
  'H':'फ',   // U+092B
  'J':'ऱ',   // U+0931 – eyelash-ra (Marathi specific)
  'K':'त',   // U+0924
  'L':'श',   // U+0936 – palatal sha
  ':':'झ',   // U+091D
  '"':'ळ',   // U+0933 – retroflex la (Marathi specific)

  // ── Bottom row (no shift) ─────────────────────────────────────────────────
  'z':'ऋ',   // U+090B – vocalic ri (standalone vowel)
  'x':'ं',   // U+0902 – anusvara
  'c':'च',   // U+091A
  'v':'ख',   // U+0916
  'b':'इ',   // U+0907 – short-i (standalone vowel)
  'n':'द',   // U+0926
  'm':'ो',   // U+094B – o matra
  ',':'ण',   // U+0923 – retroflex na
  '.':'।',   // U+0964 – danda (Marathi full stop)
  '/':'/',

  // ── Bottom row (shift) ────────────────────────────────────────────────────
  'Z':'ऋ',   // U+090B
  'X':'ः',   // U+0903 – visarga (alt)
  'C':'छ',   // U+091B
  'V':'ग',   // U+0917 (alternate ga)
  'B':'ई',   // U+0908
  'N':'ध',   // U+0927
  'M':'ौ',   // U+094C – au matra
  '<':'',
  '>':'ष',   // U+0937 – retroflex sha
  '?':'य',   // U+092F

  // ── Punctuation (both modes) ──────────────────────────────────────────────
  ' ':' ',   // space always stays space
};

/** Sentinel value stored in the map for the pre-consonant ि keys. */
export const PRE_I_SENTINEL = '\u001F_PRE_I';

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

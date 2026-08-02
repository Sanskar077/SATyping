/**
 * keystroke-hints — computes WHICH PHYSICAL KEYS produce the next character of a passage.
 *
 * Powers the in-session guidance keyboard: given the target grapheme cluster the typist must
 * produce next (e.g. "को", "र्क", "कि", "श") and whatever partial progress is already committed
 * (e.g. "का" on the way to "को"), it returns the remaining key sequence (e.g. ["s"]).
 *
 * ── Why a SEARCH instead of a lookup table ────────────────────────────────────
 * A single Devanagari cluster can take up to ~6 keystrokes through three different mechanisms
 * (direct keys, two-keystroke composition like ा+े→ो, pre-consonant buffering for ि and reph).
 * A hand-maintained reverse table would be a second copy of the layout — exactly what CLAUDE.md
 * forbids — and would silently drift when the map changes. Instead we run a small breadth-first
 * search over SIMULATED keystrokes, where each step applies the same REMINGTON_MAP lookup,
 * applyComposition() call, and pre-consonant reordering as the real key handler. Whatever the
 * search finds is therefore typeable by definition, and a map change automatically changes hints.
 *
 * The search space is kept tiny by only branching on keys whose output can still contribute to
 * the target (computed via a fix-point over the composition rules), so lookups are microseconds —
 * and memoised on top of that, since passages repeat the same clusters constantly.
 *
 * Pre-consonant marks are visible in committed text (velanti commits ◌ि immediately, reph
 * commits र्), so after the user presses `f` the partial passed here ends with ◌ि and the
 * simulation resumes with the pending flag set — hints track every keystroke, including the
 * pre-consonant ones.
 */
import {
  REMINGTON_MAP, PRE_I_SENTINEL, REPH_SENTINEL, PRE_I_MATRA, PENDING_PRE_I, REPH,
  DEVANAGARI_CONSONANTS, COMPOSITION_RULES, VIRAMA, applyComposition,
} from "@/lib/ism-remington-map";
import { clusterMatch } from "@/lib/grapheme-utils";

const MAX_DEPTH = 8;
/** Hard cap on explored states — pathological targets fail fast instead of hanging a keystroke. */
const MAX_STATES = 4000;

// ─── Relevant-key pruning ─────────────────────────────────────────────────────

/**
 * All characters that can participate in producing `target`, computed as a fix-point over the
 * composition rules: if a relevant char is the RESULT of a composition (ो ← ा+े), both its
 * inputs become relevant too (transitively: ओ ← आ+े ← (अ+ा)+े).
 */
function relevantChars(target: string): Set<string> {
  const set = new Set<string>();
  for (const ch of target.normalize("NFC")) {
    set.add(ch);
    // Precomposed nukta forms (ऱ ज़ ...) are typed as base + nukta.
    const nfd = ch.normalize("NFD");
    if (nfd.length > 1) for (const part of nfd) set.add(part);
  }

  let grew = true;
  while (grew) {
    grew = false;
    for (const [prev, table] of Object.entries(COMPOSITION_RULES)) {
      for (const [incoming, result] of Object.entries(table)) {
        if ([...result].some((c) => set.has(c)) && (!set.has(prev) || !set.has(incoming))) {
          set.add(prev);
          set.add(incoming);
          grew = true;
        }
      }
    }
  }

  // Half-letter completion: a full consonant with no direct key is typed as half-form + ा, and the
  // half form is consonant+virama(+ZWJ). Make those building blocks reachable whenever the target
  // contains any consonant.
  if ([...set].some((c) => DEVANAGARI_CONSONANTS.has(c))) {
    set.add("ा");
    set.add(VIRAMA);
  }

  return set;
}

/** The physical keys worth trying for this target — usually 4–15 of the map's ~95. */
function candidateKeys(target: string): string[] {
  const relevant = relevantChars(target);
  const goal = target.normalize("NFC");
  const keys: string[] = [];

  for (const [key, output] of Object.entries(REMINGTON_MAP)) {
    if (output === "") continue;
    if (output === PRE_I_SENTINEL) {
      if (relevant.has(PRE_I_MATRA)) keys.push(key);
      continue;
    }
    if (output === REPH_SENTINEL) {
      // Reph is relevant when the target begins with र् (ra + virama + more).
      if (goal.startsWith(REPH)) keys.push(key);
      continue;
    }
    // EVERY character the key emits must be relevant (ZWJ excepted — all half-letter keys emit
    // it as a shaping hint, and completion strips it). Requiring only SOME character to match
    // made every half-letter key a candidate for every conjunct target (they all emit the
    // virama), exploding the branching factor and blowing the state cap on deep clusters like
    // र्त्यां before a solution was reached.
    const chars = [...output].filter((c) => c !== "‍");
    if (chars.length > 0 && chars.every((c) => relevant.has(c))) keys.push(key);
  }

  return keys;
}

// ─── Keystroke simulation (mirrors typing-key-handler.ts exactly) ─────────────

interface SimState {
  /** Committed text, INCLUDING the visible pending forms (◌ि / र्) — as on screen. */
  text: string;
  pendingPreI: boolean;
  pendingReph: boolean;
}

/** UTF-16 width of the visible pending marks at the tail of `state.text`. */
function pendingUnits(state: SimState): number {
  return (state.pendingPreI ? PENDING_PRE_I.length : 0) + (state.pendingReph ? REPH.length : 0);
}

/** Applies one key to a simulated state, exactly as the real handler would. */
function pressKey(state: SimState, key: string): SimState | null {
  const mapped = REMINGTON_MAP[key];
  if (mapped === undefined || mapped === "") return null;

  // Pre-consonant marks commit their visible form immediately (◌ि on a dotted circle,
  // र् as-is) and are stripped/reordered when the consonant lands — same as the handler.
  if (mapped === PRE_I_SENTINEL) {
    if (state.pendingPreI) return null; // double-press strands a bare ◌ि — never useful in a hint
    return { ...state, text: state.text + PENDING_PRE_I, pendingPreI: true };
  }
  if (mapped === REPH_SENTINEL) {
    if (state.pendingReph) return null;
    return { ...state, text: state.text + REPH, pendingReph: true };
  }

  if (state.pendingPreI || state.pendingReph) {
    if (DEVANAGARI_CONSONANTS.has(mapped)) {
      const base = state.text.slice(0, state.text.length - pendingUnits(state));
      const reph = state.pendingReph ? REPH : "";
      const preI = state.pendingPreI ? PRE_I_MATRA : "";
      return { text: base + reph + mapped + preI, pendingPreI: false, pendingReph: false };
    }
    // Non-consonant: marks are emitted in Unicode order (no base consonant), then the key.
    const reph = state.pendingReph ? REPH : "";
    const preI = state.pendingPreI ? PRE_I_MATRA : "";
    const base = state.text.slice(0, state.text.length - pendingUnits(state));
    return { text: base + reph + preI + mapped, pendingPreI: false, pendingReph: false };
  }

  const composed = applyComposition(state.text, mapped);
  return { text: composed !== null ? composed : state.text + mapped, pendingPreI: false, pendingReph: false };
}

// ─── The search ───────────────────────────────────────────────────────────────

const memo = new Map<string, string[] | null>();

/** Longest common prefix length of two strings. */
function lcp(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Shortest key sequence that turns `partial` into `target` (both NFC cluster strings).
 * Returns null if the target is unreachable on this layout (the corpus test guards against any
 * seeded passage ever containing such a cluster).
 */
export function keySequenceForCluster(target: string, partial = ""): string[] | null {
  const goal = target.normalize("NFC");
  const start = partial.normalize("NFC");
  if (goal === start) return [];

  const memoKey = `${start} ${goal}`;
  const cached = memo.get(memoKey);
  if (cached !== undefined) return cached;

  const keys = candidateKeys(goal);
  // A trailing ◌ि in the partial is a pending velanti awaiting its consonant (the handler
  // commits the visible form immediately) — resume the simulation with the flag set so the
  // next consonant strips and reorders it, exactly as the real handler will. A trailing र्
  // needs no flag: reph already precedes its consonant, so a plain append reaches the same
  // text as the reorder path.
  const startPendingPreI = start.endsWith(PENDING_PRE_I);
  const queue: { state: SimState; path: string[] }[] = [
    { state: { text: start, pendingPreI: startPendingPreI, pendingReph: false }, path: [] },
  ];
  const seen = new Set<string>([`${start}|${startPendingPreI ? 1 : 0}0`]);
  let explored = 0;

  while (queue.length > 0 && explored < MAX_STATES) {
    const { state, path } = queue.shift()!;
    if (path.length >= MAX_DEPTH) continue;
    explored++;

    for (const key of keys) {
      const next = pressKey(state, key);
      if (next === null) continue;

      const nfc = next.text.normalize("NFC");
      if (nfc === goal && !next.pendingPreI && !next.pendingReph) {
        const result = [...path, key];
        memo.set(memoKey, result);
        return result;
      }

      // Prune states that have diverged from the goal. A strict is-prefix test is WRONG here:
      // intermediate states legitimately mismatch by a short tail that a later keystroke
      // rewrites — an explicit half-letter (consonant+virama+ZWJ, 3 chars) collapses to the
      // 1-char full consonant when the completing ा lands, र becomes ऱ only after nukta, का
      // becomes को when े lands, and a pending ◌ि (2 chars) is stripped when its consonant
      // arrives. All such rewrites touch at most the trailing few characters, so any state
      // whose tail-divergence from the goal exceeds that window can never recover.
      const common = lcp(nfc, goal);
      if (nfc.length - common > 3) continue;

      const sig = `${next.text}|${next.pendingPreI ? 1 : 0}${next.pendingReph ? 1 : 0}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      queue.push({ state: next, path: [...path, key] });
    }
  }

  memo.set(memoKey, null);
  return null;
}

// ─── Cluster targeting (which cluster is the typist on?) ─────────────────────

export interface NextKeyHint {
  /** The cluster being produced (for display, e.g. "को"). */
  cluster: string;
  /** Remaining physical keys to strike, in order (e.g. ["k", "s"]). */
  keys: string[];
  /** Index of the cluster within the passage. */
  index: number;
}

/**
 * Determines the next cluster to type and the keys that produce it.
 *
 * Positional model, matching the overlay engine's battle-tested logic: the typist is "inside"
 * the previous cluster while their last committed cluster is still a valid prefix of it (क on the
 * way to को); otherwise they're starting the cluster at typedGraphemes.length. In free-
 * transcription mode this is a best-effort guide — once the typist diverges from the passage the
 * hint keeps tracking position, which is the sane behaviour for the careful novices it exists for.
 *
 * Returns null when the passage is finished or the next cluster is untypeable (never true for
 * seeded corpus passages — see the coverage test).
 */
export function nextKeyHint(passageGraphemes: string[], typedGraphemes: string[]): NextKeyHint | null {
  const typedCount = typedGraphemes.length;
  if (typedCount > 0 && typedCount <= passageGraphemes.length) {
    const lastTyped = typedGraphemes[typedCount - 1] ?? "";
    const targetHere = passageGraphemes[typedCount - 1] ?? "";
    if (clusterMatch(lastTyped, targetHere) === "prefix") {
      const keys = keySequenceForCluster(targetHere, lastTyped);
      if (keys && keys.length > 0) return { cluster: targetHere, keys, index: typedCount - 1 };
    }
  }

  if (typedCount >= passageGraphemes.length) return null;
  const target = passageGraphemes[typedCount] ?? "";
  const keys = keySequenceForCluster(target);
  if (!keys || keys.length === 0) return null;
  return { cluster: target, keys, index: typedCount };
}

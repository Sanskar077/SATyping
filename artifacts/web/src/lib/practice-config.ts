/**
 * Carries the practice wizard's timing choice from the setup page to the session page.
 *
 * The typing-session API has no "duration" or "timed" field (a practice session is just
 * user + passage), so rather than changing the API contract for a client-side-only preference,
 * the choice is stashed in sessionStorage keyed by session id and read once the session page
 * mounts. Falls back to untimed if it's missing (e.g. the user deep-linked to a session URL).
 */
export interface PracticeConfig {
  isTimed: boolean;
  /** Minutes; null when untimed. */
  durationMinutes: number | null;
  speedCategory: number;
}

/** The full wizard selection — what "practice again with the same settings" needs to recreate. */
export interface LastPracticeSettings extends PracticeConfig {
  language: "english" | "marathi" | "hindi";
}

const KEY = (sessionId: number | string) => `satyping:practice-config:${sessionId}`;
const LAST_KEY = "satyping:practice:last-settings";

export function writePracticeConfig(sessionId: number | string, config: PracticeConfig): void {
  try {
    sessionStorage.setItem(KEY(sessionId), JSON.stringify(config));
  } catch {
    // sessionStorage unavailable (private browsing) — the session just runs untimed.
  }
}

export function readPracticeConfig(sessionId: number | string): PracticeConfig | null {
  try {
    const raw = sessionStorage.getItem(KEY(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PracticeConfig>;
    if (typeof parsed?.isTimed !== "boolean") return null;
    return {
      isTimed: parsed.isTimed,
      durationMinutes: typeof parsed.durationMinutes === "number" ? parsed.durationMinutes : null,
      speedCategory: typeof parsed.speedCategory === "number" ? parsed.speedCategory : 30,
    };
  } catch {
    return null;
  }
}

/**
 * Last-used wizard settings, persisted across sessions (localStorage, not sessionStorage) so a
 * returning student can skip the wizard entirely. Written when a session starts; read by the
 * wizard's "start with last settings" shortcut and the results screen's "next passage" button.
 */
export function writeLastSettings(settings: LastPracticeSettings): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(settings));
  } catch {
    // Preference just won't persist.
  }
}

export function readLastSettings(): LastPracticeSettings | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<LastPracticeSettings>;
    if (
      typeof p?.isTimed !== "boolean" ||
      typeof p?.speedCategory !== "number" ||
      (p.language !== "english" && p.language !== "marathi" && p.language !== "hindi")
    ) {
      return null;
    }
    return {
      language: p.language,
      isTimed: p.isTimed,
      durationMinutes: typeof p.durationMinutes === "number" ? p.durationMinutes : null,
      speedCategory: p.speedCategory,
    };
  } catch {
    return null;
  }
}

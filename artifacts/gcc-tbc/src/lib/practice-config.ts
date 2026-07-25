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

const KEY = (sessionId: number | string) => `satyping:practice-config:${sessionId}`;

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

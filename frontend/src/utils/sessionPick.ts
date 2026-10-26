/**
 * Which session the office shows by itself (pure, see useSessions).
 *
 * - Nothing shown yet, or the shown session left the list: the running
 *   session with the most recent activity (else the newest one at all).
 * - The shown session ended while it was running: the most recent running
 *   one, also when the user picked it by hand.
 * - The user picked a session: stay (an old ended one too, opened on purpose).
 * - Automatic choice still running: move to a newer running session only
 *   after the shown one has been quiet a while, so two busy sessions do not
 *   flip the office back and forth.
 */

import type { Session } from "@/hooks/useSessions";

/** How long the auto-picked session must be quiet before another one wins. */
export const AUTO_SWITCH_IDLE_MS = 2 * 60_000;

export interface PickSessionInput {
  sessions: readonly Session[];
  /** The shown session ("" before the first pick). */
  currentId: string;
  /** The user chose the shown session himself. */
  manual: boolean;
  /** The shown session was running when it was last seen. */
  currentWasLive: boolean;
  now: number;
}

export const isLiveSession = (s: Session): boolean => s.status === "active";

const updated = (s: Session): number => new Date(s.updatedAt).getTime();

/** Newest activity first. */
function byRecent(sessions: readonly Session[]): Session[] {
  return [...sessions].sort((a, b) => updated(b) - updated(a));
}

/** The session to switch to, or null to keep the shown one. */
export function pickSession({
  sessions,
  currentId,
  manual,
  currentWasLive,
  now,
}: PickSessionInput): string | null {
  if (sessions.length === 0) return null;
  const live = byRecent(sessions.filter(isLiveSession));
  const current = sessions.find((s) => s.id === currentId);

  if (!current) return (live[0] ?? byRecent(sessions)[0]).id;

  if (!isLiveSession(current)) {
    const ended = currentWasLive || !manual;
    return ended && live.length > 0 ? live[0].id : null;
  }

  if (manual) return null;
  const best = live[0];
  if (
    best.id !== current.id &&
    updated(best) > updated(current) &&
    now - updated(current) > AUTO_SWITCH_IDLE_MS
  ) {
    return best.id;
  }
  return null;
}

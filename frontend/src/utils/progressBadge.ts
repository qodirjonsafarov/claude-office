/**
 * The in-scene progress badge model (AgentProgressBadge): the bar fill and
 * "3/5" label, and the one-shot "all done" pulse before the badge hides.
 */

/** How long a finished badge stays (pulse, then fade) before it hides. */
export const BADGE_HIDE_MS = 1800;
const PULSE_MS = 360;
const FADE_MS = 500;

export interface BadgeLook {
  fraction: number;
  label: string;
  complete: boolean;
}

/** The bar for a progress value; null draws nothing. */
export function badgeLook(
  progress: { done: number; total: number } | null,
): BadgeLook | null {
  if (!progress || progress.total <= 0) return null;
  const done = Math.max(0, Math.min(progress.done, progress.total));
  return {
    fraction: done / progress.total,
    label: `${done}/${progress.total}`,
    complete: done === progress.total,
  };
}

/** Scale and alpha `elapsedMs` after the list was completed. */
export function completionPulse(elapsedMs: number): {
  scale: number;
  alpha: number;
  hidden: boolean;
} {
  if (elapsedMs >= BADGE_HIDE_MS) return { scale: 1, alpha: 0, hidden: true };
  const scale =
    elapsedMs < PULSE_MS
      ? 1 + 0.3 * Math.sin((elapsedMs / PULSE_MS) * Math.PI)
      : 1;
  const fadeStart = BADGE_HIDE_MS - FADE_MS;
  const alpha =
    elapsedMs > fadeStart ? 1 - (elapsedMs - fadeStart) / FADE_MS : 1;
  return { scale, alpha, hidden: false };
}

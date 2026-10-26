/**
 * Pull-down to close a phone sheet: far enough, or a quick flick.
 * `moved` is in px, `ms` how long the pull took.
 */

/** A pull this long always closes. */
const CLOSE_PX = 110;
/** A flick: faster than this (px per ms) and longer than FLICK_PX. */
const FLICK_SPEED = 0.5;
const FLICK_PX = 30;

export function pullDismisses(moved: number, ms: number): boolean {
  const fast = moved / Math.max(1, ms) > FLICK_SPEED;
  return moved > CLOSE_PX || (fast && moved > FLICK_PX);
}

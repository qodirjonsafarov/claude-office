/**
 * Typing / directing poses for the LPC office workers.
 *
 * Workers type with their own sprite hands: the people sheets carry two
 * typing frames (left / right hand pressing a key), generated from the seated
 * frame by scripts/make_typing_frames.py. This module picks the frame over
 * time. The boss never types — while busy he stands and looks over the team.
 * Pure-TS: no Pixi, no React.
 */

/** Duration of one typing step (one key tap), ms. */
export const TYPING_STEP_MS = 110;

/**
 * How long typing stays visible after the last tool ends, ms. Tool calls come
 * in bursts with short "thinking" gaps between them; without this the worker
 * would drop the hands to the lap between every call.
 */
export const TYPING_LINGER_MS = 1500;

/** Slow forward-lean period while typing (ms per half cycle). */
const BOB_HALF_PERIOD_MS = 440;

/**
 * Hand tap rhythm: L = left hand presses, R = right hand presses, "-" = short
 * pause (hands resting). Irregular on purpose so it looks like
 * real typing rather than a metronome.
 */
const TAP_PATTERN = "LRLLR-RLRRLR--LRRL-";

export interface TypingPose {
  /** Body lean towards the desk: 0 or 1 px. */
  bodyBob: 0 | 1;
  /** Which hand is pressing a key right now (null during a pause). */
  pressed: "left" | "right" | null;
}

/** Typing pose at `elapsedMs` since typing started. */
export function typingPose(elapsedMs: number): TypingPose {
  const step = Math.floor(Math.max(0, elapsedMs) / TYPING_STEP_MS);
  const tap = TAP_PATTERN[step % TAP_PATTERN.length];
  const bodyBob: 0 | 1 =
    Math.floor(Math.max(0, elapsedMs) / BOB_HALF_PERIOD_MS) % 2 === 0 ? 0 : 1;

  const pressed = tap === "L" ? "left" : tap === "R" ? "right" : null;
  return { bodyBob, pressed };
}

/**
 * Whether the typing animation should be shown: while a tool is running and
 * for {@link TYPING_LINGER_MS} after it ends.
 */
export function isTypingVisible(
  isTyping: boolean,
  msSinceLastTyping: number,
): boolean {
  return isTyping || msSinceLastTyping < TYPING_LINGER_MS;
}

// ============================================================================
// BOSS "DIRECTING" POSE
// ============================================================================

/** Facing direction of an LPC worker (matches the sheet rows). */
export type FacingDirection = "up" | "left" | "down" | "right";

/**
 * The boss doesn't type: while busy he stands behind the desk, looks over the
 * team: at the desks, to the left and right side of the office, and back.
 * Each entry is [direction, duration ms]; the team desks are above the boss
 * desk, so "up" means facing the team.
 */
const BOSS_LOOK_CYCLE: ReadonlyArray<readonly [FacingDirection, number]> = [
  ["up", 1600],
  ["left", 900],
  ["up", 1200],
  ["right", 900],
  ["down", 700],
];
const BOSS_LOOK_CYCLE_MS = BOSS_LOOK_CYCLE.reduce((sum, [, ms]) => sum + ms, 0);

/** Direction the boss faces `elapsedMs` after he started directing. */
export function bossDirectingDirection(elapsedMs: number): FacingDirection {
  let t = Math.max(0, elapsedMs) % BOSS_LOOK_CYCLE_MS;
  for (const [direction, ms] of BOSS_LOOK_CYCLE) {
    if (t < ms) return direction;
    t -= ms;
  }
  return "up";
}

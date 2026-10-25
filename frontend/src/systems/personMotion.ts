/**
 * Walking motion helpers for the LPC office workers.
 *
 * - Facing: which of the four sheet rows (up / left / down / right) to show,
 *   with hysteresis so curved or diagonal paths don't flicker between rows.
 * - Walk frames are tied to the distance walked, not to time, so the feet
 *   match the ground speed (no sliding while easing in or out).
 * - Speed eases in at the start of a path and out at the end.
 * - Separation: a small render offset so two people never stand inside each
 *   other; name tags are stacked so they don't overlap.
 *
 * Pure TS: no Pixi, no React.
 */

import type { Position } from "@/types";

export type Facing = "up" | "left" | "down" | "right";

// ============================================================================
// FACING
// ============================================================================

/** Moves shorter than this (px) keep the current facing. */
const FACING_DEADZONE_PX = 0.05;
/**
 * The other axis must beat the current one by this ratio before the walker
 * turns. Keeps the facing steady on diagonals and smoothed corners.
 */
const TURN_RATIO = 1.35;

function dominantFacing(dx: number, dy: number): Facing {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** Facing for a move of (dx, dy), given the facing shown so far. */
export function facingFromDelta(
  dx: number,
  dy: number,
  current: Facing,
): Facing {
  if (Math.hypot(dx, dy) < FACING_DEADZONE_PX) return current;

  const horizontal = current === "left" || current === "right";
  const sign = current === "right" || current === "down" ? 1 : -1;
  const along = (horizontal ? dx : dy) * sign;
  const cross = Math.abs(horizontal ? dy : dx);

  // Still moving the way we face and the other axis doesn't clearly win
  if (along > 0 && along * TURN_RATIO >= cross) return current;
  return dominantFacing(dx, dy);
}

/** Facing of a person at `from` looking at `to`. */
export function faceToward(from: Position, to: Position): Facing {
  return dominantFacing(to.x - from.x, to.y - from.y);
}

// ============================================================================
// WALK CYCLE
// ============================================================================

/** Walk frames in the LPC sheet (frame 0 of the row is the standing pose). */
export const WALK_FRAMES = 8;
/**
 * Ground distance (canvas px) covered by one walk frame: the planted foot of
 * the LPC walk moves ~6 sprite px per frame, x1.55 sprite scale.
 */
export const WALK_STRIDE_PX = 9;

/** Walk frame (0..WALK_FRAMES-1) after walking `distance` px. */
export function walkFrameAt(distance: number): number {
  const step = Math.floor(Math.max(0, distance) / WALK_STRIDE_PX + 1e-9);
  return step % WALK_FRAMES;
}

// ============================================================================
// EASE IN / OUT
// ============================================================================

/** Slowest speed (share of full speed) at the very start / end of a path. */
const MIN_SPEED_FACTOR = 0.35;
/** Distance (px) over which a walker speeds up from a standstill. */
const ACCEL_PX = 48;
/** Distance (px) before the target over which a walker slows down. */
const DECEL_PX = 40;

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function ramp(distance: number, over: number): number {
  return (
    MIN_SPEED_FACTOR + (1 - MIN_SPEED_FACTOR) * smoothstep(distance / over)
  );
}

/**
 * Share of full walking speed after `traveled` px with `remaining` px to go.
 * Never 0, so the walker always arrives. With `easeIn` off (a walker who is
 * re-routed while already walking) only the slow-down at the end applies.
 */
export function walkSpeedFactor(
  traveled: number,
  remaining: number,
  easeIn = true,
): number {
  const start = easeIn ? ramp(traveled, ACCEL_PX) : 1;
  return Math.min(start, ramp(remaining, DECEL_PX));
}

/** Distance walked and left along `waypoints` at (index, progress). */
export function pathDistances(
  waypoints: Position[],
  currentIndex: number,
  progress: number,
): { traveled: number; remaining: number } {
  let traveled = 0;
  let remaining = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const length = Math.hypot(
      waypoints[i + 1].x - waypoints[i].x,
      waypoints[i + 1].y - waypoints[i].y,
    );
    if (i < currentIndex) traveled += length;
    else if (i > currentIndex) remaining += length;
    else {
      traveled += length * progress;
      remaining += length * (1 - progress);
    }
  }
  return { traveled, remaining };
}

// ============================================================================
// SEPARATION
// ============================================================================

/** Personal space around the feet: wide sideways, shallow in depth. */
const SPACE_RX = 32;
const SPACE_RY = 14;

export interface SeparationInput {
  id: string;
  x: number;
  y: number;
  /** Seated / anchored people are never moved. */
  fixed: boolean;
}

/**
 * Render offsets that push overlapping people apart (mostly sideways). A
 * pure function of the positions, so the offsets change smoothly as people
 * approach each other.
 */
export function separationOffsets(
  people: SeparationInput[],
): Map<string, Position> {
  const offsets = new Map<string, Position>();
  for (const p of people) offsets.set(p.id, { x: 0, y: 0 });

  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i];
      const b = people[j];
      if (a.fixed && b.fixed) continue;

      // Work in "personal space" units, where the space is a unit circle
      let ex = (b.x - a.x) / SPACE_RX;
      let ey = (b.y - a.y) / SPACE_RY;
      const n = Math.hypot(ex, ey);
      if (n >= 1) continue;
      if (n < 1e-6) {
        // Same spot: split sideways in a stable order
        ex = a.id < b.id ? 1 : -1;
        ey = 0;
      } else {
        ex /= n;
        ey /= n;
      }

      const overlap = 1 - n;
      const pushX = ex * overlap * SPACE_RX;
      const pushY = ey * overlap * SPACE_RY;
      const shareA = a.fixed ? 0 : b.fixed ? 1 : 0.5;
      const shareB = 1 - shareA;

      const oa = offsets.get(a.id)!;
      const ob = offsets.get(b.id)!;
      oa.x -= pushX * shareA;
      oa.y -= pushY * shareA;
      ob.x += pushX * shareB;
      ob.y += pushY * shareB;
    }
  }

  // Never shove anyone further than one personal-space radius
  for (const offset of offsets.values()) {
    const length = Math.hypot(offset.x / SPACE_RX, offset.y / SPACE_RY);
    if (length > 1) {
      offset.x /= length;
      offset.y /= length;
    }
  }
  return offsets;
}

// ============================================================================
// NAME TAGS
// ============================================================================

export interface LabelInput {
  id: string;
  x: number;
  /** Label center y before stacking. */
  y: number;
  width: number;
}

const LABEL_GAP = 2;

/**
 * Vertical lift (<= 0) for each name tag so no two overlap. People in front
 * (bigger y) keep their tag in place; tags of people behind move up.
 */
export function stackLabels(
  labels: LabelInput[],
  height = 22,
): Map<string, number> {
  const lifts = new Map<string, number>();
  const placed: Array<{ x: number; y: number; width: number }> = [];
  const order = [...labels].sort((a, b) => b.y - a.y);

  for (const label of order) {
    let y = label.y;
    for (let guard = 0; guard < labels.length; guard++) {
      const hit = placed.find(
        (p) =>
          Math.abs(p.x - label.x) < (p.width + label.width) / 2 + LABEL_GAP &&
          Math.abs(p.y - y) < height,
      );
      if (!hit) break;
      y = hit.y - height - LABEL_GAP;
    }
    placed.push({ x: label.x, y, width: label.width });
    lifts.set(label.id, y - label.y);
  }
  return lifts;
}

/**
 * Distance (px) to walk this frame at (index, progress) along `waypoints`,
 * with ease-in / ease-out applied to `maxSpeed` (px per second). Pass
 * `easeIn: false` for a path that continues an ongoing walk.
 */
export function walkStepPx(
  waypoints: Position[],
  currentIndex: number,
  progress: number,
  deltaSeconds: number,
  maxSpeed: number,
  options: { easeIn?: boolean; instant?: boolean } = {},
): number {
  // Reduced motion: no walking, the character appears at the target
  if (options.instant) return Number.POSITIVE_INFINITY;
  const { traveled, remaining } = pathDistances(
    waypoints,
    currentIndex,
    progress,
  );
  return (
    maxSpeed *
    deltaSeconds *
    walkSpeedFactor(traveled, remaining, options.easeIn ?? true)
  );
}

/**
 * Which cell of an LPC people sheet to show (frame x, row).
 *
 * The sheet layout is built by scripts/compose_lpc_people.py (+ the typing
 * frames from make_typing_frames.py); every animation has four rows: up,
 * left, down, right. Pure TS, so it's also used for the very first render of
 * a sprite (no frame of a wrong pose on mount).
 */

import { walkFrameAt, type Facing } from "./personMotion";
import {
  GESTURES,
  gestureFrame,
  glanceAt,
  isBlinking,
  type Gesture,
  type GestureAnim,
} from "./personPoses";

export const FRAME = 64;

/** x offsets of the animations / single frames in the sheet. */
export const SHEET_X = {
  walk: 0, // frame 0 is the standing pose, 1..8 the walk cycle
  sitChair: 576 + 2 * FRAME, // third sit frame: sitting on a chair
  idle: 768, // 2 breathing frames
  typeLeft: 896, // seated, the left hand presses a key
  typeRight: 960,
  spellcast: 1216,
  thrust: 1664,
  blinkIdle: 2176, // idle frame 0 with closed eyes
  blinkSit: 2240, // chair sit frame with closed eyes
  sleep: 2304, // seated, head bowed, eyes closed (resting / dozing)
  read: 2368, // seated, head bowed a little (reading at the desk)
} as const;

const GESTURE_X: Record<GestureAnim, number> = {
  spellcast: SHEET_X.spellcast,
  thrust: SHEET_X.thrust,
};
const IDLE_FRAMES = 2;
const IDLE_STEP_MS = 600; // slow breathing between the two idle frames
const FALLBACK_WALK_STEP_MS = 90;

export const ROW: Record<Facing, number> = {
  up: 0,
  left: 1,
  down: 2,
  right: 3,
};

export type PersonMode = "walk" | "idle" | "sit" | "gesture" | "sleep";

export interface CellInput {
  mode: PersonMode;
  direction: Facing;
  /** Distance walked (px); drives the walk frames. */
  walkDistance?: number;
  gesture?: Gesture;
  /** Per-person seed for blinking / glancing; undefined disables both. */
  seed?: number;
  glance: boolean;
  /** Seated typing: which hand presses a key right now. */
  pressed: "left" | "right" | null;
  /** Seated and reading (Read / Grep): head bowed instead of typing. */
  reading?: boolean;
}

export interface SheetCell {
  x: number;
  row: number;
}

/** Cell to show `lifeMs` into the sprite's life, `gestureMs` into a gesture. */
export function sheetCell(
  input: CellInput,
  lifeMs: number,
  gestureMs: number,
): SheetCell {
  const { mode, direction, seed } = input;
  let facing = direction;
  if (
    input.glance &&
    seed !== undefined &&
    (mode === "idle" || mode === "sit")
  ) {
    const look = glanceAt(lifeMs, seed);
    if (look) {
      // Facing the viewer / away: turn the head to the side. Facing the side
      // already: look over at the viewer.
      facing = direction === "up" || direction === "down" ? look : "down";
    }
  }
  const row = ROW[facing];
  const blink =
    seed !== undefined && facing !== "up" && isBlinking(lifeMs, seed);

  switch (mode) {
    case "walk": {
      const frame =
        input.walkDistance === undefined
          ? Math.floor(lifeMs / FALLBACK_WALK_STEP_MS) % 8
          : walkFrameAt(input.walkDistance);
      return { x: SHEET_X.walk + (1 + frame) * FRAME, row };
    }
    case "gesture": {
      const g = input.gesture ?? "talk";
      const frame = gestureFrame(g, gestureMs);
      return { x: GESTURE_X[GESTURES[g].anim] + frame * FRAME, row };
    }
    case "sleep":
      return { x: SHEET_X.sleep, row: ROW[direction] };
    case "sit": {
      if (input.pressed === "left") return { x: SHEET_X.typeLeft, row };
      if (input.pressed === "right") return { x: SHEET_X.typeRight, row };
      if (input.reading) return { x: SHEET_X.read, row };
      if (blink) return { x: SHEET_X.blinkSit, row };
      return { x: SHEET_X.sitChair, row };
    }
    default: {
      const frame = Math.floor(lifeMs / IDLE_STEP_MS) % IDLE_FRAMES;
      if (blink && frame === 0) return { x: SHEET_X.blinkIdle, row };
      return { x: SHEET_X.idle + frame * FRAME, row };
    }
  }
}

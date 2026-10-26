/**
 * Seated workers type with their hands ON the keyboard: the hands of the
 * worker's own frame (the typing frames' pressing hands included) are drawn
 * again above the desk, reaching forward onto the keyboard, instead of being
 * hidden under the desk top. Geometry only (scene px), checked against the
 * desk, keyboard and seat positions the scene really uses.
 */
import { describe, expect, it } from "vitest";
import {
  HANDS_CROP,
  handsCropPlacement,
  SEATED_FEET_Y,
  PERSON_SCALE,
} from "../src/systems/handsOnDesk";
import {
  DESK_SURFACE_OFFSET_Y,
  KEYBOARD_OFFSET_Y,
  KEYBOARD_HEIGHT,
} from "../src/constants/positions";
import { getDeskPosition } from "../src/systems/queuePositions";

// Desk 1's origin (DeskGrid: DESK_START_X / DESK_START_Y)
const DESK_ORIGIN = { x: 256, y: 408 };
// Hand rows of the seated frame (scripts/make_typing_frames.py), the
// pressing hand moved 2 px down, plus the outline under them
const HANDS_TOP = 44;
const HANDS_BOTTOM_PRESSED = 49 + 2 + 1;

/** A frame row of the seated worker at desk 1, in desk-local scene px. */
function rowOnDesk(frameRow: number): number {
  const seat = getDeskPosition(1).y - DESK_ORIGIN.y;
  const p = handsCropPlacement(SEATED_FEET_Y, PERSON_SCALE);
  return seat + p.y + (frameRow - HANDS_CROP.y) * PERSON_SCALE;
}

describe("hands on the desk", () => {
  it("crops all of both hands, pressing hand included", () => {
    expect(HANDS_CROP.y).toBeLessThanOrEqual(HANDS_TOP);
    expect(HANDS_CROP.y + HANDS_CROP.h).toBeGreaterThanOrEqual(
      HANDS_BOTTOM_PRESSED,
    );
    // Both hand blocks (x 23..41)
    expect(HANDS_CROP.x).toBeLessThanOrEqual(23);
    expect(HANDS_CROP.x + HANDS_CROP.w).toBeGreaterThanOrEqual(41);
  });

  it("rests the hands on the keyboard", () => {
    const kbTop = KEYBOARD_OFFSET_Y - KEYBOARD_HEIGHT / 2;
    const kbBottom = KEYBOARD_OFFSET_Y + KEYBOARD_HEIGHT / 2;
    const handsMid = (rowOnDesk(HANDS_TOP) + rowOnDesk(50)) / 2;
    expect(handsMid).toBeGreaterThan(kbTop);
    expect(handsMid).toBeLessThan(kbBottom);
  });

  it("starts at the desk's edge: no gap to the arms, no second torso above it", () => {
    const top = rowOnDesk(HANDS_CROP.y);
    expect(top).toBeGreaterThanOrEqual(DESK_SURFACE_OFFSET_Y - 1);
    expect(top).toBeLessThanOrEqual(DESK_SURFACE_OFFSET_Y + 3);
  });

  it("lines up with the frame horizontally", () => {
    const p = handsCropPlacement(SEATED_FEET_Y, PERSON_SCALE);
    // The frame is centred on the worker: column 32 at x = 0
    expect(p.x + (32 - HANDS_CROP.x) * PERSON_SCALE).toBeCloseTo(0, 5);
  });
});

/**
 * Tests for picking the sheet cell (frame x, row) of an LPC worker. Used for
 * the very first render too, so a freshly mounted sprite never shows a wrong
 * pose for a frame.
 */
import { describe, expect, it } from "vitest";
import { FRAME, SHEET_X, sheetCell } from "@/systems/personFrames";

const base = { direction: "down" as const, glance: false, pressed: null };

describe("sheetCell", () => {
  it("shows the chair sit frame for a seated worker from the first frame", () => {
    expect(sheetCell({ ...base, mode: "sit" }, 0, 0)).toEqual({
      x: SHEET_X.sitChair,
      row: 2,
    });
  });

  it("shows a gesture frame, not the walk pose, for a gesturing person", () => {
    const cell = sheetCell({ ...base, mode: "gesture", gesture: "talk" }, 0, 0);

    expect(cell.x).toBeGreaterThanOrEqual(SHEET_X.spellcast);
    expect(cell.x).toBeLessThan(SHEET_X.spellcast + 7 * FRAME);
  });

  it("shows the breathing idle frames while standing", () => {
    const cell = sheetCell({ ...base, mode: "idle" }, 0, 0);

    expect([SHEET_X.idle, SHEET_X.blinkIdle]).toContain(cell.x);
  });

  it("steps through the walk frames by distance", () => {
    const a = sheetCell({ ...base, mode: "walk", walkDistance: 0 }, 0, 0);
    const b = sheetCell({ ...base, mode: "walk", walkDistance: 9 }, 0, 0);

    expect(a.x).toBe(FRAME);
    expect(b.x).toBe(2 * FRAME);
  });

  it("uses the typing frames while a key is pressed", () => {
    expect(sheetCell({ ...base, mode: "sit", pressed: "left" }, 0, 0).x).toBe(
      SHEET_X.typeLeft,
    );
  });

  it("uses the row of the facing direction", () => {
    expect(
      sheetCell({ ...base, mode: "idle", direction: "up" }, 0, 0).row,
    ).toBe(0);
    expect(
      sheetCell({ ...base, mode: "idle", direction: "right" }, 0, 0).row,
    ).toBe(3);
  });
});

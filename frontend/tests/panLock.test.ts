/**
 * The office scene never leaves its stage: at the fit (zoom 1, or anything
 * below it) it is locked in place, and zoomed in it pans only as far as the
 * scene's edges reach the stage's edges, never showing empty bands.
 */
import { describe, expect, it } from "vitest";
import { clampPan, isPanLocked, panCorrection } from "../src/utils/panLock";

const stage = { width: 1000, height: 800 };

describe("isPanLocked", () => {
  it("locks at the fit", () => {
    expect(isPanLocked(1)).toBe(true);
  });

  it("locks below the fit (a zoom-out bounce)", () => {
    expect(isPanLocked(0.8)).toBe(true);
  });

  it("ignores rounding noise just above the fit", () => {
    expect(isPanLocked(1.004)).toBe(true);
  });

  it("unlocks when zoomed in", () => {
    expect(isPanLocked(1.1)).toBe(false);
  });
});

describe("clampPan", () => {
  it("pins the scene at the origin at the fit, whatever the drag", () => {
    expect(clampPan({ x: 140, y: -60, scale: 1 }, stage)).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    });
  });

  it("snaps a zoom below the fit back to the exact fit", () => {
    expect(clampPan({ x: 30, y: 20, scale: 0.7 }, stage)).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    });
  });

  it("keeps a pan that stays inside the bounds", () => {
    // at 2x the scene is 2000x1600: x may go -1000..0, y -800..0
    expect(clampPan({ x: -400, y: -300, scale: 2 }, stage)).toEqual({
      x: -400,
      y: -300,
      scale: 2,
    });
  });

  it("stops the left/top edge from coming inside the stage", () => {
    expect(clampPan({ x: 120, y: 50, scale: 2 }, stage)).toEqual({
      x: 0,
      y: 0,
      scale: 2,
    });
  });

  it("stops the right/bottom edge from coming inside the stage", () => {
    expect(clampPan({ x: -1500, y: -900, scale: 2 }, stage)).toEqual({
      x: -1000,
      y: -800,
      scale: 2,
    });
  });

  it("clamps each axis on its own", () => {
    expect(clampPan({ x: -250, y: 90, scale: 1.5 }, stage)).toEqual({
      x: -250,
      y: 0,
      scale: 1.5,
    });
  });

  it("re-clamps after the stage grew (a resize)", () => {
    // fine on a 1000-wide stage, empty band on a 1200-wide one
    const wide = { width: 1200, height: 800 };
    expect(clampPan({ x: -1000, y: 0, scale: 2 }, wide).x).toBe(-1000);
    expect(clampPan({ x: -1100, y: 0, scale: 1.5 }, wide).x).toBe(-600);
  });

  it("pins an empty stage at the origin", () => {
    expect(
      clampPan({ x: -50, y: -50, scale: 2 }, { width: 0, height: 0 }),
    ).toEqual({ x: 0, y: 0, scale: 2 });
  });
});

describe("panCorrection", () => {
  it("has nothing to fix inside the bounds", () => {
    expect(panCorrection({ x: -400, y: -300, scale: 2 }, stage)).toBeNull();
  });

  it("ignores sub-pixel overshoot (no fight with the library)", () => {
    expect(panCorrection({ x: 0.3, y: -800.4, scale: 2 }, stage)).toBeNull();
  });

  it("ignores rounding noise around the fit", () => {
    expect(panCorrection({ x: 0.2, y: 0, scale: 1.003 }, stage)).toBeNull();
  });

  it("returns the clamped view for a drift at the fit", () => {
    expect(panCorrection({ x: 80, y: 0, scale: 1 }, stage)).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    });
  });

  it("returns the clamped view for an empty band when zoomed in", () => {
    expect(panCorrection({ x: -1200, y: -100, scale: 2 }, stage)).toEqual({
      x: -1000,
      y: -100,
      scale: 2,
    });
  });
});

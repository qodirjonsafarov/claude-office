/**
 * The agent card on desktop sits beside the character and never leaves the
 * stage: it flips to the other side near the right edge, clamps near the
 * top and bottom, and shrinks to the stage when the stage is small.
 */
import { describe, expect, it } from "vitest";
import { placePopover } from "../src/utils/popoverPlacement";

const stage = { left: 300, top: 80, right: 1100, bottom: 880 };
const size = { width: 340, height: 470 };

describe("placePopover", () => {
  it("opens to the right of the character when there is room", () => {
    const p = placePopover({ x: 500, y: 400 }, size, stage);
    expect(p.side).toBe("right");
    expect(p.left).toBe(500 + 24);
    expect(p.top).toBeGreaterThanOrEqual(stage.top + 12);
  });

  it("flips to the left near the right edge", () => {
    const p = placePopover({ x: 1000, y: 400 }, size, stage);
    expect(p.side).toBe("left");
    expect(p.left + size.width).toBe(1000 - 24);
  });

  it("clamps inside the stage when neither side fits", () => {
    const narrow = { left: 300, top: 80, right: 800, bottom: 880 };
    const p = placePopover({ x: 550, y: 400 }, size, narrow);
    expect(p.left).toBeGreaterThanOrEqual(narrow.left + 12);
    expect(p.left + size.width).toBeLessThanOrEqual(narrow.right - 12);
  });

  it("stays above the bottom and below the top edge", () => {
    const low = placePopover({ x: 500, y: 870 }, size, stage);
    expect(low.top + size.height).toBeLessThanOrEqual(stage.bottom - 12);
    const high = placePopover({ x: 500, y: 82 }, size, stage);
    expect(high.top).toBe(stage.top + 12);
  });

  it("caps the height to a short stage (the card scrolls)", () => {
    const short = { left: 300, top: 80, right: 1100, bottom: 400 };
    const p = placePopover({ x: 500, y: 200 }, size, short);
    expect(p.top).toBe(short.top + 12);
    expect(p.maxHeight).toBe(400 - 80 - 24);
  });

  it("follows an anchor outside the stage back inside", () => {
    const p = placePopover({ x: 1400, y: 2000 }, size, stage);
    expect(p.left + size.width).toBeLessThanOrEqual(stage.right - 12);
    expect(p.top + size.height).toBeLessThanOrEqual(stage.bottom - 12);
  });
});

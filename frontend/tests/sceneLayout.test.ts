/**
 * The office fills the stage at any size: the canvas takes the stage's
 * aspect ratio, the 1280x1024 room sits centred inside it whole, and the
 * extra space on the long side is filled by the extended room.
 */
import { describe, expect, it } from "vitest";
import { sceneLayout } from "../src/utils/sceneLayout";

describe("sceneLayout", () => {
  it("keeps the room as is on a stage of the same shape", () => {
    expect(sceneLayout(640, 512)).toEqual({
      width: 1280,
      height: 1024,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it("widens the canvas on a wide stage and centres the room", () => {
    const l = sceneLayout(2000, 800); // 2.5:1
    expect(l.height).toBe(1024);
    expect(l.width).toBe(2560);
    expect(l.offsetX).toBe(640);
    expect(l.offsetY).toBe(0);
  });

  it("heightens the canvas on a tall stage", () => {
    const l = sceneLayout(500, 800);
    expect(l.width).toBe(1280);
    expect(l.height).toBe(2048);
    expect(l.offsetY).toBe(512);
    expect(l.offsetX).toBe(0);
  });

  it("matches the stage aspect ratio exactly, in whole pixels", () => {
    for (const [w, h] of [
      [791, 806],
      [1745, 980],
      [2400, 900],
      [368, 290],
    ]) {
      const l = sceneLayout(w, h);
      expect(Number.isInteger(l.width) && Number.isInteger(l.height)).toBe(
        true,
      );
      expect(Math.abs(l.width / l.height - w / h)).toBeLessThan(0.002);
      expect(l.width).toBeGreaterThanOrEqual(1280);
      expect(l.height).toBeGreaterThanOrEqual(1024);
    }
  });

  it("falls back to the room alone before the stage has a size", () => {
    expect(sceneLayout(0, 0)).toEqual({
      width: 1280,
      height: 1024,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

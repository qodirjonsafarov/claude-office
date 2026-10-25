/**
 * Auto-fit zoom of the office: the canvas is shown "contain" at the top-left
 * of the panel; the fit zooms it up to fill more of the panel (cropping at
 * most a little) and centres it, so big screens don't show a tiny scene with
 * empty space around it.
 */
import { describe, expect, it } from "vitest";
import { MAX_CROP, autoFit } from "@/systems/autoFit";

const W = 1280;
const H = 1024;

describe("autoFit", () => {
  it("keeps 1x and centres when the panel has the scene's shape", () => {
    expect(autoFit(1280, 1024, W, H)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("zooms in to fill a tall panel, cropping at most MAX_CROP", () => {
    const fit = autoFit(800, 1000, W, H); // contain: 800 x 640, lots of space below
    expect(fit.scale).toBeGreaterThan(1);
    expect(fit.scale).toBeLessThanOrEqual(1 / (1 - MAX_CROP) + 1e-9);
    // The scene is centred: same space (or crop) on both sides
    const shownW = 800 * fit.scale;
    const shownH = 640 * fit.scale;
    expect(fit.x).toBeCloseTo((800 - shownW) / 2);
    expect(fit.y).toBeCloseTo((1000 - shownH) / 2);
  });

  it("fills a wide panel the same way", () => {
    const fit = autoFit(2400, 1000, W, H); // contain: 1250 x 1000
    expect(fit.scale).toBeGreaterThan(1);
    expect(fit.x).toBeGreaterThan(0); // still some room left and right
  });

  it("never fills exactly by cropping more than allowed", () => {
    const fit = autoFit(400, 1600, W, H);
    expect(fit.scale).toBeCloseTo(1 / (1 - MAX_CROP));
  });

  it("does nothing for an empty panel", () => {
    expect(autoFit(0, 0, W, H)).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

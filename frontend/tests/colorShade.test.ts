/** Darkening a 0xRRGGBB colour, used to tone the floor down. */
import { describe, expect, it } from "vitest";
import { shade } from "@/systems/colorShade";

describe("shade", () => {
  it("scales each channel and rounds", () => {
    expect(shade(0xa3927f, 0.85)).toBe(
      (Math.round(0xa3 * 0.85) << 16) |
        (Math.round(0x92 * 0.85) << 8) |
        Math.round(0x7f * 0.85),
    );
  });

  it("keeps the colour at 1 and goes black at 0", () => {
    expect(shade(0x123456, 1)).toBe(0x123456);
    expect(shade(0x123456, 0)).toBe(0);
  });
});

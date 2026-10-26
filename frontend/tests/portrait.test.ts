/**
 * Tests for the agent portrait: a crop of the character's own people sheet
 * (the front-facing idle frame, head and shoulders), scaled by whole pixels,
 * and which sheet a person wears (the boss has his own, agents the look the
 * office gave them). Pure TS.
 */
import { describe, expect, it } from "vitest";
import {
  PORTRAIT_CROP,
  portraitBackground,
  portraitSheet,
} from "@/systems/portrait";
import { FRAME, ROW, SHEET_X } from "@/systems/personFrames";

describe("PORTRAIT_CROP", () => {
  it("frames the head and shoulders of the idle frame facing the viewer", () => {
    expect(PORTRAIT_CROP.x).toBeGreaterThanOrEqual(SHEET_X.idle);
    expect(PORTRAIT_CROP.x + PORTRAIT_CROP.size).toBeLessThanOrEqual(
      SHEET_X.idle + FRAME,
    );
    expect(PORTRAIT_CROP.y).toBeGreaterThanOrEqual(ROW.down * FRAME);
    expect(PORTRAIT_CROP.y + PORTRAIT_CROP.size).toBeLessThanOrEqual(
      (ROW.down + 1) * FRAME,
    );
  });
});

describe("portraitBackground", () => {
  it("shows the crop of the person's sheet at the asked size", () => {
    const bg = portraitBackground("blue-alt", PORTRAIT_CROP.size * 2);
    expect(bg.backgroundImage).toBe('url("/sprites/people/blue-alt.png")');
    expect(bg.backgroundPosition).toBe(
      `-${PORTRAIT_CROP.x * 2}px -${PORTRAIT_CROP.y * 2}px`,
    );
    expect(bg.backgroundSize).toBe(`${2432 * 2}px ${256 * 2}px`);
  });

  it("keeps sprite pixels whole at the crop's own size", () => {
    const bg = portraitBackground("boss", PORTRAIT_CROP.size);
    expect(bg.backgroundSize).toBe("2432px 256px");
  });
});

describe("portraitSheet", () => {
  const looks = new Map([["agent-1", "purple-alt"]]);

  it("gives the boss his own sheet", () => {
    expect(portraitSheet("boss", looks)).toBe("boss");
  });

  it("gives an agent the sheet the office assigned it", () => {
    expect(portraitSheet("agent-1", looks)).toBe("purple-alt");
  });

  it("has no sheet for an agent the office hasn't drawn yet", () => {
    expect(portraitSheet("agent-2", looks)).toBeNull();
  });
});

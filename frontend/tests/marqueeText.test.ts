/** Desk / boss marquees show a short line, never a whole long prompt. */
import { describe, expect, it } from "vitest";
import {
  MARQUEE_MAX_CHARS,
  clipMarqueeText,
} from "@/components/game/MarqueeText";

describe("clipMarqueeText", () => {
  it("keeps short text and flattens whitespace", () => {
    expect(clipMarqueeText("Fix  the\nlogin")).toBe("Fix the login");
  });

  it("cuts long text (a huge text canvas overflows Pixi's texture pool)", () => {
    const clipped = clipMarqueeText("x".repeat(5000));
    expect(clipped.length).toBeLessThanOrEqual(MARQUEE_MAX_CHARS);
    expect(clipped.endsWith("…")).toBe(true);
  });
});

/**
 * The in-scene progress badge: a bar while work is in progress; when the
 * list is done it turns green, pulses once and then hides.
 */
import { describe, expect, it } from "vitest";
import {
  BADGE_HIDE_MS,
  badgeLook,
  completionPulse,
} from "../src/utils/progressBadge";

describe("badgeLook", () => {
  it("draws nothing without progress", () => {
    expect(badgeLook(null)).toBeNull();
  });

  it("fills the bar by the done share and labels it", () => {
    expect(badgeLook({ done: 3, total: 5 })).toEqual({
      fraction: 0.6,
      label: "3/5",
      complete: false,
    });
  });

  it("marks a finished list as complete", () => {
    expect(badgeLook({ done: 5, total: 5 })?.complete).toBe(true);
  });
});

describe("completionPulse", () => {
  it("starts at normal size", () => {
    expect(completionPulse(0)).toEqual({ scale: 1, alpha: 1, hidden: false });
  });

  it("grows in the middle of the pulse", () => {
    expect(completionPulse(150).scale).toBeGreaterThan(1.1);
  });

  it("is back to normal size after the pulse", () => {
    expect(completionPulse(400).scale).toBe(1);
  });

  it("fades out and hides at the end", () => {
    expect(completionPulse(BADGE_HIDE_MS - 100).alpha).toBeLessThan(1);
    expect(completionPulse(BADGE_HIDE_MS).hidden).toBe(true);
  });
});

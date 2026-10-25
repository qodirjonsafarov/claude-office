/**
 * Tests for the office's day/night grading: one multiply tint whose strength
 * follows the local time (night <= 0.35) and lamp pools that glow at night,
 * plus a debug time override for screenshots. Pure TS.
 */
import { describe, expect, it } from "vitest";
import {
  NIGHT_ALPHA,
  lampGlow,
  nightAlpha,
  parseTimeOverride,
  sceneHours,
} from "@/systems/dayNight";

describe("nightAlpha", () => {
  it("is clear during the day", () => {
    expect(nightAlpha(9)).toBe(0);
    expect(nightAlpha(13.5)).toBe(0);
  });

  it("is at most 0.35 at night", () => {
    expect(NIGHT_ALPHA).toBeLessThanOrEqual(0.35);
    expect(nightAlpha(23)).toBe(NIGHT_ALPHA);
    expect(nightAlpha(2)).toBe(NIGHT_ALPHA);
  });

  it("fades smoothly through dusk and dawn", () => {
    let last = 0;
    for (let h = 17; h <= 20; h += 0.25) {
      const a = nightAlpha(h);
      expect(a).toBeGreaterThanOrEqual(last);
      last = a;
    }
    expect(nightAlpha(18.5)).toBeGreaterThan(0);
    expect(nightAlpha(18.5)).toBeLessThan(NIGHT_ALPHA);
    expect(nightAlpha(6.5)).toBeGreaterThan(0);
    expect(nightAlpha(6.5)).toBeLessThan(NIGHT_ALPHA);
  });
});

describe("lampGlow", () => {
  it("lamps are off by day and fully on at night", () => {
    expect(lampGlow(12)).toBe(0);
    expect(lampGlow(23)).toBe(1);
  });
});

describe("time override", () => {
  it("parses HH:MM", () => {
    expect(parseTimeOverride("22:30")).toBe(22.5);
    expect(parseTimeOverride("7:15")).toBe(7.25);
    expect(parseTimeOverride("25:00")).toBeNull();
    expect(parseTimeOverride("")).toBeNull();
    expect(parseTimeOverride(null)).toBeNull();
  });

  it("uses the override when set, else the local clock", () => {
    const noon = new Date(2026, 9, 26, 12, 30);
    expect(sceneHours(noon, null)).toBe(12.5);
    expect(sceneHours(noon, 22)).toBe(22);
  });
});

describe("seasonal night", () => {
  it("follows the given dawn/dusk hours (same as the city window)", () => {
    // Winter: dark early
    const winter: [number, number, number, number] = [7, 8.5, 16, 17.5];
    expect(nightAlpha(17.75, winter)).toBe(NIGHT_ALPHA);
    expect(nightAlpha(12, winter)).toBe(0);
    expect(nightAlpha(16.75, winter)).toBeGreaterThan(0);
  });
});

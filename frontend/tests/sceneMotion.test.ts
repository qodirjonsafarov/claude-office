/**
 * Tests for the scene's small motions ("juice"): bubble pop, arrival squash,
 * error shake, the needs-you pulse, fades, and the done celebration. Numbers
 * follow docs/plans/next-wave.md (durations, <= 1 Hz pulses, <= 3 flashes/s,
 * at most 20 particles under 900 ms). Pure TS.
 */
import { describe, expect, it } from "vitest";
import {
  BUBBLE_POP_MS,
  CELEBRATION_MS,
  MAX_PARTICLES,
  PULSE_PERIOD_MS,
  SHAKE_MS,
  SQUASH_MS,
  bubblePopScale,
  celebration,
  fadeIn,
  pulse,
  quantize,
  shakeOffset,
  squashScale,
} from "@/systems/sceneMotion";

describe("bubblePopScale", () => {
  it("pops from 0.6 past 1.0 and settles at 1.0 in 220 ms", () => {
    expect(BUBBLE_POP_MS).toBe(220);
    expect(bubblePopScale(0)).toBeCloseTo(0.6);
    expect(bubblePopScale(BUBBLE_POP_MS)).toBe(1);
    expect(bubblePopScale(5000)).toBe(1);
    let peak = 0;
    for (let t = 0; t <= BUBBLE_POP_MS; t += 5)
      peak = Math.max(peak, bubblePopScale(t));
    expect(peak).toBeGreaterThan(1.02);
    expect(peak).toBeLessThan(1.07);
  });
});

describe("squashScale", () => {
  it("squashes to 1.1 x 0.9 and back to 1 in 160 ms", () => {
    expect(SQUASH_MS).toBe(160);
    expect(squashScale(0)).toEqual({ x: 1, y: 1 });
    const mid = squashScale(SQUASH_MS / 2);
    expect(mid.x).toBeCloseTo(1.1, 2);
    expect(mid.y).toBeCloseTo(0.9, 2);
    expect(squashScale(SQUASH_MS)).toEqual({ x: 1, y: 1 });
  });
});

describe("shakeOffset", () => {
  it("shakes by whole pixels within 1 px for 150 ms, then rests", () => {
    expect(SHAKE_MS).toBe(150);
    const seen = new Set<number>();
    for (let t = 0; t < SHAKE_MS; t += 10) seen.add(shakeOffset(t));
    expect([...seen].sort()).toEqual([-1, 1]);
    expect(shakeOffset(SHAKE_MS)).toBe(0);
    expect(shakeOffset(-5)).toBe(0);
  });
});

describe("pulse", () => {
  it("pulses at most once per second, between 0 and 1", () => {
    expect(PULSE_PERIOD_MS).toBeGreaterThanOrEqual(1000);
    for (let t = 0; t < 3000; t += 37) {
      const v = pulse(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(pulse(0)).toBeCloseTo(pulse(PULSE_PERIOD_MS));
  });
});

describe("fadeIn", () => {
  it("goes from transparent to opaque over the given time", () => {
    expect(fadeIn(0, 120)).toBe(0);
    expect(fadeIn(60, 120)).toBeCloseTo(0.5);
    expect(fadeIn(500, 120)).toBe(1);
  });
});

describe("celebration", () => {
  it("uses a small pool of particles that are all gone in under 900 ms", () => {
    expect(MAX_PARTICLES).toBeLessThanOrEqual(20);
    expect(CELEBRATION_MS).toBeLessThan(900);
    const burst = celebration(7);
    expect(burst.length).toBeLessThanOrEqual(MAX_PARTICLES);
    for (const p of burst) {
      expect(p.at(CELEBRATION_MS).alpha).toBe(0);
      expect(p.at(0).alpha).toBeGreaterThan(0);
    }
  });

  it("is the same burst for the same seed", () => {
    const a = celebration(3).map((p) => p.at(200));
    const b = celebration(3).map((p) => p.at(200));
    expect(a).toEqual(b);
  });
});

describe("quantize", () => {
  it("rounds to the step so a loop only re-renders when the value moves", () => {
    expect(quantize(0.43, 0.05)).toBeCloseTo(0.45);
    expect(quantize(0.42, 0.05)).toBeCloseTo(0.4);
    expect(quantize(2.4, 1)).toBe(2);
  });
});

/**
 * Speech bubbles never sit on top of each other or on name tags: the later
 * ones move up until they are clear (near the boss, an agent at the ready spot
 * and the boss used to talk over each other).
 */
import { describe, expect, it } from "vitest";
import { bubbleSize, stackBubbles, type Box } from "@/systems/bubbleLayout";

function overlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  );
}

describe("bubbleSize", () => {
  it("grows with the text and wraps long text onto more lines", () => {
    const short = bubbleSize("Hi");
    const long = bubbleSize("x".repeat(120));
    expect(short.w).toBeGreaterThanOrEqual(90);
    expect(long.w).toBeLessThanOrEqual(340);
    expect(long.h).toBeGreaterThan(short.h);
  });
});

describe("stackBubbles", () => {
  it("leaves bubbles that don't touch anything in place", () => {
    const lift = stackBubbles(
      [
        { id: "a", x: 0, y: 0, w: 100, h: 50 },
        { id: "b", x: 300, y: 0, w: 100, h: 50 },
      ],
      [],
    );
    expect(lift.get("a")).toBe(0);
    expect(lift.get("b")).toBe(0);
  });

  it("moves an overlapping bubble above the first one", () => {
    const bubbles = [
      { id: "boss", x: 0, y: 0, w: 160, h: 50 },
      { id: "agent", x: 40, y: 10, w: 120, h: 50 },
    ];
    const lift = stackBubbles(bubbles, []);
    const placed = bubbles.map((b) => ({ ...b, y: b.y + lift.get(b.id)! }));
    expect(lift.get("boss")).toBe(0);
    expect(overlap(placed[0], placed[1])).toBe(false);
  });

  it("keeps bubbles off the name tags", () => {
    const tag = { x: 30, y: 40, w: 80, h: 22 };
    const lift = stackBubbles([{ id: "a", x: 0, y: 20, w: 140, h: 50 }], [tag]);
    const placed = { x: 0, y: 20 + lift.get("a")!, w: 140, h: 50 };
    expect(overlap(placed, tag)).toBe(false);
  });

  it("clears every pair in a crowd", () => {
    const bubbles = Array.from({ length: 4 }, (_, i) => ({
      id: `b${i}`,
      x: i * 20,
      y: 0,
      w: 140,
      h: 50,
    }));
    const lift = stackBubbles(bubbles, []);
    const placed = bubbles.map((b) => ({ ...b, y: b.y + lift.get(b.id)! }));
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++)
        expect(overlap(placed[i], placed[j])).toBe(false);
  });
});

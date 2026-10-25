/**
 * Tests for the walking motion helpers of the LPC office workers: which of
 * the four sheet rows to show, which walk frame (tied to distance so feet
 * don't slide), ease-in / ease-out speed, keeping people from standing
 * inside each other and keeping name tags from overlapping. Pure TS.
 */
import { describe, expect, it } from "vitest";
import {
  WALK_FRAMES,
  WALK_STRIDE_PX,
  facingFromDelta,
  faceToward,
  pathDistances,
  separationOffsets,
  stackLabels,
  walkFrameAt,
  walkSpeedFactor,
  walkStepPx,
} from "@/systems/personMotion";

describe("facingFromDelta", () => {
  it("picks the dominant axis for clear moves in all four directions", () => {
    expect(facingFromDelta(5, 0, "down")).toBe("right");
    expect(facingFromDelta(-5, 1, "down")).toBe("left");
    expect(facingFromDelta(0, 5, "up")).toBe("down");
    expect(facingFromDelta(1, -5, "down")).toBe("up");
  });

  it("keeps the current facing for a near-diagonal move (no flicker)", () => {
    // Slightly more vertical than horizontal, but still going right
    expect(facingFromDelta(4, 4.6, "right")).toBe("right");
    expect(facingFromDelta(4.6, 4, "down")).toBe("down");
  });

  it("turns once the other axis clearly dominates", () => {
    expect(facingFromDelta(1, 5, "right")).toBe("down");
  });

  it("turns around when moving against the current facing", () => {
    expect(facingFromDelta(-3, 2.9, "right")).toBe("left");
  });

  it("keeps the facing for a tiny jitter", () => {
    expect(facingFromDelta(0.01, -0.02, "left")).toBe("left");
  });
});

describe("faceToward", () => {
  it("faces the other person", () => {
    expect(faceToward({ x: 0, y: 0 }, { x: 100, y: 20 })).toBe("right");
    expect(faceToward({ x: 0, y: 0 }, { x: -100, y: 20 })).toBe("left");
    expect(faceToward({ x: 0, y: 0 }, { x: 10, y: 80 })).toBe("down");
    expect(faceToward({ x: 0, y: 0 }, { x: 10, y: -80 })).toBe("up");
  });
});

describe("walkFrameAt", () => {
  it("advances one frame per stride of distance", () => {
    expect(walkFrameAt(0)).toBe(0);
    expect(walkFrameAt(WALK_STRIDE_PX * 0.99)).toBe(0);
    expect(walkFrameAt(WALK_STRIDE_PX)).toBe(1);
    expect(walkFrameAt(WALK_STRIDE_PX * 3.5)).toBe(3);
  });

  it("loops through the walk cycle", () => {
    expect(walkFrameAt(WALK_STRIDE_PX * WALK_FRAMES)).toBe(0);
    expect(walkFrameAt(WALK_STRIDE_PX * (WALK_FRAMES + 2))).toBe(2);
  });

  it("does not move the feet while the body stands still", () => {
    const d = 123.4;
    expect(walkFrameAt(d)).toBe(walkFrameAt(d));
  });
});

describe("walkSpeedFactor", () => {
  it("starts slow, reaches full speed mid-path and slows down at the end", () => {
    const start = walkSpeedFactor(0, 500);
    const middle = walkSpeedFactor(250, 250);
    const end = walkSpeedFactor(499, 1);

    expect(middle).toBe(1);
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(0.6);
    expect(end).toBeGreaterThan(0);
    expect(end).toBeLessThan(0.6);
  });

  it("speeds up steadily (never slower further along the ramp)", () => {
    let last = 0;
    for (let d = 0; d <= 60; d += 5) {
      const f = walkSpeedFactor(d, 1000);
      expect(f).toBeGreaterThanOrEqual(last);
      last = f;
    }
  });

  it("never stops completely, so the walker always arrives", () => {
    expect(walkSpeedFactor(0, 0)).toBeGreaterThan(0.2);
  });
});

describe("pathDistances", () => {
  const waypoints = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
  ];

  it("measures the distance walked and left along the waypoints", () => {
    expect(pathDistances(waypoints, 0, 0)).toEqual({
      traveled: 0,
      remaining: 150,
    });
    expect(pathDistances(waypoints, 1, 0.5)).toEqual({
      traveled: 125,
      remaining: 25,
    });
  });
});

describe("separationOffsets", () => {
  it("pushes two overlapping walkers apart sideways", () => {
    const offsets = separationOffsets([
      { id: "a", x: 100, y: 500, fixed: false },
      { id: "b", x: 104, y: 501, fixed: false },
    ]);
    const a = offsets.get("a")!;
    const b = offsets.get("b")!;

    expect(a.x).toBeLessThan(0);
    expect(b.x).toBeGreaterThan(0);
    // Mostly sideways: top-down 3/4 view, depth is handled by y-sorting
    expect(Math.abs(a.x)).toBeGreaterThan(Math.abs(a.y));
  });

  it("separates people standing at exactly the same spot", () => {
    const offsets = separationOffsets([
      { id: "a", x: 100, y: 500, fixed: false },
      { id: "b", x: 100, y: 500, fixed: false },
    ]);
    const gap = offsets.get("b")!.x - offsets.get("a")!.x;

    expect(Math.abs(gap)).toBeGreaterThan(10);
  });

  it("leaves seated people where they are and moves only the walker", () => {
    const offsets = separationOffsets([
      { id: "seated", x: 100, y: 500, fixed: true },
      { id: "walker", x: 108, y: 500, fixed: false },
    ]);

    expect(offsets.get("seated")).toEqual({ x: 0, y: 0 });
    expect(offsets.get("walker")!.x).toBeGreaterThan(0);
  });

  it("does nothing to people who are far enough apart", () => {
    const offsets = separationOffsets([
      { id: "a", x: 100, y: 500, fixed: false },
      { id: "b", x: 200, y: 500, fixed: false },
    ]);

    expect(offsets.get("a")).toEqual({ x: 0, y: 0 });
    expect(offsets.get("b")).toEqual({ x: 0, y: 0 });
  });

  it("changes smoothly as two people approach (no jumps)", () => {
    let last = 0;
    for (let dx = 40; dx >= 0; dx -= 1) {
      const push = separationOffsets([
        { id: "a", x: 100, y: 500, fixed: true },
        { id: "b", x: 100 + dx + 0.5, y: 500, fixed: false },
      ]).get("b")!.x;
      expect(Math.abs(push - last)).toBeLessThan(2.5);
      last = push;
    }
  });
});

describe("stackLabels", () => {
  it("keeps labels that don't overlap in place", () => {
    const lift = stackLabels([
      { id: "a", x: 100, y: 400, width: 60 },
      { id: "b", x: 300, y: 400, width: 60 },
    ]);

    expect(lift.get("a")).toBe(0);
    expect(lift.get("b")).toBe(0);
  });

  it("lifts the label of the person further back above the overlapping one", () => {
    const lift = stackLabels([
      { id: "front", x: 100, y: 420, width: 80 },
      { id: "back", x: 120, y: 410, width: 80 },
    ]);

    expect(lift.get("front")).toBe(0);
    expect(lift.get("back")!).toBeLessThan(0);
  });

  it("stacks three overlapping labels without any two colliding", () => {
    const labels = [
      { id: "a", x: 100, y: 430, width: 80 },
      { id: "b", x: 110, y: 425, width: 80 },
      { id: "c", x: 105, y: 420, width: 80 },
    ];
    const lift = stackLabels(labels, 22);
    const ys = labels.map((l) => l.y + lift.get(l.id)!).sort((p, q) => p - q);

    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(22);
    }
  });
});

describe("walkStepPx", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
  ];

  it("moves less per frame right after starting than mid-path", () => {
    const atStart = walkStepPx(path, 0, 0, 1 / 60, 150);
    const midway = walkStepPx(path, 0, 0.5, 1 / 60, 150);

    expect(midway).toBeCloseTo(150 / 60);
    expect(atStart).toBeLessThan(midway * 0.6);
  });

  it("keeps full speed when a walker is re-routed mid-walk", () => {
    const rerouted = walkStepPx(path, 0, 0, 1 / 60, 150, { easeIn: false });

    expect(rerouted).toBeCloseTo(150 / 60);
  });

  it("still slows down before the target after a re-route", () => {
    const nearEnd = walkStepPx(path, 0, 0.99, 1 / 60, 150, { easeIn: false });

    expect(nearEnd).toBeLessThan((150 / 60) * 0.6);
  });
});

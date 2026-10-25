/**
 * Tests for the office crowd layout: render offsets that keep people from
 * standing inside each other and lifts that keep name tags apart, computed
 * from the store's agents.
 */
import { describe, expect, it } from "vitest";
import { computeCrowdLayout, displayPosition } from "@/systems/crowdLayout";
import { getDeskPosition } from "@/systems/queuePositions";

type Agent =
  Parameters<typeof computeCrowdLayout>[0] extends Map<string, infer A>
    ? A
    : never;

function agent(
  id: string,
  x: number,
  y: number,
  over: Partial<Agent> = {},
): Agent {
  return {
    id,
    name: id,
    phase: "walking_to_desk",
    desk: null,
    currentPosition: { x, y },
    ...over,
  } as Agent;
}

function layout(...agents: Agent[]) {
  return computeCrowdLayout(new Map(agents.map((a) => [a.id, a])));
}

describe("computeCrowdLayout", () => {
  it("nudges two walkers on the same spot apart", () => {
    const { crowdOffsets } = layout(agent("a", 600, 600), agent("b", 600, 600));

    expect(crowdOffsets.get("a")!.x).not.toBe(crowdOffsets.get("b")!.x);
  });

  it("never moves a worker seated at the desk", () => {
    const seat = getDeskPosition(1);
    const { crowdOffsets } = layout(
      agent("seated", seat.x, seat.y, { phase: "idle", desk: 1 }),
      agent("walker", seat.x + 4, seat.y),
    );

    expect(crowdOffsets.get("seated")).toEqual({ x: 0, y: 0 });
    expect(crowdOffsets.get("walker")!.x).toBeGreaterThan(0);
  });

  it("ignores people inside the elevator", () => {
    const { crowdOffsets } = layout(agent("a", 86, 200), agent("b", 86, 200));

    expect(crowdOffsets.get("a")).toBeUndefined();
  });

  it("lifts one of two overlapping name tags", () => {
    const { labelLifts } = layout(agent("a", 600, 600), agent("b", 630, 590));
    const lifts = [labelLifts.get("a")!, labelLifts.get("b")!];

    expect(lifts).toContain(0);
    expect(Math.min(...lifts)).toBeLessThan(0);
  });
});

describe("displayPosition", () => {
  it("adds the crowd offset and the label lift", () => {
    const offsets = new Map([["a", { x: 5, y: -2 }]]);

    expect(displayPosition("a", { x: 100, y: 200 }, offsets, -24)).toEqual({
      x: 105,
      y: 174,
    });
    expect(displayPosition("z", { x: 100, y: 200 }, offsets, 0)).toEqual({
      x: 100,
      y: 200,
    });
  });
});

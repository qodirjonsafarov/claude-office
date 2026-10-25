/**
 * Tests for coffee breaks: a worker who has been sitting at the desk without
 * typing for a while walks to the coffee machine / water cooler, stays a bit
 * and walks back. Work (typing) always wins: it sends him back to the desk.
 * The planner is pure: time comes in, walk commands come out.
 */
import { describe, expect, it } from "vitest";
import {
  COFFEE_COOLDOWN_MS,
  COFFEE_IDLE_MS,
  COFFEE_SPOTS,
  COFFEE_STAY_MS,
  CoffeeBreakPlanner,
  isAtCoffeeSpot,
  type CoffeeAgent,
} from "@/systems/coffeeBreak";

const DESK = { x: 256, y: 432 };

function worker(over: Partial<CoffeeAgent> = {}): CoffeeAgent {
  return {
    id: "a",
    phase: "idle",
    position: DESK,
    desk: DESK,
    hasPath: false,
    isTyping: false,
    backendState: "working",
    ...over,
  };
}

describe("CoffeeBreakPlanner", () => {
  it("does nothing while the worker keeps typing", () => {
    const planner = new CoffeeBreakPlanner();
    for (let t = 0; t <= COFFEE_IDLE_MS * 3; t += 1000) {
      expect(planner.update(t, [worker({ isTyping: true })])).toEqual([]);
    }
  });

  it("sends a worker who hasn't typed for a while to a coffee spot", () => {
    const planner = new CoffeeBreakPlanner();
    planner.update(0, [worker()]);

    expect(planner.update(COFFEE_IDLE_MS - 1, [worker()])).toEqual([]);
    const commands = planner.update(COFFEE_IDLE_MS, [worker()]);

    expect(commands).toHaveLength(1);
    expect(commands[0].agentId).toBe("a");
    expect(COFFEE_SPOTS).toContainEqual(commands[0].target);
  });

  it("walks back to the desk after the break", () => {
    const planner = new CoffeeBreakPlanner();
    planner.update(0, [worker()]);
    const [go] = planner.update(COFFEE_IDLE_MS, [worker()]);
    const atSpot = worker({ position: go.target });

    const t = COFFEE_IDLE_MS + 3000;
    expect(planner.update(t, [atSpot])).toEqual([]);
    expect(planner.update(t + COFFEE_STAY_MS - 1, [atSpot])).toEqual([]);
    expect(planner.update(t + COFFEE_STAY_MS, [atSpot])).toEqual([
      { agentId: "a", target: DESK },
    ]);
  });

  it("goes back to the desk at once when work starts", () => {
    const planner = new CoffeeBreakPlanner();
    planner.update(0, [worker()]);
    const [go] = planner.update(COFFEE_IDLE_MS, [worker()]);
    const walking = worker({ position: { x: 600, y: 300 }, hasPath: true });

    expect(
      planner.update(COFFEE_IDLE_MS + 500, [{ ...walking, isTyping: true }]),
    ).toEqual([{ agentId: "a", target: DESK }]);
    expect(go).toBeDefined();
  });

  it("rests between breaks", () => {
    const planner = new CoffeeBreakPlanner();
    planner.update(0, [worker()]);
    const [go] = planner.update(COFFEE_IDLE_MS, [worker()]);
    let t = COFFEE_IDLE_MS + 1000;
    planner.update(t, [worker({ position: go.target })]);
    t += COFFEE_STAY_MS;
    planner.update(t, [worker({ position: go.target })]);
    // Back at the desk
    t += 3000;
    planner.update(t, [worker()]);

    expect(planner.update(t + COFFEE_IDLE_MS, [worker()])).toEqual([]);
    expect(
      planner.update(t + COFFEE_COOLDOWN_MS + COFFEE_IDLE_MS, [worker()]),
    ).toHaveLength(1);
  });

  it("gives two workers different spots", () => {
    const planner = new CoffeeBreakPlanner();
    const a = worker({ id: "a" });
    const b = worker({ id: "b", desk: { x: 512, y: 432 } });
    b.position = b.desk!;
    planner.update(0, [a, b]);
    const commands = planner.update(COFFEE_IDLE_MS, [a, b]);

    expect(commands).toHaveLength(2);
    expect(commands[0].target).not.toEqual(commands[1].target);
  });

  it("stays at the desk while waiting for the user's permission", () => {
    const planner = new CoffeeBreakPlanner();
    const waiting = worker({ backendState: "waiting_permission" });
    planner.update(0, [waiting]);

    expect(planner.update(COFFEE_IDLE_MS * 2, [waiting])).toEqual([]);
  });

  it("forgets the break when the worker leaves the office flow", () => {
    const planner = new CoffeeBreakPlanner();
    planner.update(0, [worker()]);
    const [go] = planner.update(COFFEE_IDLE_MS, [worker()]);
    const departing = worker({ phase: "departing", position: go.target });

    expect(planner.update(COFFEE_IDLE_MS + 100, [departing])).toEqual([]);
    expect(
      planner.update(COFFEE_IDLE_MS + COFFEE_STAY_MS * 2, [departing]),
    ).toEqual([]);
  });
});

describe("CoffeeBreakPlanner and permission prompts", () => {
  it("comes back from the coffee machine when the user is asked", () => {
    const planner = new CoffeeBreakPlanner();
    planner.update(0, [worker()]);
    const [go] = planner.update(COFFEE_IDLE_MS, [worker()]);
    const asked = worker({
      position: go.target,
      backendState: "waiting_permission",
    });

    expect(planner.update(COFFEE_IDLE_MS + 1000, [asked])).toEqual([
      { agentId: "a", target: DESK },
    ]);
  });

  it("turns back on the way to the machine when the user is asked", () => {
    const planner = new CoffeeBreakPlanner();
    planner.update(0, [worker()]);
    planner.update(COFFEE_IDLE_MS, [worker()]);
    const asked = worker({
      position: { x: 700, y: 300 },
      hasPath: true,
      backendState: "waiting_permission",
    });

    expect(planner.update(COFFEE_IDLE_MS + 500, [asked])).toEqual([
      { agentId: "a", target: DESK },
    ]);
  });

  it("doesn't leave for coffee right after a long permission wait", () => {
    const planner = new CoffeeBreakPlanner();
    const asked = worker({ backendState: "waiting_permission" });
    planner.update(0, [asked]);
    planner.update(COFFEE_IDLE_MS * 3, [asked]);
    const t = COFFEE_IDLE_MS * 3 + 1000;

    expect(planner.update(t, [worker()])).toEqual([]);
    expect(planner.update(t + COFFEE_IDLE_MS / 2, [worker()])).toEqual([]);
  });
});

describe("isAtCoffeeSpot", () => {
  it("recognises the coffee spots", () => {
    expect(isAtCoffeeSpot(COFFEE_SPOTS[0])).toBe(true);
    expect(isAtCoffeeSpot(DESK)).toBe(false);
  });
});

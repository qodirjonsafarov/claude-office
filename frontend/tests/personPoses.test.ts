/**
 * Tests for the state poses of the LPC office workers: gestures built from
 * the sheet's own LPC animations (spellcast, thrust), blinking, occasional
 * glances, and which stance an agent / the boss takes in each phase. Pure TS.
 */
import { describe, expect, it } from "vitest";
import {
  GESTURES,
  GREET_MS,
  agentStance,
  bossStance,
  gestureFrame,
  glanceAt,
  isBlinking,
  conversantKey,
  parseConversantKey,
  showsThinking,
  THINKING_DELAY_MS,
  thinkingDots,
} from "@/systems/personPoses";

describe("gestureFrame", () => {
  it("waves hello with raised hands, then lowers them", () => {
    const frames = new Set<number>();
    for (let t = 0; t < GREET_MS; t += 50) frames.add(gestureFrame("greet", t));

    expect(frames.has(4) || frames.has(5)).toBe(true);
    expect(gestureFrame("greet", GREET_MS + 5000)).toBe(0);
  });

  it("keeps talking in a loop", () => {
    const early = new Set<number>();
    const late = new Set<number>();
    for (let t = 0; t < 3000; t += 50) {
      early.add(gestureFrame("talk", t));
      late.add(gestureFrame("talk", t + 60_000));
    }

    expect(early.size).toBeGreaterThan(1);
    expect(late).toEqual(early);
  });

  it("hands over with the arm held out at the end", () => {
    const held = gestureFrame("handoff", 10_000);

    expect(held).toBeGreaterThan(gestureFrame("handoff", 0));
    expect(gestureFrame("handoff", 20_000)).toBe(held);
  });

  it("only uses frames that exist in the sheet animation", () => {
    for (const gesture of Object.keys(GESTURES) as Array<
      keyof typeof GESTURES
    >) {
      const { frames } = GESTURES[gesture];
      for (let t = 0; t < 8000; t += 37) {
        const f = gestureFrame(gesture, t);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThan(frames);
      }
    }
  });
});

describe("isBlinking", () => {
  it("blinks briefly every few seconds", () => {
    let blinkMs = 0;
    let blinks = 0;
    let was = false;
    for (let t = 0; t < 20_000; t += 10) {
      const now = isBlinking(t, 3);
      if (now) blinkMs += 10;
      if (now && !was) blinks++;
      was = now;
    }

    expect(blinks).toBeGreaterThanOrEqual(3);
    expect(blinks).toBeLessThanOrEqual(8);
    // Eyes are closed only a small share of the time
    expect(blinkMs / 20_000).toBeLessThan(0.08);
  });

  it("does not blink in sync for different people", () => {
    const a: boolean[] = [];
    const b: boolean[] = [];
    for (let t = 0; t < 20_000; t += 10) {
      a.push(isBlinking(t, 1));
      b.push(isBlinking(t, 2));
    }

    expect(a).not.toEqual(b);
  });
});

describe("glanceAt", () => {
  it("now and then looks to the side, mostly faces forward", () => {
    let sideways = 0;
    const seen = new Set<string | null>();
    for (let t = 0; t < 60_000; t += 100) {
      const g = glanceAt(t, 7);
      seen.add(g);
      if (g) sideways++;
    }

    expect(seen.has("left") || seen.has("right")).toBe(true);
    expect(sideways / 600).toBeLessThan(0.25);
  });
});

describe("agentStance", () => {
  const base = {
    moving: false,
    atDesk: false,
    atCoffee: false,
    msInPhase: 10_000,
  };

  it("walks whenever the agent is moving", () => {
    expect(agentStance({ ...base, phase: "idle", moving: true })).toBe("walk");
    expect(agentStance({ ...base, phase: "conversing", moving: true })).toBe(
      "walk",
    );
  });

  it("sits at the desk and stands elsewhere while working", () => {
    expect(agentStance({ ...base, phase: "idle", atDesk: true })).toBe("sit");
    expect(agentStance({ ...base, phase: "idle" })).toBe("stand");
  });

  it("drinks coffee at the coffee machine", () => {
    expect(agentStance({ ...base, phase: "idle", atCoffee: true })).toBe("sip");
  });

  it("greets on arrival in the queue, then waits", () => {
    expect(
      agentStance({ ...base, phase: "in_arrival_queue", msInPhase: 100 }),
    ).toBe("greet");
    expect(
      agentStance({ ...base, phase: "in_arrival_queue", msInPhase: GREET_MS }),
    ).toBe("stand");
  });

  it("waves from the elevator when arriving and when leaving", () => {
    expect(agentStance({ ...base, phase: "arriving" })).toBe("greet");
    expect(agentStance({ ...base, phase: "in_elevator" })).toBe("greet");
  });

  it("talks to the boss and then hands over at the boss desk", () => {
    expect(agentStance({ ...base, phase: "conversing" })).toBe("talk");
    expect(agentStance({ ...base, phase: "at_boss" })).toBe("handoff");
  });
});

describe("bossStance", () => {
  const base = { isTyping: false, backendState: "idle" as const };

  it("sits when nothing is going on", () => {
    expect(bossStance({ ...base, conversantPhase: null })).toBe("sit");
  });

  it("stands and directs while busy, never types", () => {
    expect(bossStance({ ...base, conversantPhase: null, isTyping: true })).toBe(
      "direct",
    );
    expect(
      bossStance({
        ...base,
        conversantPhase: null,
        backendState: "delegating",
      }),
    ).toBe("direct");
  });

  it("talks to the agent in front of him and hands over the task", () => {
    expect(bossStance({ ...base, conversantPhase: "conversing" })).toBe("talk");
    expect(bossStance({ ...base, conversantPhase: "at_boss" })).toBe("handoff");
  });

  it("waits for the agent to arrive before talking", () => {
    expect(bossStance({ ...base, conversantPhase: "walking_to_boss" })).toBe(
      "sit",
    );
    expect(bossStance({ ...base, conversantPhase: "at_boss" })).toBe("handoff");
  });
});

describe("thinkingDots", () => {
  it("stays hidden during short pauses between tool calls", () => {
    expect(thinkingDots(0).visible).toBe(false);
    expect(thinkingDots(THINKING_DELAY_MS - 1).visible).toBe(false);
  });

  it("shows three dots lighting up one after another", () => {
    const lit = new Set<number>();
    for (let t = THINKING_DELAY_MS; t < THINKING_DELAY_MS + 3000; t += 50) {
      const dots = thinkingDots(t);
      expect(dots.visible).toBe(true);
      lit.add(dots.lit);
    }

    expect([...lit].sort()).toEqual([0, 1, 2]);
  });
});

describe("showsThinking", () => {
  it("thinks only while the agent works on its own", () => {
    expect(showsThinking("working")).toBe(true);
    expect(showsThinking("thinking")).toBe(true);
  });

  it("does not think while waiting for the user or done", () => {
    expect(showsThinking("waiting_permission")).toBe(false);
    expect(showsThinking("waiting")).toBe(false);
    expect(showsThinking("completed")).toBe(false);
  });
});

describe("conversantKey", () => {
  const boss = { x: 640, y: 900 };
  const at = (phase: string, x: number, y: number) => ({
    phase: phase as "conversing",
    currentPosition: { x, y },
  });

  it("is empty when nobody is in front of the boss", () => {
    expect(conversantKey([at("idle", 256, 432)], boss)).toBe("");
  });

  it("names the phase and the side the boss turns to", () => {
    expect(
      parseConversantKey(conversantKey([at("conversing", 480, 930)], boss)),
    ).toEqual({ phase: "conversing", facing: "left" });
    expect(
      parseConversantKey(conversantKey([at("at_boss", 760, 868)], boss)),
    ).toEqual({ phase: "at_boss", facing: "right" });
    expect(parseConversantKey("")).toEqual({ phase: null, facing: "down" });
  });

  it("stays the same while the agent walks up (no re-render per frame)", () => {
    const a = conversantKey([at("walking_to_boss", 470, 930)], boss);
    const b = conversantKey([at("walking_to_boss", 503.7, 901.2)], boss);

    expect(a).toBe(b);
  });
});

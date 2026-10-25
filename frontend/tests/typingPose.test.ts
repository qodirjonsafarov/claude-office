/**
 * Tests for the typing / directing poses of the LPC office workers.
 *
 * Workers type with their own sprite hands: the sheets carry two generated
 * typing frames (left hand pressing, right hand pressing), and `typingPose`
 * picks which one to show. The boss never types — while busy he stands and
 * looks over the team (`bossDirectingDirection`). Pure TS, no Pixi.
 */
import { describe, expect, it } from "vitest";
import {
  TYPING_LINGER_MS,
  TYPING_STEP_MS,
  bossDirectingDirection,
  isTypingVisible,
  typingPose,
} from "@/systems/typingPose";

/** Sample the pose once per animation step over a few seconds. */
function samplePoses(ms = 4000) {
  const poses = [];
  for (let t = 0; t < ms; t += TYPING_STEP_MS) poses.push(typingPose(t));
  return poses;
}

describe("typingPose", () => {
  it("taps with the left and the right hand over time", () => {
    const pressed = new Set(samplePoses().map((p) => p.pressed));

    expect(pressed.has("left")).toBe(true);
    expect(pressed.has("right")).toBe(true);
  });

  it("has short pauses where no key is pressed", () => {
    const pressed = samplePoses().map((p) => p.pressed);

    expect(pressed).toContain(null);
  });

  it("describes only which hand presses and the body lean", () => {
    expect(Object.keys(typingPose(0)).sort()).toEqual(["bodyBob", "pressed"]);
  });

  it("leans towards the desk by at most one whole pixel", () => {
    for (const pose of samplePoses()) {
      expect([0, 1]).toContain(pose.bodyBob);
    }
  });

  it("changes pose every step, not every frame", () => {
    const start = typingPose(TYPING_STEP_MS * 3);
    const sameStep = typingPose(TYPING_STEP_MS * 3 + TYPING_STEP_MS - 1);

    expect(sameStep).toEqual(start);
  });
});

describe("isTypingVisible", () => {
  it("shows typing while the agent is using a tool", () => {
    expect(isTypingVisible(true, 0)).toBe(true);
  });

  it("keeps typing briefly after a tool ends so back-to-back tools look continuous", () => {
    expect(isTypingVisible(false, TYPING_LINGER_MS - 1)).toBe(true);
  });

  it("stops typing once the agent has been idle longer than the linger", () => {
    expect(isTypingVisible(false, TYPING_LINGER_MS)).toBe(false);
  });
});

describe("bossDirectingDirection", () => {
  /** Directions the boss faces over one cycle, sampled every 100 ms. */
  function sampleDirections(ms = 8000) {
    const dirs = [];
    for (let t = 0; t < ms; t += 100) dirs.push(bossDirectingDirection(t));
    return dirs;
  }

  it("starts by facing the team (desks are above the boss desk)", () => {
    expect(bossDirectingDirection(0)).toBe("up");
  });

  it("looks around the office: towards the team, left and right", () => {
    const dirs = new Set(sampleDirections());

    expect(dirs.has("up")).toBe(true);
    expect(dirs.has("left")).toBe(true);
    expect(dirs.has("right")).toBe(true);
  });

  it("faces the team most of the time", () => {
    const dirs = sampleDirections();
    const up = dirs.filter((d) => d === "up").length;

    expect(up / dirs.length).toBeGreaterThanOrEqual(0.4);
  });
});

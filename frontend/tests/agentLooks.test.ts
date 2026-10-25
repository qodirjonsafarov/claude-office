/**
 * Tests for picking a character look by agent role: each known subagent type
 * has a fixed look, unknown types get a stable one from the rest, and two
 * agents with the same role at once never look alike (the second wears the
 * "-alt" sheet: same outfit, a different person). Pure TS.
 */
import { describe, expect, it } from "vitest";
import {
  ALL_SHEETS,
  OTHER_LOOKS,
  assignLooks,
  baseLook,
} from "@/systems/agentLooks";

function agent(id: string, agentType: string | null, number: number) {
  return { id, agentType, name: id, number };
}

describe("baseLook", () => {
  it("gives each team role its own fixed look", () => {
    expect(baseLook("developer", "x")).toBe("blue");
    expect(baseLook("qa", "x")).toBe("purple");
    expect(baseLook("reviewer", "x")).toBe("yellow");
    expect(baseLook("devops", "x")).toBe("teal");
  });

  it("gives the built-in agent types the remaining looks", () => {
    expect(baseLook("Explore", "x")).toBe("green");
    expect(baseLook("Plan", "x")).toBe("pink");
    expect(baseLook("general-purpose", "x")).toBe("orange");
    expect(baseLook("claude", "x")).toBe("red");
  });

  it("ignores the case of the type", () => {
    expect(baseLook("Developer", "x")).toBe("blue");
    expect(baseLook("explore", "x")).toBe("green");
  });

  it("gives an unknown type a stable look from the remaining ones", () => {
    const look = baseLook("data-scientist", "x");

    expect(OTHER_LOOKS).toContain(look);
    expect(baseLook("data-scientist", "y")).toBe(look);
  });

  it("falls back to the agent's name when there is no type", () => {
    const look = baseLook(null, "Fix login");

    expect(OTHER_LOOKS).toContain(look);
    expect(baseLook(undefined, "Fix login")).toBe(look);
  });
});

describe("assignLooks", () => {
  it("uses the role's look for a single agent", () => {
    const looks = assignLooks([agent("a", "developer", 1)], new Map());

    expect(looks.get("a")).toBe("blue");
  });

  it("dresses a second agent with the same role as a different person", () => {
    const looks = assignLooks(
      [agent("b", "developer", 2), agent("a", "developer", 1)],
      new Map(),
    );

    expect(looks.get("a")).toBe("blue");
    expect(looks.get("b")).toBe("blue-alt");
  });

  it("never gives two agents present at once the same sheet", () => {
    const team = Array.from({ length: 6 }, (_, i) =>
      agent(`d${i}`, "developer", i + 1),
    );
    const sheets = [...assignLooks(team, new Map()).values()];

    expect(new Set(sheets).size).toBe(sheets.length);
    for (const sheet of sheets) expect(ALL_SHEETS).toContain(sheet);
  });

  it("keeps an agent's look for its whole stay", () => {
    const first = assignLooks(
      [agent("a", "qa", 1), agent("b", "qa", 2)],
      new Map(),
    );
    // "a" leaves; "b" must not suddenly change into "a"'s look
    const later = assignLooks([agent("b", "qa", 2)], first);

    expect(later.get("b")).toBe(first.get("b"));
  });

  it("forgets agents that left", () => {
    const first = assignLooks([agent("a", "qa", 1)], new Map());
    const later = assignLooks([agent("c", "devops", 3)], first);

    expect(later.has("a")).toBe(false);
  });

  it("lets a newcomer reuse a look freed by an agent who left", () => {
    const first = assignLooks([agent("a", "qa", 1)], new Map());
    const later = assignLooks([agent("c", "qa", 3)], first);

    expect(later.get("c")).toBe("purple");
  });
});

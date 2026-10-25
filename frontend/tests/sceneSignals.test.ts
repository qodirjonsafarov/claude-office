/**
 * Tests for the scene signals: per-person facts taken from the event log
 * (last activity, last error, current tool) and the "mood" a character shows
 * (needs you > error > sleeping > normal). Pure TS.
 */
import { describe, expect, it } from "vitest";
import {
  ERROR_SHOW_MS,
  SLEEP_AFTER_MS,
  SceneSignalsCache,
  characterMood,
  sceneSignals,
  toolKind,
  toolKindFromIcon,
} from "@/systems/sceneSignals";

const t = (ms: number) => new Date(ms);

function event(
  type: string,
  agentId: string | null,
  ms: number,
  detail?: Record<string, unknown>,
) {
  return { id: `${type}-${ms}`, type, agentId, timestamp: t(ms), detail };
}

describe("toolKind", () => {
  it("sorts tools into the scene's kinds", () => {
    expect(toolKind("Read")).toBe("read");
    expect(toolKind("Grep")).toBe("read");
    expect(toolKind("Glob")).toBe("read");
    expect(toolKind("Edit")).toBe("edit");
    expect(toolKind("Write")).toBe("edit");
    expect(toolKind("Bash")).toBe("terminal");
    expect(toolKind("WebFetch")).toBe("web");
    expect(toolKind("WebSearch")).toBe("web");
    expect(toolKind("mcp__firefox__navigate_page")).toBe("web");
    expect(toolKind("Task")).toBe("task");
    expect(toolKind("Agent")).toBe("task");
    expect(toolKind("TodoWrite")).toBe("other");
    expect(toolKind(null)).toBe("other");
  });

  it("reads the kind from the backend's bubble emoji too", () => {
    expect(toolKindFromIcon("📖")).toBe("read");
    expect(toolKindFromIcon("🔎")).toBe("read");
    expect(toolKindFromIcon("📝")).toBe("edit");
    expect(toolKindFromIcon("✍️")).toBe("edit");
    expect(toolKindFromIcon("💻")).toBe("terminal");
    expect(toolKindFromIcon("🌐")).toBe("web");
    expect(toolKindFromIcon("📥")).toBe("web");
    expect(toolKindFromIcon("🎯")).toBe("task");
    expect(toolKindFromIcon("✅")).toBe("done");
    expect(toolKindFromIcon("check")).toBe("done");
    expect(toolKindFromIcon("💬")).toBeNull();
    expect(toolKindFromIcon(undefined)).toBeNull();
  });
});

describe("sceneSignals", () => {
  // The event log is newest first
  const log = [
    event("post_tool_use", "a", 9_000, {
      toolName: "Bash",
      errorType: "exit 1",
    }),
    event("pre_tool_use", "a", 8_000, { toolName: "Bash" }),
    event("pre_tool_use", "main", 7_000, { toolName: "Read" }),
    event("pre_tool_use", "a", 2_000, { toolName: "Edit" }),
    event("error", null, 1_000),
  ];

  it("remembers each person's last activity", () => {
    const signals = sceneSignals(log);

    expect(signals.get("a")?.lastEventAt).toBe(9_000);
    expect(signals.get("boss")?.lastEventAt).toBe(7_000);
  });

  it("remembers the current tool (the latest call)", () => {
    const signals = sceneSignals(log);

    expect(signals.get("a")?.tool).toBe("terminal");
    expect(signals.get("boss")?.tool).toBe("read");
  });

  it("remembers the last failure", () => {
    const signals = sceneSignals(log);

    expect(signals.get("a")?.lastErrorAt).toBe(9_000);
    expect(signals.get("boss")?.lastErrorAt).toBe(1_000);
  });

  it("knows when anything last happened in the office", () => {
    expect(sceneSignals(log).get("*")?.lastEventAt).toBe(9_000);
  });
});

describe("characterMood", () => {
  const calm = {
    backendState: "working",
    now: 100_000,
    lastEventAt: 99_000,
    lastErrorAt: null,
  };

  it("is normal while working", () => {
    expect(characterMood(calm)).toBe("normal");
  });

  it("needs you while waiting for the user's permission", () => {
    expect(characterMood({ ...calm, backendState: "waiting_permission" })).toBe(
      "needs_you",
    );
  });

  it("shows a fresh error briefly", () => {
    expect(characterMood({ ...calm, lastErrorAt: 99_500 })).toBe("error");
    expect(
      characterMood({ ...calm, lastErrorAt: 100_000 - ERROR_SHOW_MS - 1 }),
    ).toBe("normal");
  });

  it("falls asleep after five quiet minutes", () => {
    expect(
      characterMood({ ...calm, lastEventAt: 100_000 - SLEEP_AFTER_MS }),
    ).toBe("sleeping");
    expect(SLEEP_AFTER_MS).toBe(5 * 60_000);
  });

  it("sleeps while resting after finishing a task", () => {
    expect(characterMood({ ...calm, backendState: "resting" })).toBe(
      "sleeping",
    );
  });

  it("puts needing you above everything else", () => {
    expect(
      characterMood({
        ...calm,
        backendState: "waiting_permission",
        lastErrorAt: 99_900,
        lastEventAt: 0,
      }),
    ).toBe("needs_you");
  });

  it("never sleeps without having seen any event yet", () => {
    expect(characterMood({ ...calm, lastEventAt: null })).toBe("normal");
  });
});

describe("failing", () => {
  it("is on while the latest tool result failed", () => {
    const log = [
      event("post_tool_use", "a", 3_000, { toolName: "Bash", errorType: "x" }),
      event("post_tool_use", "a", 2_000, { toolName: "Bash" }),
    ];
    expect(sceneSignals(log).get("a")?.failing).toBe(true);
  });

  it("clears once a later tool call succeeds", () => {
    const log = [
      event("post_tool_use", "a", 3_000, { toolName: "Bash" }),
      event("post_tool_use", "a", 2_000, { toolName: "Bash", errorType: "x" }),
    ];
    expect(sceneSignals(log).get("a")?.failing).toBe(false);
  });
});

describe("SceneSignalsCache", () => {
  it("hands back the same object for a person whose signals didn't change", () => {
    const cache = new SceneSignalsCache();
    const a = event("pre_tool_use", "a", 1_000, { toolName: "Read" });
    const first = cache.compute([a]);
    const second = cache.compute([
      event("pre_tool_use", "b", 2_000, { toolName: "Bash" }),
      a,
    ]);

    expect(second.get("a")).toBe(first.get("a"));
    expect(second.get("b")).not.toBe(first.get("b"));
  });

  it("gives a new object once the person's signals change", () => {
    const cache = new SceneSignalsCache();
    const first = cache.compute([
      event("pre_tool_use", "a", 1_000, { toolName: "Read" }),
    ]);
    const second = cache.compute([
      event("pre_tool_use", "a", 3_000, { toolName: "Bash" }),
      event("pre_tool_use", "a", 1_000, { toolName: "Read" }),
    ]);

    expect(second.get("a")).not.toBe(first.get("a"));
    expect(second.get("a")?.tool).toBe("terminal");
  });
});

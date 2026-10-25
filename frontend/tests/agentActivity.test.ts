/**
 * "What each agent is doing now": plain-language actions, the progress bar
 * model (real numbers only when the backend sends them), tool counts per
 * agent and short durations.
 */
import { describe, expect, it } from "vitest";
import {
  agentRunTimes,
  describeAction,
  describeTool,
  formatDuration,
  lastToolByAgent,
  parseProgress,
  progressView,
  toolCountsByAgent,
} from "../src/utils/agentActivity";

describe("describeTool", () => {
  it("names the file being edited", () => {
    expect(describeTool("Edit", { file_path: "/a/src/utils/api.ts" })).toBe(
      "Editing api.ts",
    );
  });

  it("names the file being written", () => {
    expect(describeTool("Write", { file_path: "notes.md" })).toBe(
      "Writing notes.md",
    );
  });

  it("names the file being read", () => {
    expect(describeTool("Read", { file_path: "/x/page.tsx" })).toBe(
      "Reading page.tsx",
    );
  });

  it("recognises a test run in Bash", () => {
    expect(describeTool("Bash", { command: "cd fe && npm test" })).toBe(
      "Running tests",
    );
    expect(describeTool("Bash", { command: "uv run pytest -q" })).toBe(
      "Running tests",
    );
  });

  it("recognises a build or typecheck", () => {
    expect(describeTool("Bash", { command: "npm run typecheck" })).toBe(
      "Checking types",
    );
    expect(describeTool("Bash", { command: "npm run build" })).toBe("Building");
  });

  it("recognises git", () => {
    expect(describeTool("Bash", { command: "git status --short" })).toBe(
      "Using git",
    );
  });

  it("names other commands by their program", () => {
    expect(describeTool("Bash", { command: "ls -la /tmp" })).toBe("Running ls");
  });

  it("describes searches", () => {
    expect(describeTool("Grep", { pattern: "foo" })).toBe("Searching code");
    expect(describeTool("WebSearch", { query: "x" })).toBe("Searching the web");
  });

  it("falls back to the tool name", () => {
    expect(describeTool("mcp__figma__get", {})).toBe("Using mcp__figma__get");
  });
});

describe("describeAction", () => {
  const tool = { name: "Edit", input: { file_path: "api.ts" } };

  it("says waiting for permission first", () => {
    expect(
      describeAction({ state: "waiting_permission", isTyping: true, tool }),
    ).toBe("Waiting for permission");
  });

  it("uses the current tool while working", () => {
    expect(describeAction({ state: "working", isTyping: true, tool })).toBe(
      "Editing api.ts",
    );
  });

  it("says thinking", () => {
    expect(
      describeAction({ state: "thinking", isTyping: false, tool: null }),
    ).toBe("Thinking");
  });

  it("says working without a known tool", () => {
    expect(
      describeAction({ state: "working", isTyping: false, tool: null }),
    ).toBe("Working");
  });

  it("describes the walk and the report", () => {
    expect(
      describeAction({ state: "walking_to_desk", isTyping: false, tool }),
    ).toBe("Walking to desk");
    expect(describeAction({ state: "reporting", isTyping: false, tool })).toBe(
      "Reporting back",
    );
  });

  it("describes the boss handing work out", () => {
    expect(describeAction({ state: "delegating", isTyping: false, tool })).toBe(
      "Delegating",
    );
  });

  it("says idle when idle", () => {
    expect(describeAction({ state: "idle", isTyping: false, tool })).toBe(
      "Idle",
    );
  });
});

describe("parseProgress", () => {
  it("reads the backend progress object", () => {
    expect(
      parseProgress({
        done: 3,
        total: 5,
        current: "Run tests",
        source: "todos",
      }),
    ).toEqual({ done: 3, total: 5, current: "Run tests", source: "todos" });
  });

  it("returns null when absent or malformed", () => {
    expect(parseProgress(undefined)).toBeNull();
    expect(parseProgress(null)).toBeNull();
    expect(parseProgress({ done: "3", total: 5 })).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(parseProgress({ done: 0, total: 0, source: "todos" })).toBeNull();
  });

  it("clamps done to total", () => {
    expect(parseProgress({ done: 7, total: 5 })?.done).toBe(5);
  });
});

describe("progressView", () => {
  const progress = {
    done: 3,
    total: 5,
    current: "Running tests",
    source: "todos" as const,
  };

  it("shows a real bar with the current item and counts", () => {
    expect(progressView(progress, "working", "Editing api.ts")).toEqual({
      kind: "bar",
      percent: 60,
      label: "Running tests · 3/5",
    });
  });

  it("uses the action when there is no current item", () => {
    expect(
      progressView({ ...progress, current: null }, "working", "Editing api.ts"),
    ).toMatchObject({ label: "Editing api.ts · 3/5" });
  });

  it("never invents a number without progress data", () => {
    expect(progressView(null, "working", "Working")).toEqual({ kind: "busy" });
  });

  it("shows the waiting state for a permission request", () => {
    expect(progressView(progress, "waiting_permission", "x")).toEqual({
      kind: "wait",
    });
  });

  it("shows nothing for an idle person without data", () => {
    expect(progressView(null, "idle", "Idle")).toEqual({ kind: "none" });
  });

  it("says done when everything is checked off", () => {
    expect(
      progressView({ ...progress, done: 5 }, "working", "x"),
    ).toMatchObject({ kind: "bar", percent: 100 });
  });
});

describe("toolCountsByAgent / lastToolByAgent", () => {
  // The log is newest first, like the store's eventLog.
  const log = [
    {
      type: "pre_tool_use",
      agentId: "a1",
      detail: { toolName: "Bash", toolInput: { command: "npm test" } },
    },
    { type: "post_tool_use", agentId: "a1", detail: { toolName: "Edit" } },
    {
      type: "pre_tool_use",
      agentId: "a1",
      detail: { toolName: "Edit", toolInput: { file_path: "a.ts" } },
    },
    { type: "pre_tool_use", agentId: "main", detail: { toolName: "Read" } },
    { type: "pre_tool_use", agentId: "", detail: { toolName: "Grep" } },
  ];

  it("counts tool calls per agent, boss under 'boss'", () => {
    const counts = toolCountsByAgent(log);
    expect(counts.get("a1")).toBe(2);
    expect(counts.get("boss")).toBe(2);
  });

  it("finds each agent's latest tool", () => {
    const last = lastToolByAgent(log);
    expect(last.get("a1")?.name).toBe("Bash");
    expect(last.get("boss")?.name).toBe("Read");
  });
});

describe("agentRunTimes", () => {
  it("maps agents to their start time", () => {
    const starts = agentRunTimes([
      {
        agentId: "a1",
        agentName: "A",
        color: "x",
        startTime: "2026-10-26T10:00:00Z",
      },
    ]);
    expect(starts.get("a1")).toBe(Date.parse("2026-10-26T10:00:00Z"));
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(35_000)).toBe("35s");
    expect(formatDuration(4 * 60_000 + 10_000)).toBe("4m");
    expect(formatDuration(65 * 60_000)).toBe("1h 5m");
  });

  it("clamps negatives to zero", () => {
    expect(formatDuration(-5)).toBe("0s");
  });
});

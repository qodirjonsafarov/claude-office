/**
 * The event log quick filter: text search, one person at a time, and kinds
 * (tools / errors / permissions); agent ids shown as names.
 */
import { describe, expect, it } from "vitest";
import {
  agentNames,
  eventKind,
  filterEvents,
  logPeople,
  personLabel,
} from "../src/utils/eventFilter";

const names = new Map([
  ["a5a60c7f-1", "Reviewer"],
  ["b2", "Tester"],
]);

const log = [
  {
    id: "1",
    type: "pre_tool_use",
    agentId: "a5a60c7f-1",
    summary: "Edit api.ts",
    detail: { toolName: "Edit" },
  },
  { id: "2", type: "error", agentId: "b2", summary: "Tests failed" },
  {
    id: "3",
    type: "permission_request",
    agentId: "main",
    summary: "Bash: rm -rf build",
  },
  { id: "4", type: "stop", agentId: "", summary: "Finished" },
  {
    id: "5",
    type: "post_tool_use",
    agentId: "b2",
    summary: "Bash done",
    detail: { toolName: "Bash", errorType: "exit_code" },
  },
];

const ids = (events: { id: string }[]) => events.map((e) => e.id);

describe("eventKind", () => {
  it("sorts events into tools, errors and permissions", () => {
    expect(eventKind(log[0]!)).toBe("tools");
    expect(eventKind(log[1]!)).toBe("errors");
    expect(eventKind(log[2]!)).toBe("permissions");
    expect(eventKind(log[3]!)).toBe("other");
  });

  it("counts a failed tool as an error", () => {
    expect(eventKind(log[4]!)).toBe("errors");
  });
});

describe("filterEvents", () => {
  const all = { query: "", person: "all", kinds: new Set<string>() };

  it("keeps everything with no filter", () => {
    expect(ids(filterEvents(log, all, names))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
  });

  it("searches the summary, case-insensitively", () => {
    expect(ids(filterEvents(log, { ...all, query: "TESTS" }, names))).toEqual([
      "2",
    ]);
  });

  it("searches agent names", () => {
    expect(
      ids(filterEvents(log, { ...all, query: "reviewer" }, names)),
    ).toEqual(["1"]);
  });

  it("searches the tool name", () => {
    expect(ids(filterEvents(log, { ...all, query: "bash" }, names))).toEqual([
      "3",
      "5",
    ]);
  });

  it("shows only the boss", () => {
    expect(ids(filterEvents(log, { ...all, person: "boss" }, names))).toEqual([
      "3",
      "4",
    ]);
  });

  it("shows only one agent", () => {
    expect(ids(filterEvents(log, { ...all, person: "b2" }, names))).toEqual([
      "2",
      "5",
    ]);
  });

  it("combines kinds", () => {
    expect(
      ids(
        filterEvents(
          log,
          { ...all, kinds: new Set(["errors", "permissions"]) },
          names,
        ),
      ),
    ).toEqual(["2", "3", "5"]);
  });
});

describe("names", () => {
  it("labels agent ids with names, the boss as Boss", () => {
    expect(personLabel("a5a60c7f-1", names)).toBe("Reviewer");
    expect(personLabel("main", names)).toBe("Boss");
    expect(personLabel(null, names)).toBe("Boss");
  });

  it("shortens unknown ids", () => {
    expect(personLabel("ffffffff-9999", names)).toBe("ffffff…");
  });

  it("builds names from present agents and past lifespans", () => {
    const map = agentNames(
      [{ id: "a1", name: "Now", number: 1 }],
      [
        { agentId: "a0", agentName: "Gone", color: "", startTime: "" },
        { agentId: "a1", agentName: "Old name", color: "", startTime: "" },
      ],
    );
    expect(map.get("a0")).toBe("Gone");
    expect(map.get("a1")).toBe("Now");
  });

  it("lists the agents that appear in the log, in order of first event", () => {
    expect(logPeople(log)).toEqual(["b2", "a5a60c7f-1"]);
  });
});

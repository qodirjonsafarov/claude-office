/**
 * Grouping the session list by project (shared by the desktop sidebar and
 * the phone sessions sheet).
 */
import { describe, expect, it } from "vitest";
import {
  getProjectKey,
  groupSessionsByProject,
} from "../src/utils/sessionGroups";
import type { Session } from "../src/hooks/useSessions";

function session(over: Partial<Session>): Session {
  return {
    id: "s",
    label: null,
    displayName: null,
    projectName: null,
    projectRoot: null,
    createdAt: "2026-10-26T10:00:00Z",
    updatedAt: "2026-10-26T10:00:00Z",
    status: "completed",
    eventCount: 1,
    floorId: null,
    roomId: null,
    ...over,
  };
}

describe("getProjectKey", () => {
  it("prefers the project name, then the folder name", () => {
    expect(getProjectKey(session({ projectName: "office" }))).toBe("office");
    expect(getProjectKey(session({ projectRoot: "/home/x/olymp" }))).toBe(
      "olymp",
    );
    expect(getProjectKey(session({}))).toBe("unknown");
  });
});

describe("groupSessionsByProject", () => {
  it("puts groups with an active session first, active sessions first inside", () => {
    const groups = groupSessionsByProject([
      session({
        id: "a1",
        projectName: "a",
        updatedAt: "2026-10-26T12:00:00Z",
      }),
      session({ id: "b1", projectName: "b", status: "active" }),
      session({
        id: "b2",
        projectName: "b",
        updatedAt: "2026-10-26T13:00:00Z",
      }),
    ]);
    expect([...groups.keys()]).toEqual(["b", "a"]);
    expect(groups.get("b")?.map((s) => s.id)).toEqual(["b1", "b2"]);
  });
});

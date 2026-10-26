/**
 * Which session the office shows by itself: the most recently active running
 * session on load (also after a backend restart / on a fresh device), the
 * next running one when the shown session ends, and never away from a
 * session the user picked unless it ended.
 */
import { describe, expect, it } from "vitest";
import { AUTO_SWITCH_IDLE_MS, pickSession } from "../src/utils/sessionPick";
import { splitSessionGroup } from "../src/utils/sessionGroups";
import type { Session } from "../src/hooks/useSessions";

const NOW = Date.parse("2026-10-26T18:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function session(over: Partial<Session>): Session {
  return {
    id: "s",
    label: null,
    displayName: null,
    projectName: "p",
    projectRoot: null,
    createdAt: ago(3_600_000),
    updatedAt: ago(0),
    status: "active",
    eventCount: 1,
    floorId: null,
    roomId: null,
    ...over,
  };
}

const pick = (
  sessions: Session[],
  currentId: string,
  opts: { manual?: boolean; currentWasLive?: boolean } = {},
) =>
  pickSession({
    sessions,
    currentId,
    manual: opts.manual ?? false,
    currentWasLive: opts.currentWasLive ?? true,
    now: NOW,
  });

describe("pickSession: first load", () => {
  it("picks the running session with the most recent activity", () => {
    const sessions = [
      // The long-running one with many events is stale; the other is live now.
      session({ id: "old", eventCount: 3000, updatedAt: ago(2 * 3_600_000) }),
      session({ id: "new", eventCount: 20, updatedAt: ago(5_000) }),
      session({ id: "done", status: "completed", updatedAt: ago(1_000) }),
    ];
    expect(pick(sessions, "")).toBe("new");
  });

  it("falls back to the newest ended session when nothing runs", () => {
    const sessions = [
      session({ id: "a", status: "completed", updatedAt: ago(60_000) }),
      session({ id: "b", status: "completed", updatedAt: ago(1_000) }),
    ];
    expect(pick(sessions, "")).toBe("b");
  });

  it("keeps waiting while the list is empty", () => {
    expect(pick([], "")).toBeNull();
  });

  it("replaces a session that is not in the list (deleted, placeholder)", () => {
    const sessions = [session({ id: "live" })];
    expect(pick(sessions, "sim_session_123", { manual: true })).toBe("live");
  });
});

describe("pickSession: following", () => {
  it("moves to a running session when the shown one ends", () => {
    const sessions = [
      session({ id: "cur", status: "completed", updatedAt: ago(1_000) }),
      session({ id: "next", updatedAt: ago(30_000) }),
    ];
    expect(pick(sessions, "cur")).toBe("next");
  });

  it("moves on when a manually picked session ends", () => {
    const sessions = [
      session({ id: "cur", status: "completed" }),
      session({ id: "next" }),
    ];
    expect(pick(sessions, "cur", { manual: true })).toBe("next");
  });

  it("stays on an ended session when nothing else runs", () => {
    const sessions = [session({ id: "cur", status: "completed" })];
    expect(pick(sessions, "cur")).toBeNull();
  });

  it("stays on an old ended session the user opened on purpose", () => {
    const sessions = [
      session({
        id: "history",
        status: "completed",
        updatedAt: ago(86_400_000),
      }),
      session({ id: "live" }),
    ];
    expect(
      pick(sessions, "history", { manual: true, currentWasLive: false }),
    ).toBeNull();
  });

  it("auto mode moves to a newer running session once the shown one idles", () => {
    const sessions = [
      session({ id: "cur", updatedAt: ago(AUTO_SWITCH_IDLE_MS + 1_000) }),
      session({ id: "busy", updatedAt: ago(2_000) }),
    ];
    expect(pick(sessions, "cur")).toBe("busy");
  });

  it("auto mode does not flip between two busy sessions", () => {
    const sessions = [
      session({ id: "cur", updatedAt: ago(20_000) }),
      session({ id: "busy", updatedAt: ago(2_000) }),
    ];
    expect(pick(sessions, "cur")).toBeNull();
  });

  it("never leaves a running session the user picked", () => {
    const sessions = [
      session({ id: "cur", updatedAt: ago(AUTO_SWITCH_IDLE_MS * 10) }),
      session({ id: "busy", updatedAt: ago(2_000) }),
    ];
    expect(pick(sessions, "cur", { manual: true })).toBeNull();
  });
});

describe("splitSessionGroup", () => {
  it("shows every running session as a card and folds the ended ones", () => {
    const { cards, older } = splitSessionGroup([
      session({ id: "r1" }),
      session({ id: "r2" }),
      session({ id: "e1", status: "completed" }),
    ]);
    expect(cards.map((s) => s.id)).toEqual(["r1", "r2"]);
    expect(older.map((s) => s.id)).toEqual(["e1"]);
  });

  it("shows the newest ended session as the card when none runs", () => {
    const { cards, older } = splitSessionGroup([
      session({ id: "e1", status: "completed" }),
      session({ id: "e2", status: "completed" }),
    ]);
    expect(cards.map((s) => s.id)).toEqual(["e1"]);
    expect(older.map((s) => s.id)).toEqual(["e2"]);
  });
});

/**
 * The event log is filled from the backend's history on (re)connect and
 * never shows an event twice when the live stream sends it again.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "../src/stores/gameStore";
import type { EventType } from "../src/types";

function ev(n: number, type: EventType = "pre_tool_use") {
  return {
    id: String(1000 + n),
    type,
    agentId: "main",
    summary: `event ${n}`,
    timestamp: new Date(Date.UTC(2026, 9, 26, 2, 0, n)).toISOString(),
    detail: {},
  };
}

beforeEach(() => {
  useGameStore.setState({ eventLog: [] });
});

describe("mergeEventHistory", () => {
  it("fills an empty log newest first", () => {
    useGameStore.getState().mergeEventHistory([ev(1), ev(2), ev(3)]);
    expect(useGameStore.getState().eventLog.map((e) => e.summary)).toEqual([
      "event 3",
      "event 2",
      "event 1",
    ]);
  });

  it("keeps only the newest 200 history entries", () => {
    const history = Array.from({ length: 260 }, (_, i) => ev(i));
    useGameStore.getState().mergeEventHistory(history);
    const log = useGameStore.getState().eventLog;
    expect(log).toHaveLength(200);
    expect(log[0]?.summary).toBe("event 259");
  });

  it("does not duplicate events already in the log", () => {
    const { addEventLog, mergeEventHistory } = useGameStore.getState();
    addEventLog(ev(2));
    mergeEventHistory([ev(1), ev(2), ev(3)]);
    expect(useGameStore.getState().eventLog).toHaveLength(3);
  });

  it("leaves the log untouched when nothing is new", () => {
    const { mergeEventHistory } = useGameStore.getState();
    mergeEventHistory([ev(1)]);
    const before = useGameStore.getState().eventLog;
    mergeEventHistory([ev(1)]);
    expect(useGameStore.getState().eventLog).toBe(before);
  });
});

describe("addEventLog", () => {
  it("skips a live event that the history already brought", () => {
    const { addEventLog, mergeEventHistory } = useGameStore.getState();
    mergeEventHistory([ev(1)]);
    addEventLog(ev(1));
    expect(useGameStore.getState().eventLog).toHaveLength(1);
  });

  it("fills in the detail when the live copy has more", () => {
    const { addEventLog, mergeEventHistory } = useGameStore.getState();
    mergeEventHistory([ev(1)]);
    addEventLog({ ...ev(1), detail: { toolName: "Bash" } });
    expect(useGameStore.getState().eventLog[0]?.detail?.toolName).toBe("Bash");
  });
});

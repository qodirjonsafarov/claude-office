/**
 * A finished agent rests in the office (backend state "resting"); the store
 * keeps when it started resting, so the Team panel can say "resting 3m".
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/stores/gameStore";

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("restingSince in the store", () => {
  it("is parsed when the agent is added", () => {
    useGameStore.getState().addAgent(
      {
        id: "a",
        color: "#3b82f6",
        number: 1,
        state: "resting",
        restingSince: "2026-10-26T12:00:00Z",
      },
      { x: 0, y: 0 },
    );

    expect(useGameStore.getState().agents.get("a")?.restingSince).toBe(
      Date.parse("2026-10-26T12:00:00Z"),
    );
  });

  it("follows the backend on later updates and clears on recall", () => {
    const store = useGameStore.getState();
    store.addAgent(
      { id: "a", color: "#3b82f6", number: 1, state: "working" },
      { x: 0, y: 0 },
    );
    store.updateAgentMeta("a", {
      backendState: "resting",
      name: "A",
      currentTask: null,
      restingSince: "2026-10-26T12:00:00Z",
    });
    expect(useGameStore.getState().agents.get("a")?.restingSince).toBe(
      Date.parse("2026-10-26T12:00:00Z"),
    );

    store.updateAgentMeta("a", {
      backendState: "working",
      name: "A",
      currentTask: null,
      restingSince: null,
    });
    expect(useGameStore.getState().agents.get("a")?.restingSince).toBeNull();
  });
});

describe("waitingSince in the store", () => {
  it("starts when the agent starts waiting for permission and clears after", () => {
    const store = useGameStore.getState();
    store.addAgent(
      { id: "w", color: "#3b82f6", number: 1, state: "working" },
      { x: 0, y: 0 },
    );
    expect(useGameStore.getState().agents.get("w")?.waitingSince).toBeNull();

    const before = Date.now();
    store.updateAgentMeta("w", {
      backendState: "waiting_permission",
      name: "W",
      currentTask: null,
    });
    const since = useGameStore.getState().agents.get("w")?.waitingSince ?? 0;
    expect(since).toBeGreaterThanOrEqual(before);

    // Still waiting: the start time stays
    store.updateAgentMeta("w", {
      backendState: "waiting_permission",
      name: "W",
      currentTask: null,
    });
    expect(useGameStore.getState().agents.get("w")?.waitingSince).toBe(since);

    store.updateAgentMeta("w", {
      backendState: "working",
      name: "W",
      currentTask: null,
    });
    expect(useGameStore.getState().agents.get("w")?.waitingSince).toBeNull();
  });

  it("tracks the boss's wait too", () => {
    const store = useGameStore.getState();
    store.updateBossBackendState("waiting_permission");
    expect(useGameStore.getState().boss.waitingSince).not.toBeNull();
    store.updateBossBackendState("working");
    expect(useGameStore.getState().boss.waitingSince).toBeNull();
  });
});

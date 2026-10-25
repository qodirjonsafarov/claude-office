/**
 * The agent's type from the backend is kept in the frontend store, so the
 * office can dress the character by role (systems/agentLooks.ts).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "@/stores/gameStore";

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("agentType in the store", () => {
  it("keeps the backend agent type", () => {
    useGameStore.getState().addAgent(
      {
        id: "a",
        color: "#3b82f6",
        number: 1,
        state: "arriving",
        agentType: "developer",
      },
      { x: 0, y: 0 },
    );

    expect(useGameStore.getState().agents.get("a")?.agentType).toBe(
      "developer",
    );
  });

  it("is null when the backend doesn't know the type", () => {
    useGameStore
      .getState()
      .addAgent(
        { id: "b", color: "#3b82f6", number: 1, state: "arriving" },
        { x: 0, y: 0 },
      );

    expect(useGameStore.getState().agents.get("b")?.agentType).toBeNull();
  });
});

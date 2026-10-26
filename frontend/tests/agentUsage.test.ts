/**
 * Per-agent tokens and cost on the agent card: the boss reads
 * `boss.tokenUsage`, each agent its own `agents[i].tokenUsage`; an agent
 * whose transcript is not known yet (null) shows a dash, never zero.
 */
import { describe, expect, it } from "vitest";
import { agentUsageMap, cardUsage } from "../src/utils/tokenUsage";

const usage = (input: number, costUsd: number | null) => ({
  inputTokens: input,
  outputTokens: 500,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  model: "claude-opus-5-5",
  costUsd,
  costInputUsd: 0,
  costOutputUsd: 0,
  costCacheReadUsd: 0,
  costCacheWriteUsd: 0,
});

describe("agentUsageMap", () => {
  it("keys the boss and every agent with usage", () => {
    const map = agentUsageMap({
      boss: { tokenUsage: usage(41_500, 1.2) },
      agents: [
        { id: "a1", tokenUsage: usage(9_500, 0.31) },
        { id: "a2", tokenUsage: null },
        { id: "a3" },
      ],
    });
    expect(map.get("boss")?.total).toBe(42_000);
    expect(map.get("a1")?.total).toBe(10_000);
    expect(map.has("a2")).toBe(false);
    expect(map.has("a3")).toBe(false);
  });
});

describe("cardUsage", () => {
  it("shows a dash for both numbers while the usage is unknown", () => {
    expect(cardUsage(null)).toEqual({ tokens: "—", cost: "—", title: null });
  });

  it("formats tokens and the API-equivalent cost like the header", () => {
    const map = agentUsageMap({
      boss: { tokenUsage: null },
      agents: [{ id: "a1", tokenUsage: usage(44_500, 3.4) }],
    });
    const shown = cardUsage(map.get("a1") ?? null);
    expect(shown.tokens).toBe("45k");
    expect(shown.cost).toBe("≈ API $3.40");
    expect(shown.title).toContain("API-equivalent estimate");
  });

  it("shows a dash for the cost when the model has no price", () => {
    const map = agentUsageMap({
      boss: { tokenUsage: usage(1_000, null) },
      agents: [],
    });
    expect(cardUsage(map.get("boss") ?? null)).toMatchObject({
      tokens: "2k",
      cost: "—",
    });
  });
});

describe("gameStore.syncAgentUsage", async () => {
  const { useGameStore } = await import("../src/stores/gameStore");
  const state = (input: number) => ({
    boss: { tokenUsage: usage(input, 1) },
    agents: [{ id: "a1", tokenUsage: null }],
  });

  it("stores the per-person usage and keeps the map while it is unchanged", () => {
    useGameStore.getState().syncAgentUsage(state(1_000));
    const first = useGameStore.getState().agentUsage;
    expect(first.get("boss")?.total).toBe(1_500);
    expect(first.has("a1")).toBe(false);

    useGameStore.getState().syncAgentUsage(state(1_000));
    expect(useGameStore.getState().agentUsage).toBe(first);

    useGameStore.getState().syncAgentUsage(state(2_000));
    expect(useGameStore.getState().agentUsage.get("boss")?.total).toBe(2_500);
  });

  it("forgets the usage on a session switch", () => {
    useGameStore.getState().syncAgentUsage(state(1_000));
    useGameStore.getState().resetForSessionSwitch();
    expect(useGameStore.getState().agentUsage.size).toBe(0);
  });
});

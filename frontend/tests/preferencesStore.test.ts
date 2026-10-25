import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/utils/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import { usePreferencesStore } from "../src/stores/preferencesStore";

describe("preferencesStore legacy language", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("ignores a saved language preference from before English-only", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ language: "es", clock_format: "24h" }),
    });
    await usePreferencesStore.getState().loadPreferences();
    const state = usePreferencesStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.clockFormat).toBe("24h");
    expect("language" in state).toBe(false);
  });
});

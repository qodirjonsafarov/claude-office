import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/utils/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import { usePreferencesStore } from "../src/stores/preferencesStore";

function respondWith(prefs: Record<string, string>): void {
  apiFetch.mockResolvedValue({ ok: true, json: async () => prefs });
}

describe("preferencesStore language", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("defaults to English before preferences load", () => {
    expect(usePreferencesStore.getState().language).toBe("en");
  });

  it("uses English when no language is saved", async () => {
    respondWith({});
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().language).toBe("en");
  });

  it("falls back to English when the saved language is no longer offered", async () => {
    respondWith({ language: "ru" });
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().language).toBe("en");
  });

  it("keeps a supported saved language", async () => {
    respondWith({ language: "es" });
    await usePreferencesStore.getState().loadPreferences();
    expect(usePreferencesStore.getState().language).toBe("es");
  });
});

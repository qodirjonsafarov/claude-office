// @vitest-environment happy-dom
/**
 * The live theme: the stored choice resolves against the OS, lands on <html>
 * (data-theme) and in the browser bar colour, and follows an OS switch while
 * "system" is chosen, without a reload.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createThemeStore } from "../src/systems/themeStore";

function fakeMedia(dark: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const media = {
    matches: dark,
    addEventListener: (_: "change", fn: (e: { matches: boolean }) => void) =>
      listeners.add(fn),
    removeEventListener: (_: "change", fn: (e: { matches: boolean }) => void) =>
      listeners.delete(fn),
    flip(next: boolean) {
      media.matches = next;
      for (const fn of listeners) fn({ matches: next });
    },
  };
  return media;
}

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

beforeEach(() => {
  document.head.innerHTML =
    '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f8faf8">' +
    '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#080d0c">';
  delete document.documentElement.dataset.theme;
});

function barColors(): string[] {
  return [
    ...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
  ].map((m) => m.content);
}

describe("createThemeStore", () => {
  it("follows the OS by default", () => {
    const store = createThemeStore({
      media: fakeMedia(false),
      storage: fakeStorage(),
      root: document.documentElement,
    });
    expect(store.getState().pref).toBe("system");
    expect(store.getState().theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("applies a stored explicit choice and its bar colour", () => {
    createThemeStore({
      media: fakeMedia(false),
      storage: fakeStorage({ "qo-theme": "dark" }),
      root: document.documentElement,
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(barColors()).toEqual(["#080d0c", "#080d0c"]);
  });

  it("switches live and remembers the choice", () => {
    const storage = fakeStorage();
    const store = createThemeStore({
      media: fakeMedia(true),
      storage,
      root: document.documentElement,
    });
    store.getState().setPref("light");
    expect(store.getState().theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(barColors()).toEqual(["#f8faf8", "#f8faf8"]);
    expect(storage.data.get("qo-theme")).toBe("light");
  });

  it("follows an OS switch only while system is chosen", () => {
    const media = fakeMedia(true);
    const store = createThemeStore({
      media,
      storage: fakeStorage(),
      root: document.documentElement,
    });
    expect(store.getState().theme).toBe("dark");
    media.flip(false);
    expect(store.getState().theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    store.getState().setPref("dark");
    media.flip(true);
    media.flip(false);
    expect(store.getState().theme).toBe("dark");
  });

  it("works without storage (private mode)", () => {
    const store = createThemeStore({
      media: fakeMedia(true),
      storage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("denied");
        },
      },
      root: document.documentElement,
    });
    expect(store.getState().pref).toBe("system");
    store.getState().setPref("light");
    expect(store.getState().theme).toBe("light");
  });
});

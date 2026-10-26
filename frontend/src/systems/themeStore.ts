/**
 * The live colour theme: the stored choice (dark / light / system), resolved
 * against the OS and applied to <html data-theme> and the browser bar colour.
 * One store for the whole page, so the UI (CSS tokens) and the office scene
 * (Pixi palettes) switch together, without a reload, and an OS switch is
 * followed while "system" is chosen. The boot script in systems/theme.ts
 * does the same before the first paint.
 */

import { createStore, useStore, type StoreApi } from "zustand";
import {
  THEME_STORAGE_KEY,
  parseThemePref,
  resolveTheme,
  themeColorFor,
  type Theme,
  type ThemePref,
} from "@/systems/theme";

export interface ThemeState {
  pref: ThemePref;
  theme: Theme;
  setPref: (pref: ThemePref) => void;
}

interface MediaQuery {
  matches: boolean;
  addEventListener(type: "change", fn: (e: { matches: boolean }) => void): void;
}

interface ThemeDeps {
  media: MediaQuery | null;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  root: HTMLElement | null;
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

function apply(root: HTMLElement | null, theme: Theme): void {
  if (!root) return;
  root.dataset.theme = theme;
  const color = themeColorFor(theme);
  root.ownerDocument
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", color));
}

export function createThemeStore({
  media,
  storage,
  root,
}: ThemeDeps): StoreApi<ThemeState> {
  let stored: string | null = null;
  try {
    stored = storage?.getItem(THEME_STORAGE_KEY) ?? null;
  } catch {
    // Private mode: no stored choice.
  }
  const pref = parseThemePref(stored);
  const resolve = (p: ThemePref) => resolveTheme(p, media?.matches ?? true);

  const store = createStore<ThemeState>((set) => ({
    pref,
    theme: resolve(pref),
    setPref: (next) => {
      try {
        storage?.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // Private mode: the choice lasts for this page only.
      }
      const theme = resolve(next);
      apply(root, theme);
      set({ pref: next, theme });
    },
  }));
  apply(root, store.getState().theme);

  media?.addEventListener("change", () => {
    const { pref: current } = store.getState();
    if (current !== "system") return;
    const theme = resolve(current);
    apply(root, theme);
    store.setState({ theme });
  });
  return store;
}

function browserDeps(): ThemeDeps {
  if (typeof window === "undefined") {
    return { media: null, storage: null, root: null };
  }
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return {
    media:
      typeof window.matchMedia === "function"
        ? window.matchMedia(DARK_QUERY)
        : null,
    storage,
    root: document.documentElement,
  };
}

const themeStore = createThemeStore(browserDeps());

/** The theme in force ("dark" on the server), live. */
export function useTheme(): Theme {
  return useStore(themeStore, (s) => s.theme);
}

/** The stored choice and its setter (the Settings switch). */
export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const pref = useStore(themeStore, (s) => s.pref);
  const setPref = useStore(themeStore, (s) => s.setPref);
  return [pref, setPref];
}

"use client";

/**
 * The theme choice (dark / light / system, wave 3 draft): read from
 * localStorage, applied as `data-theme` on <html>, and kept in step with the
 * OS while "system" is chosen.
 */

import { useCallback, useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  parseThemePref,
  resolveTheme,
  type ThemePref,
} from "@/systems/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function apply(pref: ThemePref): void {
  const systemDark = window.matchMedia(DARK_QUERY).matches;
  document.documentElement.dataset.theme = resolveTheme(pref, systemDark);
}

function readStored(): ThemePref {
  try {
    return parseThemePref(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPrefState] = useState<ThemePref>(() =>
    typeof window === "undefined" ? "dark" : readStored(),
  );

  useEffect(() => {
    apply(pref);
    if (pref !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => apply(pref);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = useCallback((next: ThemePref) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
    setPrefState(next);
  }, []);

  return [pref, setPref];
}

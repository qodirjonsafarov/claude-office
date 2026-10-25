/**
 * One clock for the whole scene: the office tint and lamps (dayNight.ts) and
 * the city window read the same hours. A debug override comes from the URL
 * ("?time=22:30", for screenshots) or from the city window's fast day (T in
 * debug mode).
 */

import { useEffect, useState } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import { parseTimeOverride, sceneHours } from "./dayNight";

export interface SceneClockState {
  /** Fixed hours (0..24) or null for the local clock. */
  override: number | null;
  setOverride: (hours: number | null) => void;
}

export function createSceneClock(search: string): StoreApi<SceneClockState> {
  const initial = parseTimeOverride(new URLSearchParams(search).get("time"));
  return createStore<SceneClockState>((set) => ({
    override: initial,
    setOverride: (hours) => set({ override: hours }),
  }));
}

export const sceneClock = createSceneClock(
  typeof window !== "undefined" ? window.location.search : "",
);

/** The "?time=" override the page was opened with (null = none). */
export const URL_TIME_OVERRIDE = sceneClock.getState().override;

/** Current scene hours; follows the override, else ticks every minute. */
export function useSceneHours(): number {
  const override = useStore(sceneClock, (s) => s.override);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (override !== null) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [override]);
  return sceneHours(now, override);
}

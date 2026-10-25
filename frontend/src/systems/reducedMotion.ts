/**
 * The OS "reduce motion" setting, read from matchMedia into a small store
 * and kept up to date. With it on, the scene drops squash, bob and particles
 * and fades instead of moving (see sceneMotion.ts).
 */

import { createStore, useStore, type StoreApi } from "zustand";

export interface ReducedMotionState {
  reduced: boolean;
}

interface MediaQuery {
  matches: boolean;
  addEventListener(type: "change", fn: (e: { matches: boolean }) => void): void;
  removeEventListener(
    type: "change",
    fn: (e: { matches: boolean }) => void,
  ): void;
}

const QUERY = "(prefers-reduced-motion: reduce)";

export function createReducedMotionStore(
  matchMedia: ((query: string) => MediaQuery) | undefined,
): StoreApi<ReducedMotionState> {
  const media = matchMedia?.(QUERY);
  const store = createStore<ReducedMotionState>(() => ({
    reduced: media?.matches ?? false,
  }));
  media?.addEventListener("change", (e) =>
    store.setState({ reduced: e.matches }),
  );
  return store;
}

const reducedMotionStore = createReducedMotionStore(
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? (q) => window.matchMedia(q) as unknown as MediaQuery
    : undefined,
);

/** Whether the scene should avoid motion (live). */
export function useReducedMotion(): boolean {
  return useStore(reducedMotionStore, (s) => s.reduced);
}

/** Non-React read, e.g. in the animation tick. */
export function isReducedMotion(): boolean {
  return reducedMotionStore.getState().reduced;
}

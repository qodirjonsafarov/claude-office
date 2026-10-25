/**
 * The scene follows the OS "reduce motion" setting live: the value is read
 * from matchMedia into a store and updated when the setting changes.
 */
import { describe, expect, it } from "vitest";
import { createReducedMotionStore } from "@/systems/reducedMotion";

function fakeMedia(initial: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const media = {
    matches: initial,
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
      listeners.add(fn),
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
      listeners.delete(fn),
  };
  return {
    matchMedia: () => media,
    set(value: boolean) {
      media.matches = value;
      for (const fn of listeners) fn({ matches: value });
    },
    listeners,
  };
}

describe("reduced motion store", () => {
  it("starts with the current setting", () => {
    const store = createReducedMotionStore(fakeMedia(true).matchMedia);
    expect(store.getState().reduced).toBe(true);
  });

  it("follows changes of the setting", () => {
    const media = fakeMedia(false);
    const store = createReducedMotionStore(media.matchMedia);
    media.set(true);
    expect(store.getState().reduced).toBe(true);
    media.set(false);
    expect(store.getState().reduced).toBe(false);
  });

  it("defaults to full motion without matchMedia (server, tests)", () => {
    expect(createReducedMotionStore(undefined).getState().reduced).toBe(false);
  });
});

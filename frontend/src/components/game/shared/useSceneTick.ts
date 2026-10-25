"use client";

/**
 * Ticker hooks for scene effects.
 *
 * - useSceneTick: a stable ticker callback that is only attached while
 *   `enabled` (an inline `useTick(() => ...)` re-subscribes on every render).
 * - useTickValue: a value computed from the elapsed time on every tick, but
 *   React state changes only when the (quantised) value changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTick } from "@pixi/react";
import type { Ticker } from "pixi.js";

export function useSceneTick(
  callback: (ticker: Ticker) => void,
  enabled: boolean,
): void {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  }, [callback]);
  const stable = useCallback((ticker: Ticker) => ref.current(ticker), []);
  useTick({ callback: stable, isEnabled: enabled });
}

/**
 * `compute(ms since enabled)` each tick; returns its latest value and
 * re-renders only when it changes (quantise inside `compute`).
 */
export function useTickValue<T>(
  enabled: boolean,
  compute: (ms: number) => T,
): T {
  const ms = useRef(0);
  const [value, setValue] = useState<T>(() => compute(0));
  useSceneTick((ticker) => {
    ms.current += ticker.deltaMS;
    const next = compute(ms.current);
    setValue((prev) => (Object.is(prev, next) ? prev : next));
  }, enabled);
  return value;
}

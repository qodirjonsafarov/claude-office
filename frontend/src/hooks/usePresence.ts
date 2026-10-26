"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a value on screen for `exitMs` after it turns null, flagged as
 * `leaving`, so a closing popover or sheet can play its exit animation
 * before it unmounts. A new value shows at once. `exitMs` 0 (reduced
 * motion) drops the value immediately.
 */
export function usePresence<T>(
  value: T | null,
  exitMs: number,
): { shown: T | null; leaving: boolean } {
  const [shown, setShown] = useState<T | null>(value);
  const [leaving, setLeaving] = useState(false);

  // Adjust during render (no effect round-trip).
  if (value !== null && (value !== shown || leaving)) {
    setShown(value);
    setLeaving(false);
  } else if (value === null && shown !== null && !leaving) {
    if (exitMs > 0) setLeaving(true);
    else setShown(null);
  }

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, exitMs);
    return () => clearTimeout(timer);
  }, [leaving, exitMs]);

  return { shown, leaving };
}

/**
 * Focus mode: the office fills the whole window. F toggles it (the header
 * button too), Esc leaves it; leaving the browser's fullscreen (its own Esc)
 * leaves it as well. Always starts off: the choice is not remembered.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  enterFullscreen,
  focusKeyAction,
  isEditingTarget,
  leaveFullscreen,
} from "@/utils/focusMode";

/** `enabled` false (the phone layout): always off, F does nothing. */
export function useFocusMode(enabled = true): {
  focused: boolean;
  toggle: () => void;
  exit: () => void;
} {
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  const set = useCallback((on: boolean) => {
    focusedRef.current = on;
    setFocused(on);
    if (on) enterFullscreen(document.documentElement);
    else leaveFullscreen(document);
  }, []);
  const toggle = useCallback(() => set(!focusedRef.current), [set]);
  const exit = useCallback(() => set(false), [set]);

  // Switched to the phone layout while focused: leave
  if (!enabled && focused) setFocused(false);
  useEffect(() => {
    if (!enabled && document.fullscreenElement) leaveFullscreen(document);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const action = focusKeyAction(
        {
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          editing: isEditingTarget(e.target),
          dialogOpen: !!document.querySelector(
            "[role='dialog'][aria-modal='true']",
          ),
        },
        focusedRef.current,
      );
      if (action === "toggle") set(!focusedRef.current);
      else if (action === "exit") set(false);
    };
    // The browser's own Esc leaves its fullscreen without a keydown
    let wasFull = !!document.fullscreenElement;
    const onFullscreen = () => {
      const full = !!document.fullscreenElement;
      if (wasFull && !full && focusedRef.current) {
        focusedRef.current = false;
        setFocused(false);
      }
      wasFull = full;
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [set, enabled]);

  return { focused, toggle, exit };
}

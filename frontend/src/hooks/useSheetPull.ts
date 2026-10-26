"use client";

import { useCallback, useEffect, useRef } from "react";
import { pullDismisses } from "@/utils/sheetPull";

/**
 * Pull-down to close a phone sheet: put the returned `box` ref on the sheet
 * and spread `handlers` on its head (a `touch-none` area). The sheet follows the finger; a long
 * pull or a flick slides it away and calls `onClose`, anything else springs
 * back. Mouse drags are ignored.
 */
export function useSheetPull<T extends HTMLElement>(onClose: () => void) {
  const box = useRef<T>(null);
  const pull = useRef<{ y: number; at: number; moved: number } | null>(null);
  const closeTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    pull.current = { y: e.clientY, at: Date.now(), moved: 0 };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const sheet = box.current;
    if (!pull.current || !sheet) return;
    const moved = Math.max(0, e.clientY - pull.current.y);
    pull.current.moved = moved;
    sheet.style.transition = "none";
    sheet.style.transform = moved < 8 ? "" : `translateY(${moved}px)`;
  }, []);

  const onPointerUp = useCallback(() => {
    const sheet = box.current;
    const state = pull.current;
    pull.current = null;
    if (!state || !sheet) return;
    sheet.style.transition = "transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)";
    if (pullDismisses(state.moved, Date.now() - state.at)) {
      sheet.style.transform = "translateY(110%)";
      closeTimer.current = window.setTimeout(onClose, 180);
    } else {
      sheet.style.transform = "";
    }
  }, [onClose]);

  return {
    box,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

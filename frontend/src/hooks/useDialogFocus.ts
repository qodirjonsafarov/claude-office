"use client";

import { useEffect, useRef, type RefObject } from "react";
import { isTopDialog, trapTab } from "@/utils/dialogFocus";

/**
 * Focus handling for a modal dialog: focuses its `[data-autofocus]` element
 * (the close button) on open, keeps Tab inside, gives focus back on close,
 * and calls `onEscape` only while this dialog is the topmost one, so Escape
 * in a modal opened from a sheet does not close the sheet too.
 */
export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  { active = true, onEscape }: { active?: boolean; onEscape?: () => void },
): void {
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const box = ref.current;
    box?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (!box || !isTopDialog(box)) return;
      if (e.key === "Escape") {
        escape.current?.();
        return;
      }
      trapTab(box, e);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [active, ref]);
}

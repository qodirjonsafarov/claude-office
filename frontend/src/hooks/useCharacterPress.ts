"use client";

import { useCallback, useEffect, useRef } from "react";
import type { FederatedPointerEvent } from "pixi.js";
import { sceneToClient } from "@/stores/sceneViewStore";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { useAttentionStore } from "@/stores/attentionStore";
import { createLongPress, type LongPress } from "@/utils/longPress";

/**
 * Pointer props for a character on the Pixi stage: a tap (or click) opens
 * its agent card, and so does a long-press on touch screens. The tap that
 * ends a long-press is swallowed. Off when "Click to Focus" is off.
 */
export function useCharacterPress(
  id: string,
  position: { x: number; y: number },
) {
  const enabled = usePreferencesStore((s) => s.clickToFocusEnabled);
  const openFocusPopup = useAttentionStore((s) => s.openFocusPopup);

  const open = useCallback(() => {
    const at = sceneToClient(position.x, position.y);
    if (at) openFocusPopup(id, at.x, at.y);
  }, [id, position.x, position.y, openFocusPopup]);

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  // Made on the first touch (event handlers only touch the refs).
  const pressRef = useRef<LongPress | null>(null);
  useEffect(() => () => pressRef.current?.cancel(), []);
  const swallowTap = useRef(false);

  if (!enabled) return { interactive: false } as const;
  return {
    interactive: true,
    cursor: "pointer",
    onPointerDown: (e: FederatedPointerEvent) => {
      const press = (pressRef.current ??= createLongPress(() => {
        navigator.vibrate?.(10);
        openRef.current();
      }));
      // A swallow left by a press that ended without a tap is stale now.
      swallowTap.current = false;
      press.down(e.clientX, e.clientY);
      // Mice and pens just click; only a finger can long-press.
      if (e.pointerType !== "touch") {
        press.up();
        return;
      }
      // Follow the finger anywhere (a pan leaves the character): a move
      // cancels the press, the lift ends it.
      const onMove = (ev: PointerEvent) => press.move(ev.clientX, ev.clientY);
      const onEnd = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        swallowTap.current = press.up();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    },
    onPointerTap: (e: FederatedPointerEvent) => {
      // Pixi fires the tap from its capture-phase window pointerup, before
      // our onEnd, so the tap ends the press itself (onEnd then gets false).
      const longPressed = pressRef.current?.up() ?? false;
      if (swallowTap.current || longPressed) {
        swallowTap.current = false;
        return;
      }
      // The end of a pan (the office moved along under the finger) is no tap.
      if (pressRef.current && !pressRef.current.isTap(e.clientX, e.clientY))
        return;
      open();
    },
  } as const;
}

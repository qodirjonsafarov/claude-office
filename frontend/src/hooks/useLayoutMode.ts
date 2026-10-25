"use client";

import { useEffect, useState } from "react";

/**
 * Which layout the page uses:
 * - "desktop": header, both sidebars and the office in the middle;
 * - "portrait": a phone held upright — top bar, the office across the full
 *   width, the bottom tab bar and sheets for the panels;
 * - "landscape": a phone turned sideways — a rail of tabs at the side and the
 *   office filling the height.
 */
export type LayoutMode = "desktop" | "portrait" | "landscape";

/** Narrower than this is always a phone. */
const PHONE_MAX_WIDTH = 767;
/** A screen this short cannot hold the desktop header and sidebars... */
const PHONE_MAX_HEIGHT = 520;
/** ...unless it is wider than any phone turned sideways (iPhone Pro Max: 932). */
const PHONE_MAX_LANDSCAPE_WIDTH = 1024;

export function getLayoutMode(width: number, height: number): LayoutMode {
  const phone =
    width <= PHONE_MAX_WIDTH ||
    (height <= PHONE_MAX_HEIGHT && width <= PHONE_MAX_LANDSCAPE_WIDTH);
  if (!phone) return "desktop";
  return width > height ? "landscape" : "portrait";
}

/** The current layout mode, updated on resize and rotation. */
export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>("desktop");
  useEffect(() => {
    const update = () =>
      setMode(getLayoutMode(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return mode;
}

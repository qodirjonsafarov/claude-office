/**
 * Small drawing helpers for the flat pixel-art furniture of the office:
 * filled boxes with the shared 1 px outline, flat drop shadows that fall
 * down-right (the light comes from the top left), and bevels.
 * Everything snaps to whole scene pixels.
 */

import type { Graphics } from "pixi.js";
import type { Tint } from "@/systems/scenePalette";

/** A filled box with an optional 1 px outline just inside its edge. */
export function box(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  outline: number | null = null,
): void {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.round(w);
  const rh = Math.round(h);
  if (outline !== null) {
    g.rect(rx, ry, rw, rh);
    g.fill(outline);
    if (rw > 2 && rh > 2) {
      g.rect(rx + 1, ry + 1, rw - 2, rh - 2);
      g.fill(fill);
    }
    return;
  }
  g.rect(rx, ry, rw, rh);
  g.fill(fill);
}

/** A translucent box (highlights, glints, shade bands). */
export function wash(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  tint: Tint,
): void {
  g.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  g.fill(tint);
}

/**
 * A flat contact shadow on the floor under a piece of furniture: a rounded
 * slab shifted down-right, with a lighter rim so it reads soft.
 */
export function dropShadow(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  tint: Tint,
): void {
  const r = Math.min(6, h / 2);
  g.roundRect(Math.round(x + 2), Math.round(y + 2), w + 4, h + 2, r + 2);
  g.fill({ color: tint.color, alpha: tint.alpha * 0.45 });
  g.roundRect(Math.round(x + 3), Math.round(y + 3), w, h, r);
  g.fill({ color: tint.color, alpha: tint.alpha * 0.7 });
}

/** A soft oval shadow (round things: plants, stools, people). */
export function ovalShadow(
  g: Graphics,
  cx: number,
  cy: number,
  rx: number,
  tint: Tint,
): void {
  g.ellipse(Math.round(cx + 2), Math.round(cy + 1), rx + 3, rx * 0.3 + 2);
  g.fill({ color: tint.color, alpha: tint.alpha * 0.45 });
  g.ellipse(Math.round(cx + 2), Math.round(cy + 1), rx, rx * 0.3);
  g.fill({ color: tint.color, alpha: tint.alpha * 0.7 });
}

/** Lit top/left edge and shaded bottom/right edge of a panel. */
export function bevel(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  light: Tint,
  dark: Tint,
): void {
  wash(g, x, y, w, 1, light);
  wash(g, x, y + 1, 1, h - 1, light);
  wash(g, x + 1, y + h - 1, w - 1, 1, dark);
  wash(g, x + w - 1, y + 1, 1, h - 2, dark);
}

/** Mix two 0xRRGGBB colours (t = 0 gives a, 1 gives b). */
export function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}

/** A deterministic pseudo-random sequence (same picture every render). */
export function rng(seed: number): () => number {
  let n = (seed * 2654435761) >>> 0 || 1;
  return () => {
    n = (n * 1103515245 + 12345) >>> 0;
    return (n >>> 8) / 0x1000000;
  };
}

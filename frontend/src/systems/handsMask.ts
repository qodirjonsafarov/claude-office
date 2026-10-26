/**
 * The hands of a seated frame, alone (systems/handsOnDesk.ts draws them over
 * the desk). Inside the hands crop it keeps the skin pixels - the colours the
 * hands share with the face - and the outline right around them; the shirt,
 * the lap and the trousers are dropped, whatever the look. Pure: RGBA in,
 * RGBA out (same size, everything else transparent). Colours of the legs
 * (trousers, shoes) never count as skin, even when the face has them too
 * (glasses, a beard).
 */

import { HANDS_CROP } from "./handsOnDesk";

export interface Rgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Where the face is in a seated, front-facing frame (frame px). */
const FACE = { x0: 20, y0: 14, x1: 44, y1: 29 };
/** The legs, well below the hands: their colours are never skin here. */
const LEGS = { x0: 16, y0: 53, x1: 47, y1: 60 };

const key = (d: Uint8ClampedArray, i: number) =>
  (d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3];

/** The outline colour: the commonest colour on the frame's silhouette edge. */
function outlineColour(img: Rgba, fx: number, fy: number): number | null {
  const { data, width } = img;
  const alpha = (x: number, y: number) =>
    x < 0 || y < 0 || x >= 64 || y >= 64
      ? 0
      : data[((fy + y) * width + fx + x) * 4 + 3];
  const counts = new Map<number, number>();
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (!alpha(x, y)) continue;
      if (
        alpha(x - 1, y) &&
        alpha(x + 1, y) &&
        alpha(x, y - 1) &&
        alpha(x, y + 1)
      )
        continue;
      const k = key(data, ((fy + y) * width + fx + x) * 4);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  let best: number | null = null;
  let most = 0;
  for (const [k, n] of counts) {
    if (n > most) {
      most = n;
      best = k;
    }
  }
  return best;
}

export function extractHands(
  img: Rgba,
  cells: ReadonlyArray<{ x: number; y: number }>,
): Uint8ClampedArray {
  const { data, width } = img;
  const out = new Uint8ClampedArray(data.length);
  const idx = (fx: number, fy: number, x: number, y: number) =>
    ((fy + y) * width + fx + x) * 4;

  for (const { x: fx, y: fy } of cells) {
    const outline = outlineColour(img, fx, fy);
    const face = new Set<number>();
    for (let y = FACE.y0; y <= FACE.y1; y++) {
      for (let x = FACE.x0; x <= FACE.x1; x++) {
        const i = idx(fx, fy, x, y);
        if (data[i + 3]) face.add(key(data, i));
      }
    }
    for (let y = LEGS.y0; y <= LEGS.y1; y++) {
      for (let x = LEGS.x0; x <= LEGS.x1; x++) {
        const i = idx(fx, fy, x, y);
        if (data[i + 3]) face.delete(key(data, i));
      }
    }
    face.delete(outline ?? -1);

    const { x: cx, y: cy, w, h } = HANDS_CROP;
    const isSkin = (x: number, y: number) => {
      if (x < cx || y < cy || x >= cx + w || y >= cy + h) return false;
      const i = idx(fx, fy, x, y);
      return data[i + 3] > 0 && face.has(key(data, i));
    };
    for (let y = cy; y < cy + h; y++) {
      for (let x = cx; x < cx + w; x++) {
        const i = idx(fx, fy, x, y);
        if (!data[i + 3]) continue;
        let keep = isSkin(x, y);
        if (!keep && key(data, i) === outline) {
          for (let dy = -1; dy <= 1 && !keep; dy++) {
            for (let dx = -1; dx <= 1 && !keep; dx++) {
              keep = isSkin(x + dx, y + dy);
            }
          }
        }
        if (keep) out.set(data.subarray(i, i + 4), i);
      }
    }
  }
  return out;
}

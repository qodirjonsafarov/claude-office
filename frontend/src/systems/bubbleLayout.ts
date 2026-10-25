/**
 * Layout of the speech / thought bubbles in the office: their size (same
 * formula SceneBubble draws with) and lifts that keep them from covering
 * each other and the name tags. Pure TS.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CHAR_WIDTH = 11.5;
const PADDING_H = 34;
const MAX_W = 340;
const MIN_W = 90;
/** Gap kept between stacked boxes. */
const GAP = 4;

/** Bubble size on the canvas for its (already truncated) text. */
export function bubbleSize(text: string): { w: number; h: number } {
  const raw = text.length * CHAR_WIDTH + PADDING_H;
  const w = Math.min(MAX_W, Math.max(MIN_W, raw));
  const capacity = (w - PADDING_H) / CHAR_WIDTH;
  const lines = Math.max(1, Math.ceil(text.length / capacity));
  return { w, h: 30 + lines * 21 };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.w + GAP &&
    b.x < a.x + a.w + GAP &&
    a.y < b.y + b.h + GAP &&
    b.y < a.y + a.h + GAP
  );
}

/**
 * Upward lift (<= 0) per bubble so no bubble overlaps an earlier one or an
 * obstacle (name tags). Earlier bubbles win their spot, so pass the boss
 * first and then the agents.
 */
export function stackBubbles(
  bubbles: ReadonlyArray<Box & { id: string }>,
  obstacles: readonly Box[],
): Map<string, number> {
  const lifts = new Map<string, number>();
  const placed: Box[] = [...obstacles];
  for (const bubble of bubbles) {
    let y = bubble.y;
    for (let guard = 0; guard < placed.length + 1; guard++) {
      const box = { x: bubble.x, y, w: bubble.w, h: bubble.h };
      const hit = placed.find((p) => overlaps(box, p));
      if (!hit) break;
      y = hit.y - bubble.h - GAP;
    }
    placed.push({ x: bubble.x, y, w: bubble.w, h: bubble.h });
    lifts.set(bubble.id, y - bubble.y);
  }
  return lifts;
}

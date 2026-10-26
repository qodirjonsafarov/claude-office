/**
 * A long-press detector for touch (the office scene on phones): hold a
 * finger still for LONG_PRESS_MS and `onLongPress` fires. A move beyond a
 * few pixels (a pan of the office) or an early lift cancels it. `up()` says
 * whether the press ended as a long-press, so the caller can swallow the tap
 * that follows.
 */

export const LONG_PRESS_MS = 450;
/** How far a finger may wander and still be "still". */
const SLOP_PX = 10;

export interface LongPress {
  down(x: number, y: number): void;
  move(x: number, y: number): void;
  /** The finger lifted: true when the press had already fired. */
  up(): boolean;
  cancel(): void;
  /** A tap at (x, y) counts only near where the last press went down. */
  isTap(x: number, y: number): boolean;
}

export function createLongPress(onLongPress: () => void): LongPress {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number } | null = null;
  let fired = false;
  let lastDown: { x: number; y: number } | null = null;

  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    start = null;
  };

  return {
    down(x, y) {
      clear();
      fired = false;
      start = { x, y };
      lastDown = { x, y };
      timer = setTimeout(() => {
        timer = null;
        fired = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    move(x, y) {
      if (!start || timer === null) return;
      if (Math.hypot(x - start.x, y - start.y) > SLOP_PX) clear();
    },
    up() {
      const was = fired;
      clear();
      fired = false;
      return was;
    },
    cancel() {
      clear();
      fired = false;
    },
    isTap(x, y) {
      return (
        lastDown !== null &&
        Math.hypot(x - lastDown.x, y - lastDown.y) <= SLOP_PX
      );
    },
  };
}

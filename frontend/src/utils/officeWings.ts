/**
 * The office grows with the stage. The canvas takes the stage's shape
 * (utils/sceneLayout.ts) and the 1280x1024 room sits centred in it; this
 * module furnishes the extra canvas around the room instead of leaving bare
 * wall and floor:
 *
 *   - side wings (a wide stage): columns of zones packed out from the room,
 *     right: kitchen, lounge, library; left: server corner, meeting table,
 *     library. A strip too slim for a zone gets a tall plant.
 *   - above the wall (a tall stage): a row of high windows;
 *   - below the floor (a tall stage): planters and benches, the strip under
 *     the boss desk kept clear.
 *
 * Everything lies outside the room, so walking paths, desks, the boss area
 * and the elevator keep their logic; nobody walks into a wing. Pure geometry
 * (room coordinates), drawn by components/game/OfficeWings.tsx.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/canvas";

export type WingKind =
  | "kitchen"
  | "lounge"
  | "library"
  | "servers"
  | "meeting"
  | "tallPlant"
  | "highWindow"
  | "planter"
  | "bench";

export type WingSide = "left" | "right" | "top" | "bottom";

/** One piece of furniture or one zone: its footprint in room coordinates. */
export interface WingItem {
  kind: WingKind;
  side: WingSide;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A warm light pool at night (a lamp of a zone). */
export interface WingLight {
  x: number;
  y: number;
  r: number;
}

interface Extent {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A zone column: wall decor at the top, furniture down the floor. */
export const ZONE_WIDTH = 240;
const ZONE_GUTTER = 30;
/** Clear space next to the room's edge (its plants, printer, elevator). */
const INNER_GAP = 24;
/** Clear space at the canvas edge (the side vignette). */
const OUTER_GAP = 16;
const ZONE_TOP = 20;
const ZONE_BOTTOM = 1000;
const PLANT_WIDTH = 70;

const RIGHT_ZONES: readonly WingKind[] = ["kitchen", "lounge", "library"];
const LEFT_ZONES: readonly WingKind[] = ["servers", "meeting", "library"];

/** High windows above the wall: one every WINDOW_STEP, centred on the room. */
const WINDOW_WIDTH = 150;
const WINDOW_STEP = 210;
const MIN_TOP_BAND = 60;
/** Planters and benches below the floor. */
const MIN_BOTTOM_BAND = 80;
const BOTTOM_STEP = 210;
const BOTTOM_FIRST = 270;
const PLANTER_WIDTH = 150;
const BENCH_WIDTH = 130;
/** Under the boss desk and its rug: nothing below it. */
const BOSS_CLEAR = { left: 460, right: 820 };
const EDGE_GAP = 20;

function sideWing(
  side: "left" | "right",
  width: number,
  zones: readonly WingKind[],
): WingItem[] {
  const usable = width - INNER_GAP - OUTER_GAP;
  const items: WingItem[] = [];
  // x of a piece `offset` px out from the room's edge, `w` wide
  const at = (offset: number, w: number) =>
    side === "right" ? CANVAS_WIDTH + offset : -offset - w;
  const h = ZONE_BOTTOM - ZONE_TOP;

  if (usable < ZONE_WIDTH) {
    if (usable >= PLANT_WIDTH) {
      const offset = INNER_GAP + (usable - PLANT_WIDTH) / 2;
      items.push({
        kind: "tallPlant",
        side,
        x: Math.round(at(offset, PLANT_WIDTH)),
        y: ZONE_TOP,
        w: PLANT_WIDTH,
        h,
      });
    }
    return items;
  }

  const count = Math.floor((usable + ZONE_GUTTER) / (ZONE_WIDTH + ZONE_GUTTER));
  for (let i = 0; i < count; i++) {
    const offset = INNER_GAP + i * (ZONE_WIDTH + ZONE_GUTTER);
    items.push({
      kind: zones[i % zones.length],
      side,
      x: at(offset, ZONE_WIDTH),
      y: ZONE_TOP,
      w: ZONE_WIDTH,
      h,
    });
  }
  // The rest at the outer edge: a plant if it fits
  const used = count * ZONE_WIDTH + (count - 1) * ZONE_GUTTER;
  const rest = usable - used - ZONE_GUTTER;
  if (rest >= PLANT_WIDTH) {
    const offset = INNER_GAP + used + ZONE_GUTTER + (rest - PLANT_WIDTH) / 2;
    items.push({
      kind: "tallPlant",
      side,
      x: Math.round(at(offset, PLANT_WIDTH)),
      y: ZONE_TOP,
      w: PLANT_WIDTH,
      h,
    });
  }
  return items;
}

/** Slot centres symmetric around the room's middle that keep inside [lo, hi]. */
function slots(
  first: number,
  step: number,
  half: number,
  lo: number,
  hi: number,
): number[] {
  const mid = CANVAS_WIDTH / 2;
  const out: number[] = [];
  for (let d = first; mid + d + half <= hi || mid - d - half >= lo; d += step) {
    if (mid - d - half >= lo) out.push(mid - d);
    if (d > 0 && mid + d + half <= hi) out.push(mid + d);
  }
  return out.sort((a, b) => a - b);
}

function topBand(e: Extent): WingItem[] {
  const band = -e.top;
  if (band < MIN_TOP_BAND) return [];
  // Below the ceiling light strip (18 px), above the room's wall decor
  const h = Math.min(band - 34, 140);
  const y = Math.round(e.top + 22 + (band - 34 - h) / 2);
  return slots(0, WINDOW_STEP, WINDOW_WIDTH / 2, e.left + 30, e.right - 30).map(
    (cx) => ({
      kind: "highWindow" as const,
      side: "top" as const,
      x: cx - WINDOW_WIDTH / 2,
      y,
      w: WINDOW_WIDTH,
      h,
    }),
  );
}

function bottomBand(e: Extent): WingItem[] {
  const band = e.bottom - CANVAS_HEIGHT;
  if (band < MIN_BOTTOM_BAND) return [];
  const h = Math.min(band - 20, 90);
  const y = Math.round(CANVAS_HEIGHT + (band - h) / 2);
  const half = PLANTER_WIDTH / 2;
  return slots(
    BOTTOM_FIRST,
    BOTTOM_STEP,
    half,
    e.left + EDGE_GAP,
    e.right - EDGE_GAP,
  )
    .map((cx) => {
      // Planters next to the boss area, benches between them
      const k = Math.round(Math.abs(cx - CANVAS_WIDTH / 2) / BOTTOM_STEP);
      const kind: WingKind = k % 2 === 1 ? "planter" : "bench";
      const w = kind === "planter" ? PLANTER_WIDTH : BENCH_WIDTH;
      return {
        kind,
        side: "bottom" as const,
        x: Math.round(cx - w / 2),
        y,
        w,
        h,
      };
    })
    .filter(
      (item) =>
        item.x >= BOSS_CLEAR.right || item.x + item.w <= BOSS_CLEAR.left,
    );
}

/** The furnished space around the room for a canvas reaching out to `e`. */
export function officeWings(e: Extent): WingItem[] {
  return [
    ...sideWing("left", -e.left, LEFT_ZONES),
    ...sideWing("right", e.right - CANVAS_WIDTH, RIGHT_ZONES),
    ...topBand(e),
    ...bottomBand(e),
  ];
}

/** Where each zone's lamps stand, relative to its column (0..240, 20..1000). */
const LAMPS: Partial<Record<WingKind, ReadonlyArray<WingLight>>> = {
  kitchen: [
    { x: 110, y: 240, r: 70 },
    { x: 120, y: 540, r: 60 },
  ],
  lounge: [
    { x: 214, y: 540, r: 70 },
    { x: 120, y: 600, r: 80 },
  ],
  library: [{ x: 180, y: 560, r: 65 }],
  servers: [{ x: 110, y: 270, r: 55 }],
  meeting: [{ x: 120, y: 560, r: 90 }],
};

export function wingLights(items: readonly WingItem[]): WingLight[] {
  const out: WingLight[] = [];
  for (const item of items) {
    for (const lamp of LAMPS[item.kind] ?? []) {
      out.push({ x: item.x + lamp.x, y: lamp.y, r: lamp.r });
    }
  }
  return out;
}

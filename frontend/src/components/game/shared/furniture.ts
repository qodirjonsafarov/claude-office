/**
 * The office furniture, drawn flat in pixel-art style with the theme's
 * materials (systems/scenePalette.ts): work desks and the boss's desk, task
 * chairs and the boss's leather chair, monitors seen from the back with a
 * soft screen glow, keyboards, potted plants and the boss rug.
 *
 * Coordinates are local to a desk's origin (the same place the old desk
 * sprites used): the top surface starts at y = 30, the keyboard is centred
 * at y = 42 (constants/positions.ts), the monitor stands at x = -45 and the
 * front panel at y = 54..92 carries the task marquee (y = 70). Light comes
 * from the top left; shadows fall down-right.
 */

import type { Graphics } from "pixi.js";
import {
  DESK_SURFACE_OFFSET_Y,
  KEYBOARD_HEIGHT,
  KEYBOARD_OFFSET_Y,
} from "@/constants/positions";
import type { SceneMaterials, ScenePalette } from "@/systems/scenePalette";
import { box, dropShadow, ovalShadow, wash } from "./pixelDraw";

const TOP = DESK_SURFACE_OFFSET_Y;
const TOP_DEPTH = 24;
const LIP = 4;
const PANEL_BOTTOM = 92;
const FLOOR = 104;

const LIGHT = { color: 0xffffff, alpha: 0.18 };
const SHADE = { color: 0x000000, alpha: 0.18 };

export interface DeskLook {
  /** Half the desk's width (work desks 70, the boss 86). */
  half: number;
  top: number;
  topLight: number;
  edge: number;
  panel: number;
  panelLine: number;
}

export function workDesk(m: SceneMaterials): DeskLook {
  return {
    half: 70,
    top: m.deskTop,
    topLight: m.deskTopLight,
    edge: m.deskEdge,
    panel: m.deskPanel,
    panelLine: m.deskPanelLine,
  };
}

export function bossDesk(m: SceneMaterials): DeskLook {
  return {
    half: 86,
    top: m.bossTop,
    topLight: m.bossTopLight,
    edge: m.bossEdge,
    panel: m.bossPanel,
    panelLine: m.bossPanelLine,
  };
}

/** A desk: shadow, legs, front panel, top surface with its lit back edge. */
export function drawDesk(g: Graphics, p: ScenePalette, d: DeskLook): void {
  const m = p.materials;
  const w = d.half * 2;
  const x = -d.half;
  dropShadow(g, x + 2, FLOOR - 8, w - 4, 10, p.shadow);
  // Legs: slim metal, with feet
  for (const lx of [x + 2, d.half - 7]) {
    box(
      g,
      lx,
      TOP + TOP_DEPTH,
      5,
      FLOOR - TOP - TOP_DEPTH,
      m.deskLeg,
      m.outline,
    );
    box(g, lx - 1, FLOOR - 2, 7, 3, m.outline);
  }
  // Modesty panel between the legs
  box(
    g,
    x + 7,
    TOP + TOP_DEPTH + LIP - 1,
    w - 14,
    PANEL_BOTTOM - TOP - TOP_DEPTH - LIP,
    d.panel,
    m.outline,
  );
  wash(g, x + 8, TOP + TOP_DEPTH + LIP, w - 16, 1, LIGHT);
  box(g, x + 12, PANEL_BOTTOM - 8, w - 24, 1, d.panelLine);
  // Top surface and its front lip
  box(g, x, TOP, w, TOP_DEPTH + LIP, d.edge, m.outline);
  box(g, x + 1, TOP + 1, w - 2, TOP_DEPTH - 1, d.top);
  wash(g, x + 1, TOP + 1, w - 2, 1, { color: d.topLight, alpha: 1 });
  wash(g, x + 1, TOP + 2, 1, TOP_DEPTH - 2, { color: d.topLight, alpha: 1 });
  // A faint grain on the top
  wash(g, x + 10, TOP + 7, w * 0.45, 1, SHADE);
  wash(g, x + w * 0.5, TOP + 13, w * 0.4, 1, SHADE);
  wash(g, x + 1, TOP + TOP_DEPTH, w - 2, 1, { color: d.topLight, alpha: 0.35 });
}

/** The keyboard on the desk top (centred on the desk). */
export function drawKeyboard(g: Graphics, m: SceneMaterials, cx = 0): void {
  const w = 48;
  const h = KEYBOARD_HEIGHT - 2;
  const x = cx - w / 2;
  const y = KEYBOARD_OFFSET_Y - h / 2;
  wash(g, x + 1, y + 2, w, h, SHADE);
  box(g, x, y, w, h, m.keyboard, m.outline);
  // Three rows of keys and a space bar
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 10; k++) {
      box(g, x + 3 + k * 4.2, y + 2 + r * 2.6, 3, 2, m.keyboardKeys);
    }
  }
  box(g, x + 14, y + h - 3, 20, 1.6, m.keyboardKeys);
}

/** A monitor seen from the back, on its stand. `lit`: somebody works there. */
export function drawMonitor(
  g: Graphics,
  m: SceneMaterials,
  cx: number,
  lit: boolean,
): void {
  const w = 56;
  const h = 34;
  const x = Math.round(cx - w / 2);
  const y = 3;
  // Stand: neck and foot on the desk top
  box(g, cx - 4, y + h - 2, 8, 10, m.monitorStand, m.outline);
  box(g, cx - 13, y + h + 6, 26, 4, m.monitorStand, m.outline);
  // Back cover, a thin lit rim on top, a vent and the status LED
  box(g, x, y, w, h, m.monitor, m.outline);
  wash(g, x + 1, y + 1, w - 2, 1, { color: m.monitorLight, alpha: 1 });
  wash(g, x + 1, y + 2, 1, h - 3, { color: m.monitorLight, alpha: 0.6 });
  box(g, x + 10, y + 8, w - 20, h - 18, m.monitorLight);
  box(g, x + 11, y + 9, w - 22, h - 20, m.monitor);
  for (let i = 0; i < 5; i++) wash(g, x + 14 + i * 6, y + h - 6, 3, 1, SHADE);
  box(g, x + w - 6, y + h - 5, 2, 2, lit ? m.led : m.monitorLight);
}

/**
 * The light of a lit screen on its worker: soft stacked ovals in add blend,
 * drawn at the monitor's top edge (the screen faces the worker).
 */
export function drawScreenGlow(g: Graphics, m: SceneMaterials): void {
  g.clear();
  for (let i = 0; i < 4; i++) {
    const k = 1 - i * 0.2;
    g.ellipse(0, 0, 44 * k, 22 * k);
    g.fill(m.screenGlow);
  }
}

/** A task chair's back above the desk (the seat hides behind the desk). */
export function drawChair(g: Graphics, p: ScenePalette, boss = false): void {
  const m = p.materials;
  const fill = boss ? m.bossChair : m.chair;
  const light = boss ? m.bossChairLight : m.chairLight;
  const dark = boss ? m.bossChairDark : m.chairDark;
  const half = boss ? 21 : 17;
  const top = boss ? -24 : -12;
  const bottom = 30;
  // Armrests on both sides, just above the desk top
  for (const side of [-1, 1]) {
    const ax = side < 0 ? -half - 9 : half + 1;
    box(g, ax, 16, 8, 5, dark, m.outline);
    wash(g, ax + 1, 17, 6, 1, { color: light, alpha: 1 });
    box(g, ax + (side < 0 ? 5 : 1), 20, 2, 10, m.outline);
  }
  // Back cushion: rounded top, darker frame round a lighter pad
  g.roundRect(-half, top, half * 2, bottom - top, 10);
  g.fill(m.outline);
  g.roundRect(-half + 1, top + 1, half * 2 - 2, bottom - top - 2, 9);
  g.fill(dark);
  g.roundRect(-half + 3, top + 3, half * 2 - 6, bottom - top - 9, 7);
  g.fill(fill);
  // Lit top-left edge of the pad
  wash(g, -half + 8, top + 3, half * 2 - 18, 1, { color: light, alpha: 1 });
  wash(g, -half + 3, top + 9, 1, bottom - top - 20, { color: light, alpha: 1 });
  if (boss) {
    // Tufted leather: two rows of buttons
    for (const ty of [top + 12, top + 24]) {
      for (const tx of [-10, 0, 10]) box(g, tx - 1, ty, 2, 2, dark);
    }
  } else {
    // A lumbar band across the mesh
    wash(g, -half + 4, top + 22, half * 2 - 8, 2, { color: dark, alpha: 0.6 });
  }
}

/** The boss's rug: a framed field with a border pattern and corner marks. */
export function drawRug(
  g: Graphics,
  p: ScenePalette,
  w: number,
  h: number,
): void {
  const x = -w / 2;
  const y = -h / 2;
  dropShadow(g, x, y, w, h, {
    color: p.shadow.color,
    alpha: p.shadow.alpha * 0.6,
  });
  box(g, x, y, w, h, p.rugBorder, p.materials.outline);
  box(g, x + 4, y + 4, w - 8, h - 8, p.rug);
  // Border pattern: a run of small diamonds between two lines
  box(g, x + 8, y + 8, w - 16, 1, p.rugPattern);
  box(g, x + 8, y + h - 9, w - 16, 1, p.rugPattern);
  box(g, x + 8, y + 8, 1, h - 16, p.rugPattern);
  box(g, x + w - 9, y + 8, 1, h - 16, p.rugPattern);
  for (let dx = x + 16; dx < x + w - 14; dx += 12) {
    box(g, dx, y + 12, 3, 3, p.rugPattern);
    box(g, dx, y + h - 15, 3, 3, p.rugPattern);
  }
  box(g, x + 20, y + 20, w - 40, h - 40, p.rugInner);
  box(g, x + 20, y + 20, w - 40, 1, p.rugBorder);
  box(g, x + 20, y + h - 21, w - 40, 1, p.rugBorder);
  // Corner marks in the inner field
  for (const [cx, cy] of [
    [x + 26, y + 26],
    [x + w - 32, y + 26],
    [x + 26, y + h - 32],
    [x + w - 32, y + h - 32],
  ]) {
    box(g, cx, cy + 2, 6, 2, p.rugPattern);
    box(g, cx + 2, cy, 2, 6, p.rugPattern);
  }
  // A fringe at the short ends
  for (let fy = y + 4; fy < y + h - 4; fy += 4) {
    box(g, x - 3, fy, 3, 2, p.rugBorder);
    box(g, x + w, fy, 3, 2, p.rugBorder);
  }
}

export type PlantKind = "leafy" | "tall" | "round";

/**
 * A potted plant standing at (0, 0) = the bottom of its pot. `size` scales
 * the whole plant (1 is about 64 px tall).
 */
export function drawPlant(
  g: Graphics,
  p: ScenePalette,
  kind: PlantKind,
  size = 1,
  seed = 1,
): void {
  const m = p.materials;
  const s = size;
  const potW = Math.round(26 * s);
  const potH = Math.round(20 * s);
  ovalShadow(g, 2, 0, potW * 0.62, p.shadow);
  // Leaves first, the pot over their stems
  const leaf = (cx: number, cy: number, rx: number, ry: number, c: number) => {
    g.ellipse(Math.round(cx), Math.round(cy), rx, ry);
    g.fill(c);
  };
  const top = -potH;
  if (kind === "tall") {
    // Snake plant: upright blades with light edges
    const blades = [-9, -4, 1, 6, 10];
    blades.forEach((bx, i) => {
      const h = (34 + ((i * 7 + seed * 3) % 14)) * s;
      const bw = 5 * s;
      const x = bx * s - bw / 2;
      g.roundRect(
        Math.round(x),
        Math.round(top - h + 4),
        Math.round(bw),
        Math.round(h),
        2,
      );
      g.fill(m.outline);
      g.roundRect(
        Math.round(x + 1),
        Math.round(top - h + 5),
        Math.round(bw - 2),
        Math.round(h - 2),
        2,
      );
      g.fill(i % 2 ? m.leaf : m.leafDark);
      wash(g, x + 1, top - h + 7, 1, h - 8, { color: m.leafLight, alpha: 0.9 });
    });
  } else {
    const r = (kind === "round" ? 15 : 13) * s;
    const cy = top - r * 0.9;
    // Outline pass, then dark, mid and light leaf clusters
    const blobs: Array<[number, number, number]> =
      kind === "round"
        ? [
            [0, 0, 1],
            [-0.6, 0.2, 0.7],
            [0.6, 0.25, 0.7],
            [0, -0.55, 0.65],
          ]
        : [
            [0, 0, 0.8],
            [-0.8, 0.1, 0.62],
            [0.8, -0.05, 0.62],
            [-0.35, -0.75, 0.6],
            [0.45, -0.85, 0.55],
            [0, -1.35, 0.45],
          ];
    for (const [bx, by, br] of blobs)
      leaf(bx * r, cy + by * r, br * r + 1, br * r * 0.85 + 1, m.outline);
    for (const [bx, by, br] of blobs)
      leaf(bx * r, cy + by * r, br * r, br * r * 0.85, m.leafDark);
    for (const [bx, by, br] of blobs)
      leaf(
        bx * r - br * r * 0.15,
        cy + by * r - br * r * 0.2,
        br * r * 0.72,
        br * r * 0.6,
        m.leaf,
      );
    for (const [bx, by, br] of blobs)
      leaf(
        bx * r - br * r * 0.35,
        cy + by * r - br * r * 0.38,
        br * r * 0.3,
        br * r * 0.22,
        m.leafLight,
      );
  }
  // Pot: a ceramic planter with a rim, lit on the left
  const px = -potW / 2;
  box(g, px, top, potW, potH, m.pot, m.outline);
  box(g, px + 1, top + potH - 4, potW - 2, 3, m.potDark);
  wash(g, px + 2, top + 3, 2, potH - 7, { color: m.potLight, alpha: 1 });
  wash(g, px + potW - 4, top + 3, 2, potH - 7, {
    color: m.potDark,
    alpha: 0.7,
  });
  box(g, px - 2, top - 2, potW + 4, 5, m.pot, m.outline);
  box(g, px + 2, top - 1, potW - 4, 2, m.soil);
  wash(g, px - 1, top + 1, potW / 2, 1, { color: m.potLight, alpha: 0.8 });
}

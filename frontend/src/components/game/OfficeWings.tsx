"use client";

/**
 * OfficeWings - the office around the room on a wider or taller stage.
 *
 * Draws the zones placed by utils/officeWings.ts in the same flat pixel
 * style and theme materials as the room (systems/scenePalette.ts): a
 * kitchenette, a lounge with a sofa and a window, a library, a server
 * corner with blinking racks, a meeting table, high windows above the wall
 * and planters and benches below the floor. Every piece has the shared 1 px
 * outline and a flat shadow falling down-right. Purely decorative: the zones
 * lie outside the room, nobody walks there. The windows show the scene
 * clock's sky; the night lamps are lit by DayNightLayer (wingLights).
 */

import { memo, useCallback, useMemo, type ReactNode } from "react";
import type { Graphics } from "pixi.js";
import type { WingItem } from "@/utils/officeWings";
import { useSceneHours } from "@/systems/sceneClock";
import { computeTimeState } from "./city/timeUtils";
import { getInterpolatedSkyColors } from "./city/skyRenderer";
import { useTickValue } from "./shared/useSceneTick";
import { isReducedMotion } from "@/systems/reducedMotion";
import { useTheme } from "@/systems/themeStore";
import {
  scenePalette,
  type SceneMaterials,
  type ScenePalette,
} from "@/systems/scenePalette";
import { box, dropShadow, mix, ovalShadow, wash } from "./shared/pixelDraw";
import { drawPlant, type PlantKind } from "./shared/furniture";

// ============================================================================
// DRAWING HELPERS
// ============================================================================

/** Shorthands bound to the theme: an outlined box and a lit top edge. */
interface Pen {
  p: ScenePalette;
  m: SceneMaterials;
  /** An outlined box. */
  o: (x: number, y: number, w: number, h: number, fill: number) => void;
  /** A plain box. */
  f: (x: number, y: number, w: number, h: number, fill: number) => void;
  /** A lit 1 px line along the top of a box. */
  lit: (x: number, y: number, w: number) => void;
  shadow: (x: number, y: number, w: number, h: number) => void;
  oval: (cx: number, cy: number, rx: number) => void;
}

function pen(g: Graphics, p: ScenePalette): Pen {
  const m = p.materials;
  return {
    p,
    m,
    o: (x, y, w, h, fill) => box(g, x, y, w, h, fill, m.outline),
    f: (x, y, w, h, fill) => box(g, x, y, w, h, fill),
    lit: (x, y, w) => wash(g, x, y, w, 1, { color: 0xffffff, alpha: 0.22 }),
    shadow: (x, y, w, h) => dropShadow(g, x, y, w, h, p.shadow),
    oval: (cx, cy, rx) => ovalShadow(g, cx, cy, rx, p.shadow),
  };
}

/** A framed window onto the sky (the scene clock's colours). */
function skyWindow(
  g: Graphics,
  d: Pen,
  x: number,
  y: number,
  w: number,
  h: number,
  sky: readonly number[],
  mullions: number,
): void {
  const { p, m } = d;
  d.o(x - 6, y - 6, w + 12, h + 12, p.frame);
  wash(g, x - 5, y - 5, w + 10, 1, { color: p.frameLight, alpha: 1 });
  const band = h / sky.length;
  sky.forEach((c, i) => {
    g.rect(x, y + i * band, w, band + 1);
    g.fill(c);
  });
  // A faint skyline at the bottom of the pane
  const sky0 = sky[sky.length - 1];
  const dark = sky0 === sky[0] ? 0x0b0b18 : 0x1b2433;
  let bx = x;
  let n = Math.round(x * 13) & 0xff;
  while (bx < x + w) {
    n = (n * 73 + 41) & 0xff;
    const bw = Math.min(14 + (n % 18), x + w - bx);
    const bh = Math.min(h * 0.45, 12 + (n % 30));
    g.rect(bx, y + h - bh, bw, bh);
    g.fill({ color: dark, alpha: 0.75 });
    bx += bw + 2;
  }
  // Glass glint, the set-back shade and the mullions
  g.poly([x + 8, y, x + 20, y, x, y + 26, x, y + 12]);
  g.fill({ color: 0xffffff, alpha: 0.12 });
  wash(g, x, y, w, 2, { color: 0x000000, alpha: 0.25 });
  for (let i = 1; i <= mullions; i++) {
    d.f(x + (w * i) / (mullions + 1) - 2, y, 4, h, p.frame);
  }
  d.f(x, y + h / 2 - 2, w, 4, p.frame);
  // Sill
  d.o(x - 10, y + h + 5, w + 20, 7, m.woodLight);
  d.lit(x - 9, y + h + 6, w + 18);
}

function bookshelf(
  g: Graphics,
  d: Pen,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const { m } = d;
  d.shadow(x, y + h - 6, w, 8);
  d.o(x, y, w, h, m.woodDark);
  d.lit(x + 1, y + 1, w - 2);
  const shelves = 4;
  const sh = (h - 8) / shelves;
  for (let s = 0; s < shelves; s++) {
    const top = Math.round(y + 4 + s * sh);
    d.f(x + 4, top, w - 8, sh - 4, mix(m.woodDark, 0x000000, 0.35));
    // Books of varied width and height, the same every render
    let bx = x + 6;
    let n = (s * 31 + Math.round(x)) & 0xff;
    while (bx < x + w - 12) {
      n = (n * 57 + 23) & 0xff;
      const bw = 5 + (n % 5);
      const bh = Math.round(sh - 8 - (n % 7));
      if (n % 11 === 0) {
        bx += bw + 3; // a gap
        continue;
      }
      const color = m.books[n % m.books.length];
      d.f(bx, top + sh - 4 - bh, bw, bh, color);
      wash(g, bx, top + sh - 4 - bh, 1, bh, { color: 0xffffff, alpha: 0.18 });
      wash(g, bx + 1, top + sh - 4 - bh + 3, bw - 2, 1, {
        color: 0x000000,
        alpha: 0.25,
      });
      bx += bw + 1;
    }
    d.f(x + 2, top + sh - 4, w - 4, 4, m.wood);
    d.lit(x + 2, top + sh - 4, w - 4);
  }
}

/** An upholstered armchair facing the room. */
function armchair(d: Pen, x: number, y: number, w: number) {
  const { m } = d;
  d.shadow(x - 8, y + 54, w + 16, 10);
  d.o(x, y, w, 34, m.armchairDark);
  d.lit(x + 1, y + 1, w - 2);
  d.o(x, y + 28, w, 36, m.armchair);
  d.lit(x + 2, y + 29, w - 4);
  d.o(x - 8, y + 10, 14, 54, m.armchairDark);
  d.o(x + w - 6, y + 10, 14, 54, m.armchairDark);
  d.lit(x - 7, y + 11, 12);
  d.lit(x + w - 5, y + 11, 12);
}

/** A floor lamp standing at (cx, foot y). */
function floorLamp(g: Graphics, d: Pen, cx: number, foot: number, h: number) {
  const { m } = d;
  d.oval(cx, foot, 12);
  g.ellipse(cx, foot - 2, 12, 4);
  g.fill(m.metalDark);
  d.f(cx - 1, foot - h, 3, h, m.metalDark);
  g.poly([
    cx - 16,
    foot - h + 2,
    cx + 16,
    foot - h + 2,
    cx + 10,
    foot - h - 22,
    cx - 10,
    foot - h - 22,
  ]);
  g.fill(m.outline);
  g.poly([
    cx - 14,
    foot - h + 1,
    cx + 14,
    foot - h + 1,
    cx + 9,
    foot - h - 21,
    cx - 9,
    foot - h - 21,
  ]);
  g.fill(m.lampShade);
  wash(g, cx - 13, foot - h, 26, 1, { color: 0x000000, alpha: 0.15 });
}

// ============================================================================
// ZONES (x0 = the zone's left edge; y in room coordinates)
// ============================================================================

function kitchen(g: Graphics, d: Pen, x0: number): void {
  const { m } = d;
  // Upper cabinets with a warm light strip under them
  d.o(x0 + 8, 64, 164, 60, m.woodLight);
  d.lit(x0 + 9, 65, 162);
  for (let i = 1; i < 3; i++)
    d.f(x0 + 8 + (164 * i) / 3 - 1, 64, 2, 60, m.woodDark);
  for (let i = 0; i < 3; i++)
    d.f(x0 + 8 + (164 * (i + 0.5)) / 3 - 2, 110, 4, 6, m.metalDark);
  d.f(x0 + 10, 124, 160, 3, m.lampShade);
  wash(g, x0 + 10, 127, 160, 10, { color: m.lampShade, alpha: 0.12 });
  // Tiled splashback between the cabinets and the counter
  for (let ty = 140; ty < 212; ty += 12) {
    for (let tx = 8; tx < 176; tx += 16) {
      wash(g, x0 + tx, ty, 15, 11, { color: 0xffffff, alpha: 0.05 });
    }
  }
  // Fridge
  d.shadow(x0 + 178, 284, 56, 10);
  d.o(x0 + 178, 92, 56, 200, m.appliance);
  d.lit(x0 + 179, 93, 54);
  d.f(x0 + 179, 160, 54, 2, m.applianceLine);
  d.f(x0 + 222, 120, 4, 26, m.metal);
  d.f(x0 + 222, 176, 4, 40, m.metal);
  wash(g, x0 + 180, 95, 3, 194, { color: 0xffffff, alpha: 0.25 });
  // Counter: stone top, wooden doors, toe kick
  d.shadow(x0 + 6, 290, 170, 10);
  d.o(x0 + 6, 214, 170, 22, m.stone);
  d.lit(x0 + 7, 215, 168);
  d.o(x0 + 6, 235, 170, 57, m.wood);
  for (let i = 1; i < 4; i++)
    d.f(x0 + 6 + (170 * i) / 4 - 1, 240, 2, 50, m.woodDark);
  for (let i = 0; i < 4; i++)
    d.f(x0 + 6 + (170 * (i + 0.5)) / 4 - 3, 246, 6, 2, m.metalDark);
  d.f(x0 + 7, 291, 168, 6, m.outline);
  // Sink and tap
  d.o(x0 + 28, 218, 52, 14, m.metal);
  d.f(x0 + 31, 221, 46, 8, m.metalDark);
  d.o(x0 + 51, 200, 5, 20, m.metal);
  d.o(x0 + 51, 200, 15, 5, m.metal);
  // Kettle and microwave
  d.o(x0 + 96, 198, 18, 18, 0xc0443a);
  d.lit(x0 + 97, 199, 16);
  d.o(x0 + 128, 186, 44, 30, m.graphiteLight);
  d.f(x0 + 132, 190, 26, 22, m.screen);
  d.f(x0 + 162, 194, 6, 3, m.accent);
  // Bistro table with two stools
  d.oval(x0 + 120, 588, 40);
  d.f(x0 + 117, 540, 6, 46, m.metalDark);
  g.ellipse(x0 + 120, 586, 22, 6);
  g.fill(m.metalDark);
  g.ellipse(x0 + 120, 524, 47, 23);
  g.fill(m.outline);
  g.ellipse(x0 + 120, 524, 46, 22);
  g.fill(m.woodLight);
  g.ellipse(x0 + 116, 520, 34, 14);
  g.fill({ color: 0xffffff, alpha: 0.08 });
  d.o(x0 + 104, 510, 12, 12, m.paper); // a cup
  for (const sx of [44, 196]) {
    d.oval(x0 + sx, 592, 16);
    d.f(x0 + sx - 2, 560, 4, 30, m.metalDark);
    g.ellipse(x0 + sx, 558, 17, 9);
    g.fill(m.outline);
    g.ellipse(x0 + sx, 558, 16, 8);
    g.fill(m.armchair);
    g.ellipse(x0 + sx - 3, 556, 9, 4);
    g.fill({ color: 0xffffff, alpha: 0.15 });
  }
  // Recycling bins
  for (const [bx, color] of [
    [150, 0x3f6688],
    [184, 0x4f7f4a],
  ] as const) {
    d.shadow(x0 + bx, 916, 28, 8);
    d.o(x0 + bx, 878, 28, 44, color);
    d.f(x0 + bx + 1, 879, 26, 5, mix(color, 0x000000, 0.35));
    d.lit(x0 + bx + 1, 885, 26);
  }
}

function lounge(g: Graphics, d: Pen, x0: number, sky: readonly number[]): void {
  const { m } = d;
  skyWindow(g, d, x0 + 34, 40, 172, 126, sky, 1);
  // Rug
  g.roundRect(x0 + 8, 448, 224, 276, 10);
  g.fill(m.outline);
  g.roundRect(x0 + 9, 449, 222, 274, 9);
  g.fill(d.p.rug);
  g.roundRect(x0 + 18, 458, 204, 256, 6);
  g.stroke({ width: 2, color: d.p.rugBorder, alpha: 0.9, alignment: 1 });
  g.roundRect(x0 + 30, 470, 180, 232, 4);
  g.stroke({ width: 1, color: d.p.rugPattern, alpha: 0.5, alignment: 1 });
  // Sofa, its back to the wall, facing the room
  d.shadow(x0 + 20, 548, 192, 10);
  d.o(x0 + 28, 470, 176, 44, m.sofaDark);
  d.lit(x0 + 29, 471, 174);
  for (const cx of [0, 1, 2]) {
    g.roundRect(x0 + 40 + cx * 52, 478, 48, 30, 5);
    g.fill(m.sofaLight);
    wash(g, x0 + 43 + cx * 52, 479, 42, 1, { color: 0xffffff, alpha: 0.2 });
  }
  d.o(x0 + 28, 508, 176, 40, m.sofa);
  d.lit(x0 + 30, 509, 172);
  d.o(x0 + 18, 482, 20, 70, m.sofaDark);
  d.o(x0 + 194, 482, 20, 70, m.sofaDark);
  d.lit(x0 + 19, 483, 18);
  d.lit(x0 + 195, 483, 18);
  d.f(x0 + 24, 552, 6, 6, m.outline);
  d.f(x0 + 202, 552, 6, 6, m.outline);
  // Coffee table with a mug and a magazine
  d.shadow(x0 + 66, 640, 108, 10);
  d.o(x0 + 66, 604, 108, 30, m.woodLight);
  d.lit(x0 + 67, 605, 106);
  d.f(x0 + 72, 634, 6, 14, m.woodDark);
  d.f(x0 + 162, 634, 6, 14, m.woodDark);
  d.o(x0 + 84, 610, 30, 18, m.paper);
  d.f(x0 + 88, 614, 16, 2, m.applianceLine);
  d.f(x0 + 88, 619, 22, 1, m.applianceLine);
  d.o(x0 + 140, 606, 12, 12, m.paper);
  // Floor lamp and an armchair further down
  floorLamp(g, d, x0 + 222, 560, 112);
  armchair(d, x0 + 42, 852, 76);
}

function library(g: Graphics, d: Pen, x0: number): void {
  const { m, p } = d;
  // A small framed print above the shelves
  d.shadow(x0 + 96, 34, 48, 40);
  d.o(x0 + 96, 34, 48, 40, m.woodLight);
  d.f(x0 + 100, 38, 40, 32, m.paper);
  d.f(x0 + 104, 42, 32, 24, mix(p.wallBottom, m.leaf, 0.5));
  g.circle(x0 + 128, 50, 4);
  g.fill(p.award);
  g.poly([
    x0 + 104,
    66,
    x0 + 116,
    52,
    x0 + 124,
    60,
    x0 + 130,
    56,
    x0 + 136,
    66,
  ]);
  g.fill(m.leafDark);
  bookshelf(g, d, x0 + 10, 86, 104, 206);
  bookshelf(g, d, x0 + 126, 86, 104, 206);
  // Reading corner: armchair, side table, lamp
  armchair(d, x0 + 52, 524, 80);
  d.oval(x0 + 184, 604, 22);
  d.f(x0 + 182, 572, 4, 30, m.woodDark);
  g.ellipse(x0 + 184, 570, 23, 10);
  g.fill(m.outline);
  g.ellipse(x0 + 184, 570, 22, 9);
  g.fill(m.woodLight);
  d.f(x0 + 182, 540, 4, 26, m.metalDark);
  g.poly([x0 + 170, 543, x0 + 198, 543, x0 + 192, 521, x0 + 176, 521]);
  g.fill(m.outline);
  g.poly([x0 + 172, 542, x0 + 196, 542, x0 + 191, 522, x0 + 177, 522]);
  g.fill(m.lampShade);
  // A stack of books on the floor
  d.shadow(x0 + 148, 900, 38, 8);
  d.o(x0 + 150, 900, 36, 8, m.books[1]);
  d.o(x0 + 154, 892, 30, 9, m.books[0]);
  d.o(x0 + 148, 884, 34, 9, m.books[2]);
}

function servers(g: Graphics, d: Pen, x0: number): void {
  const { m } = d;
  // Cable tray and an "IT" plate on the wall
  d.o(x0 + 8, 56, 224, 10, m.metal);
  for (let x = x0 + 16; x < x0 + 228; x += 16) d.f(x, 58, 2, 6, m.metalDark);
  d.o(x0 + 196, 28, 34, 22, m.screen);
  d.f(x0 + 203, 35, 3, 9, m.accent);
  d.f(x0 + 210, 35, 13, 3, m.accent);
  d.f(x0 + 215, 35, 3, 9, m.accent);
  // Two racks (their LEDs blink in a layer of their own)
  for (const rx of [16, 108]) {
    d.shadow(x0 + rx, 284, 82, 10);
    d.o(x0 + rx, 88, 82, 204, m.graphite);
    d.lit(x0 + rx + 1, 89, 80);
    for (let u = 0; u < 11; u++) {
      const y = 96 + u * 17;
      d.f(x0 + rx + 6, y, 70, 13, u % 4 === 3 ? m.screen : m.graphiteLight);
      wash(g, x0 + rx + 6, y, 70, 1, { color: 0xffffff, alpha: 0.08 });
      for (let s = 0; s < 6; s++)
        d.f(x0 + rx + 26 + s * 8, y + 4, 5, 5, m.screen);
    }
    d.f(x0 + rx + 78, 120, 2, 40, m.metal);
  }
  // UPS box
  d.shadow(x0 + 198, 284, 34, 8);
  d.o(x0 + 198, 236, 34, 56, m.graphiteLight);
  d.f(x0 + 204, 244, 22, 8, m.screen);
  d.f(x0 + 206, 246, 6, 4, m.accent);
  // Two bean bags for a break
  for (const [bx, color] of [
    [70, m.sofaLight],
    [170, m.armchair],
  ] as const) {
    d.oval(x0 + bx, 600, 38);
    g.ellipse(x0 + bx, 578, 39, 27);
    g.fill(m.outline);
    g.ellipse(x0 + bx, 578, 38, 26);
    g.fill(color);
    g.ellipse(x0 + bx + 4, 588, 30, 14);
    g.fill({ color: 0x000000, alpha: 0.12 });
    g.ellipse(x0 + bx - 8, 568, 18, 9);
    g.fill({ color: 0xffffff, alpha: 0.16 });
  }
}

function meeting(g: Graphics, d: Pen, x0: number): void {
  const { m, p } = d;
  // Wall screen with a chart
  d.shadow(x0 + 36, 52, 168, 100);
  d.o(x0 + 36, 52, 168, 100, m.graphite);
  d.f(x0 + 42, 58, 156, 88, m.screen);
  const bars = [30, 46, 38, 60, 52, 70];
  bars.forEach((b, i) => {
    g.rect(x0 + 56 + i * 22, 136 - b, 14, b);
    g.fill({ color: m.accent, alpha: 0.55 + i * 0.07 });
  });
  d.f(x0 + 50, 66, 60, 3, p.frameLight);
  d.f(x0 + 112, 152, 16, 10, m.graphite);
  // Long table with six chairs
  d.shadow(x0 + 56, 650, 128, 14);
  for (const cy of [498, 556, 614]) {
    d.o(x0 + 30, cy, 26, 28, m.chair);
    d.lit(x0 + 31, cy + 1, 24);
    d.o(x0 + 24, cy - 2, 9, 32, m.chairDark);
    d.o(x0 + 184, cy, 26, 28, m.chair);
    d.lit(x0 + 185, cy + 1, 24);
    d.o(x0 + 207, cy - 2, 9, 32, m.chairDark);
  }
  d.o(x0 + 56, 472, 128, 186, m.deskTop);
  wash(g, x0 + 57, 473, 126, 1, { color: m.deskTopLight, alpha: 1 });
  wash(g, x0 + 57, 474, 1, 182, { color: m.deskTopLight, alpha: 1 });
  d.o(x0 + 56, 656, 128, 10, m.deskEdge);
  // Papers, a laptop, a water jug
  d.o(x0 + 70, 500, 30, 22, m.paper);
  d.f(x0 + 74, 505, 18, 1, m.applianceLine);
  d.f(x0 + 74, 509, 22, 1, m.applianceLine);
  d.o(x0 + 134, 560, 34, 22, m.graphiteLight);
  d.f(x0 + 138, 564, 26, 14, m.screen);
  d.f(x0 + 140, 566, 10, 2, m.accent);
  d.o(x0 + 78, 600, 14, 22, mix(m.paper, 0x74c7f5, 0.45));
  wash(g, x0 + 80, 602, 2, 18, { color: 0xffffff, alpha: 0.5 });
}

function tallPlant(g: Graphics, d: Pen, item: WingItem): void {
  const { m, p } = d;
  const cx = item.x + item.w / 2;
  d.shadow(cx - 22, 70, 44, 54);
  d.o(cx - 22, 70, 44, 54, m.woodLight);
  d.f(cx - 18, 74, 36, 46, m.paper);
  d.f(cx - 15, 77, 30, 40, mix(p.wallBottom, 0x74c7f5, 0.35));
  g.poly([cx - 15, 117, cx - 2, 96, cx + 6, 106, cx + 15, 98, cx + 15, 117]);
  g.fill(m.leafDark);
}

function highWindow(
  g: Graphics,
  d: Pen,
  item: WingItem,
  sky: readonly number[],
) {
  skyWindow(g, d, item.x + 6, item.y + 6, item.w - 12, item.h - 24, sky, 2);
}

function planter(g: Graphics, d: Pen, item: WingItem): void {
  const { m } = d;
  const base = item.y + item.h - 6;
  d.shadow(item.x, base - 8, item.w, 10);
  const shrubs = Math.max(3, Math.floor(item.w / 34));
  for (let i = 0; i < shrubs; i++) {
    const cx = item.x + 18 + (i * (item.w - 36)) / (shrubs - 1);
    g.circle(cx, base - 30, 19);
    g.fill(m.outline);
    g.circle(cx, base - 30, 18);
    g.fill(m.leafDark);
    g.circle(cx - 3, base - 33, 13);
    g.fill(m.leaf);
    g.circle(cx - 7, base - 38, 6);
    g.fill(m.leafLight);
  }
  d.o(item.x, base - 26, item.w, 26, m.wood);
  d.f(item.x + 1, base - 25, item.w - 2, 4, m.woodLight);
  d.lit(item.x + 1, base - 25, item.w - 2);
}

function bench(d: Pen, item: WingItem): void {
  const { m } = d;
  const base = item.y + item.h - 6;
  d.shadow(item.x, base - 8, item.w, 10);
  d.o(item.x + 10, base - 18, 8, 18, m.metalDark);
  d.o(item.x + item.w - 18, base - 18, 8, 18, m.metalDark);
  for (let i = 0; i < 3; i++) {
    d.o(item.x, base - 40 + i * 8, item.w, 7, i === 0 ? m.woodLight : m.wood);
  }
  d.lit(item.x + 1, base - 39, item.w - 2);
}

/** Floor patches that mark the zones: kitchen tiles, a raised server floor, rugs. */
function zoneFloors(g: Graphics, d: Pen, items: readonly WingItem[]) {
  const { m, p } = d;
  // Tiles take some of the floor's tone (the dark theme much more of it)
  const tileMix = p.tileTone;
  for (const item of items) {
    const x0 = item.x;
    if (item.kind === "kitchen") {
      const a = mix(m.stone, p.planks[0], tileMix);
      const b = mix(m.stone, p.planks[0], tileMix + 0.2);
      for (let y = 250, r = 0; y < 650; y += 24, r++) {
        for (let x = 0, c = 0; x < 240; x += 24, c++) {
          g.rect(x0 + x, y, 24, Math.min(24, 650 - y));
          g.fill((r + c) % 2 ? a : b);
          wash(g, x0 + x, y, 24, 1, { color: 0xffffff, alpha: 0.08 });
        }
      }
      d.f(x0, 648, 240, 3, m.applianceLine);
    } else if (item.kind === "servers") {
      for (let y = 250; y < 370; y += 30) {
        for (let x = 0; x < 240; x += 30) {
          d.o(x0 + x, y, 30, 30, mix(m.metal, p.planks[0], tileMix));
          d.lit(x0 + x + 1, y + 1, 28);
          d.f(x0 + x + 13, y + 13, 4, 4, m.metalDark);
        }
      }
    } else if (item.kind === "meeting") {
      g.roundRect(x0 + 12, 448, 216, 246, 8);
      g.fill(m.outline);
      g.roundRect(x0 + 13, 449, 214, 244, 7);
      g.fill(p.carpet);
      g.roundRect(x0 + 22, 458, 196, 226, 4);
      g.stroke({ width: 1, color: p.carpetLine, alpha: 0.35, alignment: 1 });
    } else if (item.kind === "library") {
      g.ellipse(x0 + 116, 580, 111, 63);
      g.fill(m.outline);
      g.ellipse(x0 + 116, 580, 110, 62);
      g.fill(p.rug);
      g.ellipse(x0 + 116, 580, 96, 52);
      g.stroke({ width: 2, color: p.rugBorder, alpha: 0.8 });
    }
  }
}

function drawWings(
  g: Graphics,
  items: readonly WingItem[],
  sky: readonly number[],
  p: ScenePalette,
): void {
  g.clear();
  const d = pen(g, p);
  zoneFloors(g, d, items);
  for (const item of items) {
    switch (item.kind) {
      case "kitchen":
        kitchen(g, d, item.x);
        break;
      case "lounge":
        lounge(g, d, item.x, sky);
        break;
      case "library":
        library(g, d, item.x);
        break;
      case "servers":
        servers(g, d, item.x);
        break;
      case "meeting":
        meeting(g, d, item.x);
        break;
      case "tallPlant":
        tallPlant(g, d, item);
        break;
      case "highWindow":
        highWindow(g, d, item, sky);
        break;
      case "planter":
        planter(g, d, item);
        break;
      case "bench":
        bench(d, item);
        break;
    }
  }
}

/** The racks' LEDs: a pattern that changes every `step`. */
function drawLeds(
  g: Graphics,
  items: readonly WingItem[],
  step: number,
  m: SceneMaterials,
) {
  g.clear();
  for (const item of items) {
    if (item.kind !== "servers") continue;
    for (const rx of [16, 108]) {
      for (let u = 0; u < 11; u++) {
        if (u % 4 === 3) continue;
        const n = (u * 7 + rx + step * 13) % 10;
        const y = 96 + u * 17 + 4;
        g.rect(item.x + rx + 10, y, 4, 4);
        g.fill(n < 7 ? m.accent : mix(m.accent, m.screen, 0.7));
        g.rect(item.x + rx + 16, y, 4, 4);
        g.fill(
          n === 3 || n === 8 ? m.ledAmber : mix(m.ledAmber, m.screen, 0.75),
        );
      }
    }
  }
}

/** The shadow where the zones' furniture meets the wall (keeps wings in the same room). */
function drawWingFloorTone(
  g: Graphics,
  items: readonly WingItem[],
  p: ScenePalette,
): void {
  g.clear();
  for (const item of items) {
    if (item.side !== "left" && item.side !== "right") continue;
    if (item.kind === "tallPlant") continue;
    g.rect(item.x, 292, item.w, 8);
    g.fill({ color: p.shadow.color, alpha: p.shadow.alpha * 0.4 });
  }
}

/** Potted plants, relative to each zone (the floor under the pot). */
const PLANTS: Partial<
  Record<
    WingItem["kind"],
    ReadonlyArray<{ x: number; y: number; s: number; k: PlantKind }>
  >
> = {
  kitchen: [{ x: 66, y: 937, s: 1.15, k: "leafy" }],
  lounge: [{ x: 196, y: 943, s: 1.35, k: "round" }],
  library: [{ x: 70, y: 940, s: 1.25, k: "tall" }],
  servers: [{ x: 120, y: 940, s: 1.25, k: "leafy" }],
  meeting: [
    { x: 44, y: 936, s: 1, k: "tall" },
    { x: 196, y: 940, s: 1.25, k: "round" },
  ],
};

function plantSpots(items: readonly WingItem[]) {
  const out: Array<{ x: number; y: number; s: number; k: PlantKind }> = [];
  for (const item of items) {
    if (item.kind === "tallPlant") {
      const cx = item.x + item.w / 2;
      out.push(
        { x: cx, y: 606, s: 1.4, k: "tall" },
        { x: cx, y: 937, s: 1.15, k: "leafy" },
      );
      continue;
    }
    for (const p of PLANTS[item.kind] ?? []) {
      out.push({ x: item.x + p.x, y: p.y, s: p.s, k: p.k });
    }
  }
  return out;
}

function drawPlants(
  g: Graphics,
  items: readonly WingItem[],
  p: ScenePalette,
): void {
  g.clear();
  plantSpots(items).forEach((spot, i) => {
    g.setTransform(1, 0, 0, 1, spot.x, spot.y);
    drawPlant(g, p, spot.k, spot.s, i + 3);
  });
  g.resetTransform();
}

// ============================================================================
// COMPONENT
// ============================================================================

interface OfficeWingsProps {
  items: readonly WingItem[];
}

function OfficeWingsComponent({ items }: OfficeWingsProps): ReactNode {
  const hours = useSceneHours();
  const sky = useMemo(() => {
    const { phase, progress } = computeTimeState(hours, new Date());
    return getInterpolatedSkyColors(phase, progress);
  }, [hours]);
  const palette = scenePalette(useTheme());

  const draw = useCallback(
    (g: Graphics) => drawWings(g, items, sky, palette),
    [items, sky, palette],
  );
  const drawTone = useCallback(
    (g: Graphics) => drawWingFloorTone(g, items, palette),
    [items, palette],
  );
  const drawPlantLayer = useCallback(
    (g: Graphics) => drawPlants(g, items, palette),
    [items, palette],
  );

  const hasRacks = items.some((i) => i.kind === "servers");
  const step = useTickValue(hasRacks && !isReducedMotion(), (ms) =>
    Math.floor(ms / 700),
  );
  const drawLedLayer = useCallback(
    (g: Graphics) => drawLeds(g, items, step, palette.materials),
    [items, step, palette],
  );

  if (items.length === 0) return null;
  return (
    <>
      <pixiGraphics draw={drawTone} />
      <pixiGraphics draw={draw} />
      {hasRacks && <pixiGraphics draw={drawLedLayer} />}
      <pixiGraphics draw={drawPlantLayer} />
    </>
  );
}

export const OfficeWings = memo(OfficeWingsComponent);

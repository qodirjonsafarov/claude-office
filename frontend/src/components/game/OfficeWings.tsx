"use client";

/**
 * OfficeWings - the office around the room on a wider or taller stage.
 *
 * Draws the zones placed by utils/officeWings.ts in the same flat pixel
 * style as the room: a kitchenette, a lounge with a sofa and a window, a
 * library, a server corner with blinking racks, a meeting table, high
 * windows above the wall and planters and benches below the floor. Purely
 * decorative: the zones lie outside the room, nobody walks there. The
 * windows show the scene clock's sky; the night lamps are lit by
 * DayNightLayer (wingLights).
 */

import { memo, useCallback, useMemo, type ReactNode } from "react";
import type { Graphics, Texture } from "pixi.js";
import type { WingItem } from "@/utils/officeWings";
import { useSceneHours } from "@/systems/sceneClock";
import { computeTimeState } from "./city/timeUtils";
import { getInterpolatedSkyColors } from "./city/skyRenderer";
import { useTickValue } from "./shared/useSceneTick";
import { isReducedMotion } from "@/systems/reducedMotion";
import { useTheme } from "@/systems/themeStore";
import { scenePalette, type ScenePalette } from "@/systems/scenePalette";
import { shade } from "@/systems/colorShade";

// ============================================================================
// COLOURS (shared by both themes, like the room's sprites)
// ============================================================================

const OUTLINE = 0x2b1d14;
const WOOD = 0x9a6233;
const WOOD_DARK = 0x6b4220;
const WOOD_LIGHT = 0xb97a44;
const STONE = 0xcfc8bb;
const METAL = 0x8a929c;
const METAL_DARK = 0x3a4048;
const RACK = 0x252a31;
const FRIDGE = 0xdfe3e7;
const SOFA = 0x3f7a5a;
const SOFA_DARK = 0x2f5e45;
const SOFA_LIGHT = 0x5d9c74;
const ARMCHAIR = 0xc08a2e;
const ARMCHAIR_DARK = 0x95691f;
const RUG = 0x9c5a3c;
const RUG_BORDER = 0xd9a066;
const CHAIR = 0x3a3f47;
const SCREEN = 0x0f1a14;
const ACCENT = 0xa7f36a;
const LAMP_SHADE = 0xf3d9a4;
const LED_GREEN = 0x5cff8a;
const LED_AMBER = 0xffb347;
const LEAF = 0x3f8f4a; // planter shrubs
const LEAF_LIGHT = 0x5fb35f;
const BOOKS = [0xb5473a, 0x3d6fa8, 0xd9a23c, 0x4f8a4f, 0x7a4f9a, 0xe0d6c2];

// ============================================================================
// DRAWING HELPERS
// ============================================================================

function box(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  outline: number | null = OUTLINE,
): void {
  g.rect(x, y, w, h);
  g.fill(fill);
  if (outline !== null) {
    g.rect(x, y, w, h);
    g.stroke({ width: 2, color: outline, alignment: 1 });
  }
}

/** A soft drop shadow on the floor under a piece of furniture. */
function shadow(g: Graphics, cx: number, cy: number, rx: number): void {
  g.ellipse(cx, cy, rx, rx * 0.22);
  g.fill({ color: 0x000000, alpha: 0.16 });
}

/** A framed window onto the sky (the scene clock's colours). */
function skyWindow(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  sky: readonly number[],
  mullions: number,
): void {
  box(g, x - 6, y - 6, w + 12, h + 12, 0x2d2d2d, 0x1a1a1a);
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
  // Glass shine and the mullions
  g.rect(x + 4, y + 4, w * 0.18, 3);
  g.fill({ color: 0xffffff, alpha: 0.25 });
  for (let i = 1; i <= mullions; i++) {
    g.rect(x + (w * i) / (mullions + 1) - 2, y, 4, h);
    g.fill(0x2d2d2d);
  }
  g.rect(x, y + h / 2 - 2, w, 4);
  g.fill(0x2d2d2d);
  // Sill
  box(g, x - 10, y + h + 6, w + 20, 6, WOOD_LIGHT);
}

function bookshelf(g: Graphics, x: number, y: number, w: number, h: number) {
  shadow(g, x + w / 2, y + h + 2, w / 2);
  box(g, x, y, w, h, WOOD_DARK);
  const shelves = 4;
  const sh = (h - 8) / shelves;
  for (let s = 0; s < shelves; s++) {
    const top = y + 4 + s * sh;
    g.rect(x + 4, top, w - 8, sh - 4);
    g.fill(0x3b2412);
    // Books of varied width and height, the same every render
    let bx = x + 6;
    let n = (s * 31 + Math.round(x)) & 0xff;
    while (bx < x + w - 12) {
      n = (n * 57 + 23) & 0xff;
      const bw = 5 + (n % 5);
      const bh = sh - 8 - (n % 7);
      if (n % 11 === 0) {
        bx += bw + 3; // a gap
        continue;
      }
      g.rect(bx, top + sh - 4 - bh, bw, bh);
      g.fill(BOOKS[n % BOOKS.length]);
      bx += bw + 1;
    }
    g.rect(x + 2, top + sh - 4, w - 4, 4);
    g.fill(WOOD);
  }
}

// ============================================================================
// ZONES (x0 = the zone's left edge; y in room coordinates)
// ============================================================================

function kitchen(g: Graphics, x0: number): void {
  // Upper cabinets with a warm light strip under them
  box(g, x0 + 8, 64, 164, 60, WOOD_LIGHT);
  for (let i = 1; i < 3; i++) {
    g.rect(x0 + 8 + (164 * i) / 3 - 1, 64, 2, 60);
    g.fill(WOOD_DARK);
  }
  for (let i = 0; i < 3; i++) {
    g.rect(x0 + 8 + (164 * (i + 0.5)) / 3 - 2, 110, 4, 6);
    g.fill(METAL_DARK);
  }
  g.rect(x0 + 10, 124, 160, 3);
  g.fill({ color: 0xffe2a0, alpha: 0.9 });
  // Fridge
  shadow(g, x0 + 206, 294, 32);
  box(g, x0 + 178, 92, 56, 200, FRIDGE, 0x6b7178);
  g.rect(x0 + 178, 160, 56, 2);
  g.fill(0x9aa1a8);
  box(g, x0 + 222, 120, 4, 26, METAL, null);
  box(g, x0 + 222, 176, 4, 40, METAL, null);
  // Counter: stone top, wooden doors, toe kick
  shadow(g, x0 + 92, 300, 88);
  box(g, x0 + 6, 214, 170, 22, STONE, 0x8f877a);
  box(g, x0 + 6, 236, 170, 56, WOOD);
  for (let i = 1; i < 4; i++) {
    g.rect(x0 + 6 + (170 * i) / 4 - 1, 240, 2, 50);
    g.fill(WOOD_DARK);
  }
  g.rect(x0 + 6, 292, 170, 6);
  g.fill(0x2a1a10);
  // Sink and tap
  box(g, x0 + 28, 218, 52, 14, 0x9aa3ab, 0x5b636b);
  box(g, x0 + 52, 202, 4, 18, METAL, null);
  box(g, x0 + 52, 202, 14, 4, METAL, null);
  // Kettle and microwave
  box(g, x0 + 96, 198, 18, 18, 0xc0443a);
  box(g, x0 + 128, 188, 44, 28, METAL_DARK);
  box(g, x0 + 132, 192, 26, 20, 0x1c2228, null);
  g.rect(x0 + 162, 194, 6, 3);
  g.fill(LED_GREEN);
  // Bistro table with two stools
  shadow(g, x0 + 120, 588, 44);
  box(g, x0 + 116, 540, 8, 44, METAL_DARK, null);
  g.ellipse(x0 + 120, 586, 24, 6);
  g.fill(METAL_DARK);
  g.ellipse(x0 + 120, 524, 46, 22);
  g.fill(WOOD_LIGHT);
  g.ellipse(x0 + 120, 524, 46, 22);
  g.stroke({ width: 2, color: OUTLINE });
  box(g, x0 + 104, 512, 12, 12, 0xf2f2ee); // a cup
  for (const sx of [44, 196]) {
    shadow(g, x0 + sx, 592, 18);
    box(g, x0 + sx - 2, 560, 4, 30, METAL_DARK, null);
    g.ellipse(x0 + sx, 558, 16, 8);
    g.fill(0xb54a3a);
    g.ellipse(x0 + sx, 558, 16, 8);
    g.stroke({ width: 2, color: OUTLINE });
  }
  // Recycling bins
  box(g, x0 + 150, 878, 28, 44, 0x3d6fa8);
  box(g, x0 + 184, 878, 28, 44, 0x4f8a4f);
  g.rect(x0 + 150, 878, 62, 6);
  g.fill({ color: 0x000000, alpha: 0.25 });
}

function lounge(g: Graphics, x0: number, sky: readonly number[]): void {
  skyWindow(g, x0 + 34, 40, 172, 126, sky, 1);
  // Rug
  g.roundRect(x0 + 8, 448, 224, 276, 14);
  g.fill(RUG);
  g.roundRect(x0 + 18, 458, 204, 256, 10);
  g.stroke({ width: 3, color: RUG_BORDER, alpha: 0.8 });
  g.roundRect(x0 + 30, 470, 180, 232, 8);
  g.stroke({ width: 1, color: RUG_BORDER, alpha: 0.5 });
  // Sofa, its back to the wall, facing the room
  shadow(g, x0 + 116, 556, 98);
  box(g, x0 + 28, 470, 176, 44, SOFA_DARK);
  for (const cx of [0, 1, 2]) {
    g.roundRect(x0 + 40 + cx * 52, 478, 48, 30, 6);
    g.fill(SOFA_LIGHT);
  }
  box(g, x0 + 28, 508, 176, 40, SOFA);
  g.rect(x0 + 30, 510, 172, 4);
  g.fill({ color: 0xffffff, alpha: 0.12 });
  box(g, x0 + 18, 482, 20, 70, SOFA_DARK);
  box(g, x0 + 194, 482, 20, 70, SOFA_DARK);
  box(g, x0 + 24, 552, 6, 6, OUTLINE, null);
  box(g, x0 + 202, 552, 6, 6, OUTLINE, null);
  // Coffee table with a mug and a magazine
  shadow(g, x0 + 120, 650, 56);
  box(g, x0 + 66, 604, 108, 30, WOOD_LIGHT);
  box(g, x0 + 72, 634, 6, 14, WOOD_DARK, null);
  box(g, x0 + 162, 634, 6, 14, WOOD_DARK, null);
  box(g, x0 + 84, 610, 30, 18, 0xe6e0d2, 0x9a9283);
  box(g, x0 + 140, 606, 12, 12, 0xf2f2ee);
  // Floor lamp
  shadow(g, x0 + 222, 560, 16);
  g.ellipse(x0 + 222, 556, 14, 5);
  g.fill(METAL_DARK);
  g.rect(x0 + 220, 444, 4, 112);
  g.fill(METAL_DARK);
  g.poly([x0 + 206, 446, x0 + 238, 446, x0 + 232, 420, x0 + 212, 420]);
  g.fill(LAMP_SHADE);
  g.poly([x0 + 206, 446, x0 + 238, 446, x0 + 232, 420, x0 + 212, 420]);
  g.stroke({ width: 2, color: OUTLINE });
  // Armchair and a big plant further down
  shadow(g, x0 + 80, 920, 46);
  box(g, x0 + 42, 852, 76, 30, ARMCHAIR_DARK);
  box(g, x0 + 42, 878, 76, 34, ARMCHAIR);
  box(g, x0 + 34, 862, 14, 52, ARMCHAIR_DARK);
  box(g, x0 + 112, 862, 14, 52, ARMCHAIR_DARK);
}

function library(g: Graphics, x0: number): void {
  // A small framed print above the shelves
  box(g, x0 + 96, 34, 48, 40, 0xe9e2cf, WOOD_DARK);
  g.rect(x0 + 104, 42, 32, 24);
  g.fill(0x6a9a7a);
  g.circle(x0 + 126, 50, 5);
  g.fill(0xf0d080);
  bookshelf(g, x0 + 10, 86, 104, 206);
  bookshelf(g, x0 + 126, 86, 104, 206);
  // Reading corner: armchair, side table, lamp
  shadow(g, x0 + 92, 600, 50);
  box(g, x0 + 52, 524, 80, 34, ARMCHAIR_DARK);
  box(g, x0 + 52, 552, 80, 38, ARMCHAIR);
  g.rect(x0 + 54, 554, 76, 4);
  g.fill({ color: 0xffffff, alpha: 0.15 });
  box(g, x0 + 42, 534, 16, 60, ARMCHAIR_DARK);
  box(g, x0 + 126, 534, 16, 60, ARMCHAIR_DARK);
  shadow(g, x0 + 184, 604, 24);
  g.rect(x0 + 182, 572, 4, 30);
  g.fill(WOOD_DARK);
  g.ellipse(x0 + 184, 570, 22, 9);
  g.fill(WOOD_LIGHT);
  g.ellipse(x0 + 184, 570, 22, 9);
  g.stroke({ width: 2, color: OUTLINE });
  g.rect(x0 + 182, 540, 4, 26);
  g.fill(METAL_DARK);
  g.poly([x0 + 170, 542, x0 + 198, 542, x0 + 192, 522, x0 + 176, 522]);
  g.fill(LAMP_SHADE);
  g.poly([x0 + 170, 542, x0 + 198, 542, x0 + 192, 522, x0 + 176, 522]);
  g.stroke({ width: 2, color: OUTLINE });
  // A stack of books on the floor and a plant
  box(g, x0 + 150, 900, 36, 8, BOOKS[1]);
  box(g, x0 + 154, 892, 30, 8, BOOKS[0]);
  box(g, x0 + 148, 884, 34, 8, BOOKS[2]);
}

function servers(g: Graphics, x0: number): void {
  // Cable tray and an "IT" plate on the wall
  box(g, x0 + 8, 56, 224, 10, METAL, 0x5b636b);
  for (let x = x0 + 16; x < x0 + 228; x += 16) {
    g.rect(x, 58, 2, 6);
    g.fill(0x5b636b);
  }
  box(g, x0 + 196, 30, 34, 20, 0x1e2a36, 0x0c1218);
  g.rect(x0 + 203, 37, 4, 7);
  g.fill(ACCENT);
  g.rect(x0 + 210, 37, 13, 3);
  g.fill(ACCENT);
  g.rect(x0 + 215, 37, 3, 7);
  g.fill(ACCENT);
  // Two racks (their LEDs blink in a layer of their own)
  for (const rx of [16, 108]) {
    shadow(g, x0 + rx + 40, 294, 44);
    box(g, x0 + rx, 88, 82, 204, RACK, 0x111418);
    for (let u = 0; u < 11; u++) {
      const y = 96 + u * 17;
      g.rect(x0 + rx + 6, y, 70, 13);
      g.fill(u % 4 === 3 ? 0x1a1e23 : 0x323843);
      for (let s = 0; s < 6; s++) {
        g.rect(x0 + rx + 26 + s * 8, y + 4, 5, 5);
        g.fill(0x1a1e23);
      }
    }
    g.rect(x0 + rx + 78, 120, 2, 40);
    g.fill(METAL);
  }
  // UPS box
  box(g, x0 + 198, 236, 34, 56, METAL_DARK);
  g.rect(x0 + 204, 244, 22, 8);
  g.fill(0x1a2a1f);
  // Two bean bags for a break
  for (const [bx, color] of [
    [70, 0x4a6fa5],
    [170, 0xc0583a],
  ] as const) {
    shadow(g, x0 + bx, 600, 40);
    g.ellipse(x0 + bx, 578, 38, 26);
    g.fill(color);
    g.ellipse(x0 + bx, 578, 38, 26);
    g.stroke({ width: 2, color: OUTLINE });
    g.ellipse(x0 + bx - 6, 570, 20, 10);
    g.fill({ color: 0xffffff, alpha: 0.14 });
  }
}

function meeting(g: Graphics, x0: number): void {
  // Wall screen with a chart
  box(g, x0 + 36, 52, 168, 100, 0x15181c, 0x0a0c0e);
  g.rect(x0 + 42, 58, 156, 88);
  g.fill(SCREEN);
  const bars = [30, 46, 38, 60, 52, 70];
  bars.forEach((b, i) => {
    g.rect(x0 + 56 + i * 22, 136 - b, 14, b);
    g.fill({ color: ACCENT, alpha: 0.55 + i * 0.07 });
  });
  g.rect(x0 + 50, 66, 60, 4);
  g.fill({ color: 0xffffff, alpha: 0.5 });
  box(g, x0 + 112, 152, 16, 10, 0x15181c, null);
  // Long table with six chairs
  shadow(g, x0 + 120, 664, 72);
  for (const cy of [498, 556, 614]) {
    box(g, x0 + 30, cy, 26, 28, CHAIR, 0x1a1d22);
    box(g, x0 + 26, cy - 2, 8, 32, 0x2a2e35, null);
    box(g, x0 + 184, cy, 26, 28, CHAIR, 0x1a1d22);
    box(g, x0 + 206, cy - 2, 8, 32, 0x2a2e35, null);
  }
  box(g, x0 + 56, 472, 128, 184, WOOD);
  g.rect(x0 + 60, 476, 120, 4);
  g.fill({ color: 0xffffff, alpha: 0.15 });
  box(g, x0 + 56, 656, 128, 10, WOOD_DARK);
  // Papers, a laptop, a water jug
  box(g, x0 + 70, 500, 30, 22, 0xf2efe6, 0xa59e8f);
  box(g, x0 + 134, 560, 34, 22, METAL_DARK);
  g.rect(x0 + 138, 564, 26, 14);
  g.fill(0x2e4a3a);
  box(g, x0 + 78, 600, 14, 22, 0xbfe3f2, 0x6a8ea0);
}

function tallPlant(g: Graphics, item: WingItem): void {
  const cx = item.x + item.w / 2;
  box(g, cx - 22, 70, 44, 54, 0xe9e2cf, WOOD_DARK);
  g.rect(cx - 16, 76, 32, 42);
  g.fill(0x7a9ab0);
  g.poly([cx - 16, 118, cx - 2, 96, cx + 8, 108, cx + 16, 100, cx + 16, 118]);
  g.fill(0x4f6a4f);
}

function highWindow(g: Graphics, item: WingItem, sky: readonly number[]) {
  skyWindow(g, item.x + 6, item.y + 6, item.w - 12, item.h - 24, sky, 2);
}

function planter(g: Graphics, item: WingItem): void {
  const base = item.y + item.h - 6;
  shadow(g, item.x + item.w / 2, base + 2, item.w / 2);
  const shrubs = Math.max(3, Math.floor(item.w / 34));
  for (let i = 0; i < shrubs; i++) {
    const cx = item.x + 18 + (i * (item.w - 36)) / (shrubs - 1);
    g.circle(cx, base - 30, 18);
    g.fill(LEAF);
    g.circle(cx - 5, base - 35, 8);
    g.fill(LEAF_LIGHT);
  }
  box(g, item.x, base - 26, item.w, 26, WOOD);
  g.rect(item.x, base - 26, item.w, 5);
  g.fill(WOOD_LIGHT);
}

function bench(g: Graphics, item: WingItem): void {
  const base = item.y + item.h - 6;
  shadow(g, item.x + item.w / 2, base + 2, item.w / 2);
  box(g, item.x + 10, base - 18, 8, 18, METAL_DARK, null);
  box(g, item.x + item.w - 18, base - 18, 8, 18, METAL_DARK, null);
  for (let i = 0; i < 3; i++) {
    box(g, item.x, base - 40 + i * 8, item.w, 7, i === 0 ? WOOD_LIGHT : WOOD);
  }
}

/** Floor patches that mark the zones: kitchen tiles, a raised server floor, rugs. */
function zoneFloors(g: Graphics, items: readonly WingItem[], tone: number) {
  for (const item of items) {
    const x0 = item.x;
    if (item.kind === "kitchen") {
      const a = shade(0xd8d2c4, tone);
      const b = shade(0xb9b09e, tone);
      for (let y = 250, r = 0; y < 650; y += 24, r++) {
        for (let x = 0, c = 0; x < 240; x += 24, c++) {
          g.rect(x0 + x, y, 24, Math.min(24, 650 - y));
          g.fill((r + c) % 2 ? a : b);
        }
      }
      g.rect(x0, 648, 240, 3);
      g.fill(shade(0x8f877a, tone));
    } else if (item.kind === "servers") {
      for (let y = 250; y < 370; y += 30) {
        for (let x = 0; x < 240; x += 30) {
          g.rect(x0 + x, y, 30, 30);
          g.fill(shade(0x9aa1a8, tone));
          g.rect(x0 + x, y, 30, 30);
          g.stroke({ width: 1, color: shade(0x6b7178, tone) });
        }
      }
    } else if (item.kind === "meeting") {
      g.roundRect(x0 + 12, 448, 216, 246, 12);
      g.fill(shade(0x44606e, tone));
      g.roundRect(x0 + 22, 458, 196, 226, 8);
      g.stroke({ width: 2, color: shade(0x7f9caa, tone), alpha: 0.8 });
    } else if (item.kind === "library") {
      g.ellipse(x0 + 116, 580, 110, 62);
      g.fill(shade(0x6d4b6e, tone));
      g.ellipse(x0 + 116, 580, 96, 52);
      g.stroke({ width: 2, color: shade(0xc9a0c0, tone), alpha: 0.7 });
    }
  }
}

function drawWings(
  g: Graphics,
  items: readonly WingItem[],
  sky: readonly number[],
  tone: number,
): void {
  g.clear();
  zoneFloors(g, items, tone);
  for (const item of items) {
    switch (item.kind) {
      case "kitchen":
        kitchen(g, item.x);
        break;
      case "lounge":
        lounge(g, item.x, sky);
        break;
      case "library":
        library(g, item.x);
        break;
      case "servers":
        servers(g, item.x);
        break;
      case "meeting":
        meeting(g, item.x);
        break;
      case "tallPlant":
        tallPlant(g, item);
        break;
      case "highWindow":
        highWindow(g, item, sky);
        break;
      case "planter":
        planter(g, item);
        break;
      case "bench":
        bench(g, item);
        break;
    }
  }
}

/** The racks' LEDs: a pattern that changes every `step`. */
function drawLeds(g: Graphics, items: readonly WingItem[], step: number) {
  g.clear();
  for (const item of items) {
    if (item.kind !== "servers") continue;
    for (const rx of [16, 108]) {
      for (let u = 0; u < 11; u++) {
        if (u % 4 === 3) continue;
        const n = (u * 7 + rx + step * 13) % 10;
        const y = 96 + u * 17 + 4;
        g.rect(item.x + rx + 10, y, 4, 4);
        g.fill(n < 7 ? LED_GREEN : 0x1e5a32);
        g.rect(item.x + rx + 16, y, 4, 4);
        g.fill(n === 3 || n === 8 ? LED_AMBER : 0x4a3a1a);
      }
    }
  }
}

/** The light the room casts onto a wing's floor edge (keeps wings in the same room). */
function drawWingFloorTone(
  g: Graphics,
  items: readonly WingItem[],
  p: ScenePalette,
): void {
  g.clear();
  for (const item of items) {
    if (item.side !== "left" && item.side !== "right") continue;
    if (item.kind === "tallPlant") continue;
    // A thin skirting shadow where the furniture meets the wall
    g.rect(item.x, 292, item.w, 8);
    g.fill({ color: p.vignette, alpha: 0.12 });
  }
}

/** Potted plants (the room's plant sprite), relative to each zone. */
const PLANTS: Partial<
  Record<WingItem["kind"], ReadonlyArray<{ x: number; y: number; s: number }>>
> = {
  kitchen: [{ x: 66, y: 900, s: 0.12 }],
  lounge: [{ x: 196, y: 900, s: 0.14 }],
  library: [{ x: 70, y: 900, s: 0.13 }],
  servers: [{ x: 120, y: 900, s: 0.13 }],
  meeting: [
    { x: 44, y: 905, s: 0.1 },
    { x: 196, y: 900, s: 0.13 },
  ],
};

function plantSpots(items: readonly WingItem[]) {
  const out: Array<{ x: number; y: number; s: number }> = [];
  for (const item of items) {
    if (item.kind === "tallPlant") {
      const cx = item.x + item.w / 2;
      out.push({ x: cx, y: 560, s: 0.15 }, { x: cx, y: 900, s: 0.12 });
      continue;
    }
    for (const p of PLANTS[item.kind] ?? []) {
      out.push({ x: item.x + p.x, y: p.y, s: p.s });
    }
  }
  return out;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface OfficeWingsProps {
  items: readonly WingItem[];
  plantTexture?: Texture | null;
}

function OfficeWingsComponent({
  items,
  plantTexture,
}: OfficeWingsProps): ReactNode {
  const hours = useSceneHours();
  const sky = useMemo(() => {
    const { phase, progress } = computeTimeState(hours, new Date());
    return getInterpolatedSkyColors(phase, progress);
  }, [hours]);
  const theme = useTheme();
  const palette = scenePalette(theme);
  // The floor patches follow the room's floor tone (darker in the dark theme)
  const tone = theme === "dark" ? 0.84 : 1.04;

  const draw = useCallback(
    (g: Graphics) => drawWings(g, items, sky, tone),
    [items, sky, tone],
  );
  const drawTone = useCallback(
    (g: Graphics) => drawWingFloorTone(g, items, palette),
    [items, palette],
  );

  const hasRacks = items.some((i) => i.kind === "servers");
  const step = useTickValue(hasRacks && !isReducedMotion(), (ms) =>
    Math.floor(ms / 700),
  );
  const drawLedLayer = useCallback(
    (g: Graphics) => drawLeds(g, items, step),
    [items, step],
  );

  if (items.length === 0) return null;
  return (
    <>
      <pixiGraphics draw={drawTone} />
      <pixiGraphics draw={draw} />
      {hasRacks && <pixiGraphics draw={drawLedLayer} />}
      {plantTexture &&
        plantSpots(items).map((spot) => (
          <pixiSprite
            key={`${spot.x},${spot.y}`}
            texture={plantTexture}
            anchor={0.5}
            x={spot.x}
            y={spot.y}
            scale={spot.s}
          />
        ))}
    </>
  );
}

export const OfficeWings = memo(OfficeWingsComponent);

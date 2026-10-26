/**
 * OfficeBackground Component
 *
 * The room itself, drawn flat in pixel-art style with the theme palette
 * (systems/scenePalette.ts): the wall with acoustic slats, the ceiling light
 * strip, wainscot panels and skirting; the oak plank floor; the team carpet
 * under the desks; and the lighting on top (the wall's shadow, ceiling light
 * pools, a soft vignette). Light comes from the top left.
 */

import { type ReactNode, useCallback } from "react";
import { Graphics, Texture } from "pixi.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/constants/canvas";
import { scenePalette, type ScenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";
import { bevel, mix, rng, wash } from "./shared/pixelDraw";

// ============================================================================
// CONSTANTS
// ============================================================================

// Floor/wall dimensions
const WALL_HEIGHT = 250;
const WALL_TRIM_HEIGHT = 10;
const WAINSCOT_HEIGHT = 70;
const WALL_BANDS = 16;
const SLAT_STEP = 12;
/** The ceiling edge and the light strip under it. */
const CEILING_HEIGHT = 6;
const STRIP_HEIGHT = 3;
// Colours: systems/scenePalette.ts (dark green office, light daytime office).

// ============================================================================
// TYPES
// ============================================================================

/** The canvas around the room, in room coordinates (the room is 0..1280 x 0..1024). */
export interface RoomExtent {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const ROOM: RoomExtent = {
  left: 0,
  top: 0,
  right: CANVAS_WIDTH,
  bottom: CANVAS_HEIGHT,
};

interface OfficeBackgroundProps {
  floorTileTexture?: Texture | null;
  /** Draw the walls and the floor out to here (the stage is wider or taller). */
  extent?: RoomExtent;
}

// ============================================================================
// WALLS
// ============================================================================

function drawWalls(g: Graphics, p: ScenePalette, e: RoomExtent): void {
  g.clear();
  const left = Math.floor(e.left);
  const right = Math.ceil(e.right);
  const width = right - left;

  // Main floor background (fallback color behind the planks)
  g.rect(left, WALL_HEIGHT, width, Math.ceil(e.bottom) - WALL_HEIGHT);
  g.fill(p.floor);

  // Wall: a stepped vertical gradient, darker at the ceiling. A taller stage
  // gets a taller wall (it starts above the room), never an empty band.
  const wallTop = Math.floor(Math.min(0, e.top));
  const bandHeight = Math.ceil((WALL_HEIGHT - wallTop) / WALL_BANDS);
  for (let i = 0; i < WALL_BANDS; i++) {
    g.rect(left, wallTop + i * bandHeight, width, bandHeight + 1);
    g.fill(mix(p.wallTop, p.wallBottom, i / (WALL_BANDS - 1)));
  }

  // Acoustic slats: thin dark grooves down the upper wall, on the room grid
  const wainscotTop = WALL_HEIGHT - WALL_TRIM_HEIGHT - WAINSCOT_HEIGHT;
  const slatTop = wallTop + CEILING_HEIGHT + STRIP_HEIGHT + 8;
  const firstSlat = left - (((left % SLAT_STEP) + SLAT_STEP) % SLAT_STEP);
  for (let x = firstSlat; x < right; x += SLAT_STEP) {
    wash(g, x, slatTop, 1, wainscotTop - slatTop, p.wallSlat);
    wash(g, x + 1, slatTop, 1, wainscotTop - slatTop, p.bevelLight);
  }

  // Ceiling edge and the light strip: one green running into another
  g.rect(left, wallTop, width, CEILING_HEIGHT);
  g.fill(p.ceiling);
  const segments = Math.max(2, Math.ceil(width / 40));
  const segWidth = Math.ceil(width / segments);
  for (let i = 0; i < segments; i++) {
    const color = mix(p.neonStart, p.neonEnd, i / (segments - 1));
    const x = left + i * segWidth;
    g.rect(x, wallTop + CEILING_HEIGHT, segWidth + 1, STRIP_HEIGHT);
    g.fill(color);
    // The light it throws down the wall, in hard steps (no blur)
    const glowTop = wallTop + CEILING_HEIGHT + STRIP_HEIGHT;
    for (let s = 0; s < 4; s++) {
      g.rect(x, glowTop + s * 6, segWidth + 1, 6);
      g.fill({ color, alpha: 0.11 - s * 0.025 });
    }
  }

  // Wainscot panels along the lower wall, a cap rail on top
  g.rect(left, wainscotTop, width, WAINSCOT_HEIGHT);
  g.fill(p.wainscot);
  g.rect(left, wainscotTop, width, 4);
  g.fill(p.wallTrim);
  g.rect(left, wainscotTop, width, 1);
  g.fill(p.wallTrimHighlight);
  wash(g, left, wainscotTop + 4, width, 2, p.bevelShade);
  // Panels every 80 px, on the room's grid (x = 20, 100, ...) out to the edges
  const firstPanel = 20 - 80 * Math.ceil((20 - left) / 80);
  for (let x = firstPanel; x < right - 20; x += 80) {
    const top = wainscotTop + 14;
    const h = WAINSCOT_HEIGHT - 26;
    g.rect(x, top, 60, h);
    g.fill(p.wainscotLine);
    g.rect(x + 2, top + 2, 56, h - 4);
    g.fill(p.wainscot);
    bevel(g, x + 2, top + 2, 56, h - 4, p.bevelShade, p.bevelLight);
  }

  // Wooden skirting board with a lit top edge
  g.rect(left, WALL_HEIGHT - WALL_TRIM_HEIGHT, width, WALL_TRIM_HEIGHT);
  g.fill(p.wallTrim);
  g.rect(left, WALL_HEIGHT - WALL_TRIM_HEIGHT, width, 2);
  g.fill(p.wallTrimHighlight);
  wash(g, left, WALL_HEIGHT - 2, width, 2, p.bevelShade);
}

// ============================================================================
// FLOOR
// ============================================================================

// Oak planks: narrow rows with staggered seams
const PLANK_HEIGHT = 24;

// Team zone carpet under the desk grid
const TEAM_ZONE = { x: 150, y: 360, w: 980, h: 400 };
const CARPET_TILE = 40;

function drawPlanks(g: Graphics, p: ScenePalette, e: RoomExtent): void {
  const left = Math.floor(e.left);
  const right = Math.ceil(e.right);
  let row = 0;
  for (let y = WALL_HEIGHT; y < e.bottom; y += PLANK_HEIGHT, row++) {
    // Deterministic plank lengths per row, offset so seams never line up
    const rand = rng(row * 131 + 7);
    let x = left - ((row * 97) % 160) - 160;
    while (x < right) {
      const len = 120 + Math.floor(rand() * 9) * 16;
      const color = p.planks[Math.floor(rand() * p.planks.length)];
      g.rect(x, y, len, PLANK_HEIGHT);
      g.fill(color);
      // Lit top edge of the plank
      wash(g, x, y, len, 1, p.plankLight);
      // Grain: two long thin streaks and the odd knot
      const g1 = 5 + Math.floor(rand() * 6);
      const g2 = 13 + Math.floor(rand() * 6);
      const s1 = Math.floor(rand() * 30);
      wash(g, x + 6 + s1, y + g1, len - 30 - s1, 1, p.plankGrain);
      wash(g, x + 14, y + g2, len - 44 - s1 / 2, 1, p.plankGrain);
      if (rand() < 0.22) {
        const kx = x + 20 + Math.floor(rand() * (len - 40));
        wash(g, kx, y + g2 - 1, 3, 2, p.plankGrain);
        wash(g, kx + 1, y + g2 - 1, 1, 1, p.plankGrain);
      }
      // Seam at the plank end
      g.rect(x + len - 1, y, 1, PLANK_HEIGHT);
      g.fill(p.plankSeam);
      x += len;
    }
    // Row seam
    g.rect(left, y + PLANK_HEIGHT - 1, right - left, 1);
    g.fill(p.plankSeam);
  }
}

function drawTeamCarpet(g: Graphics, p: ScenePalette): void {
  const z = TEAM_ZONE;
  // Flat contact shadow, falling down-right
  g.roundRect(z.x + 3, z.y + 5, z.w + 2, z.h + 2, 12);
  g.fill({ color: p.shadow.color, alpha: p.shadow.alpha * 0.5 });
  g.roundRect(z.x + 2, z.y + 3, z.w, z.h, 10);
  g.fill({ color: p.shadow.color, alpha: p.shadow.alpha * 0.6 });
  // Border and field
  g.roundRect(z.x, z.y, z.w, z.h, 10);
  g.fill(p.carpetBorder);
  const inset = 4;
  const fx = z.x + inset;
  const fy = z.y + inset;
  const fw = z.w - inset * 2;
  const fh = z.h - inset * 2;
  g.roundRect(fx, fy, fw, fh, 7);
  g.fill(p.carpet);
  // Carpet tiles: a faint checker, each tile with a woven stripe
  for (let ty = 0; ty * CARPET_TILE < fh - 8; ty++) {
    for (let tx = 0; tx * CARPET_TILE < fw - 8; tx++) {
      const x = fx + 4 + tx * CARPET_TILE;
      const y = fy + 4 + ty * CARPET_TILE;
      const w = Math.min(CARPET_TILE, fx + fw - 4 - x);
      const h = Math.min(CARPET_TILE, fy + fh - 4 - y);
      if (w <= 0 || h <= 0) continue;
      if ((tx + ty) % 2 === 0) {
        g.rect(x, y, w, h);
        g.fill(p.carpetTile);
      }
      // Weave: horizontal or vertical ribs, turning tile by tile
      const across = (tx + ty) % 2 === 0;
      for (let k = 6; k < (across ? h : w); k += 8) {
        if (across) wash(g, x + 3, y + k, w - 6, 1, p.carpetWeave);
        else wash(g, x + k, y + 3, 1, h - 6, p.carpetWeave);
      }
    }
  }
  // Lit top edge of the border, the thin accent line inside
  wash(g, z.x + 8, z.y, z.w - 16, 1, p.bevelLight);
  g.roundRect(z.x + 12, z.y + 12, z.w - 24, z.h - 24, 5);
  g.stroke({ width: 1, color: p.carpetLine, alpha: 0.35, alignment: 1 });
}

function drawFloor(g: Graphics, p: ScenePalette, e: RoomExtent): void {
  g.clear();
  drawPlanks(g, p, e);
  drawTeamCarpet(g, p);
}

// ============================================================================
// LIGHTING
// ============================================================================

/**
 * The wall's shadow on the floor, soft pools under the ceiling lamps and a
 * vignette toward the edges, drawn on top of the floor in hard steps.
 */
function drawLighting(g: Graphics, p: ScenePalette, e: RoomExtent): void {
  g.clear();
  const left = Math.floor(e.left);
  const right = Math.ceil(e.right);
  const width = right - left;

  // Shadow cast by the wall onto the floor
  for (let i = 0; i < 5; i++) {
    g.rect(left, WALL_HEIGHT + i * 4, width, 4);
    g.fill({ color: p.shadow.color, alpha: p.wallShadowAlpha * (1 - i / 5) });
  }

  // Light pools under the ceiling lamps: over each desk row and the boss
  const pools = [
    ...[256, 512, 768, 1024].flatMap((x) => [
      { x, y: 470, r: 110 },
      { x, y: 660, r: 110 },
    ]),
    { x: CANVAS_WIDTH / 2, y: 930, r: 150 },
  ];
  for (const pool of pools) {
    for (let r = 4; r >= 1; r--) {
      g.ellipse(pool.x, pool.y, (pool.r * r) / 4, (pool.r * 0.5 * r) / 4);
      g.fill(p.lightPool);
    }
  }

  // Vignette toward the bottom and the sides, in steps
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const a = (p.vignetteAlpha * (steps - i)) / steps;
    const h = 28;
    g.rect(left, Math.ceil(e.bottom) - (i + 1) * h, width, h);
    g.fill({ color: p.vignette, alpha: a * 0.8 });
    const w = 20;
    const top = Math.floor(Math.min(0, e.top));
    g.rect(left + i * w, top, w, Math.ceil(e.bottom) - top);
    g.fill({ color: p.vignette, alpha: a });
    g.rect(right - (i + 1) * w, top, w, Math.ceil(e.bottom) - top);
    g.fill({ color: p.vignette, alpha: a });
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OfficeBackground({
  // floorTileTexture is kept in the props for compatibility; the floor is drawn
  extent = ROOM,
}: OfficeBackgroundProps): ReactNode {
  const { left, top, right, bottom } = extent;
  // Redrawn when the theme switches (light: the daytime office)
  const palette = scenePalette(useTheme());
  const drawWallsCallback = useCallback(
    (g: Graphics) => drawWalls(g, palette, { left, top, right, bottom }),
    [palette, left, top, right, bottom],
  );
  const drawFloorCallback = useCallback(
    (g: Graphics) => drawFloor(g, palette, { left, top, right, bottom }),
    [palette, left, top, right, bottom],
  );
  const drawLightingCallback = useCallback(
    (g: Graphics) => drawLighting(g, palette, { left, top, right, bottom }),
    [palette, left, top, right, bottom],
  );

  return (
    <>
      {/* Walls and floor background */}
      <pixiGraphics draw={drawWallsCallback} />

      {/* Oak plank floor and the team carpet */}
      <pixiGraphics draw={drawFloorCallback} />

      {/* Ambient lighting over the floor */}
      <pixiGraphics draw={drawLightingCallback} />
    </>
  );
}

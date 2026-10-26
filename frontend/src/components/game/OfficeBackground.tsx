/**
 * OfficeBackground Component
 *
 * Renders the office floor, walls, and tile pattern using sprites.
 */

import { type ReactNode, useCallback } from "react";
import { Graphics, Texture } from "pixi.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/constants/canvas";
import { scenePalette, type ScenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";

// ============================================================================
// CONSTANTS
// ============================================================================

// Floor/wall dimensions
const WALL_HEIGHT = 250;
const WALL_TRIM_HEIGHT = 10;
const WAINSCOT_HEIGHT = 70;
const WALL_BANDS = 10;
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
// DRAWING FUNCTION
// ============================================================================

/**
 * Draws the office walls (no floor - that's handled by sprites).
 */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff,
    ag = (a >> 8) & 0xff,
    ab = a & 0xff;
  const br = (b >> 16) & 0xff,
    bg = (b >> 8) & 0xff,
    bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

function drawWalls(g: Graphics, p: ScenePalette, e: RoomExtent): void {
  g.clear();
  const width = e.right - e.left;

  // Main floor background (fallback color behind tiles)
  g.rect(e.left, WALL_HEIGHT, width, e.bottom - WALL_HEIGHT);
  g.fill(p.floor);

  // Wall: vertical gradient in bands, darker at the ceiling. A taller stage
  // gets a taller wall (it starts above the room), never an empty band.
  const wallTop = Math.min(0, e.top);
  const bandHeight = (WALL_HEIGHT - wallTop) / WALL_BANDS;
  for (let i = 0; i < WALL_BANDS; i++) {
    g.rect(e.left, wallTop + i * bandHeight, width, bandHeight + 1);
    g.fill(lerpColor(p.wallTop, p.wallBottom, i / (WALL_BANDS - 1)));
  }

  // Ceiling neon strip: one green fading into another
  const segments = Math.max(2, Math.ceil(width / 40));
  const segWidth = width / segments;
  for (let i = 0; i < segments; i++) {
    const color = lerpColor(p.neonStart, p.neonEnd, i / (segments - 1));
    const x = e.left + i * segWidth;
    g.rect(x, wallTop, segWidth + 1, 4);
    g.fill(color);
    g.rect(x, wallTop + 4, segWidth + 1, 14);
    g.fill({ color, alpha: 0.12 });
  }

  // Wainscot panels along the lower wall
  const wainscotTop = WALL_HEIGHT - WALL_TRIM_HEIGHT - WAINSCOT_HEIGHT;
  g.rect(e.left, wainscotTop, width, WAINSCOT_HEIGHT);
  g.fill(p.wainscot);
  g.rect(e.left, wainscotTop, width, 3);
  g.fill(p.wallTrim);
  // Panels every 80 px, on the room's grid (x = 20, 100, ...) out to the edges
  const firstPanel = 20 - 80 * Math.ceil((20 - e.left) / 80);
  for (let x = firstPanel; x < e.right - 60; x += 80) {
    g.roundRect(x, wainscotTop + 14, 60, WAINSCOT_HEIGHT - 26, 4);
    g.stroke({ width: 2, color: p.wainscotLine });
  }

  // Wooden baseboard
  g.rect(e.left, WALL_HEIGHT - WALL_TRIM_HEIGHT, width, WALL_TRIM_HEIGHT);
  g.fill(p.wallTrim);
  g.rect(e.left, WALL_HEIGHT - WALL_TRIM_HEIGHT, width, 2);
  g.fill(p.wallTrimHighlight);
}

// Modern floor: light ash planks with staggered seams
const PLANK_HEIGHT = 32;

// Team zone carpet under the desk grid
const TEAM_ZONE = { x: 150, y: 360, w: 980, h: 400 };

function drawFloor(g: Graphics, p: ScenePalette, e: RoomExtent): void {
  g.clear();
  let row = 0;
  for (let y = WALL_HEIGHT; y < e.bottom; y += PLANK_HEIGHT, row++) {
    // Deterministic pseudo-random plank lengths per row
    let x = e.left - ((row * 97) % 160);
    let n = row * 7;
    while (x < e.right) {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      const len = 140 + (n % 120);
      const color = p.planks[n % p.planks.length];
      g.rect(x, y, len, PLANK_HEIGHT);
      g.fill(color);
      // subtle grain line
      g.rect(x + 8, y + 10 + (n % 12), len - 16, 1);
      g.fill({ color: 0x000000, alpha: 0.05 });
      // seam at plank end
      g.rect(x + len - 1, y, 2, PLANK_HEIGHT);
      g.fill({ color: p.plankSeam, alpha: 0.6 });
      x += len;
    }
    // row seam
    g.rect(e.left, y + PLANK_HEIGHT - 1, e.right - e.left, 1);
    g.fill({ color: p.plankSeam, alpha: 0.55 });
  }

  // Team zone carpet with a soft shadow and a glowing edge
  const z = TEAM_ZONE;
  g.roundRect(z.x + 6, z.y + 8, z.w, z.h, 28);
  g.fill({ color: 0x000000, alpha: 0.18 });
  g.roundRect(z.x, z.y, z.w, z.h, 28);
  g.fill(p.carpet);
  g.stroke({ width: 4, color: p.carpetBorder });
  g.roundRect(z.x + 14, z.y + 14, z.w - 28, z.h - 28, 20);
  g.stroke({ width: 2, color: p.carpetLine, alpha: 0.3 });
  // carpet texture: fine diagonal pattern
  for (let d = 0; d < z.w + z.h; d += 22) {
    const x0 = z.x + Math.max(0, d - z.h);
    const y0 = z.y + Math.min(d, z.h);
    const len = Math.min(d, z.h, z.w - (x0 - z.x));
    if (len <= 0) continue;
    g.moveTo(x0 + 18, y0 - 18);
    g.lineTo(x0 + len - 18, y0 - len + 18);
    g.stroke({ width: 1, ...p.carpetWeave });
  }
}

/**
 * Soft light pools from the ceiling lamps and a shadow under the wall,
 * drawn on top of the floor tiles.
 */
function drawLighting(g: Graphics, p: ScenePalette, e: RoomExtent): void {
  g.clear();
  const width = e.right - e.left;

  // Shadow cast by the wall onto the floor
  for (let i = 0; i < 6; i++) {
    g.rect(e.left, WALL_HEIGHT + i * 6, width, 6);
    g.fill({ color: 0x000000, alpha: p.wallShadowAlpha * (1 - i / 6.2) });
  }

  // Warm light pools
  const pools = [
    { x: CANVAS_WIDTH * 0.25, y: WALL_HEIGHT + 260 },
    { x: CANVAS_WIDTH * 0.75, y: WALL_HEIGHT + 260 },
    { x: CANVAS_WIDTH * 0.5, y: WALL_HEIGHT + 560 },
  ];
  for (const pool of pools) {
    for (let r = 5; r >= 1; r--) {
      g.ellipse(pool.x, pool.y, 90 * r, 55 * r);
      g.fill({ color: 0xffd9a0, alpha: 0.018 });
    }
  }

  // Vignette toward the bottom corners
  for (let i = 0; i < 8; i++) {
    const h = 40;
    g.rect(e.left, e.bottom - (i + 1) * h, width, h);
    g.fill({ color: p.vignette, alpha: (p.vignetteAlpha * (8 - i)) / 8 });
  }
  // Soft side vignette: the floor fades into the dark stage
  for (let i = 0; i < 6; i++) {
    const w = 22;
    const a = (p.vignetteAlpha * (6 - i)) / 6;
    g.rect(e.left + i * w, WALL_HEIGHT, w, e.bottom - WALL_HEIGHT);
    g.fill({ color: p.vignette, alpha: a });
    g.rect(e.right - (i + 1) * w, WALL_HEIGHT, w, e.bottom - WALL_HEIGHT);
    g.fill({ color: p.vignette, alpha: a });
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OfficeBackground({
  // floorTileTexture is kept in the props for compatibility; the floor is now drawn
  extent = ROOM,
}: OfficeBackgroundProps): ReactNode {
  const { left, top, right, bottom } = extent;
  // Stable reference for wall drawing
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

      {/* Modern plank floor and team zone carpet */}
      <pixiGraphics draw={drawFloorCallback} />

      {/* Ambient lighting over the floor */}
      <pixiGraphics draw={drawLightingCallback} />
    </>
  );
}

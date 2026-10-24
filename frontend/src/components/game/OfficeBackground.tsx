/**
 * OfficeBackground Component
 *
 * Renders the office floor, walls, and tile pattern using sprites.
 */

import { type ReactNode, useCallback } from "react";
import { Graphics, Texture } from "pixi.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/constants/canvas";

// ============================================================================
// CONSTANTS
// ============================================================================

// Floor/wall dimensions
const WALL_HEIGHT = 250;
const WALL_TRIM_HEIGHT = 10;

// Colors (Qodirjon theme: deep navy walls, warm wood floor, neon accents)
const FLOOR_COLOR = 0x3a2a1e;
const WALL_TOP_COLOR = 0x1b2440;
const WALL_BOTTOM_COLOR = 0x2a3558;
const WAINSCOT_COLOR = 0x222b48;
const WAINSCOT_HEIGHT = 70;
const WALL_TRIM_COLOR = 0x6b4a2f;
const WALL_TRIM_HIGHLIGHT = 0x8a6340;
const NEON_ORANGE = 0xff8a3d;
const NEON_VIOLET = 0x8b5cf6;
const WALL_BANDS = 10;

// ============================================================================
// TYPES
// ============================================================================

interface OfficeBackgroundProps {
  floorTileTexture?: Texture | null;
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

function drawWalls(g: Graphics): void {
  g.clear();

  // Main floor background (fallback color behind tiles)
  g.rect(0, WALL_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - WALL_HEIGHT);
  g.fill(FLOOR_COLOR);

  // Wall: vertical gradient in bands, darker at the ceiling
  const bandHeight = WALL_HEIGHT / WALL_BANDS;
  for (let i = 0; i < WALL_BANDS; i++) {
    g.rect(0, i * bandHeight, CANVAS_WIDTH, bandHeight + 1);
    g.fill(lerpColor(WALL_TOP_COLOR, WALL_BOTTOM_COLOR, i / (WALL_BANDS - 1)));
  }

  // Ceiling neon strip: orange fading into violet
  const segments = 32;
  const segWidth = CANVAS_WIDTH / segments;
  for (let i = 0; i < segments; i++) {
    const color = lerpColor(NEON_ORANGE, NEON_VIOLET, i / (segments - 1));
    g.rect(i * segWidth, 0, segWidth + 1, 4);
    g.fill(color);
    g.rect(i * segWidth, 4, segWidth + 1, 14);
    g.fill({ color, alpha: 0.12 });
  }

  // Wainscot panels along the lower wall
  const wainscotTop = WALL_HEIGHT - WALL_TRIM_HEIGHT - WAINSCOT_HEIGHT;
  g.rect(0, wainscotTop, CANVAS_WIDTH, WAINSCOT_HEIGHT);
  g.fill(WAINSCOT_COLOR);
  g.rect(0, wainscotTop, CANVAS_WIDTH, 3);
  g.fill(WALL_TRIM_COLOR);
  for (let x = 20; x < CANVAS_WIDTH - 60; x += 80) {
    g.roundRect(x, wainscotTop + 14, 60, WAINSCOT_HEIGHT - 26, 4);
    g.stroke({ width: 2, color: 0x2f3a60 });
  }

  // Wooden baseboard
  g.rect(0, WALL_HEIGHT - WALL_TRIM_HEIGHT, CANVAS_WIDTH, WALL_TRIM_HEIGHT);
  g.fill(WALL_TRIM_COLOR);
  g.rect(0, WALL_HEIGHT - WALL_TRIM_HEIGHT, CANVAS_WIDTH, 2);
  g.fill(WALL_TRIM_HIGHLIGHT);
}

// Modern floor: light ash planks with staggered seams
const PLANK_HEIGHT = 32;
const PLANK_COLORS = [0xa3927f, 0x9a8a78, 0xad9c88, 0x958572, 0xa8978a];
const PLANK_SEAM = 0x6f6252;

// Team zone carpet under the desk grid
const TEAM_ZONE = { x: 150, y: 360, w: 980, h: 400 };
const TEAM_ZONE_COLOR = 0x23324f;
const TEAM_ZONE_BORDER = 0x3b4f7a;

function drawFloor(g: Graphics): void {
  g.clear();
  let row = 0;
  for (let y = WALL_HEIGHT; y < CANVAS_HEIGHT; y += PLANK_HEIGHT, row++) {
    // Deterministic pseudo-random plank lengths per row
    let x = -((row * 97) % 160);
    let n = row * 7;
    while (x < CANVAS_WIDTH) {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      const len = 140 + (n % 120);
      const color = PLANK_COLORS[n % PLANK_COLORS.length];
      g.rect(x, y, len, PLANK_HEIGHT);
      g.fill(color);
      // subtle grain line
      g.rect(x + 8, y + 10 + (n % 12), len - 16, 1);
      g.fill({ color: 0x000000, alpha: 0.05 });
      // seam at plank end
      g.rect(x + len - 1, y, 2, PLANK_HEIGHT);
      g.fill({ color: PLANK_SEAM, alpha: 0.6 });
      x += len;
    }
    // row seam
    g.rect(0, y + PLANK_HEIGHT - 1, CANVAS_WIDTH, 1);
    g.fill({ color: PLANK_SEAM, alpha: 0.55 });
  }

  // Team zone carpet with a soft shadow and a glowing edge
  const z = TEAM_ZONE;
  g.roundRect(z.x + 6, z.y + 8, z.w, z.h, 28);
  g.fill({ color: 0x000000, alpha: 0.18 });
  g.roundRect(z.x, z.y, z.w, z.h, 28);
  g.fill(TEAM_ZONE_COLOR);
  g.stroke({ width: 4, color: TEAM_ZONE_BORDER });
  g.roundRect(z.x + 14, z.y + 14, z.w - 28, z.h - 28, 20);
  g.stroke({ width: 2, color: 0x8b5cf6, alpha: 0.35 });
  // carpet texture: fine diagonal pattern
  for (let d = 0; d < z.w + z.h; d += 22) {
    const x0 = z.x + Math.max(0, d - z.h);
    const y0 = z.y + Math.min(d, z.h);
    const len = Math.min(d, z.h, z.w - (x0 - z.x));
    if (len <= 0) continue;
    g.moveTo(x0 + 18, y0 - 18);
    g.lineTo(x0 + len - 18, y0 - len + 18);
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.025 });
  }
}

/**
 * Soft light pools from the ceiling lamps and a shadow under the wall,
 * drawn on top of the floor tiles.
 */
function drawLighting(g: Graphics): void {
  g.clear();

  // Shadow cast by the wall onto the floor
  for (let i = 0; i < 6; i++) {
    g.rect(0, WALL_HEIGHT + i * 6, CANVAS_WIDTH, 6);
    g.fill({ color: 0x000000, alpha: 0.28 - i * 0.045 });
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
    g.rect(0, CANVAS_HEIGHT - (i + 1) * h, CANVAS_WIDTH, h);
    g.fill({ color: 0x05070f, alpha: (0.05 * (8 - i)) / 8 });
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OfficeBackground(
  // floorTileTexture is kept in the props for compatibility; the floor is now drawn
  _props: OfficeBackgroundProps,
): ReactNode {
  // Stable reference for wall drawing
  const drawWallsCallback = useCallback((g: Graphics) => drawWalls(g), []);
  const drawFloorCallback = useCallback((g: Graphics) => drawFloor(g), []);
  const drawLightingCallback = useCallback(
    (g: Graphics) => drawLighting(g),
    [],
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

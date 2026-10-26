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

function drawWalls(g: Graphics, p: ScenePalette): void {
  g.clear();

  // Main floor background (fallback color behind tiles)
  g.rect(0, WALL_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - WALL_HEIGHT);
  g.fill(p.floor);

  // Wall: vertical gradient in bands, darker at the ceiling
  const bandHeight = WALL_HEIGHT / WALL_BANDS;
  for (let i = 0; i < WALL_BANDS; i++) {
    g.rect(0, i * bandHeight, CANVAS_WIDTH, bandHeight + 1);
    g.fill(lerpColor(p.wallTop, p.wallBottom, i / (WALL_BANDS - 1)));
  }

  // Ceiling neon strip: one green fading into another
  const segments = 32;
  const segWidth = CANVAS_WIDTH / segments;
  for (let i = 0; i < segments; i++) {
    const color = lerpColor(p.neonStart, p.neonEnd, i / (segments - 1));
    g.rect(i * segWidth, 0, segWidth + 1, 4);
    g.fill(color);
    g.rect(i * segWidth, 4, segWidth + 1, 14);
    g.fill({ color, alpha: 0.12 });
  }

  // Wainscot panels along the lower wall
  const wainscotTop = WALL_HEIGHT - WALL_TRIM_HEIGHT - WAINSCOT_HEIGHT;
  g.rect(0, wainscotTop, CANVAS_WIDTH, WAINSCOT_HEIGHT);
  g.fill(p.wainscot);
  g.rect(0, wainscotTop, CANVAS_WIDTH, 3);
  g.fill(p.wallTrim);
  for (let x = 20; x < CANVAS_WIDTH - 60; x += 80) {
    g.roundRect(x, wainscotTop + 14, 60, WAINSCOT_HEIGHT - 26, 4);
    g.stroke({ width: 2, color: p.wainscotLine });
  }

  // Wooden baseboard
  g.rect(0, WALL_HEIGHT - WALL_TRIM_HEIGHT, CANVAS_WIDTH, WALL_TRIM_HEIGHT);
  g.fill(p.wallTrim);
  g.rect(0, WALL_HEIGHT - WALL_TRIM_HEIGHT, CANVAS_WIDTH, 2);
  g.fill(p.wallTrimHighlight);
}

// Modern floor: light ash planks with staggered seams
const PLANK_HEIGHT = 32;

// Team zone carpet under the desk grid
const TEAM_ZONE = { x: 150, y: 360, w: 980, h: 400 };

function drawFloor(g: Graphics, p: ScenePalette): void {
  g.clear();
  let row = 0;
  for (let y = WALL_HEIGHT; y < CANVAS_HEIGHT; y += PLANK_HEIGHT, row++) {
    // Deterministic pseudo-random plank lengths per row
    let x = -((row * 97) % 160);
    let n = row * 7;
    while (x < CANVAS_WIDTH) {
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
    g.rect(0, y + PLANK_HEIGHT - 1, CANVAS_WIDTH, 1);
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
function drawLighting(g: Graphics, p: ScenePalette): void {
  g.clear();

  // Shadow cast by the wall onto the floor
  for (let i = 0; i < 6; i++) {
    g.rect(0, WALL_HEIGHT + i * 6, CANVAS_WIDTH, 6);
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
    g.rect(0, CANVAS_HEIGHT - (i + 1) * h, CANVAS_WIDTH, h);
    g.fill({ color: p.vignette, alpha: (p.vignetteAlpha * (8 - i)) / 8 });
  }
  // Soft side vignette: the floor fades into the dark stage
  for (let i = 0; i < 6; i++) {
    const w = 22;
    const a = (p.vignetteAlpha * (6 - i)) / 6;
    g.rect(i * w, WALL_HEIGHT, w, CANVAS_HEIGHT - WALL_HEIGHT);
    g.fill({ color: p.vignette, alpha: a });
    g.rect(
      CANVAS_WIDTH - (i + 1) * w,
      WALL_HEIGHT,
      w,
      CANVAS_HEIGHT - WALL_HEIGHT,
    );
    g.fill({ color: p.vignette, alpha: a });
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
  // Redrawn when the theme switches (light: the daytime office)
  const palette = scenePalette(useTheme());
  const drawWallsCallback = useCallback(
    (g: Graphics) => drawWalls(g, palette),
    [palette],
  );
  const drawFloorCallback = useCallback(
    (g: Graphics) => drawFloor(g, palette),
    [palette],
  );
  const drawLightingCallback = useCallback(
    (g: Graphics) => drawLighting(g, palette),
    [palette],
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

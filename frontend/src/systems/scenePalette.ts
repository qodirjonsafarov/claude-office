/**
 * The colours of the office scene (Pixi), one palette per UI theme:
 *   dark:  the studio, walls and team carpet in a subtle dark Olymp green;
 *   light: the same room by day, sage walls and carpet on the Radix olive
 *          scale, lighter wood, the #4f8a1f accent on the carpet line.
 * The CSS side of the stage (the studio gradient around the canvas) is in
 * styles/tokens.css (--qo-stage-*).
 */

import { shade } from "@/systems/colorShade";
import type { Theme } from "@/systems/theme";

export interface ScenePalette {
  /** The canvas behind everything (seen while sprites load). */
  stage: number;
  /** The fallback floor under the planks. */
  floor: number;
  wallTop: number;
  wallBottom: number;
  wainscot: number;
  wainscotLine: number;
  wallTrim: number;
  wallTrimHighlight: number;
  /** The ceiling light strip runs from one colour into the other. */
  neonStart: number;
  neonEnd: number;
  planks: readonly number[];
  plankSeam: number;
  carpet: number;
  carpetBorder: number;
  /** The thin inner line of the carpet. */
  carpetLine: number;
  /** The fine diagonal weave of the carpet. */
  carpetWeave: { color: number; alpha: number };
  /** The shadow the wall casts on the floor, at its darkest. */
  wallShadowAlpha: number;
  /** The colour the floor fades into at the bottom and sides. */
  vignette: number;
  vignetteAlpha: number;
}

// Light ash planks with staggered seams.
const PLANK_BASE = [0xa3927f, 0x9a8a78, 0xad9c88, 0x958572, 0xa8978a];
const PLANK_SEAM_BASE = 0x6f6252;
// Dark: toned down ~16% so the floor doesn't glare next to the dark UI.
// Light: a touch brighter, a sunny floor.
const DARK_FLOOR_TONE = 0.84;
const LIGHT_FLOOR_TONE = 1.12;

const PALETTES: Record<Theme, ScenePalette> = {
  dark: {
    stage: 0x0d1a13,
    floor: 0x3a2a1e,
    wallTop: 0x14231c,
    wallBottom: 0x22382c,
    wainscot: 0x1a2c22,
    wainscotLine: 0x2c4434,
    wallTrim: 0x6b4a2f,
    wallTrimHighlight: 0x8a6340,
    neonStart: 0xa7f36a,
    neonEnd: 0x5fc48a,
    planks: PLANK_BASE.map((c) => shade(c, DARK_FLOOR_TONE)),
    plankSeam: shade(PLANK_SEAM_BASE, DARK_FLOOR_TONE),
    carpet: 0x1c3024,
    carpetBorder: 0x34523c,
    carpetLine: 0xa7f36a,
    carpetWeave: { color: 0xffffff, alpha: 0.025 },
    wallShadowAlpha: 0.28,
    vignette: 0x050a07,
    vignetteAlpha: 0.05,
  },
  light: {
    stage: 0xe4ecdc,
    floor: 0xb39f86,
    wallTop: 0xd3ddc8,
    wallBottom: 0xe9eee3,
    wainscot: 0xc9d5bc,
    wainscotLine: 0xb0c09f,
    wallTrim: 0x9c7650,
    wallTrimHighlight: 0xbf9a6e,
    neonStart: 0x9ed66a,
    neonEnd: 0x6fae4a,
    planks: PLANK_BASE.map((c) => shade(c, LIGHT_FLOOR_TONE)),
    plankSeam: shade(PLANK_SEAM_BASE, LIGHT_FLOOR_TONE),
    carpet: 0xbccfa8,
    carpetBorder: 0x8faa74,
    carpetLine: 0x4f8a1f,
    carpetWeave: { color: 0x2c3d1c, alpha: 0.04 },
    wallShadowAlpha: 0.14,
    vignette: 0x3c5028,
    vignetteAlpha: 0.035,
  },
};

export function scenePalette(theme: Theme): ScenePalette {
  return PALETTES[theme];
}

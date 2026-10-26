/**
 * The colours of the office scene (Pixi), one palette per UI theme, in the
 * Olymp Fit look:
 *   dark:  the studio at night, deep green walls and team carpet, smoked oak
 *          floor, graphite furniture, the lime accent on lines and LEDs;
 *   light: the same room by day, sage walls and carpet on the Radix olive
 *          scale, honey oak floor, birch desks, olive chairs, the deep
 *          #4f8a1f accent where lime would not read.
 * One light direction for everything: the light comes from the top left
 * (ceiling strip and window), so shadows fall down and to the right, and
 * every piece of furniture has the same 1 px outline in `outline`.
 * The CSS side of the stage (the studio gradient around the canvas) is in
 * styles/tokens.css (--qo-stage-*).
 */

import { shade } from "@/systems/colorShade";
import type { Theme } from "@/systems/theme";

/** A colour with its alpha (translucent overlays). */
export interface Tint {
  color: number;
  alpha: number;
}

/** Materials shared by the furniture in the room and the zones around it. */
export interface SceneMaterials {
  /** The 1 px outline of every piece of furniture. */
  outline: number;
  /** Desk tops: the surface, its lit back edge and the front lip. */
  deskTop: number;
  deskTopLight: number;
  deskEdge: number;
  /** Desk modesty panel and legs. */
  deskPanel: number;
  deskPanelLine: number;
  deskLeg: number;
  /** The boss's executive desk. */
  bossTop: number;
  bossTopLight: number;
  bossEdge: number;
  bossPanel: number;
  bossPanelLine: number;
  /** Task chairs: back cushion, its highlight, the frame. */
  chair: number;
  chairLight: number;
  chairDark: number;
  /** The boss's leather chair. */
  bossChair: number;
  bossChairLight: number;
  bossChairDark: number;
  /** The back of a monitor and its stand. */
  monitor: number;
  monitorLight: number;
  monitorStand: number;
  /** The status LED on the monitor's back (on while somebody works). */
  led: number;
  /** The light a lit screen spills onto its worker (add blend). */
  screenGlow: Tint;
  keyboard: number;
  keyboardKeys: number;
  /** Generic wood for shelves, cabinets and tables in the zones. */
  wood: number;
  woodDark: number;
  woodLight: number;
  metal: number;
  metalDark: number;
  /** Server racks, wall screens. */
  graphite: number;
  graphiteLight: number;
  stone: number;
  appliance: number;
  applianceLine: number;
  /** Upholstery: the lounge sofa (green) and the warm armchairs. */
  sofa: number;
  sofaDark: number;
  sofaLight: number;
  armchair: number;
  armchairDark: number;
  armchairLight: number;
  lampShade: number;
  /** Plants and their pots. */
  leaf: number;
  leafDark: number;
  leafLight: number;
  pot: number;
  potDark: number;
  potLight: number;
  soil: number;
  books: readonly number[];
  /** A dark screen (wall TV, microwave door). */
  screen: number;
  accent: number;
  ledAmber: number;
  /** Paper, cups, a magazine. */
  paper: number;
}

export interface ScenePalette {
  /** The canvas behind everything (seen while sprites load). */
  stage: number;
  /** The fallback floor under the planks. */
  floor: number;
  wallTop: number;
  wallBottom: number;
  /** Thin vertical acoustic slats on the upper wall. */
  wallSlat: Tint;
  /** The ceiling edge above the light strip. */
  ceiling: number;
  wainscot: number;
  wainscotLine: number;
  /** Panel bevels: lit top-left edge, shaded bottom-right edge. */
  bevelLight: Tint;
  bevelShade: Tint;
  wallTrim: number;
  wallTrimHighlight: number;
  /** The ceiling light strip runs from one colour into the other. */
  neonStart: number;
  neonEnd: number;
  planks: readonly number[];
  plankSeam: number;
  /** The lit top edge of each plank row and the wood grain. */
  plankLight: Tint;
  plankGrain: Tint;
  carpet: number;
  /** Every other carpet tile (a faint checker). */
  carpetTile: number;
  carpetBorder: number;
  /** The thin inner line of the carpet. */
  carpetLine: number;
  /** The fine weave of the carpet. */
  carpetWeave: Tint;
  /** The boss rug: field, its inner field, border and pattern. */
  rug: number;
  rugInner: number;
  rugBorder: number;
  rugPattern: number;
  /** The shadow under furniture and people (flat, pixel style). */
  shadow: Tint;
  /** The shadow the wall casts on the floor, at its darkest. */
  wallShadowAlpha: number;
  /** Soft ceiling light pools on the floor. */
  lightPool: Tint;
  /** The colour the floor fades into at the bottom and sides. */
  vignette: number;
  vignetteAlpha: number;
  /** Name tags and the desk marquee panels. */
  tag: number;
  tagText: string;
  marquee: number;
  marqueeLine: number;
  marqueeText: string;
  /** Wall posters and boards: the frame, the dark header, the accent. */
  frame: number;
  frameLight: number;
  boardHeader: number;
  boardAccent: number;
  /** The accent where it is ink on paper (clock hand, active board dot). */
  accentInk: number;
  /** How much of the floor's tone the zones' tiles take (0..1). */
  tileTone: number;
  /** The award gold (employee of the month) and its dark edge. */
  award: number;
  awardDark: number;
  materials: SceneMaterials;
}

// Smoked oak planks (dark) / honey oak planks (light), staggered seams.
const DARK_PLANKS = [0x5c4b39, 0x56463a, 0x625040, 0x524336, 0x5f4c3b];
const LIGHT_PLANKS = [0xcdb592, 0xc5ac89, 0xd5bd9b, 0xbfa682, 0xd0b893];

const BOOKS_DARK = [0x9c4a3c, 0x3f6688, 0xc39a45, 0x4f7f4a, 0x6f5687, 0xd8ccb2];
const BOOKS_LIGHT = [
  0xc0604c, 0x5584ad, 0xdcae52, 0x6a9a5e, 0x8a6fa0, 0xeee4cc,
];

const DARK_MATERIALS: SceneMaterials = {
  outline: 0x0a120e,
  deskTop: 0xb99a72,
  deskTopLight: 0xd2b38a,
  deskEdge: 0x7d6246,
  deskPanel: 0x1f2b25,
  deskPanelLine: 0x34443b,
  deskLeg: 0x141c18,
  bossTop: 0x7a5638,
  bossTopLight: 0x936a47,
  bossEdge: 0x4e3524,
  bossPanel: 0x2a1f17,
  bossPanelLine: 0x4a3626,
  chair: 0x26332c,
  chairLight: 0x3a4a41,
  chairDark: 0x151d19,
  bossChair: 0x5a3a26,
  bossChairLight: 0x7a5236,
  bossChairDark: 0x35231a,
  monitor: 0x1c2420,
  monitorLight: 0x34403a,
  monitorStand: 0x46524b,
  led: 0xa7f36a,
  screenGlow: { color: 0x9fe0c0, alpha: 0.045 },
  keyboard: 0x1a2320,
  keyboardKeys: 0x48564f,
  wood: 0x7a5a3e,
  woodDark: 0x54402e,
  woodLight: 0x987250,
  metal: 0x7d8a84,
  metalDark: 0x2c3632,
  graphite: 0x1d2522,
  graphiteLight: 0x2f3a35,
  stone: 0xb9bfb4,
  appliance: 0xc9cfc6,
  applianceLine: 0x7d867c,
  sofa: 0x2f5a45,
  sofaDark: 0x22443a,
  sofaLight: 0x44775b,
  armchair: 0xb07d3c,
  armchairDark: 0x84592b,
  armchairLight: 0xc9954f,
  lampShade: 0xf0dcae,
  leaf: 0x3f7f45,
  leafDark: 0x2a5a33,
  leafLight: 0x62a55a,
  pot: 0x3d4b43,
  potDark: 0x28332d,
  potLight: 0x5a6b61,
  soil: 0x3a2c20,
  books: BOOKS_DARK,
  screen: 0x0d1512,
  accent: 0xa7f36a,
  ledAmber: 0xf3c552,
  paper: 0xeeeadf,
};

const LIGHT_MATERIALS: SceneMaterials = {
  outline: 0x3b4632,
  deskTop: 0xe0cfae,
  deskTopLight: 0xf0e4ca,
  deskEdge: 0xa88f68,
  deskPanel: 0x7f9170,
  deskPanelLine: 0x9aab89,
  deskLeg: 0x46533d,
  bossTop: 0xb98d5e,
  bossTopLight: 0xcfa474,
  bossEdge: 0x8a6440,
  bossPanel: 0x7a5a3c,
  bossPanelLine: 0x9a7650,
  chair: 0x5f7a46,
  chairLight: 0x7f9a62,
  chairDark: 0x445833,
  bossChair: 0x8a5a36,
  bossChairLight: 0xa8744a,
  bossChairDark: 0x633f25,
  monitor: 0xb9c1b3,
  monitorLight: 0xdde2d7,
  monitorStand: 0x89937f,
  led: 0x4f8a1f,
  screenGlow: { color: 0xffffff, alpha: 0.025 },
  keyboard: 0x56634c,
  keyboardKeys: 0xe8ece2,
  wood: 0xb08a62,
  woodDark: 0x8a6a4a,
  woodLight: 0xc9a47a,
  metal: 0xa4ada0,
  metalDark: 0x5d6858,
  graphite: 0x3a453c,
  graphiteLight: 0x4f5c52,
  stone: 0xe4e6dc,
  appliance: 0xf1f3ec,
  applianceLine: 0x9da694,
  sofa: 0x5f8a5a,
  sofaDark: 0x4a7047,
  sofaLight: 0x7aa572,
  armchair: 0xd49c4e,
  armchairDark: 0xae7a36,
  armchairLight: 0xe6b46a,
  lampShade: 0xfbeccb,
  leaf: 0x4f9a4c,
  leafDark: 0x377538,
  leafLight: 0x77bf66,
  pot: 0xd9cdb6,
  potDark: 0xb3a487,
  potLight: 0xf1e9d8,
  soil: 0x5a4430,
  books: BOOKS_LIGHT,
  screen: 0x1f2a24,
  accent: 0x4f8a1f,
  ledAmber: 0xd9a23c,
  paper: 0xfbf9f2,
};

const PALETTES: Record<Theme, ScenePalette> = {
  dark: {
    stage: 0x0d1a13,
    floor: 0x3e3226,
    wallTop: 0x14231c,
    wallBottom: 0x22382c,
    wallSlat: { color: 0x000000, alpha: 0.09 },
    ceiling: 0x0c1611,
    wainscot: 0x1a2c22,
    wainscotLine: 0x2c4434,
    bevelLight: { color: 0xffffff, alpha: 0.05 },
    bevelShade: { color: 0x000000, alpha: 0.22 },
    wallTrim: 0x4e3a29,
    wallTrimHighlight: 0x6e543b,
    neonStart: 0xa7f36a,
    neonEnd: 0x5fc48a,
    planks: DARK_PLANKS,
    plankSeam: 0x2e241b,
    plankLight: { color: 0xffffff, alpha: 0.05 },
    plankGrain: { color: 0x000000, alpha: 0.1 },
    carpet: 0x1c3024,
    carpetTile: 0x1f3428,
    carpetBorder: 0x34523c,
    carpetLine: 0xa7f36a,
    carpetWeave: { color: 0xffffff, alpha: 0.025 },
    rug: 0x3a2c1f,
    rugInner: 0x45342a,
    rugBorder: 0xb98a4c,
    rugPattern: 0xf0b866,
    shadow: { color: 0x020805, alpha: 0.32 },
    wallShadowAlpha: 0.3,
    lightPool: { color: 0xfff0cc, alpha: 0.022 },
    vignette: 0x030806,
    vignetteAlpha: 0.12,
    tag: 0x0f1715,
    tagText: "#f2f6f2",
    marquee: 0x0b1210,
    marqueeLine: 0x2f3f37,
    marqueeText: "#a7f36a",
    frame: 0x2a3631,
    frameLight: 0x45534c,
    boardHeader: 0x16211d,
    boardAccent: 0xa7f36a,
    accentInk: 0x4f8a1f,
    tileTone: 0.55,
    award: 0xf0b866,
    awardDark: 0xb98a4c,
    materials: DARK_MATERIALS,
  },
  light: {
    stage: 0xe4ecdc,
    floor: 0xb9a07e,
    wallTop: 0xd3ddc8,
    wallBottom: 0xe9eee3,
    wallSlat: { color: 0x3c5028, alpha: 0.045 },
    ceiling: 0xbfcbb2,
    wainscot: 0xc9d5bc,
    wainscotLine: 0xb0c09f,
    bevelLight: { color: 0xffffff, alpha: 0.35 },
    bevelShade: { color: 0x3c5028, alpha: 0.14 },
    wallTrim: 0x9c7650,
    wallTrimHighlight: 0xbf9a6e,
    neonStart: 0x9ed66a,
    neonEnd: 0x6fae4a,
    planks: LIGHT_PLANKS,
    plankSeam: shade(0xa58c6a, 0.92),
    plankLight: { color: 0xffffff, alpha: 0.16 },
    plankGrain: { color: 0x5a4024, alpha: 0.08 },
    carpet: 0xbccfa8,
    carpetTile: 0xc0d2ac,
    carpetBorder: 0x8faa74,
    carpetLine: 0x4f8a1f,
    carpetWeave: { color: 0x2c3d1c, alpha: 0.03 },
    rug: 0xd8c39a,
    rugInner: 0xe2cfa8,
    rugBorder: 0x9a6a32,
    rugPattern: 0x8a5200,
    shadow: { color: 0x2c3a1e, alpha: 0.18 },
    wallShadowAlpha: 0.12,
    lightPool: { color: 0xffffff, alpha: 0.05 },
    vignette: 0x3c5028,
    vignetteAlpha: 0.06,
    tag: 0xf4f6f0,
    tagText: "#14201a",
    marquee: 0x1f2a24,
    marqueeLine: 0x56634c,
    marqueeText: "#a7f36a",
    frame: 0x8f9a86,
    frameLight: 0xc5cdbc,
    boardHeader: 0x1d2b26,
    boardAccent: 0x8fe04e,
    accentInk: 0x4f8a1f,
    tileTone: 0.15,
    award: 0xe8ac55,
    awardDark: 0x9a6a32,
    materials: LIGHT_MATERIALS,
  },
};

export function scenePalette(theme: Theme): ScenePalette {
  return PALETTES[theme];
}

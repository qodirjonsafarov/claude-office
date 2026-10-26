/**
 * The office tint (wave 3 preview): the studio, the walls and the team carpet
 * in Olymp greens instead of the old navy/teal. Two variants are on trial so
 * the owner can pick one from screenshots:
 *   a: subtle dark green (default)
 *   b: a bit more lime
 * Switch with `?tint=b` in the URL. The CSS side (the studio gradient) reads
 * `data-tint` on <html>, set by the boot script in app/layout.tsx.
 * TEMPORARY: once a variant is chosen, fold it into the constants and drop
 * the switch.
 */

export type SceneTint = "a" | "b";

export function parseSceneTint(search: string): SceneTint {
  const value = new URLSearchParams(search).get("tint");
  return value?.toLowerCase() === "b" ? "b" : "a";
}

/** The tint of this page load ("a" on the server). */
export function currentSceneTint(): SceneTint {
  if (typeof window === "undefined") return "a";
  return parseSceneTint(window.location.search);
}

export interface ScenePalette {
  wallTop: number;
  wallBottom: number;
  wainscot: number;
  wainscotLine: number;
  carpet: number;
  carpetBorder: number;
  /** The thin inner line of the carpet (was violet). */
  carpetLine: number;
  /** The ceiling neon strip runs from one colour into the other. */
  neonStart: number;
  neonEnd: number;
}

const PALETTES: Record<SceneTint, ScenePalette> = {
  a: {
    wallTop: 0x14231c,
    wallBottom: 0x22382c,
    wainscot: 0x1a2c22,
    wainscotLine: 0x2c4434,
    carpet: 0x1c3024,
    carpetBorder: 0x34523c,
    carpetLine: 0xa7f36a,
    neonStart: 0xa7f36a,
    neonEnd: 0x5fc48a,
  },
  b: {
    wallTop: 0x1a2a14,
    wallBottom: 0x2f4620,
    wainscot: 0x22361a,
    wainscotLine: 0x3a5628,
    carpet: 0x2a4419,
    carpetBorder: 0x4f7a2a,
    carpetLine: 0xc4f58e,
    neonStart: 0xc4f58e,
    neonEnd: 0xa7f36a,
  },
};

export function scenePalette(tint: SceneTint): ScenePalette {
  return PALETTES[tint];
}

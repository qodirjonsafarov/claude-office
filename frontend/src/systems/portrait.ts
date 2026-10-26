/**
 * The agent portrait: head and shoulders cut from the person's own people
 * sheet (the idle frame facing the viewer), shown as a CSS background so it
 * scales by whole sprite pixels (with image-rendering: pixelated). The boss
 * wears his own sheet; agents the look the office gave them
 * (systems/agentLooks.ts). Pure TS.
 */

import { FRAME, ROW, SHEET_X } from "./personFrames";

/** Every people sheet is this big (scripts/compose_lpc_people.py). */
const SHEET_WIDTH = 2432;
const SHEET_HEIGHT = 256;

/** The square cut out of the sheet (sheet px): hair top to the chest (tie). */
export const PORTRAIT_CROP = {
  x: SHEET_X.idle + 16,
  y: ROW.down * FRAME + 9,
  size: 32,
} as const;

export function sheetUrl(sheet: string): string {
  return `/sprites/people/${sheet}.png`;
}

export interface PortraitBackground {
  backgroundImage: string;
  backgroundPosition: string;
  backgroundSize: string;
}

/** Background that shows the crop of `sheet` in a `px` square box. */
export function portraitBackground(
  sheet: string,
  px: number,
): PortraitBackground {
  const scale = px / PORTRAIT_CROP.size;
  return {
    backgroundImage: `url("${sheetUrl(sheet)}")`,
    backgroundPosition: `-${PORTRAIT_CROP.x * scale}px -${PORTRAIT_CROP.y * scale}px`,
    backgroundSize: `${SHEET_WIDTH * scale}px ${SHEET_HEIGHT * scale}px`,
  };
}

/** The sheet a person wears; null for an agent not in the office yet. */
export function portraitSheet(
  id: string,
  looks: ReadonlyMap<string, string>,
): string | null {
  if (id === "boss") return "boss";
  return looks.get(id) ?? null;
}

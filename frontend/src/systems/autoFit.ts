/**
 * Auto-fit zoom for the office scene. The canvas is drawn "contain" at the
 * panel's top-left (globals.css); this zoom fills more of the panel, cropping
 * the scene by at most MAX_CROP on the long side, and centres it.
 */

/** Largest share of the scene that the fit may crop away. */
export const MAX_CROP = 0.1;

export function autoFit(
  panelW: number,
  panelH: number,
  canvasW: number,
  canvasH: number,
): { scale: number; x: number; y: number } {
  if (panelW <= 0 || panelH <= 0) return { scale: 1, x: 0, y: 0 };
  const contain = Math.min(panelW / canvasW, panelH / canvasH);
  const cover = Math.max(panelW / canvasW, panelH / canvasH);
  const scale = Math.min(cover / contain, 1 / (1 - MAX_CROP));
  const shownW = canvasW * contain * scale;
  const shownH = canvasH * contain * scale;
  return { scale, x: (panelW - shownW) / 2, y: (panelH - shownH) / 2 };
}

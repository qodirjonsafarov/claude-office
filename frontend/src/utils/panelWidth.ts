/**
 * The default width of a side panel: a share of the window inside its
 * limits, instead of one fixed width. A small or zoomed-in window gets slim
 * panels (the office gets the room); a big screen gets wider ones.
 */

export interface FluidWidth {
  min: number;
  /** The share of the window width (0..1). */
  share: number;
  max: number;
}

export function fluidPanelWidth(
  viewportWidth: number,
  spec: FluidWidth,
): number {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return spec.min;
  const width = Math.round(viewportWidth * spec.share);
  return Math.min(spec.max, Math.max(spec.min, width));
}

/** The sessions panel (left) and the team/events panel (right). */
export const LEFT_PANEL: FluidWidth = { min: 220, share: 0.15, max: 380 };
export const RIGHT_PANEL: FluidWidth = { min: 260, share: 0.17, max: 440 };

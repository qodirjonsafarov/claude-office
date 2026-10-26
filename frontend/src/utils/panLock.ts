/**
 * Pan limits for the office scene. The scene fills its stage exactly at the
 * fit (zoom 1 at the origin), so:
 * - at the fit, or below it, the scene is locked: no pan, exactly fitted;
 * - zoomed in, it pans only until its edges meet the stage's edges, so no
 *   empty band ever shows (drag, wheel/pinch around a point, resize).
 */

export interface PanView {
  x: number;
  y: number;
  scale: number;
}

export interface StageSize {
  width: number;
  height: number;
}

/** The auto-fit zoom: the canvas takes the stage's shape. */
export const FIT_SCALE = 1;

/** Zoom rounding noise around the fit, still treated as the fit. */
const SCALE_EPSILON = 0.005;
/** Overshoot (px) left alone, so we never fight the library's rounding. */
const PX_EPSILON = 0.5;

export function isPanLocked(scale: number, fit = FIT_SCALE): boolean {
  return scale <= fit + SCALE_EPSILON;
}

function clampAxis(pos: number, stage: number, scale: number): number {
  const min = Math.min(0, stage * (1 - scale));
  const v = Math.min(0, Math.max(min, pos));
  return v === 0 ? 0 : v; // no -0
}

/** The nearest allowed view: fitted when locked, edges kept outside. */
export function clampPan(
  view: PanView,
  stage: StageSize,
  fit = FIT_SCALE,
): PanView {
  if (view.scale <= fit) return { x: 0, y: 0, scale: fit };
  return {
    x: clampAxis(view.x, stage.width, view.scale),
    y: clampAxis(view.y, stage.height, view.scale),
    scale: view.scale,
  };
}

/** The view to move to, or null when `view` is already (nearly) allowed. */
export function panCorrection(
  view: PanView,
  stage: StageSize,
  fit = FIT_SCALE,
): PanView | null {
  const target = isPanLocked(view.scale, fit)
    ? { x: 0, y: 0, scale: view.scale }
    : clampPan(view, stage, fit);
  if (view.scale < fit - SCALE_EPSILON) target.scale = fit;
  const off =
    Math.abs(target.x - view.x) > PX_EPSILON ||
    Math.abs(target.y - view.y) > PX_EPSILON ||
    target.scale !== view.scale;
  return off ? target : null;
}

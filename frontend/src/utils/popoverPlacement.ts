/**
 * Where the desktop agent card goes: beside the character, inside the stage
 * (the office area). Right of the character by default, flipped to the left
 * near the right edge, clamped over the character when neither side fits,
 * and never above, below or taller than the stage.
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Placement {
  left: number;
  top: number;
  maxHeight: number;
  side: "right" | "left" | "over";
}

/** Space between the character and the card. */
const GAP = 24;
/** Space kept from the stage edges. */
const MARGIN = 12;
/** The card starts a little above the character, so the head stays beside it. */
const LIFT = 120;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max));
}

export function placePopover(
  anchor: { x: number; y: number },
  size: { width: number; height: number },
  stage: Rect,
): Placement {
  const minX = stage.left + MARGIN;
  const maxX = stage.right - MARGIN - size.width;
  const maxHeight = Math.max(0, stage.bottom - stage.top - 2 * MARGIN);
  const height = Math.min(size.height, maxHeight);

  let side: Placement["side"];
  let left: number;
  const right = anchor.x + GAP;
  const leftSide = anchor.x - GAP - size.width;
  if (right >= minX && right <= maxX) {
    side = "right";
    left = right;
  } else if (leftSide >= minX && leftSide <= maxX) {
    side = "left";
    left = leftSide;
  } else {
    side = "over";
    left = maxX < minX ? minX : clamp(anchor.x - size.width / 2, minX, maxX);
  }

  const top = clamp(
    anchor.y - LIFT,
    stage.top + MARGIN,
    stage.bottom - MARGIN - height,
  );
  return { left, top, maxHeight, side };
}

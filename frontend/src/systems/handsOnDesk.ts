/**
 * Hands on the desk. A seated worker sits behind the desk, so the desk top
 * (drawn over the seated body) used to hide the hands: typing happened under
 * the desk. The hands of the worker's own current frame (the typing frames'
 * pressing hands included) are drawn once more in a layer above the desk and
 * keyboard, reaching forward a few px so they rest on the keyboard. Same
 * pixels, same frame, no drawn limbs. Pure geometry, no Pixi.
 */

/** Sprite scale and seated feet offset of the LPC workers (PersonSprite, AgentSprite). */
export const PERSON_SCALE = 1.55;
export const SEATED_FEET_Y = 30;
/** The sprite's anchor row: the feet stand on row 62 of the 64 px frame. */
const ANCHOR_ROW = 62;
const FRAME_CENTRE = 32;

/** The cuffs and both hands in a seated frame (frame px). */
export const HANDS_CROP = { x: 20, y: 42, w: 24, h: 11 } as const;

/** How far the hands reach forward onto the keyboard (scene px). */
export const HANDS_REACH = 8;

/** Top-left of the hands crop in the sprite's local coordinates. */
export function handsCropPlacement(
  feetY: number,
  scale: number,
): { x: number; y: number } {
  return {
    x: (HANDS_CROP.x - FRAME_CENTRE) * scale,
    y: feetY + (HANDS_CROP.y - ANCHOR_ROW) * scale + HANDS_REACH,
  };
}

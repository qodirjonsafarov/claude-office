/**
 * Layout of the pixel-icon atlas (/sprites/icons/pixel-icons.png, built by
 * scripts/make_pixel_icons.py from pixelarticons, MIT). 24 px cells.
 */
import type { IconKind } from "./sceneSignals";

export const ICON_SIZE = 24;

/** Atlas cell per icon kind (order of scripts/make_pixel_icons.py ORDER). */
export const ICON_FRAMES: Record<IconKind | "alert", number> = {
  read: 0, // book-open
  edit: 1, // pencil
  terminal: 2, // terminal
  web: 3, // globe
  task: 4, // users
  error: 5, // close
  done: 6, // check
  alert: 7, // square-alert
};

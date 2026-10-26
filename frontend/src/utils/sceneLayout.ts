/**
 * The canvas around the office room: it takes the stage's aspect ratio, so
 * the canvas always fills the stage edge to edge. The 1280x1024 room (desks,
 * boss, elevator and the wall) sits centred and whole inside it; the extra
 * space on the long side shows the extended room (more wall and floor), not
 * the stage colour.
 */

import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/constants/canvas";

export interface SceneLayout {
  /** The canvas in scene pixels. */
  width: number;
  height: number;
  /** Where the room's top-left corner sits on the canvas. */
  offsetX: number;
  offsetY: number;
}

export const ROOM_ONLY: SceneLayout = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  offsetX: 0,
  offsetY: 0,
};

export function sceneLayout(stageW: number, stageH: number): SceneLayout {
  if (stageW <= 0 || stageH <= 0) return ROOM_ONLY;
  const aspect = stageW / stageH;
  const room = CANVAS_WIDTH / CANVAS_HEIGHT;
  if (aspect >= room) {
    const width = Math.round(CANVAS_HEIGHT * aspect);
    return {
      width,
      height: CANVAS_HEIGHT,
      offsetX: Math.round((width - CANVAS_WIDTH) / 2),
      offsetY: 0,
    };
  }
  const height = Math.round(CANVAS_WIDTH / aspect);
  return {
    width: CANVAS_WIDTH,
    height,
    offsetX: 0,
    offsetY: Math.round((height - CANVAS_HEIGHT) / 2),
  };
}

/** Same canvas size and room position. */
export function sameLayout(a: SceneLayout, b: SceneLayout): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY
  );
}

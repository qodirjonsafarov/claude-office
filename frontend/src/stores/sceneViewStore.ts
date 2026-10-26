/**
 * The canvas around the office room right now (utils/sceneLayout.ts): set by
 * OfficeGame from the stage size, read by whatever maps a spot in the room to
 * the screen (the agent card's anchor).
 */

import { create } from "zustand";
import { ROOM_ONLY, sameLayout, type SceneLayout } from "@/utils/sceneLayout";

interface SceneViewState {
  layout: SceneLayout;
  setLayout: (layout: SceneLayout) => void;
}

export const useSceneView = create<SceneViewState>()((set) => ({
  layout: ROOM_ONLY,
  setLayout: (layout) =>
    set((state) => (sameLayout(state.layout, layout) ? state : { layout })),
}));

/** A point in room coordinates on the screen (client px); null without a canvas. */
export function sceneToClient(
  x: number,
  y: number,
): { x: number; y: number } | null {
  const canvas = document.querySelector(".pixi-canvas-container canvas");
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const { layout } = useSceneView.getState();
  const scale = rect.width / layout.width;
  return {
    x: rect.left + (x + layout.offsetX) * scale,
    y: rect.top + (y + layout.offsetY) * scale,
  };
}

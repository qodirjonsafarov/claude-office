"use client";

import { Graphics } from "pixi.js";
import { useCallback, type ReactNode } from "react";
import {
  useGameStore,
  selectToolUsesSinceCompaction,
} from "@/stores/gameStore";
import { scenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";
import { SCENE_AMBER } from "./shared/sceneColors";

const SCENE_FONT = '"DejaVu Sans", Verdana, Arial, sans-serif';

/**
 * SafetySign - Office safety sign showing tool uses since compaction
 *
 * A dark enamel sign with an amber hazard header and a counter showing the
 * number of tool uses since the last context compaction.
 */
export function SafetySign(): ReactNode {
  const toolUsesSinceCompaction = useGameStore(selectToolUsesSinceCompaction);

  const palette = scenePalette(useTheme());
  const drawSign = useCallback(
    (g: Graphics) => {
      g.clear();
      const m = palette.materials;
      // Shadow on the wall, a dark enamel sign with a graphite rim
      g.roundRect(3, 4, 140, 100, 6);
      g.fill(palette.shadow);
      g.roundRect(0, 0, 140, 100, 6);
      g.fill(m.outline);
      g.roundRect(1, 1, 138, 98, 5);
      g.fill(palette.frame);
      g.roundRect(4, 4, 132, 92, 4);
      g.fill(palette.boardHeader);
      g.rect(8, 5, 124, 1);
      g.fill(palette.frameLight);
      // Amber header band with hazard stripes at both ends
      g.rect(10, 10, 120, 20);
      g.fill(SCENE_AMBER);
      for (const x0 of [12, 112]) {
        for (let k = 0; k < 3; k++) {
          g.poly([
            x0 + k * 6,
            30,
            x0 + k * 6 + 3,
            30,
            x0 + k * 6 + 7,
            10,
            x0 + k * 6 + 4,
            10,
          ]);
          g.fill({ color: m.outline, alpha: 0.75 });
        }
      }
      // Screws in the corners
      for (const [sx, sy] of [
        [8, 92],
        [132, 92],
      ]) {
        g.rect(sx - 1, sy - 1, 3, 3);
        g.fill(palette.frameLight);
      }
    },
    [palette],
  );

  return (
    <pixiContainer>
      <pixiGraphics draw={drawSign} />
      {/* All text rendered at 2x and scaled down for sharpness */}
      {/* Header text */}
      <pixiContainer x={70} y={20} scale={0.5}>
        <pixiText
          text="SAFETY"
          anchor={0.5}
          style={{
            fontFamily: SCENE_FONT,
            fontSize: 20,
            fontWeight: "bold",
            letterSpacing: 3,
            fill: "#2a1d0c",
          }}
        />
      </pixiContainer>
      {/* Big number - dynamic counter */}
      <pixiContainer x={70} y={52} scale={0.5}>
        <pixiText
          text={String(toolUsesSinceCompaction)}
          anchor={0.5}
          style={{
            fontFamily: SCENE_FONT,
            fontSize: 52,
            fontWeight: "bold",
            fill: "#f2f6f2",
          }}
        />
      </pixiContainer>
      {/* Label text */}
      <pixiContainer x={70} y={72} scale={0.5}>
        <pixiText
          text="TOOL USES"
          anchor={0.5}
          style={{
            fontFamily: SCENE_FONT,
            fontSize: 15,
            fontWeight: "bold",
            letterSpacing: 1,
            fill: "#a9b8b0",
          }}
        />
      </pixiContainer>
      <pixiContainer x={70} y={84} scale={0.5}>
        <pixiText
          text="SINCE COMPACTION"
          anchor={0.5}
          style={{
            fontFamily: SCENE_FONT,
            fontSize: 15,
            fontWeight: "bold",
            letterSpacing: 1,
            fill: "#a9b8b0",
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

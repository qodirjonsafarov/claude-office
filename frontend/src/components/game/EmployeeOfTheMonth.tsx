"use client";

import { Graphics, Assets, Texture } from "pixi.js";
import { useCallback, useState, useEffect, type ReactNode } from "react";
import { scenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";
import { box, dropShadow, wash } from "./shared/pixelDraw";

/** The ink on the gold name plate. */
const GOLD_INK = "#2a1d0c";
const SCENE_FONT = '"DejaVu Sans", Verdana, Arial, sans-serif';

/**
 * EmployeeOfTheMonth - Wall poster showing the employee of the month
 *
 * A framed poster in the Olymp look: an oak frame, a dark green header with
 * the lime title, the user's photo in a gold mat and a gold name plate.
 */
export function EmployeeOfTheMonth(): ReactNode {
  const [photoTexture, setPhotoTexture] = useState<Texture | null>(null);
  const palette = scenePalette(useTheme());

  useEffect(() => {
    const assetPath = "/sprites/employee-of-month.png";
    Assets.load(assetPath)
      .then((texture) => {
        setPhotoTexture(texture as Texture);
      })
      .catch((err) => {
        console.warn(`[EmployeeOfTheMonth] Failed to load ${assetPath}:`, err);
      });
  }, []);

  const drawFrame = useCallback(
    (g: Graphics) => {
      g.clear();
      const m = palette.materials;
      // Shadow on the wall, down-right
      dropShadow(g, 0, 0, 130, 172, palette.shadow);
      // Oak frame with a lit top-left edge
      box(g, 0, 0, 130, 172, m.woodLight, m.outline);
      wash(g, 1, 1, 128, 1, palette.bevelLight);
      wash(g, 1, 1, 1, 170, palette.bevelLight);
      wash(g, 2, 169, 127, 2, palette.bevelShade);
      // Paper
      box(g, 4, 4, 122, 164, m.paper);
      // Dark header bar
      box(g, 6, 6, 118, 26, palette.boardHeader);
      box(g, 6, 31, 118, 1, palette.boardAccent);
      // Photo in a gold mat
      box(g, 7, 35, 116, 116, palette.award, m.outline);
      box(g, 9, 37, 112, 112, 0x1a1a1a);
      // Name plate
      box(g, 7, 154, 116, 13, palette.award, palette.awardDark);
      wash(g, 8, 155, 114, 1, { color: 0xffffff, alpha: 0.35 });
      // A small star on each side of the title
      for (const sx of [14, 114]) {
        box(g, sx - 1, 14, 3, 7, palette.boardAccent);
        box(g, sx - 3, 16, 7, 3, palette.boardAccent);
      }
    },
    [palette],
  );

  return (
    <pixiContainer>
      <pixiGraphics draw={drawFrame} />
      {/* Header text - rendered at 2x and scaled for sharpness */}
      <pixiContainer x={65} y={13} scale={0.5}>
        <pixiText
          text="EMPLOYEE"
          anchor={0.5}
          style={{
            fontFamily: SCENE_FONT,
            fontSize: 22,
            fontWeight: "bold",
            letterSpacing: 2,
            fill: palette.boardAccent,
          }}
        />
      </pixiContainer>
      <pixiContainer x={65} y={25} scale={0.5}>
        <pixiText
          text="OF THE MONTH"
          anchor={0.5}
          style={{
            fontFamily: SCENE_FONT,
            fontSize: 14,
            fontWeight: "bold",
            letterSpacing: 1,
            fill: "#f2f6f2",
          }}
        />
      </pixiContainer>
      {/* Photo */}
      {photoTexture && (
        <pixiSprite
          texture={photoTexture}
          x={65}
          y={93}
          anchor={0.5}
          scale={0.109}
        />
      )}
      {/* Name plate text */}
      <pixiContainer x={65} y={161} scale={0.5}>
        <pixiText
          text="QODIRJON"
          anchor={0.5}
          style={{
            fontFamily: SCENE_FONT,
            fontSize: 18,
            fontWeight: "bold",
            letterSpacing: 2,
            fill: GOLD_INK,
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

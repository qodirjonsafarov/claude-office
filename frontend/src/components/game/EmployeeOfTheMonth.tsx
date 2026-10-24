"use client";

import { Graphics, Assets, Texture } from "pixi.js";
import { useCallback, useState, useEffect, type ReactNode } from "react";

/**
 * EmployeeOfTheMonth - Wall poster showing the employee of the month
 *
 * Displays a framed poster with "Employee of the Month" header
 * and a pixel art portrait.
 */
export function EmployeeOfTheMonth(): ReactNode {
  const [photoTexture, setPhotoTexture] = useState<Texture | null>(null);

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

  const drawFrame = useCallback((g: Graphics) => {
    g.clear();

    // Shadow
    g.roundRect(5, 5, 130, 172, 4);
    g.fill({ color: 0x000000, alpha: 0.3 });

    // Main poster background - cream/off-white
    g.roundRect(0, 0, 130, 172, 4);
    g.fill(0xf5f0e6);
    g.stroke({ width: 3, color: 0x8b7355 });

    // Dark header bar for contrast
    g.rect(5, 5, 120, 26);
    g.fill(0x2a2a4a);
    g.stroke({ width: 1, color: 0x1a1a2a });

    // Photo frame area - large, almost the full poster width
    g.rect(7, 35, 116, 116);
    g.fill(0x1a1a1a);
    g.stroke({ width: 3, color: 0xdaa520 });

    // Name plate background
    g.rect(7, 154, 116, 13);
    g.fill(0xdaa520);

    // Decorative gold corners on frame
    const cornerSize = 10;
    const left = 7;
    const top = 35;
    const right = 123;
    const bottom = 151;
    g.moveTo(left, top + cornerSize);
    g.lineTo(left, top);
    g.lineTo(left + cornerSize, top);
    g.stroke({ width: 2, color: 0xffd700 });
    g.moveTo(right - cornerSize, top);
    g.lineTo(right, top);
    g.lineTo(right, top + cornerSize);
    g.stroke({ width: 2, color: 0xffd700 });
    g.moveTo(left, bottom - cornerSize);
    g.lineTo(left, bottom);
    g.lineTo(left + cornerSize, bottom);
    g.stroke({ width: 2, color: 0xffd700 });
    g.moveTo(right - cornerSize, bottom);
    g.lineTo(right, bottom);
    g.lineTo(right, bottom - cornerSize);
    g.stroke({ width: 2, color: 0xffd700 });
  }, []);

  return (
    <pixiContainer>
      <pixiGraphics draw={drawFrame} />
      {/* Header text - rendered at 2x and scaled for sharpness */}
      <pixiContainer x={65} y={12} scale={0.5}>
        <pixiText
          text="EMPLOYEE"
          anchor={0.5}
          style={{
            fontFamily: '"Arial Black", Arial, sans-serif',
            fontSize: 24,
            fontWeight: "bold",
            fill: "#ffd700",
            dropShadow: {
              color: "#000000",
              blur: 0,
              distance: 2,
              angle: Math.PI / 4,
            },
          }}
        />
      </pixiContainer>
      <pixiContainer x={65} y={24} scale={0.5}>
        <pixiText
          text="OF THE MONTH"
          anchor={0.5}
          style={{
            fontFamily: '"Arial Black", Arial, sans-serif',
            fontSize: 16,
            fontWeight: "bold",
            fill: "#ffffff",
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
          scale={0.111}
        />
      )}
      {/* Name plate text */}
      <pixiContainer x={65} y={161} scale={0.5}>
        <pixiText
          text="QODIRJON"
          anchor={0.5}
          style={{
            fontFamily: '"Arial Black", Arial, sans-serif',
            fontSize: 20,
            fontWeight: "bold",
            fill: "#1a1a1a",
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

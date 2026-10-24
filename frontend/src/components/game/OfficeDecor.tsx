"use client";

/**
 * OfficeDecor Component
 *
 * Modern touches for the office scene: a neon "QODIRJON HQ" sign on the
 * lower wall and extra plants.
 * Purely decorative — nothing here takes part in pathfinding.
 */

import { type ReactNode, useCallback } from "react";
import { Graphics, Texture } from "pixi.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const NEON_SIGN_POSITION = { x: 450, y: 204 };
const PLANT_SPOTS = [
  { x: 1236, y: 330, scale: 0.12 },
  { x: 1236, y: 700, scale: 0.11 },
  { x: 1150, y: 985, scale: 0.13 },
];

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

function drawNeonBacking(g: Graphics): void {
  g.clear();
  // Dark acrylic plate behind the neon letters
  g.roundRect(-118, -20, 236, 40, 10);
  g.fill({ color: 0x0b1020, alpha: 0.85 });
  g.stroke({ width: 2, color: 0x8b5cf6, alpha: 0.6 });
  // Glow halo
  for (let i = 1; i <= 4; i++) {
    g.roundRect(-118 - i * 4, -20 - i * 4, 236 + i * 8, 40 + i * 8, 14);
    g.stroke({ width: 3, color: 0xff8a3d, alpha: 0.06 });
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

interface OfficeDecorProps {
  plantTexture?: Texture | null;
}

export function OfficeDecor({ plantTexture }: OfficeDecorProps): ReactNode {
  const drawNeonCallback = useCallback((g: Graphics) => drawNeonBacking(g), []);

  return (
    <>
      {/* Neon sign */}
      <pixiContainer x={NEON_SIGN_POSITION.x} y={NEON_SIGN_POSITION.y}>
        <pixiGraphics draw={drawNeonCallback} />
        <pixiContainer scale={0.5}>
          <pixiText
            text="QODIRJON HQ"
            anchor={0.5}
            style={{
              fontFamily: '"Arial Black", Arial, sans-serif',
              fontSize: 44,
              fontWeight: "bold",
              letterSpacing: 6,
              fill: "#ffe3c9",
              stroke: { color: "#ff8a3d", width: 3 },
              dropShadow: {
                color: "#ff8a3d",
                blur: 12,
                distance: 0,
                alpha: 1,
              },
            }}
          />
        </pixiContainer>
      </pixiContainer>

      {/* Extra plants */}
      {plantTexture &&
        PLANT_SPOTS.map((spot, index) => (
          <pixiSprite
            key={index}
            texture={plantTexture}
            anchor={0.5}
            x={spot.x}
            y={spot.y}
            scale={spot.scale}
          />
        ))}
    </>
  );
}

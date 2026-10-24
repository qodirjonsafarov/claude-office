"use client";

/**
 * OfficeDecor Component
 *
 * Modern touches for the office scene: a neon "QODIRJON HQ" sign on the
 * lower wall, a lounge corner with a sofa and coffee table, and extra plants.
 * Purely decorative — nothing here takes part in pathfinding.
 */

import { type ReactNode, useCallback } from "react";
import { Graphics, Texture } from "pixi.js";

// ============================================================================
// CONSTANTS
// ============================================================================

const NEON_SIGN_POSITION = { x: 450, y: 204 };
const LOUNGE_POSITION = { x: 935, y: 905 };
const PLANT_SPOTS = [
  { x: 1236, y: 330, scale: 0.12 },
  { x: 1236, y: 700, scale: 0.11 },
  { x: 1150, y: 985, scale: 0.13 },
  { x: 838, y: 985, scale: 0.1 },
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

function drawLounge(g: Graphics): void {
  g.clear();

  // Round rug
  g.ellipse(0, 40, 150, 62);
  g.fill({ color: 0x000000, alpha: 0.18 });
  g.ellipse(0, 34, 146, 58);
  g.fill(0x3a2f5c);
  g.stroke({ width: 3, color: 0x5b4a8a });
  g.ellipse(0, 34, 120, 44);
  g.stroke({ width: 2, color: 0xff8a3d, alpha: 0.35 });

  // Sofa (back, seat, cushions, arms)
  g.roundRect(-110, -34, 150, 34, 10);
  g.fill(0x2f6f73);
  g.roundRect(-110, -8, 150, 30, 8);
  g.fill(0x3a8a8f);
  g.roundRect(-104, -4, 68, 22, 6);
  g.fill(0x47a3a8);
  g.roundRect(-30, -4, 64, 22, 6);
  g.fill(0x47a3a8);
  g.roundRect(-122, -24, 18, 48, 8);
  g.fill(0x2a6266);
  g.roundRect(36, -24, 18, 48, 8);
  g.fill(0x2a6266);
  // Throw pillow
  g.roundRect(-92, -26, 26, 20, 6);
  g.fill(0xff8a3d);

  // Coffee table with two mugs
  g.ellipse(96, 46, 38, 18);
  g.fill({ color: 0x000000, alpha: 0.25 });
  g.ellipse(96, 40, 36, 16);
  g.fill(0xd8c3a5);
  g.stroke({ width: 2, color: 0x8b7355 });
  g.circle(84, 36, 5);
  g.fill(0xffffff);
  g.circle(104, 40, 5);
  g.fill(0x8b5cf6);
}

// ============================================================================
// COMPONENT
// ============================================================================

interface OfficeDecorProps {
  plantTexture?: Texture | null;
}

export function OfficeDecor({ plantTexture }: OfficeDecorProps): ReactNode {
  const drawNeonCallback = useCallback((g: Graphics) => drawNeonBacking(g), []);
  const drawLoungeCallback = useCallback((g: Graphics) => drawLounge(g), []);

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

      {/* Lounge corner */}
      <pixiContainer x={LOUNGE_POSITION.x} y={LOUNGE_POSITION.y}>
        <pixiGraphics draw={drawLoungeCallback} />
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

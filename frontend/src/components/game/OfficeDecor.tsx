"use client";

/**
 * OfficeDecor Component
 *
 * Touches for the office scene in the Olymp look: a lime neon
 * "QODIRJON HQ" sign on a dark acrylic plate on the lower wall, and potted
 * plants drawn in the theme's materials (shared/furniture.ts).
 * Purely decorative — nothing here takes part in pathfinding.
 */

import { memo, type ReactNode, useCallback } from "react";
import { Graphics } from "pixi.js";
import { scenePalette, type ScenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";
import { drawPlant, type PlantKind } from "./shared/furniture";

// ============================================================================
// CONSTANTS
// ============================================================================

const NEON_SIGN_POSITION = { x: 450, y: 204 };
const NEON = "#a7f36a";

/** Plants around the room: x, the floor y under the pot, size, kind. */
const PLANT_SPOTS: ReadonlyArray<{
  x: number;
  y: number;
  size: number;
  kind: PlantKind;
}> = [
  { x: 1236, y: 364, size: 1.15, kind: "leafy" },
  { x: 1238, y: 730, size: 1.05, kind: "tall" },
  { x: 1150, y: 1014, size: 1.2, kind: "round" },
];

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

function drawNeonBacking(g: Graphics, p: ScenePalette): void {
  g.clear();
  // Flat shadow on the wall, the dark acrylic plate, its rim and stand-offs
  g.roundRect(-116, -17, 236, 40, 8);
  g.fill(p.shadow);
  g.roundRect(-118, -20, 236, 40, 8);
  g.fill(p.materials.outline);
  g.roundRect(-117, -19, 234, 38, 7);
  g.fill({ color: p.boardHeader, alpha: 0.95 });
  g.rect(-110, -19, 220, 1);
  g.fill({ color: 0xffffff, alpha: 0.12 });
  for (const sx of [-110, 108]) {
    g.rect(sx, -14, 3, 3);
    g.rect(sx, 11, 3, 3);
  }
  g.fill(p.frameLight);
  // The neon's light on the wall round the plate, in hard steps
  for (let i = 1; i <= 3; i++) {
    g.roundRect(-118 - i * 4, -20 - i * 4, 236 + i * 8, 40 + i * 8, 10 + i * 2);
    g.stroke({ width: 4, color: 0xa7f36a, alpha: 0.05 });
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface PottedPlantProps {
  x: number;
  /** The floor under the pot. */
  y: number;
  kind?: PlantKind;
  size?: number;
  seed?: number;
}

/** A potted plant standing on the floor at (x, y). */
function PottedPlantComponent({
  x,
  y,
  kind = "leafy",
  size = 1,
  seed = 1,
}: PottedPlantProps): ReactNode {
  const palette = scenePalette(useTheme());
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      drawPlant(g, palette, kind, size, seed);
    },
    [palette, kind, size, seed],
  );
  return <pixiGraphics draw={draw} x={x} y={y} />;
}

export const PottedPlant = memo(PottedPlantComponent);

export function OfficeDecor(): ReactNode {
  const palette = scenePalette(useTheme());
  const drawNeonCallback = useCallback(
    (g: Graphics) => drawNeonBacking(g, palette),
    [palette],
  );

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
              fontFamily: '"DejaVu Sans", Verdana, Arial, sans-serif',
              fontSize: 40,
              fontWeight: "bold",
              letterSpacing: 8,
              fill: "#eaffd2",
              stroke: { color: NEON, width: 3 },
              dropShadow: {
                color: NEON,
                blur: 10,
                distance: 0,
                alpha: 0.9,
              },
            }}
          />
        </pixiContainer>
      </pixiContainer>

      {/* Plants */}
      {PLANT_SPOTS.map((spot, index) => (
        <PottedPlant
          key={index}
          x={spot.x}
          y={spot.y}
          kind={spot.kind}
          size={spot.size}
          seed={index + 1}
        />
      ))}
    </>
  );
}

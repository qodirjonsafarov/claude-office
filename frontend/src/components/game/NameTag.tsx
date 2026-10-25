"use client";

/**
 * NameTag Component
 *
 * A readable name label for characters: bold sans-serif text on a dark
 * rounded "pill" with a colored edge, drawn at 2x and scaled down so it
 * stays sharp.
 */

import { memo, useCallback, type ReactNode } from "react";
import { Graphics } from "pixi.js";

const FONT_SIZE = 30; // at 2x, so 15px on the canvas
const CHAR_WIDTH = 9.2; // approximate canvas px per character at FONT_SIZE / 2
const PAD_X = 9;
const HEIGHT = 22;

interface NameTagProps {
  name: string;
  /** Accent color for the pill's edge (e.g. the agent's shirt color). */
  accent?: number;
  x?: number;
  y?: number;
}

function NameTagComponent({
  name,
  accent = 0x8b5cf6,
  x = 0,
  y = 0,
}: NameTagProps): ReactNode {
  const width = nameTagWidth(name);

  const drawPill = useCallback(
    (g: Graphics) => {
      g.clear();
      g.roundRect(-width / 2 + 1, -HEIGHT / 2 + 2, width, HEIGHT, HEIGHT / 2);
      g.fill({ color: 0x000000, alpha: 0.35 });
      g.roundRect(-width / 2, -HEIGHT / 2, width, HEIGHT, HEIGHT / 2);
      g.fill({ color: 0x0b1020, alpha: 0.88 });
      g.stroke({ width: 2, color: accent, alpha: 0.95 });
    },
    [width, accent],
  );

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={drawPill} />
      <pixiContainer scale={0.5} y={0.5}>
        <pixiText
          text={name}
          anchor={0.5}
          style={{
            fontFamily: '"DejaVu Sans", Verdana, Arial, sans-serif',
            fontSize: FONT_SIZE,
            fontWeight: "bold",
            fill: "#ffffff",
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export const NameTag = memo(NameTagComponent);

/** Width of the name pill on the canvas (px). */
export function nameTagWidth(name: string): number {
  return Math.max(36, name.length * CHAR_WIDTH + PAD_X * 2);
}

/** Height of the name pill on the canvas (px). */
export const NAME_TAG_HEIGHT = HEIGHT;

/** Parse a "#rrggbb" color into a number for NameTag's accent. */
export function accentFromHex(color: string): number {
  const n = parseInt(color.replace("#", ""), 16);
  return Number.isFinite(n) ? n : 0x8b5cf6;
}

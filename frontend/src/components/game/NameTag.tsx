"use client";

/**
 * NameTag Component
 *
 * A readable name label for characters in the Olymp look: bold sans-serif
 * text on a panel-coloured pill (dark in the dark theme, light paper by
 * day) with a thin edge and a dot in the character's colour, drawn at 2x
 * and scaled down so it stays sharp.
 */

import { memo, useCallback, type ReactNode } from "react";
import { Graphics } from "pixi.js";
import { scenePalette } from "@/systems/scenePalette";
import { useTheme } from "@/systems/themeStore";

const FONT_SIZE = 30; // at 2x, so 15px on the canvas
const CHAR_WIDTH = 9.2; // approximate canvas px per character at FONT_SIZE / 2
const PAD_X = 9;
/** The accent dot before the name. */
const DOT = 5;
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
  const palette = scenePalette(useTheme());

  const drawPill = useCallback(
    (g: Graphics) => {
      g.clear();
      const left = -width / 2;
      const top = -HEIGHT / 2;
      // Flat shadow down-right, the pill, its accent edge and dot
      g.roundRect(left + 1, top + 2, width, HEIGHT, HEIGHT / 2);
      g.fill(palette.shadow);
      g.roundRect(left, top, width, HEIGHT, HEIGHT / 2);
      g.fill({ color: palette.tag, alpha: 0.94 });
      g.stroke({ width: 1.5, color: accent, alpha: 0.9, alignment: 1 });
      g.circle(left + PAD_X - 1, 0, DOT / 2);
      g.fill(accent);
    },
    [width, accent, palette],
  );

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={drawPill} />
      <pixiContainer scale={0.5} x={DOT / 2 + 1} y={0.5}>
        <pixiText
          text={name}
          anchor={0.5}
          style={{
            fontFamily: '"DejaVu Sans", Verdana, Arial, sans-serif',
            fontSize: FONT_SIZE,
            fontWeight: "bold",
            fill: palette.tagText,
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export const NameTag = memo(NameTagComponent);

/** Width of the name pill on the canvas (px). */
export function nameTagWidth(name: string): number {
  return Math.max(36, name.length * CHAR_WIDTH + PAD_X * 2 + DOT + 2);
}

/** Height of the name pill on the canvas (px). */
export const NAME_TAG_HEIGHT = HEIGHT;

/** Parse a "#rrggbb" color into a number for NameTag's accent. */
export function accentFromHex(color: string): number {
  const n = parseInt(color.replace("#", ""), 16);
  return Number.isFinite(n) ? n : 0x8b5cf6;
}

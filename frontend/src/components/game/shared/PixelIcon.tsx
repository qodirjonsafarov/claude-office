"use client";

/**
 * PixelIcon - one 24 px pixelarticons glyph from the scene atlas, drawn at a
 * whole-number scale with nearest-neighbour sampling and tinted.
 */

import { memo, useEffect, useState, type ReactNode } from "react";
import { Assets, Rectangle, Texture } from "pixi.js";
import { ICON_FRAMES, ICON_SIZE } from "@/systems/pixelIcons";

type IconName = keyof typeof ICON_FRAMES;

let atlasPromise: Promise<Texture> | null = null;
let atlas: Texture | null = null;
const frames = new Map<IconName, Texture>();

function loadAtlas(): Promise<Texture> {
  atlasPromise ??= Assets.load<Texture>("/sprites/icons/pixel-icons.png").then(
    (texture) => {
      texture.source.scaleMode = "nearest";
      texture.source.autoGenerateMipmaps = false;
      atlas = texture;
      return texture;
    },
  );
  return atlasPromise;
}

function frameOf(sheet: Texture, name: IconName): Texture {
  let texture = frames.get(name);
  if (!texture) {
    texture = new Texture({
      source: sheet.source,
      frame: new Rectangle(
        ICON_FRAMES[name] * ICON_SIZE,
        0,
        ICON_SIZE,
        ICON_SIZE,
      ),
    });
    frames.set(name, texture);
  }
  return texture;
}

interface PixelIconProps {
  name: IconName;
  tint: number;
  /** Whole number: 1 = 24 px. Halves are allowed for small badges (12 px). */
  scale?: number;
  x?: number;
  y?: number;
  alpha?: number;
}

function PixelIconComponent({
  name,
  tint,
  scale = 1,
  x = 0,
  y = 0,
  alpha = 1,
}: PixelIconProps): ReactNode {
  const [sheet, setSheet] = useState<Texture | null>(atlas);
  useEffect(() => {
    if (sheet) return;
    let alive = true;
    loadAtlas().then((t) => alive && setSheet(t));
    return () => {
      alive = false;
    };
  }, [sheet]);
  if (!sheet) return null;
  return (
    <pixiSprite
      texture={frameOf(sheet, name)}
      anchor={0.5}
      x={Math.round(x)}
      y={Math.round(y)}
      scale={scale}
      tint={tint}
      alpha={alpha}
    />
  );
}

export const PixelIcon = memo(PixelIconComponent);
export type { IconName };

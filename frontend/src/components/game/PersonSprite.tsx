"use client";

/**
 * PersonSprite Component
 *
 * Draws an office worker from an LPC (Liberated Pixel Cup) character sheet.
 * Sheets live in /sprites/people/<key>.png and hold three animations side by
 * side: walk (9 frames), sit (3 frames) and idle (2 frames), each with four
 * rows (up, left, down, right) of 64x64 frames. See /sprites/people/CREDITS.txt.
 */

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { useTick } from "@pixi/react";
import { Assets, Rectangle, Texture } from "pixi.js";
import type { Position } from "@/types";

// ============================================================================
// SHEET LAYOUT
// ============================================================================

const FRAME = 64;
const WALK_X = 0;
const WALK_FRAMES = 8; // frames 1..8 (frame 0 is the standing pose)
const SIT_X = 576;
const SIT_CHAIR_FRAME = 2; // third sit frame: sitting on a chair
const IDLE_X = 768;
const IDLE_FRAMES = 2;

export type PersonDirection = "up" | "left" | "down" | "right";
export type PersonMode = "walk" | "idle" | "sit";

const ROW: Record<PersonDirection, number> = {
  up: 0,
  left: 1,
  down: 2,
  right: 3,
};

/** Agent colors from the backend mapped to the sheet that wears that shirt. */
const COLOR_TO_SHEET: Record<string, string> = {
  "#3b82f6": "blue",
  "#22c55e": "green",
  "#a855f7": "purple",
  "#f97316": "orange",
  "#ec4899": "pink",
  "#06b6d4": "teal",
  "#14b8a6": "teal",
  "#eab308": "yellow",
  "#ef4444": "red",
};
const FALLBACK_SHEETS = [
  "blue",
  "green",
  "purple",
  "orange",
  "pink",
  "teal",
  "yellow",
  "red",
];

export function sheetForColor(color: string, id: string): string {
  const known = COLOR_TO_SHEET[color.toLowerCase()];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return FALLBACK_SHEETS[Math.abs(hash) % FALLBACK_SHEETS.length];
}

// ============================================================================
// TEXTURE CACHE
// ============================================================================

const sheetPromises = new Map<string, Promise<Texture>>();
const frameCache = new Map<string, Texture>();

function loadSheet(key: string): Promise<Texture> {
  let promise = sheetPromises.get(key);
  if (!promise) {
    promise = Assets.load<Texture>(`/sprites/people/${key}.png`).then(
      (texture) => {
        // Crisp pixel art: no smoothing between pixels
        texture.source.scaleMode = "nearest";
        return texture;
      },
    );
    sheetPromises.set(key, promise);
  }
  return promise;
}

function frameTexture(sheet: Texture, key: string, x: number, y: number) {
  const cacheKey = `${key}:${x}:${y}`;
  let texture = frameCache.get(cacheKey);
  if (!texture) {
    texture = new Texture({
      source: sheet.source,
      frame: new Rectangle(x, y, FRAME, FRAME),
    });
    frameCache.set(cacheKey, texture);
  }
  return texture;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface PersonSpriteProps {
  sheet: string;
  mode: PersonMode;
  direction: PersonDirection;
  /** Feet position offset from the container origin. */
  feetY?: number;
  scale?: number;
}

function PersonSpriteComponent({
  sheet,
  mode,
  direction,
  feetY = 22,
  scale = 1.55,
}: PersonSpriteProps): ReactNode {
  const [texture, setTexture] = useState<Texture | null>(null);
  const [frame, setFrame] = useState(0);
  const timeRef = useRef(0);

  useEffect(() => {
    let alive = true;
    loadSheet(sheet).then((t) => {
      if (alive) setTexture(t);
    });
    return () => {
      alive = false;
    };
  }, [sheet]);

  useTick((ticker) => {
    if (mode === "sit") return;
    timeRef.current += ticker.deltaMS;
    const step = mode === "walk" ? 90 : 600;
    const count = mode === "walk" ? WALK_FRAMES : IDLE_FRAMES;
    const next = Math.floor(timeRef.current / step) % count;
    if (next !== frame) setFrame(next);
  });

  if (!texture) return null;

  const row = ROW[direction] * FRAME;
  let x: number;
  if (mode === "walk") x = WALK_X + (1 + (frame % WALK_FRAMES)) * FRAME;
  else if (mode === "sit") x = SIT_X + SIT_CHAIR_FRAME * FRAME;
  else x = IDLE_X + (frame % IDLE_FRAMES) * FRAME;

  return (
    <pixiSprite
      texture={frameTexture(texture, sheet, x, row)}
      anchor={{ x: 0.5, y: 62 / 64 }}
      y={feetY}
      scale={scale}
    />
  );
}

export const PersonSprite = memo(PersonSpriteComponent);

// ============================================================================
// MOVEMENT HELPER
// ============================================================================

/**
 * Derive walk/idle and facing direction from how a position changes between
 * renders.
 */
export function usePersonMotion(position: Position): {
  moving: boolean;
  direction: PersonDirection;
} {
  const prev = useRef(position);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [moving, setMoving] = useState(false);
  const [direction, setDirection] = useState<PersonDirection>("down");

  useEffect(() => {
    const dx = position.x - prev.current.x;
    const dy = position.y - prev.current.y;
    prev.current = position;
    if (Math.hypot(dx, dy) <= 0.3) return;

    setMoving(true);
    setDirection(
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up",
    );
    // Stop walking shortly after the position stops changing
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => setMoving(false), 180);
  }, [position]);

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
    },
    [],
  );

  return { moving, direction };
}

"use client";

/**
 * PersonSprite Component
 *
 * Draws an office worker from an LPC (Liberated Pixel Cup) character sheet.
 * Sheets live in /sprites/people/<key>.png and hold the animations side by
 * side, each with four rows (up, left, down, right) of 64x64 frames: walk,
 * sit, idle, typing (generated), and the LPC spellcast / thrust animations
 * used for gestures, plus generated blink frames. The layout is documented
 * in scripts/compose_lpc_people.py. See /sprites/people/CREDITS.txt.
 *
 * Everything moves with the sprite's own pixels: walk frames follow the
 * distance walked (no sliding feet), idle breathes and blinks, gestures play
 * LPC frames. The only extra drawing is a soft shadow on the floor.
 */

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { useSceneTick } from "./shared/useSceneTick";
import { Assets, Graphics, Rectangle, Texture } from "pixi.js";
import type { Position } from "@/types";
import {
  TYPING_LINGER_MS,
  TYPING_STEP_MS,
  isTypingVisible,
  typingPose,
} from "@/systems/typingPose";
import { facingFromDelta, type Facing } from "@/systems/personMotion";
import type { Gesture } from "@/systems/personPoses";
import { useReducedMotion } from "@/systems/reducedMotion";
import {
  FRAME,
  sheetCell,
  type CellInput,
  type PersonMode,
  type SheetCell,
} from "@/systems/personFrames";

export type PersonDirection = Facing;
export type { PersonMode };

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
/** Sheets already loaded, so a newly mounted sprite draws on its first frame. */
const loadedSheets = new Map<string, Texture>();
const frameCache = new Map<string, Texture>();

function loadSheet(key: string): Promise<Texture> {
  let promise = sheetPromises.get(key);
  if (!promise) {
    promise = Assets.load<Texture>(`/sprites/people/${key}.png`).then(
      (texture) => {
        // Crisp pixel art: no smoothing between pixels
        texture.source.scaleMode = "nearest";
        loadedSheets.set(key, texture);
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
  /** Seated and typing: tap keys with the sprite's own hands. */
  typing?: boolean;
  /** Distance walked so far (px); drives the walk frames in "walk" mode. */
  walkDistance?: number;
  /** Gesture to play in "gesture" mode. */
  gesture?: Gesture;
  /** Per-person seed for blinking / glancing; omit to disable both. */
  seed?: number;
  /** Look to the side now and then while standing or sitting idle. */
  glance?: boolean;
  /** Soft floor shadow under the feet (off for seated people). */
  shadow?: boolean;
  /** Seated and reading (Read / Grep): head bowed instead of typing. */
  reading?: boolean;
}

/** Shadow under the feet, in canvas px (before the sprite scale). */
function drawShadow(g: Graphics): void {
  g.clear();
  g.ellipse(0, 0, 13, 4.5);
  g.fill({ color: 0x000000, alpha: 0.22 });
}

function PersonSpriteComponent({
  sheet,
  mode,
  direction,
  feetY = 22,
  scale = 1.55,
  typing = false,
  walkDistance,
  gesture,
  seed,
  glance = false,
  shadow = mode !== "sit" && mode !== "sleep",
  reading = false,
}: PersonSpriteProps): ReactNode {
  const [texture, setTexture] = useState<Texture | null>(
    () => loadedSheets.get(sheet) ?? null,
  );
  const typingElapsed = useActivityClock(typing && mode === "sit");
  const pose = typingElapsed === null ? null : typingPose(typingElapsed);
  // No typing lean under reduced motion
  const reduced = useReducedMotion();
  const bodyBob = pose && !reduced ? pose.bodyBob : 0;

  const input: CellInput = {
    mode,
    direction,
    walkDistance,
    gesture,
    seed,
    glance,
    pressed: pose?.pressed ?? null,
    reading,
  };

  // Life clock (breathing, blinking, glancing) and gesture clock
  const lifeRef = useRef(0);
  const gestureRef = useRef<{ key: string; elapsed: number }>({
    key: mode === "gesture" ? `${gesture}` : "",
    elapsed: 0,
  });
  // Start on the real pose, so a fresh sprite never flashes a wrong frame
  const [cell, setCell] = useState<SheetCell>(() => sheetCell(input, 0, 0));

  useEffect(() => {
    let alive = true;
    loadSheet(sheet).then((t) => {
      if (alive) setTexture(t);
    });
    return () => {
      alive = false;
    };
  }, [sheet]);

  useSceneTick((ticker) => {
    lifeRef.current += ticker.deltaMS;
    const key = mode === "gesture" ? `${gesture}` : "";
    if (gestureRef.current.key !== key) {
      gestureRef.current = { key, elapsed: 0 };
    } else {
      gestureRef.current.elapsed += ticker.deltaMS;
    }
    const next = sheetCell(input, lifeRef.current, gestureRef.current.elapsed);
    if (next.x !== cell.x || next.row !== cell.row) setCell(next);
  }, true);

  if (!texture) return null;

  return (
    <>
      {shadow && (
        <pixiGraphics draw={drawShadow} y={feetY} scale={scale / 1.55} />
      )}
      <pixiSprite
        texture={frameTexture(texture, sheet, cell.x, cell.row * FRAME)}
        anchor={{ x: 0.5, y: 62 / 64 }}
        y={feetY + bodyBob}
        scale={scale}
      />
    </>
  );
}

export const PersonSprite = memo(PersonSpriteComponent);

// ============================================================================
// TYPING
// ============================================================================

/**
 * Milliseconds since an activity (typing) started, updated once per
 * {@link TYPING_STEP_MS}, or null when inactive. Stays active for
 * {@link TYPING_LINGER_MS} after `active` turns off so short gaps between
 * tool calls don't drop the pose.
 */
export function useActivityClock(active: boolean): number | null {
  const elapsedRef = useRef(0);
  const sinceActiveRef = useRef(TYPING_LINGER_MS);
  const [elapsed, setElapsed] = useState<number | null>(null);

  useSceneTick((ticker) => {
    sinceActiveRef.current = active
      ? 0
      : sinceActiveRef.current + ticker.deltaMS;
    if (!isTypingVisible(active, sinceActiveRef.current)) {
      elapsedRef.current = 0;
      if (elapsed !== null) setElapsed(null);
      return;
    }
    elapsedRef.current += ticker.deltaMS;
    const stepped =
      Math.floor(elapsedRef.current / TYPING_STEP_MS) * TYPING_STEP_MS;
    if (stepped !== elapsed) setElapsed(stepped);
  }, true);

  return elapsed;
}

// ============================================================================
// MOVEMENT HELPER
// ============================================================================

/** Moves shorter than this between renders are ignored (px). */
const MOTION_EPSILON_PX = 0.05;
/** Walking stops showing this long after the position stops changing. */
const STOP_DELAY_MS = 160;

/**
 * Derive walking, facing and the distance walked from how a position changes
 * between renders. Facing has hysteresis (see facingFromDelta) so curved
 * paths don't flicker between rows; the distance drives the walk frames so
 * the feet keep pace with the ground speed.
 */
export function usePersonMotion(position: Position): {
  moving: boolean;
  direction: PersonDirection;
  distance: number;
} {
  const prev = useRef(position);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [moving, setMoving] = useState(false);
  const [direction, setDirection] = useState<PersonDirection>("down");
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const dx = position.x - prev.current.x;
    const dy = position.y - prev.current.y;
    prev.current = position;
    const step = Math.hypot(dx, dy);
    if (step <= MOTION_EPSILON_PX) return;
    // A teleport (snap into the elevator, state sync) is not a walk
    if (step > 80) return;

    setMoving(true);
    setDistance((d) => d + step);
    setDirection((current) => facingFromDelta(dx, dy, current));
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => setMoving(false), STOP_DELAY_MS);
  }, [position]);

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
    },
    [],
  );

  return { moving, direction, distance };
}

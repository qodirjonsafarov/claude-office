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

import {
  memo,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSceneTick } from "./shared/useSceneTick";
import {
  Assets,
  Graphics,
  Rectangle,
  Texture,
  type RenderLayer,
  type Sprite,
} from "pixi.js";
import { HandsLayerContext } from "./shared/handsLayer";
import { HANDS_CROP, handsCropPlacement } from "@/systems/handsOnDesk";
import { extractHands } from "@/systems/handsMask";
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
  ROW,
  SHEET_X,
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

/** The seated frames facing the viewer whose hands rest on the desk. */
const SEATED_CELLS = [
  SHEET_X.sitChair,
  SHEET_X.typeLeft,
  SHEET_X.typeRight,
  SHEET_X.blinkSit,
  SHEET_X.read,
].map((x) => ({ x, y: ROW.down * FRAME }));

const handsPromises = new Map<string, Promise<Texture | null>>();
const loadedHands = new Map<string, Texture | null>();

/**
 * A copy of the sheet with only the hands of the seated frames
 * (systems/handsMask.ts), made once per look. Null without a 2D canvas.
 */
function loadHandsSheet(key: string): Promise<Texture | null> {
  let promise = handsPromises.get(key);
  if (!promise) {
    promise = loadSheet(key).then((sheet) => {
      let hands: Texture | null = null;
      try {
        const image = sheet.source.resource as CanvasImageSource;
        const { width, height } = sheet.source;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(image, 0, 0);
          const img = ctx.getImageData(0, 0, width, height);
          const only = extractHands(
            { data: img.data, width, height },
            SEATED_CELLS,
          );
          img.data.set(only);
          ctx.putImageData(img, 0, 0);
          hands = Texture.from(canvas);
          hands.source.scaleMode = "nearest";
        }
      } catch {
        hands = null; // the hands stay under the desk, as before
      }
      loadedHands.set(key, hands);
      return hands;
    });
    handsPromises.set(key, promise);
  }
  return promise;
}

function frameTexture(
  sheet: Texture,
  key: string,
  x: number,
  y: number,
  w = FRAME,
  h = FRAME,
) {
  const cacheKey = `${key}:${x}:${y}:${w}:${h}`;
  let texture = frameCache.get(cacheKey);
  if (!texture) {
    texture = new Texture({
      source: sheet.source,
      frame: new Rectangle(x, y, w, h),
    });
    frameCache.set(cacheKey, texture);
  }
  return texture;
}

/**
 * The hands of the current frame, drawn again in the layer above the desk
 * (systems/handsOnDesk.ts): they rest on the keyboard instead of typing
 * under the desk top. Positioned by this sprite's own transform.
 */
function HandsOnDesk({
  layer,
  texture,
  x,
  y,
  scale,
}: {
  layer: RenderLayer;
  texture: Texture;
  x: number;
  y: number;
  scale: number;
}): ReactNode {
  const [sprite, setSprite] = useState<Sprite | null>(null);
  useEffect(() => {
    if (!sprite) return;
    layer.attach(sprite);
    return () => {
      layer.detach(sprite);
    };
  }, [layer, sprite]);
  return (
    <pixiSprite ref={setSprite} texture={texture} x={x} y={y} scale={scale} />
  );
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
  /** Seated at a desk: the hands rest on its keyboard (above the desk). */
  handsOnDesk?: boolean;
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
  handsOnDesk = false,
}: PersonSpriteProps): ReactNode {
  const handsLayer = useContext(HandsLayerContext);
  const [handsSheet, setHandsSheet] = useState<Texture | null>(
    () => loadedHands.get(sheet) ?? null,
  );
  useEffect(() => {
    if (!handsOnDesk) return;
    let alive = true;
    loadHandsSheet(sheet).then((t) => {
      if (alive) setHandsSheet(t);
    });
    return () => {
      alive = false;
    };
  }, [sheet, handsOnDesk]);
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
      {handsOnDesk && handsLayer && handsSheet && mode === "sit" && (
        <HandsOnDesk
          layer={handsLayer}
          texture={frameTexture(
            handsSheet,
            `${sheet}-hands`,
            cell.x + HANDS_CROP.x,
            cell.row * FRAME + HANDS_CROP.y,
            HANDS_CROP.w,
            HANDS_CROP.h,
          )}
          x={handsCropPlacement(feetY, scale).x}
          y={handsCropPlacement(feetY, scale).y + bodyBob}
          scale={scale}
        />
      )}
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

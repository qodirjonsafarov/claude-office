"use client";

/**
 * DayNightLayer - the office's day/night grading.
 *
 * One rectangle in "multiply" blend tints the whole scene by the local time
 * (clear by day, a deep blue at most 0.32 at night, smooth dusk and dawn with
 * the same seasonal hours as the city window), plus soft warm lamp pools in
 * "add" blend over the desks at night. No Pixi filters. The time can be fixed
 * for screenshots with "?time=22:30" (systems/sceneClock.ts).
 */

import { memo, useCallback, type ReactNode } from "react";
import type { Graphics } from "pixi.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/canvas";
import { NIGHT_TINT, nightAlpha, NIGHT_ALPHA } from "@/systems/dayNight";
import { useSceneHours } from "@/systems/sceneClock";
import { getSeasonalTimes } from "./city/timeUtils";

/** Warm light pools: desks (monitors + lamps), the boss desk, the coffee corner. */
const POOLS: ReadonlyArray<{ x: number; y: number; r: number }> = [
  ...[256, 512, 768, 1024].flatMap((x) => [
    { x: x - 20, y: 450, r: 70 },
    { x: x - 20, y: 642, r: 70 },
  ]),
  { x: 640, y: 940, r: 95 },
  { x: 1045, y: 270, r: 60 },
  { x: 86, y: 280, r: 55 },
];

function drawPools(g: Graphics): void {
  g.clear();
  for (const p of POOLS) {
    // Stacked ellipses: a soft pool without a blur filter
    for (let i = 0; i < 4; i++) {
      const k = 1 - i * 0.22;
      g.ellipse(p.x, p.y, p.r * k, p.r * 0.55 * k);
      g.fill({ color: 0xffc46b, alpha: 0.045 });
    }
  }
}

interface DayNightLayerProps {
  /** The canvas around the room, in room coordinates (default: the room). */
  extent?: { left: number; top: number; right: number; bottom: number };
}

const ROOM = { left: 0, top: 0, right: CANVAS_WIDTH, bottom: CANVAS_HEIGHT };

function DayNightLayerComponent({
  extent = ROOM,
}: DayNightLayerProps): ReactNode {
  const { left, top, right, bottom } = extent;
  const hours = useSceneHours();
  const alpha = nightAlpha(hours, getSeasonalTimes(new Date()));
  const glow = alpha / NIGHT_ALPHA;

  const drawTint = useCallback(
    (g: Graphics) => {
      g.clear();
      g.rect(left, top, right - left, bottom - top);
      g.fill(NIGHT_TINT);
    },
    [left, top, right, bottom],
  );

  if (alpha <= 0) return null;
  return (
    <>
      <pixiGraphics draw={drawTint} blendMode="multiply" alpha={alpha} />
      <pixiGraphics draw={drawPools} blendMode="add" alpha={glow} />
    </>
  );
}

export const DayNightLayer = memo(DayNightLayerComponent);

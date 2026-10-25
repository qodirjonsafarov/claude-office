"use client";

/**
 * Character effects in the office scene: things around a person, never on
 * the body (the body only moves with its own sprite pixels).
 *
 * - NeedsYouRing: amber ring on the floor, pulsing slower than 1 Hz.
 * - StatusMark: small badge next to the head: "!" (needs you), red x
 *   (error), "zzz" (sleeping), check (done).
 * - Celebration: a short confetti burst (<= 16 particles, 800 ms).
 * - useSince / useClock: timers for these.
 *
 * With reduced motion the ring and zzz stay still and there is no confetti.
 */

import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import type { Graphics } from "pixi.js";
import {
  CELEBRATION_MS,
  celebration,
  pulse,
  quantize,
  type Particle,
} from "@/systems/sceneMotion";
import { useSceneTick, useTickValue } from "./shared/useSceneTick";
import { useReducedMotion } from "@/systems/reducedMotion";
import { PixelIcon } from "./shared/PixelIcon";
import {
  SCENE_AMBER,
  SCENE_INK,
  SCENE_LIME,
  SCENE_RED,
} from "./shared/sceneColors";

// ============================================================================
// TIMERS
// ============================================================================

/** Wall clock in ms, refreshed every `everyMs` (for minute-scale moods). */
export function useClock(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/**
 * Ms since `key` last changed (null key = not running), ticking until
 * `limit`. A changed key restarts it.
 */
export function useSince(key: string | number | null, limit: number): number {
  const [state, setState] = useState({ key, ms: limit });
  if (state.key !== key) setState({ key, ms: key === null ? limit : 0 });
  const running = key !== null && state.key === key && state.ms < limit;
  // Attached only while the short animation runs (stable callback)
  useSceneTick((ticker) => {
    setState((s) => ({
      key: s.key,
      ms: Math.min(limit, s.ms + ticker.deltaMS),
    }));
  }, running);
  return state.key === key ? state.ms : key === null ? limit : 0;
}

// ============================================================================
// NEEDS YOU
// ============================================================================

interface RingProps {
  y?: number;
  width?: number;
}

function NeedsYouRingComponent({ y = 22, width = 26 }: RingProps): ReactNode {
  const reduced = useReducedMotion();
  // Breathe between 45% and 95% opacity (20 steps: few re-renders);
  // steady under reduced motion
  const breath = useTickValue(!reduced, (ms) => quantize(pulse(ms), 0.05));
  const alpha = reduced ? 0.8 : 0.45 + 0.5 * breath;
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      g.ellipse(0, 0, width, width * 0.38);
      g.stroke({ width: 3, color: SCENE_AMBER, alpha: 0.9 });
      g.ellipse(0, 0, width + 5, (width + 5) * 0.38);
      g.stroke({ width: 2, color: SCENE_AMBER, alpha: 0.35 });
    },
    [width],
  );
  return <pixiGraphics draw={draw} y={y} alpha={alpha} />;
}

export const NeedsYouRing = memo(NeedsYouRingComponent);

// ============================================================================
// STATUS MARK
// ============================================================================

export type StatusKind = "needs_you" | "error" | "sleeping" | "done";

interface StatusMarkProps {
  kind: StatusKind;
  x?: number;
  y?: number;
}

function drawBadge(g: Graphics, fill: number, ring: number): void {
  g.clear();
  g.circle(1, 1, 13);
  g.fill({ color: 0x000000, alpha: 0.25 });
  g.circle(0, 0, 13);
  g.fill(fill);
  g.stroke({ width: 2, color: ring });
  // Tail towards the head
  g.moveTo(-9, 8);
  g.lineTo(-15, 15);
  g.lineTo(-4, 11);
  g.closePath();
  g.fill(fill);
}

/** One pixel "z" (5 x 5 px cells of `px` size). */
function drawZ(g: Graphics, x: number, y: number, px: number, color: number) {
  for (let i = 0; i < 5; i++) {
    g.rect(x + i * px, y, px, px); // top
    g.rect(x + i * px, y + 4 * px, px, px); // bottom
    g.rect(x + (4 - i) * px, y + i * px, px, px); // diagonal
  }
  g.fill(color);
}

function StatusMarkComponent({
  kind,
  x = 24,
  y = -48,
}: StatusMarkProps): ReactNode {
  const reduced = useReducedMotion();
  // Whole pixels only: the z's redraw just when they move by a pixel
  const drift = useTickValue(kind === "sleeping" && !reduced, (ms) =>
    Math.round(3 * pulse(ms / 2.5)),
  );

  const drawZzz = useCallback(
    (g: Graphics) => {
      g.clear();
      // Three z's growing up and to the right; they drift 3 px over 3 s
      const dy = reduced ? 0 : drift;
      drawZ(g, 0, 8 - dy, 1.5, 0xe4ebe6);
      drawZ(g, 9, 0 - dy, 2, 0xe4ebe6);
      drawZ(g, 21, -10 - dy, 2.5, 0xe4ebe6);
    },
    [drift, reduced],
  );
  const drawAmber = useCallback(
    (g: Graphics) => drawBadge(g, SCENE_AMBER, 0x5a4310),
    [],
  );
  const drawRed = useCallback(
    (g: Graphics) => drawBadge(g, 0xffffff, SCENE_RED),
    [],
  );
  const drawDone = useCallback(
    (g: Graphics) => drawBadge(g, SCENE_LIME, 0x2f5a12),
    [],
  );

  if (kind === "sleeping") {
    return <pixiGraphics draw={drawZzz} x={x - 6} y={y} alpha={0.9} />;
  }
  return (
    <pixiContainer x={x} y={y}>
      {kind === "needs_you" && (
        <>
          <pixiGraphics draw={drawAmber} />
          <pixiText
            text="!"
            anchor={0.5}
            y={0.5}
            style={{
              fontFamily: '"DejaVu Sans", Verdana, Arial, sans-serif',
              fontSize: 19,
              fontWeight: "bold",
              fill: SCENE_INK,
            }}
          />
        </>
      )}
      {kind === "error" && (
        <>
          <pixiGraphics draw={drawRed} />
          <PixelIcon name="error" tint={SCENE_RED} />
        </>
      )}
      {kind === "done" && (
        <>
          <pixiGraphics draw={drawDone} />
          <PixelIcon name="done" tint={0x1d3a0a} />
        </>
      )}
    </pixiContainer>
  );
}

export const StatusMark = memo(StatusMarkComponent);

// ============================================================================
// CELEBRATION
// ============================================================================

const CONFETTI = [SCENE_LIME, 0xffffff, SCENE_AMBER, 0x74c7f5];

interface CelebrationProps {
  /** Change it to start a new burst. */
  seed: number;
  y?: number;
}

function CelebrationComponent({ seed, y = -40 }: CelebrationProps): ReactNode {
  const reduced = useReducedMotion();
  const ms = useSince(seed, CELEBRATION_MS);
  const [particles] = useState<Particle[]>(() => celebration(seed));
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      for (const p of particles) {
        const s = p.at(ms);
        if (s.alpha <= 0) continue;
        g.rect(s.x - 1.5, s.y - 1.5, 3, 3);
        g.fill({ color: CONFETTI[p.color], alpha: s.alpha });
      }
    },
    [ms, particles],
  );
  if (reduced || ms >= CELEBRATION_MS) return null;
  return <pixiGraphics draw={draw} y={y} />;
}

export const Celebration = memo(CelebrationComponent);

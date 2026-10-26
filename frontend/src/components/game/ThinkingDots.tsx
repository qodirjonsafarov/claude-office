"use client";

/**
 * ThinkingDots Component
 *
 * A small thought puff with three dots next to a seated worker's head while
 * the agent thinks (sits at the desk without using tools). It's an effect
 * floating in the air, not part of the body. Shows up after a short pause so
 * the gaps between quick tool calls don't make it blink on and off.
 */

import { memo, useCallback, useRef, useState, type ReactNode } from "react";
import { useSceneTick } from "./shared/useSceneTick";
import { Graphics } from "pixi.js";
import { thinkingDots } from "@/systems/personPoses";

interface ThinkingDotsProps {
  active: boolean;
  x?: number;
  y?: number;
}

function ThinkingDotsComponent({
  active,
  x = 24,
  y = -46,
}: ThinkingDotsProps): ReactNode {
  const idleRef = useRef(0);
  const [state, setState] = useState(() => thinkingDots(0));

  useSceneTick((ticker) => {
    idleRef.current = active ? idleRef.current + ticker.deltaMS : 0;
    const next = thinkingDots(idleRef.current);
    if (next.visible !== state.visible || next.lit !== state.lit) {
      setState(next);
    }
  }, true);

  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      // Puff with two small trailing circles towards the head
      g.circle(-11, 11, 2);
      g.circle(-6, 7, 3);
      g.fill({ color: 0xf4f7f2, alpha: 0.9 });
      g.roundRect(-4, -8, 30, 14, 7);
      g.fill({ color: 0xf4f7f2, alpha: 0.94 });
      g.stroke({ width: 1.5, color: 0x14201a, alpha: 0.5 });
      for (let i = 0; i < 3; i++) {
        g.circle(4 + i * 7, -1, 2.2);
        g.fill({ color: 0x14201a, alpha: i === state.lit ? 0.95 : 0.3 });
      }
    },
    [state.lit],
  );

  if (!state.visible) return null;
  return <pixiGraphics draw={draw} x={x} y={y} />;
}

export const ThinkingDots = memo(ThinkingDotsComponent);

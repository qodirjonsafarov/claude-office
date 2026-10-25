"use client";

/**
 * AgentProgressBadge - a small bar over a character's head: 32x4 px in the
 * agent's colour with a "3/5" label, from the backend's optional todo-list
 * `progress`. When the list is done it turns green, pulses once and hides.
 * Draws nothing without progress data.
 *
 * Mount next to the NameTag (e.g. y={-88} in AgentSprite, y={-76} in
 * BossSprite): <AgentProgressBadge progress={progress} color={color} y={-88} />
 */

import { memo, useCallback, useState, type ReactNode } from "react";
import { useTick } from "@pixi/react";
import type { Graphics, TextStyle } from "pixi.js";
import { PIXI_COLORS } from "@/styles/pixiColors";
import { badgeLook, completionPulse } from "@/utils/progressBadge";

const BAR_W = 32;
const BAR_H = 4;

// Two fixed label styles, made once: an inline object would be a new style
// (and a text re-layout) on every frame the badge pulses.
const LABEL_FONT = {
  fontFamily: '"DejaVu Sans", Verdana, Arial, sans-serif',
  fontSize: 20,
  fontWeight: "bold",
} as const;
const LABEL_STYLE: Partial<TextStyle> = {
  ...LABEL_FONT,
  fill: PIXI_COLORS.ink,
};
const LABEL_STYLE_DONE: Partial<TextStyle> = {
  ...LABEL_FONT,
  fill: PIXI_COLORS.accent,
};

interface AgentProgressBadgeProps {
  progress: { done: number; total: number } | null;
  /** The agent's colour as a number (see accentFromHex in NameTag). */
  color: number;
  x?: number;
  y?: number;
}

function AgentProgressBadgeComponent({
  progress,
  color,
  x = 0,
  y = 0,
}: AgentProgressBadgeProps): ReactNode {
  const look = badgeLook(progress);
  const complete = look?.complete ?? false;
  // Time since the list was completed, keyed by its label so a new list (or
  // a re-opened one) restarts the badge. Advanced by the Pixi ticker.
  const [finish, setFinish] = useState<{ label: string; ms: number } | null>(
    null,
  );
  if (complete && look && finish?.label !== look.label) {
    setFinish({ label: look.label, ms: 0 });
  }

  const pulse = complete && finish ? completionPulse(finish.ms) : null;
  const animating = pulse !== null && !pulse.hidden;

  // Animate only while the one-shot pulse runs.
  useTick((ticker) => {
    if (!animating) return;
    setFinish((f) => (f ? { ...f, ms: f.ms + ticker.deltaMS } : f));
  });

  const fill = complete ? PIXI_COLORS.accent : color;
  const fraction = look?.fraction ?? 0;
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      g.roundRect(-BAR_W / 2 - 1, -BAR_H / 2 - 1, BAR_W + 2, BAR_H + 2, 3);
      g.fill({ color: PIXI_COLORS.panel, alpha: 0.9 });
      g.roundRect(-BAR_W / 2, -BAR_H / 2, BAR_W, BAR_H, 2);
      g.fill({ color: PIXI_COLORS.panel3 });
      if (fraction > 0) {
        g.roundRect(-BAR_W / 2, -BAR_H / 2, BAR_W * fraction, BAR_H, 2);
        g.fill({ color: fill });
      }
    },
    [fraction, fill],
  );

  if (!look || pulse?.hidden) return null;

  return (
    <pixiContainer
      x={x}
      y={y}
      scale={pulse?.scale ?? 1}
      alpha={pulse?.alpha ?? 1}
    >
      <pixiGraphics draw={draw} />
      <pixiContainer x={BAR_W / 2 + 4} scale={0.5}>
        <pixiText
          text={look.label}
          anchor={{ x: 0, y: 0.5 }}
          style={complete ? LABEL_STYLE_DONE : LABEL_STYLE}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export const AgentProgressBadge = memo(AgentProgressBadgeComponent);

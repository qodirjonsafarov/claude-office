"use client";

/**
 * SceneBubble - the speech / thought bubble of a character (boss or agent).
 *
 * The tool icon is a pixelarticons glyph (read, edit, terminal, web, task,
 * error, done) on the round badge; unknown icons fall back to the emoji.
 * A new bubble pops in (0.6 -> 1.05 -> 1.0, 220 ms, back-out); with reduced
 * motion it fades in over 120 ms instead.
 */

import { memo, useMemo, useState, type ReactNode } from "react";
import { useSceneTick } from "./useSceneTick";
import type { TextStyle } from "pixi.js";
import type { BubbleContent } from "@/types";
import { truncateBubbleText } from "@/utils/bubbleText";
import { bubbleSize } from "@/systems/bubbleLayout";
import { toolKindFromIcon } from "@/systems/sceneSignals";
import {
  BUBBLE_POP_MS,
  FADE_MS,
  bubblePopScale,
  fadeIn,
} from "@/systems/sceneMotion";
import { useReducedMotion } from "@/systems/reducedMotion";
import { ICON_MAP } from "./iconMap";
import { drawBubble, drawIconBadge } from "./drawBubble";
import { PixelIcon } from "./PixelIcon";
import { SCENE_INK, SCENE_RED } from "./sceneColors";

interface SceneBubbleProps {
  content: BubbleContent;
  yOffset: number;
}

const BADGE_RADIUS = 16;

/** Time since the bubble's text changed, until the entrance is over. */
export function useEntrance(key: string, duration: number): number {
  const [state, setState] = useState({ key, ms: 0 });
  if (state.key !== key) setState({ key, ms: 0 });
  const running = state.key === key && state.ms < duration;
  useSceneTick((ticker) => {
    setState((s) => ({ key: s.key, ms: s.ms + ticker.deltaMS }));
  }, running);
  return state.key === key ? state.ms : 0;
}

function SceneBubbleComponent({
  content,
  yOffset,
}: SceneBubbleProps): ReactNode {
  const { type = "thought", icon } = content;
  const text = truncateBubbleText(content.text);
  const kind = toolKindFromIcon(icon);
  const iconEmoji = !kind && icon ? (ICON_MAP[icon] ?? icon) : undefined;
  // Red only for errors; a dark lime for "done" (lime text on white is too light)
  const iconTint =
    kind === "error" ? SCENE_RED : kind === "done" ? 0x4f8a1f : SCENE_INK;

  const reduced = useReducedMotion();
  const ms = useEntrance(
    text + (icon ?? ""),
    reduced ? FADE_MS : BUBBLE_POP_MS,
  );
  const scale = reduced ? 1 : bubblePopScale(ms);
  const alpha = reduced ? fadeIn(ms) : 1;

  // Same size the office layout stacks with (systems/bubbleLayout.ts)
  const { w: bWidth, h: bHeight } = bubbleSize(text);

  const textStyle = useMemo<Partial<TextStyle>>(
    () => ({
      fontFamily:
        '"DejaVu Sans", Verdana, Arial, "Noto Color Emoji", sans-serif',
      fontSize: 34,
      fill: "#0f172a",
      fontWeight: "bold",
      wordWrap: true,
      wordWrapWidth: (bWidth - 34) * 2,
      breakWords: true,
      align: "left",
      lineHeight: 42,
      stroke: { width: 0, color: 0x000000 },
    }),
    [bWidth],
  );
  const iconStyle = useMemo<Partial<TextStyle>>(
    () => ({
      fontFamily:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      fontSize: 40,
      fill: "#000000",
    }),
    [],
  );

  return (
    // Pop from the tail (bottom-left), where the bubble meets the character
    <pixiContainer y={yOffset} x={45} scale={scale} alpha={alpha}>
      <pixiGraphics draw={(g) => drawBubble(g, bWidth, bHeight, type)} />
      {(kind || iconEmoji) && (
        <pixiContainer x={-bWidth / 2 - 6} y={-bHeight + 6}>
          <pixiGraphics draw={(g) => drawIconBadge(g, BADGE_RADIUS)} />
          {kind ? (
            <PixelIcon name={kind} tint={iconTint} />
          ) : (
            <pixiContainer scale={0.5} x={0} y={1}>
              <pixiText text={iconEmoji!} anchor={0.5} style={iconStyle} />
            </pixiContainer>
          )}
        </pixiContainer>
      )}
      <pixiContainer x={-bWidth / 2 + 17} y={-bHeight / 2} scale={0.5}>
        <pixiText text={text} anchor={{ x: 0, y: 0.5 }} style={textStyle} />
      </pixiContainer>
    </pixiContainer>
  );
}

export const SceneBubble = memo(SceneBubbleComponent);

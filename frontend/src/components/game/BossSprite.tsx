/**
 * BossSprite Component
 *
 * Renders the boss character at their desk with state-based coloring.
 * Uses sprites for desk, chair, keyboard, monitor, and phone like agent desks.
 */

"use client";

import { memo, useMemo, useState, useCallback, type ReactNode } from "react";
import { useTick } from "@pixi/react";
import { Graphics, TextStyle, Texture } from "pixi.js";
import type { BossState, BubbleContent, Position } from "@/types";
import { MarqueeText } from "./MarqueeText";
import { ICON_MAP } from "./shared/iconMap";
import { drawBubble, drawIconBadge } from "./shared/drawBubble";
import { drawRightArm, drawLeftArm } from "./shared/drawArm";
import { truncateBubbleText } from "@/utils/bubbleText";
import { PersonSprite, usePersonMotion } from "./PersonSprite";

// ============================================================================
// TYPES
// ============================================================================

export interface BossSpriteProps {
  position: Position;
  state: BossState;
  bubble: BubbleContent | null;
  inUseBy: "arrival" | "departure" | null;
  currentTask: string | null;
  chairTexture: Texture | null;
  deskTexture: Texture | null;
  keyboardTexture: Texture | null;
  monitorTexture: Texture | null;
  phoneTexture: Texture | null;
  headsetTexture: Texture | null;
  sunglassesTexture: Texture | null;
  renderBubble?: boolean; // Whether to render bubble (default true)
  isTyping?: boolean; // Whether boss is typing (animates arms)
  isAway?: boolean; // Whether boss is away from desk (hides body, shows only furniture)
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Capsule arms/headset from the original art; off with LPC workers. */
const SHOW_CAPSULE_PARTS = false;

const BOSS_WIDTH = 48; // 1.5 blocks × 32px
const STROKE_WIDTH = 4;

// State colors for the boss (kept for reference, not currently used)
const _STATE_COLORS: Record<BossState, number> = {
  idle: 0x2d3748, // Gray
  phone_ringing: 0xfbbf24, // Yellow
  on_phone: 0xfbbf24, // Yellow
  receiving: 0x06b6d4, // Cyan - receiving user input
  working: 0xef4444, // Red - active
  delegating: 0x8b5cf6, // Purple - spawning agents
  waiting_permission: 0xf97316, // Orange - waiting for permission
  reviewing: 0x3b82f6, // Blue - reviewing agent work
  completing: 0x22c55e, // Green - finishing up
};

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================


function drawFallbackChair(g: Graphics): void {
  g.clear();
  g.circle(0, 15, 25);
  g.fill(0x4a5568);
  g.stroke({ width: 2, color: 0x2d3748 });
}

function drawFallbackDesk(g: Graphics): void {
  g.clear();
  g.rect(-70, 15, 140, 80);
  g.fill(0x5d3a1e);
  g.stroke({ width: 4, color: 0x3d2a1e });
}

// ============================================================================
// BUBBLE COMPONENT
// ============================================================================

interface BubbleProps {
  content: BubbleContent;
  yOffset: number;
}

function Bubble({ content, yOffset }: BubbleProps): ReactNode {
  const { type = "thought", icon } = content;
  const text = truncateBubbleText(content.text);

  // Convert icon name to emoji if needed
  const iconEmoji = icon ? (ICON_MAP[icon] ?? icon) : undefined;

  // Icon badge constants
  const badgeRadius = 16; // Radius of the circular badge

  // Calculate bubble dimensions (at display scale) - icon is outside bubble now
  const charWidth = 11.5;
  const paddingH = 34;
  const maxW = 340;
  const rawWidth = text.length * charWidth + paddingH;
  const bWidth = Math.min(maxW, Math.max(90, rawWidth));
  const capacity = (bWidth - paddingH) / charWidth;
  const lines = Math.max(1, Math.ceil(text.length / capacity));
  const bHeight = 30 + lines * 21;

  // Text style at 2x for sharp rendering
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

  // Icon style - larger emoji
  const iconStyle = useMemo<Partial<TextStyle>>(
    () => ({
      fontFamily:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      fontSize: 40, // Large emoji for badge
      fill: "#000000",
    }),
    [],
  );

  return (
    <pixiContainer y={yOffset} x={45}>
      <pixiGraphics draw={(g) => drawBubble(g, bWidth, bHeight, type)} />
      {/* Icon badge on top-left corner of bubble */}
      {iconEmoji && (
        <pixiContainer x={-bWidth / 2 - 6} y={-bHeight + 6}>
          <pixiGraphics draw={(g) => drawIconBadge(g, badgeRadius)} />
          <pixiContainer scale={0.5} x={0} y={1}>
            <pixiText text={iconEmoji} anchor={0.5} style={iconStyle} />
          </pixiContainer>
        </pixiContainer>
      )}
      {/* Text rendered at 2x and scaled down for sharpness */}
      <pixiContainer x={-bWidth / 2 + 17} y={-bHeight / 2} scale={0.5}>
        <pixiText text={text} anchor={{ x: 0, y: 0.5 }} style={textStyle} />
      </pixiContainer>
    </pixiContainer>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function BossSpriteComponent({
  position,
  state: _state,
  bubble,
  inUseBy: _inUseBy,
  currentTask,
  chairTexture,
  deskTexture,
  keyboardTexture,
  monitorTexture,
  phoneTexture: _phoneTexture,
  headsetTexture,
  sunglassesTexture: _sunglassesTexture,
  renderBubble = true,
  isTyping = false,
  isAway = false,
}: BossSpriteProps): ReactNode {
  // Animation state for typing
  const [typingTime, setTypingTime] = useState(0);

  // Animate typing - oscillate hands up/down
  useTick((ticker) => {
    if (isTyping) {
      setTypingTime((t) => t + ticker.deltaTime * 0.15);
    } else if (typingTime !== 0) {
      setTypingTime(0);
    }
  });

  // Calculate arm animation offsets (subtle, out of phase for natural look)
  const rightArmOffset = isTyping ? Math.sin(typingTime * 8) * 2 : 0;
  const leftArmOffset = isTyping
    ? Math.sin(typingTime * 8 + Math.PI * 0.7) * 2
    : 0;

  // Boss arm params: body half-width 22px, shoulder at y=0, keyboard at y=32
  const bossArmParams = useMemo(
    () => ({
      bodyHalfWidth: (BOSS_WIDTH - STROKE_WIDTH) / 2,
      startY: 0,
      endY: 32,
      handColor: 0x1f2937,
    }),
    [],
  );

  // Arm draw callbacks need to be recreated when animation changes
  const drawRightArmCallback = useCallback(
    (g: Graphics) =>
      drawRightArm(g, { ...bossArmParams, animOffset: rightArmOffset }),
    [bossArmParams, rightArmOffset],
  );

  const drawLeftArmCallback = useCallback(
    (g: Graphics) =>
      drawLeftArm(g, { ...bossArmParams, animOffset: leftArmOffset }),
    [bossArmParams, leftArmOffset],
  );

  const bubbleOffset = -80;

  return (
    <pixiContainer x={position.x} y={position.y}>
      {/* Chair - behind everything */}
      {chairTexture ? (
        <pixiSprite
          texture={chairTexture}
          anchor={0.5}
          x={5}
          y={30}
          scale={0.1386}
        />
      ) : (
        <pixiGraphics draw={drawFallbackChair} />
      )}

      {/* Boss character (body + accessories) - hidden when away from desk */}
      {!isAway && (
        <pixiContainer y={6}>
          {/* Boss: LPC pixel-art worker in black, sitting at the desk */}
          <PersonSprite sheet="boss" mode="sit" direction="down" feetY={30} />
        </pixiContainer>
      )}

      {/* Desk surface - in front of boss */}
      {deskTexture ? (
        <pixiSprite
          texture={deskTexture}
          anchor={{ x: 0.5, y: 0 }}
          y={30}
          scale={0.105}
        />
      ) : (
        <pixiGraphics draw={drawFallbackDesk} />
      )}

      {/* Keyboard - on desk surface */}
      {keyboardTexture && (
        <pixiSprite
          texture={keyboardTexture}
          anchor={0.5}
          x={0}
          y={42}
          scale={0.04}
        />
      )}

      {/* Arms - the LPC worker has its own, so these stay off */}
      {!isAway && SHOW_CAPSULE_PARTS && (
        <pixiContainer y={6}>
          <pixiGraphics draw={drawRightArmCallback} />
          <pixiGraphics draw={drawLeftArmCallback} />
        </pixiContainer>
      )}

      {/* Headset - hidden when away from desk */}
      {!isAway && SHOW_CAPSULE_PARTS && headsetTexture && (
        <pixiSprite
          texture={headsetTexture}
          anchor={0.5}
          x={0}
          y={6 - 20}
          scale={{ x: 0.66825, y: 0.675 }}
        />
      )}

      {/* Monitor - left side of desk */}
      {monitorTexture && (
        <pixiSprite
          texture={monitorTexture}
          anchor={0.5}
          x={-45}
          y={27}
          scale={0.08}
        />
      )}

      {/* Boss label - hidden when away from desk */}
      {!isAway && (
        <pixiContainer y={-63} scale={0.5}>
          <pixiText
            text="Claude"
            anchor={0.5}
            style={{
              fontFamily: "monospace",
              fontSize: 24,
              fill: 0xffffff,
              fontWeight: "bold",
              stroke: { width: 4, color: 0x000000 },
            }}
          />
        </pixiContainer>
      )}

      {/* Task marquee on desk - scrolling user prompt */}
      {currentTask && (
        <pixiContainer x={0} y={70}>
          <MarqueeText text={currentTask} width={115} color="#00ff88" />
        </pixiContainer>
      )}

      {/* Bubble - only render if renderBubble is true and boss is at desk */}
      {renderBubble && bubble && !isAway && (
        <Bubble content={bubble} yOffset={bubbleOffset} />
      )}
    </pixiContainer>
  );
}

export const BossSprite = memo(BossSpriteComponent);

// Export Bubble component for use in top-level bubbles layer
export { Bubble as BossBubble };

// ============================================================================
// MOBILE BOSS COMPONENT (for walking around the office)
// ============================================================================

export interface MobileBossProps {
  position: Position;
  jumpOffset?: number; // Vertical offset for jump animation
  scale?: number; // Scale factor for boss body
  sunglassesTexture: Texture | null;
  headsetTexture: Texture | null;
}

function MobileBossComponent({
  position,
  jumpOffset = 0,
  scale = 1.0,
  sunglassesTexture: _sunglassesTexture,
  headsetTexture: _headsetTexture,
}: MobileBossProps): ReactNode {
  const motion = usePersonMotion(position);

  return (
    <pixiContainer x={position.x} y={position.y + jumpOffset} scale={scale}>
      {/* Boss walking as an LPC worker */}
      <PersonSprite
        sheet="boss"
        mode={motion.moving ? "walk" : "idle"}
        direction={motion.direction}
      />

      {/* Boss label */}
      <pixiContainer y={-63} scale={0.5}>
        <pixiText
          text="Claude"
          anchor={0.5}
          style={{
            fontFamily: "monospace",
            fontSize: 24,
            fill: 0xffffff,
            fontWeight: "bold",
            stroke: { width: 4, color: 0x000000 },
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export const MobileBoss = memo(MobileBossComponent);

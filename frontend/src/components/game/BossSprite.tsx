/**
 * BossSprite Component
 *
 * Renders the boss character at their desk with state-based coloring.
 * Uses sprites for desk, chair, keyboard, monitor, and phone like agent desks.
 */

"use client";

import { useCharacterPress } from "@/hooks/useCharacterPress";
import { memo, useMemo, useState, useCallback, type ReactNode } from "react";
import { useTick } from "@pixi/react";
import { Graphics, Texture } from "pixi.js";
import type { BossState, BubbleContent, Position } from "@/types";
import { MarqueeText } from "./MarqueeText";
import { drawRightArm, drawLeftArm } from "./shared/drawArm";
import {
  PersonSprite,
  useActivityClock,
  usePersonMotion,
  type PersonMode,
} from "./PersonSprite";
import { bossDirectingDirection } from "@/systems/typingPose";
import {
  bossStance,
  conversantKey,
  parseConversantKey,
  seedFromId,
  type BossStance,
} from "@/systems/personPoses";
import { useGameStore } from "@/stores/gameStore";
import type { AgentPhase } from "@/stores/gameStore";
import { NameTag } from "./NameTag";
import {
  Celebration,
  NeedsYouRing,
  StatusMark,
  useClock,
  useSince,
  type StatusKind,
} from "./CharacterEffects";
import { SceneBubble } from "./shared/SceneBubble";
import { characterMood, type PersonSignals } from "@/systems/sceneSignals";
import { SHAKE_MS, shakeOffset } from "@/systems/sceneMotion";
import { useReducedMotion } from "@/systems/reducedMotion";
import { AgentProgressBadge } from "./AgentProgressBadge";

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
  /** Todo-list progress for the badge over the name tag (null = none). */
  progress?: { done: number; total: number } | null;
  /** Boss's last activity / error / tool from the event log. */
  signals?: PersonSignals;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Capsule arms/headset from the original art; off with LPC workers. */
const SHOW_CAPSULE_PARTS = false;

/** Feet offset while the boss stands behind the desk (sitting is 30). */
const BOSS_STANDING_FEET_Y = 26;

const BOSS_SEED = seedFromId("boss");

/** Boss stance → how the boss sprite is drawn. */
const STANCE_SPRITE: Record<
  BossStance,
  { mode: PersonMode; feetY: number; glance: boolean }
> = {
  sit: { mode: "sit", feetY: 30, glance: true },
  direct: { mode: "idle", feetY: BOSS_STANDING_FEET_Y, glance: false },
  talk: { mode: "gesture", feetY: BOSS_STANDING_FEET_Y, glance: false },
  handoff: { mode: "gesture", feetY: BOSS_STANDING_FEET_Y, glance: false },
};

/** Store selector: who the boss deals with, as "phase|facing" (stable). */
function selectConversantKey(state: {
  agents: Map<
    string,
    { phase: AgentPhase; currentPosition: { x: number; y: number } }
  >;
  boss: { position: { x: number; y: number } };
}): string {
  return conversantKey(state.agents.values(), state.boss.position);
}

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
  return <SceneBubble content={content} yOffset={yOffset} />;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function BossSpriteComponent({
  position,
  state,
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
  progress = null,
  signals,
}: BossSpriteProps): ReactNode {
  // Tap or long-press: open the boss's card
  const press = useCharacterPress("boss", position);
  // Busy boss (tool use, with a short linger) stands up and directs the team
  const directingElapsed = useActivityClock(
    (isTyping || state === "delegating") && !isAway,
  );

  // Talking to / handing over to an agent in front of the desk
  const conversant = parseConversantKey(useGameStore(selectConversantKey));
  const stance = bossStance({
    conversantPhase: conversant.phase,
    isTyping: directingElapsed !== null,
    backendState: state,
  });
  // Mood: needs you > error > sleeping (5 quiet minutes) > normal
  const reduced = useReducedMotion();
  const now = useClock(1000);
  const mood = characterMood({
    backendState: state,
    now,
    lastEventAt: signals?.lastEventAt ?? null,
    lastErrorAt: signals?.lastErrorAt ?? null,
  });
  const sleeping = mood === "sleeping" && stance === "sit";
  const sprite = sleeping
    ? { mode: "sleep" as const, feetY: 30, glance: false }
    : STANCE_SPRITE[stance];
  const shakeMs = useSince(
    mood === "error" ? (signals?.lastErrorAt ?? null) : null,
    SHAKE_MS,
  );
  const shakeX = reduced ? 0 : shakeOffset(shakeMs);
  // Turn finished ("completing"): confetti and a check mark
  const [finished, setFinished] = useState({ state, n: 0 });
  if (finished.state !== state) {
    setFinished({
      state,
      n: state === "completing" ? finished.n + 1 : finished.n,
    });
  }
  const doneMs = useSince(finished.n > 0 ? finished.n : null, 1800);
  const showDone = finished.n > 0 && doneMs < 1800;
  const mark: StatusKind | null =
    mood === "needs_you"
      ? "needs_you"
      : mood === "error"
        ? "error"
        : showDone
          ? "done"
          : sleeping
            ? "sleeping"
            : null;
  const direction =
    stance === "sit"
      ? "down"
      : stance === "direct"
        ? bossDirectingDirection(directingElapsed ?? 0)
        : conversant.facing;

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
    <pixiContainer x={position.x} y={position.y} {...press}>
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
        <pixiContainer y={6} x={shakeX} alpha={sleeping ? 0.7 : 1}>
          {/* Waiting for the user: amber ring behind him */}
          {mood === "needs_you" && <NeedsYouRing y={14} width={30} />}
          {/* Boss: LPC pixel-art worker. He doesn't type: while busy he
              stands behind the desk and looks over the team (directing). */}
          {/* One sprite for every stance: switching stance must not
              remount it (that flashed an empty / wrong frame) */}
          <PersonSprite
            sheet="boss"
            mode={sprite.mode}
            gesture={
              stance === "talk" || stance === "handoff" ? stance : undefined
            }
            direction={direction}
            feetY={sprite.feetY}
            seed={BOSS_SEED}
            glance={sprite.glance}
            shadow={false}
          />
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
      {!isAway && <NameTag name="Claude" accent={0xff8a3d} y={-60} />}
      {!isAway && (
        <AgentProgressBadge progress={progress} color={0xff8a3d} y={-76} />
      )}

      {/* Needs you / error / done / zzz, next to his head */}
      {!isAway && mark && <StatusMark kind={mark} y={-34} />}
      {!isAway && showDone && (
        <Celebration key={finished.n} seed={BOSS_SEED + finished.n} y={-30} />
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
        walkDistance={motion.distance}
        seed={BOSS_SEED}
      />

      {/* Boss label */}
      <NameTag name="Claude" accent={0xff8a3d} y={-60} />
    </pixiContainer>
  );
}

export const MobileBoss = memo(MobileBossComponent);

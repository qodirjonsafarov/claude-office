/**
 * AgentSprite Component
 *
 * Renders a single agent as an LPC pixel-art office worker (see PersonSprite)
 * whose shirt matches the agent color, with optional bubble.
 */

"use client";

import {
  memo,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useTick } from "@pixi/react";
import { Graphics, Texture } from "pixi.js";
import type { Position, BubbleContent, AgentState } from "@/types";
import type { AgentPhase } from "@/stores/gameStore";
import { useAttentionStore } from "@/stores/attentionStore";
import { usePreferencesStore } from "@/stores/preferencesStore";
import {
  BOSS_POSITION,
  getDeskPosition,
  isInElevatorZone,
} from "@/systems/queuePositions";
import { faceToward, type Facing } from "@/systems/personMotion";
import {
  COFFEE_FACING,
  GREET_MS,
  agentStance,
  facesBoss,
  seedFromId,
  showsThinking,
  type AgentStance,
} from "@/systems/personPoses";
import { isAtCoffeeSpot } from "@/systems/coffeeBreak";
import { drawRightArm, drawLeftArm } from "./shared/drawArm";
import {
  PersonSprite,
  sheetForColor,
  usePersonMotion,
  type PersonMode,
} from "./PersonSprite";
import { ThinkingDots } from "./ThinkingDots";
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
import {
  SHAKE_MS,
  SQUASH_MS,
  shakeOffset,
  squashScale,
} from "@/systems/sceneMotion";
import { useReducedMotion } from "@/systems/reducedMotion";
import { NameTag, accentFromHex } from "./NameTag";
import { AgentProgressBadge } from "./AgentProgressBadge";

// ============================================================================
// TYPES
// ============================================================================

export interface AgentSpriteProps {
  id: string;
  name: string | null;
  color: string;
  number: number;
  position: Position;
  phase: AgentPhase;
  bubble: BubbleContent | null;
  headsetTexture?: Texture | null;
  sunglassesTexture?: Texture | null;
  renderBubble?: boolean; // Whether to render bubble (default true)
  renderLabel?: boolean; // Whether to render name label (default true)
  isTyping?: boolean; // Whether agent is typing (animates arms)
  /** Render-only nudge so people don't stand inside each other. */
  offset?: Position;
  /** Assigned desk (1-based), to tell "seated at the desk" from "standing". */
  desk?: number | null;
  /** Backend work state; the "..." puff shows only while working. */
  backendState?: AgentState;
  /** Todo-list progress for the badge over the name tag (null = none). */
  progress?: { done: number; total: number } | null;
  /** People sheet (look by role, systems/agentLooks.ts); else by color. */
  sheet?: string;
  /** Last activity / error / tool from the event log (sceneSignals.ts). */
  signals?: PersonSignals;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AGENT_WIDTH = 48; // 1.5 blocks × 32px (matches boss)
const STROKE_WIDTH = 4;

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

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

function AgentSpriteComponent({
  id,
  name,
  color,
  number: _number,
  position,
  phase,
  bubble,
  headsetTexture: _headsetTexture,
  sunglassesTexture: _sunglassesTexture,
  renderBubble = true,
  renderLabel = true,
  isTyping = false,
  offset,
  desk = null,
  backendState = "working",
  progress = null,
  sheet: sheetProp,
  signals,
}: AgentSpriteProps): ReactNode {
  const clickToFocusEnabled = usePreferencesStore((s) => s.clickToFocusEnabled);
  const openFocusPopup = useAttentionStore((s) => s.openFocusPopup);

  const colorSheet = useMemo(() => sheetForColor(color, id), [color, id]);
  const sheet = sheetProp ?? colorSheet;
  const seed = useMemo(() => seedFromId(id), [id]);
  const motion = usePersonMotion(position);
  // Wave hello once the agent stands still in the queue (the timer must not
  // run out while it's still walking up)
  const greeting = useFirstMoments(
    phase === "in_arrival_queue" && !motion.moving,
    GREET_MS,
  );

  const atDesk =
    phase === "idle" &&
    desk !== null &&
    isNear(position, getDeskPosition(desk));
  const stance = agentStance({
    phase,
    moving: motion.moving,
    atDesk,
    atCoffee: isAtCoffeeSpot(position),
    msInPhase: greeting ? 0 : GREET_MS,
  });
  const look = facingFor(stance, phase, position, motion.direction);

  // Mood: needs you > error > sleeping (resting / 5 quiet minutes) > normal
  const reduced = useReducedMotion();
  const now = useClock(1000);
  const mood = characterMood({
    backendState,
    now,
    lastEventAt: signals?.lastEventAt ?? null,
    lastErrorAt: signals?.lastErrorAt ?? null,
  });
  const seated = stance === "sit";
  const sleeping = mood === "sleeping" && seated;
  // Read / Grep: head bowed over the desk instead of typing
  const reading = seated && isTyping && signals?.tool === "read";
  const personMode: PersonMode = sleeping ? "sleep" : MODE_FOR_STANCE[stance];

  // Error: a 150 ms shake by whole pixels
  const shakeMs = useSince(
    mood === "error" ? (signals?.lastErrorAt ?? null) : null,
    SHAKE_MS,
  );
  const shakeX = reduced ? 0 : shakeOffset(shakeMs);
  // Arrival at the desk: a 160 ms squash
  const squashMs = useSince(seated ? `desk-${desk}` : null, SQUASH_MS);
  const squash = reduced ? { x: 1, y: 1 } : squashScale(squashMs);
  // Finished a task: confetti and a check mark for a moment
  const [finished, setFinished] = useState({ state: backendState, n: 0 });
  if (finished.state !== backendState) {
    setFinished({
      state: backendState,
      n: backendState === "resting" ? finished.n + 1 : finished.n,
    });
  }
  const doneMs = useSince(finished.n > 0 ? finished.n : null, DONE_MARK_MS);
  const showDone = finished.n > 0 && doneMs < DONE_MARK_MS;
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
  const feetY = personMode === "sit" || personMode === "sleep" ? 30 : 22;

  // Click handler for focus popup
  const handlePointerTap = useCallback(() => {
    if (!clickToFocusEnabled) return;
    const canvas = document.querySelector(".pixi-canvas-container canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / 1280; // CANVAS_WIDTH = 1280
    const screenX = rect.left + position.x * scale;
    const screenY = rect.top + position.y * scale;
    openFocusPopup(id, screenX, screenY);
  }, [clickToFocusEnabled, id, position.x, position.y, openFocusPopup]);

  // Bubble offset for capsule rendering
  const bubbleOffset = -93;

  return (
    <pixiContainer
      x={position.x + (offset?.x ?? 0)}
      y={position.y + (offset?.y ?? 0)}
      onPointerTap={handlePointerTap}
      interactive={clickToFocusEnabled}
    >
      {/* Waiting for the user: amber ring on the floor */}
      {/* (seated: around the waist, the desk hides the floor) */}
      {mood === "needs_you" && (
        <NeedsYouRing y={seated ? 4 : feetY} width={seated ? 30 : 26} />
      )}

      {/* Pixel-art office worker: squash pivots at the feet, dims asleep */}
      <pixiContainer
        x={shakeX}
        y={feetY}
        scale={squash}
        alpha={sleeping ? 0.7 : 1}
      >
        <pixiContainer y={-feetY}>
          <PersonSprite
            sheet={sheet}
            mode={personMode}
            direction={look}
            feetY={feetY}
            typing={isTyping && !reading && !sleeping}
            reading={reading}
            walkDistance={motion.distance}
            gesture={
              stance === "walk" || stance === "sit" || stance === "stand"
                ? undefined
                : stance
            }
            seed={seed}
            glance={stance === "stand" || (seated && !isTyping && !sleeping)}
          />
        </pixiContainer>
      </pixiContainer>

      {/* Seated and not typing: the agent is thinking */}
      {seated && !bubble && !sleeping && !mark && (
        <ThinkingDots active={!isTyping && showsThinking(backendState)} />
      )}

      {/* Needs you / error / done / zzz, next to the head */}
      {mark && !isInElevatorZone(position) && (
        <StatusMark kind={mark} y={seated || sleeping ? -44 : -52} />
      )}
      {finished.n > 0 && showDone && (
        <Celebration key={finished.n} seed={seed + finished.n} />
      )}

      {/* Agent name if present - hide when in elevator or when renderLabel is false */}
      {renderLabel && name && !isInElevatorZone(position) && (
        <>
          <NameTag name={name} accent={accentFromHex(color)} y={-72} />
          <AgentProgressBadge
            progress={progress}
            color={accentFromHex(color)}
            y={-88}
          />
        </>
      )}

      {/* Bubble - hide when in elevator or when renderBubble is false */}
      {renderBubble && bubble && !isInElevatorZone(position) && (
        <Bubble content={bubble} yOffset={bubbleOffset} />
      )}
    </pixiContainer>
  );
}

// ============================================================================
// STANCE HELPERS
// ============================================================================

/** How long the check mark stays after finishing a task. */
const DONE_MARK_MS = 1800;

const MODE_FOR_STANCE: Record<AgentStance, PersonMode> = {
  walk: "walk",
  sit: "sit",
  stand: "idle",
  greet: "gesture",
  talk: "gesture",
  handoff: "gesture",
  sip: "gesture",
};

function isNear(a: Position, b: Position): boolean {
  return Math.abs(a.x - b.x) <= 6 && Math.abs(a.y - b.y) <= 6;
}

/** Where an agent looks when not walking. */
function facingFor(
  stance: AgentStance,
  phase: AgentPhase,
  position: Position,
  walked: Facing,
): Facing {
  if (stance === "walk") return walked;
  if (stance === "sit") return "down";
  if (stance === "sip") return COFFEE_FACING;
  if (phase === "arriving" || phase === "in_elevator") return "down";
  if (facesBoss(phase)) return faceToward(position, BOSS_POSITION);
  return walked;
}

/**
 * True during the first `ms` of `active` (once per mounted agent; the
 * arrival queue phase only happens once in an agent's life).
 */
function useFirstMoments(active: boolean, ms: number): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setExpired(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);
  return active && !expired;
}

// ============================================================================
// AGENT ARMS COMPONENT (rendered separately after desk surfaces)
// ============================================================================

export interface AgentArmsProps {
  position: Position;
  isTyping: boolean;
}

function AgentArmsComponent({ position, isTyping }: AgentArmsProps): ReactNode {
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

  // Agent arm params: body half-width 22px, shoulder at y=-16, keyboard at y=16
  const agentArmParams = useMemo(
    () => ({
      bodyHalfWidth: (AGENT_WIDTH - STROKE_WIDTH) / 2,
      startY: -16,
      endY: 16,
      handColor: 0x1f2937,
    }),
    [],
  );

  // Arm draw callbacks
  const drawRightArmCallback = useCallback(
    (g: Graphics) =>
      drawRightArm(g, { ...agentArmParams, animOffset: rightArmOffset }),
    [agentArmParams, rightArmOffset],
  );

  const drawLeftArmCallback = useCallback(
    (g: Graphics) =>
      drawLeftArm(g, { ...agentArmParams, animOffset: leftArmOffset }),
    [agentArmParams, leftArmOffset],
  );

  return (
    <pixiContainer x={position.x} y={position.y}>
      <pixiGraphics draw={drawRightArmCallback} />
      <pixiGraphics draw={drawLeftArmCallback} />
    </pixiContainer>
  );
}

export const AgentArms = memo(AgentArmsComponent);

// ============================================================================
// AGENT HEADSET COMPONENT (rendered after arms for correct z-order)
// ============================================================================

export interface AgentHeadsetProps {
  position: Position;
  headsetTexture: Texture;
}

function AgentHeadsetComponent({
  position,
  headsetTexture,
}: AgentHeadsetProps): ReactNode {
  return (
    <pixiSprite
      texture={headsetTexture}
      anchor={0.5}
      x={position.x}
      y={position.y - 38}
      scale={{ x: 0.66825, y: 0.675 }}
    />
  );
}

export const AgentHeadset = memo(AgentHeadsetComponent);

// ============================================================================
// AGENT LABEL COMPONENT (rendered separately for z-ordering)
// ============================================================================

export interface AgentLabelProps {
  name: string;
  position: Position;
  color?: string;
  /** Todo-list progress for the badge over the name tag (null = none). */
  progress?: { done: number; total: number } | null;
  /** The latest tool call failed (red tick on the badge). */
  failing?: boolean;
}

function AgentLabelComponent({
  name,
  position,
  color,
  progress = null,
  failing = false,
}: AgentLabelProps): ReactNode {
  const accent = color ? accentFromHex(color) : undefined;
  return (
    <>
      <NameTag name={name} accent={accent} x={position.x} y={position.y - 72} />
      <AgentProgressBadge
        progress={progress}
        color={accent ?? 0x8b5cf6}
        x={position.x}
        y={position.y - 88}
        failing={failing}
      />
    </>
  );
}

export const AgentLabel = memo(AgentLabelComponent);

export const AgentSprite = memo(AgentSpriteComponent);

// Export Bubble component for use in top-level bubbles layer
export { Bubble };

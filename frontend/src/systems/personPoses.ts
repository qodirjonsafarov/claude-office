/**
 * State poses for the LPC office workers.
 *
 * Gestures use the sheet's own LPC animations (no limbs drawn on top):
 * - spellcast: talking with the hands, waving hello, using the coffee machine
 * - thrust: holding the arm out to hand something over
 * Plus idle life (blinking, glancing to the side) and the choice of stance
 * for an agent / the boss in each phase. Pure TS: no Pixi, no React.
 */

import type { AgentPhase } from "@/stores/slices/types";
import type { AgentState, BossState, Position } from "@/types";
import { faceToward, type Facing } from "./personMotion";

// ============================================================================
// GESTURES
// ============================================================================

export type Gesture = "greet" | "talk" | "handoff" | "sip";
export type GestureAnim = "spellcast" | "thrust";

interface GestureSpec {
  anim: GestureAnim;
  /** Frames in that animation in the sheet. */
  frames: number;
  /** Frames to play, in order. */
  sequence: readonly number[];
  stepMs: number;
  /** Loop, or play once and hold the last frame. */
  loop: boolean;
}

export const GESTURES: Record<Gesture, GestureSpec> = {
  // Both hands up and down twice: "hi!"
  greet: {
    anim: "spellcast",
    frames: 7,
    sequence: [0, 4, 5, 4, 5, 4, 0],
    stepMs: 180,
    loop: false,
  },
  // Explaining with the hands, with a short rest between phrases
  talk: {
    anim: "spellcast",
    frames: 7,
    sequence: [0, 1, 2, 3, 3, 2, 1, 2, 3, 2, 1, 0, 0, 0],
    stepMs: 190,
    loop: true,
  },
  // Arm goes out and stays there: here is the task / the report
  handoff: {
    anim: "thrust",
    frames: 8,
    sequence: [0, 1, 2, 3, 4, 5],
    stepMs: 120,
    loop: false,
  },
  // At the coffee machine, back to the viewer: pressing buttons, waiting
  sip: {
    anim: "spellcast",
    frames: 7,
    sequence: [0, 1, 2, 2, 2, 3, 3, 2, 2, 1, 0, 0, 0, 0, 0, 0],
    stepMs: 240,
    loop: true,
  },
};

/** How long the hello wave lasts. */
export const GREET_MS =
  GESTURES.greet.sequence.length * GESTURES.greet.stepMs + 40;

/** Frame (within the gesture's animation) `elapsedMs` into the gesture. */
export function gestureFrame(gesture: Gesture, elapsedMs: number): number {
  const { sequence, stepMs, loop } = GESTURES[gesture];
  const step = Math.floor(Math.max(0, elapsedMs) / stepMs);
  if (loop) return sequence[step % sequence.length];
  return sequence[Math.min(step, sequence.length - 1)];
}

// ============================================================================
// IDLE LIFE
// ============================================================================

/** Small deterministic hash so every person gets their own rhythm. */
function mix(seed: number, salt: number): number {
  let h = (seed * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/** Stable numeric seed for a person id. */
export function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

const BLINK_MS = 130;

/** Eyes closed right now? A short blink every 3.4–5 s, per person. */
export function isBlinking(elapsedMs: number, seed: number): boolean {
  const period = 3400 + (mix(seed, 1) % 1600);
  const offset = mix(seed, 2) % period;
  return (Math.max(0, elapsedMs) + offset) % period < BLINK_MS;
}

const GLANCE_MS = 900;

/**
 * Side glance (left / right) every 9–13 s for under a second, else null
 * (keep facing where the person was facing).
 */
export function glanceAt(
  elapsedMs: number,
  seed: number,
): "left" | "right" | null {
  const period = 9000 + (mix(seed, 3) % 4000);
  const t = Math.max(0, elapsedMs) + (mix(seed, 4) % period);
  const cycle = Math.floor(t / period);
  const inCycle = t % period;
  // Glance in the middle of the cycle, never right at the start
  const start = period / 2;
  if (inCycle < start || inCycle >= start + GLANCE_MS) return null;
  return (cycle + seed) % 2 === 0 ? "left" : "right";
}

// ============================================================================
// THINKING
// ============================================================================

/** Not typing this long at the desk → show the "..." thought puff. */
export const THINKING_DELAY_MS = 2000;
const THINKING_DOT_MS = 380;

/** The "..." puff `idleMs` after the worker stopped typing. */
export function thinkingDots(idleMs: number): {
  visible: boolean;
  lit: number;
} {
  if (idleMs < THINKING_DELAY_MS) return { visible: false, lit: 0 };
  const step = Math.floor((idleMs - THINKING_DELAY_MS) / THINKING_DOT_MS);
  return { visible: true, lit: step % 3 };
}

/**
 * Whether a seated, not-typing agent is thinking on its own (show the "..."
 * puff), as opposed to waiting for the user or being done.
 */
export function showsThinking(backendState: AgentState): boolean {
  return backendState === "working" || backendState === "thinking";
}

// ============================================================================
// STANCES
// ============================================================================

export type AgentStance =
  "walk" | "sit" | "stand" | "greet" | "talk" | "handoff" | "sip";

export interface AgentStanceInput {
  phase: AgentPhase;
  moving: boolean;
  /** Standing at (seated on the chair of) the assigned desk. */
  atDesk: boolean;
  /** Standing at a coffee spot (coffee break). */
  atCoffee: boolean;
  /** Time since the current phase started. */
  msInPhase: number;
}

/** What an agent is doing with the body right now. */
export function agentStance(input: AgentStanceInput): AgentStance {
  if (input.moving) return "walk";
  switch (input.phase) {
    case "idle":
      if (input.atDesk) return "sit";
      return input.atCoffee ? "sip" : "stand";
    case "in_arrival_queue":
      return input.msInPhase < GREET_MS ? "greet" : "stand";
    // Standing in the elevator: "hello" on the way in, "bye" on the way out
    // (the wave plays once, then the hands rest)
    case "arriving":
    case "in_elevator":
      return "greet";
    case "conversing":
      return "talk";
    case "at_boss":
      return "handoff";
    default:
      return "stand";
  }
}

/** Phases where an agent stands in front of the boss and faces him. */
export function facesBoss(phase: AgentPhase): boolean {
  return (
    phase === "conversing" ||
    phase === "at_boss" ||
    phase === "in_arrival_queue" ||
    phase === "in_departure_queue"
  );
}

export type BossStance = "sit" | "direct" | "talk" | "handoff";

export interface BossStanceInput {
  /** Phase of the agent the boss is dealing with, if any. */
  conversantPhase: AgentPhase | null;
  isTyping: boolean;
  backendState: BossState;
}

/** The boss never types: he sits, directs the team, talks or hands over. */
export function bossStance(input: BossStanceInput): BossStance {
  if (input.conversantPhase === "at_boss") return "handoff";
  // Talk once the agent stands in front of him, not while it walks up
  if (input.conversantPhase === "conversing") return "talk";
  if (input.isTyping || input.backendState === "delegating") return "direct";
  return "sit";
}

/** Agent phases in which the boss is dealing with that agent in person. */
const CONVERSANT_PHASES: ReadonlySet<AgentPhase> = new Set([
  "conversing",
  "walking_to_boss",
  "at_boss",
]);

/**
 * The agent the boss is dealing with as "phase|facing" (the side the boss
 * turns to), or "". A string so a store selector stays stable: it changes
 * only when the phase or the side changes, not on every step.
 */
export function conversantKey(
  agents: Iterable<{ phase: AgentPhase; currentPosition: Position }>,
  boss: Position,
): string {
  for (const agent of agents) {
    if (CONVERSANT_PHASES.has(agent.phase)) {
      return `${agent.phase}|${faceToward(boss, agent.currentPosition)}`;
    }
  }
  return "";
}

/** Inverse of {@link conversantKey}. */
export function parseConversantKey(key: string): {
  phase: AgentPhase | null;
  facing: Facing;
} {
  if (!key) return { phase: null, facing: "down" };
  const [phase, facing] = key.split("|") as [AgentPhase, Facing];
  return { phase, facing };
}

/** Facing while doing a gesture at the coffee machine (it's on the wall). */
export const COFFEE_FACING: Facing = "up";

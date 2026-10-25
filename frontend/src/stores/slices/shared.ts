/**
 * Shared store constants and helpers (ARC-005).
 * Used by bossSlice, bubbleSlice, agentSlice, and the gameStore reset variants.
 */
import type { Position } from "@/types";
import type { BubbleState, BossAnimationState } from "./types";

export const BOSS_POSITION: Position = { x: 640, y: 900 };

export const createEmptyBubbleState = (): BubbleState => ({
  content: null,
  displayStartTime: null,
  queue: [],
});

export const initialBossState: BossAnimationState = {
  backendState: "idle",
  position: BOSS_POSITION,
  bubble: createEmptyBubbleState(),
  inUseBy: null,
  currentTask: null,
  isTyping: false,
  waitingSince: null,
  progress: null,
};

/** Start of a permission wait: kept while waiting, set on entry, else null. */
export function waitStart(
  before: string,
  after: string,
  since: number | null,
): number | null {
  if (after !== "waiting_permission") return null;
  return before === "waiting_permission" && since !== null ? since : Date.now();
}

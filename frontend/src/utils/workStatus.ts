/**
 * Who in the office is busy right now: drives the "working now" indicator in
 * the mobile header and the activity list under the office.
 */

import type { AgentState, BossState } from "@/types/generated";

/** Agent backend states that mean the agent is doing work at its desk. */
const BUSY_AGENT_STATES: ReadonlySet<AgentState> = new Set<AgentState>([
  "working",
  "thinking",
  "waiting_permission",
]);

/**
 * The boss is busy in every state except idle and "completing": after STOP his
 * turn is over and he waits for the user's next prompt.
 */
export function isBossBusy(state: BossState): boolean {
  return state !== "idle" && state !== "completing";
}

/** An agent is busy while it works, thinks, waits for a permission or types. */
export function isAgentBusy(state: AgentState, isTyping: boolean): boolean {
  return isTyping || BUSY_AGENT_STATES.has(state);
}

/** How many people in the office are busy: the boss plus the busy agents. */
export function countWorking(
  bossState: BossState,
  agents: Iterable<{ backendState: AgentState; isTyping: boolean }>,
): number {
  let count = isBossBusy(bossState) ? 1 : 0;
  for (const agent of agents) {
    if (isAgentBusy(agent.backendState, agent.isTyping)) count += 1;
  }
  return count;
}

/**
 * Coffee breaks.
 *
 * A worker who sits at the desk without typing for a while (the agent is
 * thinking, not using tools) gets up, walks to the coffee machine or the
 * water cooler, stays a moment and walks back. Work always wins: typing or
 * a permission prompt for the user sends the worker straight back. Only workers in the "idle" (at desk)
 * phase take breaks; any other phase (leaving, reporting) drops the break and
 * the agent state machine takes over the walking.
 *
 * Pure: the planner gets the time and the agents, and returns walk commands.
 */

import type { AgentPhase } from "@/stores/slices/types";
import type { AgentState, Position } from "@/types";

/** Not typing at the desk this long → coffee break. */
export const COFFEE_IDLE_MS = 45_000;
/** Time spent at the coffee machine. */
export const COFFEE_STAY_MS = 7_000;
/** Minimum time at the desk between two breaks. */
export const COFFEE_COOLDOWN_MS = 120_000;
/** Re-send a walk command that didn't start a path after this long. */
const RETRY_MS = 1_500;
const NEAR_PX = 6;

/**
 * Floor spots in front of the coffee machine and the water cooler (feet
 * positions; both machines stand against the top wall).
 */
export const COFFEE_SPOTS: readonly Position[] = [
  { x: 1081, y: 272 },
  { x: 1010, y: 272 },
];

export interface CoffeeAgent {
  id: string;
  phase: AgentPhase;
  position: Position;
  /** Seat position at the assigned desk, null if none. */
  desk: Position | null;
  hasPath: boolean;
  isTyping: boolean;
  backendState: AgentState;
}

export interface CoffeeCommand {
  agentId: string;
  target: Position;
}

type Stage = "desk" | "going" | "at_coffee" | "returning";

interface BreakRecord {
  stage: Stage;
  lastTypingAt: number;
  cooldownUntil: number;
  spot: number;
  since: number;
  commandAt: number;
}

function near(a: Position, b: Position): boolean {
  return Math.abs(a.x - b.x) <= NEAR_PX && Math.abs(a.y - b.y) <= NEAR_PX;
}

/** Whether a position is one of the coffee spots. */
export function isAtCoffeeSpot(position: Position): boolean {
  return COFFEE_SPOTS.some((spot) => near(spot, position));
}

export class CoffeeBreakPlanner {
  private records = new Map<string, BreakRecord>();

  /** Advance to `now` and return the walks to start. */
  update(now: number, agents: CoffeeAgent[]): CoffeeCommand[] {
    const commands: CoffeeCommand[] = [];
    const seen = new Set<string>();

    for (const agent of agents) {
      if (agent.phase !== "idle" || !agent.desk) continue;
      seen.add(agent.id);

      let rec = this.records.get(agent.id);
      if (!rec) {
        rec = {
          stage: "desk",
          lastTypingAt: now,
          cooldownUntil: 0,
          spot: -1,
          since: now,
          commandAt: now,
        };
        this.records.set(agent.id, rec);
      }
      // Work wins over coffee: typing, or the user being asked to approve
      // something (the worker must be at the desk for that)
      // Finished agents rest at their desks (asleep), never at the machine
      const working =
        agent.isTyping ||
        agent.backendState === "waiting_permission" ||
        agent.backendState === "resting";
      if (working) rec.lastTypingAt = now;

      const goDesk = () => {
        rec.stage = "returning";
        rec.commandAt = now;
        commands.push({ agentId: agent.id, target: agent.desk! });
      };

      switch (rec.stage) {
        case "desk": {
          if (
            agent.hasPath ||
            working ||
            !near(agent.position, agent.desk) ||
            now - rec.lastTypingAt < COFFEE_IDLE_MS ||
            now < rec.cooldownUntil
          ) {
            break;
          }
          const spot = this.freeSpot();
          if (spot < 0) break;
          rec.stage = "going";
          rec.spot = spot;
          rec.commandAt = now;
          commands.push({ agentId: agent.id, target: COFFEE_SPOTS[spot] });
          break;
        }
        case "going":
          if (working) goDesk();
          else if (!agent.hasPath) {
            if (near(agent.position, COFFEE_SPOTS[rec.spot])) {
              rec.stage = "at_coffee";
              rec.since = now;
            } else if (now - rec.commandAt >= RETRY_MS) {
              // No way to the machine: give up and sit back down
              goDesk();
            }
          }
          break;
        case "at_coffee":
          if (working || now - rec.since >= COFFEE_STAY_MS) goDesk();
          break;
        case "returning":
          if (agent.hasPath) break;
          if (near(agent.position, agent.desk)) {
            rec.stage = "desk";
            rec.spot = -1;
            rec.cooldownUntil = now + COFFEE_COOLDOWN_MS;
            rec.lastTypingAt = now;
          } else if (now - rec.commandAt >= RETRY_MS) {
            goDesk();
          }
          break;
      }
    }

    for (const id of this.records.keys()) {
      if (!seen.has(id)) this.records.delete(id);
    }
    return commands;
  }

  private freeSpot(): number {
    const taken = new Set(
      [...this.records.values()]
        .filter((r) => r.stage === "going" || r.stage === "at_coffee")
        .map((r) => r.spot),
    );
    return COFFEE_SPOTS.findIndex((_, i) => !taken.has(i));
  }
}

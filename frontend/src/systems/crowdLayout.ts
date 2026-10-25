/**
 * Crowd layout for the office scene: render-only offsets so people never
 * stand inside each other, and lifts so their name tags never overlap.
 * Logical positions (pathfinding, queues, arrival checks) are not touched.
 */

import type { AgentAnimationState } from "@/stores/slices/types";
import type { Position } from "@/types";
import { nameTagWidth, NAME_TAG_HEIGHT } from "@/components/game/NameTag";
import { separationOffsets, stackLabels } from "./personMotion";
import { getDeskPosition, isInElevatorZone } from "./queuePositions";

/** Shared "no nudge" offset, so memoized sprites of still people don't re-render. */
const NO_OFFSET: Position = Object.freeze({ x: 0, y: 0 });

/** Name tag center above the feet (matches AgentLabel). */
const LABEL_Y = -72;

type CrowdAgent = Pick<
  AgentAnimationState,
  "id" | "name" | "phase" | "desk" | "currentPosition"
>;

function seatedAtDesk(agent: CrowdAgent): boolean {
  if (agent.phase !== "idle" || !agent.desk) return false;
  const seat = getDeskPosition(agent.desk);
  return (
    Math.abs(seat.x - agent.currentPosition.x) <= 6 &&
    Math.abs(seat.y - agent.currentPosition.y) <= 6
  );
}

export interface CrowdLayout {
  /** Render nudge per agent on the floor. */
  crowdOffsets: Map<string, Position>;
  /** Vertical lift (<= 0) of each name tag. */
  labelLifts: Map<string, number>;
  /** Where each name tag's owner is drawn: nudged position plus the lift. */
  labelPositions: Map<string, Position>;
}

export function computeCrowdLayout(
  agents: Map<string, CrowdAgent>,
): CrowdLayout {
  const onFloor = [...agents.values()].filter(
    (a) => !isInElevatorZone(a.currentPosition),
  );
  const rawOffsets = separationOffsets(
    onFloor.map((a) => ({
      id: a.id,
      x: a.currentPosition.x,
      y: a.currentPosition.y,
      fixed: seatedAtDesk(a),
    })),
  );
  const crowdOffsets = new Map<string, Position>();
  for (const [id, offset] of rawOffsets) {
    crowdOffsets.set(id, offset.x === 0 && offset.y === 0 ? NO_OFFSET : offset);
  }
  const labelLifts = stackLabels(
    onFloor
      .filter((a) => a.name)
      .map((a) => {
        const offset = crowdOffsets.get(a.id) ?? { x: 0, y: 0 };
        return {
          id: a.id,
          x: a.currentPosition.x + offset.x,
          y: a.currentPosition.y + offset.y + LABEL_Y,
          width: nameTagWidth(a.name!),
        };
      }),
    NAME_TAG_HEIGHT,
  );
  const labelPositions = new Map<string, Position>();
  for (const a of onFloor) {
    labelPositions.set(
      a.id,
      displayPosition(
        a.id,
        a.currentPosition,
        crowdOffsets,
        labelLifts.get(a.id) ?? 0,
      ),
    );
  }
  return { crowdOffsets, labelLifts, labelPositions };
}

function samePosition(a: Position | undefined, b: Position): boolean {
  return a !== undefined && a.x === b.x && a.y === b.y;
}

/** Keep the previous object for every id whose value didn't change. */
function reuse(
  next: Map<string, Position>,
  previous: Map<string, Position>,
): Map<string, Position> {
  const out = new Map<string, Position>();
  for (const [id, value] of next) {
    const old = previous.get(id);
    out.set(id, samePosition(old, value) ? old! : value);
  }
  return out;
}

/**
 * {@link computeCrowdLayout} that hands back the same position objects as
 * last time when nothing changed, so memoized sprites and labels of people
 * who stand still don't re-render every frame.
 */
export class CrowdLayoutCache {
  private last: CrowdLayout | null = null;

  compute(agents: Map<string, CrowdAgent>): CrowdLayout {
    const next = computeCrowdLayout(agents);
    if (this.last) {
      next.crowdOffsets = reuse(next.crowdOffsets, this.last.crowdOffsets);
      next.labelPositions = reuse(
        next.labelPositions,
        this.last.labelPositions,
      );
    }
    this.last = next;
    return next;
  }
}

/** Logical position plus the crowd offset and a vertical lift. */
export function displayPosition(
  id: string,
  position: Position,
  offsets: Map<string, Position>,
  lift: number,
): Position {
  const offset = offsets.get(id);
  return {
    x: position.x + (offset?.x ?? 0),
    y: position.y + (offset?.y ?? 0) + lift,
  };
}

/**
 * Event log quick filter: text search, one person (all / boss / an agent)
 * and kinds (tools / errors / permissions). Agent ids are shown as names.
 */

import type { AgentLifespan } from "@/types";
import { personKey } from "@/utils/agentActivity";

export type EventKind = "tools" | "errors" | "permissions" | "other";

/** The kinds that have a filter chip, in chip order. */
export const FILTER_KINDS = ["tools", "errors", "permissions"] as const;

interface FilterableEvent {
  type: string;
  agentId?: string | null;
  summary: string;
  detail?: { toolName?: string; errorType?: string } | null;
}

export interface EventFilter {
  query: string;
  /** "all", "boss" or an agent id. */
  person: string;
  /** Empty = every kind. */
  kinds: ReadonlySet<string>;
}

/** Which chip an event belongs to. A failed tool counts as an error. */
export function eventKind(event: FilterableEvent): EventKind {
  if (event.type === "error" || event.detail?.errorType) return "errors";
  if (event.type === "permission_request") return "permissions";
  if (event.type === "pre_tool_use" || event.type === "post_tool_use")
    return "tools";
  return "other";
}

/** The name to show for an event's agent id; the boss is "Boss". */
export function personLabel(
  agentId: string | null | undefined,
  names: ReadonlyMap<string, string>,
): string {
  const key = personKey(agentId);
  if (key === "boss") return "Boss";
  return names.get(key) ?? `${key.slice(0, 6)}…`;
}

/** Agent id -> name, from present agents (preferred) and past lifespans. */
export function agentNames(
  agents: Iterable<{ id: string; name: string | null; number: number }>,
  lifespans: readonly AgentLifespan[],
): Map<string, string> {
  const names = new Map<string, string>();
  for (const span of lifespans) {
    if (span.agentName) names.set(span.agentId, span.agentName);
  }
  for (const agent of agents) {
    names.set(agent.id, agent.name ?? `Agent ${agent.number}`);
  }
  return names;
}

/** Agent ids that appear in the log, in order of their first event. */
export function logPeople(log: readonly FilterableEvent[]): string[] {
  const seen = new Set<string>();
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const key = personKey(log[i]?.agentId);
    if (key !== "boss") seen.add(key);
  }
  return [...seen];
}

/** The events that pass the filter, in log order. */
export function filterEvents<T extends FilterableEvent>(
  log: readonly T[],
  filter: EventFilter,
  names: ReadonlyMap<string, string>,
): T[] {
  const query = filter.query.trim().toLowerCase();
  return log.filter((event) => {
    const key = personKey(event.agentId);
    if (filter.person !== "all" && key !== filter.person) return false;
    if (filter.kinds.size > 0 && !filter.kinds.has(eventKind(event)))
      return false;
    if (!query) return true;
    const haystack = [
      event.summary,
      event.type.replace(/_/g, " "),
      event.detail?.toolName ?? "",
      personLabel(event.agentId, names),
    ]
      .join("\n")
      .toLowerCase();
    return haystack.includes(query);
  });
}

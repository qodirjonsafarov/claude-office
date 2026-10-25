/**
 * Event log rows: the PRE and POST events of one tool call become one row,
 * and texts use names instead of raw ids and envelopes.
 */

import { personKey } from "@/utils/agentActivity";
import { cleanSummary } from "@/utils/promptText";

interface RowEvent {
  id: string;
  type: string;
  agentId?: string | null;
  summary: string;
  detail?: { toolName?: string; agentName?: string } | null;
}

export type LogRow<E> =
  | { kind: "tool"; key: string; pre: E | null; post: E | null }
  | { kind: "event"; key: string; event: E };

/**
 * Rows for a newest-first log. A post waits for the older pre of the same
 * person (same tool name preferred; posts without a name take any); a pre
 * with no post is a call still running.
 */
export function groupToolCalls<E extends RowEvent>(
  log: readonly E[],
): LogRow<E>[] {
  const rows: LogRow<E>[] = [];
  // Per person: tool rows that have a post but no pre yet, oldest first.
  const open = new Map<string, Extract<LogRow<E>, { kind: "tool" }>[]>();

  for (const event of log) {
    if (event.type === "post_tool_use") {
      const row = {
        kind: "tool" as const,
        key: event.id,
        pre: null,
        post: event,
      };
      rows.push(row);
      const person = personKey(event.agentId);
      open.set(person, [...(open.get(person) ?? []), row]);
      continue;
    }
    if (event.type === "pre_tool_use") {
      const person = personKey(event.agentId);
      const waiting = open.get(person) ?? [];
      const name = event.detail?.toolName;
      let index = waiting.findIndex((r) => r.post?.detail?.toolName === name);
      if (index === -1)
        index = waiting.findIndex((r) => !r.post?.detail?.toolName);
      const match = index === -1 ? undefined : waiting[index];
      if (match) {
        match.pre = event;
        waiting.splice(index, 1);
      } else {
        rows.push({ kind: "tool", key: event.id, pre: event, post: null });
      }
      continue;
    }
    rows.push({ kind: "event", key: event.id, event });
  }
  return rows;
}

/** The text of a non-tool row. */
export function eventText(event: Omit<RowEvent, "id">): string {
  if (event.type === "subagent_stop") {
    const failed = /with errors/.test(event.summary);
    const name = event.detail?.agentName;
    if (name)
      return failed ? `${name} finished with errors` : `${name} finished`;
    if (/^Subagent \S+ finished/.test(event.summary)) {
      return failed ? "An agent finished with errors" : "An agent finished";
    }
    return event.summary;
  }
  if (event.type === "user_prompt_submit") return cleanSummary(event.summary);
  return event.summary;
}

import type { EventLogEntry } from "@/stores/gameStore";

/** The event as indented JSON, for the "Copy JSON" button. */
export function eventJson(event: EventLogEntry): string {
  return JSON.stringify(
    {
      type: event.type,
      agentId: event.agentId ?? null,
      timestamp: event.timestamp.toISOString(),
      summary: event.summary,
      detail: event.detail ?? {},
    },
    null,
    2,
  );
}

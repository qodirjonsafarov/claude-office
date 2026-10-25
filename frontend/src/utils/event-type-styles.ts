/**
 * Centralized event type styling configuration.
 *
 * Single source of truth for event type colors and badge classes.
 * Adding a new event type only requires adding one entry to EVENT_TYPE_STYLES.
 */

interface EventTypeStyle {
  text: string;
  badge: string;
}

// Olymp tones only (styles/tokens.css): accent = done/ok, info = flow,
// warn = tool in flight, max (gold) = needs the user, danger = failure.
const DEFAULT_STYLES: EventTypeStyle = {
  text: "text-ink-faint",
  badge: "bg-panel-3 text-ink-soft border-transparent",
};

const EVENT_TYPE_STYLES: Record<string, EventTypeStyle> = {
  pre_tool_use: {
    text: "text-warn",
    badge: "bg-warn-dim text-warn border-transparent",
  },
  post_tool_use: {
    text: "text-accent",
    badge: "bg-accent-dim text-accent border-transparent",
  },
  user_prompt_submit: {
    text: "text-info",
    badge: "bg-info-dim text-info border-transparent",
  },
  permission_request: {
    text: "text-max",
    badge: "bg-max-dim text-max border-transparent",
  },
  subagent_start: {
    text: "text-info",
    badge: "bg-info-dim text-info border-transparent",
  },
  subagent_stop: {
    text: "text-accent",
    badge: "bg-accent-dim text-accent border-transparent",
  },
  session_start: {
    text: "text-accent",
    badge: "bg-accent-dim text-accent border-transparent",
  },
  session_end: DEFAULT_STYLES,
  stop: {
    text: "text-accent",
    badge: "bg-accent-dim text-accent border-transparent",
  },
  error: {
    text: "text-danger",
    badge: "bg-danger-dim text-danger border-transparent",
  },
  background_task_notification: {
    text: "text-info",
    badge: "bg-info-dim text-info border-transparent",
  },
};

/**
 * Get the text color class for an event type.
 * @param type - The event type string
 * @returns Tailwind text color class
 */
export function getEventTypeTextColor(type: string): string {
  return (EVENT_TYPE_STYLES[type] ?? DEFAULT_STYLES).text;
}

/**
 * Get the badge classes for an event type.
 * @param type - The event type string
 * @returns Tailwind classes for badge styling (bg, text, border)
 */
export function getEventTypeBadgeClasses(type: string): string {
  return (EVENT_TYPE_STYLES[type] ?? DEFAULT_STYLES).badge;
}

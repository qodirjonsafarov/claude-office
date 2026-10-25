/**
 * Scene signals: per-person facts from the event log, and the mood a
 * character shows in the office.
 *
 * - last activity (for falling asleep after 5 quiet minutes),
 * - last failed tool call (red x bubble + a short shake),
 * - the current tool, sorted into kinds (pose, monitor glow, bubble icon).
 *
 * Moods, strongest first: needs_you (waiting for the user's permission) >
 * error > sleeping (resting after a task, or quiet for 5 min) > normal.
 * Pure TS.
 */

/** Kinds of tools the scene draws differently. */
export type ToolKind = "read" | "edit" | "terminal" | "web" | "task" | "other";
/** Icons in bubbles: the tool kinds plus states. */
export type IconKind = Exclude<ToolKind, "other"> | "error" | "done";

export type Mood = "needs_you" | "error" | "sleeping" | "normal";

/** How long a failure stays visible on the character. */
export const ERROR_SHOW_MS = 2500;
/** Quiet this long → the character dozes off. */
export const SLEEP_AFTER_MS = 5 * 60_000;

const READ_TOOLS = new Set(["Read", "Grep", "Glob", "LS", "NotebookRead"]);
const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const WEB_TOOLS = new Set(["WebFetch", "WebSearch"]);
const TASK_TOOLS = new Set(["Task", "Agent", "SendMessage"]);

export function toolKind(name: string | null | undefined): ToolKind {
  if (!name) return "other";
  if (READ_TOOLS.has(name)) return "read";
  if (EDIT_TOOLS.has(name)) return "edit";
  if (name === "Bash" || name === "BashOutput") return "terminal";
  if (WEB_TOOLS.has(name) || /browser|firefox|chrome|playwright/i.test(name)) {
    return "web";
  }
  if (TASK_TOOLS.has(name)) return "task";
  return "other";
}

/** The backend sends tool bubbles with an emoji icon; map it to a kind. */
const ICON_KINDS: Record<string, IconKind> = {
  "📖": "read",
  "🔍": "read",
  "🔎": "read",
  "📄": "read",
  "file-text": "read",
  "📝": "edit",
  "✍️": "edit",
  "✍": "edit",
  "💻": "terminal",
  "🌐": "web",
  "📥": "web",
  "🎯": "task",
  "📋": "task",
  clipboard: "task",
  "✅": "done",
  check: "done",
  "👍": "done",
  "thumbs-up": "done",
  "❌": "error",
};

export function toolKindFromIcon(
  icon: string | null | undefined,
): IconKind | null {
  if (!icon) return null;
  return ICON_KINDS[icon] ?? null;
}

// ============================================================================
// SIGNALS FROM THE EVENT LOG
// ============================================================================

export interface PersonSignals {
  lastEventAt: number | null;
  lastErrorAt: number | null;
  tool: ToolKind;
  /** The latest tool result failed (red tick on the progress badge). */
  failing: boolean;
}

interface LogEvent {
  type: string;
  agentId?: string | null;
  timestamp: Date;
  detail?: { toolName?: string; errorType?: string } | null;
}

/** Events of the main session carry "main" or no agent id: the boss. */
function personKey(agentId: string | null | undefined): string {
  return !agentId || agentId === "main" ? "boss" : agentId;
}

/**
 * Signals per person (agent id, "boss"), plus "*" for the whole office.
 * The event log is newest first.
 */
export function sceneSignals(
  log: Iterable<LogEvent>,
): Map<string, PersonSignals> {
  const out = new Map<string, PersonSignals>();
  const get = (key: string) => {
    let s = out.get(key);
    if (!s) {
      s = {
        lastEventAt: null,
        lastErrorAt: null,
        tool: "other",
        failing: false,
      };
      out.set(key, s);
    }
    return s;
  };
  const toolSeen = new Set<string>();
  const resultSeen = new Set<string>();
  for (const event of log) {
    const at = event.timestamp.getTime();
    const key = personKey(event.agentId);
    for (const s of [get(key), get("*")]) {
      if (s.lastEventAt === null) s.lastEventAt = at;
    }
    const person = get(key);
    const failed =
      event.type === "error" ||
      (event.type === "post_tool_use" && !!event.detail?.errorType);
    if (failed && person.lastErrorAt === null) person.lastErrorAt = at;
    if (event.type === "post_tool_use" && !resultSeen.has(key)) {
      resultSeen.add(key);
      person.failing = !!event.detail?.errorType;
    }
    if (event.type === "pre_tool_use" && !toolSeen.has(key)) {
      toolSeen.add(key);
      person.tool = toolKind(event.detail?.toolName);
    }
  }
  return out;
}

// ============================================================================
// MOOD
// ============================================================================

export interface MoodInput {
  backendState: string;
  now: number;
  lastEventAt: number | null;
  lastErrorAt: number | null;
}

export function characterMood(input: MoodInput): Mood {
  if (input.backendState === "waiting_permission") return "needs_you";
  if (
    input.lastErrorAt !== null &&
    input.now - input.lastErrorAt <= ERROR_SHOW_MS
  ) {
    return "error";
  }
  if (input.backendState === "resting") return "sleeping";
  if (
    input.lastEventAt !== null &&
    input.now - input.lastEventAt >= SLEEP_AFTER_MS
  ) {
    return "sleeping";
  }
  return "normal";
}

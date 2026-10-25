/**
 * "What each agent is doing now": turns raw state (backend state, the latest
 * tool call, optional todo progress) into plain words and a progress-bar
 * model. Pure functions, shared by the desktop agent panel and the phone list.
 */

import type { AgentLifespan } from "@/types";

// ============================================================================
// PROGRESS
// ============================================================================

/** Work progress from the person's own todo list or Task* tools (backend). */
export interface AgentProgress {
  done: number;
  total: number;
  current: string | null;
  source: "todos" | "tasks";
}

/** Read the optional backend `progress` field; null when absent or empty. */
export function parseProgress(raw: unknown): AgentProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const { done, total } = r;
  if (typeof done !== "number" || typeof total !== "number") return null;
  if (!Number.isFinite(done) || !Number.isFinite(total) || total <= 0)
    return null;
  return {
    done: Math.max(0, Math.min(done, total)),
    total,
    current:
      typeof r.current === "string" && r.current.trim() ? r.current : null,
    source: r.source === "tasks" ? "tasks" : "todos",
  };
}

/** True when two progress values would draw the same bar. */
export function sameProgress(
  a: AgentProgress | null,
  b: AgentProgress | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.done === b.done &&
    a.total === b.total &&
    a.current === b.current &&
    a.source === b.source
  );
}

/** What the progress bar under a row shows. */
export type ProgressView =
  | { kind: "bar"; percent: number; label: string } // real numbers
  | { kind: "busy" } // working, no numbers: striped "working" pulse
  | { kind: "wait" } // waiting for the user's permission
  | { kind: "none" }; // idle, nothing to show

const BUSY_STATES = new Set([
  "working",
  "thinking",
  "delegating",
  "receiving",
  "reviewing",
  "completing",
  "on_phone",
  "phone_ringing",
]);

/**
 * The bar for one person. A number is shown only when the backend sent real
 * progress; otherwise a busy person gets the indeterminate pulse.
 */
export function progressView(
  progress: AgentProgress | null,
  state: string,
  action: string,
  isTyping = false,
): ProgressView {
  if (state === "waiting_permission") return { kind: "wait" };
  if (progress) {
    return {
      kind: "bar",
      percent: Math.round((progress.done / progress.total) * 100),
      label: `${progress.current ?? action} · ${progress.done}/${progress.total}`,
    };
  }
  if (isTyping || BUSY_STATES.has(state)) return { kind: "busy" };
  return { kind: "none" };
}

// ============================================================================
// ACTIONS
// ============================================================================

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
}

function baseName(path: unknown): string | null {
  if (typeof path !== "string" || !path) return null;
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || null;
}

function describeCommand(command: unknown): string {
  if (typeof command !== "string" || !command.trim())
    return "Running a command";
  const cmd = command.toLowerCase();
  if (/\b(test|tests|pytest|vitest|jest|playwright)\b/.test(cmd))
    return "Running tests";
  if (/\b(typecheck|tsc|mypy|pyright)\b/.test(cmd)) return "Checking types";
  if (/\b(lint|eslint|ruff|prettier)\b/.test(cmd)) return "Linting";
  if (/\b(build|compile)\b/.test(cmd)) return "Building";
  if (/\b(install|add)\b/.test(cmd) && /\b(npm|pnpm|yarn|uv|pip)\b/.test(cmd))
    return "Installing packages";
  // The program of the last command in a chain ("cd x && git status" -> git).
  const last = command.split(/&&|\|\||;|\|/).pop() ?? command;
  const program = last.trim().split(/\s+/)[0] ?? "";
  if (program === "git" || /\bgit\b/.test(cmd)) return "Using git";
  return program ? `Running ${program}` : "Running a command";
}

/** One tool call in plain words: "Editing api.ts", "Running tests". */
export function describeTool(
  name: string,
  input: Record<string, unknown> = {},
): string {
  const file = baseName(input.file_path ?? input.notebook_path ?? input.path);
  switch (name) {
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return file ? `Editing ${file}` : "Editing";
    case "Write":
      return file ? `Writing ${file}` : "Writing";
    case "Read":
      return file ? `Reading ${file}` : "Reading";
    case "Bash":
      return describeCommand(input.command);
    case "Grep":
    case "Glob":
      return "Searching code";
    case "WebSearch":
    case "WebFetch":
      return "Searching the web";
    case "Task":
    case "Agent":
      return "Delegating";
    case "TodoWrite":
    case "TaskCreate":
    case "TaskUpdate":
      return "Planning";
    default:
      return `Using ${name}`;
  }
}

const STATE_ACTIONS: Record<string, string> = {
  thinking: "Thinking",
  arriving: "Arriving",
  walking_to_desk: "Walking to desk",
  reporting: "Reporting back",
  reporting_done: "Done",
  completed: "Done",
  waiting: "Waiting",
  leaving: "Leaving",
  in_elevator: "Leaving",
  idle: "Idle",
  phone_ringing: "Getting a task",
  on_phone: "Getting a task",
  receiving: "Getting a task",
  delegating: "Delegating",
  reviewing: "Reviewing",
  completing: "Wrapping up",
};

/** A person's action now, in plain words. */
export function describeAction(input: {
  state: string;
  isTyping: boolean;
  tool: ToolCall | null;
}): string {
  const { state, isTyping, tool } = input;
  if (state === "waiting_permission") return "Waiting for permission";
  if (state === "working" || isTyping) {
    return tool ? describeTool(tool.name, tool.input) : "Working";
  }
  return STATE_ACTIONS[state] ?? "Working";
}

// ============================================================================
// EVENT LOG DERIVATIONS
// ============================================================================

interface LogEvent {
  type: string;
  agentId?: string | null;
  detail?: { toolName?: string; toolInput?: Record<string, unknown> } | null;
}

/** Events from the main session carry "main" or no agent id: the boss. */
export function personKey(agentId: string | null | undefined): string {
  return !agentId || agentId === "main" ? "boss" : agentId;
}

/** How many tools each person called (keyed by agent id, the boss = "boss"). */
export function toolCountsByAgent(
  log: Iterable<LogEvent>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of log) {
    if (event.type !== "pre_tool_use") continue;
    const key = personKey(event.agentId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Each person's latest tool call (the log is newest first). */
export function lastToolByAgent(
  log: Iterable<LogEvent>,
): Map<string, ToolCall> {
  const last = new Map<string, ToolCall>();
  for (const event of log) {
    if (event.type !== "pre_tool_use") continue;
    const name = event.detail?.toolName;
    if (!name) continue;
    const key = personKey(event.agentId);
    if (!last.has(key)) {
      last.set(key, { name, input: event.detail?.toolInput ?? {} });
    }
  }
  return last;
}

/** When each agent started (ms since epoch), from whiteboard lifespans. */
export function agentRunTimes(
  lifespans: readonly AgentLifespan[],
): Map<string, number> {
  const starts = new Map<string, number>();
  for (const span of lifespans) {
    const start = Date.parse(span.startTime);
    if (!Number.isNaN(start)) starts.set(span.agentId, start);
  }
  return starts;
}

/** A short duration: "35s", "4m", "1h 5m". */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

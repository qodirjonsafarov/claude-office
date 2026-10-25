/**
 * Tool names people can read, for the event log and the team list:
 * `mcp__claude-in-chrome__computer` + left_click -> "Browser · click",
 * Bash -> "Terminal", Read -> "Read file". The backend uses the same words
 * in the office bubbles (app/core/tool_names.py).
 */

const BUILT_IN: Record<string, string> = {
  Bash: "Terminal",
  BashOutput: "Terminal output",
  KillShell: "Stop terminal",
  Read: "Read file",
  Write: "Write file",
  Edit: "Edit file",
  MultiEdit: "Edit file",
  NotebookEdit: "Edit notebook",
  Grep: "Search code",
  Glob: "Find files",
  WebFetch: "Web page",
  WebSearch: "Web search",
  Task: "Delegate",
  Agent: "Delegate",
  TodoWrite: "Plan",
  TaskCreate: "Plan",
  TaskUpdate: "Plan",
};

/** MCP servers with a short everyday name. */
const SERVERS: Record<string, string> = {
  "claude-in-chrome": "Browser",
  playwright: "Browser",
  "firefox-devtools": "Firefox",
};

/** The browser "computer" tool's actions, in a word. */
const COMPUTER_ACTIONS: Record<string, string> = {
  left_click: "click",
  right_click: "right click",
  double_click: "double click",
  triple_click: "triple click",
  left_click_drag: "drag",
  mouse_move: "hover",
  hover: "hover",
  scroll_to: "scroll",
};

function words(raw: string): string {
  return raw
    .replace(/_(mcp|tool)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A readable name for a tool call. */
export function friendlyToolName(
  name: string,
  input: Record<string, unknown> = {},
): string {
  const builtIn = BUILT_IN[name];
  if (builtIn) return builtIn;
  const mcp = /^mcp__(.+?)__(.+)$/.exec(name);
  if (!mcp) return name;
  const server = mcp[1] ?? "";
  const tool = mcp[2] ?? "";
  const serverName =
    SERVERS[server] ?? capitalize(words(server.replace(/^claude_ai_/, "")));
  let action = words(tool);
  if (tool === "computer" && typeof input.action === "string") {
    action = COMPUTER_ACTIONS[input.action] ?? words(input.action);
  }
  return `${serverName} · ${action}`;
}

function baseName(path: unknown): string | null {
  if (typeof path !== "string" || !path) return null;
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || null;
}

const MAX_TARGET = 40;

function shorten(text: string): string {
  return text.length > MAX_TARGET ? `${text.slice(0, MAX_TARGET - 1)}…` : text;
}

/** What the call works on: a file name, the command, a pattern or a host. */
function target(name: string, input: Record<string, unknown>): string | null {
  const file = baseName(input.file_path ?? input.notebook_path);
  if (file) return file;
  if (name === "Bash" && typeof input.command === "string") {
    const first = input.command.trim().split("\n")[0] ?? "";
    const last =
      first
        .split(/&&|\|\||;/)
        .pop()
        ?.trim() ?? first;
    return last ? shorten(last) : null;
  }
  if ((name === "Grep" || name === "Glob") && typeof input.pattern === "string")
    return shorten(input.pattern);
  if (typeof input.url === "string") {
    try {
      return new URL(input.url).host;
    } catch {
      return shorten(input.url);
    }
  }
  return null;
}

/** One log row for a tool call: "Read file · page.tsx", "Browser · click". */
export function toolRowText(
  name: string,
  input: Record<string, unknown> = {},
): string {
  const label = friendlyToolName(name, input);
  const what = target(name, input);
  return what ? `${label} · ${what}` : label;
}

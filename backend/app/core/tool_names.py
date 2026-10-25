"""Tool names people can read, for the office bubbles.

``mcp__claude-in-chrome__computer`` + left_click -> "Browser · click",
Bash -> "Terminal", Read -> "Read file". The frontend uses the same words in
the event log and the team list (frontend/src/utils/toolNames.ts).
"""

import re
from typing import Any

_BUILT_IN = {
    "Bash": "Terminal",
    "BashOutput": "Terminal output",
    "KillShell": "Stop terminal",
    "Read": "Read file",
    "Write": "Write file",
    "Edit": "Edit file",
    "MultiEdit": "Edit file",
    "NotebookEdit": "Edit notebook",
    "Grep": "Search code",
    "Glob": "Find files",
    "WebFetch": "Web page",
    "WebSearch": "Web search",
    "Task": "Delegate",
    "Agent": "Delegate",
    "TodoWrite": "Plan",
    "TaskCreate": "Plan",
    "TaskUpdate": "Plan",
}

_SERVERS = {
    "claude-in-chrome": "Browser",
    "playwright": "Browser",
    "firefox-devtools": "Firefox",
}

_COMPUTER_ACTIONS = {
    "left_click": "click",
    "right_click": "right click",
    "double_click": "double click",
    "triple_click": "triple click",
    "left_click_drag": "drag",
    "mouse_move": "hover",
    "hover": "hover",
    "scroll_to": "scroll",
}

_MCP = re.compile(r"^mcp__(.+?)__(.+)$")


def _words(raw: str) -> str:
    raw = re.sub(r"_(mcp|tool)$", "", raw, flags=re.IGNORECASE)
    return re.sub(r"[_-]+", " ", raw).strip()


def friendly_tool_name(name: str, tool_input: dict[str, Any] | None = None) -> str:
    """A readable name for a tool call."""
    if name in _BUILT_IN:
        return _BUILT_IN[name]
    match = _MCP.match(name)
    if not match:
        return name
    server, tool = match.group(1), match.group(2)
    server_name = _SERVERS.get(server)
    if server_name is None:
        words = _words(re.sub(r"^claude_ai_", "", server))
        server_name = words[:1].upper() + words[1:]
    action = _words(tool)
    act = (tool_input or {}).get("action")
    if tool == "computer" and isinstance(act, str):
        action = _COMPUTER_ACTIONS.get(act, _words(act))
    return f"{server_name} · {action}"

"""Bubbles show tool names people can read ("Browser · click")."""

from datetime import UTC, datetime
from typing import Any

from app.core.state_machine import StateMachine
from app.core.tool_names import friendly_tool_name
from app.models.events import EventAdapter, EventType, ToolEvent


def _tool(name: str, tool_input: dict[str, Any] | None = None) -> ToolEvent:
    event = EventAdapter.validate_python(
        {
            "event_type": EventType.PRE_TOOL_USE,
            "session_id": "s1",
            "timestamp": datetime.now(UTC),
            "data": {"tool_name": name, "tool_input": tool_input or {}},
        }
    )
    assert isinstance(event, ToolEvent)
    return event


def test_browser_computer_action() -> None:
    assert friendly_tool_name("mcp__claude-in-chrome__computer", {"action": "left_click"}) == (
        "Browser · click"
    )


def test_other_mcp_tools() -> None:
    assert friendly_tool_name("mcp__claude-in-chrome__tabs_close_mcp") == "Browser · tabs close"
    assert friendly_tool_name("mcp__my-server__do_thing") == "My server · do thing"


def test_built_in_and_unknown() -> None:
    assert friendly_tool_name("Bash") == "Terminal"
    assert friendly_tool_name("Read") == "Read file"
    assert friendly_tool_name("Skill") == "Skill"


def test_bubble_uses_the_friendly_name() -> None:
    bubble = StateMachine().tool_to_thought(
        _tool("mcp__claude-in-chrome__computer", {"action": "screenshot"})
    )
    assert bubble.text == "Browser · screenshot"

"""Event log entries show names, not raw ids or XML-like envelopes.

- A native SubagentStop (only a native id) is attributed to the agent and
  says "<name> finished".
- A "user" prompt that is an ``<agent-message from=…>`` envelope reads
  "Message from <name>"; other envelopes become a few words.
- History restored from the DB keeps the detail (tool name and input).
"""

# pyright: reportPrivateUsage=false

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import pytest

from app.core.event_processor import EventProcessor, history_entry
from app.core.prompt_envelope import describe_envelope
from app.core.state_machine import StateMachine
from app.db.database import AsyncSessionLocal
from app.db.models import EventRecord
from app.models.agents import Agent, AgentState
from app.models.events import AnyEvent, EventAdapter, EventType


def _event(event_type: EventType, data: dict[str, Any], session_id: str = "s1") -> AnyEvent:
    return EventAdapter.validate_python(
        {
            "event_type": event_type,
            "session_id": session_id,
            "timestamp": datetime.now(UTC),
            "data": data,
        }
    )


def _office_with_validator() -> StateMachine:
    sm = StateMachine()
    sm.agents["subagent_toolu_1"] = Agent(
        id="subagent_toolu_1",
        native_id="a3eaf1712ac2be39c",
        name="Validator V",
        color="#fff",
        number=1,
        state=AgentState.WORKING,
        current_task="Check the office live",
    )
    return sm


class TestDescribeEnvelope:
    def test_agent_message_names_the_sender(self) -> None:
        names = {"a3eaf17": "Validator V"}
        text = describe_envelope('<agent-message from="a3eaf17">\n[Subag...', names.get)
        assert text == "Message from Validator V"

    def test_unknown_sender(self) -> None:
        assert describe_envelope('<agent-message from="zz">', lambda _: None) == (
            "Message from an agent"
        )

    def test_task_notification(self) -> None:
        assert describe_envelope("<task-notification>\n<id>1</id>") == "Task notification"

    def test_plain_prompt_is_not_an_envelope(self) -> None:
        assert describe_envelope("Fix <b> in page.tsx") is None


class TestHistoryEntry:
    def test_native_subagent_stop_is_named(self) -> None:
        sm = _office_with_validator()
        event = _event(EventType.SUBAGENT_STOP, {"native_agent_id": "a3eaf1712ac2be39c"})
        entry = history_entry(sm, event, "Subagent subagent_a3eaf17 finished successfully")
        assert entry["agentId"] == "subagent_toolu_1"
        assert entry["summary"] == "Validator V finished"
        assert entry["detail"]["agentName"] == "Validator V"
        assert entry["detail"]["taskDescription"] == "Check the office live"

    def test_agent_message_prompt_is_summarised(self) -> None:
        sm = _office_with_validator()
        event = _event(
            EventType.USER_PROMPT_SUBMIT,
            {"prompt": '<agent-message from="a3eaf1712ac2be39c">\n[Subag...'},
        )
        entry = history_entry(sm, event, 'User: <agent-message from="a3eaf…')
        assert entry["summary"] == "Message from Validator V"
        assert entry["agentId"] == "main"

    def test_tool_event_keeps_detail(self) -> None:
        event = _event(
            EventType.PRE_TOOL_USE, {"tool_name": "Bash", "tool_input": {"command": "ls"}}
        )
        entry = history_entry(StateMachine(), event, "Using Bash ls")
        assert entry["detail"] == {"toolName": "Bash", "toolInput": {"command": "ls"}}
        assert entry["summary"] == "Using Bash ls"


class TestBossTask:
    def test_envelope_prompt_does_not_become_the_boss_task(self) -> None:
        sm = _office_with_validator()
        sm.transition(
            _event(
                EventType.USER_PROMPT_SUBMIT,
                {"prompt": '<agent-message from="a3eaf1712ac2be39c">\n[Subag...'},
            )
        )
        assert sm.boss_current_task == "Message from Validator V"
        assert sm.boss_bubble is not None
        assert sm.boss_bubble.text == "Message from Validator V"


@pytest.mark.asyncio
async def test_restored_history_keeps_tool_detail() -> None:
    sid = f"restore-{uuid4().hex[:8]}"
    async with AsyncSessionLocal() as db:
        db.add(
            EventRecord(
                session_id=sid,
                timestamp=datetime.now(UTC),
                event_type="pre_tool_use",
                data={"tool_name": "Read", "tool_input": {"file_path": "/a/b.py"}},
            )
        )
        await db.commit()
    sm = await EventProcessor()._build_restored_state_machine(sid)
    assert sm is not None
    assert sm.history[-1]["detail"]["toolName"] == "Read"

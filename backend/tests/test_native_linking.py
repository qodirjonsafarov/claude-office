"""SUBAGENT_INFO links its native agent id to the right character.

Claude Code writes ``subagents/agent-<native>.meta.json`` with the
``toolUseId`` of the Agent/Task call that started it, and our characters are
``subagent_<toolUseId>``. Linking by "the first agent without a native id"
picked the wrong one when several agents started close together, so the
transcript poller fed another character and the real one stayed "walking to
desk" in the arrival queue forever (live QA, wave 2).
"""

import json
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

import pytest

from app.core.handlers.agent_handler import handle_subagent_info
from app.core.state_machine import StateMachine
from app.models.agents import AgentState
from app.models.events import AgentEvent, AgentEventData, EventType, ToolEvent, ToolEventData

SESSION = "s1"


@pytest.fixture
def subagents_dir(tmp_path: Path) -> Iterator[Path]:
    d = tmp_path / ".claude" / "projects" / "p" / SESSION / "subagents"
    d.mkdir(parents=True)
    with patch.object(Path, "home", return_value=tmp_path):
        yield d


def start(sm: StateMachine, tool_use_id: str, agent_type: str) -> str:
    agent_id = f"subagent_{tool_use_id}"
    sm.transition(
        AgentEvent(
            event_type=EventType.SUBAGENT_START,
            session_id=SESSION,
            timestamp=datetime.now(UTC),
            data=AgentEventData(agent_id=agent_id, agent_type=agent_type, tool_use_id=tool_use_id),
        )
    )
    return agent_id


def info_event(native: str, transcript: Path, agent_type: str = "qa") -> AgentEvent:
    return AgentEvent(
        event_type=EventType.SUBAGENT_INFO,
        session_id=SESSION,
        timestamp=datetime.now(UTC),
        data=AgentEventData(
            native_agent_id=native, agent_type=agent_type, agent_transcript_path=str(transcript)
        ),
    )


def write_agent(d: Path, native: str, tool_use_id: str) -> Path:
    transcript = d / f"agent-{native}.jsonl"
    transcript.write_text("{}\n")
    (d / f"agent-{native}.meta.json").write_text(
        json.dumps({"agentType": "qa", "toolUseId": tool_use_id})
    )
    return transcript


def test_info_links_the_agent_started_by_that_tool_call(subagents_dir: Path) -> None:
    sm = StateMachine()
    first = start(sm, "toolu_A", "qa")
    second = start(sm, "toolu_B", "qa")
    transcript = write_agent(subagents_dir, "nB", "toolu_B")

    sm.transition(info_event("nB", transcript))

    assert sm.agents[second].native_id == "nB"
    assert sm.agents[first].native_id is None


def test_without_meta_it_prefers_an_unlinked_agent_of_the_same_type(subagents_dir: Path) -> None:
    sm = StateMachine()
    start(sm, "toolu_P", "Plan")
    qa = start(sm, "toolu_Q", "qa")
    transcript = subagents_dir / "agent-nQ.jsonl"
    transcript.write_text("{}\n")

    sm.transition(info_event("nQ", transcript, agent_type="qa"))

    assert sm.agents[qa].native_id == "nQ"


@pytest.mark.asyncio
async def test_the_poller_follows_the_linked_agent(subagents_dir: Path) -> None:
    sm = StateMachine()
    start(sm, "toolu_A", "qa")
    second = start(sm, "toolu_B", "qa")
    transcript = write_agent(subagents_dir, "nB", "toolu_B")
    event = info_event("nB", transcript)
    sm.transition(event)
    polled: list[str] = []

    class FakePoller:
        async def is_polling(self, _agent_id: str) -> bool:
            return False

        async def start_polling(self, agent_id: str, _sid: str, _path: str) -> None:
            polled.append(agent_id)

    with (
        patch("app.core.handlers.agent_handler.get_transcript_poller", lambda: FakePoller()),
        patch("app.core.handlers.agent_handler.enrich_agent_from_transcript", _noop),
    ):
        await handle_subagent_info(sm, event, lambda: None)

    assert polled == [second]


async def _noop(*_args: object, **_kwargs: object) -> None:
    return None


def test_the_linked_agent_starts_working_with_its_own_tool_calls(subagents_dir: Path) -> None:
    sm = StateMachine()
    second = start(sm, "toolu_B", "qa")
    transcript = write_agent(subagents_dir, "nB", "toolu_B")
    sm.transition(info_event("nB", transcript))
    sm.transition(
        ToolEvent(
            event_type=EventType.PRE_TOOL_USE,
            session_id=SESSION,
            timestamp=datetime.now(UTC),
            data=ToolEventData(agent_id=second, tool_name="Bash"),
        )
    )

    assert sm.agents[second].state == AgentState.WORKING
    assert second not in sm.arrival_queue

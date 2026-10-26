"""SubagentStop from hidden side-agents (no transcript, never started) is ignored."""

import asyncio
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.core.event_processor import event_processor
from app.core.state_machine import StateMachine
from app.db.database import AsyncSessionLocal
from app.db.models import EventRecord
from app.models.agents import Agent, AgentState
from app.models.events import AnyEvent, EventAdapter, EventType


@pytest.fixture
def subagents_dir(tmp_path: Path) -> Iterator[Path]:
    d = tmp_path / ".claude" / "projects" / "p" / "s1" / "subagents"
    d.mkdir(parents=True)
    with patch.object(Path, "home", return_value=tmp_path):
        yield d


def _native_stop(native_id: str, transcript: Path, session_id: str = "s1") -> AnyEvent:
    return EventAdapter.validate_python(
        {
            "event_type": EventType.SUBAGENT_STOP,
            "session_id": session_id,
            "timestamp": datetime.now(UTC),
            "data": {"native_agent_id": native_id, "agent_transcript_path": str(transcript)},
        }
    )


def _background_agent(sm: StateMachine, agent_id: str = "subagent_toolu_bg") -> None:
    """A background agent spawned via Agent whose SubagentInfo has not arrived yet."""
    sm.agents[agent_id] = Agent(id=agent_id, color="#fff", number=1, state=AgentState.WORKING)
    sm.arrival_queue.append(agent_id)


class TestStateMachine:
    def test_phantom_stop_leaves_background_agent_in_place(self, subagents_dir: Path) -> None:
        sm = StateMachine()
        _background_agent(sm)
        sm.transition(_native_stop("ab99ecb9afdc4eb66", subagents_dir / "agent-ab99.jsonl"))
        agent = sm.agents["subagent_toolu_bg"]
        assert agent.state == AgentState.WORKING
        assert agent.native_id is None

    def test_real_stop_rests_the_linked_agent(self, subagents_dir: Path) -> None:
        sm = StateMachine()
        _background_agent(sm, "subagent_a")
        _background_agent(sm, "subagent_b")
        sm.agents["subagent_b"].native_id = "nb"
        path = subagents_dir / "agent-nb.jsonl"
        path.write_text("{}\n")
        sm.transition(_native_stop("nb", path))
        # Finished agents rest in the office (test_agent_resting.py)
        assert sm.agents["subagent_b"].state == AgentState.RESTING
        assert sm.agents["subagent_a"].state == AgentState.WORKING

    def test_missed_subagent_info_late_links_by_meta(self, subagents_dir: Path) -> None:
        sm = StateMachine()
        _background_agent(sm)
        path = subagents_dir / "agent-n1.jsonl"
        path.write_text("{}\n")
        (subagents_dir / "agent-n1.meta.json").write_text('{"toolUseId": "toolu_bg"}')
        sm.transition(_native_stop("n1", path))
        agent = sm.agents["subagent_toolu_bg"]
        assert agent.native_id == "n1"
        assert agent.state == AgentState.RESTING

    def test_missed_subagent_info_without_meta_rests_nobody(self, subagents_dir: Path) -> None:
        sm = StateMachine()
        _background_agent(sm)
        path = subagents_dir / "agent-n1.jsonl"
        path.write_text("{}\n")
        sm.transition(_native_stop("n1", path))
        agent = sm.agents["subagent_toolu_bg"]
        assert agent.native_id is None
        assert agent.state == AgentState.WORKING


def _send(session_id: str, event_type: EventType, data: dict[str, Any]) -> None:
    event = EventAdapter.validate_python(
        {
            "event_type": event_type,
            "session_id": session_id,
            "timestamp": datetime.now(UTC),
            "data": data,
        }
    )
    asyncio.run(event_processor.process_event(event))


async def _count_events(session_id: str, event_type: str) -> int:
    async with AsyncSessionLocal() as db:
        stmt = select(func.count(EventRecord.id)).where(
            EventRecord.session_id == session_id, EventRecord.event_type == event_type
        )
        return int((await db.execute(stmt)).scalar_one())


class TestEventProcessor:
    def test_phantom_stop_is_not_stored_or_logged(self, subagents_dir: Path) -> None:
        sid = f"test-{uuid4()}"
        _send(sid, EventType.SESSION_START, {})
        _send(
            sid,
            EventType.SUBAGENT_STOP,
            {
                "native_agent_id": "a1401472ee3889dba",
                "agent_transcript_path": str(subagents_dir / "agent-a1401472ee3889dba.jsonl"),
            },
        )
        assert asyncio.run(_count_events(sid, "subagent_stop")) == 0
        sm = event_processor.sessions[sid]
        assert all(h["type"] != "subagent_stop" for h in sm.history)

    def test_real_stop_is_stored(self, subagents_dir: Path) -> None:
        sid = f"test-{uuid4()}"
        path = subagents_dir / "agent-real.jsonl"
        path.write_text("{}\n")
        _send(sid, EventType.SESSION_START, {})
        _send(
            sid,
            EventType.SUBAGENT_STOP,
            {"native_agent_id": "real", "agent_transcript_path": str(path)},
        )
        assert asyncio.run(_count_events(sid, "subagent_stop")) == 1

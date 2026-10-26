"""Proven activity recalls a resting agent; a stop only rests its own agent.

Live bug (2026-10-26): after a backend reload the restore left the "Coder"
working, but its last own event was 19 minutes old and the reload had dropped
its transcript poller, so the quiet sweep rested it. Its next tool calls came
from the hooks with its native id (proof that Claude Code runs that agent right
now), but tool events never woke a resting agent, so it slept while working.

Hook tool calls carry ``native_agent_id``; poller copies do not (and may be a
late read of the last call), so only a native-id match counts as proof.
"""

# pyright: reportPrivateUsage=false

import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Literal
from unittest.mock import patch
from uuid import uuid4

import pytest

from app.core.event_processor import EventProcessor
from app.core.state_machine import StateMachine, accept_tool_event
from app.db.database import AsyncSessionLocal
from app.db.models import EventRecord
from app.models.agents import AgentState
from app.models.events import (
    AgentEvent,
    AgentEventData,
    AnyEvent,
    EventAdapter,
    EventType,
    ToolEvent,
    ToolEventData,
)

T0 = datetime(2026, 10, 26, 15, 13, tzinfo=UTC)
SESSION = "sess-wake"
CODER = "subagent_toolu_FRONT"
N_FRONT = "a4e4d1e1afd61b74c"
N_BACK = "a53a40a3e017a21c9"


def _start(sm: StateMachine, agent_id: str, at: datetime) -> None:
    sm.transition(
        AgentEvent(
            event_type=EventType.SUBAGENT_START,
            session_id=SESSION,
            timestamp=at,
            data=AgentEventData(agent_id=agent_id, agent_name="Coder", agent_type="developer"),
        )
    )


ToolKind = Literal[EventType.PRE_TOOL_USE, EventType.POST_TOOL_USE, EventType.PERMISSION_REQUEST]


def _hook_tool(
    sm: StateMachine,
    kind: ToolKind,
    at: datetime,
    tool_use_id: str,
    native: str | None = N_FRONT,
    agent_id: str = "main",
) -> None:
    """A tool call as the hooks send it: as "main" with the subagent's native id."""
    event = ToolEvent(
        event_type=kind,
        session_id=SESSION,
        timestamp=at,
        data=ToolEventData(
            agent_id=agent_id,
            native_agent_id=native,
            tool_name="Bash",
            tool_input={"command": "ls"},
            tool_use_id=tool_use_id,
        ),
    )
    if accept_tool_event(sm, event):
        sm.transition(event)


def _rested_coder(sm: StateMachine) -> None:
    """Coder worked, went quiet and the sweep rested it (no SUBAGENT_STOP)."""
    _start(sm, CODER, T0)
    sm.agents[CODER].native_id = N_FRONT
    _hook_tool(sm, EventType.PRE_TOOL_USE, T0 + timedelta(minutes=1), "toolu_a")
    _hook_tool(sm, EventType.POST_TOOL_USE, T0 + timedelta(minutes=1, seconds=2), "toolu_a")
    sm.rest_agent(CODER, T0 + timedelta(minutes=33))
    assert sm.agents[CODER].state == AgentState.RESTING


class TestProvenActivityWakes:
    def test_a_hook_tool_call_with_its_native_id_recalls_it(self) -> None:
        sm = StateMachine()
        _rested_coder(sm)
        _hook_tool(sm, EventType.PRE_TOOL_USE, T0 + timedelta(minutes=34), "toolu_b")

        assert sm.agents[CODER].state == AgentState.WORKING
        assert sm.agents[CODER].resting_since is None

    def test_a_stored_hook_copy_already_on_the_agent_recalls_it(self) -> None:
        # Restore reads the copy as stored: agent_id already moved to the agent.
        sm = StateMachine()
        _rested_coder(sm)
        _hook_tool(
            sm, EventType.PRE_TOOL_USE, T0 + timedelta(minutes=34), "toolu_b", agent_id=CODER
        )

        assert sm.agents[CODER].state == AgentState.WORKING

    def test_a_hook_post_of_a_new_call_recalls_it(self) -> None:
        sm = StateMachine()
        _rested_coder(sm)
        _hook_tool(sm, EventType.POST_TOOL_USE, T0 + timedelta(minutes=34), "toolu_b")

        assert sm.agents[CODER].state == AgentState.WORKING

    def test_the_late_post_of_a_call_opened_before_the_rest_does_not(self) -> None:
        sm = StateMachine()
        _start(sm, CODER, T0)
        sm.agents[CODER].native_id = N_FRONT
        _hook_tool(sm, EventType.PRE_TOOL_USE, T0 + timedelta(minutes=1), "toolu_last")
        sm.transition(
            AgentEvent(
                event_type=EventType.SUBAGENT_STOP,
                session_id=SESSION,
                timestamp=T0 + timedelta(minutes=2),
                data=AgentEventData(agent_id=CODER),
            )
        )
        _hook_tool(sm, EventType.POST_TOOL_USE, T0 + timedelta(minutes=2, seconds=1), "toolu_last")

        assert sm.agents[CODER].state == AgentState.RESTING

    def test_the_late_post_of_a_call_open_when_the_sweep_rested_it_does_not(self) -> None:
        sm = StateMachine()
        _start(sm, CODER, T0)
        sm.agents[CODER].native_id = N_FRONT
        _hook_tool(sm, EventType.PRE_TOOL_USE, T0 + timedelta(minutes=1), "toolu_last")
        sm.rest_agent(CODER, T0 + timedelta(minutes=70))
        _hook_tool(sm, EventType.POST_TOOL_USE, T0 + timedelta(minutes=71), "toolu_last")

        assert sm.agents[CODER].state == AgentState.RESTING

    def test_a_poller_copy_without_native_id_does_not(self) -> None:
        sm = StateMachine()
        _rested_coder(sm)
        _hook_tool(
            sm,
            EventType.PRE_TOOL_USE,
            T0 + timedelta(minutes=34),
            "toolu_b",
            native=None,
            agent_id=CODER,
        )

        assert sm.agents[CODER].state == AgentState.RESTING

    def test_a_permission_request_with_its_native_id_recalls_it_waiting(self) -> None:
        sm = StateMachine()
        _rested_coder(sm)
        _hook_tool(sm, EventType.PERMISSION_REQUEST, T0 + timedelta(minutes=34), "toolu_b")

        assert sm.agents[CODER].state == AgentState.WAITING_PERMISSION
        assert sm.agents[CODER].resting_since is None

    def test_a_permission_request_without_proof_leaves_it_resting(self) -> None:
        sm = StateMachine()
        _rested_coder(sm)
        _hook_tool(
            sm,
            EventType.PERMISSION_REQUEST,
            T0 + timedelta(minutes=34),
            "toolu_b",
            native=None,
            agent_id=CODER,
        )

        assert sm.agents[CODER].state == AgentState.RESTING


class TestStopRestsOnlyItsOwnAgent:
    def test_a_stop_without_meta_or_link_rests_nobody(self, tmp_path: Path) -> None:
        # Real transcript, unknown native id, no meta file: no FIFO guess.
        sm = StateMachine()
        _start(sm, CODER, T0)
        path = tmp_path / f"agent-{N_BACK}.jsonl"
        path.write_text("{}\n")
        sm.transition(
            AgentEvent(
                event_type=EventType.SUBAGENT_STOP,
                session_id=SESSION,
                timestamp=T0 + timedelta(minutes=14),
                data=AgentEventData(native_agent_id=N_BACK, agent_transcript_path=str(path)),
            )
        )

        assert sm.agents[CODER].state != AgentState.RESTING
        assert sm.agents[CODER].native_id is None


# ---------------------------------------------------------------------------
# Restore from the DB
# ---------------------------------------------------------------------------


@pytest.fixture
def home(tmp_path: Path) -> Iterator[Path]:
    with patch.object(Path, "home", return_value=tmp_path):
        yield tmp_path


class StoredSession:
    def __init__(self, home: Path) -> None:
        self.sid = f"wake-{uuid4()}"
        project = home / ".claude" / "projects" / "p"
        self.main = project / f"{self.sid}.jsonl"
        self.subagents = project / self.sid / "subagents"
        self.subagents.mkdir(parents=True)
        self.main.write_text("{}\n")
        self.rows: list[AnyEvent] = []

    def transcript(self, native: str) -> str:
        return str(self.subagents / f"agent-{native}.jsonl")

    def write_transcript(self, native: str, tool_use_id: str | None) -> None:
        Path(self.transcript(native)).write_text("{}\n")
        if tool_use_id:
            (self.subagents / f"agent-{native}.meta.json").write_text(
                json.dumps({"agentType": "developer", "toolUseId": tool_use_id})
            )

    def add(self, kind: EventType, at: datetime, data: dict[str, Any]) -> None:
        self.rows.append(
            EventAdapter.validate_python(
                {
                    "event_type": kind,
                    "session_id": self.sid,
                    "timestamp": at,
                    "data": {"transcript_path": str(self.main), **data},
                }
            )
        )

    def hook_tool(self, kind: EventType, at: datetime, native: str, tool_use_id: str) -> None:
        self.add(
            kind,
            at,
            {
                "agent_id": "main",
                "native_agent_id": native,
                "tool_name": "Bash",
                "tool_input": {"command": "ls"},
                "tool_use_id": tool_use_id,
            },
        )

    async def restore(self) -> StateMachine:
        async with AsyncSessionLocal() as db:
            for evt in self.rows:
                db.add(
                    EventRecord(
                        session_id=self.sid,
                        timestamp=evt.timestamp,
                        event_type=evt.event_type.value,
                        data=evt.data.model_dump(mode="json", exclude_none=True),
                    )
                )
            await db.commit()
        sm = await EventProcessor()._build_restored_state_machine(self.sid)
        assert sm is not None
        return sm


@pytest.mark.asyncio
async def test_restore_an_unproven_stop_does_not_rest_a_working_agent(home: Path) -> None:
    """A stop with no meta and no link used to rest the oldest unlinked agent."""
    s = StoredSession(home)
    s.write_transcript(N_FRONT, "toolu_FRONT")
    s.write_transcript(N_BACK, None)
    s.add(EventType.SESSION_START, T0, {})
    s.add(EventType.SUBAGENT_START, T0, {"agent_id": CODER, "agent_type": "developer"})
    s.add(
        EventType.SUBAGENT_STOP,
        T0 + timedelta(minutes=14),
        {
            "native_agent_id": N_BACK,
            "agent_transcript_path": s.transcript(N_BACK),
        },
    )
    s.hook_tool(EventType.PRE_TOOL_USE, T0 + timedelta(minutes=33), N_FRONT, "toolu_b")

    sm = await s.restore()

    assert sm.agents[CODER].state == AgentState.WORKING
    assert sm.agents[CODER].native_id == N_FRONT


@pytest.mark.asyncio
async def test_restore_work_after_its_own_stop_comes_out_working(home: Path) -> None:
    """Stopped, then resumed without a stored SUBAGENT_INFO: its tool calls prove it."""
    s = StoredSession(home)
    s.write_transcript(N_FRONT, "toolu_FRONT")
    s.add(EventType.SESSION_START, T0, {})
    s.add(EventType.SUBAGENT_START, T0, {"agent_id": CODER, "agent_type": "developer"})
    s.add(
        EventType.SUBAGENT_STOP,
        T0 + timedelta(minutes=14),
        {
            "native_agent_id": N_FRONT,
            "agent_transcript_path": s.transcript(N_FRONT),
        },
    )
    s.hook_tool(EventType.PRE_TOOL_USE, T0 + timedelta(minutes=33), N_FRONT, "toolu_b")
    s.hook_tool(EventType.POST_TOOL_USE, T0 + timedelta(minutes=33, seconds=1), N_FRONT, "toolu_b")

    sm = await s.restore()

    assert sm.agents[CODER].state == AgentState.WORKING
    assert sm.agents[CODER].resting_since is None

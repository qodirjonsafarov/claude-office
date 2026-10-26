"""Two subagents spawned in one message keep their own native ids.

Live bug (2026-10-26): the boss started a frontend and a backend developer
with two parallel Agent calls. SubagentStart (-> SUBAGENT_INFO) for the
backend dev arrived before Claude Code wrote ``agent-<native>.meta.json``, so
the native id was guessed by agent type and went to the other developer. The
transcript pollers were crossed, a restore then gave both characters the same
native id, and the backend dev's SubagentStop rested the frontend dev, who was
still working.

The boss's own Agent PostToolUse carries both the spawning ``tool_use_id``
and the new ``native_agent_id``: that is the link. A guess is only allowed
when it is unambiguous, and an id is never given to two characters.
"""

# pyright: reportPrivateUsage=false

import asyncio
import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest

from app.core.event_processor import EventProcessor
from app.core.state_machine import StateMachine
from app.db.database import AsyncSessionLocal
from app.db.models import EventRecord
from app.models.agents import AgentState
from app.models.events import AnyEvent, EventAdapter, EventType

CODER = "subagent_toolu_FRONT"  # spawned first
BUILDER = "subagent_toolu_BACK"
N_FRONT = "a4e4d1e1afd61b74c"
N_BACK = "a53a40a3e017a21c9"


class FakePoller:
    def __init__(self) -> None:
        self.polling: dict[str, str] = {}

    async def is_polling(self, agent_id: str) -> bool:
        return agent_id in self.polling

    async def start_polling(self, agent_id: str, _sid: str, path: str) -> None:
        self.polling[agent_id] = path

    async def stop_polling(self, agent_id: str) -> None:
        self.polling.pop(agent_id, None)


@pytest.fixture
def home(tmp_path: Path) -> Iterator[Path]:
    with patch.object(Path, "home", return_value=tmp_path):
        yield tmp_path


@pytest.fixture
def poller() -> Iterator[FakePoller]:
    fake = FakePoller()
    with (
        patch("app.core.handlers.agent_handler.get_transcript_poller", lambda: fake),
        patch("app.core.handlers.agent_handler._LINK_WAIT_SECONDS", 0.3),
    ):
        yield fake


class Office:
    """A session fed through the real EventProcessor pipeline."""

    def __init__(self, home: Path) -> None:
        self.ep = EventProcessor()
        self.sid = f"par-{uuid4()}"
        project = home / ".claude" / "projects" / "p"
        self.main = project / f"{self.sid}.jsonl"
        self.subagents = project / self.sid / "subagents"
        self.subagents.mkdir(parents=True)
        self.main.write_text("{}\n")
        self.t0 = datetime.now(UTC)
        self.n = 0

    def transcript(self, native: str) -> str:
        return str(self.subagents / f"agent-{native}.jsonl")

    def write_files(self, native: str, tool_use_id: str) -> None:
        Path(self.transcript(native)).write_text("{}\n")
        (self.subagents / f"agent-{native}.meta.json").write_text(
            json.dumps({"agentType": "developer", "toolUseId": tool_use_id})
        )

    def event(self, kind: EventType, data: dict[str, Any]) -> AnyEvent:
        self.n += 1
        return EventAdapter.validate_python(
            {
                "event_type": kind,
                "session_id": self.sid,
                "timestamp": self.t0 + timedelta(milliseconds=self.n),
                "data": {"transcript_path": str(self.main), **data},
            }
        )

    async def send(self, kind: EventType, data: dict[str, Any]) -> None:
        await self.ep.process_event(self.event(kind, data))

    async def spawn(self, tool_use_id: str, name: str) -> None:
        await self.send(
            EventType.SUBAGENT_START,
            {
                "agent_id": f"subagent_{tool_use_id}",
                "agent_name": name,
                "agent_type": "developer",
                "task_description": f"{name} task",
                "tool_use_id": tool_use_id,
            },
        )

    async def spawn_result(self, tool_use_id: str, native: str) -> None:
        """The boss's Agent PostToolUse (background agent launched)."""
        await self.send(
            EventType.POST_TOOL_USE,
            {
                "agent_id": "main",
                "tool_name": "Agent",
                "tool_use_id": tool_use_id,
                "native_agent_id": native,
                "agent_transcript_path": self.transcript(native),
            },
        )

    async def info(self, native: str) -> None:
        """Native SubagentStart hook (also sent again on a SendMessage resume)."""
        await self.send(
            EventType.SUBAGENT_INFO,
            {
                "native_agent_id": native,
                "agent_type": "developer",
                "agent_transcript_path": self.transcript(native),
            },
        )

    async def stop(self, native: str) -> None:
        await self.send(
            EventType.SUBAGENT_STOP,
            {"native_agent_id": native, "agent_transcript_path": self.transcript(native)},
        )

    async def tool(self, agent_id: str, tool_use_id: str, kind: EventType) -> None:
        await self.send(
            kind, {"agent_id": agent_id, "tool_name": "Bash", "tool_use_id": tool_use_id}
        )

    @property
    def sm(self) -> StateMachine:
        return self.ep.sessions[self.sid]

    def native(self, agent_id: str) -> str | None:
        return self.sm.agents[agent_id].native_id

    def state(self, agent_id: str) -> AgentState:
        return self.sm.agents[agent_id].state


async def _live_sequence(office: Office) -> None:
    """The order the live DB shows: both spawns, then the backend dev's link
    events before any meta file exists; the frontend dev's info comes later."""
    await office.send(EventType.SESSION_START, {})
    await office.spawn("toolu_FRONT", "Coder")
    await office.spawn("toolu_BACK", "Builder")
    await office.spawn_result("toolu_BACK", N_BACK)
    await office.info(N_BACK)
    office.write_files(N_FRONT, "toolu_FRONT")
    office.write_files(N_BACK, "toolu_BACK")
    await office.info(N_FRONT)
    for agent_id in (CODER, BUILDER):
        await office.tool(agent_id, f"{agent_id}-t1", EventType.PRE_TOOL_USE)
        await office.tool(agent_id, f"{agent_id}-t1", EventType.POST_TOOL_USE)


@pytest.mark.asyncio
async def test_parallel_spawns_get_their_own_native_ids(home: Path, poller: FakePoller) -> None:
    office = Office(home)

    await _live_sequence(office)

    assert office.native(BUILDER) == N_BACK
    assert office.native(CODER) == N_FRONT
    assert poller.polling[BUILDER] == office.transcript(N_BACK)
    assert poller.polling[CODER] == office.transcript(N_FRONT)


@pytest.mark.asyncio
async def test_info_before_the_spawn_result_does_not_guess(home: Path, poller: FakePoller) -> None:
    """Hooks are concurrent: SubagentStart may beat the Agent PostToolUse."""
    office = Office(home)
    await office.send(EventType.SESSION_START, {})
    await office.spawn("toolu_FRONT", "Coder")
    await office.spawn("toolu_BACK", "Builder")

    async def result_later() -> None:
        await asyncio.sleep(0.05)
        await office.spawn_result("toolu_BACK", N_BACK)

    await asyncio.gather(office.info(N_BACK), result_later())

    assert office.native(BUILDER) == N_BACK
    assert office.native(CODER) is None
    assert poller.polling == {BUILDER: office.transcript(N_BACK)}


@pytest.mark.asyncio
async def test_stop_rests_the_agent_that_finished(home: Path, poller: FakePoller) -> None:
    office = Office(home)
    await _live_sequence(office)

    await office.stop(N_BACK)

    assert office.state(BUILDER) == AgentState.RESTING
    assert office.state(CODER) == AgentState.WORKING
    assert BUILDER not in poller.polling
    assert CODER in poller.polling


@pytest.mark.asyncio
async def test_resume_by_send_message_wakes_only_that_agent(home: Path, poller: FakePoller) -> None:
    office = Office(home)
    await _live_sequence(office)
    await office.stop(N_BACK)
    await office.stop(N_FRONT)

    # SendMessage to the frontend dev: Claude Code fires SubagentStart again
    await office.send(
        EventType.PRE_TOOL_USE,
        {"agent_id": "main", "tool_name": "SendMessage", "tool_use_id": "toolu_SEND"},
    )
    await office.info(N_FRONT)

    assert office.state(CODER) == AgentState.WORKING
    assert office.state(BUILDER) == AgentState.RESTING
    assert office.native(CODER) == N_FRONT
    assert office.native(BUILDER) == N_BACK


@pytest.mark.asyncio
async def test_restore_never_gives_one_native_id_to_two_agents(
    home: Path, poller: FakePoller
) -> None:
    """The live DB lost the frontend dev's info; a restore linked both to one id."""
    office = Office(home)
    rows = [
        office.event(EventType.SESSION_START, {}),
        office.event(
            EventType.SUBAGENT_START,
            {"agent_id": CODER, "agent_type": "developer", "agent_name": "Coder"},
        ),
        office.event(
            EventType.SUBAGENT_START,
            {"agent_id": BUILDER, "agent_type": "developer", "agent_name": "Builder"},
        ),
        office.event(
            EventType.SUBAGENT_INFO,
            {
                "native_agent_id": N_BACK,
                "agent_type": "developer",
                "agent_transcript_path": office.transcript(N_BACK),
            },
        ),
    ]
    office.write_files(N_FRONT, "toolu_FRONT")
    office.write_files(N_BACK, "toolu_BACK")
    async with AsyncSessionLocal() as db:
        for evt in rows:
            db.add(
                EventRecord(
                    session_id=office.sid,
                    timestamp=evt.timestamp,
                    event_type=evt.event_type.value,
                    data=evt.data.model_dump(mode="json", exclude_none=True),
                )
            )
        await db.commit()

    sm = await office.ep._build_restored_state_machine(office.sid)

    assert sm is not None
    assert sm.agents[BUILDER].native_id == N_BACK
    assert sm.agents[CODER].native_id is None


@pytest.mark.asyncio
async def test_a_stop_without_info_finds_its_agent_by_meta(home: Path, poller: FakePoller) -> None:
    """No SUBAGENT_INFO at all: the stop's meta file names the agent, not FIFO."""
    office = Office(home)
    await office.send(EventType.SESSION_START, {})
    await office.spawn("toolu_FRONT", "Coder")
    await office.spawn("toolu_BACK", "Builder")
    office.write_files(N_BACK, "toolu_BACK")

    await office.stop(N_BACK)

    assert office.native(BUILDER) == N_BACK
    assert office.native(CODER) is None
    assert office.state(BUILDER) == AgentState.RESTING
    assert office.state(CODER) != AgentState.RESTING

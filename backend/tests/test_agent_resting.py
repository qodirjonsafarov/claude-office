"""Finished subagents rest in the office instead of leaving at once.

The manager often resumes the same background agent later (SendMessage to
the same agent id): Claude Code then sends a SubagentStart hook that the
backend sees as SUBAGENT_INFO for the same native agent id / transcript,
then tool events and another SUBAGENT_STOP. So a stopped agent goes to
RESTING (keeps desk, name and look) and is recalled to WORKING when it comes
back. A resting agent leaves when it rested longer than the limit, when a new
agent needs a desk and none is free (longest-resting first), or when the
session ends.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from app.core.handlers.agent_handler import handle_subagent_stop
from app.core.state_machine import StateMachine, native_id_from_transcript
from app.models.agents import AgentState
from app.models.events import (
    AgentEvent,
    AgentEventData,
    EventDataBase,
    EventType,
    SessionEvent,
    SessionEventData,
    ToolEvent,
    ToolEventData,
)

T0 = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)
SESSION = "sess-1"


def transcript(native: str) -> str:
    return f"/home/u/.claude/projects/p/{SESSION}/subagents/agent-{native}.jsonl"


def start(sm: StateMachine, agent_id: str, at: datetime, agent_type: str = "developer") -> None:
    sm.transition(
        AgentEvent(
            event_type=EventType.SUBAGENT_START,
            session_id=SESSION,
            timestamp=at,
            data=AgentEventData(agent_id=agent_id, agent_name=agent_id, agent_type=agent_type),
        )
    )


def stop(sm: StateMachine, at: datetime, native: str, agent_id: str | None = None) -> AgentEvent:
    event = AgentEvent(
        event_type=EventType.SUBAGENT_STOP,
        session_id=SESSION,
        timestamp=at,
        data=AgentEventData(
            agent_id=agent_id,
            native_agent_id=None if agent_id else native,
            agent_transcript_path=transcript(native),
        ),
    )
    sm.transition(event)
    return event


def info(sm: StateMachine, at: datetime, native: str) -> None:
    sm.transition(
        AgentEvent(
            event_type=EventType.SUBAGENT_INFO,
            session_id=SESSION,
            timestamp=at,
            data=AgentEventData(
                native_agent_id=native,
                agent_type="developer",
                agent_transcript_path=transcript(native),
            ),
        )
    )


def tool(sm: StateMachine, agent_id: str, at: datetime) -> None:
    sm.transition(
        ToolEvent(
            event_type=EventType.PRE_TOOL_USE,
            session_id=SESSION,
            timestamp=at,
            data=ToolEventData(agent_id=agent_id, tool_name="Bash", tool_input={"command": "ls"}),
        )
    )


def finished_agent(sm: StateMachine) -> str:
    """One developer that started, worked and stopped at T0 + 5 min."""
    start(sm, "subagent_toolu_1", T0)
    tool(sm, "subagent_toolu_1", T0 + timedelta(minutes=1))
    stop(sm, T0 + timedelta(minutes=5), "abc123", agent_id="subagent_toolu_1")
    return "subagent_toolu_1"


class TestFinishToRest:
    def test_a_finished_agent_rests_in_the_office(self) -> None:
        sm = StateMachine()
        start(sm, "subagent_toolu_1", T0)
        name = sm.agents["subagent_toolu_1"].name
        stop(sm, T0 + timedelta(minutes=5), "abc123", agent_id="subagent_toolu_1")

        agent = sm.agents["subagent_toolu_1"]
        assert agent.state == AgentState.RESTING
        assert agent.desk == 1
        assert agent.name == name
        assert "subagent_toolu_1" not in sm.handin_queue

    def test_resting_remembers_the_native_id_from_the_transcript(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)

        assert sm.agents[agent_id].native_id == "abc123"

    def test_native_id_from_transcript(self) -> None:
        assert native_id_from_transcript(transcript("a3eaf1712ac2be39c")) == "a3eaf1712ac2be39c"
        assert native_id_from_transcript("/tmp/other.jsonl") is None
        assert native_id_from_transcript(None) is None


class TestRecall:
    def test_subagent_info_for_the_same_native_id_recalls_it(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)
        info(sm, T0 + timedelta(minutes=9), "abc123")

        assert list(sm.agents) == [agent_id]
        assert sm.agents[agent_id].state == AgentState.WORKING
        # Recalled agents don't queue at the elevator again
        assert agent_id not in sm.arrival_queue

    def test_new_tool_activity_recalls_it(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)
        tool(sm, agent_id, T0 + timedelta(minutes=9))

        assert sm.agents[agent_id].state == AgentState.WORKING

    def test_a_new_start_with_the_same_id_recalls_instead_of_duplicating(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)
        start(sm, agent_id, T0 + timedelta(minutes=9))

        assert list(sm.agents) == [agent_id]
        assert sm.agents[agent_id].state == AgentState.WORKING

    def test_a_recalled_agent_can_rest_again(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)
        info(sm, T0 + timedelta(minutes=9), "abc123")
        stop(sm, T0 + timedelta(minutes=12), "abc123")

        assert sm.agents[agent_id].state == AgentState.RESTING
        assert sm.agents[agent_id].resting_since == T0 + timedelta(minutes=12)


class TestLeaving:
    def test_leaves_after_resting_too_long(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)

        assert sm.expire_resting(T0 + timedelta(minutes=24)) == []
        assert sm.expire_resting(T0 + timedelta(minutes=26)) == [agent_id]
        assert agent_id not in sm.agents

    def test_the_rest_limit_is_configurable(self) -> None:
        sm = StateMachine()
        sm.rest_minutes = 2
        agent_id = finished_agent(sm)

        assert sm.expire_resting(T0 + timedelta(minutes=8)) == [agent_id]

    def test_any_later_event_also_sends_expired_agents_home(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)
        start(sm, "subagent_toolu_2", T0 + timedelta(minutes=40))

        assert agent_id not in sm.agents
        assert "subagent_toolu_2" in sm.agents

    def test_the_longest_resting_agent_leaves_when_desks_run_out(self) -> None:
        sm = StateMachine()
        for i in range(sm.MAX_AGENTS):
            start(sm, f"a{i}", T0 + timedelta(seconds=i))
        stop(sm, T0 + timedelta(minutes=1), "n3", agent_id="a3")
        stop(sm, T0 + timedelta(minutes=2), "n5", agent_id="a5")

        start(sm, "newcomer", T0 + timedelta(minutes=3))

        assert "a3" not in sm.agents
        assert "a5" in sm.agents
        assert "newcomer" in sm.agents
        assert sm.agents["newcomer"].desk == 4  # a3's desk, now free

    def test_working_agents_are_never_evicted_for_a_desk(self) -> None:
        sm = StateMachine()
        for i in range(sm.MAX_AGENTS):
            start(sm, f"a{i}", T0 + timedelta(seconds=i))

        start(sm, "newcomer", T0 + timedelta(minutes=3))

        assert "newcomer" not in sm.agents
        assert len(sm.agents) == sm.MAX_AGENTS

    def test_resting_agents_leave_when_the_session_ends(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)
        start(sm, "busy", T0 + timedelta(minutes=6))
        sm.transition(
            SessionEvent(
                event_type=EventType.SESSION_END,
                session_id=SESSION,
                timestamp=T0 + timedelta(minutes=7),
                data=SessionEventData(),
            )
        )

        assert agent_id not in sm.agents
        assert "busy" in sm.agents


class TestDesksAndColors:
    def test_a_new_agent_takes_the_first_free_desk_and_an_unused_color(self) -> None:
        sm = StateMachine()
        start(sm, "a", T0)
        start(sm, "b", T0)
        start(sm, "c", T0)
        sm.remove_agent("a")
        start(sm, "d", T0)

        assert sm.agents["d"].desk == 1
        colors = [a.color for a in sm.agents.values()]
        assert len(set(colors)) == len(colors)


class TestAsyncStopHandler:
    @pytest.mark.asyncio
    async def test_stop_keeps_the_agent_instead_of_cleaning_it_up(self) -> None:
        sm = StateMachine()
        start(sm, "subagent_toolu_1", T0)
        event = stop(sm, T0 + timedelta(minutes=5), "abc123", agent_id="subagent_toolu_1")
        persisted: list[EventType] = []

        async def persist(
            _session: str, event_type: EventType, _data: EventDataBase | dict[str, Any] | None
        ) -> None:
            persisted.append(event_type)

        await handle_subagent_stop(sm, event, persist)

        assert "subagent_toolu_1" in sm.agents
        assert EventType.CLEANUP not in persisted


class TestRestSweep:
    @pytest.mark.asyncio
    async def test_the_sweep_sends_long_resting_agents_home(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.core import event_processor as ep_module

        sm = StateMachine()
        agent_id = finished_agent(sm)
        processor = ep_module.EventProcessor()
        processor.sessions[SESSION] = sm
        persisted: list[tuple[EventType, str | None]] = []
        broadcasts: list[str] = []

        async def persist(
            _sid: str, event_type: EventType, data: EventDataBase | dict[str, Any] | None
        ) -> None:
            assert isinstance(data, AgentEventData)
            persisted.append((event_type, data.agent_id))

        async def broadcast(sid: str, _sm: StateMachine) -> None:
            broadcasts.append(sid)

        monkeypatch.setattr(processor, "_persist_synthetic_event", persist)
        monkeypatch.setattr(ep_module, "broadcast_state", broadcast)

        assert await processor.send_rested_agents_home(T0 + timedelta(minutes=10)) == 0
        assert await processor.send_rested_agents_home(T0 + timedelta(minutes=30)) == 1

        assert agent_id not in sm.agents
        assert persisted == [(EventType.CLEANUP, agent_id)]
        assert broadcasts == [SESSION]

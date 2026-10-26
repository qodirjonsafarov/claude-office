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
from typing import Any, Literal

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
        assert sm.to_game_state(SESSION).departure_queue == []

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

    def test_a_late_poller_tool_call_does_not_wake_it(self) -> None:
        # The transcript poller may still read the last tool_use after the
        # stop (it stamps events with now()); that is not a resume.
        sm = StateMachine()
        agent_id = finished_agent(sm)
        tool(sm, agent_id, T0 + timedelta(minutes=5, seconds=1))

        assert sm.agents[agent_id].state == AgentState.RESTING

    def test_a_hook_tool_call_with_the_native_id_does_not_wake_it(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)
        sm.transition(
            ToolEvent(
                event_type=EventType.PRE_TOOL_USE,
                session_id=SESSION,
                timestamp=T0 + timedelta(minutes=9),
                data=ToolEventData(
                    agent_id="main", native_agent_id="abc123", tool_name="TodoWrite"
                ),
            )
        )

        assert sm.agents[agent_id].state == AgentState.RESTING

    def test_a_new_start_with_the_same_id_recalls_instead_of_duplicating(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)
        start(sm, agent_id, T0 + timedelta(minutes=9))

        assert list(sm.agents) == [agent_id]
        assert sm.agents[agent_id].state == AgentState.WORKING

    def test_a_start_with_a_new_id_but_the_same_native_id_is_the_same_agent(self) -> None:
        sm = StateMachine()
        agent_id = finished_agent(sm)
        sm.transition(
            AgentEvent(
                event_type=EventType.SUBAGENT_START,
                session_id=SESSION,
                timestamp=T0 + timedelta(minutes=9),
                data=AgentEventData(
                    agent_id="subagent_abc123",
                    native_agent_id="abc123",
                    agent_type="developer",
                ),
            )
        )

        assert list(sm.agents) == [agent_id]
        assert sm.agents[agent_id].state == AgentState.WORKING

    def test_a_start_for_a_working_agent_with_the_same_native_id_adds_nobody(self) -> None:
        sm = StateMachine()
        start(sm, "subagent_toolu_1", T0)
        sm.agents["subagent_toolu_1"].native_id = "abc123"
        sm.transition(
            AgentEvent(
                event_type=EventType.SUBAGENT_START,
                session_id=SESSION,
                timestamp=T0 + timedelta(minutes=1),
                data=AgentEventData(agent_id="subagent_abc123", native_agent_id="abc123"),
            )
        )

        assert list(sm.agents) == ["subagent_toolu_1"]

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

        await handle_subagent_stop(sm, event)

        assert sm.agents["subagent_toolu_1"].state == AgentState.RESTING


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


def bash(
    sm: StateMachine,
    agent_id: str,
    tool_use_id: str,
    kind: Literal[EventType.PRE_TOOL_USE, EventType.POST_TOOL_USE],
    at: datetime,
) -> None:
    sm.transition(
        ToolEvent(
            event_type=kind,
            session_id=SESSION,
            timestamp=at,
            data=ToolEventData(agent_id=agent_id, tool_name="Bash", tool_use_id=tool_use_id),
        )
    )


class TestStuckWorkerSafetyNet:
    def test_a_quiet_working_agent_is_found(self) -> None:
        sm = StateMachine()
        start(sm, "w", T0)
        tool(sm, "w", T0 + timedelta(minutes=1))

        assert sm.quiet_workers(T0 + timedelta(minutes=5), minutes=10) == []
        assert sm.quiet_workers(T0 + timedelta(minutes=12), minutes=10) == ["w"]

    def test_an_agent_in_a_long_tool_call_is_not_quiet(self) -> None:
        """A 15-minute Bash writes nothing until it ends: the agent is busy."""
        sm = StateMachine()
        start(sm, "w", T0)
        bash(sm, "w", "b1", EventType.PRE_TOOL_USE, T0 + timedelta(minutes=1))

        assert sm.quiet_workers(T0 + timedelta(minutes=15), minutes=10) == []

        bash(sm, "w", "b1", EventType.POST_TOOL_USE, T0 + timedelta(minutes=16))
        assert sm.quiet_workers(T0 + timedelta(minutes=20), minutes=10) == []
        assert sm.quiet_workers(T0 + timedelta(minutes=27), minutes=10) == ["w"]

    def test_a_tool_call_open_for_hours_counts_as_stuck(self) -> None:
        sm = StateMachine()
        start(sm, "w", T0)
        bash(sm, "w", "b1", EventType.PRE_TOOL_USE, T0)

        assert sm.quiet_workers(T0 + timedelta(minutes=70), minutes=10) == ["w"]

    def test_resting_agents_are_not_quiet_workers(self) -> None:
        sm = StateMachine()
        finished_agent(sm)

        assert sm.quiet_workers(T0 + timedelta(hours=1), minutes=10) == []

    def test_rest_agent_puts_it_to_rest(self) -> None:
        sm = StateMachine()
        start(sm, "w", T0)
        sm.rest_agent("w", T0 + timedelta(minutes=12))

        assert sm.agents["w"].state == AgentState.RESTING
        assert sm.agents["w"].resting_since == T0 + timedelta(minutes=12)

    @pytest.mark.asyncio
    async def test_the_sweep_rests_quiet_workers_without_a_live_poller(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.core import event_processor as ep_module

        sm = StateMachine()
        start(sm, "polled", T0)
        start(sm, "lost", T0)
        tool(sm, "polled", T0 + timedelta(minutes=1))
        tool(sm, "lost", T0 + timedelta(minutes=1))
        processor = ep_module.EventProcessor()
        processor.sessions[SESSION] = sm

        class FakePoller:
            async def is_polling(self, agent_id: str) -> bool:
                return agent_id == "polled"

        async def broadcast(_sid: str, _sm: StateMachine) -> None:
            return None

        monkeypatch.setattr(ep_module, "get_transcript_poller", lambda: FakePoller())
        monkeypatch.setattr(ep_module, "broadcast_state", broadcast)

        await processor.send_rested_agents_home(T0 + timedelta(minutes=15))

        assert sm.agents["lost"].state == AgentState.RESTING
        assert sm.agents["polled"].state != AgentState.RESTING


class TestStopOrder:
    @pytest.mark.asyncio
    async def test_polling_stops_before_the_slow_transcript_count(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.core.handlers import agent_handler

        order: list[str] = []

        class FakePoller:
            async def stop_polling(self, _agent_id: str) -> None:
                order.append("stop_polling")

        sm = StateMachine()
        start(sm, "subagent_toolu_1", T0)
        event = stop(sm, T0 + timedelta(minutes=5), "abc123", agent_id="subagent_toolu_1")

        def count(_path: str) -> int:
            order.append("count")
            return 0

        monkeypatch.setattr(agent_handler, "get_transcript_poller", lambda: FakePoller())
        monkeypatch.setattr(sm.token_tracker, "count_tool_uses_from_jsonl", count)

        await handle_subagent_stop(sm, event)

        assert order == ["stop_polling", "count"]


class TestLifespanSweep:
    @pytest.mark.asyncio
    async def test_the_sweep_loop_calls_the_processor(self) -> None:
        import asyncio

        from app.main import _rest_sweep_loop  # pyright: ignore[reportPrivateUsage]

        calls: list[int] = []

        class FakeProcessor:
            async def send_rested_agents_home(self) -> int:
                calls.append(1)
                return 0

        task = asyncio.create_task(_rest_sweep_loop(FakeProcessor(), 0.01))  # type: ignore[arg-type]
        await asyncio.sleep(0.05)
        task.cancel()

        assert len(calls) >= 1

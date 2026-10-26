"""A subagent's tool calls belong to the subagent and are counted once.

Hooks report every tool call a subagent makes as agent ``"main"`` (with the
subagent's ``native_agent_id`` since the hooks tag it); the transcript poller
then reports the same call (same ``tool_use_id``) under ``subagent_<id>``.
The backend moves the hook copy to the subagent and drops the second copy,
live and when a session is restored from older duplicated DB rows.
"""

# pyright: reportPrivateUsage=false

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.core.event_processor import EventProcessor
from app.db.database import AsyncSessionLocal
from app.db.models import EventRecord
from app.models.agents import AgentState, BossState
from app.models.events import AnyEvent, EventAdapter, EventType

AGENT = "subagent_toolu_A"
NATIVE = "a5a60c7"


def _event(sid: str, kind: EventType, data: dict[str, Any], at: datetime | None = None) -> AnyEvent:
    return EventAdapter.validate_python(
        {
            "event_type": kind,
            "session_id": sid,
            "timestamp": at or datetime.now(UTC),
            "data": data,
        }
    )


def _hook_tool(tool_use_id: str, native: str | None = NATIVE) -> dict[str, Any]:
    data: dict[str, Any] = {
        "agent_id": "main",
        "tool_name": "Bash",
        "tool_input": {"command": "ls"},
        "tool_use_id": tool_use_id,
    }
    if native:
        data["native_agent_id"] = native
    return data


def _polled_tool(tool_use_id: str) -> dict[str, Any]:
    return {"agent_id": AGENT, "tool_name": "Bash", "tool_use_id": tool_use_id}


async def _office_with_agent() -> tuple[EventProcessor, str]:
    ep = EventProcessor()
    sid = f"attr-{uuid4()}"
    await ep.process_event(_event(sid, EventType.SESSION_START, {}))
    await ep.process_event(
        _event(sid, EventType.SUBAGENT_START, {"agent_id": AGENT, "agent_name": "Dev"})
    )
    ep.sessions[sid].agents[AGENT].native_id = NATIVE
    ep.sessions[sid].boss_state = BossState.IDLE
    return ep, sid


def _bash_rows(ep: EventProcessor, sid: str) -> list[str]:
    """agentId of every Bash pre_tool_use entry in the event log."""
    sm = ep.sessions[sid]
    return [
        h["agentId"]
        for h in sm.history
        if h["type"] == "pre_tool_use" and h["detail"].get("toolName") == "Bash"
    ]


async def _stored_agents(sid: str, kind: EventType) -> list[str | None]:
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(EventRecord).where(
                    EventRecord.session_id == sid, EventRecord.event_type == kind.value
                )
            )
        ).scalars()
        return [r.data.get("agent_id") for r in rows]


@pytest.mark.asyncio
async def test_hook_copy_goes_to_the_subagent_not_the_boss() -> None:
    ep, sid = await _office_with_agent()

    await ep.process_event(_event(sid, EventType.PRE_TOOL_USE, _hook_tool("t1")))

    sm = ep.sessions[sid]
    assert sm.boss_state == BossState.IDLE
    assert sm.agents[AGENT].state == AgentState.WORKING
    assert _bash_rows(ep, sid) == [AGENT]
    assert await _stored_agents(sid, EventType.PRE_TOOL_USE) == [AGENT]


@pytest.mark.asyncio
async def test_poller_copy_after_hook_copy_is_dropped() -> None:
    ep, sid = await _office_with_agent()

    await ep.process_event(_event(sid, EventType.PRE_TOOL_USE, _hook_tool("t1")))
    await ep.process_event(_event(sid, EventType.POST_TOOL_USE, _hook_tool("t1")))
    await ep._handle_polled_event(_event(sid, EventType.PRE_TOOL_USE, _polled_tool("t1")))
    await ep._handle_polled_event(_event(sid, EventType.POST_TOOL_USE, _polled_tool("t1")))

    assert _bash_rows(ep, sid) == [AGENT]
    assert await _stored_agents(sid, EventType.PRE_TOOL_USE) == [AGENT]
    assert await _stored_agents(sid, EventType.POST_TOOL_USE) == [AGENT]


@pytest.mark.asyncio
async def test_hook_copy_after_poller_copy_is_dropped() -> None:
    ep, sid = await _office_with_agent()

    await ep._handle_polled_event(_event(sid, EventType.PRE_TOOL_USE, _polled_tool("t1")))
    await ep.process_event(_event(sid, EventType.PRE_TOOL_USE, _hook_tool("t1")))

    assert ep.sessions[sid].boss_state == BossState.IDLE
    assert _bash_rows(ep, sid) == [AGENT]


@pytest.mark.asyncio
async def test_unknown_subagent_tool_never_lands_on_the_boss() -> None:
    ep, sid = await _office_with_agent()

    await ep.process_event(_event(sid, EventType.PRE_TOOL_USE, _hook_tool("t9", native="zzz")))

    assert ep.sessions[sid].boss_state == BossState.IDLE
    assert "main" not in _bash_rows(ep, sid)


@pytest.mark.asyncio
async def test_subagent_permission_request_waits_on_the_subagent() -> None:
    ep, sid = await _office_with_agent()

    await ep.process_event(_event(sid, EventType.PERMISSION_REQUEST, _hook_tool("t2")))

    sm = ep.sessions[sid]
    assert sm.agents[AGENT].state == AgentState.WAITING_PERMISSION
    assert sm.boss_state != BossState.WAITING_PERMISSION


@pytest.mark.asyncio
async def test_restore_drops_old_main_copies_of_subagent_tools() -> None:
    """DB rows from older hooks: a "main" copy without native id + the poller copy."""
    ep, sid = await _office_with_agent()
    old = [
        (EventType.PRE_TOOL_USE, _hook_tool("t1", native=None)),
        (EventType.PRE_TOOL_USE, _polled_tool("t1")),
        (EventType.PRE_TOOL_USE, _hook_tool("boss-own", native=None)),
    ]
    async with AsyncSessionLocal() as db:
        for i, (kind, data) in enumerate(old):
            db.add(
                EventRecord(
                    session_id=sid,
                    timestamp=datetime.now(UTC) + timedelta(seconds=i + 1),
                    event_type=kind.value,
                    data=data,
                )
            )
        await db.commit()

    sm = await ep._build_restored_state_machine(sid)

    assert sm is not None
    bash_rows = [
        h["agentId"]
        for h in sm.history
        if h["type"] == "pre_tool_use" and h["detail"].get("toolName") == "Bash"
    ]
    assert bash_rows == [AGENT, "main"]


@pytest.mark.asyncio
async def test_boss_background_agent_call_stays_on_the_boss() -> None:
    """The boss's own Agent PostToolUse carries the spawned agent's native id."""
    ep, sid = await _office_with_agent()

    await ep.process_event(
        _event(
            sid,
            EventType.POST_TOOL_USE,
            {
                "agent_id": "main",
                "tool_name": "Agent",
                "tool_use_id": "t3",
                "native_agent_id": NATIVE,
            },
        )
    )

    stored = await _stored_agents(sid, EventType.POST_TOOL_USE)
    assert stored == ["main"]


@pytest.mark.asyncio
async def test_restore_keeps_boss_tools_without_tool_use_id() -> None:
    """A subagent event with no tool_use_id must not hide the boss's events."""
    ep, sid = await _office_with_agent()
    rows = [
        (EventType.POST_TOOL_USE, {"agent_id": AGENT}),
        (EventType.POST_TOOL_USE, {"agent_id": "main", "tool_name": "Bash"}),
    ]
    async with AsyncSessionLocal() as db:
        for i, (kind, data) in enumerate(rows):
            db.add(
                EventRecord(
                    session_id=sid,
                    timestamp=datetime.now(UTC) + timedelta(seconds=i + 1),
                    event_type=kind.value,
                    data=data,
                )
            )
        await db.commit()

    sm = await ep._build_restored_state_machine(sid)

    assert sm is not None
    posts = [h["agentId"] for h in sm.history if h["type"] == "post_tool_use"]
    assert posts == [AGENT, "main"]


@pytest.mark.asyncio
async def test_old_hooks_main_copy_still_lets_the_poller_copy_through() -> None:
    """Hooks without the native id: the subagent still gets its tool call."""
    ep, sid = await _office_with_agent()

    await ep.process_event(_event(sid, EventType.PRE_TOOL_USE, _hook_tool("t1", native=None)))
    await ep._handle_polled_event(_event(sid, EventType.PRE_TOOL_USE, _polled_tool("t1")))

    assert ep.sessions[sid].agents[AGENT].state == AgentState.WORKING
    assert _bash_rows(ep, sid) == ["main", AGENT]

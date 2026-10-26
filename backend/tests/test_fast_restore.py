"""Restoring a session after a backend restart must be quick.

A long session (thousands of events) took ~20 s to replay: every replayed
event re-scanned all transcripts and every Stop re-read the whole main
transcript. Meanwhile the office showed nothing, and every extra tab or
device started its own full replay. Now:

- concurrent ``get_current_state`` calls for one session share one restore;
- transcripts are read once at the end of the replay (same totals);
- the last assistant reply is read once per transcript per restore.
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

from app.core import event_processor as ep_module
from app.core.event_processor import EventProcessor
from app.core.state_machine import StateMachine
from app.core.token_tracker import TokenTracker
from app.db.database import AsyncSessionLocal
from app.db.models import EventRecord
from app.models.events import AnyEvent, EventAdapter, EventType


@pytest.fixture
def claude_home(tmp_path: Path) -> Iterator[Path]:
    (tmp_path / ".claude" / "projects" / "p").mkdir(parents=True)
    with patch.object(Path, "home", return_value=tmp_path):
        yield tmp_path / ".claude" / "projects" / "p"


def _assistant(msg_id: str, inp: int, out: int) -> str:
    return (
        json.dumps(
            {
                "type": "assistant",
                "message": {
                    "id": msg_id,
                    "model": "claude-sonnet-4-5-20250929",
                    "role": "assistant",
                    "content": [{"type": "text", "text": f"reply {msg_id}"}],
                    "usage": {"input_tokens": inp, "output_tokens": out},
                },
            }
        )
        + "\n"
    )


def _transcripts(home: Path) -> tuple[Path, Path]:
    main = home / "s1.jsonl"
    main.write_text(_assistant("m1", 10, 5) + _assistant("m2", 30, 7))
    sub_dir = home / "s1" / "subagents"
    sub_dir.mkdir(parents=True)
    agent = sub_dir / "agent-a1.jsonl"
    agent.write_text(_assistant("a1", 4, 2))
    return main, agent


def _events(main: Path, agent: Path, n: int) -> list[AnyEvent]:
    out: list[AnyEvent] = []
    for i in range(n):
        data: dict[str, Any] = {"transcript_path": str(main), "tool_name": "Read"}
        if i % 2:
            data["agent_transcript_path"] = str(agent)
        out.append(
            EventAdapter.validate_python(
                {"event_type": EventType.PRE_TOOL_USE, "session_id": "s1", "data": data}
            )
        )
    return out


# --- TokenTracker: deferred reads -------------------------------------------


def test_deferred_reads_give_the_same_totals(claude_home: Path) -> None:
    main, agent = _transcripts(claude_home)
    live, replay = TokenTracker(), TokenTracker()
    for evt in _events(main, agent, 6):
        live.update_from_event(evt)

    replay.defer_reads()
    for evt in _events(main, agent, 6):
        replay.update_from_event(evt)
    replay.flush_deferred()

    assert replay.session_usage() == live.session_usage()
    assert replay.main_usage() == live.main_usage()
    assert replay.agent_usage("a1") == live.agent_usage("a1")
    assert replay.total_tokens == live.total_tokens
    assert replay.max_context_tokens == live.max_context_tokens


def test_deferred_reads_scan_each_transcript_pair_once(claude_home: Path) -> None:
    main, agent = _transcripts(claude_home)
    tracker = TokenTracker()
    tracker.defer_reads()
    calls: list[tuple[str | None, str | None]] = []
    real = tracker.read_transcripts

    def spy(t: str | None, a: str | None = None) -> None:
        calls.append((t, a))
        real(t, a)

    with patch.object(tracker, "read_transcripts", side_effect=spy):
        for evt in _events(main, agent, 50):
            tracker.update_from_event(evt)
        assert calls == []
        tracker.flush_deferred()
    assert len(calls) == 2  # (main, None) and (main, agent)


def test_without_defer_reads_stay_live(claude_home: Path) -> None:
    main, agent = _transcripts(claude_home)
    tracker = TokenTracker()
    tracker.update_from_event(_events(main, agent, 1)[0])
    assert tracker.total_tokens > 0


# --- restore ------------------------------------------------------------------


async def _seed(sid: str, rows: list[tuple[str, dict[str, Any]]]) -> None:
    start = datetime.now(UTC) - timedelta(minutes=5)
    async with AsyncSessionLocal() as db:
        for i, (event_type, data) in enumerate(rows):
            db.add(
                EventRecord(
                    session_id=sid,
                    timestamp=start + timedelta(seconds=i),
                    event_type=event_type,
                    data=data,
                )
            )
        await db.commit()


@pytest.mark.asyncio
async def test_restore_has_token_totals(claude_home: Path) -> None:
    main, agent = _transcripts(claude_home)
    sid = f"fast-{uuid4().hex[:8]}"
    await _seed(
        sid,
        [("session_start", {"transcript_path": str(main)})]
        + [("pre_tool_use", {"transcript_path": str(main), "tool_name": "Read"})] * 5,
    )
    sm = await EventProcessor()._build_restored_state_machine(sid)
    assert sm is not None
    live = StateMachine()
    for evt in _events(main, agent, 1):
        live.token_tracker.update_from_event(evt)
    assert sm.token_tracker.total_tokens == live.token_tracker.total_tokens > 0


@pytest.mark.asyncio
async def test_restore_reads_the_last_reply_once_per_transcript(claude_home: Path) -> None:
    main, _ = _transcripts(claude_home)
    sid = f"fast-stop-{uuid4().hex[:8]}"
    await _seed(
        sid,
        [("session_start", {"transcript_path": str(main)})]
        + [("stop", {"transcript_path": str(main)})] * 4,
    )
    calls: list[str] = []

    def fake_last(path: str) -> str:
        calls.append(path)
        return "the reply"

    with patch.object(ep_module, "get_last_assistant_response", side_effect=fake_last):
        sm = await EventProcessor()._build_restored_state_machine(sid)
    assert sm is not None
    assert len(calls) == 1
    replies = [e for e in sm.conversation if e["role"] == "assistant"]
    assert len(replies) == 4


@pytest.mark.asyncio
async def test_concurrent_viewers_share_one_restore() -> None:
    processor = EventProcessor()
    builds = 0

    async def slow_build(session_id: str) -> StateMachine:
        nonlocal builds
        builds += 1
        await asyncio.sleep(0.05)
        return StateMachine()

    with patch.object(processor, "_build_restored_state_machine", side_effect=slow_build):
        states = await asyncio.gather(*(processor.get_current_state("shared") for _ in range(5)))
    assert builds == 1
    assert all(s is not None for s in states)


@pytest.mark.asyncio
async def test_failed_restore_is_retried_next_time() -> None:
    processor = EventProcessor()
    attempts = 0

    async def flaky_build(session_id: str) -> StateMachine:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("db hiccup")
        return StateMachine()

    with patch.object(processor, "_build_restored_state_machine", side_effect=flaky_build):
        with pytest.raises(RuntimeError):
            await processor.get_current_state("flaky")
        assert await processor.get_current_state("flaky") is not None
    assert attempts == 2

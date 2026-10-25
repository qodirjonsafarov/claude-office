"""Tests for GET /api/v1/sessions: token totals and hidden junk sessions."""

import asyncio
import json
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.event_processor import event_processor
from app.main import app
from app.models.events import EventAdapter, EventType

client = TestClient(app)


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


def _listed(session_id: str) -> dict[str, Any] | None:
    resp = client.get("/api/v1/sessions")
    assert resp.status_code == 200
    return next((s for s in resp.json() if s["id"] == session_id), None)


@pytest.fixture
def transcript(tmp_path: Path) -> Iterator[Path]:
    project = tmp_path / ".claude" / "projects" / "p"
    project.mkdir(parents=True)
    path = project / "s.jsonl"
    record = {
        "type": "assistant",
        "message": {
            "id": "m1",
            "model": "claude-sonnet-4-5",
            "usage": {
                "input_tokens": 100,
                "output_tokens": 50,
                "cache_read_input_tokens": 1000,
                "cache_creation_input_tokens": 10,
            },
        },
    }
    path.write_text(json.dumps(record) + "\n")
    with patch.object(Path, "home", return_value=tmp_path):
        yield path


class TestJunkSessions:
    def test_ended_session_without_work_is_hidden(self) -> None:
        sid = f"test-{uuid4()}"
        _send(sid, EventType.SESSION_START, {})
        _send(sid, EventType.SESSION_END, {})
        assert _listed(sid) is None

    def test_ended_session_with_tool_use_is_listed(self) -> None:
        sid = f"test-{uuid4()}"
        _send(sid, EventType.SESSION_START, {})
        _send(sid, EventType.PRE_TOOL_USE, {"tool_name": "Read", "agent_id": "main"})
        _send(sid, EventType.SESSION_END, {})
        assert _listed(sid) is not None

    def test_fresh_active_session_is_listed(self) -> None:
        sid = f"test-{uuid4()}"
        _send(sid, EventType.SESSION_START, {})
        assert _listed(sid) is not None


class TestSessionTokenUsage:
    def test_session_without_transcript_has_null_usage(self) -> None:
        sid = f"test-{uuid4()}"
        _send(sid, EventType.SESSION_START, {})
        listed = _listed(sid)
        assert listed is not None
        assert listed["tokenUsage"] is None

    def test_live_session_lists_token_totals(self, transcript: Path) -> None:
        sid = f"test-{uuid4()}"
        _send(sid, EventType.SESSION_START, {"transcript_path": str(transcript)})
        listed = _listed(sid)
        assert listed is not None
        usage = listed["tokenUsage"]
        assert usage["inputTokens"] == 100
        assert usage["outputTokens"] == 50
        assert usage["cacheReadTokens"] == 1000
        assert usage["cacheWriteTokens"] == 10
        assert usage["model"] == "claude-sonnet-4-5"
        assert usage["costUsd"] == pytest.approx((100 * 3 + 50 * 15 + 1000 * 0.3 + 10 * 3.75) / 1e6)

    def test_session_not_in_memory_reads_its_transcript(self, transcript: Path) -> None:
        sid = f"test-{uuid4()}"
        _send(sid, EventType.SESSION_START, {"transcript_path": str(transcript)})
        event_processor.sessions.pop(sid, None)
        listed = _listed(sid)
        assert listed is not None
        assert listed["tokenUsage"]["outputTokens"] == 50

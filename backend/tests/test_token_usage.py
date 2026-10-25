"""Tests for session token totals, cost estimate and the context window."""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from app.core.state_machine import StateMachine
from app.core.token_tracker import TokenTracker, estimate_cost_usd
from app.models.events import AnyEvent, EventAdapter, EventType


@pytest.fixture
def claude_home(tmp_path: Path) -> Iterator[Path]:
    """Point ~ at tmp_path so transcripts under tmp/.claude pass the path guard."""
    (tmp_path / ".claude" / "projects" / "p").mkdir(parents=True)
    with patch.object(Path, "home", return_value=tmp_path):
        yield tmp_path / ".claude" / "projects" / "p"


def _assistant(
    msg_id: str,
    *,
    model: str = "claude-sonnet-4-5-20250929",
    requested: str | None = None,
    inp: int = 10,
    out: int = 20,
    cache_read: int = 0,
    cache_write: int = 0,
) -> str:
    record: dict[str, Any] = {
        "type": "assistant",
        "message": {
            "id": msg_id,
            "model": model,
            "role": "assistant",
            "usage": {
                "input_tokens": inp,
                "output_tokens": out,
                "cache_read_input_tokens": cache_read,
                "cache_creation_input_tokens": cache_write,
            },
        },
    }
    if requested:
        record["requestedModel"] = requested
    return json.dumps(record) + "\n"


def _event(transcript: Path) -> AnyEvent:
    return EventAdapter.validate_python(
        {
            "event_type": EventType.STOP,
            "session_id": "s1",
            "data": {"transcript_path": str(transcript)},
        }
    )


class TestSessionTotals:
    def test_sums_usage_once_per_message_id(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        # The same message id is written once per content block.
        f.write_text(
            _assistant("m1", inp=10, out=5, cache_read=100, cache_write=50)
            + _assistant("m1", inp=10, out=5, cache_read=100, cache_write=50)
            + _assistant("m2", inp=1, out=7, cache_read=200, cache_write=0)
        )
        tracker = TokenTracker()
        tracker.update_from_event(_event(f))
        usage = tracker.session_usage()
        assert usage is not None
        assert (usage.input_tokens, usage.output_tokens) == (11, 12)
        assert (usage.cache_read_tokens, usage.cache_write_tokens) == (300, 50)
        assert usage.model == "claude-sonnet-4-5-20250929"

    def test_reads_only_new_lines_on_next_event(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        f.write_text(_assistant("m1", out=5))
        tracker = TokenTracker()
        tracker.update_from_event(_event(f))
        with f.open("a") as fh:
            fh.write(_assistant("m2", out=6))
            fh.write('{"type": "assistant", "message": {"id": "m3", "usa')  # half-written
        tracker.update_from_event(_event(f))
        usage = tracker.session_usage()
        assert usage is not None and usage.output_tokens == 11

        with f.open("a") as fh:
            fh.write('ge": {"output_tokens": 4}}}\n')
        tracker.update_from_event(_event(f))
        usage = tracker.session_usage()
        assert usage is not None and usage.output_tokens == 15

    def test_includes_subagent_transcripts(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        f.write_text(_assistant("m1", out=5))
        sub = claude_home / "s1" / "subagents"
        sub.mkdir(parents=True)
        (sub / "agent-a1.jsonl").write_text(_assistant("m9", model="claude-haiku-4-5", out=3))
        tracker = TokenTracker()
        tracker.update_from_event(_event(f))
        usage = tracker.session_usage()
        assert usage is not None and usage.output_tokens == 8
        # The model shown is the main session's model, not the subagent's.
        assert usage.model == "claude-sonnet-4-5-20250929"

    def test_no_transcript_means_no_usage(self) -> None:
        assert TokenTracker().session_usage() is None

    def test_office_state_carries_usage(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        f.write_text(_assistant("m1", out=5))
        sm = StateMachine()
        sm.transition(_event(f))
        office = sm.to_game_state("s1").office
        assert office.token_usage is not None
        assert office.token_usage.output_tokens == 5


class TestCost:
    def test_known_model_cost(self) -> None:
        # Sonnet 4.5: $3 in, $15 out, cache write 1.25x in, cache read 0.1x in.
        cost = estimate_cost_usd(
            {"claude-sonnet-4-5-20250929": (1_000_000, 1_000_000, 1_000_000, 1_000_000, 0)}
        )
        assert cost == pytest.approx(3 + 15 + 0.3 + 3.75)

    def test_one_hour_cache_writes_cost_double_input(self) -> None:
        cost = estimate_cost_usd({"claude-sonnet-4-5": (0, 0, 0, 0, 1_000_000)})
        assert cost == pytest.approx(6.0)

    def test_unknown_model_gives_no_cost(self) -> None:
        assert estimate_cost_usd({"claude-future-9": (1, 1, 0, 0, 0)}) is None

    def test_older_family_price_does_not_leak_to_newer_version(self) -> None:
        # claude-opus-4 is priced, claude-opus-4-9 must not inherit it.
        assert estimate_cost_usd({"claude-opus-4-9": (1, 1, 0, 0, 0)}) is None

    def test_session_usage_has_cost(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        f.write_text(_assistant("m1", inp=1_000_000, out=0))
        tracker = TokenTracker()
        tracker.update_from_event(_event(f))
        usage = tracker.session_usage()
        assert usage is not None and usage.cost_usd == pytest.approx(3.0)


class TestContextWindow:
    def test_defaults_to_200k_for_opus(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        f.write_text(_assistant("m1", model="claude-opus-4-5", inp=50_000, out=0))
        tracker = TokenTracker()
        tracker.update_from_event(_event(f))
        assert tracker.max_context_tokens == 200_000
        assert tracker.context_utilization == pytest.approx(0.25)

    def test_1m_marker_in_requested_model(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        f.write_text(_assistant("m1", model="claude-opus-4-5", requested="claude-opus-4-5[1m]"))
        tracker = TokenTracker()
        tracker.update_from_event(_event(f))
        assert tracker.max_context_tokens == 1_000_000

    def test_switches_to_1m_when_tokens_exceed_200k(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        f.write_text(_assistant("m1", model="claude-opus-4-5", inp=10, cache_read=250_000))
        tracker = TokenTracker()
        tracker.update_from_event(_event(f))
        assert tracker.max_context_tokens == 1_000_000
        assert tracker.context_utilization == pytest.approx(0.25003)

    def test_context_follows_last_main_message(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        f.write_text(
            _assistant("m1", inp=10, cache_read=100_000, out=0)
            + _assistant("m2", inp=10, cache_read=20_000, out=0)
        )
        tracker = TokenTracker()
        tracker.update_from_event(_event(f))
        assert tracker.total_tokens == 20_010

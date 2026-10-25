"""Tests for session token totals, cost estimate and the context window."""

import json
from collections.abc import Iterator
from pathlib import Path
from typing import Any, BinaryIO, cast
from unittest.mock import patch

import pytest

from app.core import token_tracker
from app.core.state_machine import StateMachine
from app.core.token_tracker import (
    TokenTracker,
    TranscriptUsage,
    estimate_cost_parts,
    estimate_cost_usd,
)
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
            [("claude-sonnet-4-5-20250929", (1_000_000, 1_000_000, 1_000_000, 1_000_000, 0))]
        )
        assert cost == pytest.approx(3 + 15 + 0.3 + 3.75)

    def test_one_hour_cache_writes_cost_double_input(self) -> None:
        cost = estimate_cost_usd([("claude-sonnet-4-5", (0, 0, 0, 0, 1_000_000))])
        assert cost == pytest.approx(6.0)

    def test_unknown_model_gives_no_cost(self) -> None:
        assert estimate_cost_usd([("claude-future-9", (1, 1, 0, 0, 0))]) is None

    def test_older_family_price_does_not_leak_to_newer_version(self) -> None:
        # claude-opus-4 is priced, claude-opus-4-9 must not inherit it.
        assert estimate_cost_usd([("claude-opus-4-9", (1, 1, 0, 0, 0))]) is None

    def test_current_models_are_priced(self) -> None:
        mtok = (1_000_000, 1_000_000, 1_000_000, 1_000_000, 0)
        # input + output + cache read + cache write (1.25x input, assumed)
        assert estimate_cost_usd([("claude-opus-5-5", mtok)]) == pytest.approx(4 + 20 + 0.2 + 5)
        assert estimate_cost_usd([("claude-sonnet-5-5", mtok)]) == pytest.approx(2 + 10 + 0.2 + 2.5)
        assert estimate_cost_usd([("claude-fable-5-1", mtok)]) == pytest.approx(
            10 + 50 + 0.25 + 12.5
        )

    def test_1m_suffix_still_matches(self) -> None:
        cost = estimate_cost_usd([("claude-opus-5-5[1m]", (1_000_000, 0, 0, 0, 0))])
        assert cost == pytest.approx(4.0)

    def test_haiku_short_prompt_uses_base_price(self) -> None:
        # 60k-token prompt: base tier; cache read assumed 0.1x input.
        cost = estimate_cost_usd([("claude-haiku-5-5", (50_000, 10_000, 10_000, 0, 0))])
        assert cost == pytest.approx((50_000 * 0.10 + 10_000 * 0.50 + 10_000 * 0.01) / 1e6)

    def test_haiku_long_prompt_uses_long_tier(self) -> None:
        # 150k-token prompt (input + cache) is over 100k: 0.50 in / 2.50 out.
        cost = estimate_cost_usd([("claude-haiku-5-5", (100_000, 10_000, 50_000, 0, 0))])
        assert cost == pytest.approx((100_000 * 0.50 + 10_000 * 2.50 + 50_000 * 0.05) / 1e6)

    def test_zero_usage_request_of_unknown_model_costs_nothing(self) -> None:
        # Claude Code writes "<synthetic>" messages with empty usage.
        cost = estimate_cost_usd(
            [("unknown", (0, 0, 0, 0, 0)), ("claude-opus-5-5", (1_000_000, 0, 0, 0, 0))]
        )
        assert cost == pytest.approx(4.0)

    def test_session_usage_has_cost(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        f.write_text(_assistant("m1", inp=1_000_000, out=0))
        tracker = TokenTracker()
        tracker.update_from_event(_event(f))
        usage = tracker.session_usage()
        assert usage is not None and usage.cost_usd == pytest.approx(3.0)


class TestChunkedRead:
    """A big transcript is read in bounded chunks, never in one go."""

    def test_lines_across_chunk_borders_are_all_counted(self, tmp_path: Path) -> None:
        f = tmp_path / "big.jsonl"
        lines = [_assistant(f"m{i}", inp=1, out=1) for i in range(30)]
        f.write_text("".join(lines) + '{"partial": ')
        reads: list[int] = []
        real_open = open

        def spy_open(*args: Any, **kwargs: Any) -> Any:
            handle = cast(BinaryIO, real_open(*args, **kwargs))
            real_read = handle.read

            def read(n: int = -1) -> bytes:
                reads.append(n)
                return real_read(n)

            handle.read = read  # type: ignore[method-assign]
            return handle

        usage = TranscriptUsage()
        with (
            patch.object(token_tracker, "_READ_CHUNK", 100),
            patch("builtins.open", spy_open),
        ):
            usage.read(f, main=True)
        assert len(usage.messages) == 30
        assert reads and all(0 < n <= 100 for n in reads)
        # The unfinished last line is left for the next read.
        assert usage.offsets[f] == sum(len(x.encode()) for x in lines)


class TestCostParts:
    """The cost split by kind, so the UI can show where the estimate comes from."""

    def test_parts_per_kind(self) -> None:
        parts = estimate_cost_parts(
            [("claude-sonnet-4-5", (1_000_000, 1_000_000, 1_000_000, 1_000_000, 1_000_000))]
        )
        assert parts is not None
        assert parts.input == pytest.approx(3.0)
        assert parts.output == pytest.approx(15.0)
        assert parts.cache_read == pytest.approx(0.3)
        assert parts.cache_write == pytest.approx(3.75 + 6.0)
        assert parts.total == pytest.approx(3 + 15 + 0.3 + 9.75)

    def test_unknown_model_gives_no_parts(self) -> None:
        assert estimate_cost_parts([("claude-future-9", (1, 1, 0, 0, 0))]) is None

    def test_session_usage_carries_parts(self, claude_home: Path) -> None:
        f = claude_home / "s1.jsonl"
        f.write_text(_assistant("m1", inp=1_000_000, out=1_000_000))
        tracker = TokenTracker()
        tracker.update_from_event(_event(f))
        usage = tracker.session_usage()
        assert usage is not None
        assert usage.cost_input_usd == pytest.approx(3.0)
        assert usage.cost_output_usd == pytest.approx(15.0)
        assert usage.cost_cache_read_usd == pytest.approx(0.0)
        assert usage.cost_cache_write_usd == pytest.approx(0.0)
        dumped = usage.model_dump(by_alias=True)
        assert "costInputUsd" in dumped and "costCacheWriteUsd" in dumped


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

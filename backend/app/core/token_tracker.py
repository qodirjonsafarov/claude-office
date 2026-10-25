"""Token usage tracking extracted from StateMachine.

Encapsulates JSONL-based token extraction, tool-use counting,
and thinking-block extraction so StateMachine can delegate
these concerns instead of embedding file I/O in its dataclass body.
"""

import json
import logging
import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, NamedTuple, cast

from app.core.path_utils import is_safe_transcript_path
from app.models.agents import TokenUsage
from app.models.events import AnyEvent

logger = logging.getLogger(__name__)

# Tail size read when scanning for the latest thinking block.
_THINKING_READ_SIZE = 50_000

# Files larger than this are skipped to bound memory use when the whole
# file is read (count_tool_uses_from_jsonl). Generous enough for very long
# real sessions while preventing a pathological transcript from exhausting RAM.
_MAX_TRANSCRIPT_BYTES = 50_000_000

# TranscriptUsage reads new transcript bytes in pieces of this size, so the
# first read of a long session never holds the whole file in memory.
_READ_CHUNK = 2 * 1024 * 1024

# Context window: 200k unless the session runs a 1M-context model, seen as a
# ``[1m]`` suffix on the model id or as a context larger than 200k tokens.
_DEFAULT_CONTEXT_WINDOW = 200_000
_LONG_CONTEXT_WINDOW = 1_000_000
_LONG_CONTEXT_MARKER = "[1m]"


class ModelPrice(NamedTuple):
    """List price in USD per million tokens.

    ``cache_read=None`` means no published figure: 0.1x input is assumed.
    ``long_*`` is a higher tier for requests whose prompt (input + cache
    read + cache write) is over ``long_prompt_tokens``.
    """

    input: float
    output: float
    cache_read: float | None = None
    long_prompt_tokens: int | None = None
    long_input: float = 0.0
    long_output: float = 0.0


# Prices for the cost estimate. Keys are model ids without suffixes:
# ``claude-x-4-5-20250929`` and ``claude-x-5-5[1m]`` match ``claude-x-4-5`` /
# ``claude-x-5-5``. Cache writes are not published for every model; 1.25x
# input (5 min TTL) and 2x input (1 h TTL) are assumed for all of them.
# Long-context (>200k) surcharges of the 4.x models are ignored.
MODEL_PRICES_USD_PER_MTOK: dict[str, ModelPrice] = {
    "claude-opus-5-5": ModelPrice(4.0, 20.0, cache_read=0.20),
    "claude-sonnet-5-5": ModelPrice(2.0, 10.0, cache_read=0.20),
    "claude-haiku-5-5": ModelPrice(
        0.10, 0.50, long_prompt_tokens=100_000, long_input=0.50, long_output=2.50
    ),
    "claude-fable-5-1": ModelPrice(10.0, 50.0, cache_read=0.25),
    "claude-opus-4-5": ModelPrice(5.0, 25.0),
    "claude-opus-4-1": ModelPrice(15.0, 75.0),
    "claude-opus-4": ModelPrice(15.0, 75.0),
    "claude-sonnet-4-5": ModelPrice(3.0, 15.0),
    "claude-sonnet-4": ModelPrice(3.0, 15.0),
    "claude-haiku-4-5": ModelPrice(1.0, 5.0),
    "claude-3-5-haiku": ModelPrice(0.8, 4.0),
}
_CACHE_WRITE_5M_FACTOR = 1.25  # assumption, see above
_CACHE_WRITE_1H_FACTOR = 2.0  # assumption, see above
_CACHE_READ_FACTOR = 0.1  # assumption when a model has no cache_read price

# Token counts of one request (or a sum of requests):
# (input, output, cache_read, cache_write_5m, cache_write_1h).
ModelTokens = tuple[int, int, int, int, int]


def _price_for_model(model: str) -> ModelPrice | None:
    """Look up a model's price; the id may carry a date or ``[...]`` suffix."""
    base = re.sub(r"\[[^\]]*\]$", "", model.lower())
    base = re.sub(r"-\d{8}$", "", base)
    return MODEL_PRICES_USD_PER_MTOK.get(base)


class CostParts(NamedTuple):
    """API-equivalent cost in USD, split by token kind."""

    input: float
    output: float
    cache_read: float
    cache_write: float

    @property
    def total(self) -> float:
        return self.input + self.output + self.cache_read + self.cache_write


def estimate_cost_parts(requests: Iterable[tuple[str, ModelTokens]]) -> CostParts | None:
    """Estimate the API-equivalent cost of a list of requests, per token kind.

    This is what the tokens would cost at API list prices, not what a
    subscription user pays. Each item is one request (model, tokens), so a
    per-request tier such as Haiku 5.5's long-prompt price applies per call.
    Returns ``None`` when any model has no known price, so a partial sum is
    never shown as the full cost.
    """
    cost_in = cost_out = cost_read = cost_write = 0.0
    for model, tokens in requests:
        if not any(tokens):
            continue  # e.g. "<synthetic>" messages with empty usage
        price = _price_for_model(model)
        if price is None:
            return None
        inp, out, cache_read, cache_write_5m, cache_write_1h = tokens
        price_in, price_out = price.input, price.output
        price_read = price.cache_read
        prompt = inp + cache_read + cache_write_5m + cache_write_1h
        if price.long_prompt_tokens is not None and prompt > price.long_prompt_tokens:
            price_in, price_out, price_read = price.long_input, price.long_output, None
        if price_read is None:
            price_read = price_in * _CACHE_READ_FACTOR
        cost_in += inp * price_in / 1_000_000
        cost_out += out * price_out / 1_000_000
        cost_read += cache_read * price_read / 1_000_000
        cost_write += (
            cache_write_5m * price_in * _CACHE_WRITE_5M_FACTOR
            + cache_write_1h * price_in * _CACHE_WRITE_1H_FACTOR
        ) / 1_000_000
    return CostParts(cost_in, cost_out, cost_read, cost_write)


def estimate_cost_usd(requests: Iterable[tuple[str, ModelTokens]]) -> float | None:
    """Total of :func:`estimate_cost_parts` (``None`` without a known price)."""
    parts = estimate_cost_parts(requests)
    return None if parts is None else parts.total


def _as_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


@dataclass
class _MessageUsage:
    """Usage of one API message (one ``message.id``)."""

    model: str | None
    input_tokens: int
    output_tokens: int
    cache_read_tokens: int
    cache_write_5m_tokens: int
    cache_write_1h_tokens: int

    @property
    def context_tokens(self) -> int:
        return (
            self.input_tokens
            + self.cache_read_tokens
            + self.cache_write_5m_tokens
            + self.cache_write_1h_tokens
        )


def _parse_usage_record(record: dict[str, Any]) -> tuple[str, _MessageUsage] | None:
    """Return ``(message_id, usage)`` for an assistant record with usage."""
    message = record.get("message")
    if not isinstance(message, dict):
        return None
    msg = cast(dict[str, Any], message)
    usage_raw = msg.get("usage")
    if not isinstance(usage_raw, dict):
        return None
    usage = cast(dict[str, Any], usage_raw)
    msg_id = msg.get("id") or record.get("requestId") or record.get("uuid")
    if not msg_id:
        return None
    cache_write = _as_int(usage.get("cache_creation_input_tokens"))
    cache_write_1h = 0
    split = usage.get("cache_creation")
    if isinstance(split, dict):
        cache_write_1h = min(
            cache_write, _as_int(cast(dict[str, Any], split).get("ephemeral_1h_input_tokens"))
        )
    model = msg.get("model")
    return str(msg_id), _MessageUsage(
        model=model if isinstance(model, str) and not model.startswith("<") else None,
        input_tokens=_as_int(usage.get("input_tokens")),
        output_tokens=_as_int(usage.get("output_tokens")),
        cache_read_tokens=_as_int(usage.get("cache_read_input_tokens")),
        cache_write_5m_tokens=cache_write - cache_write_1h,
        cache_write_1h_tokens=cache_write_1h,
    )


@dataclass
class TranscriptUsage:
    """Incrementally sums ``usage`` blocks over a set of transcript files.

    Each file is read from where the last read stopped, so a long session is
    parsed once. Usage is kept per ``message.id`` because Claude Code writes
    one line per content block, all with the same usage.
    """

    offsets: dict[Path, int] = field(default_factory=lambda: cast(dict[Path, int], {}))
    messages: dict[str, _MessageUsage] = field(
        default_factory=lambda: cast(dict[str, _MessageUsage], {})
    )
    # Latest message of the main transcript: drives the context bar and model.
    last_main: _MessageUsage | None = None
    long_context: bool = False

    def read(self, path: Path, *, main: bool) -> None:
        """Read the new complete lines of *path* and record their usage."""
        try:
            size = path.stat().st_size
        except OSError:
            return
        offset = self.offsets.get(path, 0)
        if size < offset:  # rewritten file; message ids keep totals right
            offset = 0
        if size == offset:
            return
        try:
            with open(path, "rb") as f:
                f.seek(offset)
                pending = b""  # an unfinished line carried to the next chunk
                while True:
                    chunk = f.read(_READ_CHUNK)
                    if not chunk:
                        break
                    data = pending + chunk
                    end = data.rfind(b"\n")
                    if end == -1:
                        pending = data
                        continue
                    for raw in data[: end + 1].split(b"\n"):
                        self._record_line(raw, main=main)
                    offset += end + 1
                    pending = data[end + 1 :]
        except OSError as exc:
            logger.warning("Failed to read transcript %s: %s", path, exc)
        # Up to the last complete line; the rest is read next time.
        self.offsets[path] = offset

    def _record_line(self, raw: bytes, *, main: bool) -> None:
        """Record the usage of one transcript line, if it has any."""
        if b'"usage"' not in raw:
            return
        try:
            record = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return
        if not isinstance(record, dict):
            return
        rec = cast(dict[str, Any], record)
        parsed = _parse_usage_record(rec)
        if parsed is None:
            return
        msg_id, usage = parsed
        self.messages[msg_id] = usage
        if main:
            self.last_main = usage
            requested = rec.get("requestedModel")
            markers = f"{requested or ''} {usage.model or ''}".lower()
            if _LONG_CONTEXT_MARKER in markers:
                self.long_context = True

    @property
    def model(self) -> str | None:
        """Latest model of the main transcript (falls back to any model seen)."""
        if self.last_main and self.last_main.model:
            return self.last_main.model
        return next((m.model for m in reversed(self.messages.values()) if m.model), None)

    def requests(self) -> list[tuple[str, ModelTokens]]:
        """One ``(model, tokens)`` entry per API message."""
        return [
            (
                m.model or "unknown",
                (
                    m.input_tokens,
                    m.output_tokens,
                    m.cache_read_tokens,
                    m.cache_write_5m_tokens,
                    m.cache_write_1h_tokens,
                ),
            )
            for m in self.messages.values()
        ]

    def summary(self) -> TokenUsage | None:
        """Session totals, or ``None`` when no usage was read yet."""
        if not self.messages:
            return None
        requests = self.requests()
        parts = estimate_cost_parts(requests)
        return TokenUsage(
            input_tokens=sum(t[0] for _, t in requests),
            output_tokens=sum(t[1] for _, t in requests),
            cache_read_tokens=sum(t[2] for _, t in requests),
            cache_write_tokens=sum(t[3] + t[4] for _, t in requests),
            model=self.model,
            cost_usd=None if parts is None else parts.total,
            cost_input_usd=None if parts is None else parts.input,
            cost_output_usd=None if parts is None else parts.output,
            cost_cache_read_usd=None if parts is None else parts.cache_read,
            cost_cache_write_usd=None if parts is None else parts.cache_write,
        )


@dataclass
class TokenTracker:
    """Tracks cumulative token usage for a single session."""

    total_input_tokens: int = 0
    total_output_tokens: int = 0

    max_context_tokens: int = _DEFAULT_CONTEXT_WINDOW

    usage: TranscriptUsage = field(default_factory=TranscriptUsage)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    @property
    def total_tokens(self) -> int:
        """Return the combined input + output token count."""
        return self.total_input_tokens + self.total_output_tokens

    @property
    def context_utilization(self) -> float:
        """Return 0.0-1.0 ratio of tokens used vs. context window."""
        return (
            min(1.0, self.total_tokens / self.max_context_tokens)
            if self.max_context_tokens
            else 0.0
        )

    def session_usage(self) -> TokenUsage | None:
        """Return token totals for the session, or ``None`` if none were read."""
        return self.usage.summary()

    def update_from_event(self, event: AnyEvent) -> None:
        """Update token counts from an incoming event.

        Checks event data first (fast path), then reads the new part of the
        session transcript (and its subagent transcripts) for usage blocks.

        Args:
            event: The event to extract token data from.
        """
        if not event.data:
            return

        # Fast path: token counts embedded directly in event data.
        if event.data.input_tokens is not None or event.data.output_tokens is not None:
            if event.data.input_tokens is not None:
                self.total_input_tokens = event.data.input_tokens
            if event.data.output_tokens is not None:
                self.total_output_tokens = event.data.output_tokens
            logger.info(
                f"Context: {self.context_utilization:.1%} "
                f"({self.total_tokens:,}/{self.max_context_tokens:,} tokens)"
            )
            return

        # Slow path: read the transcripts incrementally.
        self.read_transcripts(event.data.transcript_path, event.data.agent_transcript_path)

    def read_transcripts(
        self, transcript_path: str | None, agent_transcript_path: str | None = None
    ) -> None:
        """Read new usage from the main transcript, its subagents and an agent file."""
        if transcript_path:
            main = self._prepare_transcript_path(transcript_path, size_cap=False)
            if main is None:
                return
            self.usage.read(main, main=True)
            self._read_subagent_transcripts(main)
        if agent_transcript_path:
            agent = self._prepare_transcript_path(agent_transcript_path, size_cap=False)
            if agent is not None:
                self.usage.read(agent, main=False)

        last = self.usage.last_main
        if last is None:
            return
        self.total_input_tokens = last.context_tokens
        self.total_output_tokens = last.output_tokens
        if self.usage.long_context or self.total_tokens > _DEFAULT_CONTEXT_WINDOW:
            self.max_context_tokens = _LONG_CONTEXT_WINDOW
        logger.debug(
            f"Context: {self.context_utilization:.1%} "
            f"({self.total_tokens:,}/{self.max_context_tokens:,} tokens)"
        )

    def _read_subagent_transcripts(self, main: Path) -> None:
        """Read ``<session>/subagents/*.jsonl`` next to the main transcript."""
        sub_dir = main.with_suffix("") / "subagents"
        if not sub_dir.is_dir():
            return
        for path in sorted(sub_dir.glob("*.jsonl")):
            if is_safe_transcript_path(path):
                self.usage.read(path, main=False)

    def _prepare_transcript_path(
        self, transcript_path: str, *, size_cap: bool = True
    ) -> Path | None:
        """Translate, confine, and existence-check a transcript path.

        Mirrors the contract used by ``jsonl_parser`` and ``transcript_poller``:
        host→container translation for Docker deployments, confinement to
        ``~/.claude/`` with a ``.jsonl`` extension, and a size cap to bound
        memory use. Returns the resolved path, or ``None`` if it is unsafe,
        missing, or too large.
        """
        from app.config import get_settings  # local import to avoid cycles

        translated = get_settings().translate_path(transcript_path)
        if not is_safe_transcript_path(translated):
            logger.warning("Rejected transcript path outside ~/.claude/: %s", translated)
            return None

        path = Path(translated)
        if not path.exists():
            return None
        if size_cap and path.stat().st_size > _MAX_TRANSCRIPT_BYTES:
            logger.warning("Transcript exceeds %d bytes, skipping: %s", _MAX_TRANSCRIPT_BYTES, path)
            return None
        return path

    def count_tool_uses_from_jsonl(self, transcript_path: str) -> int:
        """Count tool_use blocks in a JSONL transcript file.

        Args:
            transcript_path: Path to the JSONL file.

        Returns:
            Number of ``"type": "tool_use"`` entries found.
        """
        path = self._prepare_transcript_path(transcript_path)
        if path is None:
            return 0

        try:
            with open(path, encoding="utf-8", errors="ignore") as f:
                content = f.read()

            count = content.count('"type":"tool_use"')
            count += content.count('"type": "tool_use"')
            return count

        except (OSError, ValueError) as exc:
            logger.warning("Failed to count tool uses in %s: %s", transcript_path, exc)
            return 0

    def extract_thinking_from_jsonl(
        self, transcript_path: str, max_length: int = 200
    ) -> str | None:
        """Extract the most recent thinking block from a JSONL transcript.

        Args:
            transcript_path: Path to the JSONL file.
            max_length: Truncate the thinking text to this many characters.

        Returns:
            The latest thinking text, or None if not found.
        """
        path = self._prepare_transcript_path(transcript_path)
        if path is None:
            return None

        try:
            with open(path, "rb") as f:
                f.seek(0, 2)  # Go to end
                file_size = f.tell()
                read_size = min(_THINKING_READ_SIZE, file_size)
                f.seek(max(0, file_size - read_size))
                content = f.read().decode("utf-8", errors="ignore")

            latest_thinking: str | None = None
            search_start = 0
            while True:
                idx = content.find('"type":"thinking"', search_start)
                if idx == -1:
                    break

                thinking_start = content.find('"thinking":"', idx)
                if thinking_start == -1:
                    search_start = idx + 1
                    continue

                content_start = thinking_start + len('"thinking":"')
                # Find closing quote (handle escaped quotes)
                pos = content_start
                while pos < len(content):
                    if content[pos] == '"' and (pos == 0 or content[pos - 1] != "\\"):
                        break
                    pos += 1

                if pos < len(content):
                    thinking_text = content[content_start:pos]
                    # Unescape basic JSON escapes
                    thinking_text = (
                        thinking_text.replace('\\"', '"').replace("\\n", " ").replace("\\t", " ")
                    )
                    latest_thinking = thinking_text

                search_start = pos + 1

            if latest_thinking:
                if len(latest_thinking) > max_length:
                    latest_thinking = latest_thinking[: max_length - 3] + "..."
                return latest_thinking

        except (OSError, ValueError) as exc:
            logger.warning("Failed to extract thinking from %s: %s", transcript_path, exc)

        return None


# Trackers for sessions that are not loaded in memory (sessions list API),
# keyed by transcript path so repeated list calls only read new lines.
_MAX_CACHED_TRANSCRIPTS = 200
_transcript_trackers: dict[str, TokenTracker] = {}


def usage_for_transcript(transcript_path: str) -> TokenUsage | None:
    """Return session token totals for a transcript (blocking file I/O)."""
    tracker = _transcript_trackers.pop(transcript_path, None) or TokenTracker()
    tracker.read_transcripts(transcript_path)
    _transcript_trackers[transcript_path] = tracker  # most recently used last
    while len(_transcript_trackers) > _MAX_CACHED_TRANSCRIPTS:
        del _transcript_trackers[next(iter(_transcript_trackers))]
    return tracker.session_usage()

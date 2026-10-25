"""Token usage tracking extracted from StateMachine.

Encapsulates JSONL-based token extraction, tool-use counting,
and thinking-block extraction so StateMachine can delegate
these concerns instead of embedding file I/O in its dataclass body.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, cast

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

# Context window: 200k unless the session runs a 1M-context model, seen as a
# ``[1m]`` suffix on the model id or as a context larger than 200k tokens.
_DEFAULT_CONTEXT_WINDOW = 200_000
_LONG_CONTEXT_WINDOW = 1_000_000
_LONG_CONTEXT_MARKER = "[1m]"

# Estimated prices in USD per million tokens: (input, output).
# Keys are model ids without the date suffix; ``claude-x-4-5-20250929``
# matches ``claude-x-4-5``. Cache writes cost 1.25x input (5 min TTL) or 2x
# input (1 h TTL), cache reads 0.1x input. Long-context (>200k) surcharges
# are ignored, so 1M-context sessions are under-estimated.
# Source: https://docs.claude.com/en/docs/about-claude/pricing
MODEL_PRICES_USD_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-opus-4-5": (5.0, 25.0),
    "claude-opus-4-1": (15.0, 75.0),
    "claude-opus-4": (15.0, 75.0),
    "claude-sonnet-4-5": (3.0, 15.0),
    "claude-sonnet-4": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-3-5-haiku": (0.8, 4.0),
    # TODO: add prices once confirmed, e.g. claude-opus-4-6, claude-sonnet-4-6,
    # claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5. Until then sessions
    # using them show no cost (cost_usd = None) instead of a guessed one.
}
_CACHE_WRITE_5M_FACTOR = 1.25
_CACHE_WRITE_1H_FACTOR = 2.0
_CACHE_READ_FACTOR = 0.1

# Per-model token sums: (input, output, cache_read, cache_write_5m, cache_write_1h).
ModelTokens = tuple[int, int, int, int, int]


def _price_for_model(model: str) -> tuple[float, float] | None:
    """Look up a model's price; the id may carry a date or ``[1m]`` suffix."""
    base = model.lower().replace(_LONG_CONTEXT_MARKER, "")
    base = re.sub(r"-\d{8}$", "", base)
    return MODEL_PRICES_USD_PER_MTOK.get(base)


def estimate_cost_usd(tokens_by_model: dict[str, ModelTokens]) -> float | None:
    """Estimate the cost of a session from per-model token sums.

    Returns ``None`` when any model has no known price, so a partial sum is
    never shown as the full cost.
    """
    total = 0.0
    for model, tokens in tokens_by_model.items():
        price = _price_for_model(model)
        if price is None:
            return None
        inp, out, cache_read, cache_write_5m, cache_write_1h = tokens
        price_in, price_out = price
        total += (
            inp * price_in
            + out * price_out
            + cache_read * price_in * _CACHE_READ_FACTOR
            + cache_write_5m * price_in * _CACHE_WRITE_5M_FACTOR
            + cache_write_1h * price_in * _CACHE_WRITE_1H_FACTOR
        ) / 1_000_000
    return total


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
                chunk = f.read()
        except OSError as exc:
            logger.warning("Failed to read transcript %s: %s", path, exc)
            return
        end = chunk.rfind(b"\n")
        if end == -1:
            return  # no complete line yet
        self.offsets[path] = offset + end + 1
        for raw in chunk[: end + 1].split(b"\n"):
            if b'"usage"' not in raw:
                continue
            try:
                record = json.loads(raw)
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if not isinstance(record, dict):
                continue
            rec = cast(dict[str, Any], record)
            parsed = _parse_usage_record(rec)
            if parsed is None:
                continue
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

    def tokens_by_model(self) -> dict[str, ModelTokens]:
        sums: dict[str, list[int]] = {}
        for m in self.messages.values():
            row = sums.setdefault(m.model or "unknown", [0, 0, 0, 0, 0])
            row[0] += m.input_tokens
            row[1] += m.output_tokens
            row[2] += m.cache_read_tokens
            row[3] += m.cache_write_5m_tokens
            row[4] += m.cache_write_1h_tokens
        return {k: (v[0], v[1], v[2], v[3], v[4]) for k, v in sums.items()}

    def summary(self) -> TokenUsage | None:
        """Session totals, or ``None`` when no usage was read yet."""
        if not self.messages:
            return None
        by_model = self.tokens_by_model()
        return TokenUsage(
            input_tokens=sum(t[0] for t in by_model.values()),
            output_tokens=sum(t[1] for t in by_model.values()),
            cache_read_tokens=sum(t[2] for t in by_model.values()),
            cache_write_tokens=sum(t[3] + t[4] for t in by_model.values()),
            model=self.model,
            cost_usd=estimate_cost_usd(by_model),
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

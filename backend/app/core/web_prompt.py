"""Rules for prompts the owner types in the office UI (``POST /sessions/{id}/prompt``).

Pure helpers, kept apart from the route so each rule is tested on its own:
text sanitising, the client-IP and Origin allowlists, the rate limit, the
reason a session cannot take a prompt, and the append-only audit log.
"""

import hashlib
import hmac
import ipaddress
import json
import re
import time
import unicodedata
from collections import deque
from collections.abc import Callable, Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

MAX_PROMPT_CHARS = 8000

# Slash commands the web may send: /cost alone, /compact with optional focus text.
_SAFE_COMMAND = re.compile(r"/cost|/compact(?:\s.*)?", re.DOTALL)

ChatBlockReason = Literal[
    "disabled",
    "no_key",
    "inactive",
    "no_tmux",
    "pane_reused",
    "checking",
    "pane_gone",
    "not_claude",
    "permission_pending",
]

PaneState = Literal["claude", "gone", "not_claude"]


class PromptRejectedError(ValueError):
    """The text cannot be sent (empty, too long, or a shell-mode prefix)."""


def sanitize_prompt(text: str) -> str:
    """Return *text* safe to paste into a terminal, or raise PromptRejectedError.

    Every control character except newline is removed (ESC, Ctrl-C, NUL,
    C1 controls ...), so the text can neither end bracketed paste nor send
    keys. CR/CRLF become newlines and tabs become spaces.
    """
    if len(text) > MAX_PROMPT_CHARS:
        raise PromptRejectedError(f"Message is longer than {MAX_PROMPT_CHARS} characters")
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\t", "    ")
    cleaned = "".join(ch for ch in text if ch == "\n" or unicodedata.category(ch) != "Cc").strip()
    if not cleaned:
        raise PromptRejectedError("Message is empty")
    if cleaned.startswith("!"):
        # Claude Code runs "!..." as a shell command, without a permission prompt.
        raise PromptRejectedError("Messages starting with '!' (shell mode) are not allowed")
    if cleaned.startswith("#"):
        raise PromptRejectedError("Messages starting with '#' (memory) are not allowed")
    if cleaned.startswith("/") and not _SAFE_COMMAND.fullmatch(cleaned):
        # Slash commands can do anything; user commands may even run bash.
        raise PromptRejectedError("Only /compact and /cost are allowed from the web")
    return cleaned


_LOOPBACK = (ipaddress.ip_network("127.0.0.0/8"), ipaddress.ip_network("::1/128"))
# Tailscale address ranges (CGNAT IPv4 and the ULA prefix). Trusted only when
# a tailnet host is configured (WEB_PROMPT_TAILNET_HOST).
_TAILSCALE = (ipaddress.ip_network("100.64.0.0/10"), ipaddress.ip_network("fd7a:115c:a1e0::/48"))


def _ip(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return None
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        return addr.ipv4_mapped
    return addr


def is_allowed_client_ip(host: str | None, *, tailnet: bool = False) -> bool:
    """Loopback always; Tailscale addresses only with *tailnet* (IPv4-mapped too)."""
    addr = _ip(host) if host else None
    if addr is None:
        return False
    nets = _LOOPBACK + _TAILSCALE if tailnet else _LOOPBACK
    return any(addr in net for net in nets)


def is_allowed_origin(
    origin: str | None, configured: Iterable[str], tailnet_host: str = ""
) -> bool:
    """True when a browser Origin is ours.

    Configured CORS origins and loopback hosts pass; with *tailnet_host* set,
    that exact MagicDNS name and Tailscale IPs pass too. A missing Origin
    (non-browser client) passes; the API key gates those.
    """
    if origin is None:
        return True
    origin = origin.rstrip("/")
    if origin in {o.rstrip("/") for o in configured}:
        return True
    try:
        parsed = urlparse(origin)
        host = parsed.hostname
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or not host:
        return False
    if host == "localhost":
        return True
    if tailnet_host and host == tailnet_host.lower().rstrip("."):
        return True
    return is_allowed_client_ip(host, tailnet=bool(tailnet_host))


class PromptRateLimiter:
    """Sliding 60 s windows: *per_session* per session and *overall* in total.

    Same deque-of-timestamps pattern as the event limiter in
    ``routes/events.py``. An attempt is recorded only when both budgets
    have room, so a blocked session does not eat the shared budget.
    """

    def __init__(
        self,
        per_session: int = 5,
        overall: int = 20,
        window: float = 60.0,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.per_session = per_session
        self.overall = overall
        self.window = window
        self._clock = clock
        self._sessions: dict[str, deque[float]] = {}
        self._all: deque[float] = deque()

    def reset(self) -> None:
        self._sessions.clear()
        self._all.clear()

    def allow(self, session_id: str) -> bool:
        now = self._clock()
        cutoff = now - self.window
        while self._all and self._all[0] <= cutoff:
            self._all.popleft()
        for sid in [s for s, dq in self._sessions.items() if not dq or dq[-1] <= cutoff]:
            del self._sessions[sid]
        times = self._sessions.setdefault(session_id, deque())
        while times and times[0] <= cutoff:
            times.popleft()
        if len(times) >= self.per_session or len(self._all) >= self.overall:
            return False
        times.append(now)
        self._all.append(now)
        return True


def chat_block_reason(
    *,
    enabled: bool,
    has_explicit_key: bool,
    active: bool,
    pane: str | None,
    pane_state: PaneState | None,
    pane_taken: bool,
    permission_pending: bool,
) -> ChatBlockReason | None:
    """Why a session cannot take a web prompt right now, or None if it can."""
    if not enabled:
        return "disabled"
    if not has_explicit_key:
        return "no_key"
    if not active:
        return "inactive"
    if not pane:
        return "no_tmux"
    if pane_taken:
        return "pane_reused"
    if pane_state is None:
        return "checking"  # the background pane check has not run yet
    if pane_state == "gone":
        return "pane_gone"
    if pane_state == "not_claude":
        return "not_claude"
    if permission_pending:
        return "permission_pending"
    return None


def append_audit(
    path: Path,
    *,
    key: str,
    client_ip: str | None,
    origin: str | None,
    session_id: str,
    pane: str | None,
    text: str,
    outcome: str,
) -> None:
    """Append one JSON line per attempt.

    The text is never stored: only its length and an HMAC-SHA256 keyed by
    the API key (a plain hash of a short text could be brute-forced).
    """
    record = {
        "time": datetime.now(UTC).isoformat(),
        "client_ip": client_ip,
        "origin": origin,
        "session_id": session_id,
        "pane": pane,
        "length": len(text),
        "hmac": hmac.new(key.encode("utf-8"), text.encode("utf-8"), hashlib.sha256).hexdigest(),
        "outcome": outcome,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record) + "\n")

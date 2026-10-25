"""Talk to the tmux server the Claude Code sessions run in.

Two jobs: tell whether a pane still runs Claude, and paste a prompt into it
(bracketed paste, then Enter). Commands run with
``asyncio.create_subprocess_exec`` only, never a shell; the prompt text goes
in through stdin (``load-buffer -``), never through argv. The runner is
injectable so tests use a fake tmux.
"""

import asyncio
import logging
import re
import secrets
import time
import unicodedata
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from pathlib import PurePosixPath

from app.core.web_prompt import PaneState

logger = logging.getLogger(__name__)

_PANE_ID = re.compile(r"%\d+")
_VERSION_NAME = re.compile(r"\d+\.\d+\.\d+")
_LIST_FORMAT = "#{pane_id} #{pane_tty} #{pane_current_command}"
_COMMAND_TIMEOUT = 5.0


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    stdout: bytes
    stderr: bytes


Runner = Callable[[Sequence[str], bytes | None], Awaitable[CommandResult]]


class TmuxError(RuntimeError):
    """A tmux command failed while sending a prompt."""


def is_valid_pane_id(pane: str) -> bool:
    """tmux pane ids look like ``%7``; anything else is refused."""
    return bool(_PANE_ID.fullmatch(pane))


async def run_command(argv: Sequence[str], stdin: bytes | None) -> CommandResult:
    """Run *argv* without a shell, feeding *stdin*; time out after a few seconds."""
    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            stdin=asyncio.subprocess.PIPE if stdin is not None else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except OSError as exc:  # tmux / ps not installed
        return CommandResult(127, b"", str(exc).encode())
    try:
        out, err = await asyncio.wait_for(proc.communicate(stdin), _COMMAND_TIMEOUT)
    except TimeoutError:
        proc.kill()
        await proc.wait()
        return CommandResult(124, b"", b"timeout")
    return CommandResult(proc.returncode or 0, out, err)


def _runs_claude(args_lines: str) -> bool:
    """True when one of the process command lines on a tty is Claude Code."""
    for line in args_lines.splitlines():
        if "@anthropic-ai/claude-code" in line:
            return True
        if any(PurePosixPath(word).name == "claude" for word in line.split()[:2]):
            return True
    return False


class TmuxService:
    """Pane checks (briefly cached for state broadcasts) and prompt delivery."""

    def __init__(
        self,
        runner: Runner = run_command,
        cache_ttl: float = 2.0,
        clock: Callable[[], float] = time.monotonic,
        enter_delay: float = 0.15,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._run = runner
        self._ttl = cache_ttl
        self._clock = clock
        self._enter_delay = enter_delay
        self._sleep = sleep
        self._cache: dict[str, PaneState] | None = None
        self._cached_at = 0.0
        self._lock = asyncio.Lock()

    async def pane_state(self, pane: str, *, fresh: bool = False) -> PaneState:
        """``claude``, ``not_claude`` or ``gone`` for *pane*."""
        if not is_valid_pane_id(pane):
            return "gone"
        states = await self._pane_states(fresh=fresh)
        return states.get(pane, "gone")

    async def _pane_states(self, *, fresh: bool) -> dict[str, PaneState]:
        async with self._lock:
            now = self._clock()
            if not fresh and self._cache is not None and now - self._cached_at < self._ttl:
                return self._cache
            states = await self._read_panes()
            self._cache = states
            self._cached_at = now
            return states

    async def _read_panes(self) -> dict[str, PaneState]:
        result = await self._run(["tmux", "list-panes", "-a", "-F", _LIST_FORMAT], None)
        if result.returncode != 0:
            return {}  # no tmux server: every pane is gone
        states: dict[str, PaneState] = {}
        for line in result.stdout.decode("utf-8", "replace").splitlines():
            parts = line.split(" ", 2)
            if len(parts) != 3 or not is_valid_pane_id(parts[0]):
                continue
            pane, tty, command = parts
            states[pane] = await self._classify(tty, command.strip())
        return states

    async def _classify(self, tty: str, command: str) -> PaneState:
        if command == "claude":
            return "claude"
        # npm installs show up as node; a direct launch of the native binary
        # shows its version-named file. Look at the command lines on the tty.
        if command == "node" or _VERSION_NAME.fullmatch(command):
            name = tty.removeprefix("/dev/")
            result = await self._run(["ps", "-o", "args=", "-t", name], None)
            if result.returncode == 0 and _runs_claude(result.stdout.decode("utf-8", "replace")):
                return "claude"
        return "not_claude"

    async def send_prompt(self, pane: str, text: str) -> None:
        """Paste *text* into *pane* as one bracketed paste, then press Enter."""
        if not is_valid_pane_id(pane):
            raise ValueError("invalid tmux pane id")
        if any(ch != "\n" and unicodedata.category(ch) == "Cc" for ch in text):
            raise ValueError("prompt text contains control characters")
        buffer = f"claude-office-{secrets.token_hex(4)}"
        loaded = await self._run(["tmux", "load-buffer", "-b", buffer, "-"], text.encode("utf-8"))
        if loaded.returncode != 0:
            raise TmuxError("tmux load-buffer failed")
        pasted = await self._run(
            ["tmux", "paste-buffer", "-p", "-r", "-d", "-b", buffer, "-t", pane], None
        )
        if pasted.returncode != 0:
            await self._run(["tmux", "delete-buffer", "-b", buffer], None)
            raise TmuxError("tmux paste-buffer failed")
        # Let the TUI finish handling the paste before the submit key.
        await self._sleep(self._enter_delay)
        entered = await self._run(["tmux", "send-keys", "-t", pane, "Enter"], None)
        if entered.returncode != 0:
            raise TmuxError("tmux send-keys failed")
        self._cache = None  # the pane was just used; re-read it next time


_service: TmuxService | None = None


def get_tmux_service() -> TmuxService:
    global _service
    if _service is None:
        _service = TmuxService()
    return _service


def override_tmux_service(service: TmuxService | None) -> None:
    """Swap the process-wide service (tests use a fake tmux runner)."""
    global _service
    _service = service

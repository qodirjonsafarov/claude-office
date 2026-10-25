"""Talk to the tmux server the Claude Code sessions run in.

Two jobs: tell whether a pane still runs Claude, and paste a prompt into it
(bracketed paste, then Enter) - only when the screen shows an empty normal
prompt (``core.terminal_screen``), with one send per pane at a time and a
fresh check right before Enter. Every command names the session's tmux
socket (``-S``) when the hook reported one, so ``%N`` cannot hit another
tmux server. Commands run with
``asyncio.create_subprocess_exec`` only, never a shell; the prompt text goes
in through stdin (``load-buffer -``), never through argv. The runner is
injectable so tests use a fake tmux.
"""

import asyncio
import logging
import os
import re
import secrets
import stat
import time
import unicodedata
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from pathlib import PurePosixPath

from app.core.terminal_screen import screen_block_reason
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


class PaneBusyError(TmuxError):
    """The screen is not an empty normal prompt (dialog, draft, shell mode...)."""

    def __init__(self, reason: str) -> None:
        super().__init__(f"terminal busy: {reason}")
        self.reason = reason


class PaneChangedError(TmuxError):
    """The pane stopped running Claude between the paste and Enter."""

    def __init__(self, state: PaneState) -> None:
        super().__init__(f"pane changed: {state}")
        self.state = state


def socket_from_tmux_env(value: str | None) -> str | None:
    """Socket path from a ``$TMUX`` value (``/tmp/tmux-1000/default,PID,N``)."""
    path = (value or "").split(",", 1)[0]
    return path if path.startswith("/") else None


def is_usable_socket(path: str) -> bool:
    """An existing Unix socket owned by this user (never an arbitrary file)."""
    try:
        st = os.stat(path)
    except (OSError, ValueError):
        return False
    return stat.S_ISSOCK(st.st_mode) and st.st_uid == os.getuid()


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
    """Pane checks (briefly cached) and prompt delivery."""

    def __init__(
        self,
        runner: Runner = run_command,
        cache_ttl: float = 2.0,
        clock: Callable[[], float] = time.monotonic,
        enter_delay: float = 0.15,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        socket_check: Callable[[str], bool] = is_usable_socket,
    ) -> None:
        self._run = runner
        self._ttl = cache_ttl
        self._clock = clock
        self._enter_delay = enter_delay
        self._sleep = sleep
        self._socket_ok = socket_check
        # socket -> (read at, {pane: (tty, command)}) from one list-panes call
        self._panes: dict[str | None, tuple[float, dict[str, tuple[str, str]]]] = {}
        # (socket, pane) -> (classified at, state)
        self._states: dict[tuple[str | None, str], tuple[float, PaneState]] = {}
        self._list_lock = asyncio.Lock()
        self._send_locks: dict[tuple[str | None, str], asyncio.Lock] = {}

    @staticmethod
    def _tmux(socket: str | None, *args: str) -> list[str]:
        return ["tmux", "-S", socket, *args] if socket else ["tmux", *args]

    def cached_state(self, pane: str, socket: str | None = None) -> PaneState | None:
        """Last known state of *pane* without running anything (None if unknown)."""
        hit = self._states.get((socket, pane))
        return hit[1] if hit else None

    async def pane_state(
        self, pane: str, socket: str | None = None, *, fresh: bool = False
    ) -> PaneState:
        """``claude``, ``not_claude`` or ``gone`` for *pane*."""
        if not is_valid_pane_id(pane) or (socket is not None and not self._socket_ok(socket)):
            return "gone"
        now = self._clock()
        hit = self._states.get((socket, pane))
        if not fresh and hit and now - hit[0] < self._ttl:
            return hit[1]
        panes = await self._list_panes(socket, fresh=fresh)
        info = panes.get(pane)
        state: PaneState = "gone" if info is None else await self._classify(*info)
        self._states[(socket, pane)] = (now, state)
        return state

    async def _list_panes(self, socket: str | None, *, fresh: bool) -> dict[str, tuple[str, str]]:
        async with self._list_lock:
            now = self._clock()
            hit = self._panes.get(socket)
            if not fresh and hit and now - hit[0] < self._ttl:
                return hit[1]
            result = await self._run(
                self._tmux(socket, "list-panes", "-a", "-F", _LIST_FORMAT), None
            )
            panes: dict[str, tuple[str, str]] = {}
            if result.returncode == 0:  # else no tmux server: every pane is gone
                for line in result.stdout.decode("utf-8", "replace").splitlines():
                    parts = line.split(" ", 2)
                    if len(parts) == 3 and is_valid_pane_id(parts[0]):
                        panes[parts[0]] = (parts[1], parts[2].strip())
            self._panes[socket] = (now, panes)
            return panes

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

    async def _screen(self, socket: str | None, pane: str) -> str:
        result = await self._run(self._tmux(socket, "capture-pane", "-p", "-e", "-t", pane), None)
        if result.returncode != 0:
            raise PaneChangedError("gone")
        return result.stdout.decode("utf-8", "replace")

    async def send_prompt(self, pane: str, text: str, socket: str | None = None) -> None:
        """Paste *text* into *pane* as one bracketed paste, then press Enter.

        Raises PaneBusyError when the screen is not an empty prompt (before)
        or the paste did not land in the prompt (after), and PaneChangedError
        when the pane stopped running Claude before Enter.
        """
        if not is_valid_pane_id(pane):
            raise ValueError("invalid tmux pane id")
        if socket is not None and not self._socket_ok(socket):
            raise ValueError("invalid tmux socket")
        if any(ch != "\n" and unicodedata.category(ch) == "Cc" for ch in text):
            raise ValueError("prompt text contains control characters")
        lock = self._send_locks.setdefault((socket, pane), asyncio.Lock())
        async with lock:
            await self._send_locked(pane, text, socket)

    async def _send_locked(self, pane: str, text: str, socket: str | None) -> None:
        reason = screen_block_reason(await self._screen(socket, pane))
        if reason:
            raise PaneBusyError(reason)

        buffer = f"claude-office-{secrets.token_hex(4)}"
        loaded = await self._run(
            self._tmux(socket, "load-buffer", "-b", buffer, "-"), text.encode("utf-8")
        )
        if loaded.returncode != 0:
            raise TmuxError("tmux load-buffer failed")
        pasted = await self._run(
            self._tmux(socket, "paste-buffer", "-p", "-r", "-d", "-b", buffer, "-t", pane), None
        )
        if pasted.returncode != 0:
            await self._run(self._tmux(socket, "delete-buffer", "-b", buffer), None)
            raise TmuxError("tmux paste-buffer failed")
        # Let the TUI finish handling the paste before the submit key.
        await self._sleep(self._enter_delay)

        state = await self.pane_state(pane, socket, fresh=True)
        if state != "claude":
            if state == "not_claude":
                # Whatever runs there now must not execute our text.
                await self._run(self._tmux(socket, "send-keys", "-t", pane, "C-u"), None)
            raise PaneChangedError(state)
        reason = screen_block_reason(await self._screen(socket, pane), after_paste=True)
        if reason:
            raise PaneBusyError(reason)

        entered = await self._run(self._tmux(socket, "send-keys", "-t", pane, "Enter"), None)
        if entered.returncode != 0:
            raise TmuxError("tmux send-keys failed")


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

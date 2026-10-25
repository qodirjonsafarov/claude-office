"""TmuxService against a fake tmux: pane checks, screen check, paste/Enter, lock.

No test here runs the real tmux binary or touches a real pane.
"""

import asyncio
from collections.abc import Sequence
from pathlib import Path

import pytest

from app.services.tmux_service import (
    CommandResult,
    PaneBusyError,
    PaneChangedError,
    TmuxError,
    TmuxService,
    is_valid_pane_id,
    socket_from_tmux_env,
)

FIXTURES = Path(__file__).parent / "fixtures" / "claude_screens"
READY = (FIXTURES / "idle_after_reply.ansi").read_text(encoding="utf-8")
DRAFT = (FIXTURES / "draft.ansi").read_text(encoding="utf-8")
DIALOG = (FIXTURES / "dialog_above_prompt.ansi").read_text(encoding="utf-8")
SOCKET = "/tmp/tmux-1000/default"

PANES = "%0 /dev/pts/4 make\n%7 /dev/pts/9 claude\n%9 /dev/pts/12 cat\n%11 /dev/pts/13 node\n"


class FakeTmux:
    """Records every command; answers list-panes, ps and capture-pane from canned output.

    ``screens`` are returned by successive capture-pane calls (the last one
    repeats). By default the pane shows an empty prompt before the paste and
    the pasted text after it.
    """

    def __init__(self, panes: str = PANES, ps: dict[str, str] | None = None) -> None:
        self.panes = panes
        self.ps = ps or {}
        self.calls: list[tuple[list[str], bytes | None]] = []
        self.fail: set[str] = set()
        self.list_returncode = 0
        self.screens: list[str] = [READY, DRAFT]
        self.after_paste_panes: str | None = None  # list-panes output once pasted

    @staticmethod
    def verb(argv: list[str]) -> str:
        return argv[3] if argv[1] == "-S" else argv[1]

    async def __call__(self, argv: Sequence[str], stdin: bytes | None) -> CommandResult:
        argv = list(argv)
        self.calls.append((argv, stdin))
        if argv[0] == "ps":
            return CommandResult(0, self.ps.get(argv[-1], "").encode(), b"")
        verb = self.verb(argv)
        if verb in self.fail:
            return CommandResult(1, b"", b"boom")
        if verb == "list-panes":
            pasted = any(self.verb(a) == "paste-buffer" for a, _ in self.calls if a[0] == "tmux")
            panes = self.after_paste_panes if pasted and self.after_paste_panes else self.panes
            return CommandResult(self.list_returncode, panes.encode(), b"")
        if verb == "capture-pane":
            screen = self.screens.pop(0) if len(self.screens) > 1 else self.screens[0]
            return CommandResult(0, screen.encode(), b"")
        return CommandResult(0, b"", b"")

    def commands(self) -> list[list[str]]:
        return [argv for argv, _ in self.calls]

    def verbs(self) -> list[str]:
        return [self.verb(a) if a[0] == "tmux" else a[0] for a in self.commands()]

    def list_calls(self) -> int:
        return self.verbs().count("list-panes")


async def _no_sleep(_: float) -> None:
    return None


def _any_socket(_path: str) -> bool:
    return True


def _no_socket(_path: str) -> bool:
    return False


def _service(fake: FakeTmux, **kwargs: object) -> TmuxService:
    kwargs.setdefault("socket_check", _any_socket)
    return TmuxService(runner=fake, sleep=_no_sleep, **kwargs)  # type: ignore[arg-type]


class TestPaneId:
    @pytest.mark.parametrize("pane", ["%0", "%7", "%123"])
    def test_valid(self, pane: str) -> None:
        assert is_valid_pane_id(pane)

    @pytest.mark.parametrize("pane", ["", "7", "%", "%7;ls", "%-1", "main:0.1", "%7 "])
    def test_invalid(self, pane: str) -> None:
        assert not is_valid_pane_id(pane)


class TestSocketFromEnv:
    def test_takes_the_path_before_the_first_comma(self) -> None:
        assert socket_from_tmux_env("/tmp/tmux-1000/default,212036,0") == SOCKET

    @pytest.mark.parametrize("value", [None, "", "relative/path,1,0", ",1,0"])
    def test_no_socket(self, value: str | None) -> None:
        assert socket_from_tmux_env(value) is None


class TestPaneState:
    async def test_list_panes_command_shape(self) -> None:
        fake = FakeTmux()
        await _service(fake).pane_state("%7")
        assert fake.commands()[0] == [
            "tmux",
            "list-panes",
            "-a",
            "-F",
            "#{pane_id} #{pane_tty} #{pane_current_command}",
        ]

    async def test_socket_is_passed_to_tmux(self) -> None:
        fake = FakeTmux()
        assert await _service(fake).pane_state("%7", socket=SOCKET) == "claude"
        assert fake.commands()[0][:3] == ["tmux", "-S", SOCKET]

    async def test_bad_socket_means_gone_without_running_tmux(self) -> None:
        fake = FakeTmux()
        svc = _service(fake, socket_check=_no_socket)
        assert await svc.pane_state("%7", socket="/tmp/not-a-socket") == "gone"
        assert fake.calls == []

    async def test_claude_pane(self) -> None:
        assert await _service(FakeTmux()).pane_state("%7") == "claude"

    async def test_cat_pane_is_not_claude(self) -> None:
        assert await _service(FakeTmux()).pane_state("%9") == "not_claude"

    async def test_missing_pane_is_gone(self) -> None:
        assert await _service(FakeTmux()).pane_state("%42") == "gone"

    async def test_invalid_pane_id_is_gone_without_running_tmux(self) -> None:
        fake = FakeTmux()
        assert await _service(fake).pane_state("%7;rm") == "gone"
        assert fake.calls == []

    async def test_no_tmux_server_means_gone(self) -> None:
        fake = FakeTmux()
        fake.list_returncode = 1
        assert await _service(fake).pane_state("%7") == "gone"

    async def test_node_running_claude_counts(self) -> None:
        fake = FakeTmux(
            ps={"pts/13": "-zsh\nnode /usr/lib/node_modules/@anthropic-ai/claude-code/cli.js\n"},
        )
        assert await _service(fake).pane_state("%11") == "claude"
        assert ["ps", "-o", "args=", "-t", "pts/13"] in fake.commands()

    async def test_node_running_something_else_is_not_claude(self) -> None:
        fake = FakeTmux(ps={"pts/13": "-zsh\nnode server.js\n"})
        assert await _service(fake).pane_state("%11") == "not_claude"

    async def test_only_the_asked_pane_is_classified(self) -> None:
        # %11 runs node: classifying it needs ps. Asking about %7 must not.
        fake = FakeTmux()
        await _service(fake).pane_state("%7")
        assert "ps" not in fake.verbs()

    async def test_result_is_cached_until_ttl(self) -> None:
        now = [100.0]
        fake = FakeTmux()
        svc = _service(fake, cache_ttl=2.0, clock=lambda: now[0])
        await svc.pane_state("%7")
        await svc.pane_state("%9")
        assert fake.list_calls() == 1
        now[0] += 2.5
        await svc.pane_state("%7")
        assert fake.list_calls() == 2

    async def test_fresh_skips_cache(self) -> None:
        fake = FakeTmux()
        svc = _service(fake, cache_ttl=60.0)
        await svc.pane_state("%7")
        await svc.pane_state("%7", fresh=True)
        assert fake.list_calls() == 2

    async def test_cached_state_never_runs_tmux(self) -> None:
        fake = FakeTmux()
        svc = _service(fake, cache_ttl=60.0)
        assert svc.cached_state("%7") is None
        await svc.pane_state("%7")
        calls = len(fake.calls)
        assert svc.cached_state("%7") == "claude"
        assert len(fake.calls) == calls


class TestSendPrompt:
    async def test_checks_screen_pastes_rechecks_then_enter(self) -> None:
        fake = FakeTmux()
        await _service(fake).send_prompt("%7", "hello\nworld")

        assert fake.verbs() == [
            "capture-pane",
            "load-buffer",
            "paste-buffer",
            "list-panes",
            "capture-pane",
            "send-keys",
        ]
        cmds = fake.commands()
        assert cmds[0] == ["tmux", "capture-pane", "-p", "-e", "-t", "%7"]
        load, load_stdin = fake.calls[1]
        buffer = load[3]
        assert load == ["tmux", "load-buffer", "-b", buffer, "-"]
        assert buffer.startswith("claude-office-")
        assert load_stdin == b"hello\nworld"
        assert cmds[2] == ["tmux", "paste-buffer", "-p", "-r", "-d", "-b", buffer, "-t", "%7"]
        assert cmds[-1] == ["tmux", "send-keys", "-t", "%7", "Enter"]

    async def test_every_command_uses_the_socket(self) -> None:
        fake = FakeTmux()
        await _service(fake).send_prompt("%7", "hi", socket=SOCKET)
        assert all(a[1:3] == ["-S", SOCKET] for a in fake.commands() if a[0] == "tmux")

    @pytest.mark.parametrize(("screen", "reason"), [(DRAFT, "draft"), (DIALOG, "dialog")])
    async def test_busy_screen_refuses_before_typing(self, screen: str, reason: str) -> None:
        fake = FakeTmux()
        fake.screens = [screen]
        with pytest.raises(PaneBusyError) as exc:
            await _service(fake).send_prompt("%7", "1")
        assert exc.value.reason == reason
        assert fake.verbs() == ["capture-pane"]

    async def test_pane_no_longer_claude_clears_line_instead_of_enter(self) -> None:
        fake = FakeTmux()
        fake.after_paste_panes = "%7 /dev/pts/9 zsh\n"  # claude exited during the paste
        with pytest.raises(PaneChangedError):
            await _service(fake).send_prompt("%7", "rm -rf build")
        assert ["tmux", "send-keys", "-t", "%7", "C-u"] in fake.commands()
        assert ["tmux", "send-keys", "-t", "%7", "Enter"] not in fake.commands()

    async def test_pane_gone_after_paste_sends_nothing(self) -> None:
        fake = FakeTmux()
        fake.after_paste_panes = "%0 /dev/pts/4 make\n"
        with pytest.raises(PaneChangedError):
            await _service(fake).send_prompt("%7", "hi")
        assert "send-keys" not in fake.verbs()

    async def test_dialog_after_paste_skips_enter(self) -> None:
        fake = FakeTmux()
        fake.screens = [READY, DIALOG]
        with pytest.raises(PaneBusyError) as exc:
            await _service(fake).send_prompt("%7", "hi")
        assert exc.value.reason == "dialog"
        assert "send-keys" not in fake.verbs()

    async def test_two_sends_to_one_pane_do_not_interleave(self) -> None:
        fake = FakeTmux()
        fake.screens = [READY, DRAFT, READY, DRAFT]
        order: list[str] = []

        async def runner(argv: Sequence[str], stdin: bytes | None) -> CommandResult:
            verb = FakeTmux.verb(list(argv)) if argv[0] == "tmux" else argv[0]
            order.append(verb)
            if verb == "paste-buffer":
                await asyncio.sleep(0.01)  # give the other send a chance to run
            return await fake(argv, stdin)

        svc = TmuxService(runner=runner, sleep=_no_sleep, socket_check=_any_socket)
        await asyncio.gather(svc.send_prompt("%7", "one"), svc.send_prompt("%7", "two"))
        first_enter = order.index("send-keys")
        assert order[: first_enter + 1].count("load-buffer") == 1
        assert order.count("send-keys") == 2

    async def test_text_never_goes_into_argv(self) -> None:
        fake = FakeTmux()
        await _service(fake).send_prompt("%7", "secret words")
        assert all("secret words" not in " ".join(argv) for argv in fake.commands())

    async def test_control_characters_are_refused(self) -> None:
        fake = FakeTmux()
        with pytest.raises(ValueError):
            await _service(fake).send_prompt("%7", "hi\x1b[201~")
        assert fake.calls == []

    async def test_invalid_pane_is_refused(self) -> None:
        fake = FakeTmux()
        with pytest.raises(ValueError):
            await _service(fake).send_prompt("main:0", "hi")
        assert fake.calls == []

    async def test_failed_paste_raises_and_skips_enter(self) -> None:
        fake = FakeTmux()
        fake.fail.add("paste-buffer")
        with pytest.raises(TmuxError):
            await _service(fake).send_prompt("%7", "hi")
        assert "send-keys" not in fake.verbs()
        # The named buffer is cleaned up so it does not linger in tmux.
        assert "delete-buffer" in fake.verbs()

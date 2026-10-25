"""TmuxService against a fake tmux: pane checks and the paste/Enter sequence.

No test here runs the real tmux binary or touches a real pane.
"""

from collections.abc import Sequence

import pytest

from app.services.tmux_service import CommandResult, TmuxError, TmuxService, is_valid_pane_id

_LIST = ("tmux", "list-panes")


class FakeTmux:
    """Records every command and answers list-panes / ps from canned output."""

    def __init__(self, panes: str = "", ps: dict[str, str] | None = None) -> None:
        self.panes = panes
        self.ps = ps or {}
        self.calls: list[tuple[list[str], bytes | None]] = []
        self.fail: set[str] = set()
        self.list_returncode = 0

    async def __call__(self, argv: Sequence[str], stdin: bytes | None) -> CommandResult:
        argv = list(argv)
        self.calls.append((argv, stdin))
        if argv[0] == "tmux" and argv[1] in self.fail:
            return CommandResult(1, b"", b"boom")
        if tuple(argv[:2]) == _LIST:
            return CommandResult(self.list_returncode, self.panes.encode(), b"")
        if argv[0] == "ps":
            return CommandResult(0, self.ps.get(argv[-1], "").encode(), b"")
        return CommandResult(0, b"", b"")

    def commands(self) -> list[list[str]]:
        return [argv for argv, _ in self.calls]

    def list_calls(self) -> int:
        return sum(1 for argv in self.commands() if tuple(argv[:2]) == _LIST)


async def _no_sleep(_: float) -> None:
    return None


def _service(fake: FakeTmux, **kwargs: object) -> TmuxService:
    return TmuxService(runner=fake, sleep=_no_sleep, **kwargs)  # type: ignore[arg-type]


PANES = "%0 /dev/pts/4 make\n%7 /dev/pts/9 claude\n%9 /dev/pts/12 cat\n%11 /dev/pts/13 node\n"


class TestPaneId:
    @pytest.mark.parametrize("pane", ["%0", "%7", "%123"])
    def test_valid(self, pane: str) -> None:
        assert is_valid_pane_id(pane)

    @pytest.mark.parametrize("pane", ["", "7", "%", "%7;ls", "%-1", "main:0.1", "%7 "])
    def test_invalid(self, pane: str) -> None:
        assert not is_valid_pane_id(pane)


class TestPaneState:
    async def test_list_panes_command_shape(self) -> None:
        fake = FakeTmux(PANES)
        await _service(fake).pane_state("%7")
        assert fake.commands()[0] == [
            "tmux",
            "list-panes",
            "-a",
            "-F",
            "#{pane_id} #{pane_tty} #{pane_current_command}",
        ]

    async def test_claude_pane(self) -> None:
        assert await _service(FakeTmux(PANES)).pane_state("%7") == "claude"

    async def test_cat_pane_is_not_claude(self) -> None:
        assert await _service(FakeTmux(PANES)).pane_state("%9") == "not_claude"

    async def test_missing_pane_is_gone(self) -> None:
        assert await _service(FakeTmux(PANES)).pane_state("%42") == "gone"

    async def test_invalid_pane_id_is_gone_without_running_tmux(self) -> None:
        fake = FakeTmux(PANES)
        assert await _service(fake).pane_state("%7;rm") == "gone"
        assert fake.calls == []

    async def test_no_tmux_server_means_gone(self) -> None:
        fake = FakeTmux(PANES)
        fake.list_returncode = 1
        assert await _service(fake).pane_state("%7") == "gone"

    async def test_node_running_claude_counts(self) -> None:
        fake = FakeTmux(
            PANES,
            ps={"pts/13": "-zsh\nnode /usr/lib/node_modules/@anthropic-ai/claude-code/cli.js\n"},
        )
        assert await _service(fake).pane_state("%11") == "claude"
        assert ["ps", "-o", "args=", "-t", "pts/13"] in fake.commands()

    async def test_node_running_something_else_is_not_claude(self) -> None:
        fake = FakeTmux(PANES, ps={"pts/13": "-zsh\nnode server.js\n"})
        assert await _service(fake).pane_state("%11") == "not_claude"

    async def test_result_is_cached_until_ttl(self) -> None:
        now = [100.0]
        fake = FakeTmux(PANES)
        svc = _service(fake, cache_ttl=2.0, clock=lambda: now[0])
        await svc.pane_state("%7")
        await svc.pane_state("%9")
        assert fake.list_calls() == 1
        now[0] += 2.5
        await svc.pane_state("%7")
        assert fake.list_calls() == 2

    async def test_fresh_skips_cache(self) -> None:
        fake = FakeTmux(PANES)
        svc = _service(fake, cache_ttl=60.0)
        await svc.pane_state("%7")
        await svc.pane_state("%7", fresh=True)
        assert fake.list_calls() == 2


class TestSendPrompt:
    async def test_paste_then_enter(self) -> None:
        fake = FakeTmux(PANES)
        await _service(fake).send_prompt("%7", "hello\nworld")

        (load, load_stdin), (paste, _), (enter, _) = fake.calls
        assert load[:3] == ["tmux", "load-buffer", "-b"]
        buffer = load[3]
        assert buffer.startswith("claude-office-")
        assert load[4:] == ["-"]
        assert load_stdin == b"hello\nworld"
        assert paste == ["tmux", "paste-buffer", "-p", "-r", "-d", "-b", buffer, "-t", "%7"]
        assert enter == ["tmux", "send-keys", "-t", "%7", "Enter"]

    async def test_text_never_goes_into_argv(self) -> None:
        fake = FakeTmux(PANES)
        await _service(fake).send_prompt("%7", "secret words")
        assert all("secret words" not in " ".join(argv) for argv in fake.commands())

    async def test_control_characters_are_refused(self) -> None:
        fake = FakeTmux(PANES)
        with pytest.raises(ValueError):
            await _service(fake).send_prompt("%7", "hi\x1b[201~")
        assert fake.calls == []

    async def test_invalid_pane_is_refused(self) -> None:
        fake = FakeTmux(PANES)
        with pytest.raises(ValueError):
            await _service(fake).send_prompt("main:0", "hi")
        assert fake.calls == []

    async def test_failed_paste_raises_and_skips_enter(self) -> None:
        fake = FakeTmux(PANES)
        fake.fail.add("paste-buffer")
        with pytest.raises(TmuxError):
            await _service(fake).send_prompt("%7", "hi")
        assert not any(argv[1] == "send-keys" for argv in fake.commands())
        # The named buffer is cleaned up so it does not linger in tmux.
        assert any(argv[1] == "delete-buffer" for argv in fake.commands())

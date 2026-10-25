"""Tests for the terminal-raise and clipboard commands of POST /sessions/{id}/focus."""

from collections.abc import Callable

from app.api.routes.sessions import clipboard_command, terminal_raise_command

WAYLAND = {"WAYLAND_DISPLAY": "wayland-0", "XDG_SESSION_TYPE": "wayland"}
X11 = {"DISPLAY": ":0", "XDG_SESSION_TYPE": "x11"}


def _which(*installed: str) -> Callable[[str], str | None]:
    def which(name: str) -> str | None:
        return f"/usr/bin/{name}" if name in installed else None

    return which


class TestClipboardCommand:
    def test_wayland_uses_wl_copy(self) -> None:
        cmd = clipboard_command("linux", WAYLAND, _which("wl-copy", "xclip"))
        assert cmd == ["wl-copy"]

    def test_x11_uses_xclip(self) -> None:
        cmd = clipboard_command("linux", X11, _which("wl-copy", "xclip"))
        assert cmd == ["xclip", "-selection", "clipboard"]

    def test_x11_falls_back_to_xsel(self) -> None:
        assert clipboard_command("linux", X11, _which("xsel")) == ["xsel", "--clipboard", "--input"]

    def test_linux_without_tools_gives_none(self) -> None:
        assert clipboard_command("linux", WAYLAND, _which()) is None

    def test_macos_uses_pbcopy(self) -> None:
        assert clipboard_command("darwin", {}, _which()) == ["pbcopy"]


class TestTerminalRaiseCommand:
    def test_wayland_does_not_try_to_raise(self) -> None:
        assert terminal_raise_command("linux", WAYLAND, _which("wmctrl")) is None

    def test_x11_uses_wmctrl_when_installed(self) -> None:
        assert terminal_raise_command("linux", X11, _which("wmctrl")) == [
            "wmctrl",
            "-xa",
            "terminal",
        ]

    def test_x11_without_wmctrl_gives_none(self) -> None:
        assert terminal_raise_command("linux", X11, _which()) is None

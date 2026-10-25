"""Web prompt rules: text sanitising, client/Origin allowlists, rate limit, block reasons."""

import hashlib
import hmac
import json
from pathlib import Path

import pytest

from app.core.web_prompt import (
    MAX_PROMPT_CHARS,
    PromptRateLimiter,
    PromptRejectedError,
    append_audit,
    chat_block_reason,
    is_allowed_client_ip,
    is_allowed_origin,
    sanitize_prompt,
)

# ---------------------------------------------------------------------------
# sanitize_prompt
# ---------------------------------------------------------------------------


class TestSanitizePrompt:
    def test_plain_text_is_kept(self) -> None:
        assert sanitize_prompt("fix the login bug") == "fix the login bug"

    def test_newlines_are_kept(self) -> None:
        assert sanitize_prompt("line one\nline two") == "line one\nline two"

    def test_crlf_and_cr_become_newlines(self) -> None:
        assert sanitize_prompt("a\r\nb\rc") == "a\nb\nc"

    def test_escape_is_stripped(self) -> None:
        # ESC would let the text end bracketed paste (ESC[201~) and inject keys.
        assert sanitize_prompt("hi\x1b[201~\x1b[Aok") == "hi[201~[Aok"

    def test_ctrl_c_and_other_c0_controls_are_stripped(self) -> None:
        assert sanitize_prompt("a\x03b\x04c\x00d\x7fe") == "abcde"

    def test_c1_controls_are_stripped(self) -> None:
        assert sanitize_prompt("a\x9bb\x85c") == "abc"

    def test_tab_becomes_spaces(self) -> None:
        assert sanitize_prompt("a\tb") == "a    b"

    def test_surrounding_whitespace_is_trimmed(self) -> None:
        assert sanitize_prompt("  \n hello \n\n") == "hello"

    def test_unicode_text_is_kept(self) -> None:
        assert sanitize_prompt("Привет, мир — ok ✓") == "Привет, мир — ok ✓"

    def test_empty_after_cleaning_is_rejected(self) -> None:
        with pytest.raises(PromptRejectedError):
            sanitize_prompt(" \x1b\x03 \n")

    def test_max_length_is_accepted(self) -> None:
        assert len(sanitize_prompt("x" * MAX_PROMPT_CHARS)) == MAX_PROMPT_CHARS

    def test_over_max_length_is_rejected(self) -> None:
        with pytest.raises(PromptRejectedError):
            sanitize_prompt("x" * (MAX_PROMPT_CHARS + 1))

    def test_bash_mode_prefix_is_rejected(self) -> None:
        # "!" switches Claude Code into shell mode: the text would run as a
        # command with no permission prompt.
        with pytest.raises(PromptRejectedError):
            sanitize_prompt("  !rm -rf ~")

    def test_exclamation_inside_text_is_fine(self) -> None:
        assert sanitize_prompt("ship it!") == "ship it!"

    @pytest.mark.parametrize(
        "text",
        [
            "/exit",
            "  /deploy prod",
            "/model",
            "/cost now",
            "/compactx",
            "#remember this",
            " # note",
        ],
    )
    def test_slash_commands_and_memory_prefix_are_rejected(self, text: str) -> None:
        # "/..." runs slash commands (user commands may run bash), "#" writes memory.
        with pytest.raises(PromptRejectedError):
            sanitize_prompt(text)

    @pytest.mark.parametrize(
        "text", ["/compact", "/compact keep the API notes", "/cost", "  /cost  "]
    )
    def test_safe_commands_are_allowed(self, text: str) -> None:
        assert sanitize_prompt(text) == text.strip()

    def test_slash_and_hash_inside_text_are_fine(self) -> None:
        assert sanitize_prompt("check src/app and issue #12") == "check src/app and issue #12"


# ---------------------------------------------------------------------------
# Client IP allowlist
# ---------------------------------------------------------------------------


class TestClientIp:
    @pytest.mark.parametrize("host", ["127.0.0.1", "127.0.0.2", "::1", "::ffff:127.0.0.1"])
    def test_loopback_is_always_allowed(self, host: str) -> None:
        assert is_allowed_client_ip(host) is True

    _TAILSCALE = [
        "100.64.0.1",
        "100.66.186.99",
        "100.127.255.254",
        "fd7a:115c:a1e0::8501:baee",
        "::ffff:100.66.186.99",
    ]

    @pytest.mark.parametrize("host", _TAILSCALE)
    def test_tailscale_only_with_a_tailnet_host(self, host: str) -> None:
        assert is_allowed_client_ip(host) is False
        assert is_allowed_client_ip(host, tailnet=True) is True

    @pytest.mark.parametrize(
        "host",
        [
            None,
            "",
            "testclient",
            "localhost",
            "192.168.1.10",
            "10.0.0.5",
            "100.63.255.255",
            "100.128.0.1",
            "8.8.8.8",
            "fd7a:115c:a1e1::1",
            "fe80::1",
        ],
    )
    def test_everything_else_is_rejected(self, host: str | None) -> None:
        assert is_allowed_client_ip(host, tailnet=True) is False


# ---------------------------------------------------------------------------
# Origin allowlist
# ---------------------------------------------------------------------------

_CORS = ["http://localhost:3000", "http://127.0.0.1:3000"]
_TAILNET = "safarovs-machine.taile6887e.ts.net"


class TestOrigin:
    def test_missing_origin_is_allowed(self) -> None:
        # Non-browser clients send no Origin; the API key still gates them.
        assert is_allowed_origin(None, _CORS) is True

    def test_configured_origin_is_allowed(self) -> None:
        assert is_allowed_origin("http://localhost:3000", _CORS) is True

    @pytest.mark.parametrize(
        "origin", ["http://localhost:3100", "http://127.0.0.1:3000", "http://[::1]:3000"]
    )
    def test_loopback_origins_are_allowed(self, origin: str) -> None:
        assert is_allowed_origin(origin, _CORS) is True

    @pytest.mark.parametrize(
        "origin",
        [
            f"https://{_TAILNET}",
            f"http://{_TAILNET}:3000",
            "http://100.66.186.99:3000",
            "http://[fd7a:115c:a1e0::8501:baee]:3000",
        ],
    )
    def test_tailnet_origins_need_the_configured_host(self, origin: str) -> None:
        assert is_allowed_origin(origin, _CORS) is False
        assert is_allowed_origin(origin, _CORS, tailnet_host=_TAILNET) is True

    @pytest.mark.parametrize(
        "origin",
        [
            "https://evil.example",
            "http://192.168.1.10:3000",
            "null",
            "http://localhost.evil.example",
            "https://other-machine.taile6887e.ts.net",
            "https://desktop.tail1234.ts.net",
            f"https://{_TAILNET}.evil.example",
            "not a url",
        ],
    )
    def test_foreign_origins_are_rejected(self, origin: str) -> None:
        assert is_allowed_origin(origin, _CORS, tailnet_host=_TAILNET) is False


# ---------------------------------------------------------------------------
# Rate limit
# ---------------------------------------------------------------------------


class _Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class TestRateLimit:
    def test_five_per_minute_per_session(self) -> None:
        clock = _Clock()
        limiter = PromptRateLimiter(per_session=5, overall=20, clock=clock)
        assert all(limiter.allow("s1") for _ in range(5))
        assert limiter.allow("s1") is False

    def test_other_session_has_its_own_budget(self) -> None:
        limiter = PromptRateLimiter(per_session=5, overall=20, clock=_Clock())
        for _ in range(5):
            limiter.allow("s1")
        assert limiter.allow("s2") is True

    def test_twenty_per_minute_overall(self) -> None:
        limiter = PromptRateLimiter(per_session=5, overall=20, clock=_Clock())
        allowed = [limiter.allow(f"s{i % 10}") for i in range(25)]
        assert allowed.count(True) == 20
        assert allowed[-1] is False

    def test_window_slides(self) -> None:
        clock = _Clock()
        limiter = PromptRateLimiter(per_session=5, overall=20, clock=clock)
        for _ in range(5):
            limiter.allow("s1")
        clock.now += 60.5
        assert limiter.allow("s1") is True

    def test_rejected_attempt_does_not_use_overall_budget(self) -> None:
        limiter = PromptRateLimiter(per_session=1, overall=2, clock=_Clock())
        assert limiter.allow("s1") is True
        assert limiter.allow("s1") is False  # per-session limit hit
        assert limiter.allow("s2") is True  # overall budget still has room


# ---------------------------------------------------------------------------
# Block reasons
# ---------------------------------------------------------------------------


def _reason(**overrides: object) -> str | None:
    args: dict[str, object] = {
        "enabled": True,
        "has_explicit_key": True,
        "active": True,
        "pane": "%7",
        "pane_state": "claude",
        "pane_taken": False,
        "permission_pending": False,
    }
    args.update(overrides)
    return chat_block_reason(**args)  # type: ignore[arg-type]


class TestBlockReason:
    def test_all_good_can_send(self) -> None:
        assert _reason() is None

    def test_flag_off(self) -> None:
        assert _reason(enabled=False) == "disabled"

    def test_auto_token_only(self) -> None:
        assert _reason(has_explicit_key=False) == "no_key"

    def test_session_not_active(self) -> None:
        assert _reason(active=False) == "inactive"

    def test_not_in_tmux(self) -> None:
        assert _reason(pane=None, pane_state=None) == "no_tmux"

    def test_pane_taken_by_newer_session(self) -> None:
        assert _reason(pane_taken=True) == "pane_reused"

    def test_pane_not_checked_yet(self) -> None:
        assert _reason(pane_state=None) == "checking"

    def test_pane_gone(self) -> None:
        assert _reason(pane_state="gone") == "pane_gone"

    def test_pane_not_claude(self) -> None:
        assert _reason(pane_state="not_claude") == "not_claude"

    def test_permission_pending(self) -> None:
        assert _reason(permission_pending=True) == "permission_pending"

    def test_flag_wins_over_everything(self) -> None:
        assert _reason(enabled=False, pane=None, active=False) == "disabled"


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


class TestAudit:
    def test_appends_jsonl_without_raw_text(self, tmp_path: Path) -> None:
        log = tmp_path / "logs" / "web_prompts.jsonl"
        append_audit(
            log,
            key="k1",
            client_ip="127.0.0.1",
            origin="http://localhost:3000",
            session_id="s1",
            pane="%7",
            text="secret plan",
            outcome="sent",
        )
        append_audit(
            log,
            key="k1",
            client_ip="::1",
            origin=None,
            session_id="s1",
            pane=None,
            text="two",
            outcome="origin",
        )

        lines = log.read_text(encoding="utf-8").splitlines()
        assert len(lines) == 2
        first = json.loads(lines[0])
        assert first["client_ip"] == "127.0.0.1"
        assert first["origin"] == "http://localhost:3000"
        assert first["session_id"] == "s1"
        assert first["pane"] == "%7"
        assert first["length"] == len("secret plan")
        assert first["outcome"] == "sent"
        assert "time" in first
        assert "secret plan" not in log.read_text(encoding="utf-8")

    def test_text_digest_is_keyed(self, tmp_path: Path) -> None:
        # A plain sha256 of a short text can be brute-forced; an HMAC keyed by
        # the API key cannot without the key.
        log = tmp_path / "a.jsonl"
        for key in ("k1", "k2"):
            append_audit(
                log,
                key=key,
                client_ip=None,
                origin=None,
                session_id="s",
                pane=None,
                text="yes",
                outcome="sent",
            )
        first, second = (json.loads(x) for x in log.read_text().splitlines())
        expected = hmac.new(b"k1", b"yes", hashlib.sha256).hexdigest()
        assert first["hmac"] == expected
        assert first["hmac"] != second["hmac"]
        assert "sha256" not in first
        assert hashlib.sha256(b"yes").hexdigest() not in log.read_text()

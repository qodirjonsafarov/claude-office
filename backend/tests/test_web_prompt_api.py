"""POST /api/v1/sessions/{id}/prompt end to end, with a fake tmux.

Also covers where the pane comes from (stored per session) and the chat
status exposed in the sessions list and the office state.
"""

import asyncio
import json
from collections.abc import Iterator, Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.api.middleware import _is_state_changing  # pyright: ignore[reportPrivateUsage]
from app.api.routes import prompt as prompt_route
from app.config import get_settings
from app.core.chat_status import chat_status_for, refresh_chat_statuses
from app.core.event_processor import event_processor
from app.db.database import AsyncSessionLocal
from app.db.migrate import migrate_schema
from app.db.models import SessionRecord
from app.main import app
from app.models.agents import BossState
from app.models.events import EventAdapter, EventType
from app.services.tmux_service import CommandResult, TmuxService, override_tmux_service

FIXTURES = Path(__file__).parent / "fixtures" / "claude_screens"
READY = (FIXTURES / "idle_after_reply.ansi").read_text(encoding="utf-8")
DRAFT = (FIXTURES / "draft.ansi").read_text(encoding="utf-8")
DIALOG = (FIXTURES / "dialog_above_prompt.ansi").read_text(encoding="utf-8")
SOCKET = "/tmp/tmux-1000/default"
TAILNET = "safarovs-machine.taile6887e.ts.net"

KEY = "test-web-prompt-key"
CLAUDE_PANE = "%7"
CAT_PANE = "%9"
PANES = f"{CLAUDE_PANE} /dev/pts/9 claude\n{CAT_PANE} /dev/pts/12 cat\n"


def _verb(argv: list[str]) -> str:
    return argv[3] if argv[1] == "-S" else argv[1]


class FakeTmux:
    """Fake tmux: an empty prompt on screen, the pasted text after a paste.

    Set ``busy_screen`` to show a dialog/draft instead, or ``after_paste_panes``
    to change what list-panes reports once the text is pasted.
    """

    def __init__(self) -> None:
        self.panes = PANES
        self.calls: list[tuple[list[str], bytes | None]] = []
        self.busy_screen: str | None = None
        self.after_paste_panes: str | None = None
        self._pasted = False

    async def __call__(self, argv: Sequence[str], stdin: bytes | None) -> CommandResult:
        argv = list(argv)
        self.calls.append((argv, stdin))
        verb = _verb(argv)
        if verb == "list-panes":
            panes = (
                self.after_paste_panes if self._pasted and self.after_paste_panes else self.panes
            )
            return CommandResult(0, panes.encode(), b"")
        if verb == "capture-pane":
            screen = self.busy_screen or (DRAFT if self._pasted else READY)
            return CommandResult(0, screen.encode(), b"")
        if verb == "paste-buffer":
            self._pasted = True
        if verb == "send-keys":
            self._pasted = False
        return CommandResult(0, b"", b"")

    def sent(self) -> list[list[str]]:
        """Commands that change the pane (no list-panes / capture-pane)."""
        return [a for a, _ in self.calls if _verb(a) not in ("list-panes", "capture-pane")]


async def _no_sleep(_: float) -> None:
    return None


@pytest.fixture
def fake_tmux() -> Iterator[FakeTmux]:
    fake = FakeTmux()
    override_tmux_service(
        TmuxService(runner=fake, cache_ttl=0.0, sleep=_no_sleep, socket_check=lambda _p: True)
    )
    yield fake
    override_tmux_service(None)


@pytest.fixture
def audit_log(tmp_path: Path) -> Path:
    return tmp_path / "logs" / "web_prompts.jsonl"


@pytest.fixture
def enabled(monkeypatch: pytest.MonkeyPatch, fake_tmux: FakeTmux, audit_log: Path) -> FakeTmux:
    settings = get_settings()
    monkeypatch.setattr(settings, "ENABLE_WEB_PROMPT", True)
    monkeypatch.setattr(settings, "CLAUDE_OFFICE_API_KEY", KEY)
    monkeypatch.setattr(settings, "WEB_PROMPT_AUDIT_LOG", str(audit_log))
    prompt_route.reset_prompt_rate_limiter()
    return fake_tmux


def _client(host: str = "127.0.0.1") -> TestClient:
    return TestClient(app, client=(host, 50000))


def _send_event(session_id: str, event_type: EventType, data: dict[str, Any]) -> None:
    event = EventAdapter.validate_python(
        {
            "event_type": event_type,
            "session_id": session_id,
            "timestamp": datetime.now(UTC),
            "data": data,
        }
    )
    asyncio.run(event_processor.process_event(event))


def _session(pane: str | None = CLAUDE_PANE, socket: str | None = None) -> str:
    sid = f"test-{uuid4()}"
    data: dict[str, Any] = {"project_name": "office"}
    if pane:
        data["tmux_pane"] = pane
    if socket:
        data["tmux_socket"] = socket
    _send_event(sid, EventType.SESSION_START, data)
    return sid


def _post(
    sid: str,
    text: str = "hello",
    *,
    key: str = KEY,
    host: str = "127.0.0.1",
    origin: str | None = None,
) -> Any:
    headers = {"X-API-Key": key}
    if origin:
        headers["Origin"] = origin
    return _client(host).post(
        f"/api/v1/sessions/{sid}/prompt", json={"text": text}, headers=headers
    )


def _reason(resp: Any) -> str:
    return resp.json()["detail"]["reason"]


# ---------------------------------------------------------------------------
# Storage: the pane each session runs in
# ---------------------------------------------------------------------------


class TestPaneStorage:
    def test_event_model_carries_pane(self) -> None:
        event = EventAdapter.validate_python(
            {"event_type": "stop", "session_id": "s1", "data": {"tmux_pane": "%3"}}
        )
        assert event.data.tmux_pane == "%3"

    def test_session_record_stores_latest_pane(self) -> None:
        sid = _session("%3")
        _send_event(sid, EventType.STOP, {"tmux_pane": "%4"})

        async def read() -> str | None:
            async with AsyncSessionLocal() as db:
                rec = (
                    await db.execute(select(SessionRecord).where(SessionRecord.id == sid))
                ).scalar_one()
                return rec.tmux_pane

        assert asyncio.run(read()) == "%4"
        assert event_processor.sessions[sid].tmux_pane == "%4"

    def test_session_stores_the_tmux_socket(self) -> None:
        sid = _session("%3", socket=SOCKET)

        async def read() -> str | None:
            async with AsyncSessionLocal() as db:
                rec = (
                    await db.execute(select(SessionRecord).where(SessionRecord.id == sid))
                ).scalar_one()
                return rec.tmux_socket

        assert asyncio.run(read()) == SOCKET
        assert event_processor.sessions[sid].tmux_socket == SOCKET

    def test_migration_adds_tmux_pane_column(self) -> None:
        async def run() -> set[str]:
            engine = create_async_engine("sqlite+aiosqlite:///:memory:")
            async with engine.begin() as conn:
                await conn.execute(text("CREATE TABLE sessions (id TEXT PRIMARY KEY)"))
                await migrate_schema(conn)
                rows = (await conn.execute(text("PRAGMA table_info(sessions)"))).fetchall()
            await engine.dispose()
            return {row[1] for row in rows}

        columns = asyncio.run(run())
        assert "tmux_pane" in columns
        assert "tmux_socket" in columns


def test_prompt_route_is_state_changing() -> None:
    assert _is_state_changing("/api/v1/sessions/abc/prompt", "POST")
    assert not _is_state_changing("/api/v1/sessions/abc/prompt", "GET")


# ---------------------------------------------------------------------------
# Gates before anything reaches tmux
# ---------------------------------------------------------------------------


class TestGates:
    def test_off_by_default(self, fake_tmux: FakeTmux) -> None:
        assert get_settings().ENABLE_WEB_PROMPT is False
        sid = _session()
        resp = _post(sid, key=get_settings().effective_api_key)
        assert resp.status_code == 403
        assert _reason(resp) == "disabled"
        assert fake_tmux.sent() == []

    def test_auto_token_is_not_enough(
        self, monkeypatch: pytest.MonkeyPatch, fake_tmux: FakeTmux
    ) -> None:
        settings = get_settings()
        monkeypatch.setattr(settings, "ENABLE_WEB_PROMPT", True)
        monkeypatch.setattr(settings, "CLAUDE_OFFICE_API_KEY", "")
        sid = _session()
        resp = _post(sid, key=settings.effective_api_key)
        assert resp.status_code == 403
        assert _reason(resp) == "no_key"
        assert fake_tmux.sent() == []

    def test_wrong_key_is_401(self, enabled: FakeTmux) -> None:
        sid = _session()
        assert _post(sid, key="nope").status_code == 401
        assert enabled.sent() == []

    def test_lan_client_is_rejected(
        self, monkeypatch: pytest.MonkeyPatch, enabled: FakeTmux
    ) -> None:
        monkeypatch.setattr(get_settings(), "LOCALHOST_ONLY", False)
        sid = _session()
        resp = _post(sid, host="192.168.1.10")
        assert resp.status_code == 403
        assert _reason(resp) == "client_ip"
        assert enabled.sent() == []

    def test_tailscale_client_needs_a_tailnet_host(
        self, monkeypatch: pytest.MonkeyPatch, enabled: FakeTmux
    ) -> None:
        monkeypatch.setattr(get_settings(), "LOCALHOST_ONLY", False)
        sid = _session()
        resp = _post(sid, host="100.66.186.99")
        assert resp.status_code == 403
        assert _reason(resp) == "client_ip"
        monkeypatch.setattr(get_settings(), "WEB_PROMPT_TAILNET_HOST", TAILNET)
        resp = _post(sid, host="100.66.186.99", origin=f"https://{TAILNET}")
        assert resp.status_code == 200

    def test_foreign_origin_is_rejected(self, enabled: FakeTmux) -> None:
        sid = _session()
        resp = _post(sid, origin="https://evil.example")
        assert resp.status_code == 403
        assert _reason(resp) == "origin"
        assert enabled.sent() == []

    def test_local_origin_is_allowed(self, enabled: FakeTmux) -> None:
        sid = _session()
        assert _post(sid, origin="http://localhost:3000").status_code == 200

    @pytest.mark.parametrize("bad", ["", "  \x1b\x03 ", "!ls", "/exit", "#note", "x" * 8001])
    def test_bad_text_is_422(self, enabled: FakeTmux, bad: str) -> None:
        sid = _session()
        resp = _post(sid, bad)
        assert resp.status_code == 422
        assert enabled.sent() == []

    def test_unknown_session_is_404(self, enabled: FakeTmux) -> None:
        assert _post(f"test-{uuid4()}").status_code == 404


# ---------------------------------------------------------------------------
# 409: the session cannot take a prompt
# ---------------------------------------------------------------------------


class TestConflicts:
    def test_ended_session(self, enabled: FakeTmux) -> None:
        sid = _session()
        _send_event(sid, EventType.SESSION_END, {})
        resp = _post(sid)
        assert resp.status_code == 409
        assert _reason(resp) == "inactive"

    def test_not_in_tmux(self, enabled: FakeTmux) -> None:
        sid = _session(pane=None)
        resp = _post(sid)
        assert resp.status_code == 409
        assert _reason(resp) == "no_tmux"

    def test_pane_gone(self, enabled: FakeTmux) -> None:
        sid = _session("%42")
        resp = _post(sid)
        assert resp.status_code == 409
        assert _reason(resp) == "pane_gone"

    def test_pane_runs_cat_not_claude(self, enabled: FakeTmux) -> None:
        sid = _session(CAT_PANE)
        resp = _post(sid)
        assert resp.status_code == 409
        assert _reason(resp) == "not_claude"
        assert enabled.sent() == []

    def test_permission_pending(self, enabled: FakeTmux) -> None:
        sid = _session()
        _send_event(sid, EventType.PERMISSION_REQUEST, {"tool_name": "Bash", "agent_id": "main"})
        assert event_processor.sessions[sid].boss_state == BossState.WAITING_PERMISSION
        resp = _post(sid)
        assert resp.status_code == 409
        assert _reason(resp) == "permission_pending"
        assert enabled.sent() == []

    @pytest.mark.parametrize("screen", [DIALOG, DRAFT])
    def test_terminal_busy_with_a_dialog_or_draft(self, enabled: FakeTmux, screen: str) -> None:
        enabled.busy_screen = screen
        sid = _session()
        resp = _post(sid, "1")
        assert resp.status_code == 409
        assert _reason(resp) == "terminal_busy"
        assert "busy with a dialog" in resp.json()["detail"]["message"]
        assert enabled.sent() == []

    def test_claude_exits_during_the_paste(self, enabled: FakeTmux) -> None:
        enabled.after_paste_panes = f"{CLAUDE_PANE} /dev/pts/9 zsh\n"
        sid = _session()
        resp = _post(sid, "rm -rf build")
        assert resp.status_code == 409
        assert _reason(resp) == "not_claude"
        assert ["tmux", "send-keys", "-t", CLAUDE_PANE, "Enter"] not in enabled.sent()

    def test_same_pane_on_another_tmux_server_is_not_reuse(self, enabled: FakeTmux) -> None:
        old = _session(CLAUDE_PANE, socket=SOCKET)
        _session(CLAUDE_PANE, socket="/tmp/tmux-1000/other")
        assert _post(old).status_code == 200

    def test_pane_taken_by_newer_session(self, enabled: FakeTmux) -> None:
        old = _session(CLAUDE_PANE)
        new = _session(CLAUDE_PANE)
        resp = _post(old)
        assert resp.status_code == 409
        assert _reason(resp) == "pane_reused"
        assert _post(new).status_code == 200


# ---------------------------------------------------------------------------
# Sending
# ---------------------------------------------------------------------------


class TestSend:
    def test_pastes_sanitised_text_then_enter(self, enabled: FakeTmux) -> None:
        sid = _session()
        resp = _post(sid, "fix it\r\nplease\x1b[201~")
        assert resp.status_code == 200
        load, paste, enter = enabled.sent()
        assert load[1] == "load-buffer"
        verbs = [_verb(a) for a, _ in enabled.calls]
        assert verbs.index("capture-pane") < verbs.index("load-buffer")  # screen checked first
        stdin = next(s for argv, s in enabled.calls if argv[1] == "load-buffer")
        assert stdin == b"fix it\nplease[201~"
        assert paste[1] == "paste-buffer" and paste[-1] == CLAUDE_PANE
        assert enter == ["tmux", "send-keys", "-t", CLAUDE_PANE, "Enter"]

    def test_tmux_commands_use_the_session_socket(self, enabled: FakeTmux) -> None:
        sid = _session(socket=SOCKET)
        assert _post(sid).status_code == 200
        assert all(a[1:3] == ["-S", SOCKET] for a, _ in enabled.calls if a[0] == "tmux")

    def test_writes_audit_line_without_text(self, enabled: FakeTmux, audit_log: Path) -> None:
        sid = _session()
        _post(sid, "top secret")
        records = [json.loads(line) for line in audit_log.read_text().splitlines()]
        assert records[-1]["session_id"] == sid
        assert records[-1]["pane"] == CLAUDE_PANE
        assert records[-1]["client_ip"] == "127.0.0.1"
        assert records[-1]["outcome"] == "sent"
        assert records[-1]["length"] == len("top secret")
        assert "top secret" not in audit_log.read_text()

    def test_rejections_are_audited_too(self, enabled: FakeTmux, audit_log: Path) -> None:
        sid = _session(CAT_PANE)
        _post(sid)
        assert json.loads(audit_log.read_text().splitlines()[-1])["outcome"] == "not_claude"

    def test_origin_ip_text_and_404_rejections_are_audited(
        self, monkeypatch: pytest.MonkeyPatch, enabled: FakeTmux, audit_log: Path
    ) -> None:
        sid = _session()
        _post(sid, origin="https://evil.example")
        _post(sid, "!ls")
        _post(f"test-{uuid4()}")
        monkeypatch.setattr(get_settings(), "LOCALHOST_ONLY", False)
        _post(sid, host="192.168.1.10")
        records = [json.loads(line) for line in audit_log.read_text().splitlines()]
        assert [r["outcome"] for r in records[-4:]] == [
            "origin",
            "invalid_text",
            "not_found",
            "client_ip",
        ]
        assert records[-4]["origin"] == "https://evil.example"
        assert records[-1]["client_ip"] == "192.168.1.10"

    def test_boss_says_message_received(self, enabled: FakeTmux) -> None:
        sid = _session()
        _post(sid)
        sm = event_processor.sessions[sid]
        assert sm.boss_bubble is not None
        assert sm.boss_bubble.text == "Message received"
        assert sm.history[-1]["summary"] == "Message sent from web"

    def test_tmux_failure_is_502(self, enabled: FakeTmux) -> None:
        sid = _session()

        async def failing(argv: Sequence[str], stdin: bytes | None) -> CommandResult:
            if _verb(list(argv)) == "paste-buffer":
                return CommandResult(1, b"", b"")
            return await enabled(argv, stdin)

        override_tmux_service(
            TmuxService(
                runner=failing, cache_ttl=0.0, sleep=_no_sleep, socket_check=lambda _p: True
            )
        )
        assert _post(sid).status_code == 502


class TestRateLimit:
    def test_five_per_minute_per_session(self, enabled: FakeTmux) -> None:
        sid = _session()
        assert [_post(sid).status_code for _ in range(5)] == [200] * 5
        resp = _post(sid)
        assert resp.status_code == 429
        assert _reason(resp) == "rate_limited"

    def test_twenty_per_minute_overall(self, enabled: FakeTmux) -> None:
        sids = [_session(f"%{100 + i}") for i in range(5)]
        enabled.panes = "".join(f"%{100 + i} /dev/pts/{i} claude\n" for i in range(5))
        codes = [_post(sids[i % 5]).status_code for i in range(21)]
        assert codes[:20] == [200] * 20
        assert codes[20] == 429


# ---------------------------------------------------------------------------
# Chat status in the sessions list and the office state
# ---------------------------------------------------------------------------


def _listed_chat(sid: str) -> dict[str, Any]:
    resp = _client().get("/api/v1/sessions", headers={"X-API-Key": KEY})
    assert resp.status_code == 200
    return next(s for s in resp.json() if s["id"] == sid)["chat"]


def _state_chat(sid: str) -> dict[str, Any] | None:
    state = asyncio.run(event_processor.get_current_state(sid))
    assert state is not None
    return state.model_dump(mode="json", by_alias=True)["chat"]


class TestChatStatus:
    def test_list_can_send(self, enabled: FakeTmux) -> None:
        sid = _session()
        assert _listed_chat(sid) == {"canSend": True, "reason": None, "label": "office"}

    def test_list_not_in_tmux(self, enabled: FakeTmux) -> None:
        sid = _session(pane=None)
        chat = _listed_chat(sid)
        assert chat["canSend"] is False
        assert chat["reason"] == "no_tmux"

    def test_list_flag_off(self, fake_tmux: FakeTmux) -> None:
        sid = _session()
        resp = _client().get("/api/v1/sessions")
        chat = next(s for s in resp.json() if s["id"] == sid)["chat"]
        assert chat["canSend"] is False
        assert chat["reason"] == "disabled"

    def test_state_can_send(self, enabled: FakeTmux) -> None:
        sid = _session()
        assert _state_chat(sid) == {"canSend": True, "reason": None, "label": "office"}

    def test_state_cat_pane(self, enabled: FakeTmux) -> None:
        sid = _session(CAT_PANE)
        chat = _state_chat(sid)
        assert chat is not None
        assert chat["canSend"] is False
        assert chat["reason"] == "not_claude"

    def test_state_permission_pending(self, enabled: FakeTmux) -> None:
        sid = _session()
        _send_event(sid, EventType.PERMISSION_REQUEST, {"tool_name": "Bash", "agent_id": "main"})
        chat = _state_chat(sid)
        assert chat is not None
        assert chat["reason"] == "permission_pending"


class TestBroadcastStatus:
    """Broadcasts never wait for tmux: they read the last pane check."""

    def test_unknown_pane_reads_checking_without_running_tmux(self, enabled: FakeTmux) -> None:
        sid = _session()
        enabled.calls.clear()
        sm = event_processor.sessions[sid]
        status = asyncio.run(chat_status_for(sid, sm, event_processor.sessions, live=False))
        assert status.reason == "checking"
        assert enabled.calls == []

    def test_refresh_fills_the_cache_and_reports_changes(self, enabled: FakeTmux) -> None:
        sid = _session()
        changed = asyncio.run(refresh_chat_statuses(event_processor.sessions))
        assert sid in changed
        sm = event_processor.sessions[sid]
        status = asyncio.run(chat_status_for(sid, sm, event_processor.sessions, live=False))
        assert status.can_send is True
        # Nothing changed since: no re-broadcast needed.
        assert sid not in asyncio.run(refresh_chat_statuses(event_processor.sessions))

    def test_refresh_skips_ended_sessions(self, enabled: FakeTmux) -> None:
        sid = _session(CAT_PANE)
        _send_event(sid, EventType.SESSION_END, {})
        enabled.calls.clear()
        asyncio.run(refresh_chat_statuses({sid: event_processor.sessions[sid]}))
        assert enabled.calls == []

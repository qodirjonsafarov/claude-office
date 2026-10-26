"""Trusted networks (TRUST_TAILNET / TRUST_LOOPBACK), opt-in and off by default.

When on, the office UI's own requests (reads, renames, preferences, the
WebSocket) from a Tailscale client address (or loopback) need no X-API-Key,
so the phone opens the office without pasting a token. Other addresses
(home LAN) are still rejected, and the endpoints that type into the
terminal, touch the OS or wipe data still need the key.
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.api.websocket import validate_websocket_origin
from app.config import Settings, get_settings
from app.main import app

KEY = "test-explicit-key"
PHONE_IP = "100.110.183.127"
PHONE_ORIGIN = f"http://{PHONE_IP}:3000"
LAN_IP = "192.168.1.20"


def _client(host: str) -> TestClient:
    return TestClient(app, client=(host, 50000))


@pytest.fixture(autouse=True)
def explicit_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """The owner's setup: an explicit key, loopback-only, all trust flags off."""
    settings = get_settings()
    monkeypatch.setattr(settings, "CLAUDE_OFFICE_API_KEY", KEY)
    monkeypatch.setattr(settings, "LOCALHOST_ONLY", True)
    monkeypatch.setattr(settings, "ALLOW_TAILNET", False)
    monkeypatch.setattr(settings, "TRUST_TAILNET", False)
    monkeypatch.setattr(settings, "TRUST_LOOPBACK", False)


@pytest.fixture
def trust_tailnet(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "TRUST_TAILNET", True)


@pytest.fixture
def trust_loopback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "TRUST_LOOPBACK", True)


def test_flags_default_off() -> None:
    s = Settings(_env_file=None)  # pyright: ignore[reportCallIssue]
    assert s.TRUST_TAILNET is False
    assert s.TRUST_LOOPBACK is False


# --- flags off: the old behaviour --------------------------------------------


def test_off_tailnet_read_needs_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "ALLOW_TAILNET", True)
    assert _client(PHONE_IP).get("/api/v1/sessions").status_code == 401


def test_off_loopback_read_needs_key() -> None:
    assert _client("127.0.0.1").get("/api/v1/sessions").status_code == 401


def test_off_tailnet_without_allow_is_forbidden() -> None:
    resp = _client(PHONE_IP).get("/api/v1/sessions", headers={"X-API-Key": KEY})
    assert resp.status_code == 403


# --- TRUST_TAILNET -------------------------------------------------------------


@pytest.mark.usefixtures("trust_tailnet")
@pytest.mark.parametrize(
    "host", [PHONE_IP, "100.66.186.99", "fd7a:115c:a1e0::5", "::ffff:100.110.183.127"]
)
def test_trusted_tailnet_reads_without_key(host: str) -> None:
    """TRUST_TAILNET alone (without ALLOW_TAILNET) lets the phone in."""
    assert _client(host).get("/api/v1/sessions").status_code == 200


@pytest.mark.usefixtures("trust_tailnet")
def test_trusted_tailnet_ignores_stale_key() -> None:
    resp = _client(PHONE_IP).get("/api/v1/sessions", headers={"X-API-Key": "stale"})
    assert resp.status_code == 200


@pytest.mark.usefixtures("trust_tailnet")
def test_trusted_tailnet_ui_writes_without_key() -> None:
    phone = _client(PHONE_IP)
    assert phone.put("/api/v1/preferences/qo-test", json={"value": "1"}).status_code == 200
    # Rename reaches the route (404: no such session), not the key check.
    assert phone.patch("/api/v1/sessions/nope", json={"display_name": "x"}).status_code == 404


@pytest.mark.usefixtures("trust_tailnet")
@pytest.mark.parametrize("host", [LAN_IP, "10.0.0.5", "172.17.0.1", "100.128.0.1"])
def test_trusted_tailnet_still_rejects_lan(host: str) -> None:
    client = _client(host)
    assert client.get("/api/v1/sessions").status_code in (401, 403)
    # Even with the key the LAN stays outside the boundary.
    assert client.get("/api/v1/sessions", headers={"X-API-Key": KEY}).status_code == 403


@pytest.mark.usefixtures("trust_tailnet")
def test_trusted_tailnet_does_not_trust_loopback() -> None:
    assert _client("127.0.0.1").get("/api/v1/sessions").status_code == 401


@pytest.mark.usefixtures("trust_tailnet")
def test_trusted_tailnet_allows_ui_origin_cors_and_ws() -> None:
    resp = _client(PHONE_IP).get("/api/v1/sessions", headers={"Origin": PHONE_ORIGIN})
    assert resp.headers.get("access-control-allow-origin") == PHONE_ORIGIN

    class _WS:
        headers: dict[str, str] = {"origin": PHONE_ORIGIN}

    assert validate_websocket_origin(_WS()) is True  # pyright: ignore[reportArgumentType]


# --- endpoints that keep the key ---------------------------------------------

_KEYED: list[tuple[str, str, dict[str, Any] | None]] = [
    ("POST", "/api/v1/sessions/s1/prompt", {"text": "hi"}),
    ("POST", "/api/v1/sessions/s1/focus", None),
    ("POST", "/api/v1/sessions/simulate", None),
    ("DELETE", "/api/v1/sessions", None),
    ("DELETE", "/api/v1/sessions/s1", None),
    (
        "POST",
        "/api/v1/events",
        {
            "event_type": "session_start",
            "session_id": "x",
            "timestamp": "2026-01-01T00:00:00",
            "data": {},
        },
    ),
]


@pytest.mark.usefixtures("trust_tailnet", "trust_loopback")
@pytest.mark.parametrize("host", [PHONE_IP, "127.0.0.1"])
@pytest.mark.parametrize(("method", "path", "body"), _KEYED)
def test_keyed_endpoints_still_need_key(
    host: str, method: str, path: str, body: dict[str, Any] | None
) -> None:
    client = _client(host)
    assert client.request(method, path, json=body).status_code == 401
    assert (
        client.request(method, path, json=body, headers={"X-API-Key": "stale"}).status_code == 401
    )


@pytest.mark.usefixtures("trust_tailnet")
def test_prompt_with_key_passes_the_key_check() -> None:
    resp = _client(PHONE_IP).post(
        "/api/v1/sessions/s1/prompt",
        json={"text": "hi"},
        headers={"X-API-Key": KEY, "Origin": PHONE_ORIGIN},
    )
    # The route's own rules answer now (chat is off in tests), not the key check.
    assert resp.status_code == 403
    assert resp.json()["detail"]["reason"] == "disabled"


# --- TRUST_LOOPBACK ------------------------------------------------------------


@pytest.mark.usefixtures("trust_loopback")
@pytest.mark.parametrize("host", ["127.0.0.1", "::1"])
def test_trusted_loopback_reads_without_key(host: str) -> None:
    assert _client(host).get("/api/v1/sessions").status_code == 200


@pytest.mark.usefixtures("trust_loopback")
def test_trusted_loopback_does_not_trust_tailnet(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "ALLOW_TAILNET", True)
    assert _client(PHONE_IP).get("/api/v1/sessions").status_code == 401


# --- GET /api/v1/auth/status ---------------------------------------------------


@pytest.mark.usefixtures("trust_tailnet")
def test_auth_status_trusted_phone() -> None:
    resp = _client(PHONE_IP).get("/api/v1/auth/status", headers={"X-API-Key": "stale"})
    assert resp.status_code == 200
    assert resp.json() == {"trusted": True, "keyRequired": False}


def test_auth_status_untrusted_needs_no_key_to_ask() -> None:
    resp = _client("127.0.0.1").get("/api/v1/auth/status")
    assert resp.status_code == 200
    assert resp.json() == {"trusted": False, "keyRequired": True}


def test_auth_status_without_explicit_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "CLAUDE_OFFICE_API_KEY", "")
    assert _client("127.0.0.1").get("/api/v1/auth/status").json() == {
        "trusted": False,
        "keyRequired": False,
    }


def test_auth_status_lan_is_forbidden(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "TRUST_TAILNET", True)
    assert _client(LAN_IP).get("/api/v1/auth/status").status_code == 403

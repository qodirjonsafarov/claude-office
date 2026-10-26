"""Who counts as a trusted client, whatever uvicorn's launch flags are.

* S1: proxy headers. uvicorn rewrites ``client`` from X-Forwarded-For when the
  peer is 127.0.0.1 (its default), so any local process could pose as the
  phone. Requests with forwarded headers never get network trust.
* S2: DNS rebinding. The keyless bypass needs a Host of this machine
  (loopback, a TAILNET_HOSTS name or a Tailscale IP), never a foreign name.
* S3: WebSockets pass the client-IP check too (LAN -> close 1008).
* N5: TAILNET_CLIENT_IPS narrows tailnet trust to listed addresses.
"""

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.config import Settings, get_settings
from app.main import app

KEY = "test-explicit-key"
PHONE_IP = "100.66.186.99"
OTHER_TAILNET_IP = "100.101.102.103"
LAN_IP = "192.168.1.20"
LOCAL_ORIGIN = "http://localhost:3000"


def _client(peer: str, host: str = "localhost:8000") -> TestClient:
    return TestClient(app, client=(peer, 50000), base_url=f"http://{host}")


def _ws_close_code(client: TestClient, path: str, headers: dict[str, str]) -> int | None:
    """Close code of a refused handshake, None when it was accepted."""
    try:
        with client.websocket_connect(path, headers=headers) as ws:
            ws.receive_json()
    except WebSocketDisconnect as exc:
        return exc.code
    return None


@pytest.fixture(autouse=True)
def owner_setup(monkeypatch: pytest.MonkeyPatch) -> None:
    """The owner's live setup: explicit key, phone and loopback trusted."""
    settings = get_settings()
    monkeypatch.setattr(settings, "CLAUDE_OFFICE_API_KEY", KEY)
    monkeypatch.setattr(settings, "LOCALHOST_ONLY", True)
    monkeypatch.setattr(settings, "ALLOW_TAILNET", True)
    monkeypatch.setattr(settings, "TRUST_TAILNET", True)
    monkeypatch.setattr(settings, "TRUST_LOOPBACK", False)
    monkeypatch.setattr(settings, "TAILNET_HOSTS", "safarovs-machine,safarovs-machine.tail1.ts.net")
    monkeypatch.setattr(settings, "TAILNET_CLIENT_IPS", "")


# --- S1: forwarded headers ---------------------------------------------------


def test_loopback_with_forwarded_tailnet_ip_is_not_trusted() -> None:
    """uvicorn default: 127.0.0.1 + XFF 100.x arrives as client 100.x."""
    spoofed = _client(OTHER_TAILNET_IP, host=f"{PHONE_IP}:8000")
    resp = spoofed.get("/api/v1/sessions", headers={"X-Forwarded-For": OTHER_TAILNET_IP})
    assert resp.status_code in (401, 403)


@pytest.mark.parametrize(
    "header",
    [
        ("X-Forwarded-For", OTHER_TAILNET_IP),
        ("Forwarded", f"for={OTHER_TAILNET_IP}"),
        ("X-Real-IP", OTHER_TAILNET_IP),
    ],
)
def test_forwarded_headers_drop_network_trust(header: tuple[str, str]) -> None:
    resp = _client(PHONE_IP, host=f"{PHONE_IP}:8000").get(
        "/api/v1/sessions", headers=dict([header])
    )
    assert resp.status_code in (401, 403)


def test_auth_status_with_forwarded_header_is_not_trusted() -> None:
    resp = _client(PHONE_IP, host=f"{PHONE_IP}:8000").get(
        "/api/v1/auth/status", headers={"X-Forwarded-For": PHONE_IP}
    )
    assert resp.status_code == 403 or resp.json()["trusted"] is False


def test_phone_without_forwarded_headers_still_trusted() -> None:
    assert _client(PHONE_IP, host=f"{PHONE_IP}:8000").get("/api/v1/sessions").status_code == 200


# --- S2: Host header -----------------------------------------------------------


@pytest.mark.parametrize(
    "host",
    [
        f"{PHONE_IP}:8000",
        "safarovs-machine:8000",
        "SAFAROVS-MACHINE.tail1.ts.net:8000",
        "safarovs-machine.tail1.ts.net.:8000",
    ],
)
def test_phone_with_own_host_is_trusted(host: str) -> None:
    assert _client(PHONE_IP, host=host).get("/api/v1/sessions").status_code == 200


@pytest.mark.parametrize(
    "host", ["evil.example:8000", "safarovs-machine.evil.example:8000", "192.168.1.5:8000"]
)
def test_foreign_host_gets_no_keyless_access(host: str) -> None:
    client = _client(PHONE_IP, host=host)
    assert client.get("/api/v1/sessions").status_code == 401
    assert client.get("/api/v1/auth/status").json()["trusted"] is False
    # The key still works whatever the Host says.
    assert client.get("/api/v1/sessions", headers={"X-API-Key": KEY}).status_code == 200


@pytest.mark.parametrize("host", ["localhost:8000", "127.0.0.1:8000", "[::1]:8000", "localhost"])
def test_trusted_loopback_with_local_host(monkeypatch: pytest.MonkeyPatch, host: str) -> None:
    monkeypatch.setattr(get_settings(), "TRUST_LOOPBACK", True)
    assert _client("127.0.0.1", host=host).get("/api/v1/sessions").status_code == 200


def test_trusted_loopback_rebinding_host_needs_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "TRUST_LOOPBACK", True)
    client = _client("127.0.0.1", host="rebind.evil.example:8000")
    assert client.get("/api/v1/sessions").status_code == 401
    assert client.get("/api/v1/sessions", headers={"X-API-Key": KEY}).status_code == 200


# --- S3: WebSockets --------------------------------------------------------------


@pytest.mark.parametrize("path", ["/ws/sess-1", "/ws/overview", "/ws/room/room-1"])
def test_ws_from_lan_with_forged_origin_is_closed(path: str) -> None:
    client = _client(LAN_IP, host="192.168.1.10:8000")
    assert _ws_close_code(client, path, headers={"Origin": LOCAL_ORIGIN}) == 1008


def test_ws_from_lan_with_forged_xff_is_closed() -> None:
    client = _client(PHONE_IP, host=f"{PHONE_IP}:8000")
    assert (
        _ws_close_code(
            client, "/ws/sess-1", headers={"Origin": LOCAL_ORIGIN, "X-Forwarded-For": PHONE_IP}
        )
        == 1008
    )


def test_ws_from_tailnet_off_is_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "ALLOW_TAILNET", False)
    monkeypatch.setattr(get_settings(), "TRUST_TAILNET", False)
    client = _client(PHONE_IP, host=f"{PHONE_IP}:8000")
    assert (
        _ws_close_code(client, "/ws/sess-1", headers={"Origin": f"http://{PHONE_IP}:3000"}) == 1008
    )


@pytest.mark.parametrize(
    ("peer", "origin"),
    [("127.0.0.1", LOCAL_ORIGIN), (PHONE_IP, f"http://{PHONE_IP}:3000")],
)
def test_ws_from_loopback_and_phone_connects(peer: str, origin: str) -> None:
    client = _client(peer)
    # The room route sends nothing for an unknown room; an accepted handshake is enough.
    with client.websocket_connect("/ws/room/room-1", headers={"Origin": origin}) as ws:
        ws.send_text("ping")


# --- N5: TAILNET_CLIENT_IPS --------------------------------------------------------


def test_client_ips_default_empty() -> None:
    assert Settings(_env_file=None).TAILNET_CLIENT_IPS == ""  # pyright: ignore[reportCallIssue]


def test_client_ips_allow_listed_phone(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "TAILNET_CLIENT_IPS", f" {PHONE_IP} , fd7a:115c:a1e0::5")
    assert _client(PHONE_IP, host=f"{PHONE_IP}:8000").get("/api/v1/sessions").status_code == 200
    assert _client("fd7a:115c:a1e0::5").get("/api/v1/sessions").status_code == 200


def test_client_ips_reject_other_cgnat_address(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "TAILNET_CLIENT_IPS", PHONE_IP)
    other = _client(OTHER_TAILNET_IP, host=f"{PHONE_IP}:8000")
    assert other.get("/api/v1/sessions").status_code in (401, 403)
    assert other.get("/api/v1/sessions", headers={"X-API-Key": KEY}).status_code == 403
    assert (
        _ws_close_code(other, "/ws/sess-1", headers={"Origin": f"http://{PHONE_IP}:3000"}) == 1008
    )


def test_client_ips_never_widen_beyond_tailscale(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "TAILNET_CLIENT_IPS", f"{PHONE_IP},{LAN_IP}")
    assert _client(LAN_IP).get("/api/v1/sessions", headers={"X-API-Key": KEY}).status_code == 403

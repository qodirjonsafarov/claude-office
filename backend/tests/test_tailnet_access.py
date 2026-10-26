"""Opt-in phone access over Tailscale (ALLOW_TAILNET / TAILNET_HOSTS).

Off by default: only loopback clients and localhost origins pass. When on,
Tailscale addresses (100.64.0.0/10, fd7a:115c:a1e0::/48) and the configured
MagicDNS names on port 3000 pass too; other LAN addresses never do.
"""

import asyncio
from typing import Any

import pytest
from fastapi import Request
from fastapi.responses import JSONResponse, Response
from fastapi.testclient import TestClient

from app.api import middleware as mw
from app.api.websocket import validate_websocket_origin
from app.config import Settings, get_settings
from app.core.tailnet import is_tailnet_origin, is_tailscale_ip
from app.main import app

PHONE_IP = "100.66.186.99"
HOSTS = frozenset({"safarovs-machine", "safarovs-machine.tail1234.ts.net"})


@pytest.fixture
def tailnet_on(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "LOCALHOST_ONLY", True)
    monkeypatch.setattr(settings, "ALLOW_TAILNET", True)
    monkeypatch.setattr(settings, "TAILNET_HOSTS", ",".join(sorted(HOSTS)))


@pytest.fixture
def tailnet_off(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "LOCALHOST_ONLY", True)
    monkeypatch.setattr(settings, "ALLOW_TAILNET", False)
    monkeypatch.setattr(settings, "TAILNET_HOSTS", ",".join(sorted(HOSTS)))


# --- pure helpers -----------------------------------------------------------


@pytest.mark.parametrize(
    "host",
    [PHONE_IP, "100.64.0.1", "100.127.255.254", "fd7a:115c:a1e0::1", "::ffff:100.66.186.99"],
)
def test_tailscale_ips_recognised(host: str) -> None:
    assert is_tailscale_ip(host) is True


@pytest.mark.parametrize(
    "host",
    [
        "192.168.1.20",
        "10.0.0.5",
        "100.128.0.1",
        "100.63.255.255",
        "127.0.0.1",
        "fd00::1",
        "",
        None,
        "safarovs-machine",
    ],
)
def test_other_addresses_are_not_tailscale(host: str | None) -> None:
    assert is_tailscale_ip(host) is False


@pytest.mark.parametrize(
    "origin",
    [
        f"http://{PHONE_IP}:3000",
        "http://safarovs-machine:3000",
        "http://SAFAROVS-MACHINE.tail1234.ts.net:3000/",
        "https://safarovs-machine.tail1234.ts.net:3000",
        "http://[fd7a:115c:a1e0::5]:3000",
    ],
)
def test_tailnet_origins_accepted(origin: str) -> None:
    assert is_tailnet_origin(origin, HOSTS) is True


@pytest.mark.parametrize(
    "origin",
    [
        "http://192.168.1.20:3000",  # home Wi-Fi
        f"http://{PHONE_IP}:8000",  # wrong port
        f"http://{PHONE_IP}",  # no port
        "http://safarovs-machine.evil.com:3000",
        "http://other-machine:3000",
        f"ftp://{PHONE_IP}:3000",
        "null",
        "",
        None,
    ],
)
def test_non_tailnet_origins_rejected(origin: str | None) -> None:
    assert is_tailnet_origin(origin, HOSTS) is False


def test_settings_defaults_are_off() -> None:
    s = Settings(_env_file=None)  # pyright: ignore[reportCallIssue]
    assert s.ALLOW_TAILNET is False
    assert s.tailnet_hosts == frozenset()


def test_tailnet_hosts_parsed_from_comma_list() -> None:
    s = Settings(_env_file=None, TAILNET_HOSTS=" Safarovs-Machine , x.ts.net. ,")  # pyright: ignore[reportCallIssue]
    assert s.tailnet_hosts == frozenset({"safarovs-machine", "x.ts.net"})


# --- client-IP middleware ---------------------------------------------------


def _dispatch(client_host: str) -> tuple[bool, Response | None]:
    mw_instance = mw.LocalhostOnlyMiddleware(app=None)  # pyright: ignore[reportArgumentType]
    scope: dict[str, Any] = {
        "type": "http",
        "client": (client_host, 50000),
        "method": "GET",
        "path": "/",
        "headers": [],
    }
    called = False

    async def call_next(request: Request) -> JSONResponse:
        nonlocal called
        called = True
        return JSONResponse({"ok": True})

    response = asyncio.run(mw_instance.dispatch(Request(scope), call_next))
    return called, response if isinstance(response, JSONResponse) else None


@pytest.mark.usefixtures("tailnet_on")
@pytest.mark.parametrize("host", ["127.0.0.1", "::1", PHONE_IP, "fd7a:115c:a1e0::9"])
def test_client_ip_on_accepts_loopback_and_tailnet(host: str) -> None:
    called, _ = _dispatch(host)
    assert called


@pytest.mark.usefixtures("tailnet_on")
@pytest.mark.parametrize("host", ["192.168.1.20", "10.0.0.5", "172.17.0.1"])
def test_client_ip_on_still_rejects_lan(host: str) -> None:
    called, response = _dispatch(host)
    assert not called
    assert response is not None and response.status_code == 403


@pytest.mark.usefixtures("tailnet_off")
def test_client_ip_off_by_default_rejects_tailnet() -> None:
    called, response = _dispatch(PHONE_IP)
    assert not called
    assert response is not None and response.status_code == 403


@pytest.mark.usefixtures("tailnet_off")
def test_client_ip_off_accepts_loopback() -> None:
    called, _ = _dispatch("127.0.0.1")
    assert called


# --- CORS -------------------------------------------------------------------


def _cors_preflight(origin: str) -> Any:
    return TestClient(app).options(
        "/api/v1/sessions",
        headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
    )


@pytest.mark.usefixtures("tailnet_on")
@pytest.mark.parametrize("origin", [f"http://{PHONE_IP}:3000", "http://safarovs-machine:3000"])
def test_cors_on_allows_tailnet_origin(origin: str) -> None:
    resp = _cors_preflight(origin)
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == origin


@pytest.mark.usefixtures("tailnet_on")
def test_cors_on_still_rejects_lan_origin() -> None:
    resp = _cors_preflight("http://192.168.1.20:3000")
    assert resp.status_code == 400
    assert "access-control-allow-origin" not in resp.headers


@pytest.mark.usefixtures("tailnet_on")
def test_cors_on_keeps_localhost_origin() -> None:
    resp = _cors_preflight("http://localhost:3000")
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"


@pytest.mark.usefixtures("tailnet_off")
def test_cors_off_rejects_tailnet_origin() -> None:
    resp = _cors_preflight(f"http://{PHONE_IP}:3000")
    assert resp.status_code == 400


@pytest.mark.usefixtures("tailnet_on")
def test_api_key_still_required_from_tailnet_origin() -> None:
    origin = f"http://{PHONE_IP}:3000"
    resp = TestClient(app).post("/api/v1/sessions/some-session/focus", headers={"Origin": origin})
    assert resp.status_code == 401
    assert resp.headers.get("access-control-allow-origin") == origin


# --- WebSocket origin -------------------------------------------------------


class _WS:
    def __init__(self, origin: str) -> None:
        self.headers = {"origin": origin}


@pytest.mark.usefixtures("tailnet_on")
@pytest.mark.parametrize(
    "origin", [f"http://{PHONE_IP}:3000", "http://safarovs-machine:3000", "http://localhost:3000"]
)
def test_ws_on_accepts_tailnet_and_localhost(origin: str) -> None:
    assert validate_websocket_origin(_WS(origin)) is True  # pyright: ignore[reportArgumentType]


@pytest.mark.usefixtures("tailnet_on")
@pytest.mark.parametrize("origin", ["http://192.168.1.20:3000", "http://0.0.0.0:3000"])
def test_ws_on_rejects_lan(origin: str) -> None:
    assert validate_websocket_origin(_WS(origin)) is False  # pyright: ignore[reportArgumentType]


@pytest.mark.usefixtures("tailnet_off")
def test_ws_off_rejects_tailnet() -> None:
    assert validate_websocket_origin(_WS(f"http://{PHONE_IP}:3000")) is False  # pyright: ignore[reportArgumentType]

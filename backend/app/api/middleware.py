"""HTTP middleware for the Claude Office backend.

Moved out of ``app.main`` in ARC-023. The trust boundary and auth behavior
live here: ``LocalhostOnlyMiddleware`` restricts access to the loopback
interface, and ``ApiKeyMiddleware`` gates state-changing endpoints behind
either an explicit user-configured key or the per-launch auto-generated
token (SEC-001 / SEC-002 / SEC-006). Logic is unchanged from the prior
inline version in ``main.py``.
"""

import hmac

from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import HTTPConnection
from starlette.types import Receive, Scope, Send

from app.api.client_trust import is_allowed_peer, is_trusted_network
from app.config import get_settings

# Resolved once at import time, mirroring the previous ``main.py`` pattern.
# ``Settings`` is a pydantic-settings singleton; subsequent ``get_settings()``
# calls return the same instance, so call-time attribute access is identical.
settings = get_settings()


class TailnetCORSMiddleware(CORSMiddleware):
    """CORS that also allows the office UI on the tailnet when ALLOW_TAILNET is on.

    Settings are read per request, so the configured origin list stays exact
    and the tailnet rule never widens it to other LAN hosts.
    """

    def is_allowed_origin(self, origin: str) -> bool:
        return super().is_allowed_origin(origin) or settings.is_tailnet_origin(origin)


class LocalhostOnlyMiddleware(BaseHTTPMiddleware):
    """Reject HTTP requests from non-localhost origins.

    This is a local-only development tool, not deployed to the public internet.
    All API endpoints (including subprocess execution and clipboard writes)
    are protected by restricting access to the loopback interface.

    ``"testclient"`` is the sentinel host used by Starlette's test transport
    and cannot appear on a real TCP connection, so it is safe to allow.
    With ``ALLOW_TAILNET`` Tailscale addresses pass too (never other LANs).
    WebSocket handshakes get the same check (closed with 1008), since
    ``BaseHTTPMiddleware`` alone never sees websocket scopes.
    """

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] == "websocket"
            and settings.LOCALHOST_ONLY
            and not is_allowed_peer(HTTPConnection(scope))
        ):
            await send({"type": "websocket.close", "code": 1008, "reason": "localhost only"})
            return
        await super().__call__(scope, receive, send)

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        if settings.LOCALHOST_ONLY and not is_allowed_peer(request):
            return JSONResponse(
                status_code=403,
                content={"detail": "Access denied: localhost only"},
            )
        return await call_next(request)


# Paths that do NOT require an API key (health checks, interactive docs).
# The OpenAPI schema URL is checked separately in the middleware because it is
# served under settings.API_V1_STR (e.g. /api/v1/openapi.json), not /openapi.json.
_NO_AUTH_PATHS = frozenset({"/health", "/docs", "/redoc", f"{settings.API_V1_STR}/auth/status"})


def _is_state_changing(path: str, method: str) -> bool:
    """Return True if the request targets a destructive or side-effecting endpoint.

    Covers global destructive operations (clearing all sessions, running a
    simulation) and per-session OS side effects (terminal activation + clipboard
    write via ``/focus``, typing into the terminal via ``/prompt``). Other
    per-session mutations remain open in the default configuration and are
    fully gated when an explicit key is set (handled by
    ``settings.has_explicit_key`` in the middleware).
    """
    prefix = settings.API_V1_STR + "/sessions"
    return (
        (path == prefix and method == "DELETE")
        or (path == f"{prefix}/simulate" and method == "POST")
        or (path.startswith(f"{prefix}/") and path.endswith("/focus") and method == "POST")
        or (path.startswith(f"{prefix}/") and path.endswith("/prompt") and method == "POST")
    )


def _always_keyed(path: str, method: str) -> bool:
    """Endpoints that need the key even from a trusted network.

    The state-changing set above (clear all, simulate, focus, web prompt),
    plus deleting a single session and event ingestion (the hooks always
    carry the key; nothing on the tailnet may inject events).
    """
    prefix = settings.API_V1_STR + "/sessions"
    return (
        _is_state_changing(path, method)
        or (path.startswith(f"{prefix}/") and method == "DELETE")
        or (path == f"{settings.API_V1_STR}/events" and method == "POST")
    )


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Validate X-API-Key header for protected endpoints.

    * When ``CLAUDE_OFFICE_API_KEY`` is explicitly set, ALL non-public paths
      require the key (existing behaviour).
    * When the key is empty (default), state-changing endpoints still require
      the per-launch auto-generated token (``settings.effective_api_key``).
      Read-only paths remain open for backwards compatibility.
    * Clients on a trusted network (TRUST_TAILNET / TRUST_LOOPBACK) skip the
      key for everything except ``_always_keyed`` endpoints; a stale key they
      send is ignored.
    """

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        if request.method == "OPTIONS":
            return await call_next(request)

        # Skip auth for public paths and WebSocket handshakes
        if (
            request.url.path in _NO_AUTH_PATHS
            or request.url.path == f"{settings.API_V1_STR}/openapi.json"
            or request.url.path.startswith("/ws/")
        ):
            return await call_next(request)

        # Determine whether auth is required for this request
        requires_auth = settings.has_explicit_key or _is_state_changing(
            request.url.path, request.method
        )

        if not requires_auth:
            return await call_next(request)

        if is_trusted_network(request) and not _always_keyed(request.url.path, request.method):
            return await call_next(request)

        provided = request.headers.get("X-API-Key", "")
        if not hmac.compare_digest(provided, settings.effective_api_key):
            return JSONResponse(status_code=401, content={"detail": "Invalid API key"})

        return await call_next(request)

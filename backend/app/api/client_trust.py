"""Client trust checks shared by HTTP middleware, auth status and WebSockets.

The decision never depends on uvicorn's launch flags: with its default
``proxy_headers`` a loopback peer can rewrite ``scope["client"]`` through
X-Forwarded-For, so a connection carrying any forwarded header has no known
peer and gets no network trust at all.
"""

from starlette.requests import HTTPConnection

from app.config import get_settings

# ``"testclient"`` is Starlette's test transport host; it cannot appear on a
# real TCP connection.
_LOCALHOST_HOSTS = frozenset({"127.0.0.1", "::1", "localhost", "testclient"})
_FORWARDED_HEADERS = ("x-forwarded-for", "forwarded", "x-real-ip")


def peer_host(conn: HTTPConnection) -> str | None:
    """The client address, or None when forwarded headers make it unknowable."""
    if any(name in conn.headers for name in _FORWARDED_HEADERS):
        return None
    return conn.client.host if conn.client else None


def is_allowed_peer(conn: HTTPConnection) -> bool:
    """Loopback always; Tailscale clients when tailnet access is on."""
    host = peer_host(conn)
    if host in _LOCALHOST_HOSTS:
        return True
    settings = get_settings()
    return settings.tailnet_enabled and settings.is_tailnet_client(host)


def is_trusted_network(conn: HTTPConnection) -> bool:
    """Keyless access: a trusted-network peer that addressed this machine by name."""
    settings = get_settings()
    return settings.is_trusted_network_client(peer_host(conn)) and settings.is_own_host(
        conn.headers.get("host")
    )

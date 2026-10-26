"""Tailscale address and Origin checks for opt-in phone access (ALLOW_TAILNET).

Only Tailscale's own ranges count, never other private/LAN addresses, so a
device on the home Wi-Fi (192.168.x) stays outside the trust boundary.
"""

import ipaddress
from collections.abc import Iterable
from urllib.parse import urlparse, urlsplit

# Tailscale address ranges: CGNAT IPv4 and the tailnet ULA prefix.
TAILSCALE_NETWORKS = (
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("fd7a:115c:a1e0::/48"),
)
# The office UI (next dev) is the only browser origin served over the tailnet.
TAILNET_UI_PORT = 3000


def ip_of(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    """Parse *host* as an IP address; IPv4-mapped IPv6 becomes plain IPv4."""
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return None
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        return addr.ipv4_mapped
    return addr


def is_tailscale_ip(host: str | None) -> bool:
    addr = ip_of(host) if host else None
    return addr is not None and any(addr in net for net in TAILSCALE_NETWORKS)


def is_loopback_ip(host: str | None) -> bool:
    addr = ip_of(host) if host else None
    return addr is not None and addr.is_loopback


def parse_hosts(raw: str) -> frozenset[str]:
    """Comma-separated MagicDNS names -> lowercase set, trailing dots dropped."""
    return frozenset(h.strip().lower().rstrip(".") for h in raw.split(",") if h.strip())


def parse_ips(raw: str) -> frozenset[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    """Comma-separated IP addresses -> set of addresses; invalid entries dropped."""
    parsed = (ip_of(part.strip()) for part in raw.split(","))
    return frozenset(addr for addr in parsed if addr is not None)


def host_name(host_header: str | None) -> str | None:
    """Host header (``name:port``, ``[v6]:port``) -> lowercase name without port."""
    if not host_header:
        return None
    try:
        name = urlsplit(f"//{host_header.strip()}").hostname
    except ValueError:
        return None
    return name.rstrip(".") if name else None


def is_tailnet_origin(origin: str | None, hosts: Iterable[str]) -> bool:
    """True for ``http(s)://<tailscale IP or a name in hosts>:3000``."""
    if not origin:
        return False
    try:
        parsed = urlparse(origin.rstrip("/"))
        host = parsed.hostname
        port = parsed.port
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or not host or port != TAILNET_UI_PORT:
        return False
    return is_tailscale_ip(host) or host.rstrip(".") in hosts

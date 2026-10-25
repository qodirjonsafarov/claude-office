"""401 responses from the API-key middleware must carry CORS headers."""

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def test_401_carries_cors_header_for_allowed_origin() -> None:
    settings = get_settings()
    origin = settings.BACKEND_CORS_ORIGINS[0]
    client = TestClient(app)
    resp = client.post(
        f"{settings.API_V1_STR}/sessions/some-session/focus",
        headers={"Origin": origin},
    )
    assert resp.status_code == 401
    assert resp.headers.get("access-control-allow-origin") == origin

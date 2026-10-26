"""POST /sessions/{id}/prompt: chat from the office UI into Claude's terminal.

The text is pasted into the tmux pane the session runs in; the reply comes
back through the normal hook events (UserPromptSubmit / Stop). Guarded by a
feature flag, an explicit API key, a client-IP and Origin allowlist, a rate
limit and pane checks; every attempt past the key check is audited.
"""

import hmac
import logging
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.chat_status import chat_status, permission_pending
from app.core.event_processor import get_event_processor
from app.core.state_machine import WEB_PROMPT_NOTIFICATION
from app.core.web_prompt import (
    MAX_PROMPT_CHARS,
    PromptRateLimiter,
    PromptRejectedError,
    append_audit,
    is_allowed_client_ip,
    is_allowed_origin,
    sanitize_prompt,
)
from app.db.database import get_db
from app.db.models import SessionRecord
from app.models.events import EventAdapter, EventType
from app.services.tmux_service import (
    PaneBusyError,
    PaneChangedError,
    TmuxError,
    get_tmux_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])

_SESSION_ID = re.compile(r"[a-zA-Z0-9_-]{1,128}")

_limiter = PromptRateLimiter(per_session=5, overall=20)


def reset_prompt_rate_limiter() -> None:
    """Clear the prompt rate limiter (tests)."""
    _limiter.reset()


class PromptRequest(BaseModel):
    text: str = Field(max_length=MAX_PROMPT_CHARS)


def _fail(status_code: int, reason: str, message: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"reason": reason, "message": message})


_CONFLICT_MESSAGES = {
    "inactive": "The session has ended",
    "no_tmux": "Claude is not running inside tmux",
    "pane_reused": "Another session now runs in this tmux pane",
    "pane_gone": "The tmux pane is gone",
    "not_claude": "The tmux pane is not running Claude",
    "permission_pending": "A permission request is waiting in the terminal",
    "terminal_busy": "Claude is busy with a dialog — answer it in the terminal",
}


async def _pane_owner(db: AsyncSession, socket: str | None, pane: str) -> str | None:
    """The active session that reported *pane* on this tmux server most recently."""
    same_socket = (
        SessionRecord.tmux_socket.is_(None)
        if socket is None
        else SessionRecord.tmux_socket == socket
    )
    result = await db.execute(
        select(SessionRecord.id)
        .where(SessionRecord.tmux_pane == pane, same_socket, SessionRecord.status == "active")
        .order_by(SessionRecord.updated_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.post("/{session_id}/prompt")
async def send_prompt(
    session_id: str,
    body: PromptRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, str]:
    """Paste *body.text* into the session's Claude Code terminal and press Enter."""
    settings = get_settings()
    if not settings.ENABLE_WEB_PROMPT:
        raise _fail(
            403, "disabled", "Chat is off — enable it in the office settings (backend .env)"
        )
    if not settings.has_explicit_key:
        raise _fail(403, "no_key", "Chat needs an explicit CLAUDE_OFFICE_API_KEY")
    # The middleware checks the key too; this route never trusts the auto token.
    provided = request.headers.get("X-API-Key", "").encode("utf-8")
    if not hmac.compare_digest(provided, settings.CLAUDE_OFFICE_API_KEY.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Everything past the key check is audited, refusals included.
    client_ip = request.client.host if request.client else None
    origin = request.headers.get("origin")
    audit_path = Path(settings.WEB_PROMPT_AUDIT_LOG)
    pane: str | None = None

    def audit(outcome: str, text: str = body.text) -> None:
        try:
            append_audit(
                audit_path,
                key=settings.CLAUDE_OFFICE_API_KEY,
                client_ip=client_ip,
                origin=origin,
                session_id=session_id[:128],
                pane=pane,
                text=text,
                outcome=outcome,
            )
        except OSError:
            logger.exception("Could not write the web prompt audit log")

    tailnet = settings.WEB_PROMPT_TAILNET_HOST
    if not is_allowed_client_ip(client_ip, tailnet=bool(tailnet)):
        audit("client_ip")
        raise _fail(403, "client_ip", "Chat is only allowed from this machine or the tailnet")
    if not (
        is_allowed_origin(origin, settings.BACKEND_CORS_ORIGINS, tailnet)
        or settings.is_tailnet_origin(origin)
    ):
        audit("origin")
        raise _fail(403, "origin", "Origin not allowed")

    try:
        text = sanitize_prompt(body.text)
    except PromptRejectedError as exc:
        audit("invalid_text")
        raise _fail(422, "invalid_text", str(exc)) from exc

    rec = None
    if _SESSION_ID.fullmatch(session_id):
        rec = (
            await db.execute(select(SessionRecord).where(SessionRecord.id == session_id))
        ).scalar_one_or_none()
    if rec is None:
        audit("not_found", text)
        raise HTTPException(status_code=404, detail="Session not found")
    pane, socket = rec.tmux_pane, rec.tmux_socket

    if not _limiter.allow(session_id):
        audit("rate_limited", text)
        raise _fail(429, "rate_limited", "Too many messages, try again in a minute")

    processor = get_event_processor()
    await processor.get_current_state(session_id)  # loads the session if evicted
    sm = processor.sessions.get(session_id)
    owner = await _pane_owner(db, socket, pane) if pane else None
    status = await chat_status(
        active=rec.status == "active",
        pane=pane,
        socket=socket,
        pane_taken=bool(pane) and owner not in (None, session_id),
        waiting_permission=permission_pending(sm),
        label=rec.project_name,
        fresh=True,
    )
    if not status.can_send or pane is None:
        reason = status.reason or "no_tmux"
        audit(reason, text)
        raise _fail(409, reason, _CONFLICT_MESSAGES.get(reason, "Cannot send to this session"))

    try:
        await get_tmux_service().send_prompt(pane, text, socket)
    except PaneBusyError as exc:
        audit(f"terminal_busy:{exc.reason}", text)
        raise _fail(409, "terminal_busy", _CONFLICT_MESSAGES["terminal_busy"]) from exc
    except PaneChangedError as exc:
        reason = "pane_gone" if exc.state == "gone" else "not_claude"
        audit(reason, text)
        raise _fail(409, reason, _CONFLICT_MESSAGES[reason]) from exc
    except (TmuxError, ValueError) as exc:
        audit("tmux_error", text)
        logger.warning("Web prompt to %s failed: %s", pane, exc)
        raise _fail(502, "tmux_error", "Could not send to the terminal") from exc
    audit("sent", text)

    # The boss shows a short "Message received" bubble; the log gets a row.
    await processor.process_event(
        EventAdapter.validate_python(
            {
                "event_type": EventType.NOTIFICATION,
                "session_id": session_id,
                "timestamp": datetime.now(UTC),
                "data": {
                    "notification_type": WEB_PROMPT_NOTIFICATION,
                    "message": "Message sent from web",
                    "agent_id": "main",
                },
            }
        )
    )
    return {"status": "sent"}

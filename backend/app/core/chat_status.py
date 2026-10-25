"""Chat status for the office UI: can a prompt be sent into this session now?

Gathers the facts (feature flag, explicit key, session state, tmux pane) and
hands them to ``web_prompt.chat_block_reason``. Used by the state
broadcasts, the sessions list and the prompt route, so all three agree.

State broadcasts never wait for tmux: they read the last pane check
(``live=False``). ``refresh_chat_statuses`` re-checks the panes of known live
sessions in the background (``chat_status_loop``) and re-broadcasts the
sessions whose status changed.
"""

import asyncio
import logging
from collections.abc import Mapping

from app.config import get_settings
from app.core.state_machine import StateMachine
from app.core.web_prompt import PaneState, chat_block_reason
from app.models.agents import AgentState, BossState
from app.models.sessions import ChatStatus
from app.services.tmux_service import get_tmux_service

logger = logging.getLogger(__name__)


def permission_pending(sm: StateMachine | None) -> bool:
    """True while the boss or an agent waits for a permission answer."""
    if sm is None:
        return False
    return sm.boss_state == BossState.WAITING_PERMISSION or any(
        agent.state == AgentState.WAITING_PERMISSION for agent in sm.agents.values()
    )


def _wants_pane_check(active: bool, pane: str | None, pane_taken: bool) -> bool:
    settings = get_settings()
    return bool(
        settings.ENABLE_WEB_PROMPT
        and settings.has_explicit_key
        and active
        and pane
        and not pane_taken
    )


async def chat_status(
    *,
    active: bool,
    pane: str | None,
    socket: str | None = None,
    pane_taken: bool,
    waiting_permission: bool,
    label: str | None,
    live: bool = True,
    fresh: bool = False,
) -> ChatStatus:
    """The chat status from these facts.

    With *live* the pane is checked now (cached briefly, *fresh* skips the
    cache); without it only the last check is read and nothing runs.
    """
    settings = get_settings()
    pane_state: PaneState | None = None
    if pane and _wants_pane_check(active, pane, pane_taken):
        tmux = get_tmux_service()
        if live:
            pane_state = await tmux.pane_state(pane, socket, fresh=fresh)
        else:
            pane_state = tmux.cached_state(pane, socket)
    reason = chat_block_reason(
        enabled=settings.ENABLE_WEB_PROMPT,
        has_explicit_key=settings.has_explicit_key,
        active=active,
        pane=pane,
        pane_state=pane_state,
        pane_taken=pane_taken,
        permission_pending=waiting_permission,
    )
    return ChatStatus(can_send=reason is None, reason=reason, label=label)


def pane_taken_in_memory(
    session_id: str, sm: StateMachine, sessions: Mapping[str, StateMachine]
) -> bool:
    """True when a newer live session reported the same pane on the same tmux server."""
    if not sm.tmux_pane:
        return False
    return any(
        sid != session_id
        and other.tmux_pane == sm.tmux_pane
        and other.tmux_socket == sm.tmux_socket
        and not other.session_ended
        and other.last_event_at > sm.last_event_at
        for sid, other in sessions.items()
    )


async def chat_status_for(
    session_id: str,
    sm: StateMachine,
    sessions: Mapping[str, StateMachine],
    *,
    live: bool = True,
) -> ChatStatus:
    """Chat status of an in-memory session (office state)."""
    return await chat_status(
        active=not sm.session_ended,
        pane=sm.tmux_pane,
        socket=sm.tmux_socket,
        pane_taken=pane_taken_in_memory(session_id, sm, sessions),
        waiting_permission=permission_pending(sm),
        label=sm.project_name,
        live=live,
    )


# Last status each session was broadcast with, to re-broadcast only changes.
_last_status: dict[str, ChatStatus] = {}


async def refresh_chat_statuses(sessions: Mapping[str, StateMachine]) -> set[str]:
    """Re-check the panes of live sessions; return the ids whose status changed."""
    changed: set[str] = set()
    snapshot = dict(sessions)
    for sid, sm in snapshot.items():
        if sm.session_ended or not sm.tmux_pane:
            _last_status.pop(sid, None)
            continue
        taken = pane_taken_in_memory(sid, sm, snapshot)
        if _wants_pane_check(True, sm.tmux_pane, taken):
            await get_tmux_service().pane_state(sm.tmux_pane, sm.tmux_socket, fresh=True)
        status = await chat_status_for(sid, sm, snapshot, live=False)
        if _last_status.get(sid) != status:
            _last_status[sid] = status
            changed.add(sid)
    for sid in [s for s in _last_status if s not in snapshot]:
        del _last_status[sid]
    return changed


async def chat_status_loop(interval: float = 3.0) -> None:
    """Background task: keep pane checks fresh and push status changes."""
    from app.core.broadcast_service import broadcast_state
    from app.core.event_processor import get_event_processor

    while True:
        await asyncio.sleep(interval)
        try:
            processor = get_event_processor()
            for sid in await refresh_chat_statuses(processor.sessions):
                sm = processor.sessions.get(sid)
                if sm is not None:
                    await broadcast_state(sid, sm)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Chat status refresh failed")

"""Chat status for the office UI: can a prompt be sent into this session now?

Gathers the facts (feature flag, explicit key, session state, tmux pane) and
hands them to ``web_prompt.chat_block_reason``. Used by the state
broadcasts, the sessions list and the prompt route, so all three agree.
"""

from collections.abc import Mapping

from app.config import get_settings
from app.core.state_machine import StateMachine
from app.core.web_prompt import PaneState, chat_block_reason
from app.models.agents import AgentState, BossState
from app.models.sessions import ChatStatus
from app.services.tmux_service import get_tmux_service


def permission_pending(sm: StateMachine | None) -> bool:
    """True while the boss or an agent waits for a permission answer."""
    if sm is None:
        return False
    return sm.boss_state == BossState.WAITING_PERMISSION or any(
        agent.state == AgentState.WAITING_PERMISSION for agent in sm.agents.values()
    )


async def chat_status(
    *,
    active: bool,
    pane: str | None,
    pane_taken: bool,
    waiting_permission: bool,
    label: str | None,
    fresh: bool = False,
) -> tuple[ChatStatus, PaneState | None]:
    """The status plus the pane state it was based on (None when not checked).

    tmux is asked only when nothing cheaper already rules the send out.
    """
    settings = get_settings()
    pane_state: PaneState | None = None
    if (
        settings.ENABLE_WEB_PROMPT
        and settings.has_explicit_key
        and active
        and pane
        and not pane_taken
    ):
        pane_state = await get_tmux_service().pane_state(pane, fresh=fresh)
    reason = chat_block_reason(
        enabled=settings.ENABLE_WEB_PROMPT,
        has_explicit_key=settings.has_explicit_key,
        active=active,
        pane=pane,
        pane_state=pane_state,
        pane_taken=pane_taken,
        permission_pending=waiting_permission,
    )
    return ChatStatus(can_send=reason is None, reason=reason, label=label), pane_state


def pane_taken_in_memory(
    session_id: str, sm: StateMachine, sessions: Mapping[str, StateMachine]
) -> bool:
    """True when a newer live session reported the same tmux pane."""
    if not sm.tmux_pane:
        return False
    return any(
        sid != session_id
        and other.tmux_pane == sm.tmux_pane
        and not other.session_ended
        and other.last_event_at > sm.last_event_at
        for sid, other in sessions.items()
    )


async def chat_status_for(
    session_id: str, sm: StateMachine, sessions: Mapping[str, StateMachine]
) -> ChatStatus:
    """Chat status of a live in-memory session (office state broadcasts)."""
    status, _ = await chat_status(
        active=not sm.session_ended,
        pane=sm.tmux_pane,
        pane_taken=pane_taken_in_memory(session_id, sm, sessions),
        waiting_permission=permission_pending(sm),
        label=sm.project_name,
    )
    return status

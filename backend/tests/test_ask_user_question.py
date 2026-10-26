"""AskUserQuestion waits for the owner, like a permission prompt.

Claude Code sends no PermissionRequest for AskUserQuestion: only a
PreToolUse when the question opens and a PostToolUse when the owner answers.
The asking character shows "needs you" (``waiting_permission``) in between.
"""

from datetime import UTC, datetime

from app.core.state_machine import StateMachine
from app.models.agents import AgentState, BossState
from app.models.events import AgentEvent, AgentEventData, EventType, ToolEvent, ToolEventData

T0 = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)
SESSION = "sess-ask"
QUESTION = {"questions": [{"question": "Which color?", "options": [{"label": "Red"}]}]}


def tool(sm: StateMachine, kind: EventType, name: str, agent_id: str = "main") -> None:
    sm.transition(
        ToolEvent(
            event_type=kind,
            session_id=SESSION,
            timestamp=T0,
            data=ToolEventData(
                agent_id=agent_id, tool_name=name, tool_input=QUESTION, tool_use_id="toolu_q"
            ),
        )
    )


def test_boss_question_needs_you_until_answered() -> None:
    sm = StateMachine()

    tool(sm, EventType.PRE_TOOL_USE, "AskUserQuestion")
    assert sm.to_game_state(SESSION).boss.state == BossState.WAITING_PERMISSION

    tool(sm, EventType.POST_TOOL_USE, "AskUserQuestion")
    assert sm.to_game_state(SESSION).boss.state != BossState.WAITING_PERMISSION


def test_subagent_question_marks_that_agent() -> None:
    sm = StateMachine()
    sm.transition(
        AgentEvent(
            event_type=EventType.SUBAGENT_START,
            session_id=SESSION,
            timestamp=T0,
            data=AgentEventData(agent_id="subagent_a", agent_name="Dev"),
        )
    )

    tool(sm, EventType.PRE_TOOL_USE, "AskUserQuestion", agent_id="subagent_a")
    assert sm.agents["subagent_a"].state == AgentState.WAITING_PERMISSION
    assert sm.boss_state != BossState.WAITING_PERMISSION

    tool(sm, EventType.POST_TOOL_USE, "AskUserQuestion", agent_id="subagent_a")
    assert sm.agents["subagent_a"].state == AgentState.WORKING


def test_other_agents_tools_keep_the_boss_waiting() -> None:
    sm = StateMachine()
    sm.transition(
        AgentEvent(
            event_type=EventType.SUBAGENT_START,
            session_id=SESSION,
            timestamp=T0,
            data=AgentEventData(agent_id="subagent_a", agent_name="Dev"),
        )
    )
    tool(sm, EventType.PRE_TOOL_USE, "AskUserQuestion")

    tool(sm, EventType.PRE_TOOL_USE, "Bash", agent_id="subagent_a")
    tool(sm, EventType.POST_TOOL_USE, "Bash", agent_id="subagent_a")

    assert sm.boss_state == BossState.WAITING_PERMISSION

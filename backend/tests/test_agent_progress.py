"""Tests for per-agent work progress (todo lists and Task* tools)."""

from typing import Any, Literal

from app.core.state_machine import StateMachine
from app.models.agents import Agent, AgentProgress, AgentState
from app.models.events import EventType, ToolEvent, ToolEventData

SUB = "subagent_toolu_01ABC"


def _tool(
    event_type: Literal[EventType.PRE_TOOL_USE, EventType.POST_TOOL_USE],
    tool_name: str | None,
    agent_id: str = "main",
    tool_input: dict[str, Any] | None = None,
    tool_use_id: str = "toolu_x",
    **extra: Any,
) -> ToolEvent:
    return ToolEvent(
        event_type=event_type,
        session_id="s1",
        data=ToolEventData(
            agent_id=agent_id,
            tool_name=tool_name,
            tool_input=tool_input,
            tool_use_id=tool_use_id,
            **extra,
        ),
    )


def _todo_write(agent_id: str, statuses: list[str], **extra: Any) -> ToolEvent:
    todos = [
        {"content": f"step {i}", "status": s, "activeForm": f"Doing step {i}"}
        for i, s in enumerate(statuses)
    ]
    return _tool(EventType.PRE_TOOL_USE, "TodoWrite", agent_id, {"todos": todos}, **extra)


def _with_agent(sm: StateMachine, agent_id: str = SUB) -> StateMachine:
    sm.agents[agent_id] = Agent(id=agent_id, color="#fff", number=1, state=AgentState.WORKING)
    return sm


def _agent_progress(sm: StateMachine, agent_id: str = SUB) -> AgentProgress | None:
    state = sm.to_game_state("s1")
    return next(a for a in state.agents if a.id == agent_id).progress


class TestTodoWriteProgress:
    def test_no_todo_list_means_null_progress(self) -> None:
        sm = _with_agent(StateMachine())
        state = sm.to_game_state("s1")
        assert state.boss.progress is None
        assert state.agents[0].progress is None

    def test_boss_progress_counts_completed_todos(self) -> None:
        sm = StateMachine()
        sm.transition(_todo_write("main", ["completed", "in_progress", "pending"]))
        progress = sm.to_game_state("s1").boss.progress
        assert progress == AgentProgress(done=1, total=3, current="Doing step 1", source="todos")

    def test_subagent_todo_write_does_not_clobber_boss_todos(self) -> None:
        sm = _with_agent(StateMachine())
        sm.transition(_todo_write("main", ["completed", "pending"]))
        sm.transition(_todo_write(SUB, ["completed", "completed", "completed", "pending"]))

        assert len(sm.todos) == 2
        boss = sm.to_game_state("s1").boss.progress
        assert boss is not None and (boss.done, boss.total) == (1, 2)
        sub = _agent_progress(sm)
        assert sub is not None and (sub.done, sub.total) == (3, 4)

    def test_hook_copy_of_subagent_todo_write_is_ignored_for_boss(self) -> None:
        """Hooks report subagent tools as agent "main" plus the native agent id."""
        sm = StateMachine()
        sm.transition(_todo_write("main", ["pending"], native_agent_id="a1b2c3"))
        assert sm.todos == []
        assert sm.to_game_state("s1").boss.progress is None

    def test_progress_is_cleared_when_agent_is_removed(self) -> None:
        sm = _with_agent(StateMachine())
        sm.transition(_todo_write(SUB, ["completed"]))
        sm.remove_agent(SUB)
        assert SUB not in sm.agent_progress.todos


class TestTaskToolProgress:
    def _create(self, sm: StateMachine, agent_id: str, use_id: str, task_id: str | None) -> None:
        sm.transition(
            _tool(
                EventType.PRE_TOOL_USE,
                "TaskCreate",
                agent_id,
                {"subject": f"task {use_id}", "activeForm": f"Working on {use_id}"},
                tool_use_id=use_id,
            )
        )
        sm.transition(
            _tool(
                EventType.POST_TOOL_USE,
                "TaskCreate",
                agent_id,
                tool_use_id=use_id,
                created_task_id=task_id,
            )
        )

    def _update(self, sm: StateMachine, agent_id: str, task_id: str, status: str) -> None:
        sm.transition(
            _tool(
                EventType.PRE_TOOL_USE,
                "TaskUpdate",
                agent_id,
                {"taskId": task_id, "status": status},
                tool_use_id=f"upd_{task_id}_{status}",
            )
        )

    def test_created_tasks_count_towards_total(self) -> None:
        sm = _with_agent(StateMachine())
        self._create(sm, SUB, "u1", "1")
        self._create(sm, SUB, "u2", "2")
        progress = _agent_progress(sm)
        assert progress == AgentProgress(done=0, total=2, current=None, source="tasks")

    def test_task_update_marks_done_and_current(self) -> None:
        sm = _with_agent(StateMachine())
        self._create(sm, SUB, "u1", "1")
        self._create(sm, SUB, "u2", "2")
        self._update(sm, SUB, "1", "completed")
        self._update(sm, SUB, "2", "in_progress")
        progress = _agent_progress(sm)
        assert progress == AgentProgress(done=1, total=2, current="Working on u2", source="tasks")

    def test_deleted_task_leaves_total(self) -> None:
        sm = _with_agent(StateMachine())
        self._create(sm, SUB, "u1", "1")
        self._create(sm, SUB, "u2", "2")
        self._update(sm, SUB, "2", "deleted")
        progress = _agent_progress(sm)
        assert progress is not None and (progress.done, progress.total) == (0, 1)

    def test_tasks_belong_to_the_agent_that_created_them(self) -> None:
        sm = _with_agent(StateMachine())
        self._create(sm, "main", "u1", "1")
        self._create(sm, SUB, "u2", "2")
        boss = sm.to_game_state("s1").boss.progress
        sub = _agent_progress(sm)
        assert boss is not None and boss.total == 1
        assert sub is not None and sub.total == 1

    def test_update_of_unknown_task_is_ignored(self) -> None:
        sm = _with_agent(StateMachine())
        self._update(sm, SUB, "99", "completed")
        assert _agent_progress(sm) is None

    def test_create_without_known_id_still_counts(self) -> None:
        sm = _with_agent(StateMachine())
        self._create(sm, SUB, "u1", None)
        progress = _agent_progress(sm)
        assert progress is not None and progress.total == 1

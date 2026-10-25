"""Per-agent work progress from todo lists and Task* tool calls.

Two sources feed it:

* ``TodoWrite`` — each call carries the agent's full todo list, so the
  latest list per agent replaces the previous one.
* ``TaskCreate`` / ``TaskUpdate`` — tasks are created one by one. The task id
  only exists in the tool response, so a create is first held under its
  ``tool_use_id`` and re-keyed when the POST_TOOL_USE carries
  ``created_task_id``. A task belongs to the agent that created it.

Agents without either source have no progress (``None``); nothing is guessed.
"""

from dataclasses import dataclass, field
from typing import Any, cast

from app.models.agents import AgentProgress
from app.models.common import TodoItem, TodoStatus

_TASK_DONE = "completed"
_TASK_ACTIVE = "in_progress"
_TASK_DELETED = "deleted"


@dataclass
class TrackedTask:
    """A task created through TaskCreate."""

    owner: str
    subject: str
    active_form: str | None
    status: str = "pending"


def _empty_todos() -> dict[str, list[TodoItem]]:
    return cast(dict[str, list[TodoItem]], {})


def _empty_tasks() -> dict[str, TrackedTask]:
    return cast(dict[str, TrackedTask], {})


def progress_from_todos(todos: list[TodoItem]) -> AgentProgress | None:
    """Build progress from a todo list, or ``None`` when the list is empty."""
    if not todos:
        return None
    done = sum(1 for t in todos if t.status == TodoStatus.COMPLETED)
    current = next(
        (t.active_form or t.content for t in todos if t.status == TodoStatus.IN_PROGRESS),
        None,
    )
    return AgentProgress(done=done, total=len(todos), current=current, source="todos")


def _progress_from_tasks(tasks: list[TrackedTask]) -> AgentProgress | None:
    live = [t for t in tasks if t.status != _TASK_DELETED]
    if not live:
        return None
    done = sum(1 for t in live if t.status == _TASK_DONE)
    current = next(
        (t.active_form or t.subject for t in live if t.status == _TASK_ACTIVE),
        None,
    )
    return AgentProgress(done=done, total=len(live), current=current, source="tasks")


@dataclass
class ProgressTracker:
    """Tracks todo lists and created tasks per agent id (``"main"`` = boss)."""

    todos: dict[str, list[TodoItem]] = field(default_factory=_empty_todos)
    # Keyed by real task id, or by tool_use_id until the id is known.
    tasks: dict[str, TrackedTask] = field(default_factory=_empty_tasks)

    def set_todos(self, agent_id: str, todos: list[TodoItem]) -> None:
        """Replace an agent's todo list (one TodoWrite call)."""
        self.todos[agent_id] = todos

    def task_created(self, agent_id: str, tool_use_id: str, tool_input: dict[str, Any]) -> None:
        """Record a TaskCreate call (PRE_TOOL_USE) under its tool_use_id."""
        if not tool_use_id or tool_use_id in self.tasks:
            return
        active_raw = tool_input.get("activeForm")
        self.tasks[tool_use_id] = TrackedTask(
            owner=agent_id,
            subject=str(tool_input.get("subject") or ""),
            active_form=str(active_raw) if active_raw else None,
        )

    def task_id_known(self, tool_use_id: str, task_id: str) -> None:
        """Re-key a pending create once its real task id is known."""
        task = self.tasks.pop(tool_use_id, None)
        if task is not None and task_id not in self.tasks:
            self.tasks[task_id] = task

    def task_updated(self, tool_input: dict[str, Any]) -> None:
        """Apply a TaskUpdate call. Unknown task ids are ignored."""
        task_id = str(tool_input.get("taskId") or "")
        task = self.tasks.get(task_id)
        if task is None:
            return
        status = tool_input.get("status")
        if isinstance(status, str) and status:
            task.status = status
        active_raw = tool_input.get("activeForm")
        if active_raw:
            task.active_form = str(active_raw)

    def forget_agent(self, agent_id: str) -> None:
        """Drop everything tracked for an agent that left the office."""
        self.todos.pop(agent_id, None)
        for key in [k for k, t in self.tasks.items() if t.owner == agent_id]:
            del self.tasks[key]

    def progress_for(self, agent_id: str) -> AgentProgress | None:
        """Return progress for an agent: its todo list first, then its tasks."""
        from_todos = progress_from_todos(self.todos.get(agent_id, []))
        if from_todos is not None:
            return from_todos
        return _progress_from_tasks([t for t in self.tasks.values() if t.owner == agent_id])

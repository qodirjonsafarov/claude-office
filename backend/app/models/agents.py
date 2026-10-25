from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.models.common import BubbleContent

__all__ = [
    "AgentProgress",
    "AgentState",
    "BossState",
    "Agent",
    "Boss",
    "ElevatorState",
    "PhoneState",
    "OfficeState",
    "TokenUsage",
]


class AgentState(StrEnum):
    """Visual states for agent characters."""

    ARRIVING = "arriving"
    REPORTING = "reporting"
    WALKING_TO_DESK = "walking_to_desk"
    WORKING = "working"
    THINKING = "thinking"
    WAITING_PERMISSION = "waiting_permission"
    COMPLETED = "completed"
    WAITING = "waiting"
    REPORTING_DONE = "reporting_done"
    LEAVING = "leaving"
    IN_ELEVATOR = "in_elevator"
    IDLE = "idle"


class BossState(StrEnum):
    """Visual states for the boss character."""

    IDLE = "idle"
    PHONE_RINGING = "phone_ringing"
    ON_PHONE = "on_phone"
    RECEIVING = "receiving"
    WORKING = "working"
    DELEGATING = "delegating"
    WAITING_PERMISSION = "waiting_permission"
    REVIEWING = "reviewing"
    COMPLETING = "completing"


class AgentProgress(BaseModel):
    """Work progress of one character, from its own todo list or Task* tools.

    ``source`` is ``"todos"`` for TodoWrite / task-file / beads lists and
    ``"tasks"`` for items tracked from TaskCreate / TaskUpdate tool calls.
    ``current`` is the active form (or subject) of the item in progress.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    done: int
    total: int
    current: str | None = None
    source: Literal["todos", "tasks"]


class Agent(BaseModel):
    """Represents a subagent in the office visualization."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str
    native_id: str | None = None  # Native Claude agent ID (e.g., "a5a60c7")
    name: str | None = None
    color: str
    number: int
    state: AgentState
    desk: int | None = None
    bubble: BubbleContent | None = None
    current_task: str | None = None
    position: dict[str, int] = {"x": 0, "y": 0}
    # Agent Teams character hierarchy (Phase 4)
    character_type: str | None = None  # "lead" | "teammate" | "subagent"
    parent_session_id: str | None = None  # session that owns this character
    parent_id: str | None = None  # for subagents: parent lead/teammate id
    progress: AgentProgress | None = None  # None = agent has no todo list


class Boss(BaseModel):
    """Represents the main Claude agent (boss) in the office visualization."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    state: BossState
    current_task: str | None = None
    bubble: BubbleContent | None = None
    position: dict[str, int] = {"x": 640, "y": 830}
    progress: AgentProgress | None = None  # None = boss has no todo list


class ElevatorState(StrEnum):
    """Visual states for the elevator."""

    CLOSED = "closed"
    ARRIVING = "arriving"
    OPEN = "open"
    DEPARTING = "departing"


class PhoneState(StrEnum):
    """Visual states for the boss's phone."""

    IDLE = "idle"
    RINGING = "ringing"
    IN_USE = "in_use"


class TokenUsage(BaseModel):
    """Token totals for a whole session (main transcript plus its subagents).

    Each API message is counted once (by ``message.id``). ``model`` is the
    latest model of the main session. ``cost_usd`` is an estimate from the
    price table in ``token_tracker.py``; it is ``None`` when any model used
    in the session has no known price.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    model: str | None = None
    cost_usd: float | None = None


class OfficeState(BaseModel):
    """Represents the overall state of the office environment."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    desk_count: int = 8
    elevator_state: ElevatorState = ElevatorState.CLOSED
    phone_state: PhoneState = PhoneState.IDLE
    context_utilization: float = 0.0
    # Tokens in the current context and the window they are measured against.
    context_tokens: int = 0
    context_window: int = 200_000
    token_usage: TokenUsage | None = None  # None until a transcript was read
    tool_uses_since_compaction: int = 0
    print_report: bool = False

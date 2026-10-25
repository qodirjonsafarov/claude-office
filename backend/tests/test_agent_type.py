"""The agent's type (the Agent tool's subagent_type) reaches the frontend.

The office picks a character look by role (developer, qa, reviewer, ...),
so the type must be stored on the Agent and serialized as `agentType`.
"""

from app.core.state_machine import StateMachine
from app.models.agents import Agent, AgentState
from app.models.events import AgentEventData


def test_create_agent_keeps_the_subagent_type() -> None:
    sm = StateMachine()
    agent = sm.create_agent(
        AgentEventData(agent_id="a1", agent_name="Fix login", agent_type="developer")
    )
    assert agent.agent_type == "developer"


def test_agent_type_is_optional() -> None:
    sm = StateMachine()
    agent = sm.create_agent(AgentEventData(agent_id="a2", agent_name="Something"))
    assert agent.agent_type is None


def test_agent_type_is_sent_as_camel_case() -> None:
    agent = Agent(id="x", color="#fff", number=1, state=AgentState.WORKING, agent_type="qa")
    assert agent.model_dump(by_alias=True)["agentType"] == "qa"

"""Tests for event_mapper subagent event handling."""

from pathlib import Path

from claude_office_hooks.event_mapper import map_event

SESSION_ID = "test-session-001"
TRANSCRIPT = "/home/user/.claude/projects/myproject/session.jsonl"


def _pre_tool_use_agent(tool_use_id: str = "tu_123") -> dict:
    return {
        "tool_name": "Agent",
        "tool_use_id": tool_use_id,
        "tool_input": {"prompt": "do something", "description": "Test Agent"},
        "session_id": SESSION_ID,
        "transcript_path": TRANSCRIPT,
    }


def _pre_tool_use_task(tool_use_id: str = "tu_456") -> dict:
    return {
        "tool_name": "Task",
        "tool_use_id": tool_use_id,
        "tool_input": {"prompt": "do something", "description": "Test Task"},
        "session_id": SESSION_ID,
        "transcript_path": TRANSCRIPT,
    }


def _post_tool_use_agent(
    tool_use_id: str = "tu_123",
    agent_id: str | None = "a5a60c7",
    run_in_background: bool = False,
) -> dict:
    tool_input: dict = {"prompt": "do something"}
    if run_in_background:
        tool_input["run_in_background"] = True
    resp = {}
    if agent_id is not None:
        resp["agentId"] = agent_id
    return {
        "tool_name": "Agent",
        "tool_use_id": tool_use_id,
        "tool_input": tool_input,
        "tool_response": resp,
        "session_id": SESSION_ID,
        "transcript_path": TRANSCRIPT,
    }


def _post_tool_use_task(tool_use_id: str = "tu_456") -> dict:
    return {
        "tool_name": "Task",
        "tool_use_id": tool_use_id,
        "tool_input": {"prompt": "do something"},
        "tool_response": {"content": "done"},
        "session_id": SESSION_ID,
        "transcript_path": TRANSCRIPT,
    }


class TestPreToolUseSubagentStart:
    """PreToolUse for Agent/Task tools should remap to subagent_start."""

    def test_agent_tool_creates_subagent_start(self) -> None:
        result = map_event("pre_tool_use", _pre_tool_use_agent(), SESSION_ID)
        assert result is not None
        assert result["event_type"] == "subagent_start"
        assert result["data"]["agent_id"] == "subagent_tu_123"

    def test_task_tool_creates_subagent_start(self) -> None:
        result = map_event("pre_tool_use", _pre_tool_use_task(), SESSION_ID)
        assert result is not None
        assert result["event_type"] == "subagent_start"
        assert result["data"]["agent_id"] == "subagent_tu_456"

    def test_extracts_description_and_prompt(self) -> None:
        result = map_event("pre_tool_use", _pre_tool_use_agent(), SESSION_ID)
        assert result is not None
        assert result["data"]["agent_name"] == "Test Agent"
        assert result["data"]["task_description"] == "do something"


class TestPostToolUseAgentAsync:
    """PostToolUse for Agent tool with agentId in response (async, v2.1+)."""

    def test_agent_with_agent_id_does_not_send_subagent_stop(self) -> None:
        """Agent tool with agentId in response means agent is still running async."""
        result = map_event("post_tool_use", _post_tool_use_agent(), SESSION_ID)
        assert result is not None
        assert result["event_type"] == "post_tool_use"
        assert result["data"]["agent_id"] == "main"

    def test_agent_with_agent_id_preserves_native_id(self) -> None:
        result = map_event("post_tool_use", _post_tool_use_agent(), SESSION_ID)
        assert result is not None
        assert result["data"]["native_agent_id"] == "a5a60c7"

    def test_agent_with_agent_id_preserves_transcript_path(self) -> None:
        result = map_event("post_tool_use", _post_tool_use_agent(), SESSION_ID)
        assert result is not None
        assert result["data"]["agent_transcript_path"] is not None
        assert "subagents/agent-a5a60c7" in result["data"]["agent_transcript_path"]

    def test_agent_without_agent_id_sends_subagent_stop(self) -> None:
        """Agent tool without agentId in response means sync completion (legacy)."""
        result = map_event("post_tool_use", _post_tool_use_agent(agent_id=None), SESSION_ID)
        assert result is not None
        assert result["event_type"] == "subagent_stop"
        assert result["data"]["agent_id"] == "subagent_tu_123"


class TestPostToolUseTaskSync:
    """PostToolUse for Task tool (always sync, no agentId)."""

    def test_task_sends_subagent_stop(self) -> None:
        result = map_event("post_tool_use", _post_tool_use_task(), SESSION_ID)
        assert result is not None
        assert result["event_type"] == "subagent_stop"
        assert result["data"]["agent_id"] == "subagent_tu_456"


class TestPostToolUseBackground:
    """PostToolUse with run_in_background should not send subagent_stop."""

    def test_background_agent_sends_main_id(self) -> None:
        result = map_event(
            "post_tool_use",
            _post_tool_use_agent(run_in_background=True),
            SESSION_ID,
        )
        assert result is not None
        assert result["event_type"] == "post_tool_use"
        assert result["data"]["agent_id"] == "main"


class TestNativeSubagentStart:
    """Native SubagentStart hook should remap to subagent_info."""

    def test_native_subagent_start_maps_to_info(self) -> None:
        raw = {
            "agent_id": "a5a60c7",
            "agent_type": "general-purpose",
            "session_id": SESSION_ID,
            "transcript_path": TRANSCRIPT,
        }
        result = map_event("subagent_start", raw, SESSION_ID)
        assert result is not None
        assert result["event_type"] == "subagent_info"
        assert result["data"]["native_agent_id"] == "a5a60c7"

    def test_native_subagent_start_without_agent_id_returns_none(self) -> None:
        raw = {
            "session_id": SESSION_ID,
            "transcript_path": TRANSCRIPT,
        }
        result = map_event("subagent_start", raw, SESSION_ID)
        assert result is None


class TestNativeSubagentStop:
    """Native SubagentStop hook should pass through with native_agent_id."""

    def test_native_subagent_stop_includes_native_id(self, tmp_path: Path) -> None:
        transcript = tmp_path / "session.jsonl"
        agent_file = tmp_path / "session" / "subagents" / "agent-a5a60c7.jsonl"
        agent_file.parent.mkdir(parents=True)
        agent_file.write_text("{}\n")
        raw = {
            "agent_id": "a5a60c7",
            "session_id": SESSION_ID,
            "transcript_path": str(transcript),
        }
        result = map_event("subagent_stop", raw, SESSION_ID)
        assert result is not None
        assert result["event_type"] == "subagent_stop"
        assert result["data"]["native_agent_id"] == "a5a60c7"

    def test_stop_without_agent_transcript_is_still_sent(self, tmp_path: Path) -> None:
        """The backend drops hidden side-agent stops (is_phantom_stop); the hook
        forwards every stop so a real one is never lost to a path layout change."""
        missing = tmp_path / "missing" / "agent-ab99.jsonl"
        raw = {
            "agent_id": "ab99ecb9afdc4eb66",
            "session_id": SESSION_ID,
            "transcript_path": str(tmp_path / "session.jsonl"),
            "agent_transcript_path": str(missing),
        }
        result = map_event("subagent_stop", raw, SESSION_ID)
        assert result is not None
        assert result["data"]["native_agent_id"] == "ab99ecb9afdc4eb66"
        assert result["data"]["agent_transcript_path"] == str(missing)

    def test_native_subagent_stop_without_agent_id_returns_none(self) -> None:
        raw = {
            "session_id": SESSION_ID,
            "transcript_path": TRANSCRIPT,
        }
        result = map_event("subagent_stop", raw, SESSION_ID)
        assert result is None


class TestProgressTools:
    """TodoWrite / TaskCreate / TaskUpdate carry what per-agent progress needs."""

    def _raw(self, tool_name: str, **extra: object) -> dict:
        raw: dict = {
            "tool_name": tool_name,
            "tool_use_id": "tu_task",
            "tool_input": {"subject": "Write tests"},
            "session_id": SESSION_ID,
            "transcript_path": TRANSCRIPT,
        }
        raw.update(extra)
        return raw

    def test_task_create_response_keeps_only_task_id(self) -> None:
        raw = self._raw("TaskCreate", tool_response={"task": {"id": "7", "subject": "x"}})
        result = map_event("post_tool_use", raw, SESSION_ID)
        assert result is not None
        assert result["data"]["created_task_id"] == "7"
        assert "tool_response" not in result["data"]

    def test_task_create_text_response_yields_task_id(self) -> None:
        raw = self._raw("TaskCreate", tool_response="Task #12 created successfully: Write tests")
        result = map_event("post_tool_use", raw, SESSION_ID)
        assert result is not None
        assert result["data"]["created_task_id"] == "12"

    def test_task_create_without_id_has_no_created_task_id(self) -> None:
        raw = self._raw("TaskCreate", tool_response={"ok": True})
        result = map_event("post_tool_use", raw, SESSION_ID)
        assert result is not None
        assert "created_task_id" not in result["data"]

    def test_subagent_todo_write_keeps_native_agent_id(self) -> None:
        raw = self._raw("TodoWrite", agent_id="a5a60c7")
        result = map_event("pre_tool_use", raw, SESSION_ID)
        assert result is not None
        assert result["data"]["agent_id"] == "main"
        assert result["data"]["native_agent_id"] == "a5a60c7"

    def test_boss_todo_write_has_no_native_agent_id(self) -> None:
        result = map_event("pre_tool_use", self._raw("TodoWrite"), SESSION_ID)
        assert result is not None
        assert "native_agent_id" not in result["data"]


class TestTmuxPane:
    """The tmux pane Claude runs in lets the office send prompts back to it."""

    def _raw(self) -> dict:
        return {"session_id": SESSION_ID, "transcript_path": TRANSCRIPT, "prompt": "hi"}

    def test_pane_from_env_is_sent(self, monkeypatch) -> None:
        monkeypatch.setenv("TMUX_PANE", "%7")
        result = map_event("user_prompt_submit", self._raw(), SESSION_ID)
        assert result is not None
        assert result["data"]["tmux_pane"] == "%7"

    def test_no_pane_outside_tmux(self, monkeypatch) -> None:
        monkeypatch.delenv("TMUX_PANE", raising=False)
        result = map_event("session_start", self._raw(), SESSION_ID)
        assert result is not None
        assert "tmux_pane" not in result["data"]

    def test_socket_from_tmux_env_is_sent(self, monkeypatch) -> None:
        monkeypatch.setenv("TMUX_PANE", "%7")
        monkeypatch.setenv("TMUX", "/tmp/tmux-1000/default,212036,0")
        result = map_event("stop", self._raw(), SESSION_ID)
        assert result is not None
        assert result["data"]["tmux_socket"] == "/tmp/tmux-1000/default"

    def test_no_socket_without_tmux_env(self, monkeypatch) -> None:
        monkeypatch.setenv("TMUX_PANE", "%7")
        monkeypatch.delenv("TMUX", raising=False)
        result = map_event("stop", self._raw(), SESSION_ID)
        assert result is not None
        assert "tmux_socket" not in result["data"]

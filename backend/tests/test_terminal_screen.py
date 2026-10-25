"""screen_block_reason over real Claude Code screens (tests/fixtures/claude_screens)."""

from pathlib import Path

import pytest

from app.core.terminal_screen import screen_block_reason

FIXTURES = Path(__file__).parent / "fixtures" / "claude_screens"


def _screen(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


class TestReadyPrompt:
    @pytest.mark.parametrize(
        "name",
        [
            "idle_placeholder.ansi",  # dim 'Try "edit ..."' placeholder
            "idle_after_commands.ansi",  # earlier '❯ /model' lines in the history
            "idle_after_reply.ansi",
            "working_spinner.ansi",  # Claude working, the input box is empty
        ],
    )
    def test_empty_prompt_is_ready(self, name: str) -> None:
        assert screen_block_reason(_screen(name)) is None


class TestBusyScreens:
    def test_typed_draft(self) -> None:
        assert screen_block_reason(_screen("draft.ansi")) == "draft"

    def test_slash_menu_open(self) -> None:
        assert screen_block_reason(_screen("slash_menu.ansi")) == "draft"

    def test_shell_mode(self) -> None:
        assert screen_block_reason(_screen("bash_mode.ansi")) == "shell_mode"

    @pytest.mark.parametrize(
        "name",
        ["model_picker.ansi", "resume_picker.ansi", "trust_folder.txt", "synthetic_permission.txt"],
    )
    def test_picker_or_dialog_without_prompt(self, name: str) -> None:
        assert screen_block_reason(_screen(name)) in ("no_prompt", "dialog")

    def test_dialog_panel_above_empty_prompt(self) -> None:
        # "Teach auto mode about your environment? ❯ 1. Yes ..." sits above an
        # empty input box: a digit or Enter would answer the dialog.
        assert screen_block_reason(_screen("dialog_above_prompt.ansi")) == "dialog"

    def test_rating_survey_above_prompt(self) -> None:
        assert screen_block_reason(_screen("synthetic_survey.txt")) == "dialog"

    def test_empty_screen(self) -> None:
        assert screen_block_reason("") == "no_prompt"

    def test_plain_shell(self) -> None:
        assert screen_block_reason("$ ls\nfile.txt\n$ \n") == "no_prompt"


_RULE = "─" * 80


def _box(input_line: str, above: list[str] | None = None, footer: str = "  ⏵⏵ auto mode on") -> str:
    return "\n".join([*(above or ["● Done."]), "", _RULE, input_line, _RULE, footer, ""])


class TestMarkers:
    @pytest.mark.parametrize(
        "line",
        [
            " Do you want to make this edit?",
            "  Enter to confirm · Esc to cancel",
            "  ❯ 1. Allow",
            "  1: Bad    2: Fine   3: Good   0: Dismiss",
        ],
    )
    def test_dialog_markers_just_above_prompt(self, line: str) -> None:
        assert screen_block_reason(_box("❯ ", above=["● Done.", line])) == "dialog"

    def test_numbered_list_in_a_reply_is_not_a_dialog(self) -> None:
        reply = ["● Steps:", "  1. Build", "  2. Test", "  3. Ship"]
        assert screen_block_reason(_box("❯ ", above=reply)) is None

    def test_shell_mode_footer(self) -> None:
        assert screen_block_reason(_box("❯ ", footer="  ! for shell mode")) == "shell_mode"

    def test_multi_line_input_is_a_draft(self) -> None:
        screen = "\n".join(["● Done.", "", _RULE, "❯ first line", "  second", _RULE, ""])
        assert screen_block_reason(screen) == "draft"


class TestAfterPaste:
    def test_pasted_text_in_prompt_is_ready_for_enter(self) -> None:
        assert screen_block_reason(_box("❯ fix the bug"), after_paste=True) is None

    def test_empty_prompt_after_paste_means_it_went_elsewhere(self) -> None:
        assert screen_block_reason(_box("❯ "), after_paste=True) == "no_input"

    def test_dialog_after_paste(self) -> None:
        screen = _box("❯ fix", above=["● Done.", "  Enter to confirm · Esc to cancel"])
        assert screen_block_reason(screen, after_paste=True) == "dialog"

    def test_real_draft_screen_after_paste(self) -> None:
        assert screen_block_reason(_screen("draft.ansi"), after_paste=True) is None

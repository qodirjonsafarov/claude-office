"""Read a Claude Code screen (``tmux capture-pane -p -e``) before typing into it.

A web prompt is pasted only into an empty, normal input box. Pickers,
permission prompts, surveys and other dialogs often fire no hook, and a
digit or Enter would answer them; a typed draft, shell mode (``!``) or an
open slash menu would get our text appended. This module is pure: it only
looks at the captured text.

The input box is the last pair of full-width ``─`` rules near the bottom
with the ``❯`` line between them. Claude Code draws the placeholder
('Try "edit ..."') dim, so dim text in the box counts as empty.
"""

import re
from typing import Literal

ScreenBlock = Literal["no_prompt", "draft", "shell_mode", "dialog", "no_input"]

_ANSI = re.compile(
    r"\x1b\[(?P<csi>[0-9;?]*)(?P<final>[ -/]*[@-~])"  # CSI (SGR when final == "m")
    r"|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)"  # OSC (hyperlinks)
    r"|\x1b[@-Z\\-_]"  # other two-byte escapes
)
_RULE_MIN = 10
# How far the bottom rule may sit from the last line (the footer below it).
_MAX_FOOTER_LINES = 3
# Lines above the input box searched for a dialog.
_ABOVE_WINDOW = 12

_DIALOG_MARKERS = (
    re.compile(r"Do you want"),
    re.compile(r"Enter to confirm"),
    re.compile(r"Esc to cancel"),
    re.compile(r"Tab to amend"),
    re.compile(r"❯\s*\d+[.)]"),  # highlighted numbered option
    re.compile(r"(?:\b\d: \S+.*){2,}"),  # inline options: "1: Bad  2: Fine  3: Good"
)
_SHELL_FOOTER = re.compile(r"! for (?:shell|bash) mode")


def _visible(line: str, *, drop_dim: bool) -> str:
    """Text of *line* without escapes; with *drop_dim*, without dim text too."""
    out: list[str] = []
    dim = False
    pos = 0
    for m in _ANSI.finditer(line):
        if not (drop_dim and dim):
            out.append(line[pos : m.start()])
        pos = m.end()
        if m.group("final") == "m":
            for param in (m.group("csi") or "0").split(";"):
                if param in ("", "0", "22"):
                    dim = False
                elif param == "2":
                    dim = True
    if not (drop_dim and dim):
        out.append(line[pos:])
    return "".join(out).replace("\xa0", " ").rstrip()


def _is_rule(text: str) -> bool:
    stripped = text.strip()
    return len(stripped) >= _RULE_MIN and set(stripped) == {"─"}


def _has_marker(lines: list[str]) -> bool:
    return any(p.search(line) for line in lines for p in _DIALOG_MARKERS)


def screen_block_reason(screen: str, *, after_paste: bool = False) -> ScreenBlock | None:
    """None when typing is safe, else why not.

    Before the paste the box must be empty. With *after_paste* the box must
    hold text (our paste) and still no dialog may be on screen, so Enter
    submits the prompt and answers nothing else.
    """
    raw = screen.split("\n")
    plain = [_visible(line, drop_dim=False) for line in raw]
    nonblank = [i for i, text in enumerate(plain) if text.strip()]
    tail = [plain[i] for i in nonblank[-(_ABOVE_WINDOW + 4) :]]

    rules = [i for i in nonblank if _is_rule(plain[i])]
    bottom = rules[-1] if rules else None
    if bottom is None or sum(1 for i in nonblank if i > bottom) > _MAX_FOOTER_LINES:
        return "dialog" if _has_marker(tail) else "no_prompt"
    top = rules[-2] if len(rules) >= 2 else None
    if top is None:
        return "dialog" if _has_marker(tail) else "no_prompt"

    box = [i for i in range(top + 1, bottom) if plain[i].strip()]
    footer = [plain[i] for i in nonblank if i > bottom]
    if not box:
        return "no_prompt"
    first = plain[box[0]].lstrip()
    if first.startswith("!") or any(_SHELL_FOOTER.search(line) for line in footer):
        return "shell_mode"
    if not first.startswith("❯"):
        return "no_prompt"

    above_idx = [i for i in nonblank if i < top][-_ABOVE_WINDOW:]
    above = [plain[i] for i in above_idx]
    # A rule close above the box frames a panel (dialog) drawn over the prompt.
    if any(_is_rule(text) for text in above) or _has_marker(above + footer):
        return "dialog"

    typed = _visible(raw[box[0]], drop_dim=True).lstrip()[1:].strip()
    typed += "".join(_visible(raw[i], drop_dim=True).strip() for i in box[1:])
    if after_paste:
        return None if typed else "no_input"
    return "draft" if typed else None

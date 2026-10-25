"""XML-like envelopes Claude Code puts in "user" turns, as a few words.

``<agent-message from="…">`` (a background agent reporting back),
``<task-notification>`` and similar are not the owner typing, so the event
log, the boss's task and his bubble show "Message from Validator V" or
"Task notification" instead of raw tags.
"""

import re
from collections.abc import Callable

_ENVELOPE = re.compile(r"^<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b", re.IGNORECASE)
_FROM = re.compile(r'from="([^"]+)"')

NameForNativeId = Callable[[str], str | None]


def describe_envelope(prompt: str, name_for: NameForNativeId | None = None) -> str | None:
    """A short description of an envelope prompt, or ``None`` for plain text."""
    text = prompt.lstrip()
    match = _ENVELOPE.match(text)
    if not match:
        return None
    tag = match.group(1).lower()
    if tag == "agent-message":
        sender = _FROM.search(text)
        name = name_for(sender.group(1)) if sender and name_for else None
        return f"Message from {name or 'an agent'}"
    words = tag.replace("-", " ")
    return words[:1].upper() + words[1:]

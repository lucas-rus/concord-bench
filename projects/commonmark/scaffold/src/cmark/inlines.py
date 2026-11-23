"""Inline parsing (CommonMark spec, part 6).

`InlineParser.parse` turns the string content of a paragraph or heading into
inline child nodes. Parsing scans the subject from left to right: at each
position, the handler registered for the current character in `handlers`
(if any) gets the first chance to parse something; if there is no handler or
it returns False, a run of ordinary text is consumed.

Extending the parser usually means registering a handler for a character
(for example "`" for code spans) and, for constructs that need to look at the
whole paragraph (emphasis, links), post-processing at the end of `parse`.
"""

from __future__ import annotations

import re
from collections.abc import Callable

from cmark.nodes import Node

#: Characters that may start an inline construct; text runs stop before them.
SPECIAL_CHARS = "\n`[]\\!<&*_"
RE_TEXT = re.compile(r"[^" + re.escape(SPECIAL_CHARS) + r"]+")
RE_INITIAL_SPACE = re.compile(r"^ *")
RE_FINAL_SPACE = re.compile(r" *$")

Handler = Callable[["InlineParser", Node], bool]


def text(s: str) -> Node:
    node = Node("text")
    node.literal = s
    return node


class InlineParser:
    def __init__(self, refmap: dict[str, tuple[str, str]] | None = None) -> None:
        #: Link reference definitions collected during block parsing.
        self.refmap = refmap if refmap is not None else {}
        self.subject = ""
        self.pos = 0
        #: Inline handlers by first character.
        self.handlers: dict[str, Handler] = {"\n": InlineParser.parse_newline}

    # -- scanning helpers --------------------------------------------------

    def peek(self) -> str:
        return self.subject[self.pos] if self.pos < len(self.subject) else ""

    def match(self, regex: re.Pattern[str]) -> str | None:
        """If `regex` matches at the current position, consume and return the match."""
        m = regex.match(self.subject, self.pos)
        if m is None:
            return None
        self.pos = m.end()
        return m.group(0)

    # -- handlers ------------------------------------------------------------

    def parse_newline(self, block: Node) -> bool:
        """A line ending: a soft line break (trailing spaces are removed)."""
        self.pos += 1
        last = block.last_child
        if last is not None and last.type == "text" and last.literal and last.literal.endswith(" "):
            last.literal = RE_FINAL_SPACE.sub("", last.literal)
        block.append_child(Node("softbreak"))
        self.match(RE_INITIAL_SPACE)  # leading spaces of the next line are ignored
        return True

    def parse_text(self, block: Node) -> bool:
        m = self.match(RE_TEXT)
        if m is None:
            # A special character nobody handled: it is literal text.
            m = self.subject[self.pos]
            self.pos += 1
        block.append_child(text(m))
        return True

    # -- driver ----------------------------------------------------------------

    def parse_inline(self, block: Node) -> bool:
        c = self.peek()
        if not c:
            return False
        handler = self.handlers.get(c)
        if handler is not None and handler(self, block):
            return True
        return self.parse_text(block)

    def parse(self, block: Node) -> None:
        """Parse `block.string_content` into inline children of `block`."""
        self.subject = block.string_content.strip()
        self.pos = 0
        while self.parse_inline(block):
            pass
        block.string_content = ""

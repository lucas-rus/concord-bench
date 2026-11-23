"""Block structure parsing (CommonMark spec, part 4-5).

The parser follows the two-phase strategy of the CommonMark reference
implementation: lines are incorporated one by one into a tree of open blocks
(phase 1), then the inline content of paragraphs and headings is parsed
(phase 2, see `inlines.py`).

For every line, the parser
  1. walks down the open blocks and asks each one whether the line continues
     it (`BlockType.continue_`);
  2. tries the block starts (`BLOCK_STARTS`) to open new blocks;
  3. adds the rest of the line as text to the deepest open block that accepts
     lines, or starts a paragraph (lazy paragraph continuation included).

Extending the parser means adding a `BlockType` to `BLOCK_TYPES` and,
usually, a start function to `BLOCK_STARTS`.
"""

from __future__ import annotations

import re
from collections.abc import Callable

from cmark.nodes import Node

CODE_INDENT = 4
TAB_STOP = 4
RE_LINE_ENDING = re.compile(r"\r\n|\n|\r")


class BlockType:
    """Behaviour of one kind of block."""

    #: Whether the text of a line is added to this block (leaf blocks).
    accepts_lines = False

    @staticmethod
    def continue_(parser: BlockParser, block: Node) -> int:
        """Does the current line continue `block`?

        Return 0 if it does (the parser may have consumed the block's line
        prefix, e.g. a block quote marker), 1 if it does not (the block will be
        closed), 2 if the line was fully handled (e.g. a closing code fence).
        """
        return 1

    @staticmethod
    def finalize(parser: BlockParser, block: Node) -> None:
        """Called when `block` is closed."""

    @staticmethod
    def can_contain(child_type: str) -> bool:
        return False


class Document(BlockType):
    @staticmethod
    def continue_(parser: BlockParser, block: Node) -> int:
        return 0

    @staticmethod
    def can_contain(child_type: str) -> bool:
        return child_type != "item"


class Paragraph(BlockType):
    accepts_lines = True

    @staticmethod
    def continue_(parser: BlockParser, block: Node) -> int:
        return 1 if parser.blank else 0

    @staticmethod
    def finalize(parser: BlockParser, block: Node) -> None:
        if not block.string_content.strip():
            block.unlink()


#: Block types by node type.
BLOCK_TYPES: dict[str, type[BlockType]] = {
    "document": Document,
    "paragraph": Paragraph,
}

#: A block start tries to open a new block at the current position. It returns
#: 0 if it does not match, 1 if it opened a container block (parsing continues
#: inside it), 2 if it opened a leaf block (the rest of the line is its text).
BlockStart = Callable[["BlockParser", Node], int]

#: Block starts, tried in order (the order encodes the spec's precedence).
BLOCK_STARTS: list[BlockStart] = []


class BlockParser:
    def __init__(self) -> None:
        self.doc = Node("document", [[1, 1], [0, 0]])
        self.tip = self.doc
        self.oldtip = self.doc
        self.current_line = ""
        self.line_number = 0
        self.offset = 0
        self.column = 0
        self.next_nonspace = 0
        self.next_nonspace_column = 0
        self.indent = 0
        self.indented = False
        self.blank = False
        self.partially_consumed_tab = False
        self.all_closed = True
        self.last_matched_container = self.doc
        self.last_line_length = 0
        #: Link reference definitions: normalized label -> (destination, title).
        self.refmap: dict[str, tuple[str, str]] = {}

    # -- position helpers ------------------------------------------------

    def find_next_nonspace(self) -> None:
        """Find the next non-space character from `offset`; set `blank`,
        `indent` (in columns, tabs expanded to the next tab stop) and
        `indented` (indent >= 4)."""
        line = self.current_line
        i = self.offset
        cols = self.column
        c = ""
        while i < len(line):
            c = line[i]
            if c == " ":
                i += 1
                cols += 1
            elif c == "\t":
                i += 1
                cols += TAB_STOP - (cols % TAB_STOP)
            else:
                break
        else:
            c = ""
        self.blank = c in ("", "\n", "\r")
        self.next_nonspace = i
        self.next_nonspace_column = cols
        self.indent = self.next_nonspace_column - self.column
        self.indented = self.indent >= CODE_INDENT

    def advance_next_nonspace(self) -> None:
        self.offset = self.next_nonspace
        self.column = self.next_nonspace_column
        self.partially_consumed_tab = False

    def advance_offset(self, count: int, columns: bool = False) -> None:
        """Advance by `count` characters, or by `count` columns if `columns`
        (a tab may then be partially consumed)."""
        line = self.current_line
        while count > 0 and self.offset < len(line):
            c = line[self.offset]
            if c == "\t":
                chars_to_tab = TAB_STOP - (self.column % TAB_STOP)
                if columns:
                    self.partially_consumed_tab = chars_to_tab > count
                    chars_to_advance = min(chars_to_tab, count)
                    self.column += chars_to_advance
                    self.offset += 0 if self.partially_consumed_tab else 1
                    count -= chars_to_advance
                else:
                    self.partially_consumed_tab = False
                    self.column += chars_to_tab
                    self.offset += 1
                    count -= 1
            else:
                self.partially_consumed_tab = False
                self.offset += 1
                self.column += 1
                count -= 1

    # -- tree helpers ------------------------------------------------------

    def add_line(self) -> None:
        """Add the rest of the current line to the tip's string content."""
        if self.partially_consumed_tab:
            self.offset += 1  # skip over the tab
            chars_to_tab = TAB_STOP - (self.column % TAB_STOP)
            self.tip.string_content += " " * chars_to_tab
        self.tip.string_content += self.current_line[self.offset :] + "\n"

    def add_child(self, node_type: str, offset: int) -> Node:
        """Add a new block as a child of the tip, closing blocks that cannot
        contain it."""
        while not BLOCK_TYPES[self.tip.type].can_contain(node_type):
            self.finalize(self.tip, self.line_number - 1)
        block = Node(node_type, [[self.line_number, offset + 1], [0, 0]])
        self.tip.append_child(block)
        self.tip = block
        return block

    def close_unmatched_blocks(self) -> None:
        if not self.all_closed:
            while self.oldtip is not self.last_matched_container:
                parent = self.oldtip.parent
                self.finalize(self.oldtip, self.line_number - 1)
                assert parent is not None
                self.oldtip = parent
            self.all_closed = True

    def finalize(self, block: Node, line_number: int) -> None:
        above = block.parent
        block.open = False
        if block.sourcepos:
            block.sourcepos[1] = [line_number, self.last_line_length]
        BLOCK_TYPES[block.type].finalize(self, block)
        self.tip = above  # type: ignore[assignment]

    # -- the line algorithm ---------------------------------------------------

    def incorporate_line(self, line: str) -> None:
        all_matched = True
        container = self.doc
        self.oldtip = self.tip
        self.offset = 0
        self.column = 0
        self.blank = False
        self.partially_consumed_tab = False
        self.line_number += 1
        if "\0" in line:
            line = line.replace("\0", "�")
        self.current_line = line

        # 1. Which open blocks does this line continue?
        while container.last_child is not None and container.last_child.open:
            container = container.last_child
            self.find_next_nonspace()
            result = BLOCK_TYPES[container.type].continue_(self, container)
            if result == 0:
                continue
            if result == 1:
                all_matched = False
                container = container.parent  # type: ignore[assignment]
                break
            if result == 2:
                return
            raise ValueError(f"continue_ returned {result}")

        self.all_closed = container is self.oldtip
        self.last_matched_container = container

        # 2. Try block starts, unless we are in a leaf block that takes lines.
        matched_leaf = container.type != "paragraph" and BLOCK_TYPES[container.type].accepts_lines
        while not matched_leaf:
            self.find_next_nonspace()
            for start in BLOCK_STARTS:
                result = start(self, container)
                if result == 1:
                    container = self.tip
                    break
                if result == 2:
                    container = self.tip
                    matched_leaf = True
                    break
            else:
                self.advance_next_nonspace()
                break

        # 3. Add the text to the right block.
        if not self.all_closed and not self.blank and self.tip.type == "paragraph":
            # Lazy paragraph continuation.
            self.add_line()
        else:
            self.close_unmatched_blocks()
            if BLOCK_TYPES[container.type].accepts_lines:
                self.add_line()
            elif self.offset < len(line) and not self.blank:
                self.add_child("paragraph", self.offset)
                self.advance_next_nonspace()
                self.add_line()
        self.last_line_length = len(line)

    def parse(self, text: str) -> Node:
        lines = RE_LINE_ENDING.split(text)
        if text.endswith(("\n", "\r")):
            lines.pop()  # the final line ending does not start a new line
        for line in lines:
            self.incorporate_line(line)
        while self.tip is not None:
            self.finalize(self.tip, len(lines))
        return self.doc

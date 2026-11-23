"""HTML rendering of the document tree."""

from __future__ import annotations

from cmark.nodes import Node

ESCAPES = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}


def escape_html(s: str) -> str:
    return "".join(ESCAPES.get(c, c) for c in s)


class HtmlRenderer:
    """Renders a document tree to HTML.

    Each node type has a method named after it, called with (node, entering);
    leaf nodes are called once with entering=True.
    """

    def __init__(self) -> None:
        self.buffer: list[str] = []

    # -- output helpers ----------------------------------------------------

    def out(self, s: str) -> None:
        self.buffer.append(s)

    def cr(self) -> None:
        """Ensure that the output ends with a newline (between blocks)."""
        if self.buffer and not self.buffer[-1].endswith("\n"):
            self.buffer.append("\n")

    # -- node types --------------------------------------------------------

    def document(self, node: Node, entering: bool) -> None:
        pass

    def paragraph(self, node: Node, entering: bool) -> None:
        if entering:
            self.cr()
            self.out("<p>")
        else:
            self.out("</p>")
            self.cr()

    def text(self, node: Node, entering: bool) -> None:
        self.out(escape_html(node.literal or ""))

    def softbreak(self, node: Node, entering: bool) -> None:
        self.out("\n")

    # -- driver ----------------------------------------------------------------

    def render(self, root: Node) -> str:
        self.buffer = []
        for node, entering in root.walk():
            method = getattr(self, node.type, None)
            if method is None:
                raise NotImplementedError(f"no renderer for node type {node.type!r}")
            method(node, entering)
        return "".join(self.buffer)

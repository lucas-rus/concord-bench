"""cmark: a CommonMark (0.31.2) Markdown to HTML converter.

    >>> from cmark import markdown
    >>> markdown("Hello world")
    '<p>Hello world</p>\\n'

Pipeline: `blocks.BlockParser` builds the block tree, `inlines.InlineParser`
parses the inline content of paragraphs and headings, and
`render.HtmlRenderer` renders the tree to HTML.
"""

from __future__ import annotations

from cmark.blocks import BlockParser
from cmark.inlines import InlineParser
from cmark.nodes import Node
from cmark.render import HtmlRenderer

__all__ = ["markdown", "parse", "render_html", "Node"]

#: Block types whose string content is parsed as inlines.
INLINE_CONTAINERS = {"paragraph", "heading"}


def parse(text: str) -> Node:
    """Parse Markdown into a document tree."""
    blocks = BlockParser()
    doc = blocks.parse(text)
    inlines = InlineParser(blocks.refmap)
    for node, entering in doc.walk():
        if not entering and node.type in INLINE_CONTAINERS:
            inlines.parse(node)
    return doc


def render_html(doc: Node) -> str:
    return HtmlRenderer().render(doc)


def markdown(text: str) -> str:
    """Convert CommonMark to HTML."""
    return render_html(parse(text))

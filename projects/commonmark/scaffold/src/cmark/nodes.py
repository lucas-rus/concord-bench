"""AST nodes of a Markdown document."""

from __future__ import annotations

from collections.abc import Iterator


class Node:
    """A node of the document tree.

    `type` is a string such as "document", "paragraph" or "text". Block nodes
    collect their raw lines in `string_content` while parsing; leaf inline
    nodes keep their text in `literal`. Other attributes (heading level, code
    info string, link destination, ...) are set as plain attributes by the
    parsers that create the node.
    """

    def __init__(self, type: str, sourcepos: list[list[int]] | None = None):
        self.type = type
        self.parent: Node | None = None
        self.children: list[Node] = []
        self.sourcepos = sourcepos
        self.open = True
        self.string_content = ""
        self.literal: str | None = None

    # -- tree operations -------------------------------------------------

    @property
    def first_child(self) -> Node | None:
        return self.children[0] if self.children else None

    @property
    def last_child(self) -> Node | None:
        return self.children[-1] if self.children else None

    @property
    def next(self) -> Node | None:
        if self.parent is None:
            return None
        siblings = self.parent.children
        i = siblings.index(self)
        return siblings[i + 1] if i + 1 < len(siblings) else None

    @property
    def prev(self) -> Node | None:
        if self.parent is None:
            return None
        siblings = self.parent.children
        i = siblings.index(self)
        return siblings[i - 1] if i > 0 else None

    def append_child(self, child: Node) -> None:
        child.unlink()
        child.parent = self
        self.children.append(child)

    def prepend_child(self, child: Node) -> None:
        child.unlink()
        child.parent = self
        self.children.insert(0, child)

    def insert_after(self, sibling: Node) -> None:
        sibling.unlink()
        assert self.parent is not None
        sibling.parent = self.parent
        siblings = self.parent.children
        siblings.insert(siblings.index(self) + 1, sibling)

    def insert_before(self, sibling: Node) -> None:
        sibling.unlink()
        assert self.parent is not None
        sibling.parent = self.parent
        siblings = self.parent.children
        siblings.insert(siblings.index(self), sibling)

    def unlink(self) -> None:
        if self.parent is not None:
            self.parent.children.remove(self)
            self.parent = None

    def walk(self) -> Iterator[tuple[Node, bool]]:
        """Depth-first traversal yielding (node, entering) events.

        Container nodes are yielded twice (entering=True, then False); leaf
        nodes once with entering=True. The tree may be modified for nodes that
        have already been left.
        """
        yield self, True
        if self.children or self.type in CONTAINERS:
            for child in list(self.children):
                yield from child.walk()
            yield self, False

    def __repr__(self) -> str:
        return f"Node({self.type!r}, children={len(self.children)})"


# Node types that can have children (and are left with entering=False in walk()).
CONTAINERS = {
    "document",
    "block_quote",
    "list",
    "item",
    "paragraph",
    "heading",
    "emph",
    "strong",
    "link",
    "image",
}

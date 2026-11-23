# cmark

A [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) Markdown to HTML converter in pure Python.

```python
from cmark import markdown
markdown("Hello world")  # '<p>Hello world</p>\n'
```

## Design

Parsing has two phases, as in the CommonMark reference implementations:

1. **Blocks** (`src/cmark/blocks.py`): lines are incorporated one by one into a tree of open blocks. Each block type is a `BlockType` in `BLOCK_TYPES` (how a line continues it, what it may contain, what happens when it is closed); new blocks are opened by the functions in `BLOCK_STARTS`, tried in order. Column-aware helpers (`find_next_nonspace`, `advance_offset`) handle tabs (tab stops of 4).
2. **Inlines** (`src/cmark/inlines.py`): the text of paragraphs and headings is scanned left to right; characters in `SPECIAL_CHARS` are dispatched to handlers registered in `InlineParser.handlers`.

`src/cmark/render.py` renders the tree to HTML (one method per node type); `src/cmark/nodes.py` defines the tree.

## Status

Only paragraphs and soft line breaks are implemented so far.

## Tests

`tests/spec.json` holds the spec examples (CommonMark spec, CC BY-SA 4.0).

```bash
pytest -q tests/test_spec.py -k ATX_headings   # one section
pytest -q tests                                 # everything
```

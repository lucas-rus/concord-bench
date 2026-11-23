"""CommonMark 0.31.2 spec examples.

Run one section:   pytest -q tests/test_spec.py -k ATX_headings
Run everything:    pytest -q tests
Test ids look like `ATX_headings-62` (section with spaces replaced by `_`, example number).
"""

import json
from pathlib import Path

import pytest

from cmark import markdown

SPEC = json.loads((Path(__file__).parent / "spec.json").read_text())


def _id(e):
    return f"{e['section'].replace(' ', '_')}-{e['example']}"


@pytest.mark.parametrize("example", SPEC, ids=_id)
def test_spec(example):
    assert markdown(example["markdown"]) == example["html"]

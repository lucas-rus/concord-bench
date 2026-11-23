from cmark import markdown, parse


def test_paragraphs():
    assert markdown("aaa\n\nbbb\n") == "<p>aaa</p>\n<p>bbb</p>\n"


def test_softbreak():
    assert markdown("aaa\nbbb") == "<p>aaa\nbbb</p>\n"


def test_tree():
    doc = parse("a\n\nb")
    assert [c.type for c in doc.children] == ["paragraph", "paragraph"]

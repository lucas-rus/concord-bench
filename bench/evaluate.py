#!/usr/bin/env python3
"""Run the CommonMark spec examples against a checkout of the `cmark` package.

The checkout's code is untrusted (written by agents): it runs in a separate
process, every example has a time limit, and exceptions count as failures.
The examples come from this repository's pristine copy of the spec, never
from the checkout (agents may edit their copy of the tests).

Usage:
    python3 bench/evaluate.py CHECKOUT [--python PY] [--sections "ATX headings,Lists"] [--json OUT]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

SPEC = Path(__file__).resolve().parent.parent / "projects" / "commonmark" / "spec.json"
TIMEOUT_PER_EXAMPLE = 2  # seconds

# Runs inside the checkout's environment; reads examples on stdin, writes one
# JSON line per example: {"example": n, "ok": bool, "error": str|None}.
WORKER = r"""
import json, signal, sys, traceback
sys.path.insert(0, sys.argv[1])
def alarm(*_): raise TimeoutError("timeout")
signal.signal(signal.SIGALRM, alarm)
sys.setrecursionlimit(5000)
try:
    from cmark import markdown
except BaseException as e:
    for ex in json.load(sys.stdin):
        print(json.dumps({"example": ex["example"], "ok": False, "error": "import: " + repr(e)[:200]}))
    sys.exit(0)
for ex in json.load(sys.stdin):
    err = None
    try:
        signal.alarm(%d)
        out = markdown(ex["markdown"])
        signal.alarm(0)
        ok = out == ex["html"]
    except BaseException as e:
        signal.alarm(0)
        ok, err = False, repr(e)[:200]
    print(json.dumps({"example": ex["example"], "ok": ok, "error": err}), flush=True)
""" % TIMEOUT_PER_EXAMPLE


def load_spec() -> list[dict]:
    return json.loads(SPEC.read_text())


def evaluate(checkout: Path, python: str = sys.executable, sections: set[str] | None = None) -> dict:
    examples = [e for e in load_spec() if sections is None or e["section"] in sections]
    env = {"PYTHONPATH": str(checkout / "src"), "PATH": "/usr/bin:/bin"}
    try:
        proc = subprocess.run(
            [python, "-I", "-c", WORKER, str(checkout / "src")],
            input=json.dumps(examples),
            capture_output=True,
            text=True,
            env=env,
            cwd=checkout,
            timeout=TIMEOUT_PER_EXAMPLE * len(examples) + 60,
        )
        lines = proc.stdout.splitlines()
    except subprocess.TimeoutExpired as e:
        out = e.stdout or ""
        lines = (out.decode() if isinstance(out, bytes) else out).splitlines()
    results = {}
    for line in lines:
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        results[r["example"]] = r
    per_section: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    passed = []
    for e in examples:
        ok = results.get(e["example"], {}).get("ok", False)
        per_section[e["section"]][1] += 1
        if ok:
            per_section[e["section"]][0] += 1
            passed.append(e["example"])
    return {
        "passed": len(passed),
        "total": len(examples),
        "sections": {s: {"passed": p, "total": t} for s, (p, t) in per_section.items()},
        "passed_examples": passed,
        "errors": sorted({r["error"] for r in results.values() if r.get("error")})[:10],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("checkout", type=Path)
    ap.add_argument("--python", default=sys.executable)
    ap.add_argument("--sections")
    ap.add_argument("--json", type=Path)
    args = ap.parse_args()
    sections = set(s.strip() for s in args.sections.split(",")) if args.sections else None
    r = evaluate(args.checkout.resolve(), args.python, sections)
    if args.json:
        args.json.write_text(json.dumps(r, indent=2))
    width = max(len(s) for s in r["sections"])
    for s, v in r["sections"].items():
        print(f"{s:<{width}}  {v['passed']:>4}/{v['total']}")
    print(f"{'TOTAL':<{width}}  {r['passed']:>4}/{r['total']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

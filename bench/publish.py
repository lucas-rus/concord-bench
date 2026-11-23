#!/usr/bin/env python3
"""Publish the integrated code of valid runs as branches `runs/<run>` of the
benchmark repository, so that every reported number can be inspected.

Usage:
    python3 bench/publish.py RAW_DIR [--remote https://github.com/lucas-rus/concord-bench.git]
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("raw", type=Path, help="directory with results.jsonl and the run directories")
    ap.add_argument("--remote", default="https://github.com/lucas-rus/concord-bench.git")
    args = ap.parse_args()
    for line in (args.raw / "results.jsonl").read_text().splitlines():
        r = json.loads(line)
        if not r.get("valid"):
            continue
        repo = args.raw / r["run"] / "repo"
        if not repo.exists():
            print(f"skip {r['run']}: repository not found", file=sys.stderr)
            continue
        ref = f"result:refs/heads/runs/{r['run']}"
        p = subprocess.run(["git", "push", "-q", "--force", args.remote, ref], cwd=repo, capture_output=True, text=True)
        status = "ok" if p.returncode == 0 else p.stderr.strip()[-200:]
        print(f"runs/{r['run']}: {status}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

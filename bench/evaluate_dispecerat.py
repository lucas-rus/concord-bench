#!/usr/bin/env python3
"""Score a dispecerat TypeScript repository against the held-out 48-test specification."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT = ROOT / "projects" / "dispecerat"
SPEC_FILE = PROJECT / "eval_spec.mjs"


def resolve_tsc(start: Path) -> str:
    env_tsc = os.environ.get("DISPECERAT_TSC")
    if env_tsc and Path(env_tsc).exists():
        return env_tsc
    cur = start.resolve()
    while True:
        cand = cur / "node_modules" / ".bin" / "tsc"
        if cand.exists():
            return str(cand)
        if cur.parent == cur:
            break
        cur = cur.parent
    return shutil.which("tsc") or "tsc"


def evaluate(
    repo: Path,
    sections: set[str] | None = None,
    tsc: Path | str | None = None,
) -> dict:
    repo = repo.resolve()
    tsc_bin = str(tsc) if tsc else resolve_tsc(repo)
    tmp = Path(tempfile.mkdtemp(prefix="dispecerat-eval-"))
    try:
        # 1. Strict TypeScript check (`tsc --noEmit`) + JS emission into `tmp`.
        # Note: without `--noEmitOnError`, `tsc` still emits JS for valid files
        # even when another file has type errors, while non-zero exit code tells
        # us whether strict compilation passed cleanly.
        comp = subprocess.run(
            [
                tsc_bin,
                "-p",
                str(repo / "tsconfig.json"),
                "--outDir",
                str(tmp),
            ],
            cwd=repo,
            capture_output=True,
            text=True,
            timeout=60,
        )
        compile_out = (comp.stdout + "\n" + comp.stderr).strip()
        tsc_errors = sum(1 for line in compile_out.splitlines() if "error TS" in line)
        compile_ok = comp.returncode == 0 and tsc_errors == 0

        # Ensure loader scripts exist in repo (fallback to scaffold scripts if deleted).
        alias_script = repo / "scripts" / "ts-alias.mjs"
        if not alias_script.exists():
            alias_script = PROJECT / "scaffold" / "scripts" / "ts-alias.mjs"

        env = dict(os.environ)
        env["DISPECERAT_BUILD_DIR"] = str(tmp)
        run = subprocess.run(
            [
                "node",
                "--import",
                str(alias_script),
                str(SPEC_FILE),
            ],
            cwd=repo,
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )
        payload = None
        for line in reversed(run.stdout.splitlines()):
            line = line.strip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    payload = json.loads(line)
                    break
                except json.JSONDecodeError:
                    continue
        if payload is None:
            return {
                "total": 48 if sections is None else 7 * len(sections),
                "passed": 0,
                "rate": 0.0,
                "compile_ok": compile_ok,
                "tsc_errors": tsc_errors,
                "passed_ids": [],
                "by_section": {},
                "error": (run.stderr or compile_out)[-800:],
            }

        rows = payload.get("results", [])
        if sections is not None:
            rows = [r for r in rows if r.get("section") in sections]

        passed_ids = [r["id"] for r in rows if r.get("passed")]
        by_section: dict[str, list[int]] = {}
        for r in rows:
            sec = r["section"]
            c = by_section.setdefault(sec, [0, 0])
            c[1] += 1
            if r.get("passed"):
                c[0] += 1

        total = len(rows)
        passed = len(passed_ids)
        return {
            "total": total,
            "passed": passed,
            "rate": round(passed / total, 4) if total else 0.0,
            "compile_ok": compile_ok,
            "tsc_errors": tsc_errors,
            "passed_ids": passed_ids,
            "by_section": {k: {"passed": p, "total": t} for k, (p, t) in by_section.items()},
        }
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo", type=Path, required=True)
    ap.add_argument("--section", action="append", help="evaluate only these section names")
    ap.add_argument("--tsc", type=Path, default=None)
    args = ap.parse_args()
    res = evaluate(args.repo, set(args.section) if args.section else None, args.tsc)
    print(json.dumps({k: v for k, v in res.items() if k != "passed_ids"}, indent=2))


if __name__ == "__main__":
    main()

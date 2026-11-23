#!/usr/bin/env python3
"""Run a team of coding agents on the CommonMark project under one condition,
then score the result with the CommonMark spec examples.

Conditions:
  sequential          the tickets one after another, one agent each, each
                      starting from the previous result (no parallelism)
  parallel-off        all tickets at once, isolated worktrees, no coordination
  parallel-integrator all tickets at once without coordination, then one extra
                      agent merges the branches that conflicted and resolves
                      the conflicts (the realistic no-Concord workflow)
  parallel-concord    all tickets at once, coordinated by Concord
                      (contract notices + finish gate + peer merge)
  parallel-contracts  ablation: Concord's contract layer only
  parallel-regions    Concord's contract layer plus region coherence (overlaps
                      detected after every edit and moved or handed off; no
                      peer merge, no conflict markers)
  parallel-peeronly   ablation: Concord's peer merge only

Each run appends one JSON line to OUT/results.jsonl (see PROTOCOL.md for the
metrics) and keeps the run's repository under OUT/<run-name>/repo.

Usage:
    python3 bench/run.py --condition parallel-concord --agent-cli opencode \
        --model opencode/big-pickle --runs 1 --python VENV/bin/python --out results/raw
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT = ROOT / "projects" / "commonmark"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from evaluate import evaluate  # noqa: E402

GIT_ID = ["-c", "user.name=concord-bench", "-c", "user.email=concord-bench@localhost"]
CONDITIONS = {
    "sequential": ["--mode", "off"],
    "parallel-off": ["--mode", "off"],
    "parallel-integrator": ["--mode", "off"],
    "parallel-concord": ["--mode", "enforce", "--peer-merge"],
    "parallel-contracts": ["--mode", "enforce"],
    "parallel-regions": ["--mode", "enforce", "--regions"],
    "parallel-peeronly": ["--mode", "enforce", "--peer-merge", "--no-contracts"],
}
QUOTA_MARKERS = ("free-limit", "free usage limit", "rate_limit", "rate limit", "usage limit", "quota")


def git(args: list[str], cwd: Path, check: bool = True) -> str:
    r = subprocess.run(["git", *GIT_ID, *args], cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout.strip()


def ticket_prompt(ticket: dict, tester: Path) -> str:
    keys = " or ".join(s.replace(" ", "_") for s in ticket["sections"])
    return (
        f"{ticket['prompt']}\n\n"
        "The project is a CommonMark Markdown to HTML converter in pure Python (package `cmark` in `src/cmark`; "
        "read README.md for the design). The spec examples of your sections are tests in `tests/test_spec.py`; "
        f"run them with `{tester} -q tests/test_spec.py -k \"{keys}\"` and make them pass. "
        f"Before you finish, run the whole suite with `{tester} -q tests`: examples of other sections may still "
        "fail (other parts of the spec are not implemented yet), but do not make any example that passed before "
        "fail. Implement only your sections."
    )


def integrator_prompt(branches: list[str], tester: Path) -> str:
    listing = "\n".join(f"  - {b}" for b in branches)
    return (
        "You are the integrator of a team that implemented a CommonMark Markdown to HTML converter in pure Python "
        "(package `cmark` in `src/cmark`; read README.md for the design). Several developers worked in parallel on "
        "separate branches; the branches below could not be merged automatically because they conflict with work "
        f"that is already in your branch:\n{listing}\n\n"
        "Merge each of them into your branch with `git merge --no-edit <branch>`, one at a time, and resolve every "
        "conflict so that the features of both sides keep working (do not simply take one side). Commit each merge "
        f"(`git add -A && git commit --no-edit`). After each merge, run `{tester} -q tests` and fix what the merge "
        "broke. Stop when all branches are merged; the goal is that as many tests as possible pass."
    )


def evaluate_rev(repo: Path, rev: str, python: str, sections: set[str] | None, scratch: Path) -> dict:
    if scratch.exists():
        git(["worktree", "remove", "--force", str(scratch)], repo, check=False)
        shutil.rmtree(scratch, ignore_errors=True)
    git(["worktree", "add", "-q", "--detach", str(scratch), rev], repo)
    try:
        return evaluate(scratch, python, sections)
    finally:
        git(["worktree", "remove", "--force", str(scratch)], repo, check=False)


def concord_run(args, repo: Path, base: str, tasks: list[dict], flags: list[str], out: Path, tester: Path,
                extra_allow: list[str] | None = None) -> dict:
    tasks_file = out / "tasks.json"
    out.mkdir(parents=True, exist_ok=True)
    tasks_file.write_text(json.dumps(tasks, indent=2))
    cmd = [
        args.concord, "run", "--repo", str(repo), "--base", base, "--tasks", str(tasks_file),
        *flags, "--agent-cli", args.agent_cli, "--model", args.model, "--budget-usd", args.budget_usd,
        "--test-cmd", "true", "--allow", f"Bash({tester} *)", "--allow", f"Bash({tester})",
        "--out", str(out), "--max-wait-secs", "300",
    ]
    for a in extra_allow or []:
        cmd += ["--allow", a]
    r = subprocess.run(cmd, capture_output=True, text=True)
    (out / "concord.log").write_text(r.stdout + r.stderr)
    reports = sorted(out.glob("*/report.json"))
    if r.returncode != 0 or not reports:
        raise RuntimeError(f"concord run failed: {r.stderr.strip()[-800:]}")
    rep = json.loads(reports[-1].read_text())
    rep["_dir"] = str(reports[-1].parent)
    return rep


def quota_errors(run_dir: Path) -> int:
    """Agents whose run ended in a provider quota or rate-limit error."""
    n = 0
    for f in Path(run_dir).glob("agents/*"):
        hit = False
        if f.suffix == ".jsonl":  # OpenCode events: look only at error events
            for line in f.read_text(errors="replace").splitlines():
                try:
                    e = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if e.get("type") == "error" and any(m in json.dumps(e).lower() for m in QUOTA_MARKERS):
                    hit = True
        elif f.suffix == ".json":  # Claude Code result
            try:
                r = json.loads(f.read_text())
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if isinstance(r, dict) and r.get("is_error") and any(m in str(r.get("result", "")).lower() for m in QUOTA_MARKERS):
                hit = True
        n += hit
    return n


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--condition", required=True, choices=sorted(CONDITIONS))
    ap.add_argument("--concord", default="concord")
    ap.add_argument("--agent-cli", choices=["claude", "opencode"], default="opencode")
    ap.add_argument("--model", default="opencode/big-pickle")
    ap.add_argument("--budget-usd", default="1.50", help="per agent (Claude Code only)")
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--first-run", type=int, default=1)
    ap.add_argument("--tickets", help="comma-separated subset of ticket names (default: all)")
    ap.add_argument("--python", required=True, help="interpreter with pytest, used by agents and the evaluator")
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()
    args.out = args.out.resolve()
    args.out.mkdir(parents=True, exist_ok=True)
    tickets = json.loads((PROJECT / "tickets.json").read_text())
    if args.tickets:
        keep = set(args.tickets.split(","))
        tickets = [t for t in tickets if t["name"] in keep]
    tester = args.out / "bin" / "cmark-pytest"
    tester.parent.mkdir(exist_ok=True)
    tester.write_text(f'#!/bin/sh\nexec "{args.python}" -m pytest -p no:cacheprovider "$@"\n')
    tester.chmod(0o755)
    flags = CONDITIONS[args.condition]
    model_tag = re.sub(r"[^A-Za-z0-9.-]+", "_", args.model)

    for run in range(args.first_run, args.first_run + args.runs):
        name = f"{args.condition}-{model_tag}-{run}"
        work = args.out / name
        if work.exists():
            shutil.rmtree(work)
        repo = work / "repo"
        shutil.copytree(PROJECT / "scaffold", repo, ignore=shutil.ignore_patterns("__pycache__", ".pytest_cache"))
        git(["init", "-q", "-b", "main"], repo)
        git(["add", "-A"], repo)
        git(["config", "user.name", "concord-bench"], repo)
        git(["config", "user.email", "concord-bench@localhost"], repo)
        git(["commit", "-q", "-m", "scaffold"], repo)
        base = git(["rev-parse", "HEAD"], repo)
        print(f"[{name}] start", file=sys.stderr, flush=True)
        started = time.time()
        reports = []
        unmerged: list[str] = []
        alone: dict[str, dict] = {}
        eval_seconds = 0.0
        try:
            if args.condition == "sequential":
                head = base
                for t in tickets:
                    rep = concord_run(args, repo, head, [{"name": t["name"], "prompt": ticket_prompt(t, tester)}],
                                      flags, work / "runs" / t["name"], tester)
                    reports.append(rep)
                    head = git(["rev-parse", f"concord/{rep['run_id']}/integration"], repo)
                    t0 = time.time()
                    alone[t["name"]] = evaluate_rev(repo, head, args.python, set(t["sections"]), work / "eval")
                    eval_seconds += time.time() - t0
                    print(f"[{name}] {t['name']}: {alone[t['name']]['passed']}/{alone[t['name']]['total']}",
                          file=sys.stderr, flush=True)
                final = head
            else:
                tasks = [{"name": t["name"], "prompt": ticket_prompt(t, tester)} for t in tickets]
                rep = concord_run(args, repo, base, tasks, flags, work / "runs" / "team", tester)
                reports.append(rep)
                final = git(["rev-parse", f"concord/{rep['run_id']}/integration"], repo)
                team_run = rep["run_id"]
                if args.condition == "parallel-integrator" and rep["integration"]["conflicts"]:
                    branches = [f"concord/{team_run}/{n}" for n in rep["integration"]["conflicts"]]
                    print(f"[{name}] integrator: {len(branches)} branches", file=sys.stderr, flush=True)
                    irep = concord_run(args, repo, final, [{"name": "integrator", "prompt": integrator_prompt(branches, tester)}],
                                       flags, work / "runs" / "integrator", tester, extra_allow=["Bash(git *)"])
                    reports.append(irep)
                    final = git(["rev-parse", f"concord/{irep['run_id']}/integration"], repo)
                    unmerged = [b for b in branches
                                if subprocess.run(["git", "merge-base", "--is-ancestor", b, final], cwd=repo).returncode != 0]
                for t in tickets:
                    branch = f"concord/{team_run}/{t['name']}"
                    t0 = time.time()
                    alone[t["name"]] = evaluate_rev(repo, branch, args.python, set(t["sections"]), work / "eval")
                    eval_seconds += time.time() - t0
        except Exception as e:  # noqa: BLE001
            print(f"[{name}] FAILED: {e}", file=sys.stderr, flush=True)
            with (args.out / "results.jsonl").open("a") as fh:
                fh.write(json.dumps({"run": name, "condition": args.condition, "model": args.model, "error": str(e)[:500], "valid": False}) + "\n")
            continue
        # Development time only: the scoring of branches in between is not counted.
        wall = time.time() - started - eval_seconds
        together = evaluate_rev(repo, final, args.python, None, work / "eval")
        git(["branch", "-f", "result", final], repo)
        per_ticket = {}
        for t in tickets:
            own = set(t["sections"])
            tog = sum(v["passed"] for s, v in together["sections"].items() if s in own)
            total = sum(v["total"] for s, v in together["sections"].items() if s in own)
            per_ticket[t["name"]] = {"alone": alone[t["name"]]["passed"], "together": tog, "total": total}
        agents = [a for r in reports for a in r["agents"]]
        conflicts = sorted(reports[0]["integration"]["conflicts"]) if args.condition != "sequential" else \
            sorted({n for r in reports for n in r["integration"]["conflicts"]})
        qerr = sum(quota_errors(Path(r["_dir"])) for r in reports)
        errors = sum(bool(a.get("is_error")) for a in agents)
        # Agents that never started a session (e.g. the agent CLI failed to start): a harness error.
        start_failures = sorted(a["name"] for a in agents if not a.get("session_id"))
        row = {
            "run": name,
            "condition": args.condition,
            "agent_cli": args.agent_cli,
            "model": args.model,
            "tickets": len(tickets),
            "passed": together["passed"],
            "total": together["total"],
            "sections": {s: v["passed"] for s, v in together["sections"].items()},
            "per_ticket": per_ticket,
            "alone_sum": sum(v["alone"] for v in per_ticket.values()),
            "together_sum": sum(v["together"] for v in per_ticket.values()),
            "integration_loss": sum(max(0, v["alone"] - v["together"]) for v in per_ticket.values()),
            "integration_net": sum(v["alone"] - v["together"] for v in per_ticket.values()),
            "merge_conflicts": conflicts,
            "unmerged_after_integrator": unmerged,
            "wall_seconds": round(wall, 1),
            "agent_seconds": round(sum(a["seconds"] for a in agents), 1),
            "cost_usd": round(sum(a["cost_usd"] for a in agents), 4),
            "turns": sum(a["turns"] for a in agents),
            "notices": sum(a["notices_delivered"] for a in agents),
            "gate_blocks": sum(a["gate_blocks"] for a in agents),
            "merges": sum(len(a["merges"]) for a in agents),
            "resumed": sum(a.get("resumed", 0) for a in agents),
            "agent_errors": errors,
            "quota_errors": qerr,
            "start_failures": start_failures,
            "valid": qerr == 0 and not start_failures,
            "result_commit": final,
        }
        with (args.out / "results.jsonl").open("a") as fh:
            fh.write(json.dumps(row) + "\n")
        print(
            f"[{name}] {row['passed']}/{row['total']} spec examples, loss {row['integration_loss']}, "
            f"conflicts {len(conflicts)}, {wall / 60:.1f} min, ${row['cost_usd']:.2f}, valid={row['valid']}",
            file=sys.stderr,
            flush=True,
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())

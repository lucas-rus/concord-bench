#!/usr/bin/env python3
"""Run a team of coding agents on the TypeScript `dispecerat` project across
multiple coordination methods, then score each branch and the integrated result
against the held-out 48-test specification (`eval_spec.mjs`).

Key generalization properties tested:
  1. Language & module system: TypeScript 5 (`strict: true`) with `@/lib/...`
     tsconfig root path aliases (rather than Python).
  2. Domain: Stateful Bucharest field-service dispatch hub (`DemoBackend` in
     `lib/demo/mock-server.ts` + shared `lib/types.ts` + cross-module helpers).
  3. Zero-config `--test-cmd`: NO per-ticket `check` field in `tasks.json` and
     NO pre-written feature test suite in the scaffold — agents write their own
     unit tests in `tests/<ticket>.test.ts` and Concord uses only the single
     project command `--test-cmd ./scripts/run-tests.sh`.

Conditions:
  parallel-off         6 parallel agents in isolated worktrees, uncoordinated git merge
  parallel-fileleases  6 parallel agents with exclusive whole-file leases (Baseline B3)
  parallel-integrator  6 uncoordinated parallel agents + 1 extra AI Integrator agent
  parallel-concord     6 parallel agents coordinated by Concord (`--mode enforce --regions`)
  sequential           6 tickets one after another on a single branch
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT = ROOT / "projects" / "dispecerat"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from evaluate_dispecerat import evaluate  # noqa: E402

GIT_ID = ["-c", "user.name=concord-bench", "-c", "user.email=concord-bench@localhost"]
CONDITIONS = {
    "sequential": ["--mode", "off"],
    "parallel-off": ["--mode", "off"],
    "parallel-integrator": ["--mode", "off"],
    "parallel-fileleases": ["--mode", "enforce", "--file-leases", "--no-contracts"],
    "parallel-concord": ["--mode", "enforce", "--regions"],
}
QUOTA_MARKERS = (
    "free-limit",
    "free usage limit",
    "rate_limit",
    "rate limit",
    "usage limit",
    "quota",
    "hour limit",
    "weekly limit",
    "limit · resets",
    "hit your limit",
    "insufficient credits",
    "requires more credits",
    "402",
    "too many requests",
    "429",
    "provider.transport",
    "enotfound",
    "econnreset",
    "etimedout",
    "econnrefused",
    "socket hang up",
    "fetch failed",
    "network error",
)
PROGRESS_EVENTS = {"step_finish", "step-finish", "text", "tool_use", "tool"}


def git(args: list[str], cwd: Path, check: bool = True) -> str:
    r = subprocess.run(["git", *GIT_ID, *args], cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout.strip()


def ticket_task(ticket: dict) -> dict:
    # Deliberately omit per-ticket `"check"` to test zero-config `--test-cmd`!
    prompt = (
        f"{ticket['prompt']}\n\n"
        "Read `README.md`, `lib/types.ts`, and `lib/demo/mock-server.ts` first. "
        "Keep existing functionality intact, use `@/lib/...` imports consistently, "
        "and run `./scripts/run-tests.sh` to verify strict TypeScript compilation "
        "and unit tests pass before finishing. Implement only your assigned ticket."
    )
    return {"name": ticket["name"], "prompt": prompt}


def integrator_prompt(branches: list[str]) -> str:
    listing = "\n".join(f"  - {b}" for b in branches)
    return (
        "You are the integrator of a team implementing the TypeScript `dispecerat` "
        "field-service dispatch engine (read `README.md` for architecture). "
        "Six developers worked in parallel on separate branches; the branches below "
        "could not be merged automatically because they conflict with work already "
        f"in your branch:\n{listing}\n\n"
        "Merge each branch into your branch one at a time (`git merge --no-edit <branch>`), "
        "resolve every conflict so ALL features and types from both sides keep working "
        "(do not drop any teammate's methods, types, or tests), commit each merge "
        "(`git add -A && git commit --no-edit`), and run `./scripts/run-tests.sh` "
        "to fix any TypeScript compilation or unit test errors. Stop when all branches "
        "are merged and `./scripts/run-tests.sh` passes."
    )


def evaluate_rev(repo: Path, rev: str, sections: set[str] | None, scratch: Path) -> dict:
    if scratch.exists():
        git(["worktree", "remove", "--force", str(scratch)], repo, check=False)
        shutil.rmtree(scratch, ignore_errors=True)
    git(["worktree", "add", "-q", "--detach", str(scratch), rev], repo)
    try:
        return evaluate(scratch, sections)
    finally:
        git(["worktree", "remove", "--force", str(scratch)], repo, check=False)


def concord_run(
    args,
    repo: Path,
    base: str,
    tasks: list[dict],
    flags: list[str],
    out: Path,
    extra_allow: list[str] | None = None,
) -> dict:
    tasks_file = out / "tasks.json"
    out.mkdir(parents=True, exist_ok=True)
    tasks_file.write_text(json.dumps(tasks, indent=2))
    cmd = [
        args.concord,
        "run",
        "--repo",
        str(repo),
        "--base",
        base,
        "--tasks",
        str(tasks_file),
        *flags,
        "--agent-cli",
        args.agent_cli,
        "--model",
        args.model,
        "--budget-usd",
        args.budget_usd,
        "--test-cmd",
        "./scripts/run-tests.sh",
        "--allow",
        "Bash(./scripts/run-tests.sh)",
        "--allow",
        "Bash(npm test)",
        "--allow",
        "Bash(node *)",
        "--out",
        str(out),
        "--max-wait-secs",
        "300",
    ]
    for a in extra_allow or []:
        cmd += ["--allow", a]
    env = dict(os.environ)
    r = subprocess.run(cmd, capture_output=True, text=True, env=env)
    (out / "concord.log").write_text(r.stdout + r.stderr)
    reports = sorted(out.glob("*/report.json"))
    if r.returncode != 0 or not reports:
        raise RuntimeError(f"concord run failed: {r.stderr.strip()[-800:]}")
    rep = json.loads(reports[-1].read_text())
    rep["_dir"] = str(reports[-1].parent)
    return rep


def quota_errors(run_dir: Path) -> int:
    n = 0
    for f in Path(run_dir).glob("agents/*"):
        hit = False
        if f.suffix == ".jsonl":
            pending = False
            for line in f.read_text(errors="replace").splitlines():
                try:
                    e = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if e.get("type") == "error":
                    if any(m in json.dumps(e).lower() for m in QUOTA_MARKERS):
                        pending = True
                elif e.get("type") in PROGRESS_EVENTS:
                    pending = False
            hit = pending
        n += hit
    return n


def run_condition(args, condition: str, tickets: list[dict], run_num: int) -> dict:
    flags = CONDITIONS[condition]
    model_tag = re.sub(r"[^A-Za-z0-9.-]+", "_", args.model)
    name = f"{condition}-{model_tag}-{run_num}"
    work = args.out / name
    existing_reports = sorted((work / "runs" / "team").glob("*/report.json")) if args.resume_existing else []
    repo = work / "repo"
    if not existing_reports:
        if work.exists():
            shutil.rmtree(work)
        shutil.copytree(
            PROJECT / "scaffold",
            repo,
            ignore=shutil.ignore_patterns("node_modules", ".tsbuild", "dist", ".DS_Store"),
        )
        (repo / "scripts" / "run-tests.sh").chmod(0o755)
        git(["init", "-q", "-b", "main"], repo)
        git(["add", "-A"], repo)
        git(["config", "user.name", "concord-bench"], repo)
        git(["config", "user.email", "concord-bench@localhost"], repo)
        git(["commit", "-q", "-m", "scaffold"], repo)
        base = git(["rev-parse", "HEAD"], repo)
    else:
        base = json.loads(existing_reports[-1].read_text())["base"]
    print(f"[{name}] start", file=sys.stderr, flush=True)
    started = time.time()
    reports: list[dict] = []
    unmerged: list[str] = []
    alone: dict[str, dict] = {}
    eval_seconds = 0.0
    reused_wall = 0.0

    if condition == "sequential":
        head = base
        for t in tickets:
            rep = concord_run(
                args,
                repo,
                head,
                [ticket_task(t)],
                flags,
                work / "runs" / t["name"],
            )
            reports.append(rep)
            head = git(["rev-parse", f"concord/{rep['run_id']}/integration"], repo)
            t0 = time.time()
            alone[t["name"]] = evaluate_rev(repo, head, set(t["sections"]), work / "eval")
            eval_seconds += time.time() - t0
            print(
                f"[{name}] {t['name']}: {alone[t['name']]['passed']}/{alone[t['name']]['total']}",
                file=sys.stderr,
                flush=True,
            )
        final = head
    else:
        if existing_reports:
            rep = json.loads(existing_reports[-1].read_text())
            rep["_dir"] = str(existing_reports[-1].parent)
            reused_wall = float(rep["wall_seconds"])
        else:
            tasks = [ticket_task(t) for t in tickets]
            rep = concord_run(args, repo, base, tasks, flags, work / "runs" / "team")
        reports.append(rep)
        run_id = rep["run_id"]
        t0 = time.time()
        for t in tickets:
            rev = git(["rev-parse", f"concord/{run_id}/{t['name']}"], repo)
            alone[t["name"]] = evaluate_rev(repo, rev, set(t["sections"]), work / "eval")
        eval_seconds += time.time() - t0
        final = git(["rev-parse", f"concord/{run_id}/integration"], repo)
        unmerged = sorted(rep["integration"]["conflicts"])

        if condition == "parallel-integrator" and unmerged:
            branches = [f"concord/{run_id}/{a}" for a in unmerged]
            print(f"[{name}] integrator: {len(branches)} branches", file=sys.stderr, flush=True)
            irep = concord_run(
                args,
                repo,
                final,
                [{"name": "integrator", "prompt": integrator_prompt(branches)}],
                ["--mode", "off"],
                work / "runs" / "integrator",
                extra_allow=["Bash(git *)"],
            )
            reports.append(irep)
            final = git(["rev-parse", f"concord/{irep['run_id']}/integration"], repo)
            unmerged = [
                a
                for a, b in zip(unmerged, branches)
                if subprocess.run(
                    ["git", "merge-base", "--is-ancestor", b, final], cwd=repo
                ).returncode
                != 0
            ]

    wall = reused_wall + (time.time() - started - eval_seconds)
    score = evaluate_rev(repo, final, None, work / "eval")
    base_score = evaluate_rev(repo, base, None, work / "eval")

    union_alone = set().union(*(a["passed_ids"] for a in alone.values()))
    final_passed = set(score["passed_ids"])
    ticket_passed_ids = {pid for pid in final_passed if not pid.startswith("integration::")}
    synergy_passed_ids = {pid for pid in final_passed if pid.startswith("integration::")}
    lost = sorted(union_alone - final_passed)

    agents = [a for r in reports for a in r["agents"]]
    qerr = sum(quota_errors(Path(r["_dir"])) for r in reports)
    mrp_ready = None
    mrp_path = Path(reports[0]["_dir"]) / "mrp.json"
    if mrp_path.exists():
        try:
            mrp_ready = json.loads(mrp_path.read_text()).get("ready_to_merge")
        except json.JSONDecodeError:
            mrp_ready = None

    record = {
        "project": "dispecerat-ts",
        "condition": condition,
        "model": args.model,
        "agent_cli": args.agent_cli,
        "run": run_num,
        "tickets": [t["name"] for t in tickets],
        "base_passed": base_score["passed"],
        "total": score["total"],
        "passed": score["passed"],
        "rate": score["rate"],
        "compile_ok": score["compile_ok"],
        "tsc_errors": score["tsc_errors"],
        "ticket_passed": len(ticket_passed_ids),
        "ticket_total": 42,
        "synergy_passed": len(synergy_passed_ids),
        "synergy_total": 6,
        "by_section": score["by_section"],
        "alone": {
            k: {
                "passed": v["passed"],
                "total": v["total"],
                "compile_ok": v["compile_ok"],
            }
            for k, v in alone.items()
        },
        "union_alone": len(union_alone),
        "integration_loss": len(lost),
        "merge_conflicts": unmerged,
        "mrp_ready": mrp_ready,
        "wall_seconds": round(wall, 1),
        "agent_seconds": round(sum(a["seconds"] for a in agents), 1),
        "cost_usd": round(sum(r["total_cost_usd"] for r in reports), 4),
        "turns": sum(a["turns"] for a in agents),
        "notices": sum(a["notices_delivered"] for a in agents),
        "gate_blocks": sum(a["gate_blocks"] for a in agents),
        "check_blocks": sum(a.get("check_blocks", 0) for a in agents),
        "peer_merges": sum(len(a["merges"]) for a in agents),
        "resumed": sum(a["resumed"] for a in agents),
        "agent_errors": sum(1 for a in agents if a["is_error"]),
        "quota_errors": qerr,
        "valid": qerr == 0 and not any(a["is_error"] for a in agents),
    }
    with (args.out / "results.jsonl").open("a") as f:
        f.write(json.dumps(record) + "\n")
    print(
        f"[{name}] {score['passed']}/{score['total']} spec tests "
        f"(tickets {len(ticket_passed_ids)}/42, synergy {len(synergy_passed_ids)}/6), "
        f"compile_ok={score['compile_ok']}, loss={len(lost)}, "
        f"conflicts={len(unmerged)}, {wall:.0f}s",
        file=sys.stderr,
        flush=True,
    )
    return record


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--condition",
        required=True,
        help="condition name or comma-separated list (e.g. parallel-off,parallel-fileleases,parallel-integrator,parallel-concord)",
    )
    ap.add_argument("--concord", default="concord")
    ap.add_argument("--agent-cli", choices=["claude", "opencode"], default="opencode")
    ap.add_argument("--model", default="opencode-go/hy4-flash-free")
    ap.add_argument("--budget-usd", default="1.50")
    ap.add_argument("--runs", type=int, default=1)
    ap.add_argument("--first-run", type=int, default=1)
    ap.add_argument("--tickets", help="comma-separated subset of ticket names")
    ap.add_argument("--resume-existing", action="store_true", help="reuse completed team runs if present")
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()
    args.out = args.out.resolve()
    args.out.mkdir(parents=True, exist_ok=True)
    tickets = json.loads((PROJECT / "tickets.json").read_text())
    if args.tickets:
        keep = set(args.tickets.split(","))
        tickets = [t for t in tickets if t["name"] in keep]

    conds = [c.strip() for c in args.condition.split(",") if c.strip()]
    for c in conds:
        if c not in CONDITIONS:
            raise SystemExit(f"Unknown condition: {c}")

    rc = 0
    for run_num in range(args.first_run, args.first_run + args.runs):
        for c in conds:
            try:
                rec = run_condition(args, c, tickets, run_num)
                if not rec["valid"]:
                    rc = 2
            except Exception as e:
                print(f"[{c}] FAILED: {e}", file=sys.stderr, flush=True)
                rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main())

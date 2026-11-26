#!/usr/bin/env python3
"""Token use per benchmark run, from the agents' own OpenCode streams.

Every OpenCode step ends with a `step_finish` event that records the tokens of
that model call: fresh input, cache reads and writes, output and reasoning.
This script sums them over every agent of a run, including the integrator
agent of `parallel-integrator` and every ticket of `sequential`, and writes one
row per run directory.

Usage:
    python bench/tokens.py RESULTS_DIR [RESULTS_DIR ...] --out tokens.jsonl

`total` is all tokens the model processed (input + cache read + cache write +
output + reasoning); `billable_in` is input that was not a cache read.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

# List prices in USD per 1M tokens: (input, cache read, output). Cache writes are
# billed at the input rate and reasoning at the output rate. Checked 2026-11-26:
# Hy4 Flash at Tencent Cloud TokenHub's list price (without the 50% launch
# promotion); DeepSeek V4.1 Flash at the official API's peak rate, as reported
# by pricing aggregators. OpenCode Go itself is a flat subscription: these give
# what a run would cost at the provider's API, for comparing conditions.
PRICES = {
    "opencode-go/hy4-flash-free": (0.070, 0.003, 0.281),
    "opencode-go/deepseek-v4.1-flash": (0.30, 0.006, 1.20),
}


def cost(t: dict, model: str) -> float | None:
    if model not in PRICES:
        return None
    pin, pcache, pout = PRICES[model]
    return ((t["input"] + t["cache_write"]) * pin + t["cache_read"] * pcache + (t["output"] + t["reasoning"]) * pout) / 1e6


def run_tokens(run_dir: Path) -> dict:
    t = {"input": 0, "cache_read": 0, "cache_write": 0, "output": 0, "reasoning": 0, "steps": 0, "calls_by_role": {}}
    for stream in sorted(run_dir.glob("runs/*/*/agents/*.turn*.jsonl")):
        role = stream.parts[-4]  # team, integrator, or the sequential ticket
        role = role if role in ("team", "integrator") else "sequential"
        for line in stream.read_text(errors="replace").splitlines():
            if '"step_finish"' not in line:
                continue
            try:
                part = json.loads(line).get("part") or {}
            except json.JSONDecodeError:
                continue
            tok = part.get("tokens") or {}
            cache = tok.get("cache") or {}
            t["input"] += tok.get("input", 0)
            t["cache_read"] += cache.get("read", 0)
            t["cache_write"] += cache.get("write", 0)
            t["output"] += tok.get("output", 0)
            t["reasoning"] += tok.get("reasoning", 0)
            t["steps"] += 1
            t["calls_by_role"][role] = t["calls_by_role"].get(role, 0) + 1
    t["total"] = t["input"] + t["cache_read"] + t["cache_write"] + t["output"] + t["reasoning"]
    t["billable_in"] = t["input"] + t["cache_write"]
    return t


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("results", nargs="+", type=Path, help="directories holding <condition>-<model>-<n>/ run folders")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    rows = []
    for root in args.results:
        for run_dir in sorted(p for p in root.iterdir() if p.is_dir() and (p / "runs").is_dir()):
            if run_dir.name.startswith(("invalid", "superseded")):
                continue
            t = run_tokens(run_dir)
            model = next(
                (m for m in PRICES if run_dir.name.split("-opencode-go_")[-1].startswith(m.split("/")[1])), None
            )
            rows.append({"run": run_dir.name, **t, "model": model, "list_cost_usd": cost(t, model) if model else None})
    args.out.write_text("".join(json.dumps(r) + "\n" for r in rows))
    print(f"{len(rows)} runs -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

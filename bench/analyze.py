#!/usr/bin/env python3
"""Analyse benchmark runs as pre-registered in PROTOCOL.md.

Reads results.jsonl files and writes:
  - a Markdown report (per condition: mean, SD, bootstrap 95% CI of each
    metric; hypothesis tests H1-H3 with Mann-Whitney U, Holm correction and
    Cliff's delta);
  - figures: spec examples passed per condition, per-section heatmap, and
    quality vs wall time.

Requires numpy, scipy and matplotlib.

Usage:
    python bench/analyze.py results/raw/*/results.jsonl --model opencode/big-pickle --out results/report
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from scipy.stats import mannwhitneyu

ORDER = ["sequential", "parallel-off", "parallel-integrator", "parallel-contracts", "parallel-regions", "parallel-regions-lean", "parallel-peeronly", "parallel-concord"]
METRICS = [
    ("passed", "spec examples passed (of 652)"),
    ("integration_loss", "integration loss (examples)"),
    ("conflicts", "merge conflicts (agents)"),
    ("wall_min", "wall time (min)"),
    ("cost_usd", "cost (USD)"),
]
RNG = np.random.default_rng(20261123)


def load(paths: list[Path], model: str | None) -> list[dict]:
    rows = []
    for p in paths:
        for line in p.read_text().splitlines():
            if not line.strip():
                continue
            r = json.loads(line)
            if model and r.get("model") != model:
                continue
            r.setdefault("valid", False)
            if "passed" in r:
                # Losses only (PROTOCOL amendment 2026-11-23), also for rows written before it.
                r["integration_loss"] = sum(max(0, v["alone"] - v["together"]) for v in r["per_ticket"].values())
                r["conflicts"] = len(r.get("merge_conflicts", []))
                r["wall_min"] = r["wall_seconds"] / 60
            rows.append(r)
    return rows


def boot_ci(x: np.ndarray, n: int = 10_000) -> tuple[float, float]:
    if len(x) < 2:
        return (float("nan"), float("nan"))
    means = RNG.choice(x, size=(n, len(x)), replace=True).mean(axis=1)
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def cliffs_delta(a: np.ndarray, b: np.ndarray) -> float:
    """P(a > b) - P(a < b)."""
    gt = sum((x > y) for x in a for y in b)
    lt = sum((x < y) for x in a for y in b)
    return (gt - lt) / (len(a) * len(b))


def holm(pvals: list[float]) -> list[float]:
    order = np.argsort(pvals)
    adj = [0.0] * len(pvals)
    running = 0.0
    for rank, i in enumerate(order):
        running = max(running, min(1.0, (len(pvals) - rank) * pvals[i]))
        adj[i] = running
    return adj


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("results", nargs="+", type=Path)
    ap.add_argument("--model")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    rows = load(args.results, args.model)
    valid = [r for r in rows if r["valid"]]
    by = defaultdict(list)
    for r in valid:
        by[r["condition"]].append(r)
    conds = [c for c in ORDER if c in by]

    lines = [f"# Results{' (' + args.model + ')' if args.model else ''}", ""]
    lines.append(f"Runs: {len(rows)} total, {len(valid)} valid, {len(rows) - len(valid)} invalid (quota or harness errors, not analysed).")
    lines.append("")
    lines.append("| condition | n | " + " | ".join(label for _, label in METRICS) + " |")
    lines.append("|---|---|" + "---|" * len(METRICS))
    for c in conds:
        cells = []
        for key, _ in METRICS:
            x = np.array([r[key] for r in by[c]], dtype=float)
            lo, hi = boot_ci(x)
            ci = f" [{lo:.1f}, {hi:.1f}]" if len(x) > 1 else ""
            cells.append(f"{x.mean():.1f} ± {x.std(ddof=1) if len(x) > 1 else 0:.1f}{ci}")
        lines.append(f"| {c} | {len(by[c])} | " + " | ".join(cells) + " |")
    lines.append("")
    lines.append("Cells: mean ± SD [bootstrap 95% CI of the mean].")
    lines.append("")

    # Protocol Amendment 2 designates parallel-regions (contract + region
    # coherence) as the primary treatment when present; fall back to
    # parallel-concord when analysing older peer-merge runs.
    treatment = "parallel-regions" if "parallel-regions" in by else "parallel-concord"
    tests = [
        ("H1", "passed", treatment, "parallel-off", "more spec examples passed"),
        ("H2", "integration_loss", treatment, "parallel-off", "smaller integration loss"),
        ("H3", "wall_min", treatment, "sequential", "shorter wall time"),
        ("H5", "passed", treatment, "parallel-integrator", "more spec examples passed than with an integrator"),
    ]
    results = []
    for h, key, a, b, claim in tests:
        if a in by and b in by and len(by[a]) >= 2 and len(by[b]) >= 2:
            xa = np.array([r[key] for r in by[a]], float)
            xb = np.array([r[key] for r in by[b]], float)
            p = mannwhitneyu(xa, xb, alternative="two-sided").pvalue
            results.append((h, key, a, b, claim, xa, xb, float(p)))
    if results:
        adj = holm([r[-1] for r in results])
        lines.append("| hypothesis | comparison | means | Cliff's δ | p (MWU) | p (Holm) |")
        lines.append("|---|---|---|---|---|---|")
        for (h, key, a, b, claim, xa, xb, p), pa in zip(results, adj):
            lines.append(
                f"| {h}: {claim} | {key}: {a} vs {b} | {xa.mean():.1f} vs {xb.mean():.1f} | "
                f"{cliffs_delta(xa, xb):+.2f} | {p:.4f} | {pa:.4f} |"
            )
        lines.append("")
    for tr in ("parallel-regions", "parallel-concord"):
        if tr in by and "sequential" in by:
            q = np.mean([r["passed"] for r in by[tr]]) / np.mean([r["passed"] for r in by["sequential"]])
            s = np.mean([r["wall_min"] for r in by["sequential"]]) / np.mean([r["wall_min"] for r in by[tr]])
            lines.append(f"H4 (descriptive): {tr} reaches **{100 * q:.0f}%** of sequential quality, **{s:.1f}×** faster.")
            lines.append("")

    # Per-section table.
    sections = list(json.loads((Path(__file__).resolve().parent.parent / "projects/commonmark/spec.json").read_text()))
    totals: dict[str, int] = defaultdict(int)
    for e in sections:
        totals[e["section"]] += 1
    names = list(totals)
    lines.append("## Pass rate per spec section (mean over valid runs)")
    lines.append("")
    lines.append("| section | examples | " + " | ".join(conds) + " |")
    lines.append("|---|---|" + "---|" * len(conds))
    matrix = []
    for s in names:
        row = [np.mean([r["sections"].get(s, 0) for r in by[c]]) / totals[s] for c in conds]
        matrix.append(row)
        lines.append(f"| {s} | {totals[s]} | " + " | ".join(f"{100 * v:.0f}%" for v in row) + " |")
    (args.out / "report.md").write_text("\n".join(lines) + "\n")

    # Figures.
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    if conds:
        fig, ax = plt.subplots(figsize=(7, 4))
        data = [[r["passed"] for r in by[c]] for c in conds]
        ax.boxplot(data, tick_labels=conds, showmeans=True)
        for i, d in enumerate(data, 1):
            ax.scatter([i] * len(d), d, alpha=0.6, s=18, zorder=3)
        ax.axhline(105, ls=":", c="grey", lw=1)
        ax.text(0.55, 108, "scaffold (105)", fontsize=8, color="grey")
        ax.set_ylabel("spec examples passed (of 652)")
        ax.set_title("Integrated result per condition")
        plt.setp(ax.get_xticklabels(), rotation=15)
        fig.tight_layout()
        fig.savefig(args.out / "passed.png", dpi=160)

        fig, ax = plt.subplots(figsize=(1.4 * len(conds) + 4, 9))
        im = ax.imshow(np.array(matrix), aspect="auto", cmap="viridis", vmin=0, vmax=1)
        ax.set_yticks(range(len(names)), names, fontsize=8)
        ax.set_xticks(range(len(conds)), conds, rotation=20, fontsize=8)
        fig.colorbar(im, ax=ax, label="pass rate")
        ax.set_title("Pass rate per spec section")
        fig.tight_layout()
        fig.savefig(args.out / "sections.png", dpi=160)

        fig, ax = plt.subplots(figsize=(6, 4))
        for c in conds:
            ax.scatter([r["wall_min"] for r in by[c]], [r["passed"] for r in by[c]], label=c, s=30)
        ax.set_xlabel("wall time (min)")
        ax.set_ylabel("spec examples passed")
        ax.legend(fontsize=8)
        ax.set_title("Quality vs time")
        fig.tight_layout()
        fig.savefig(args.out / "quality_time.png", dpi=160)

    print((args.out / "report.md").read_text())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

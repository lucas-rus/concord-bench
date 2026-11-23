# concord-bench

A benchmark for **teams of AI coding agents building one project in parallel**, and the evaluation of [Concord](https://github.com/lucas-rus/concord), which coordinates such teams.

## The task

Twelve agents build a [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) Markdown→HTML converter in Python from a small scaffold (`projects/commonmark/scaffold`: parsing architecture, paragraphs only). Each agent gets one ticket covering one to three spec sections (`projects/commonmark/tickets.json`), such as headings, lists, emphasis or links. The tickets are ordinary issues. They say nothing about interfaces, other agents or coordination. Coupling arises from the work itself:
- emphasis and links share the delimiter algorithm;
- links need the reference definitions;
- images reuse link parsing;
- lists and block quotes share the container loop.

**The judge** is the official CommonMark spec suite (652 examples), not tests written by the experimenters. `bench/evaluate.py` runs it on the integrated code, isolated, with a time limit per example.

## Conditions

| condition | |
|---|---|
| `sequential` | one ticket after another (quality reference, no parallelism) |
| `parallel-off` | 12 agents at once in isolated worktrees, merged at the end |
| `parallel-concord` | 12 agents at once, coordinated by Concord |
| `parallel-contracts`, `parallel-peeronly` | ablations of Concord's two mechanisms |

**Metrics.**
- Spec examples passed by the integrated result.
- **Integration loss**: each ticket's sections passing on the agent's own branch but failing after the merge.
- Merge conflicts, wall time, cost, and Concord's interventions.

The hypotheses and analysis are pre-registered in [PROTOCOL.md](PROTOCOL.md).

## Running

```bash
# Concord: https://github.com/lucas-rus/concord#install-and-use-it-from-your-agent-mcp
python3 -m venv .venv && .venv/bin/pip install pytest numpy scipy matplotlib
python3 bench/run.py --condition parallel-concord --agent-cli opencode --model opencode/big-pickle \
    --runs 1 --python .venv/bin/python --out results/raw
.venv/bin/python bench/analyze.py results/raw/results.jsonl --model opencode/big-pickle --out results/report
python3 bench/evaluate.py projects/commonmark/scaffold     # score any checkout
```

## Results

See [results/](results/). Each valid run's integrated code is published as a branch `runs/<condition>-<model>-<n>`.

## License

- **Code:** MIT.
- **Spec examples:** `projects/commonmark/spec.json` and `projects/commonmark/scaffold/tests/spec.json` are taken from the [CommonMark spec](https://spec.commonmark.org/0.31.2/) by John MacFarlane, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

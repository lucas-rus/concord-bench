# concord-bench

A multi-language benchmark for **teams of AI coding agents building one project in parallel**, and the empirical evaluation harness for [Concord](https://github.com/lucas-rus/concord).

## Benchmark Suites

### 1. `projects/commonmark` — Python, 12 Parallel Agents, 652 Official Spec Examples

Twelve agents build a [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/) Markdown→HTML converter in pure Python from a minimal scaffold (`projects/commonmark/scaffold`: parsing architecture, paragraphs only). Each agent receives one ordinary feature ticket (`projects/commonmark/tickets.json`) covering one to three spec sections (headings, lists, emphasis, links, HTML blocks, etc.) with no instructions about interfaces or peer agents:
- emphasis and links share the delimiter-stack algorithm;
- links depend on link reference definitions;
- images reuse link destination/title parsing;
- lists and block quotes share container continuation logic.

**The judge** is the official CommonMark 0.31.2 specification suite (**652 examples**), executed by `bench/evaluate.py` in isolation with per-example timeouts.

Main study (pre-registered in [PROTOCOL.md](PROTOCOL.md)): `opencode-go/hy4-flash-free`, runs interleaved by round, mean ± SD over n valid runs. Full report with bootstrap CIs, tests and figures: [`results/hy4m/report`](results/hy4m/report/report.md).

| Condition | n | Spec examples passed (of 652) | Integration loss | Merge conflicts (of 12 branches) | Wall-clock time |
|---|---|---|---|---|---|
| `sequential` (1 agent, ticket by ticket) | 5 | 651.2 ± 0.8 (650–652) | 0 | 0 | 65.1 ± 5.9 min (1.0×) |
| `parallel-off` (12 agents, uncoordinated) | 5 | 199.0 ± 30.1 (161–236) | 301.8 ± 45.8 | 9.0 ± 1.4 | 13.7 ± 1.9 min |
| `parallel-integrator` (12 agents + 13th integrator agent) | 5 | 652 in every run | 0 | 9.4 ± 1.1, resolved by the integrator | 34.2 ± 4.8 min (1.9×) |
| Concord, peer merge (`parallel-concord`: `--mode enforce --peer-merge`) | 3 | 652 in every run | 0 | 0 | 27.1 ± 3.5 min (2.4×) |
| **Concord, region coherence (`parallel-regions`: `--mode enforce --regions`)** | **5** | **652 in every run** | **0** | **0** | **20.8 ± 1.9 min (3.1×)** |

Pre-registered tests (Mann–Whitney U, Holm-corrected, Cliff's δ), region coherence vs: `parallel-off` on examples passed (H1) and integration loss (H2), and `sequential` on wall time (H3): δ = ±1.00, p = 0.03 each. Exploratory: region coherence is faster than the integrator in every pairing (δ = −1.00, p = 0.008, uncorrected). A replication with `opencode-go/deepseek-v4.1-flash` (n = 3 per condition) is running.

### 2. `projects/dispecerat` — TypeScript 5 (`strict`), 6 Parallel Agents, Zero-Config `--test-cmd`

Six parallel agents build a Bucharest field-service dispatch engine (`DemoBackend` in `lib/demo/mock-server.ts`, shared `lib/types.ts`, and `@/lib/...` tsconfig root path-alias modules: `skills-matching`, `geo-ranking`, `dispatch-lifecycle`, `clients-pv-reports`, `projects-timing`, `freshness-sla`).

Unlike `commonmark`, the scaffold contains **no pre-written feature test suite** and `tasks.json` provides **no per-ticket `check` filter** — agents write their own `node:test` suites (`tests/<ticket>.test.ts`) and Concord coordinates using only the single project command `--test-cmd ./scripts/run-tests.sh`. Held-out evaluation (`bench/evaluate_dispecerat.py` + `projects/dispecerat/eval_spec.mjs`) scores strict `tsc` compilation plus **48 behavioral tests** (42 per-ticket tests + 6 cross-ticket runtime synergy tests).

Exploratory, n = 1 per condition (rescored after a fix to the evaluator's fixtures, see [PROTOCOL.md](PROTOCOL.md)):

| Condition (`opencode-go/hy4-flash-free`) | Held-out spec (`/48`) | Synergy (`/6`) | Integration loss | Merge conflicts | Wall-clock time |
|---|---|---|---|---|---|
| `sequential` | 48 / 48 (100.0%) | 6 / 6 | 0 | 0 / 6 | 13.3 min (1.0×) |
| `parallel-off` | 21 / 48 (43.8%) | 0 / 6 | 21 | 3 / 6 | 6.0 min |
| `parallel-fileleases` | 14 / 48 (29.2%) | 0 / 6 | 25 | 4 / 6 | 7.7 min |
| `parallel-integrator` | 48 / 48 (100.0%) | 6 / 6 | 0 | 0 / 6 (7th agent) | 11.7 min (1.13×) |
| **`parallel-concord` (`--regions`)** | **48 / 48 (100.0%)** | **6 / 6** | **0** | **0 / 6** | **6.0 min (2.20×)** |

## Conditions

| Condition | Description |
|---|---|
| `sequential` | Tickets implemented one after another on a single branch (quality & wall-clock baseline) |
| `parallel-off` | All agents in parallel in isolated git worktrees, uncoordinated `git merge` |
| `parallel-fileleases` | Exclusive whole-file locks (`--mode enforce --file-leases --no-contracts`) |
| `parallel-overlaps` | Advisory textual overlap warnings (`--mode enforce --overlap-warnings --no-contracts --no-gate`) |
| `parallel-integrator` | Like `parallel-off`, followed by an extra AI Integrator agent resolving conflicts & fixing regressions |
| `parallel-concord` | Concord contract notices + finish gate + peer merge (`--mode enforce --peer-merge`) |
| `parallel-regions` | Concord contract coherence + live region coherence + AST-verified insertion union (`--mode enforce --regions`) |
| `parallel-contracts`, `parallel-peeronly`, `parallel-allcontracts` | Controlled ablations of Concord's mechanisms |

**Metrics:** spec tests passed, strict compilation status, **integration loss** (tests passing on an agent's branch alone that fail after integration), cross-ticket synergy, merge conflicts, wall-clock speedup, token cost, and SASE Merge-Readiness Pack (`mrp.json`) readiness. Hypotheses and protocol are pre-registered in [PROTOCOL.md](PROTOCOL.md).

## Running

```bash
# Install Concord: https://github.com/lucas-rus/concord

# 1. Python CommonMark 0.31.2 benchmark (12 agents, 652 spec examples)
python3 -m venv .venv && .venv/bin/pip install pytest numpy scipy matplotlib
python3 bench/run.py --condition parallel-regions --agent-cli opencode \
    --model opencode-go/hy4-flash-free --runs 1 --python .venv/bin/python --out results/raw
.venv/bin/python bench/analyze.py results/raw/results.jsonl \
    --model opencode-go/hy4-flash-free --out results/report
python3 bench/evaluate.py projects/commonmark/scaffold

# 2. TypeScript Dispecerat benchmark (6 agents, 48 held-out spec & synergy tests)
(cd projects/dispecerat/scaffold && npm install)
python3 bench/run_dispecerat.py \
    --condition parallel-concord,parallel-off,parallel-fileleases,parallel-integrator \
    --agent-cli opencode --model opencode-go/hy4-flash-free --runs 1 --out results/dispecerat
python3 bench/evaluate_dispecerat.py --repo projects/dispecerat/scaffold
```

## License

- **Code & Dispecerat benchmark:** MIT.
- **CommonMark spec examples:** `projects/commonmark/spec.json` and `projects/commonmark/scaffold/tests/spec.json` are from the [CommonMark 0.31.2 specification](https://spec.commonmark.org/0.31.2/) by John MacFarlane, licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

# Evaluation protocol (pre-registered)

Written on 2026-11-23, **before** any data of the main study was collected. Changes after that date are listed at the end with their reason.

## Question

When a team of AI coding agents builds one project in parallel, how much of their work survives integration, and does Concord (live contract coordination plus peer merge) change that, compared with uncoordinated parallel agents and with doing the work sequentially?

## Task

A CommonMark 0.31.2 Markdown→HTML converter in Python (`projects/commonmark`).

- **Scaffold.** The scaffold provides the parsing architecture (block parser with open-block tree and block starts, inline parser with handler dispatch, renderer) and implements only paragraphs and soft line breaks. It passes 105 of the 652 spec examples.
- **Tickets.** 12 tickets (`projects/commonmark/tickets.json`) each ask for one or a few spec sections. They are written like ordinary issues. They contain no instructions about interfaces, other agents or coordination.
- **Judge.** The judge is the official spec example suite (652 examples, CommonMark project), not tests written by the experimenter. `bench/evaluate.py` runs it on a pristine copy of the examples, in a separate process, with a 2 s limit per example.

## Conditions

| condition | description |
|---|---|
| `sequential` | the 12 tickets one after another, one fresh agent per ticket, each starting from the previous result; no parallelism (quality reference) |
| `parallel-off` | 12 agents at once, isolated git worktrees, no coordination, merged at the end |
| `parallel-concord` | 12 agents at once, coordinated by Concord (contract notices, finish gate, peer merge) |
| `parallel-contracts` | ablation: Concord's contract layer only |
| `parallel-peeronly` | ablation: Concord's peer merge only |

All conditions use the same scaffold, tickets, agent harness and model. Every agent gets the same system note saying that other agents work on the repository at the same time; only Concord's mechanisms differ.

**Models.**
- Primary: `opencode/big-pickle` through OpenCode (free).
- Secondary: `claude-haiku-5-5` through Claude Code.

## Metrics (per run)

- **Primary: `passed`**, the spec examples passed by the integrated result (0-652).
- **Integration loss.** For each ticket, the examples of its own sections passed on the agent's own branch ("alone") minus on the integrated result ("together"), summed over tickets.
- **Merge conflicts.** The number of agent branches that could not be merged into the integration branch.
- **Wall time** of the run; **agent time** (sum over agents); **cost**; **turns**.
- **Concord activity**: notices, finish-gate blocks, merges, resumed agents.

## Validity

A run is **invalid** and repeated if any agent ended with a provider quota or rate-limit error (detected automatically, `quota_errors`). It is also invalid if the run itself failed (harness error). Invalid runs are reported, but not analysed.

## Hypotheses

- **H1 (coordination).** `parallel-concord` passes more spec examples than `parallel-off`.
- **H2 (lost work).** `parallel-concord` has a smaller integration loss than `parallel-off`.
- **H3 (speed).** `parallel-concord` has a shorter wall time than `sequential`.
- **H4 (quality relative to sequential, descriptive).** We report `passed(parallel-concord) / passed(sequential)`. There is no directional prediction.
- **Ablations (exploratory).** We report how much each mechanism (contracts, peer merge) contributes.

## Design and analysis

- **Pilot.** One run per condition with the primary model. The pilot checks the harness and measures time, cost and variance. Pilot runs are reported separately and not pooled.
- **Main study.** n = 5 valid runs per condition for `parallel-off`, `parallel-concord` and `sequential` (primary model); n = 3 for the ablations and the secondary model, as budget and quota allow.
- **Statistics.**
  - Per condition: mean, standard deviation and a bootstrap 95% CI (10,000 resamples) of each metric.
  - H1-H3: two-sided Mann-Whitney U tests on runs and Cliff's delta, at α = 0.05, with Holm correction across H1-H3.
  - Per-section pass rates are reported descriptively (heatmap).
- All runs are reported, including invalid ones. Each valid run's integrated code is published as a branch.

## Deviations from this protocol

(none yet)

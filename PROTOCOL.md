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
| `parallel-integrator` | like `parallel-off`, then one extra agent merges the conflicting branches and resolves the conflicts |
| `parallel-concord` | 12 agents at once, coordinated by Concord (contract notices, finish gate, peer merge) |
| `parallel-contracts` | ablation: Concord's contract layer only |
| `parallel-regions` | contract layer plus region coherence: textual overlaps detected after every edit, moved or handed off by rank; no peer merge |
| `parallel-peeronly` | ablation: Concord's peer merge only |

All conditions use the same scaffold, tickets, agent harness and model. Every agent gets the same system note saying that other agents work on the repository at the same time; only Concord's mechanisms differ.

**Models.**
- Primary: `opencode/big-pickle` through OpenCode (free).
- Secondary: `claude-haiku-5-5` through Claude Code.

## Metrics (per run)

- **Primary: `passed`**, the spec examples passed by the integrated result (0-652).
- **Integration loss.** For each ticket, the examples of its own sections that pass on the agent's own branch ("alone") but are lost on the integrated result ("together"): `max(0, alone - together)`, summed over tickets. The net difference `alone - together` (without the clamp) is reported as `integration_net`, descriptively.
- **Merge conflicts.** The number of agent branches that could not be merged into the integration branch.
- **Wall time** of the run, from the start of the first agent to the integrated result, without the time spent scoring branches; **agent time** (sum over agents); **cost**; **turns**.
- **Concord activity**: notices, finish-gate blocks, merges, resumed agents.

## Validity

A run is **invalid** and repeated if any agent ended with a provider quota or rate-limit error (detected automatically, `quota_errors`). It is also invalid if the run itself failed or an agent never started (harness errors, `start_failures`). Invalid runs are reported, but not analysed.

## Hypotheses

- **H1 (coordination).** `parallel-concord` passes more spec examples than `parallel-off`.
- **H2 (lost work).** `parallel-concord` has a smaller integration loss than `parallel-off`.
- **H3 (speed).** `parallel-concord` has a shorter wall time than `sequential`.
- **H5 (against an integrator).** `parallel-concord` passes more spec examples than `parallel-integrator`.
- **H4 (quality relative to sequential, descriptive).** We report `passed(parallel-concord) / passed(sequential)`. There is no directional prediction.
- **Ablations (exploratory).** We report how much each mechanism (contracts, peer merge) contributes.

## Design and analysis

- **Pilot.** One run per condition with the primary model. The pilot checks the harness and measures time, cost and variance. Pilot runs are reported separately and not pooled.
- **Main study.** n = 5 valid runs per condition for `parallel-off`, `parallel-integrator`, `parallel-concord` and `sequential` (primary model); n = 3 for the ablations and the secondary model, as budget and quota allow.
- **Statistics.**
  - Per condition: mean, standard deviation and a bootstrap 95% CI (10,000 resamples) of each metric.
  - H1-H3 and H5: two-sided Mann-Whitney U tests on runs and Cliff's delta, at α = 0.05, with Holm correction across H1-H3 and H5.
  - Per-section pass rates are reported descriptively (heatmap).
- All runs are reported, including invalid ones. Each valid run's integrated code is published as a branch.

## Deviations from this protocol

(none yet)

## Amendments

- **2026-11-23, after the first pilot run, before the main study.** Integration loss was first defined as the net sum of `alone - together`. The pilot showed that tickets gain from each other in the integrated result (for example, emphasis passed 40 examples alone and 132 together once code spans and links were merged). The net sum therefore lets these gains cancel out real losses, and it was -157 in the pilot. H2 now uses losses only, clamped per ticket, as defined above; the net sum is kept as `integration_net`. No main-study run had been made when this change was made.
- **2026-11-23, after pilot run 2 (`parallel-off`), before the main study.** Added the condition `parallel-integrator` and hypothesis H5. In `parallel-off`, branches that conflict are dropped, which no real team would do. In `parallel-integrator`, one extra agent (same model) merges those branches after the team has finished and resolves the conflicts. This is the realistic workflow without Concord and a stronger baseline. Its wall time includes the integrator. `merge_conflicts` counts the team's conflicts; `unmerged_after_integrator` lists the branches the integrator still did not merge.
- **2026-11-23, after pilot run 2.** The first `parallel-concord` pilot run turned out to be invalid: 4 of its 12 agents (emphasis, code-blocks, code-spans, raw-html-breaks) never started, because OpenCode's local server failed to start ("Standalone server exited before reporting readiness"). Their tickets were done in part by other agents, and the run still reached 554/652, but it does not measure the intended condition. From now on, a run in which an agent never started is invalid (`start_failures`). Concord now retries the start of an OpenCode turn when its server fails to start (concord commit after 31c7432). The pilot run is reported but not analysed.
- **2026-11-23, after pilot run 2.** Wall time no longer includes the scoring of each agent's branch, which the harness does in between and which is not development time (about 11 minutes in the first `parallel-concord` pilot run).
- **2026-11-23, after the pilot.** Added `parallel-regions` (Concord's contract layer plus region coherence, see concord `docs/research/region-coherence.md`). It is exploratory: no confirmatory hypothesis until its pilot run is reported.

- **2026-11-24, during the Haiku pilot.** The free Big Pickle quota ran out, so the pilot continued with Claude Haiku (`claude-haiku-5-5`, Claude Code, $1.00 budget per agent). Four Haiku runs (`parallel-off` 1, `parallel-integrator` 1, `sequential` 1, `parallel-regions` 2) ran into the Claude plan's 5-hour usage limit ("You've hit your 5-hour limit"), which the quota check did not recognise, so they were wrongly marked valid. They are now marked invalid and rerun. The quota markers now include this message, and a Claude Code result that ended in an API error before any cost counts as a provider failure. `parallel-regions` run 2 uses a later Concord build than run 1 (hand-offs batched and not counted toward the gate block limit).
- **2026-11-24, after the Haiku pilot, before any main-study run.** Plan of the main study, fixed before its first run:
  - **Model.** `claude-haiku-5-5` through Claude Code becomes the primary model, with a $1.00 budget per agent. The free Big Pickle quota is exhausted, and its runs were unstable (start failures, quota). Big Pickle results stay as a pilot.
  - **Concord configuration under test.** H1–H3 and H5 are tested for `parallel-regions`, which is Concord's contract layer plus region coherence, frozen at concord commit 6cf1545 (see the next amendment). Changing anything in Concord after this point voids the main study.
    - Reason: the pilot showed that region coherence removes merge conflicts without peer merge, and it is the method the thesis proposes.
    - Region coherence is tested in place of `parallel-concord`, not in addition to it. With n = 5 against 5, the smallest two-sided Mann-Whitney p is 0.0079, so Holm over more than 6 hypotheses could never reject.
    - `parallel-concord` (contracts plus peer merge) is reported descriptively, with n = 3.
  - **Conditions and n.** n = 5 valid runs each for `sequential`, `parallel-off`, `parallel-integrator` and `parallel-regions`; n = 3 for `parallel-concord`. Runs are numbered from 11.
  - **Order.** Runs are interleaved by replicate, one run of every condition per round. Time-of-day and provider effects then spread evenly over conditions.
  - **Cost** (USD, from the agents' reported usage) becomes a reported metric. It is descriptive, with no hypothesis.
  - **Usage limits.** A run that hits the Claude plan's usage limit is invalid and repeated after a pause.
  - **Pilot** (one run each, Haiku, before this amendment), reported separately:
    - `sequential`: 652, 25.3 min, $0.54;
    - `parallel-off`: 151, 4.8 min, $0.85;
    - `parallel-integrator`: 649, 12.8 min, $1.89;
    - `parallel-concord`: 650, 11.2 min, $4.70;
    - `parallel-regions`, three builds as the method was being fixed: 567 (8.5 min, $2.49), 644 (10.5 min, $2.83), 621 (8.1 min, $2.98).
- **2026-11-24, before any main-study run.** The validation run of commit d0c2f20 (`parallel-regions` pilot run 4: 598/652, 0 conflicts, \$2.99) showed one more flaw. Eleven agents added methods to the same class; the last-ranked agent kept moving its methods away from other agents' insertion points until none was left, and finished at the block limit. Insert/insert collisions are now combined by a union hand-off (concord commit 6cf1545), which is the build frozen for the main study. One more pilot run (run 5) validates it before the main study starts.
- **2026-11-24, before any main-study run: model switch to OpenCode Go.** Claude models are no longer used for testing.
  - **Primary model:** `opencode-go/hy4-flash-free` through OpenCode, chosen by a two-ticket smoke run (`parallel-regions`, links and images-autolinks): Hy4 Flash Free reached 225/652 with no agent error; Muse Spark 1.3 reached 181/652 with one agent error. Both runs were valid, with 0 conflicts.
  - **Cost** is $0 under the subscription. Cost is therefore not reported for this model; tokens and turns are reported instead.
  - **Hy4 Flash Free is offered for a limited time.** If it is withdrawn or changed before the main study is complete, the main study is repeated in full with `opencode-go/deepseek-v4.1-flash`. Runs of the two models are never pooled.
  - **Design:** everything else follows the amendment above. Concord is frozen at commit 6cf1545. The pilot has one run per condition, numbered 1. The main study has n = 5 per condition (`parallel-concord` n = 3), runs 11–15, interleaved by round. It starts only if every pilot condition produced a valid run.
  - **Earlier pilots** (Big Pickle, Haiku) are reported as pilots of earlier builds.
- **2026-11-24, during the Hy4 pilot, before any main-study run.** The first Hy4 pilot run of `parallel-regions` (concord 6cf1545) was cut short when the machine's disk filled up. It is invalid. Its event log still showed a livelock in the finish gate:
  - Agent `lists` (higher rank) waited for `blockquotes`, so by the rank rule `blockquotes` did not wait for `lists`' contract change.
  - The call sites of `blockquotes` already conformed, but the gate still required `lists`' code to be merged, which cannot happen while `lists` runs.
  - So every finish attempt of `blockquotes` was blocked at once (5 blocks in 3.5 minutes) until the block limit.

  Fix (concord df97d18): contracts whose producer is still running, and which the agent's own call sites already satisfy, are acknowledged when the agent cannot wait. That build (`target/oc10`) is now frozen for the main study; it also contains `concord watch`, a read-only viewer. The pilot restarts from its first condition.
- **2026-11-24, during the Hy4 pilot, before any main-study run: insert-only collisions are combined at integration.** In the restarted pilot run of `parallel-regions` (concord df97d18), the first 20 minutes showed:
  - agents sat idle for 1,248 agent-seconds waiting for owners with whom they shared only insert-only collisions (two insertions at the same point);
  - that is nearly half of all finish-gate waiting, plus a re-test turn after each hand-off.

  Such additions commute (Apel), so in concord 34f894e region coherence no longer coordinates them. Instead, integration merges a branch with a union merge when every conflicting hunk is a pure insertion at the same point, and records it in the run report as `integration.unions`.
  - The union step is enabled only with `--regions`, because it relies on region coherence's classification. Part of `parallel-regions`' advantage over the other conditions can therefore come from integration. `integration.unions` is reported per run so this part can be quantified.
  - Build frozen for the main study: concord 34f894e (`target/oc11`). It also contains the TypeScript front-end and the opt-in fails-together check; neither is active in this benchmark (Python project, no `--fails-together`).
  - The pilot restarts from its first condition. The interrupted run is discarded.
- **2026-11-24, during the Hy4 pilot, before any main-study run: resume pass.** The pilot run of `parallel-regions` on concord 34f894e had all 12 agents finished by minute 24. Then the resume pass resumed finished agents in two rounds, mostly for contracts that their own call sites already satisfied. The run went past 40 minutes and ended in merge and region conflicts. It was stopped and is discarded.
  - Fix (concord 14fdc37): a finished agent is resumed only if its own call sites violate a changed contract.
  - That build (`target/oc12`) is frozen for the main study. The pilot restarts from its first condition. All pilot and main-study runs, including the baselines, use this one build.

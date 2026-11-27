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
- **2026-11-24, during the Hy4 pilot: network failures make a run invalid.** The `parallel-integrator` pilot run reached 0/652. Its integrator agent had worked for 76 minutes, then failed on a network error ("getaddrinfo ENOTFOUND opencode.ai"), leaving the merge half-done. The quota check did not recognise this message, so the run was wrongly marked valid.
  - Network and transport failures between an agent and its provider are not outcomes of a condition. They now make a run invalid, like quota errors; the markers include `provider.transport`, `ENOTFOUND`, `ECONNRESET`, `ETIMEDOUT` and `fetch failed`.
  - The run is marked invalid and repeated.
  - The queue now decides whether a run is valid from `results.jsonl`, not from the log line.
- **2026-11-24, after the first valid Hy4 pilot run, before any main-study run: acceptance check for every condition.** The valid `parallel-regions` pilot run reached 633/652 with 0 conflicts. All 19 missing examples were in the agents' own tickets: link-refs 14/27, links 85/90, lists 73/74. None was lost at integration.
  - Every ticket now carries an acceptance check: the spec examples of its own sections, the same command its prompt tells the agent to run. Concord's finish gate (concord c2069f5) runs it before the agent may finish.
  - If the check fails and the agent is making progress (the first failure, or fewer failures than at the last attempt), the agent is sent back with the failing examples, at most 3 times. Failures that stop shrinking are taken to be out of the agent's reach, for example examples that depend on another ticket.
  - **The check applies to every condition**: sequential, `parallel-off`, `parallel-integrator`, `parallel-regions` and `parallel-concord`. In the conditions without coordination it is the only part of the gate that is active. Conditions therefore still differ only in coordination. The integrator agent has no check.
  - The number of check blocks is reported per run (`check_blocks`).
  - Frozen build: concord c2069f5 (`target/oc13`).
  - The pilot restarts in a new directory (`hy4c`). Earlier Hy4 pilot runs, without the check, are reported as pilots of an earlier design.
- **2026-11-24, during the Hy4 pilot (with acceptance check), before any main-study run: union bug.** The `parallel-regions` pilot run on concord c2069f5 reached 0/652 with 0 conflicts.
  - Cause: `git merge-file --union` aligned identical lines inside two class insertions and interleaved them, which broke the syntax of `blocks.py` at integration.
  - Fix (concord 78c185b): each insertion is kept whole, and the combined file must parse, or the branch counts as a conflict. Replayed on the failing merge, the new union parses.
  - The run is marked invalid (a Concord bug, not an outcome) and repeated. Frozen build: concord 78c185b (`target/oc14`).
  - The `parallel-integrator` pilot run that was in progress on c2069f5 is kept. The changed code runs only with `--regions`, so its behaviour is identical in the integrator condition.
- **2026-11-24, during the Hy4 pilot, before any main-study run: network robustness.**
  - The machine's connection to the model provider failed twice within two hours with `getaddrinfo ENOTFOUND opencode.ai`, each time ending one agent of a 12-agent run.
  - **Concord fix (concord 268c159):** when an OpenCode turn ends on a network or transport error, the runner waits and resumes the same session, up to 5 times. The resumes are logged (`transport_retry`). This applies to every condition, because it is part of the agent runner, not of coordination.
  - **Validity, refined:** only a *terminal* provider error makes a run invalid, meaning one after which the agent made no more progress. OpenCode itself retries dropped connections, and an agent that kept working afterwards was not stopped by the error.
  - Frozen build: concord 268c159 (`target/oc15`). The interrupted `parallel-integrator` pilot run, which lost its `lists` agent to a DNS failure, is invalid and repeated.
- **2026-11-24, during the Hy4 pilot, before any main-study run: union of insertions, redesigned.** The `parallel-regions` pilot run on concord 268c159 reached 461/652, with 3 branches in conflict at integration.
  - Cause: code handed over to yielders during the run reached the integration branch by two paths, placed differently. A union computed at integration then either refused the merge or would have duplicated methods.
  - Redesign (concord c608044): git performs the merge, with patience alignment and diff3 markers. Only conflict blocks with an empty base are combined, both kept whole and identical blocks once. The result must parse and must not add duplicate definitions.
  - The union now happens when the second of two colliding agents finishes, in its own worktree, with the earlier finisher's code first. The agent tests the combined code, and its branch then contains the earlier one, so integration is clean. Nobody waits for running agents.
  - The run is invalid (a Concord bug) and repeated. Frozen build: concord c608044 (`target/oc16`). The `parallel-integrator` pilot run in progress on 268c159 is kept: the changed code runs only with `--regions`.
  - Note: the `parallel-integrator` pilot run's integrator step runs on the c608044 binary, because the 268c159 binary was removed by mistake during the run's team phase. The two builds are identical outside `--regions`.
- **2026-11-25, before the main study is run again: freeze concord f83c2ba.**
  - The main study started on concord c608044 (`hy4c`, run 11: `parallel-regions` 637/652, 50.7 min, 4 conflicts, 9 agents let through at the gate block limit). Its queue then stopped at 02:43 when the machine's processes ended.
  - Since then, Concord gained region-coherence fixes, more languages and tooling (concord 9a545e7 to f83c2ba). One exploratory run on that newer code (`hy4-v3`) reached 652/652 in 31.7 min.
  - **The main study is restarted from scratch on concord f83c2ba** (`target/main-f83c2ba`), in a new directory (`hy4m`): n = 5 runs each of `parallel-regions`, `parallel-integrator`, `sequential` and `parallel-off`, and n = 3 of `parallel-concord`. Runs are numbered 11–15 and interleaved by round. The model, harness, acceptance check, validity rules, hypotheses and statistics are unchanged.
  - Earlier runs, the `hy4c` pilot and its run 11, and `hy4-v3`, are reported as pilots of earlier builds and are not pooled.
  - The README result tables will be replaced by the main study's results. The CommonMark baseline figures they show now (`parallel-off` 374/652 in 29.0 min, `parallel-integrator` 643/652 in 56.3 min, `sequential` 645/652) match no recorded run. The recorded pilot runs (`hy4c`) are: `sequential` 652/652 in 157.1 min; `parallel-integrator` 652/652 in 31.5 min; `parallel-off` 163/652 in 10.7 min.
  - TypeScript `dispecerat` (exploratory, n = 1): the results were rescored after a fix to the evaluator's client-key fixtures (`results_rescored.jsonl`). Before the fix, `parallel-concord`, `parallel-integrator` and `sequential` each scored 45/48; after it, 48/48.
- **2026-11-25, main study, after its first run: freeze concord 4c1ccab.** concord f83c2ba exited with an error whenever a run's (only) wave ended with merge conflicts ("stopping before next wave"), so every `parallel-integrator` and `parallel-off` run failed. Concord 4c1ccab stops only when another wave follows. The fix changes nothing about agents or coordination: it affects only the exit of `concord run` after integration when there are conflicts. The main study continues on concord 4c1ccab (`target/main-4c1ccab`), and its first run (`parallel-regions` 11: 652/652, 28.6 min, 0 conflicts) is kept.
- **2026-11-26, during the main study, before any DeepSeek run: replication on a second model.** After the Hy4 main study, the study is repeated with `opencode-go/deepseek-v4.1-flash`, to test whether the results depend on the model.
  - Same frozen build (concord 4c1ccab), benchmark, harness, acceptance check, validity rules, hypotheses and statistics.
  - n = 3 runs each of `parallel-regions`, `parallel-integrator`, `sequential`, `parallel-off` and `parallel-concord`, numbered 11–13 and interleaved by round, in a new directory (`dsm`).
  - The two models are analysed and reported separately and never pooled. With n = 3 per condition, the replication can show whether the direction of each effect holds; it is not powered for significance on its own.
  - It starts only when the Hy4 main study has finished, so that the two never run at the same time.
- **2026-11-26, main study, round 2: freeze concord 5c84165 for the Concord conditions.** `parallel-regions` run 12 reached 647/652 with no integration loss. The 5 missing examples (Links 517 and 531, Lists 308 and 309, Entities 33) each need two tickets' features together. Concord's repair pass after integration should have sent their tickets back. It resumed at most the first four tickets of its initial failing list and never re-evaluated it, so the tickets still failing after the first repair (headings) were skipped. That is a Concord bug, not an outcome.
  - Fix (concord 5c84165): up to 3 repair rounds. Each round re-evaluates every ticket's check on the integrated tree and resumes every failing ticket at once (at most 2 resumes per ticket). The repairs are merged back one by one, and each is kept only if the total failures shrink. An end-to-end test reproduces the old behaviour and passes with the fix.
  - The pass runs only with `--mode enforce`, so `sequential`, `parallel-off` and `parallel-integrator` (`--mode off`) execute identical code on both builds. Their runs are kept.
  - **All Concord runs restart on concord 5c84165** (`target/main-5c84165`): `parallel-regions` runs 11 and 12 and `parallel-concord` run 11 on 4c1ccab are superseded (`superseded-4c1ccab-*`, `results-superseded-4c1ccab.jsonl`) and reported as such: regions 652/652 in 28.6 min and 647/652 in 24.6 min; concord 652/652 in 33.8 min. The design (n, rounds 11–15, hypotheses, statistics) is unchanged.
  - The DeepSeek replication, which has no runs yet, uses concord 5c84165 as well.
- **2026-11-26, main study, round 3: freeze concord 230c827.** `parallel-regions` run 13 on concord 5c84165 hung. Its `code-blocks` agent was held 6 times at the finish gate over an overlap with `lists` and ran out of OpenCode turns (a fixed 10) before the gate's own block limit could let it through. Its process ended, but Concord still counted it as running, so `escapes-entities` waited for it as a region owner for over 24 minutes and kept being held. This is a Concord liveness bug, not an outcome. The run is invalid (`invalid-concordbug-*`) and repeated.
  - Fix (concord 230c827): an agent whose process ends without passing the gate is marked as exited. Nobody waits for it, and its work is handed over like a finished agent's. OpenCode agents get enough turns for every block the gate may give (1 + gate blocks + check blocks + one hand-off per peer). A regression test covers the exited owner.
  - The completed Concord runs on 5c84165 (`parallel-regions` 11 and 12, `parallel-concord` 11 and 12) are kept. None had an agent that exited without finishing, and none used more than 8 OpenCode turns, so the changed code paths never ran in them: they execute identically on 230c827. The other changes between the two builds affect only `concord watch` and the error label in reports. The baseline conditions are unaffected as before.
  - The remaining runs, and the DeepSeek replication, use concord 230c827.
- **2026-11-26, DeepSeek replication: machine sleep.** The Mac slept from 14:32 to 16:32 (`pmset -g log`), during the first attempt of `parallel-off` run 11. Agents' requests failed at each brief wake. The attempt is invalid as a harness failure (`invalid-retry1-*`) and repeated. No other run of the main study or the replication overlapped a sleep: the log shows none between the start of the main study and 14:32. From now on, a run is invalid if the machine slept at any time during it (checked against `pmset -g log`).
- **2026-11-26, before any run with it: pilot of the lean gate (exploratory).** Measured on the main study's `parallel-regions` runs (Hy4, n = 5): turns after a finish-gate block were 34% of tokens. Hand-off turns cost 13.8M tokens per run; acceptance-check retries cost 7.5M, and 60 of 67 retries made no progress. The lean gate (concord b7edc12, `--lean`) verifies a hand-off by running the agent's acceptance check before and after the merge, and gives the agent a turn only if the merge broke a test or the agent yielded lines it may have to rewrite. The check sends an agent back at most once, and the repair pass after integration covers the rest.
  - Pilot: condition `parallel-regions-lean`, `opencode-go/hy4-flash-free`, n = 3 (runs 11–13), started only after the DeepSeek replication has finished, in a new directory (`hy4-lean`).
  - **Correctness gate:** the lean gate is kept only if every pilot run passes 652/652 with 0 merge conflicts. Otherwise it is reverted, and the failure is reported.
  - Outcomes (descriptive): tokens and list-price cost per run (`bench/tokens.py`), wall time, and the number of gate turns, compared with the main study's `parallel-regions` and `parallel-integrator`. The target is the integrator's tokens per run or fewer. If the pilot passes the gate, a confirmatory comparison is pre-registered before it runs.
- **2026-11-26, pilots of the lean gate: order and a second variant (exploratory).** The DeepSeek replication pauses after round 2's integrator run so the lean pilots can run first; it then resumes where it stopped (`dsm/log` records the pause).
  - The first attempt of lean run 11 coincided with a 2-minute internet outage (14 network resumes). It passed 652/652 with 0 conflicts, using 59.5M tokens ($0.40 at list price), but it took 35.3 min. Its terminal-error count made it invalid, and it is repeated.
  - Its timeline shows a wait chain at the end: five agents finished one after another, from minute 25 to minute 35. Each had waited at its finish gate for an owner that was itself only waiting at its own gate.
  - Second variant, concord 1f63d94 (`--lean` with early release): an owner waiting at its own finish gate releases its regions to the agents waiting on it at once.
  - Pilot 2: n = 3 (`hy4-lean2`), run after pilot 1, with the same correctness gate (every run 652/652 with 0 conflicts, or the change is reverted) and the same outcomes.
- **2026-11-26, pilot 2 (early release): stopped and reverted.** In its first run, `code-spans`, released while waiting at its gate, was sent back and changed the released lines in `render.py` again. `code-blocks` had already combined them and finished, so `code-spans` could not reconcile and was let through at the block limit with the overlap unresolved. This never happened in the 8 earlier region runs (main study and lean pilot). A waiting agent is not done with its lines, so the assumption behind early release is false. Early release is reverted (concord 21f5e70), and the pilot stops after this run. Its result is recorded for the report but not used for the lean gate. The lean gate without early release (pilot 1) passed its correctness gate: 3 of 3 runs 652/652 with 0 conflicts, 62.5M tokens per run against the integrator's 66.4M. Its wall time is confounded by a slower provider during the pilot, so time is to be compared only in interleaved runs.
- **2026-11-26, before any run: efficiency benchmark (pre-registered).** Concord a4cc59f adds three general mechanisms, none specific to this benchmark:
  - **Output trimming** (`--trim-outputs`, OpenCode agents): outputs of commands, web pages and searches above 8,000 / 6,000 characters keep their head and tail in the context; the full output is saved to a file.
  - **Hand-offs after a yield** show the agent the diff it gave up.
  - **`--lean` waits at the finish gate** for a live owner instead of giving the waiting agent a turn every 5 minutes.
  - Conditions, interleaved in 3 rounds (runs 11–13), `opencode-go/hy4-flash-free`, n = 3 each, directory `hy4-eff`:
    - `parallel-regions-efficient` (`--regions --lean --trim-outputs`);
    - `parallel-regions` (base Concord, same build);
    - `parallel-integrator`;
    - `parallel-integrator-trim` (the integrator with output trimming, to separate the effect of trimming from that of coordination).
  - Correctness gate as before: every `parallel-regions-efficient` run must pass 652/652 with 0 merge conflicts, or the mechanisms are reverted.
  - Outcomes: wall time, tokens and list-price cost per run (`bench/tokens.py`), examples passed, conflicts. Comparisons: `parallel-regions-efficient` vs `parallel-integrator` and vs `parallel-regions` on wall time and tokens (Mann–Whitney U, Cliff's δ; with n = 3 the minimum two-sided p is 0.10, so the comparisons are reported as effect sizes and are descriptive).
  - Starts after the DeepSeek replication, or earlier if prioritized.
- **2026-11-26, 21:28: reprioritized.** The DeepSeek replication is paused: round 2's `sequential` run was stopped and will be repeated. The efficiency benchmark is postponed. First comes an exploratory pilot (`hy4-effpilot`, concord a4cc59f) alternating `parallel-regions-efficient` and `parallel-regions` for 2 rounds, to test and improve the efficiency mechanisms before any benchmark run. The pre-registered efficiency benchmark keeps its design and is re-registered with the final build before it runs.
- **2026-11-27, 02:03: efficiency pilot on 196d7a0 stopped; long lean waits and yield-diff reverted (concord 49bfec3).** In `hy4-effpilot` run 11 on concord 196d7a0, `emphasis` hit the 6-block limit on `render.py` with 3 hand-off merge conflicts and 11 region conflicts (versus 0 in all 8 earlier region/lean runs). Both the 30-min lean wait (`LEAN_MAX_WAIT`) and the yield-diff hand-off text were reverted in concord 49bfec3, keeping the proven `--lean` gate and `--trim-outputs`. The exploratory pilot restarts (`effpilot4.sh`, `target/eff-49bfec3`) interleaving `parallel-regions-efficient` (`--regions --lean --trim-outputs`), `parallel-integrator`, and `parallel-regions` under `caffeinate -i`.

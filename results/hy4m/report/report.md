# Results (opencode-go/hy4-flash-free)

Runs: 24 total, 23 valid, 1 invalid (quota or harness errors, not analysed).

| condition | n | spec examples passed (of 652) | integration loss (examples) | merge conflicts (agents) | wall time (min) | cost (USD) |
|---|---|---|---|---|---|---|
| sequential | 5 | 651.2 ± 0.8 [650.6, 651.8] | 0.0 ± 0.0 [0.0, 0.0] | 0.0 ± 0.0 [0.0, 0.0] | 65.1 ± 5.9 [60.6, 69.6] | 0.0 ± 0.0 [0.0, 0.0] |
| parallel-off | 5 | 199.0 ± 30.1 [175.8, 222.0] | 301.8 ± 45.8 [264.0, 336.2] | 9.0 ± 1.4 [7.8, 10.0] | 13.7 ± 1.9 [12.2, 15.2] | 0.0 ± 0.0 [0.0, 0.0] |
| parallel-integrator | 5 | 652.0 ± 0.0 [652.0, 652.0] | 0.0 ± 0.0 [0.0, 0.0] | 9.4 ± 1.1 [8.6, 10.4] | 34.2 ± 4.8 [30.0, 37.4] | 0.0 ± 0.0 [0.0, 0.0] |
| parallel-regions | 5 | 652.0 ± 0.0 [652.0, 652.0] | 0.0 ± 0.0 [0.0, 0.0] | 0.0 ± 0.0 [0.0, 0.0] | 20.8 ± 1.9 [19.2, 22.3] | 0.0 ± 0.0 [0.0, 0.0] |
| parallel-concord | 3 | 652.0 ± 0.0 [652.0, 652.0] | 0.0 ± 0.0 [0.0, 0.0] | 0.0 ± 0.0 [0.0, 0.0] | 27.1 ± 3.5 [23.2, 30.0] | 0.0 ± 0.0 [0.0, 0.0] |

Cells: mean ± SD [bootstrap 95% CI of the mean].

| hypothesis | comparison | means | Cliff's δ | p (MWU) | p (Holm) |
|---|---|---|---|---|---|
| H1: more spec examples passed | passed: parallel-regions vs parallel-off | 652.0 vs 199.0 | +1.00 | 0.0075 | 0.0300 |
| H2: smaller integration loss | integration_loss: parallel-regions vs parallel-off | 0.0 vs 301.8 | -1.00 | 0.0075 | 0.0300 |
| H3: shorter wall time | wall_min: parallel-regions vs sequential | 20.8 vs 65.1 | -1.00 | 0.0079 | 0.0300 |
| H5: more spec examples passed than with an integrator | passed: parallel-regions vs parallel-integrator | 652.0 vs 652.0 | +0.00 | nan | 1.0000 |

H4 (descriptive): parallel-regions reaches **100%** of sequential quality, **3.1×** faster.

H4 (descriptive): parallel-concord reaches **100%** of sequential quality, **2.4×** faster.

## Pass rate per spec section (mean over valid runs)

| section | examples | sequential | parallel-off | parallel-integrator | parallel-regions | parallel-concord |
|---|---|---|---|---|---|---|
| Tabs | 11 | 98% | 15% | 100% | 100% | 100% |
| Backslash escapes | 13 | 100% | 29% | 100% | 100% | 100% |
| Entity and numeric character references | 17 | 100% | 35% | 100% | 100% | 100% |
| Precedence | 1 | 100% | 0% | 100% | 100% | 100% |
| Thematic breaks | 19 | 100% | 64% | 100% | 100% | 100% |
| ATX headings | 18 | 100% | 73% | 100% | 100% | 100% |
| Setext headings | 27 | 100% | 55% | 100% | 100% | 100% |
| Indented code blocks | 12 | 100% | 8% | 100% | 100% | 100% |
| Fenced code blocks | 29 | 100% | 2% | 100% | 100% | 100% |
| HTML blocks | 44 | 99% | 0% | 100% | 100% | 100% |
| Link reference definitions | 27 | 100% | 59% | 100% | 100% | 100% |
| Paragraphs | 8 | 100% | 78% | 100% | 100% | 100% |
| Blank lines | 1 | 100% | 80% | 100% | 100% | 100% |
| Block quotes | 25 | 100% | 41% | 100% | 100% | 100% |
| List items | 48 | 100% | 10% | 100% | 100% | 100% |
| Lists | 26 | 100% | 4% | 100% | 100% | 100% |
| Inlines | 1 | 100% | 20% | 100% | 100% | 100% |
| Code spans | 22 | 100% | 26% | 100% | 100% | 100% |
| Emphasis and strong emphasis | 132 | 100% | 31% | 100% | 100% | 100% |
| Links | 90 | 100% | 33% | 100% | 100% | 100% |
| Images | 22 | 100% | 9% | 100% | 100% | 100% |
| Autolinks | 19 | 100% | 41% | 100% | 100% | 100% |
| Raw HTML | 20 | 100% | 47% | 100% | 100% | 100% |
| Hard line breaks | 15 | 100% | 39% | 100% | 100% | 100% |
| Soft line breaks | 2 | 100% | 100% | 100% | 100% | 100% |
| Textual content | 3 | 100% | 100% | 100% | 100% | 100% |

# 1995 baseline soak (D1053 decision 5, D1056; re-recorded for D1057 to D1062)

The first baseline of the 1995 world as it now plays: Coarse fidelity, cut to the USA (D1034, D1038),
with the M2 politics. First recorded with the Electron close-out soaks on 2026-11-20 (D1056) and
accepted by Logan; re-recorded 2026-11-23 on branch `claude/game-political-system-status-8db7c5`
(44c96c6 with D1057 to D1062: the fatigue on the presidency only, company shocks and the entries
bands scaled to the cut, hidden data at the source, the greedy district drawer and D1062's
shortcuts, among them the run-rate consensus), on Logan's PC (Windows 11, Node 24 via tsx):

```
corepack pnpm@10.20.0 headless calibrate --world 1995 --seeds 1..50 --jobs 4 --out DIR
node scripts/ts/rust-reference-bands.ts DIR/<scenario> --source "..."   # bands.json
```

- One folder per scenario (stable, unstable, stagnation): 50 seeds each, 25 years (1995 to 2020).
- About 400 s wall per scenario with 4 workers; a seed takes 25 to 39 s (median about 31 s).
- No seed failed.

It is not the parity default yet. `headless parity` still compares with `test/fixtures/ts-soak/`,
the frozen test world's baseline, and it reads `summary.csv`, which an era world's soak does not
write. This one becomes the default once the 1995 economy settles (D1053) and parity learns to read an
era folder (`era-targets.csv`, `bands.json`).

## The 1995 targets (`headless check DIR`, 1995-rework 4.3)

| Scenario | Met | Missed (seeds of 50) | First baseline (D1056) |
|---|---|---|---|
| stable | 678 of 700 | `entries` 11 (32 to 92, median 52; at least 46), `failures` 5 (5 to 20, median 13; at least 8), `house_changes` 4, `gdp_2020_usd`, `tech_share` 1 each | 592 |
| unstable | 686 of 700 | `end_rate` 4, `failures` 4 (10 to 35, median 20; at least 12), `gdp_2020_usd` 2, `max_drawdown` 2, `entries` 1 (24 to 76, median 46; at least 26), `house_changes` 1 | 597 |
| stagnation | 693 of 700 | `house_changes` 5, `failures` 2 (6 to 19, median 13; at least 8). `entries` -1 to 24, at most 36, all met | 647 |

In the first baseline `entries` and `failures` missed in nearly every seed: both were set for the
whole world, and the cut simulates only American companies (D1038). D1059 scales `entries` (a net
count) to the cut, and gives American firms a way to fail, company shocks (`finance/shock.ts`):
without them 161 of 181 American firms in a stable run never posted a losing quarter.

| File | What |
|---|---|
| `era.csv` | One row per seed and year: the era metrics (`apps/headless/src/metrics.ts` `ERA_HEADER`) |
| `era-targets.csv` | Each 1995 target per seed: the value, the bound, MET or MISSED |
| `run.json` | The scenario |
| `years.csv` | One row per seed and year: the soak's yearly metrics |
| `bands.json` | Per year and metric, p10, p50 and p90 across seeds |
| `timing.csv`, `shares_out.csv` | Wall time per seed (not a gate); the largest share count per seed |

`quarters.csv` is not committed (0.6 MB a scenario, and nothing reads it); the command above writes it.

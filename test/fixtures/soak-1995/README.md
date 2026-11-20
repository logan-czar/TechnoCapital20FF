# 1995 baseline soak (D1053 decision 5, D1056)

The first baseline of the 1995 world as it now plays: Coarse fidelity, cut to the USA (D1034, D1038),
with the M2 politics. Recorded with the Electron close-out soaks on 2026-11-20, on branch
`claude/electron-transfer-political-sim-6b8104` at 1c05d7b, on Logan's PC (Windows 11, Node 24 via tsx):

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

| Scenario | Met | Missed in most seeds | Missed in a few |
|---|---|---|---|
| stable | 592 of 700 | `entries` 50 of 50 (42 to 91, median 61; band at least 150), `failures` 50 of 50 (0 to 5, median 3; at least 8) | `house_changes` 5, `gdp_2020_usd`, `tech_share`, `top10_born` 1 each |
| unstable | 597 of 700 | `entries` 50 of 50 (37 to 85, median 57; at least 100), `failures` 45 of 50 (1 to 15, median 5; at least 12) | `end_rate` 4, `gdp_2020_usd` 2, `max_drawdown` 2 |
| stagnation | 647 of 700 | `failures` 50 of 50 (0 to 5, median 2; at least 8) | `house_changes` 3 |

`entries` and `failures` were set for the whole world. The cut world simulates only American
companies and scales its startups to the USA's share (D1038), so both fall short in nearly every
seed. That is the USA cut's economy tuning (pivot-handoff.md, B), not a defect of this run.

| File | What |
|---|---|
| `era.csv` | One row per seed and year: the era metrics (`apps/headless/src/metrics.ts` `ERA_HEADER`) |
| `era-targets.csv` | Each 1995 target per seed: the value, the bound, MET or MISSED |
| `run.json` | The scenario |
| `years.csv` | One row per seed and year: the soak's yearly metrics |
| `bands.json` | Per year and metric, p10, p50 and p90 across seeds |
| `timing.csv`, `shares_out.csv` | Wall time per seed (not a gate); the largest share count per seed |

`quarters.csv` is not committed (0.6 MB a scenario, and nothing reads it); the command above writes it.

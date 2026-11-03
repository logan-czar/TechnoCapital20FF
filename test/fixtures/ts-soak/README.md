# TypeScript baseline soak (D1019)

The parity reference since D1019: `headless parity <dir>` compares a new soak with this one by
default. A 50-seed soak of the 2020 world on the sim of main 334ee6d (2026-11-03), after Logan's
D973, D974 and D989, run on branch `build/ts6-delete-rust` on Logan's PC (Windows 11, Node via tsx):

```
corepack pnpm@10.20.0 headless soak --world 2020 --years 30 --seeds 1..50 --jobs 4 --out soak-out --check
corepack pnpm@10.20.0 headless parity soak-out
node scripts/ts/rust-reference-bands.ts soak-out --source "..."   # bands.json, when re-baselining
```

- Seeds 1 to 50, 30 years each (2020 to 2050), 4 worker threads.
- Wall time was 3,029 s (50 min). Each seed took 169 to 331 s (median 224 s).

Result against spec 10: 16 of the 17 judged targets MET (the two Cloud rows WAIVED, as in Rust).
`listings_30y` is NOT MET: it needs every seed, and 46 of 50 pass (30-year listings 55 to 83,
median 69). The largest `shares_out` was 3,253,324,829, a safe integer.

**Why it is the baseline.** The first TS soak (sim of main 22f77f3, 2026-10-25) passed parity with the
frozen Rust soak in `test/fixtures/rust-reference/`: all 19 Rust-MET targets and 1,590 yearly bands.
Logan's later rulings moved the 2020 world's company results: D974 most (the 2020 world starts at
productivity about 99.3, so nearly every company gets the doubled low-productivity R&D adjustment in
year one), then D973 and D989 (D1018). Against Rust this soak fails 636 checks (`parity.txt`): the
`listings_30y` target and 635 of 1,470 yearly bands, from 2020 on (profitable share 0.94 to 0.85,
distressed companies 1 to 8, exchange indices about 13% lower). Logan accepted the new behaviour and
re-baselined parity on this soak (D1019). `--reference test/fixtures/rust-reference` still compares
with Rust.

| File | What |
|---|---|
| `summary.csv` | Each target across seeds: pass share, verdict, min, median, max |
| `targets.csv` | Each target per seed: PASS or FAIL, the measured value and the bound |
| `years.csv` | One row per seed and year: the soak's yearly metrics (`apps/headless/src/metrics.ts`) |
| `bands.json` | Per year and metric, p10, p50 and p90 across seeds: the parity bands |
| `timing.csv` | Wall time per seed (not a gate) |
| `shares_out.csv` | The largest `shares_out` per seed |
| `parity.txt` | This soak against the Rust reference: the drift D1019 accepted |

`quarters.csv` is not committed (0.8 MB, and nothing reads it). It can be regenerated with the
command above.

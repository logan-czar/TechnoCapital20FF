# TypeScript soak (D951 parity gate)

The first full 50-seed soak of the TS sim, compared with the Rust reference in
`test/fixtures/rust-reference/` (docs/build/ts-migration-plan.md, Step 4). Run on 2026-10-25 at
commit 878ccd5 (branch `build/ts3-integrate`, PR #98). Its sim and headless code are those of main
22f77f3; PR #98 changes only tests. Logan's PC, Windows 11, Node via tsx:

```
corepack pnpm@10.20.0 headless soak --years 30 --seeds 1..50 --jobs 4 --out soak-out --check
corepack pnpm@10.20.0 headless parity soak-out
```

- Seeds 1 to 50, 30 years each (2020 to 2050), 4 worker threads.
- Wall time was 3,142 s (52 min). Each seed took 220 to 246 s (median 236 s), about 7.9 s per
  simulated year under 4 jobs. Rust took 59 s on 12 jobs.
- A lone `headless run --years 30 --seeds 1` took 204 s (6.8 s a year).
- Free memory fell from about 16 GB to 11.2 GB at its lowest, so about 1.2 GB per worker.

Result: all 19 judged spec 10 targets MET (the two Cloud rows WAIVED, as in Rust). 1,590 yearly
metric bands were checked with 0 failures: every TS median lies inside the Rust p10 to p90 band,
or equals it where the band has no width. The largest `shares_out` was 3,898,131,359, a safe
integer.

| File | What |
|---|---|
| `summary.csv` | Each target across seeds: pass share, verdict, min, median, max |
| `targets.csv` | Each target per seed: PASS or FAIL, the measured value and the bound |
| `years.csv` | One row per seed and year: the soak's yearly metrics (`apps/headless/src/metrics.ts`) |
| `timing.csv` | Wall time per seed (not a gate) |
| `shares_out.csv` | The largest `shares_out` per seed |
| `parity.txt` | The output of `headless parity` |

`quarters.csv` is not committed (0.8 MB, and the gate does not read it). It can be regenerated
with the command above.

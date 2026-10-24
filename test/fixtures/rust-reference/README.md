# Rust reference soak (D951)

The parity oracle for the TypeScript port (docs/build/ts-migration-plan.md, Step 4). Written by the
Rust headless runner on main 17349f3 (2026-10-24), the last Rust build:

```
cargo build --release -p headless
target/release/headless soak --out <dir> --check     # 50 seeds x 30 years, 59 s on 12 jobs
```

All 19 judged spec 10 targets were MET (`summary.csv`); the two Cloud rows are WAIVED (D366, D368).

| File | What |
|---|---|
| `years.csv` | One row per seed and year: the soak's yearly metrics (`crates/headless/src/metrics.rs`) |
| `quarters.csv` | One row per seed and quarter |
| `targets.csv` | Each spec 10 target per seed: PASS or FAIL, the measured value and the bound |
| `summary.csv` | Each target across seeds: pass share, verdict, min, median, max |
| `timing.csv` | Wall time per seed (Rust; for comparison only, not a gate) |
| `bands.json` | Per year and metric, p10, p50 and p90 across seeds; built by `node scripts/ts/rust-reference-bands.ts` |

The gate: the TS soak meets every target `summary.csv` marks MET, and each yearly metric's TS median
lies inside the Rust p10 to p90 band. Where a band has no width (a metric every seed shares, such as
`ticks`), the TS median must equal it. State hashes do not carry over (D953).

# Pivot politics soak, first baseline (D1056)

The milestone soaks of the pivot plan ("a coarse 25-year soak with sanity bands, a 2-year Full
soak") as `apps/headless/src/pivot-soak.ts` runs them. Recorded 2026-11-20 on branch
`claude/electron-transfer-political-sim-6b8104` at 1c05d7b, Logan's PC, 40 seeds, 4 workers, 212 s wall
(about 20 s a seed):

```
cd apps/headless
corepack pnpm@10.20.0 exec tsx src/pivot-soak.ts --seeds 1..40 --jobs 4 --out DIR
```

Per seed, sampled at 00:00 every 1 January:

- `coarse`: the pre-simulation, 1995 to 2020 at Coarse fidelity, random scenario (pivot 3.2).
- `full`: the same run's 1 January 2018, saved, loaded into a fresh sim, hydrated and played at Full
  to 2020. Pivot 3.3 asks that its seat, margin and lever distributions fall inside the Coarse
  bands; the driver judges that with a two-sample KS test per metric (p at least 0.05).
- `play`: the Coarse run's 2020 hydrated as a new game is, and played to 1 January 2023, through the
  2020 and 2022 generals.

`samples.csv` holds every sample; `report.txt` the checks and the distributions.

## What it found

24 of 25 checks pass. No NaN or infinite number in any of 1,280 samples; every quoted price is
positive; House turnout runs 0.41 of residents in presidential years and 0.31 in midterms; both
parties hold the presidency in every seed; the 2020 and 2022 generals are counted in play.

- **Lopsided chambers (the one failure).** 7 of 40 Coarse runs (seeds 2, 4, 14, 15, 21, 36, 39)
  and 2 of 40 played 2020 starts (seeds 8, 19) have a chamber above 75% one party after some
  general, mostly the Senate (seed 2: 20 to 80 in 2008). The handoff's "lopsided Senate" (B).
- **Full matches Coarse** (KS p 0.72 to 1.00 on every metric; the same seed's 2018 House result
  moves by 0.7 points of seat share at the median, 3 at most). This holds trivially for now: the Full
  campaigns, bills and executive actions are M3's, so Full runs nearly the Coarse election code,
  and `regulation`, `subsidy` and `tariff` never leave 0. M3 is when this comparison bites.
- **The US index** at 2020 is 1.9 times its 1996 year-end at the median (real S&P 500: about 4.4
  times). Inside the sanity band (0.5 to 20); the USA cut's economy tuning (handoff, B).

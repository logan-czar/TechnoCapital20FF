# Pivot politics soak baseline (D1056; re-recorded for D1057 to D1062)

The milestone soaks of the pivot plan ("a coarse 25-year soak with sanity bands, a 2-year Full
soak") as `apps/headless/src/pivot-soak.ts` runs them. First recorded 2026-11-20 (D1056) and accepted
by Logan; re-recorded 2026-11-23 on branch `claude/game-political-system-status-8db7c5` (44c96c6 with
D1057 to D1062: the fatigue on the presidency only, company shocks, hidden data at the source, the
greedy district drawer and D1062's shortcuts), Logan's PC, 40 seeds, 4 workers, 102 s wall (about
10 s a seed; 16 s before D1061 and D1062):

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

25 of 25 checks pass. No NaN or infinite number in any of 1,280 samples; every quoted price is
positive; House turnout runs 0.41 of residents in presidential years and 0.31 in midterms; both
parties hold the presidency in every seed (25 distinct paths); the 2020 and 2022 generals are
counted in play.

- **Lopsided chambers: none in this run.** The first baseline had 7 of 40 Coarse runs and 2 of 40
  played starts with a chamber above 75% one party, every one after a 12 to 16 year one-party
  presidency whose fatigue tide hit Congress too (D1057). After D1057, the runs between kept 4 or 5,
  all House waves of 80 to 110 seats from the national swing and the economy term (D986). D1062's
  changes move every seed's path, and none of these 40 has such a wave: the band passes, but the
  waves are a tail, not a fix; a wider seed range may find one.
- **Full matches Coarse** (KS p 0.72 to 1.00 on every metric; the same seed's 2019 House result
  moves by 0.7 points of seat share at the median, 2.5 at most). This holds trivially for now: the
  Full campaigns, bills and executive actions are M3's, so Full runs nearly the Coarse election
  code, and `regulation`, `subsidy` and `tariff` never leave 0. M3 is when this comparison bites.
- **The US index** at 2020 is 1.8 times its 1996 year-end at the median (real S&P 500: about 4.4
  times). Inside the sanity band (0.5 to 20); the USA cut's economy tuning (handoff, B).
- **Seed 15** ran out of memory after D1057 moved its 2010 vote: its 2011 California map, drawn by
  Republicans at strength 0.83, sent the old district search past 200,000 backtracks (D1058). D1061's
  drawer does fixed work per map; all 40 seeds finish.

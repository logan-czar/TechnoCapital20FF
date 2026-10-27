# Economy analysis tools (D970)

`apps/headless/src/econ-report.ts` runs the sim under a growth profile and writes one row a year for the economy, every industry and every exchange. It reads the views and the soak totals only.

```
pnpm --filter @tc20ff/headless exec tsx src/econ-report.ts profiles
pnpm --filter @tc20ff/headless exec tsx src/econ-report.ts run <profile> <years> <seedLo> <seedHi> <outDir>
pnpm --filter @tc20ff/headless exec tsx src/econ-report.ts summary <outDir> [fromYear toYear]
```

`run` writes `<outDir>/<profile>-s<seed>/{economy,industries,stocks}.csv`, rows at each 1 January for the year just closed (`year` 2020 is the end of 2020). Run profiles side by side as separate processes; a 15-year seed takes under a minute. `summary` merges the seeds (means) and writes `<outDir>/summary.md`: the economy by profile, the stock indices, then each industry's demand, revenue, market factor M and median share price change by profile, and the share of Boom, Bust and Glut labels. Growth is measured from the end of `fromYear` to the end of `toYear`.

Profiles (economy/profiles.ts): `legacy` (spec 5.1), `vanilla` (3%, flat cycle, no AI boom), `ai_boom`, `long_recession`, `great_depression`, `long_boom`, `boom_bust`, `stagnation`. `simNew(data, seed, { profile })` picks one.

# Economy analysis tools (D970)

`apps/headless/src/econ-report.ts` runs the sim under a growth profile and writes one row a year for the economy, every industry and every exchange. It reads the views and the soak totals only.

```
pnpm --filter @tc20ff/headless exec tsx src/econ-report.ts profiles
pnpm --filter @tc20ff/headless exec tsx src/econ-report.ts run <profile> <years> <seedLo> <seedHi> <outDir>
pnpm --filter @tc20ff/headless exec tsx src/econ-report.ts summary <outDir> [fromYear toYear]
```

`run` writes `<outDir>/<profile>-s<seed>/{economy,industries,stocks}.csv`, rows at each 1 January for the year just closed (`year` 2020 is the end of 2020). Run profiles side by side as separate processes; a 15-year seed takes under a minute. `summary` merges the seeds (means) and writes `<outDir>/summary.md`: the economy by profile, the stock indices, then each industry's demand, revenue, market factor M and median share price change by profile, and the share of Boom, Bust and Glut labels. Growth is measured from the end of `fromYear` to the end of `toYear`.

Profiles (economy/profiles.ts): `legacy` (spec 5.1), `vanilla` (3%, flat cycle, no AI boom), `ai_boom`, `long_recession`, `great_depression`, `long_boom`, `boom_bust`, `stagnation`. `simNew(data, seed, { profile })` picks one.

## Debt aggression tournament (D971)

`apps/headless/src/debt-tournament.ts` plays several debt policies side by side in one world. `simNew(data, seed, { debt_levels: [0, 1, 2, 3, 4] })` gives company `id` the level `debt_levels[id % 5]`; level 0 is the spec 6.5 AI, and each level up holds more of its credit line drawn, borrows to fund purchases, spends more of its liquidity and grows harder while profitable.

```
pnpm --filter @tc20ff/headless exec tsx src/debt-tournament.ts run <profile> <years> <seedLo> <seedHi> <levels> <outDir>
pnpm --filter @tc20ff/headless exec tsx src/debt-tournament.ts summary <outDir>
```

`levels` is a list such as `0,1,2,3,4,6`. The summary pools the seeds per profile: survival, share ever distressed, equity multiple (all, and median), revenue multiple, line drawn over limit, debt over equity, the debt trend by year, and the equity multiple by archetype. Only companies in the world at load are scored; one that goes Bankrupt or Removed ends with equity 0.

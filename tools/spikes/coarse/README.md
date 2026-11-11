# Spike: a 25-year "Coarse" pre-sim in Node

> The measuring script (`spike.ts`) and the two `simSpike*` functions it used were removed in M1
> (lane S4, D1030): the game's own path is now `simRunTicks` and `packages/sim/src/fidelity/`, and
> the headless `bake` command prints the same timings. The script is in git history (last at
> a5b060a). The findings below stand as measured then.

Throwaway measurement code. It asks whether the 1995 world can be run forward to 2020 with no UI
inside 60 to 120 seconds once it also carries county-level politics, and what the save, load and
hash cost at that point.

Nothing here is game code. The only change outside this folder is two functions in
`packages/sim/src/lib.ts`, marked SPIKE: `simSpikeStepNoViews` (one tick of jobs, no view
refresh, no pause handling, notices dropped) and `simSpikeRebuildViews`. Nothing calls them but
`spike.ts`. The political load is not in the job registry: `spike.ts` adds two jobs to one Sim
through the test hook `simRegisterTestJob` and hangs their state on the world as `spike_pol`, so
the real `save.ts` and `hash.ts` carry it.

## How to run

From `apps/headless` (tsx is its dev dependency), one process at a time (peak memory is 4 to 5 GB
while the save is being measured):

```
corepack pnpm@10.20.0 exec tsx src/main.ts run --years 25 --seeds 1..1 [--profile]
corepack pnpm@10.20.0 exec tsx ../../tools/spikes/coarse/spike.ts --mode views    --tag views
corepack pnpm@10.20.0 exec tsx ../../tools/spikes/coarse/spike.ts --mode noviews  --tag noviews
corepack pnpm@10.20.0 exec tsx ../../tools/spikes/coarse/spike.ts --politics           --tag pol
corepack pnpm@10.20.0 exec tsx ../../tools/spikes/coarse/spike.ts --politics --history --tag pol-hist
```

Each writes `out/<tag>.json` (git-ignored). `--no-measure` times the run only. `--off-world`
keeps the political state out of the world (so out of the save).

## Setup

Seed 1, the 1995 world, 1995-01-01 to 2020-01-01 (219,144 hourly ticks), Node v24.15.0, Windows
11, a 24-thread desktop that other work was also using. Every number below is from one seed. Run
times moved by up to 3 s between repeats (see the ranges), so differences under about 3 s are not
resolved.

The synthetic political load:

- 3,100 counties (state, district, population, lean, elasticity, turnout) as an array of objects;
  every 1 January each county takes 4 normal draws; 2001 and 2011 redistrict (a sort and a cut).
- A people table that starts at 2,500 and reaches 10,000: name, birth year, state, party, 6
  skills, 3 trait strings, status and a career record. Every 1 January each person who is not
  retired takes 2 draws.
- An election on 5 November of every even year (12 of them, 1996 to 2018): each county is counted
  for its House district, its state's Senate race (33 or 34 states), its governor's race (36
  states in a midterm, 12 in a presidential year) and the presidential race. One count is a
  logistic share (`expF`), a turnout (`expF`, `logF`) and 2 normal draws from the sim's
  generator (`rngStreamsNormal`, a private `RngStreams` so the base world's draws do not move).
  98,456 county-race counts and 926,678 draws over the run.
- `--history` also keeps one row per county per race per election (98,456 rows).

## Results

All measured unless marked "estimate".

### Run time, 1995 to 2020

| Run | Seconds | Notes |
| --- | --- | --- |
| `headless run --years 25 --seeds 1..1` | 57.1 | as shipped: `step()` plus the metrics recorder |
| same with `--profile` | 56.0 | of which 26.9 s inside `step`: views 11.7 s, jobs 14.9 s, rest 0.4 s |
| bare loop of `sim.step()` (views refreshed every tick) | 22.1 to 23.9 (4 runs) | no recorder |
| bare loop of `simSpikeStepNoViews` | 10.1 to 10.4 (4 runs), 13.1 and 13.4 (2 later runs) | same final hash as `headless run` |
| no views + politics | 11.3 to 13.7 (4 runs) | the two political jobs themselves: 0.064 s in total |
| no views + politics + county history | 13.7 to 15.5 (6 runs) | the two political jobs themselves: 0.073 s in total |
| no views + politics + county history, state kept off the world | 10.7 and 12.4 (2 runs) | |

- About 30 s of the shipped `headless run` is neither jobs nor views: it is the runner's own
  per-notice recording (`apps/headless/src/metrics.ts`), which a pre-sim would not run.
- In the profile, `SharePrices` (hourly prices) is 9.5 s of the 14.9 s of jobs and `LockConsensus`
  2.4 s; everything else is under 1 s.
- The political jobs are timed inside the job: 35 ms for 25 yearly drifts, 29 to 38 ms for 12
  elections, so about 0.3 to 0.4 microseconds per county-race count.
- The runs with the political state on the world were 1 to 3 s slower than without, far more than
  the 0.07 s the jobs take. With the state off the world the gap mostly went away, but the
  machine's own drift between repeats was as large, so the cause is not settled (see "Not
  measured").

### Save, load and hash at 2020

| | Base world | + politics | + politics + county history |
| --- | --- | --- | --- |
| Raw canonical JSON, bytes | 249,203,001 | 252,031,204 | 260,786,678 |
| Save file (gzip, fflate default level), bytes | 64,338,917 | 64,898,207 | 67,347,585 |
| `saveBytes()`, s | 8.6 to 8.8 | 9.1 | 9.2 |
| of which canonical text / gzip, s | 3.3 / 5.0 | 3.5 / 5.2 | 3.7 / 5.2 |
| `decode()` (gunzip, parse, revive), s | 2.5 to 2.7 | 2.7 | 2.8 |
| `simLoadBytes()` (decode + rebuild all views), s | 2.9 to 3.3 | 2.8 | 3.0 |
| Rebuild all views once, s | 0.054 to 0.059 | 0.056 | 0.059 |
| `stateHash()`, s | 1.54 to 1.58 | 1.62 | 1.63 |
| Political state alone: raw / gzipped bytes | | 2,828,190 / 559,521 | 11,583,664 / 3,008,012 |
| Political state alone: hash, ms | | 17 | 69 |
| Process RSS after the run, MB | 1,205 (no views), 1,729 (views) | 1,347 | 1,365 |

Where the base save's bytes are (raw JSON): `market` 225.3 MB, of which `market.stocks` 220.2 MB
and `index_history` 5.1 MB; `companies` 15.1 MB; `recaps` 4.3 MB; `news` 3.2 MB; everything else
under 0.4 MB each. So 88% of the save is per-stock history.

Other gzip settings on the same 249 MB of base text:

| Compressor | Seconds | Bytes |
| --- | --- | --- |
| fflate level 6 (today) | 5.0 | 64,338,557 |
| fflate level 1 | 2.4 | 67,820,558 |
| node:zlib level 6 | 3.3 | 60,977,105 |
| node:zlib level 1 | 1.2 | 68,363,839 |

### Layouts of the political state (raw / gzipped bytes)

| Table | As measured in the run | Alternative | Alternative's bytes |
| --- | --- | --- | --- |
| 3,100 counties, objects | 445,479 / 128,566 | one plain array per column | 217,263 / 96,694 |
| | | columns, floats as whole 1/10,000ths | 87,516 / 35,613 |
| 10,000 people, objects | 1,823,145 / 254,629 | flat rows, trait ids, career as numbers | 662,581 / 188,890 |
| 2,112 retired people, objects | 431,152 / 61,435 | id, name, birth, state, party, career as numbers | 89,278 / 22,082 |
| 12 elections, race level (about 5,900 races) | 556,394 / 174,327 | | |
| 98,456 county-race rows, objects | 8,755,476 / 2,449,198 | columns, whole votes | 2,135,886 / 548,294 |

## Conclusions

1. **25 years in under 60 s in Node is realistic, with room.** The sim's jobs take about 10 to 13
   s for the whole run when no views are refreshed. The synthetic political load adds 0.07 s of
   job time. Even the shipped `headless run` is at 57 s, and more than half of that is the
   runner's recorder.
2. **What dominates the run** is the existing hourly share-price job (about 9.5 s) and, if they
   are left on, the per-tick view refresh (about 12 s). County politics at this size does not
   register. Estimate: at 0.4 microseconds a count, even a weekly poll of every county in every
   race for 25 years (about 10 million counts) would be about 4 s.
3. **What dominates everything after the run is the save.** A save at 2020 is 64 MB and takes
   about 9 s to write and 3 s to read; one state hash takes 1.6 s. If the pre-sim ends with a
   save, that is 9 s of a 60 s budget, more than the political load by two orders of magnitude.
   The political state is 0.9% of the file without county history and 4.5% with it.

The changes that would matter most:

1. **Run the pre-sim without views and without notice handling**, then rebuild the views once
   (0.06 s). That halves the run (22 s to about 10 s) and frees about 500 MB. The final hash was
   the same as the normal run's, so the views have no effect on the world.
2. **Shrink or cheapen the save of `market.stocks`** (220 MB of 249 MB raw). Either keep less
   per-stock history through the pre-sim, or hold it in a denser form. Separately, a faster gzip
   setting takes the write from 5.0 s to 1.2 to 2.4 s for a 5 to 6% larger file. This is where
   save, load, hash and memory all come from; the political tables are small beside it.
3. **Do not save per-county results as objects.** Race-level results only is 0.56 MB; per-county
   history as objects is 8.8 MB raw and 2.4 MB gzipped for 12 elections, and grows with every
   election played. If it is wanted, columns of whole votes are a quarter of that.

Lower value at this size: typed arrays for county columns (`canonical.ts` refuses typed arrays
today, so they would need encoder support; plain column arrays already halve the 445 KB, and the
county loop is 35 ms over 25 years either way); compact retired people (saves 0.34 MB raw of a
249 MB save). They become worth doing only if the counts grow well past this brief.

Tests: a hash of a 2020-start state costs 1.6 s and a save 9 s. An estimate: hashing monthly over
the 25 years would cost several minutes, since the state grows roughly linearly to that 1.6 s. A
test that needs a 2020 world should build it once and share it.

## Not measured

- The browser. The game runs the sim in a Web Worker; all numbers here are Node. Memory limits
  and gzip speed there may differ, and `node:zlib` is not available.
- More than one seed, and a quiet machine. Repeats drifted by up to 3 s.
- Why runs with the political state on the world were 1 to 3 s slower than the job time explains.
  Candidates are the extra property changing the World object's layout for the hot jobs, or
  garbage collection; neither was tested apart from the one `--off-world` pair.
- A clean peak memory for a save. The harness holds several copies of the text and bytes while
  timing, so its 4.2 to 4.7 GB peak overstates a single save.
- 15,000 people, or richer per-person records. Estimate from 10,000: about 180 bytes of raw JSON
  per person as objects, so 2.7 MB raw.
- Real election rules (primaries, candidate selection, campaign effects), the electoral college
  count and a real redistricting algorithm. The redistricting here is a sort and a cut.

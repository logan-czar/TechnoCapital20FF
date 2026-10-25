// Port of crates/sim/tests/m10_boom_pop.rs: M10.5 (build-plan M10 table; spec 10 M10 "the AI boom
// and the pop fire on their dates and, with noise off, AI labs demand matches validate.py's boom
// run"; D405): the whole engine, every job of every slot, run with the cycle and growth streams
// silenced. validate-boom-calm.csv gives validate.py's year-end demand and lt; the full engine
// must match it to 1e-9 until the pop, and the pop must cut every industry by crash_drop exactly
// on its rolled date. Two seeds: one that rolls validate.py's pop date (1 January 2040), one
// that rolls mid-year.
//
// Expects:
//   ../src/lib.ts                 simNew, simWorld; scheduler() -> Scheduler [sim::scheduler];
//                                    startWorld(data, draws) -> Result<World, LoadError>
//   ../src/economy/ai_boom.ts     rollPopDate(draws) -> SimDate (the pop roll, the load's first
//                                    gen draws, D111)
//   ../src/economy/demand.ts      monthFactor(q_growth)
//   ../src/economy/index.ts       start(world, draws)                    [economy::start]
//   ../src/births/jobs.ts         drawTippedLabAtLoad(world, draws), drawFirstVotes(world, draws)
//   ../src/ai/jobs.ts             planAtLoad(world)
//   ../src/people/seating.ts      start(world, draws)
//   ../src/finance/index.ts       start(world)
//   ../src/market/index.ts        start(world, draws)
//   ../src/world/load.ts          worldFromData(data)
//   ../src/time/scheduler.ts      schedulerRunTick(s, world, draws, notices, controls, null)
//   ./common/rng.ts                  newRngStreams, rngStreamsDraws (via src/rng.ts), NoNoise
//   ./common/economy.ts              rel
//
// Changed from the Rust:
// - RngStreams::new(seed) is the new generator (D951). The seed searches (a seed whose pop roll is
//   1 January 2040; one whose roll is July 2041) look for seeds by the roll itself, so they find
//   different seeds than Rust did and every assertion holds as written.
// - CalmCycleAndGrowth wraps the DrawSource of a seeded RngStreams and answers the Cycle and
//   Growth streams from NoNoise (Rust next_u64 is nextU32 here).
// - `assert_eq!(a, b)` on RngStreams is rngStreamsEq; on the worlds, numbersDiffer (Rust f64 ==).
import type { WorldData } from "@tc20ff/sim-data";
import { describe, expect, it } from "vitest";
import { planAtLoad } from "../src/ai/jobs.ts";
import { drawFirstVotes, drawTippedLabAtLoad } from "../src/births/jobs.ts";
import { rollPopDate } from "../src/economy/ai_boom.ts";
import { monthFactor } from "../src/economy/demand.ts";
import { start as economyStart } from "../src/economy/index.ts";
import { start as financeStart } from "../src/finance/index.ts";
import { scheduler } from "../src/jobs.ts";
import { simNew, simWorld, startWorld } from "../src/lib.ts";
import { start as marketStart } from "../src/market/index.ts";
import { start as seatingStart } from "../src/people/seating.ts";
import { NoNoise, rngStreamsDraws, rngStreamsEq, rngStreamsNew } from "../src/rng.ts";
import {
  dateTimeDate,
  dateTimeHour,
  dateTimeMidnight,
  dateTimeNext,
  simDateQuarter,
  simDateYmd,
} from "../src/time/calendar.ts";
import { controlsDefault } from "../src/time/control.ts";
import { schedulerRunTick } from "../src/time/scheduler.ts";
import { cmpDate, type DateTime, type SimDate } from "../src/types/calendar.ts";
import type { DrawSource, Stream } from "../src/types/draws.ts";
import type { Notice, World } from "../src/types/world.ts";
import { worldFromData } from "../src/world/load.ts";
import { rel } from "./common/economy.ts";
import { fixtureText, lines } from "./common/fixtures.ts";
import { data, macrotask, numbersDiffer, unwrap } from "./common/index.ts";

/** validate.py's boom run pops on 1 January 2040 (spec 5.1.1). */
const FIXTURE_POP: SimDate = simDateYmd(2040, 1, 1);

/**
 * The draws of the noise-off run: cycle and growth give "no rolls" (NoNoise), the other streams
 * are the seed's own.
 */
function calmCycleAndGrowth(seed: number): DrawSource {
  const rng = rngStreamsNew(seed);
  const own = rngStreamsDraws(rng);
  const calm = (s: Stream): boolean => s === "Cycle" || s === "Growth";
  const draws: DrawSource = {
    nextU32: (s) => (calm(s) ? NoNoise.nextU32(s) : own.nextU32(s)),
    uniform: (s) => (calm(s) ? NoNoise.uniform(s) : own.uniform(s)),
    normal: (s) => (calm(s) ? NoNoise.normal(s) : own.normal(s)),
    poisson: (s, mean) => (calm(s) ? NoNoise.poisson(s, mean) : own.poisson(s, mean)),
    intInclusive: (s, lo, hi) => (calm(s) ? NoNoise.intInclusive(s, lo, hi) : own.intInclusive(s, lo, hi)),
    chance: (s, p) => (calm(s) ? NoNoise.chance(s, p) : own.chance(s, p)),
  };
  return draws;
}

/**
 * sim::start_world step by step, with a hook between the static tables and the load's draws
 * (where Z is zeroed). the_start_replica_is_start_world holds it to the real one.
 */
function startWorldWith(d: WorldData, draws: DrawSource, beforeDraws: (w: World) => void): World {
  const world = unwrap(worldFromData(structuredClone(d)), "World::from_data");
  beforeDraws(world);
  economyStart(world, draws);
  drawTippedLabAtLoad(world, draws);
  planAtLoad(world);
  seatingStart(world, draws);
  drawFirstVotes(world, draws);
  financeStart(world);
  marketStart(world, draws);
  world.news.labels = world.industries.map((i) => i.phase_label);
  return world;
}

describe("m10 boom and pop", () => {
  it("the_start_replica_is_start_world", () => {
    const d = data();
    const a = rngStreamsNew(5);
    const b = rngStreamsNew(5);
    const replica = startWorldWith(d, rngStreamsDraws(a), () => {});
    const real = unwrap(startWorld(structuredClone(d), rngStreamsDraws(b)), "start_world");
    expect(numbersDiffer(replica, real)).toBeNull();
    expect(rngStreamsEq(a, b), "the same draws in the same order").toBe(true);
    // And it is the Sim's own start state.
    expect(numbersDiffer(real, simWorld(unwrap(simNew(structuredClone(d), 5), "Sim::new")))).toBeNull();
  });
});

/** validate-boom-calm.csv: (industry key, year) -> (lt, year-end demand in $bn). */
function calmRun(): Map<string, [number, number]> {
  // The fixture is packages/sim/test/fixtures/validate-boom-calm.csv (copied from the Rust).
  const text = fixtureText("validate-boom-calm.csv");
  const out = new Map<string, [number, number]>();
  for (const line of lines(text)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"))) {
    const p = line.split(",");
    expect(p[0]).toBe("demand");
    out.set(`${p[1]}|${p[2]}`, [Number(p[3]), Number(p[4])]);
  }
  return out;
}

/** The first seed whose pop roll (the load's first gen draws, D111) is `want`. */
function seedPoppingOn(want: (d: SimDate) => boolean): number {
  for (let s = 0; s < 10_000; s++) {
    if (want(rollPopDate(rngStreamsDraws(rngStreamsNew(s))))) return s;
  }
  throw new Error("a seed rolls it");
}

/** What the noise-off full-engine run saw. */
interface Run {
  pop_date: SimDate;
  /** Ticks with a World event alert. */
  world_events: DateTime[];
  /** Every industry's year-end comparisons made against the fixture. */
  compared: number;
  /**
   * Every industry's demand_core x (1 - crash_drop) x the month factor, against the value after
   * the pop tick: the largest relative miss.
   */
  pop_cut_miss: number;
}

/**
 * The full engine from the seed's start with cycle and growth calm and Z = 0, to `end`. At each
 * 1 January close up to the pop, every industry's demand_core and lt are checked against
 * validate.py's calm run (`want`), as M2.4 checks the demand path alone.
 */
async function runCalm(seed: number, endDate: SimDate, want: Map<string, [number, number]>): Promise<Run> {
  const d = data();
  const draws = calmCycleAndGrowth(seed);
  const world = startWorldWith(d, draws, (w) => {
    w.cycle.z_avg = 0.0;
  });
  const popDate = world.ai.pop_date;
  expect(popDate).toEqual(rollPopDate(rngStreamsDraws(rngStreamsNew(seed))));
  expect(world.ai.boom_date).toEqual(simDateYmd(2030, 1, 1));
  const sched = scheduler();
  const controls = controlsDefault();
  const run: Run = { pop_date: popDate, world_events: [], compared: 0, pop_cut_miss: 0.0 };
  const end = dateTimeMidnight(endDate);
  const popTick = dateTimeMidnight(popDate);
  let born = 0;
  while (world.clock < end) {
    // Just before the pop tick: what the pop must leave (4.3 step 1a cuts by crash_drop, then
    // step 2 moves demand by last quarter's growth, D100).
    const expectedAfterPop: number[] | null =
      dateTimeNext(world.clock) === popTick
        ? world.industries.map((i) => i.demand_core * (1.0 - i.params.crash_drop) * monthFactor(i.q_growth))
        : null;
    const stageBefore = world.ai.stage;
    const notices: Notice[] = [];
    schedulerRunTick(sched, world, draws, notices, controls, null);
    const now = world.clock;
    for (const n of notices) {
      if (n.kind === "Alert" && n.alert_kind === "WorldEvent") run.world_events.push(now);
      else if (n.kind === "CompanyBorn") born += 1;
    }
    if (expectedAfterPop !== null) {
      expect(stageBefore).toBe("Boom");
      expect(world.ai.stage, `the pop fires at ${now}`).toBe("Bust");
      world.industries.forEach((ind, i) => {
        run.pop_cut_miss = Math.max(run.pop_cut_miss, rel(ind.demand_core, expectedAfterPop[i] as number));
      });
    }
    const date = dateTimeDate(now);
    if (dateTimeHour(now) !== 0 || date.day !== 1) continue;
    await macrotask();
    // The stage by quarter (5.1.1, D111): Boom from 1 Jan 2030, Bust 8 quarters from the pop,
    // then Postcrash.
    const q = (x: SimDate): number => x.year * 4 + simDateQuarter(x).q;
    const x = q(date);
    const wantStage =
      x < q(simDateYmd(2030, 1, 1))
        ? "Preboom"
        : x < q(popDate)
          ? "Boom"
          : x < q(popDate) + 8
            ? "Bust"
            : "Postcrash";
    expect(world.ai.stage, `${date.year}-${date.month}-${date.day}`).toBe(wantStage);
    // The year-end match, while the run's history is validate.py's: every year when the pop is
    // the fixture's (1 January 2040); otherwise the closes before both pops, since validate.py's
    // years from 2040 on are after its pop.
    const inFixture =
      cmpDate(popDate, FIXTURE_POP) === 0 || (cmpDate(date, popDate) < 0 && cmpDate(date, FIXTURE_POP) <= 0);
    if (date.month !== 1 || !inFixture) continue;
    const year = date.year - 1;
    for (const ind of world.industries) {
      const [lt, demandBn] = want.get(`${ind.key}|${year}`) as [number, number];
      const cut = cmpDate(date, popDate) === 0 ? 1.0 - ind.params.crash_drop : 1.0;
      const wantUsd = demandBn * 1e9 * cut;
      expect(
        rel(ind.demand_core, wantUsd) < 1e-9,
        `seed ${seed}: ${ind.key} ${year}: ${ind.demand_core} vs validate.py ${wantUsd}`,
      ).toBe(true);
      expect(Math.abs(ind.prev_lt - lt) < 1e-12, `${ind.key} ${year} lt`).toBe(true);
      run.compared += 1;
    }
  }
  expect(born > 0, "the full engine ran: companies were born").toBe(true);
  return run;
}

describe("m10 noise-off full engine", () => {
  it("noise_off_full_engine_matches_validate_py_year_by_year", { timeout: 1_800_000 }, async () => {
    const want = calmRun();
    // validate.py's pop date, rolled by the seed itself (no override).
    const seed = seedPoppingOn((d) => cmpDate(d, FIXTURE_POP) === 0);
    const run = await runCalm(seed, simDateYmd(2046, 1, 1), want);
    expect(run.pop_date).toEqual(FIXTURE_POP);
    expect(
      run.world_events,
      "the boom on 1 January 2030 and the pop on its rolled date, nothing else",
    ).toEqual([dateTimeMidnight(simDateYmd(2030, 1, 1)), dateTimeMidnight(simDateYmd(2040, 1, 1))]);
    // validate.py's years 2020 to 2045 (the 1 January closes of 2021 to 2046), the pop's close
    // included: 26 years.
    expect(run.compared).toBe(26 * 42);
    expect(run.pop_cut_miss < 1e-12, `${run.pop_cut_miss}`).toBe(true);
  });

  it("noise_off_pop_fires_on_a_mid_year_rolled_date", { timeout: 1_800_000 }, async () => {
    const want = calmRun();
    const seed = seedPoppingOn((d) => d.year === 2041 && d.month === 7);
    const run = await runCalm(seed, simDateYmd(2044, 1, 1), want);
    expect(run.pop_date).toEqual(simDateYmd(2041, 7, 1));
    expect(run.world_events).toEqual([
      dateTimeMidnight(simDateYmd(2030, 1, 1)),
      dateTimeMidnight(simDateYmd(2041, 7, 1)),
    ]);
    // 2020 to 2039 match validate.py, whose pop on 1 January 2040 then parts the two runs.
    expect(run.compared).toBe(20 * 42);
    expect(run.pop_cut_miss < 1e-12, `${run.pop_cut_miss}`).toBe(true);
  });
});

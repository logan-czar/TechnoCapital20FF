// The Sim for the lib.rs tests (controls, job order, notices, hash, save and load) while Step 2
// lands: `testSim(seed)` is Rust's `Sim::new(data, seed)` once `simNew` builds the start state
// from the real data; until then (a START_DEPS or LoadDeps member still throws "not ported yet")
// it is a Sim on `minimalWorld()` with only the calendar alerts scheduled and only the clock view
// built. Those read nothing but the clock and the controls, and the test jobs below read only a
// company's revenue and an industry's size, so every test here runs the same on either.
//
// Also the shared bits of crates/sim/tests/common/mod.rs these tests use (churn, draw_only,
// bankrupt_three_and_four), and the clock-only world and no-draw source of the scheduler tests.

import type { WorldData } from "@tc20ff/sim-data";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { type Sim, type SimOptions, simFromWorld, simNew, simRegisterTestJob } from "../src/lib.ts";
import { register as registerCalendarAlerts } from "../src/time/alerts.ts";
import { type JobCtx, jobCtxRaiseAlert, type Scheduler, schedulerNew } from "../src/time/scheduler.ts";
import { DATETIME_START } from "../src/types/calendar.ts";
import { type DrawSource, STREAM_VALUES } from "../src/types/draws.ts";
import type { CompanyId } from "../src/types/ids.ts";
import type { World } from "../src/types/world.ts";
import { viewBuildersOnly } from "../src/views/index.ts";

function noDraw(): never {
  throw new Error("no draws expected");
}

/** A DrawSource for runs that must draw nothing. */
export const NO_DRAWS: DrawSource = {
  nextU32: noDraw,
  uniform: noDraw,
  normal: noDraw,
  poisson: noDraw,
  intInclusive: noDraw,
  chance: noDraw,
};

/** A world that holds only the clock, at the game start. */
export function clockWorld(): World {
  return { clock: DATETIME_START } as World;
}

/** Companies in `minimalWorld` (the tests watch companies 3, 4 and 9). */
export const MINIMAL_COMPANIES = 12;

/**
 * The clock at the game start, a few companies (only `revenue_usd`) and industries (only
 * `world_size_2020_usd` and `phase_label`): enough for the controls (WatchlistAdd checks the
 * company table) and for the churn job to write into tables the hash and the save cover.
 */
export function minimalWorld(): World {
  return {
    clock: DATETIME_START,
    companies: Array.from({ length: MINIMAL_COMPANIES }, (_, i) => ({ revenue_usd: 1e6 * (i + 1) })),
    industries: Array.from({ length: 5 }, (_, i) => ({
      world_size_2020_usd: 1e9 * (i + 1),
      phase_label: "Normal",
    })),
  } as unknown as World;
}

/** A scheduler with only the calendar alerts (time::alerts), the jobs a minimal world can run. */
export function calendarScheduler(): Scheduler {
  const s = schedulerNew();
  registerCalendarAlerts(s);
  return s;
}

let cachedData: WorldData | undefined;

/** The starting data, loaded once. */
export function data(): WorldData {
  if (cachedData === undefined) {
    const r = loadWorld(defaultDataDir());
    if (!r.ok) throw new Error(`data loads: ${JSON.stringify(r.error)}`);
    cachedData = r.value;
  }
  return cachedData;
}

function isNotPorted(e: unknown): boolean {
  return e instanceof Error && /not ported yet/.test(e.message);
}

let realData: boolean | undefined;

/** Whether `simNew` builds a game from the real data yet (every Step 2 start call is wired). */
export function simNewWorks(): boolean {
  if (realData === undefined) {
    try {
      simNew(data(), 1);
      realData = true;
    } catch (e) {
      if (!isNotPorted(e)) throw e;
      realData = false;
    }
  }
  return realData;
}

/** Rust `Sim::new(data, seed).unwrap()`, or the minimal-world Sim until `simNew` works. */
export function testSim(seed: number, opts: SimOptions = {}): Sim {
  if (simNewWorks()) {
    const r = simNew(data(), seed, opts);
    if (!r.ok) throw new Error(`Sim::new: ${JSON.stringify(r.error)}`);
    return r.value;
  }
  return minimalSim(seed, opts);
}

/**
 * A Sim on `minimalWorld()` with only the calendar alerts and the clock view, whatever is
 * ported: for tests of the tick and control logic alone.
 */
export function minimalSim(seed: number, opts: SimOptions = {}): Sim {
  return simFromWorld(minimalWorld(), seed, {
    ...opts,
    makeScheduler: calendarScheduler,
    deps: { ...opts.deps, views: viewBuildersOnly(["clock"]) },
  });
}

// ---------------------------------------------------------------- tests/common/mod.rs

const company = (n: number) => n as CompanyId;

/**
 * A new game with the churn job in the hourly alerts slot, which runs on every tick (the share
 * price slot skips 1 January and release ticks).
 */
export function churningSim(seed: number): Sim {
  const sim = testSim(seed);
  simRegisterTestJob(sim, "Alerts", "test.churn", churn);
  return sim;
}

/**
 * Draws from all five streams (one normal a tick, so the Box-Muller spare is often pending at a
 * save) and folds the draws into one company's revenue and one industry's size.
 *
 * Changed from the Rust: next_u64 % 1000 is nextU32 % 1000 (the raw draw is 32-bit in TS).
 */
export function churn(world: World, ctx: JobCtx): void {
  const d = ctx.draws;
  const x =
    (d.nextU32("Cycle") % 1000) +
    d.uniform("Growth") +
    d.normal("Prices") +
    d.poisson("Ai", 2.0) +
    d.intInclusive("Gen", -3, 3);
  const n = ctx.facts.now;
  world.companies[n % world.companies.length]!.revenue_usd += x;
  world.industries[n % world.industries.length]!.world_size_2020_usd -= x;
}

/** Draws from every stream and writes nothing: only the RNG positions move. */
export function drawOnly(_world: World, ctx: JobCtx): void {
  for (const s of STREAM_VALUES) ctx.draws.nextU32(s);
}

/**
 * Raises Bankruptcy in watchlist for companies 3 and 4 every day, as a finance job would for
 * every bankrupt company (spec 4.3 step 13); the watchlist filter decides what fires.
 */
export function bankruptThreeAndFour(_world: World, ctx: JobCtx): void {
  for (const id of [company(3), company(4)]) {
    jobCtxRaiseAlert(ctx, "BankruptcyInWatchlist", { kind: "Company", company: id });
  }
}

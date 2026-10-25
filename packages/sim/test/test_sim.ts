// The Sim for the lib.rs tests (controls, job order, notices, hash, save and load) while Step 2
// lands: `testSim(seed)` is Rust's `Sim::new(data, seed)` once `simNew` builds the start state
// from the real data; until then (a START_DEPS or LoadDeps member still throws "not ported yet")
// it is a Sim on `minimalWorld()` running every registered job (`scheduler()`, as Rust's
// `Sim::new` does), with only the clock view built. The world's tables are empty or bare, so the
// ported jobs find nothing to do and the placeholders do nothing; the slots visited, the calendar
// alerts and the test jobs below are what these tests check, the same on either.
//
// Also the shared bits of crates/sim/tests/common/mod.rs these tests use (churn, draw_only,
// bankrupt_three_and_four), and the clock-only world and no-draw source of the scheduler tests.

import type { WorldData } from "@tc20ff/sim-data";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { RATING_WORST } from "../src/finance/rating.ts";
import { companyFinanceAtLoad } from "../src/finance/state.ts";
import { type Sim, type SimOptions, simFromWorld, simNew, simRegisterTestJob } from "../src/lib.ts";
import { type JobCtx, jobCtxRaiseAlert } from "../src/time/scheduler.ts";
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

/**
 * A world that holds the clock at the game start and empty tables, so the ported modules' jobs run
 * as no-ops: no industries, units or companies, a cycle with far more quarters left than a test
 * runs (so it never draws), and the AI boom in Preboom with the boom in 2030 (Step 2).
 */
export function clockWorld(): World {
  return {
    clock: DATETIME_START,
    zones: [],
    countries: [],
    provinces: [],
    industries: [],
    companies: [],
    characters: [],
    units: [],
    base_rate: 0.03,
    neutral_rate: 0.03,
    cycle: { phase: "Expansion", quarters_left: 1_000_000, g_t: 0, g_history: [], z_avg: 1 },
    ai: {
      stage: "Preboom",
      boom_date: { year: 2030, month: 1, day: 1 },
      pop_date: { year: 2040, month: 1, day: 1 },
      ai_labs_lt: 0,
      schedule: { preboom_lt: 0, boom_lt: [], bust_lt: 0, postcrash_lt: 0 },
    },
  } as unknown as World;
}

/** Companies in `minimalWorld` (the tests watch companies 3, 4 and 9). */
export const MINIMAL_COMPANIES = 12;

/** Finance books of a company that is out of the game. */
function removedFinance() {
  const f = companyFinanceAtLoad(0, RATING_WORST);
  f.distress.status = "Removed";
  return f;
}

/**
 * `clockWorld()` (so every registered job runs as a no-op on it) plus a few companies with only
 * `revenue_usd`: enough for the controls (WatchlistAdd checks the company table) and for the churn
 * job to write into a table the hash and the save cover. No units and no industries, so the ported
 * jobs, which walk units and industries, still find nothing to do.
 */
export function minimalWorld(): World {
  const w = clockWorld();
  // The ledger job reads the HQ country's tax rate before it looks at the company's status.
  w.countries = [{ corp_tax_rate: 0 }] as unknown as World["countries"];
  w.companies = Array.from({ length: MINIMAL_COMPANIES }, (_, i) => ({
    revenue_usd: 1e6 * (i + 1),
    // The finance, ops and economy jobs walk the companies. A Removed company is out of the game
    // (they all skip it), so the bare rows stay inert whatever else they lack.
    finance: removedFinance(),
    board: [],
    seats_to_fill: [],
    hq_country: 0,
    units: [],
  })) as unknown as World["companies"];
  // ledgerJob reads the home country's tax rate before it checks the company is in the game.
  w.countries = [{ corp_tax_rate: 0 }] as unknown as World["countries"];
  return w;
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
  // The minimal world has no industries (test_sim.ts header); the companies carry the draws there.
  const industry = world.industries[n % Math.max(world.industries.length, 1)];
  if (industry !== undefined) industry.world_size_2020_usd -= x;
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

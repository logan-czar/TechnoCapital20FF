// Port of crates/sim/tests/common/mod.rs: shared test helpers: the data, and test jobs
// (registered through the test hooks) that draw from every RNG stream and write into the world,
// so the determinism, save and hash tests have real state and real draws to check.
//
// Expects:
//   "@tc20ff/sim-data"       type WorldData
//   "@tc20ff/sim-data/node"  loadWorld, defaultDataDir
//   ../../../src/lib.ts      Sim (type), simNew(data, seed) -> Result<Sim, LoadError>,
//                            simRegisterTestJob(sim, slot, name, job)   [Sim::register_test_job]
//   ../../../src/time        type JobCtx { facts: TickFacts, draws: DrawSource, ... },
//                            raiseAlert(ctx, kind, payload) [JobCtx::raise_alert]
//   ../../src/types/views/estimate.ts  type Figure (the Figure::Exact / Figure::Band enum)
import type { WorldData } from "@tc20ff/sim-data";
import { defaultDataDir, loadWorld } from "@tc20ff/sim-data/node";
import { expect } from "vitest";
import { type Sim, simNew, simRegisterTestJob } from "../../src/lib.ts";
import type { JobCtx } from "../../src/time/scheduler.ts";
import { jobCtxRaiseAlert } from "../../src/time/scheduler.ts";
import type { CompanyId, IndustryId } from "../../src/types/ids.ts";
import type { Figure } from "../../src/types/views/estimate.ts";
import type { Result, World } from "../../src/types/world.ts";

/** Rust .unwrap() / .expect(): a Result in a test is its value or a thrown error. */
export function unwrap<T, E>(r: Result<T, E>, what = "unwrap"): T {
  if (!r.ok) throw new Error(`${what}: ${JSON.stringify(r.error)}`);
  return r.value;
}

let cached: WorldData | undefined;

/** The starting data, loaded once; every call returns its own copy (Rust loads a fresh value). */
export function data(): WorldData {
  if (cached === undefined) cached = unwrap(loadWorld(defaultDataDir()), "data loads");
  return structuredClone(cached);
}

/**
 * A new game with the churn job in the hourly alerts slot, which runs on every tick (the share
 * price slot skips 1 January and release ticks).
 */
export function churningSim(d: WorldData, seed: number): Sim {
  const sim = unwrap(simNew(structuredClone(d), seed), "Sim::new");
  simRegisterTestJob(sim, "Alerts", "test.churn", churn);
  return sim;
}

/**
 * Draws from all five streams (one normal a tick, so the Box-Muller spare is often pending at a
 * save) and folds the draws into one company revenue and one industry size.
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
  const company = world.companies[n % world.companies.length];
  if (company === undefined) throw new Error("no companies");
  company.revenue_usd += x;
  const industry = world.industries[n % world.industries.length];
  if (industry === undefined) throw new Error("no industries");
  industry.world_size_2020_usd -= x;
}

/** Draws from every stream and writes nothing: only the RNG positions move. */
export function drawOnly(_world: World, ctx: JobCtx): void {
  for (const s of ["Cycle", "Growth", "Prices", "Ai", "Gen"] as const) {
    ctx.draws.nextU32(s);
  }
}

/**
 * Raises Bankruptcy in watchlist for companies 3 and 4 every day, as a finance job would for
 * every bankrupt company (spec 4.3 step 13); the watchlist filter decides what fires.
 */
export function bankruptThreeAndFour(_world: World, ctx: JobCtx): void {
  for (const id of [3, 4] as CompanyId[]) {
    jobCtxRaiseAlert(ctx, "BankruptcyInWatchlist", { kind: "Company", company: id });
  }
}

/**
 * Checks a view figure against the truth (D420): exact and equal for a company that publishes;
 * for one that does not, a band holding the truth strictly inside, with an estimate that is not
 * the truth. Figure is { kind: "Exact"; value } | { kind: "Band"; band } (views/estimate.ts).
 */
export function assertFigure(f: Figure, truth: number, banded: boolean, what: string): void {
  if (f.kind === "Exact" && !banded) {
    expect(f.value, what).toBe(truth);
  } else if (f.kind === "Band" && banded) {
    const b = f.band;
    expect(b.low < truth && truth < b.high, `${what}: ${truth} outside ${JSON.stringify(b)}`).toBe(true);
    expect(b.estimate !== truth && b.low !== truth && b.high !== truth, what).toBe(true);
  } else {
    throw new Error(`${what}: ${JSON.stringify(f)} with banded ${banded}`);
  }
}

/** Iterates a table as [id, row] pairs in id order (Rust Table::iter). */
export function idRows<Id extends number, Row>(table: readonly Row[]): [Id, Row][] {
  return table.map((r, i) => [i as Id, r]);
}

/** The row with this id (Rust table[id], which panics out of range). */
export function rowOf<Id extends number, Row>(table: readonly Row[], id: Id): Row {
  const r = table[id];
  if (r === undefined) throw new RangeError(`no row ${id}`);
  return r;
}

/** IndustryId from an index, for the churn job and the like. */
export const industryId = (i: number): IndustryId => i as IndustryId;

/**
 * Rust f64 == on every numeric field of two plain records (nested records and arrays included):
 * returns the path of the first difference, or null when equal. toEqual would tell 0 from -0
 * (it compares with Object.is), which Rust == does not, so tests that assert_eq on money use this.
 */
export function numbersDiffer(a: unknown, b: unknown, path = ""): string | null {
  if (typeof a === "number" && typeof b === "number") {
    return a === b || (Number.isNaN(a) && Number.isNaN(b)) ? null : `${path}: ${a} vs ${b}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = numbersDiffer(a[i], b[i], `${path}[${i}]`);
      if (d !== null) return d;
    }
    return null;
  }
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join(",") !== kb.join(",")) return `${path}: keys ${ka.join(",")} vs ${kb.join(",")}`;
    for (const k of ka) {
      const d = numbersDiffer(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
        `${path}.${k}`,
      );
      if (d !== null) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: ${String(a)} vs ${String(b)}`;
}

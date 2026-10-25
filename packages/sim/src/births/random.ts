// Random startup events (spec 5.19.1, T): how many at each plan lock (Poisson, mean 2), which
// industry (weighted), which type (the type table), the HQ province and each startup's target
// revenue and cast size. All draws are gen-stream draws (5.19). Ported from
// crates/sim/src/births/random.rs.
//
// Draw order, frozen (D267): the count; then per event: the industry pick, the type, the number of
// startups (hot cluster only), the HQ province (one per event: a hot cluster puts all its startups
// in one province); then per startup: the target revenue, the full count, the partial count. A
// range of one value (a Garage founder's 1 full character) draws nothing.
//
// CountRange, EventType and EventKind are in types/state/births.ts.

import type { DrawSource } from "../types/draws.ts";
import type { IndustryId, ProvinceId } from "../types/ids.ts";
import type { CountRange, EventKind, EventType } from "../types/state/births.ts";
import { USD_PER_MILLION } from "../types/world.ts";
import { weightedPick } from "./weights.ts";

export type { CountRange, EventKind, EventType };
export { USD_PER_MILLION };

/**
 * Spec 5.19.1: the number of random events at each plan lock is Poisson with mean 2 (about 8 a
 * year), flat: the boom shows through the industry weights and the fixed events.
 */
export const RANDOM_EVENTS_MEAN = 2.0;

/** Rust `CountRange::new`. */
export function countRangeNew(lo: number, hi: number): CountRange {
  return { lo, hi };
}

/** A uniform integer in the range (gen stream); a one-value range draws nothing (D267). */
export function countRangeDraw(r: CountRange, draws: DrawSource): number {
  if (r.lo >= r.hi) return r.lo;
  return draws.intInclusive("Gen", r.lo, r.hi);
}

/** One row of the 5.19.1 type table (T). */
export interface TypeRow {
  kind: EventType;
  chance: number;
  startups: CountRange;
  /** Revenue each, $M a year. */
  revenue_musd: [number, number];
  full: CountRange;
  partial: CountRange;
}

/** Spec 5.19.1 type table (T), in table order; the chances sum to 1. */
export const TYPE_TABLE: readonly TypeRow[] = [
  {
    kind: "GarageFounder",
    chance: 0.5,
    startups: countRangeNew(1, 1),
    revenue_musd: [5.0, 20.0],
    full: countRangeNew(1, 1),
    partial: countRangeNew(1, 3),
  },
  {
    kind: "SpinOutTeam",
    chance: 0.3,
    startups: countRangeNew(1, 1),
    revenue_musd: [10.0, 50.0],
    full: countRangeNew(2, 3),
    partial: countRangeNew(2, 4),
  },
  {
    kind: "HotCluster",
    chance: 0.15,
    startups: countRangeNew(2, 3),
    revenue_musd: [5.0, 30.0],
    full: countRangeNew(1, 2),
    partial: countRangeNew(1, 3),
  },
  {
    kind: "BackedVenture",
    chance: 0.05,
    startups: countRangeNew(1, 1),
    revenue_musd: [30.0, 50.0],
    full: countRangeNew(3, 5),
    partial: countRangeNew(3, 5),
  },
];

/** The type's 5.19.1 row (Rust `EventType::row`). */
export function eventTypeRow(t: EventType): TypeRow {
  const row = TYPE_TABLE.find((r) => r.kind === t);
  if (row === undefined) throw new Error("every type has a row");
  return row;
}

/** Rust `EventType::name`. */
export function eventTypeName(t: EventType): string {
  switch (t) {
    case "GarageFounder":
      return "Garage founder";
    case "SpinOutTeam":
      return "Spin-out team";
    case "HotCluster":
      return "Hot cluster";
    case "BackedVenture":
      return "Backed venture";
  }
}

/**
 * The type table's cumulative chances, written out so the edges are exact (0.5 + 0.3 + 0.15 is
 * 0.9500000000000001 in f64).
 */
export const TYPE_CUMULATIVE: readonly number[] = [0.5, 0.8, 0.95, 1.0];

/** Draws an event type (spec 5.19.1): one gen uniform against the cumulative chances in table order. */
export function drawType(draws: DrawSource): EventType {
  const u = draws.uniform("Gen");
  for (let i = 0; i < TYPE_TABLE.length; i++) {
    if (u < (TYPE_CUMULATIVE[i] as number)) return (TYPE_TABLE[i] as TypeRow).kind;
  }
  return (TYPE_TABLE[TYPE_TABLE.length - 1] as TypeRow).kind;
}

/** The number of random events at a plan lock (spec 5.19.1): Poisson with mean 2 (Knuth, gen stream). */
export function eventCount(draws: DrawSource): number {
  return draws.poisson("Gen", RANDOM_EVENTS_MEAN);
}

/** A target revenue log-uniform in `lo..hi` USD (spec 5.19.3), from one gen uniform. */
export function drawTargetRevenue(lo_usd: number, hi_usd: number, draws: DrawSource): number {
  const u = draws.uniform("Gen");
  return Math.exp(Math.log(lo_usd) + u * (Math.log(hi_usd) - Math.log(lo_usd)));
}

/** One startup an event asks for, before the 5.19.3 size cap and build. */
export interface StartupDraft {
  industry: IndustryId;
  hq: ProvinceId;
  /** Log-uniform in the event's range, USD a year, before the 2% fringe cap (5.19.3). */
  target_revenue_usd: number;
  /** Whole number (u8). */
  full: number;
  /** Whole number (u8). */
  partial: number;
}

/** An event before its startups are built (spec 5.19). */
export interface EventDraft {
  kind: EventKind;
  startups: StartupDraft[];
}

/**
 * One random event (spec 5.19.1). `industry_weights` are the 5.19.1 weights of every industry in
 * id order; `hq_candidates(industry)` gives the provinces with their HQ weights (`hqWeight`) in id
 * order. null when every industry weighs 0 (all Glut or Bust; D261) or no province has weight: the
 * event does not fire.
 */
export function drawRandomEvent(
  industry_weights: readonly (readonly [IndustryId, number])[],
  hq_candidates: (industry: IndustryId) => [ProvinceId, number][],
  draws: DrawSource,
): EventDraft | null {
  const weights = industry_weights.map(([, w]) => w);
  const pick = weightedPick(weights, draws);
  if (pick === null) return null;
  const industry = (industry_weights[pick] as readonly [IndustryId, number])[0];
  const kind = drawType(draws);
  const row = eventTypeRow(kind);
  const n = countRangeDraw(row.startups, draws);
  const sites = hq_candidates(industry);
  const site_weights = sites.map(([, w]) => w);
  const hq_pick = weightedPick(site_weights, draws);
  if (hq_pick === null) return null;
  const hq = (sites[hq_pick] as [ProvinceId, number])[0];
  const startups: StartupDraft[] = [];
  for (let k = 0; k < n; k++) {
    startups.push({
      industry,
      hq,
      target_revenue_usd: drawTargetRevenue(
        row.revenue_musd[0] * USD_PER_MILLION,
        row.revenue_musd[1] * USD_PER_MILLION,
        draws,
      ),
      full: countRangeDraw(row.full, draws),
      partial: countRangeDraw(row.partial, draws),
    });
  }
  return { kind: { kind: "Random", event_type: kind }, startups };
}

/**
 * The plan lock's random events (spec 5.19.1): the Poisson count, then each event in turn. Events
 * that do not fire (D261) are left out.
 */
export function drawRandomEvents(
  industry_weights: readonly (readonly [IndustryId, number])[],
  hq_candidates: (industry: IndustryId) => [ProvinceId, number][],
  draws: DrawSource,
): EventDraft[] {
  const count = eventCount(draws);
  const out: EventDraft[] = [];
  for (let k = 0; k < count; k++) {
    const e = drawRandomEvent(industry_weights, hq_candidates, draws);
    if (e !== null) out.push(e);
  }
  return out;
}

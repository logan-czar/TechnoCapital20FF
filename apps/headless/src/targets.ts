// `headless check DIR` (build-plan M10.2, M10.3, 4.4): every spec 10 balance, startup,
// character and listing target, per seed, from a soak's `years.csv` and `quarters.csv`.
// Ported from crates/headless/src/targets.rs.
//
// Each target reads only the columns named in its `evaluate`; each bound is a named constant
// citing its spec 10 line; choices where spec 10 is ambiguous are D320 to D334 (docs/build/
// decisions.md). A seed is PASS, FAIL or NA (the run does not cover the target's window). A
// target is MET when the share of evaluated seeds that pass reaches its required share: the
// share spec 10 names ("in 90% of seeds"), else every seed (D330), unless Logan restated it
// (D367). Two kinds differ (D365, D366): a pooled target is MET on its share of industry-runs
// over all seeds, and a waived one is reported per seed but marked WAIVED, not MET or NOT MET.
// docs/build/soak.md has the full definitions.
//
// Rust u32 / u8 / i32 columns are whole numbers here; u64 seeds are safe integers.
// Result<_, String> parse errors are thrown as Error (an expected bad-input error in a CLI tool;
// the callers print the message).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEMAND_TREND_BAND, M_CLAMP_QUARTERS, REVENUE_DEMAND_BAND, SPEC_11_2_WAIVED } from "./metrics.ts";

/**
 * Spec 10 "balance targets after 10 years": the 2020 to 2029 run, whose last year closes on
 * 1 January 2030 (the 2029 row).
 */
export const TEN_YEAR_FIRST = 2020;
export const TEN_YEAR_LAST = 2029;
/** Spec 10: "at least 85% of the 651 companies neither bankrupt nor removed" (D320). */
export const START_ALIVE_MIN = 0.85;
/** Spec 10: "median productivity 90 to 110" (D321). */
export const MEDIAN_PRODUCTIVITY: readonly [number, number] = [90.0, 110.0];
/**
 * Spec 10 as restated by Logan (D363 (a), design fix 363): industry revenue within ±30% of the
 * industry's own demand path. Replaces D322's ±30% of the trend path. The industries in
 * `metrics::SPEC_11_2_WAIVED` (Cloud) are judged apart and waived (D368).
 */
export const REVENUE_DEMAND_RATIO: readonly [number, number] = [
  1.0 - REVENUE_DEMAND_BAND,
  1.0 + REVENUE_DEMAND_BAND,
];
/** D363 (b): each industry's demand within ±55% of its trend path. */
export const DEMAND_TREND_RATIO: readonly [number, number] = [
  1.0 - DEMAND_TREND_BAND,
  1.0 + DEMAND_TREND_BAND,
];
/**
 * (T) Logan's ruling of 2026-10-21 on D363 (b) (D367, design fix 363): the ±55% band must hold
 * in 85% of seeds, not every seed (44 of 50 seeds were inside it; every miss is demand above
 * trend).
 */
export const DEMAND_TREND_SEED_SHARE = 0.85;
/** Spec 10: "no industry stuck at an M clamp for more than 8 quarters". */
export const M_CLAMP_MAX_RUN = M_CLAMP_QUARTERS;
/** Spec 10: "30% to 60% of releases are beats" (D323). */
export const BEAT_SHARE: readonly [number, number] = [0.3, 0.6];
/**
 * Spec 10 as restated by Logan (D365, design fixes 320 and 365): 90% of all industry-runs
 * (industries × seeds, pooled) have their 10-year average demand growth within ±3 pp of their
 * long-term rate (D324's measure; the band is `metrics::DEMAND_GROWTH_BAND_PP`). Replaces
 * "every industry within 3 pp in 90% of seeds".
 */
export const DEMAND_GROWTH_POOLED_SHARE = 0.9;
/** Spec 10: "10% to 25% of industry-quarters labeled Boom and 10% to 20% Bust" (D325). */
export const BOOM_SHARE: readonly [number, number] = [0.1, 0.25];
/** Bust as restated by Logan (D364, design fix 364): 8% to 22% in every seed (was 10% to 20%). */
export const BUST_SHARE: readonly [number, number] = [0.08, 0.22];
/** Spec 10: "6 to 15 startups a year on average in 2020 to 2029". */
export const STARTUPS_PER_YEAR: readonly [number, number] = [6.0, 15.0];
/** Spec 10: "15 to 50 AI labs startups in 2030 to 2035 in 80% of seeds" (D331: both years inclusive). */
export const AI_LABS_YEARS: readonly [number, number] = [2030, 2035];
export const AI_LABS_STARTUPS: readonly [number, number] = [15, 50];
export const AI_LABS_SEED_SHARE = 0.8;
/**
 * Spec 10 "the 30-year run": the rows 2020 to 2049. The every-year targets need all 30 and are
 * NA on a shorter run (D329).
 */
export const RUN_YEARS: readonly [number, number] = [2020, 2049];
/** Spec 10: "the named company count stays between 600 and 1,100 in every year of the 30-year run". */
export const NAMED_COMPANIES: readonly [number, number] = [600, 1100];
/** Spec 10: "60 to 250 listings in 30 years and no more than 12 in any year". */
export const LISTINGS_YEARS: readonly [number, number] = RUN_YEARS;
export const LISTINGS_TOTAL: readonly [number, number] = [60, 250];
export const LISTINGS_PER_YEAR_MAX = 12;
/** Spec 10: "10 to 30 starting private companies listed by the end of 2024 in 90% of seeds". */
export const START_PRIVATE_LISTED_BY = 2024;
export const START_PRIVATE_LISTED: readonly [number, number] = [10, 30];
export const START_PRIVATE_LISTED_SEED_SHARE = 0.9;
/** Spec 10 world population check: "100 to 300 full characters made per decade" (D332). */
export const DECADES: readonly (readonly [number, number])[] = [
  [2020, 2029],
  [2030, 2039],
  [2040, 2049],
];
export const FULL_PER_DECADE: readonly [number, number] = [100, 300];
/**
 * "Under 1,200 full characters in the world in 2050 (296 at start)": at the 1 January 2050
 * close (the 2049 row, D332).
 */
export const FULL_CHARACTERS_YEAR = 2049;
export const FULL_CHARACTERS_BELOW = 1200;
/** "Every startup has 1 to 5 full and 1 to 5 partial characters" (D326). */
export const CAST_FULL: readonly [number, number] = [1, 5];
export const CAST_PARTIAL: readonly [number, number] = [1, 5];
/** A target with no seed share in spec 10 must pass in every seed (D330). */
export const ALL_SEEDS = 1.0;

/** One `years.csv` row: the columns the targets read. */
export interface YearRow {
  year: number;
  start_alive_share: number;
  median_productivity: number;
  demand_dev_max_pp: number;
  demand_dev_out: number;
  startups: number;
  ai_lab_startups: number;
  named: number;
  listings: number;
  start_private_listed: number;
  full_made: number;
  full_characters: number;
  casts: number;
  cast_full: [number, number] | null;
  cast_simple: [number, number] | null;
  born_empty_seats_max: number;
}

/** One `quarters.csv` row: the columns the targets read. */
export interface QuarterRow {
  year: number;
  quarter: number;
  /** The quarter whose results were released in this quarter (year, quarter). */
  released: [number, number] | null;
  reports: number;
  beats: number;
  industry_months: number;
  boom_months: number;
  bust_months: number;
  industries: number;
  demand_trend_min: number;
  demand_trend_max: number;
  demand_trend_out_of_band: number;
  /**
   * The longest clamp run ending this quarter among the industries not waived (D366), and among
   * the waived ones.
   */
  m_clamp_max_run_counted: number;
  m_clamp_max_run_waived: number;
  /**
   * The revenue ÷ demand figures among the industries not waived (D368), and among the waived
   * ones.
   */
  rev_demand_min_counted: number;
  rev_demand_max_counted: number;
  rev_demand_out_counted: number;
  rev_demand_min_waived: number;
  rev_demand_max_waived: number;
  rev_demand_out_waived: number;
}

/** A seed's rows, years and quarters in order. */
export interface SeedData {
  years: YearRow[];
  quarters: QuarterRow[];
}

/** Rust `SeedData::default()`. */
export function seedDataNew(): SeedData {
  return { years: [], quarters: [] };
}

function seedYear(s: SeedData, y: number): YearRow | null {
  return s.years.find((r) => r.year === y) ?? null;
}

/** Every year row from `a` to `b`, or null if one is missing. */
function seedYearsIn(s: SeedData, [a, b]: readonly [number, number]): YearRow[] | null {
  const out: YearRow[] = [];
  for (let y = a; y <= b; y++) {
    const r = seedYear(s, y);
    if (r === null) return null;
    out.push(r);
  }
  return out;
}

/** Every quarter row of the years `a` to `b`, or null if one is missing. */
function seedQuartersIn(s: SeedData, [a, b]: readonly [number, number]): QuarterRow[] | null {
  const out: QuarterRow[] = [];
  for (let y = a; y <= b; y++) {
    for (let q = 1; q <= 4; q++) {
      const r = s.quarters.find((x) => x.year === y && x.quarter === q);
      if (r === undefined) return null;
      out.push(r);
    }
  }
  return out;
}

/**
 * The quarter rows whose release reports a quarter of the years `a` to `b` (one each), or null
 * if a reported quarter is missing (D323).
 */
function seedReleasesOf(s: SeedData, [a, b]: readonly [number, number]): QuarterRow[] | null {
  const out: QuarterRow[] = [];
  for (let y = a; y <= b; y++) {
    for (let q = 1; q <= 4; q++) {
      const r = s.quarters.find((x) => x.released !== null && x.released[0] === y && x.released[1] === q);
      if (r === undefined) return null;
      out.push(r);
    }
  }
  return out;
}

/**
 * A seed's result on one target: whether it passes, the measured value (the number the summary
 * aggregates) and a readable note.
 */
export interface Verdict {
  pass: boolean;
  value: number;
  measured: string;
  /** A pooled target's (passing, total) industry-runs in this seed (D365). */
  pool: [number, number] | null;
}

function verdict(pass: boolean, value: number, measured: string): Verdict {
  return { pass, value, measured, pool: null };
}

/** How a target's verdict is reached. */
export type Kind =
  /** MET when the share of evaluated seeds that pass reaches `required` (D330). */
  | "Seeds"
  /** MET when the share of industry-runs over all seeds that pass reaches `required` (D365). */
  | "Pooled"
  /** Reported per seed, never MET or NOT MET: a temporary waiver (D366). */
  | "Waived";

/** Rust `{:.n}` for an f64: fixed decimals, `inf`, `-inf`, `NaN`. */
export function fixed(x: number, digits: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (x === Number.POSITIVE_INFINITY) return "inf";
  if (x === Number.NEGATIVE_INFINITY) return "-inf";
  return x.toFixed(digits);
}

function within(v: number, [lo, hi]: readonly [number, number]): boolean {
  return v >= lo && v <= hi;
}

/**
 * Every industry-quarter's ratio inside `band`, from each quarter's (min, max, out of band); the
 * value is the worst `|ratio − 1|`.
 */
function bandVerdict(qs: Iterable<[number, number, number]>, band: readonly [number, number]): Verdict {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  let out = 0;
  for (const [a, b, n] of qs) {
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
    out += n;
  }
  const worst = Math.max(Math.abs(lo - 1.0), Math.abs(hi - 1.0));
  return verdict(
    out === 0 && within(lo, band) && within(hi, band),
    worst,
    `ratio ${fixed(lo, 3)} to ${fixed(hi, 3)}; ${out} industry-quarters out`,
  );
}

/** One spec 10 target. */
export interface Target {
  id: string;
  /** The spec 10 wording it checks. */
  spec: string;
  bound: string;
  /** The share of evaluated seeds (or, pooled, industry-runs) that must pass (D330, D365). */
  required: number;
  kind: Kind;
  /** Rust `eval`; null when the run does not cover the target's window. */
  evaluate: (s: SeedData) => Verdict | null;
}

const maxOf = (xs: number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => Math.max(a, b)));
const minOf = (xs: number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => Math.min(a, b)));
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/**
 * Every target, in spec 10 order (balance targets after 10 years, then the startup, character
 * and listing targets).
 */
export const TARGETS: readonly Target[] = [
  {
    id: "start_alive_10y",
    spec: "85%+ of the 651 neither bankrupt nor removed after 10 years",
    bound: ">= 0.85 at the 2029 close",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const r = seedYear(s, TEN_YEAR_LAST);
      if (r === null) return null;
      const v = r.start_alive_share;
      return verdict(v >= START_ALIVE_MIN, v, fixed(v, 4));
    },
  },
  {
    id: "median_productivity_10y",
    spec: "median productivity 90 to 110 after 10 years",
    bound: "90 to 110 at the 2029 close",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const r = seedYear(s, TEN_YEAR_LAST);
      if (r === null) return null;
      const v = r.median_productivity;
      return verdict(within(v, MEDIAN_PRODUCTIVITY), v, fixed(v, 2));
    },
  },
  {
    id: "industry_revenue_demand",
    spec: "industry revenue within ±30% of the industry's own demand path (D363; Cloud waived: D368)",
    bound: "every industry-quarter 2020-2029 in 0.70 to 1.30 of demand among the industries not waived",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const qs = seedQuartersIn(s, [TEN_YEAR_FIRST, TEN_YEAR_LAST]);
      if (qs === null) return null;
      return bandVerdict(
        qs.map((q): [number, number, number] => [
          q.rev_demand_min_counted,
          q.rev_demand_max_counted,
          q.rev_demand_out_counted,
        ]),
        REVENUE_DEMAND_RATIO,
      );
    },
  },
  {
    id: "industry_revenue_demand_cloud_waived",
    spec: "Cloud's revenue against its own demand path: waived until the spec 11.2 per-industry rework (D368)",
    bound: "every Cloud quarter 2020-2029 in 0.70 to 1.30 of demand (reported; not judged)",
    required: ALL_SEEDS,
    kind: "Waived",
    evaluate: (s) => {
      const qs = seedQuartersIn(s, [TEN_YEAR_FIRST, TEN_YEAR_LAST]);
      if (qs === null) return null;
      const v = bandVerdict(
        qs.map((q): [number, number, number] => [
          q.rev_demand_min_waived,
          q.rev_demand_max_waived,
          q.rev_demand_out_waived,
        ]),
        REVENUE_DEMAND_RATIO,
      );
      return { ...v, measured: `${SPEC_11_2_WAIVED.join(" ")} ${v.measured}` };
    },
  },
  {
    id: "industry_demand_trend",
    spec: "each industry's demand within ±55% of its trend path in 85% of seeds (D363; D367)",
    bound: "every industry-quarter 2020-2029 in 0.45 to 1.55 of trend",
    required: DEMAND_TREND_SEED_SHARE,
    kind: "Seeds",
    evaluate: (s) => {
      const qs = seedQuartersIn(s, [TEN_YEAR_FIRST, TEN_YEAR_LAST]);
      if (qs === null) return null;
      return bandVerdict(
        qs.map((q): [number, number, number] => [
          q.demand_trend_min,
          q.demand_trend_max,
          q.demand_trend_out_of_band,
        ]),
        DEMAND_TREND_RATIO,
      );
    },
  },
  {
    id: "m_clamp_8q",
    spec: "no industry stuck at an M clamp for more than 8 quarters (Cloud waived: D366)",
    bound: "longest run 2020-2029 <= 8 quarters among the industries not waived",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const qs = seedQuartersIn(s, [TEN_YEAR_FIRST, TEN_YEAR_LAST]);
      if (qs === null) return null;
      const run = maxOf(qs.map((q) => q.m_clamp_max_run_counted)) ?? 0;
      return verdict(run <= M_CLAMP_MAX_RUN, run, `${run} quarters`);
    },
  },
  {
    id: "m_clamp_8q_cloud_waived",
    spec: "Cloud's M clamp runs: waived until the spec 11.2 per-industry rework (D366)",
    bound: "longest Cloud run 2020-2029 <= 8 quarters (reported; not judged)",
    required: ALL_SEEDS,
    kind: "Waived",
    evaluate: (s) => {
      const qs = seedQuartersIn(s, [TEN_YEAR_FIRST, TEN_YEAR_LAST]);
      if (qs === null) return null;
      const run = maxOf(qs.map((q) => q.m_clamp_max_run_waived)) ?? 0;
      return verdict(run <= M_CLAMP_MAX_RUN, run, `${SPEC_11_2_WAIVED.join(" ")} ${run} quarters`);
    },
  },
  {
    id: "beat_share",
    spec: "30% to 60% of releases are beats",
    bound: "0.30 to 0.60 of reports for Q1 2020 to Q4 2029",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const qs = seedReleasesOf(s, [TEN_YEAR_FIRST, TEN_YEAR_LAST]);
      if (qs === null) return null;
      const reports = sum(qs.map((q) => q.reports));
      const beats = sum(qs.map((q) => q.beats));
      const v = beats / Math.max(reports, 1);
      return verdict(within(v, BEAT_SHARE), v, `${fixed(v, 4)} (${beats} of ${reports})`);
    },
  },
  {
    id: "demand_growth_pooled",
    spec: "90% of industry-runs (industries x seeds) have 10-year average demand growth within ±3 pp of their long-term rate (D365)",
    bound: "pooled share of industries within 3 pp at the 2029 close >= 0.90",
    required: DEMAND_GROWTH_POOLED_SHARE,
    kind: "Pooled",
    evaluate: (s) => {
      const r = seedYear(s, TEN_YEAR_LAST);
      if (r === null) return null;
      const q4 = s.quarters.find((q) => q.year === TEN_YEAR_LAST && q.quarter === 4);
      if (q4 === undefined) return null;
      const n = q4.industries;
      const withinN = Math.max(n - r.demand_dev_out, 0);
      const v = withinN / Math.max(n, 1);
      return {
        pass: v + 1e-9 >= DEMAND_GROWTH_POOLED_SHARE,
        value: v,
        measured: `${withinN} of ${n} within 3 pp; worst ${fixed(r.demand_dev_max_pp, 2)} pp`,
        pool: [withinN, n],
      };
    },
  },
  {
    id: "boom_share",
    spec: "10% to 25% of industry-quarters labeled Boom (2020-2029)",
    bound: "0.10 to 0.25 of industry-months in force 2020-2029",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const qs = seedQuartersIn(s, [TEN_YEAR_FIRST, TEN_YEAR_LAST]);
      if (qs === null) return null;
      const n = sum(qs.map((q) => q.industry_months));
      const k = sum(qs.map((q) => q.boom_months));
      const v = k / Math.max(n, 1);
      return verdict(within(v, BOOM_SHARE), v, fixed(v, 4));
    },
  },
  {
    id: "bust_share",
    spec: "8% to 22% of industry-quarters labeled Bust (2020-2029; D364)",
    bound: "0.08 to 0.22 of industry-months in force 2020-2029",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const qs = seedQuartersIn(s, [TEN_YEAR_FIRST, TEN_YEAR_LAST]);
      if (qs === null) return null;
      const n = sum(qs.map((q) => q.industry_months));
      const k = sum(qs.map((q) => q.bust_months));
      const v = k / Math.max(n, 1);
      return verdict(within(v, BUST_SHARE), v, fixed(v, 4));
    },
  },
  {
    id: "startups_per_year",
    spec: "6 to 15 startups a year on average in 2020 to 2029",
    bound: "mean 6 to 15 over 2020-2029",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const ys = seedYearsIn(s, [TEN_YEAR_FIRST, TEN_YEAR_LAST]);
      if (ys === null) return null;
      const v = sum(ys.map((y) => y.startups)) / ys.length;
      return verdict(within(v, STARTUPS_PER_YEAR), v, `${fixed(v, 1)} a year`);
    },
  },
  {
    id: "ai_lab_startups_2030_2035",
    spec: "15 to 50 AI labs startups in 2030 to 2035 in 80% of seeds",
    bound: "15 to 50 born 2030-2035",
    required: AI_LABS_SEED_SHARE,
    kind: "Seeds",
    evaluate: (s) => {
      const ys = seedYearsIn(s, AI_LABS_YEARS);
      if (ys === null) return null;
      const v = sum(ys.map((y) => y.ai_lab_startups));
      return verdict(within(v, AI_LABS_STARTUPS), v, `${v}`);
    },
  },
  {
    id: "named_companies",
    spec: "named company count between 600 and 1100 in every year",
    bound: "600 to 1100 at every year close 2020-2049",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const ys = seedYearsIn(s, RUN_YEARS);
      if (ys === null) return null;
      const named = ys.map((y) => y.named);
      const lo = minOf(named);
      const hi = maxOf(named);
      if (lo === null || hi === null) return null;
      const ok = ys.every((y) => within(y.named, NAMED_COMPANIES));
      return verdict(ok, hi, `${lo} to ${hi}`);
    },
  },
  {
    id: "listings_30y",
    spec: "60 to 250 listings in 30 years",
    bound: "60 to 250 listed 2020-2049",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const ys = seedYearsIn(s, LISTINGS_YEARS);
      if (ys === null) return null;
      const v = sum(ys.map((y) => y.listings));
      return verdict(within(v, LISTINGS_TOTAL), v, `${v}`);
    },
  },
  {
    id: "listings_per_year",
    spec: "no more than 12 listings in any year",
    bound: "<= 12 in every year 2020-2049",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const ys = seedYearsIn(s, RUN_YEARS);
      if (ys === null) return null;
      const v = maxOf(ys.map((y) => y.listings));
      if (v === null) return null;
      return verdict(v <= LISTINGS_PER_YEAR_MAX, v, `max ${v}`);
    },
  },
  {
    id: "start_private_listed_2024",
    spec: "10 to 30 starting private companies listed by the end of 2024 in 90% of seeds",
    bound: "10 to 30 at the 2024 close",
    required: START_PRIVATE_LISTED_SEED_SHARE,
    kind: "Seeds",
    evaluate: (s) => {
      const r = seedYear(s, START_PRIVATE_LISTED_BY);
      if (r === null) return null;
      const v = r.start_private_listed;
      return verdict(within(v, START_PRIVATE_LISTED), v, `${v}`);
    },
  },
  {
    id: "full_characters_per_decade",
    spec: "100 to 300 full characters made per decade",
    bound: "100 to 300 made in each of the 2020s 2030s and 2040s the run covers",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const made: [number, number][] = [];
      for (const [a, b] of DECADES) {
        let before = 0;
        if (a !== TEN_YEAR_FIRST) {
          const prev = seedYear(s, a - 1);
          if (prev === null) continue;
          before = prev.full_made;
        }
        const last = seedYear(s, b);
        // Rust checked_sub: a total below the year before is skipped.
        if (last === null || last.full_made < before) continue;
        made.push([a, last.full_made - before]);
      }
      if (made.length === 0) return null;
      const ok = made.every(([, n]) => within(n, FULL_PER_DECADE));
      // Rust min_by_key(Reverse(abs_diff(mid))): the first count furthest from the middle.
      const mid = Math.trunc((FULL_PER_DECADE[0] + FULL_PER_DECADE[1]) / 2);
      let worst = made[0]?.[1] ?? 0;
      for (const [, n] of made) {
        if (Math.abs(n - mid) > Math.abs(worst - mid)) worst = n;
      }
      const text = made.map(([a, n]) => `${a}s ${n}`);
      return verdict(ok, worst, text.join("; "));
    },
  },
  {
    id: "full_characters_2050",
    spec: "under 1200 full characters in the world in 2050",
    bound: "< 1200 at the 1 January 2050 close",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const r = seedYear(s, FULL_CHARACTERS_YEAR);
      if (r === null) return null;
      const v = r.full_characters;
      return verdict(v < FULL_CHARACTERS_BELOW, v, `${v}`);
    },
  },
  {
    id: "cast_sizes",
    spec: "every startup has 1 to 5 full and 1 to 5 partial characters",
    bound: "founders 1 to 5 and simple cast 1 to 5 at every birth",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const casts = sum(s.years.map((y) => y.casts));
      if (casts === 0) return null;
      const span = (f: (y: YearRow) => [number, number] | null): [number, number] => {
        const r: [number, number][] = [];
        for (const y of s.years) {
          const x = f(y);
          if (x !== null) r.push(x);
        }
        return [minOf(r.map((x) => x[0])) ?? 0, maxOf(r.map((x) => x[1])) ?? 0];
      };
      const full = span((y) => y.cast_full);
      const simple = span((y) => y.cast_simple);
      const ok =
        within(full[0], CAST_FULL) &&
        within(full[1], CAST_FULL) &&
        within(simple[0], CAST_PARTIAL) &&
        within(simple[1], CAST_PARTIAL);
      return verdict(
        ok,
        casts,
        `${casts} casts; full ${full[0]} to ${full[1]}; simple ${simple[0]} to ${simple[1]}`,
      );
    },
  },
  {
    id: "no_empty_labor_seat",
    spec: "no labor seat of a born company is empty",
    bound: "0 empty open seats at every birth and month close 2020-2049",
    required: ALL_SEEDS,
    kind: "Seeds",
    evaluate: (s) => {
      const ys = seedYearsIn(s, RUN_YEARS);
      if (ys === null) return null;
      const v = maxOf(ys.map((y) => y.born_empty_seats_max));
      if (v === null) return null;
      return verdict(v === 0, v, `max ${v} empty`);
    },
  },
];

/** A CSV table: its header and rows (no field holds a comma). */
interface Table {
  name: string;
  cols: string[];
  rows: string[][];
}

/** Rust `str::lines`, dropping the empty ones. */
function dataLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l !== "");
}

function tableParse(name: string, text: string): Table {
  const lines = dataLines(text);
  const header = lines[0];
  if (header === undefined) throw new Error(`${name}: empty`);
  const cols = header.split(",");
  const rows = lines.slice(1).map((l) => l.split(","));
  rows.forEach((r, i) => {
    if (r.length !== cols.length) {
      throw new Error(`${name}:${i + 2}: ${r.length} fields, header has ${cols.length}`);
    }
  });
  return { name, cols, rows };
}

function tableCol(t: Table, c: string): number {
  const i = t.cols.indexOf(c);
  if (i < 0) throw new Error(`${t.name}: no column \`${c}\``);
  return i;
}

/** Reads typed fields of one row by column name. */
interface Fields {
  table: Table;
  row: number;
}

function fieldRaw(f: Fields, c: string): string {
  const v = f.table.rows[f.row]?.[tableCol(f.table, c)];
  if (v === undefined) throw new Error(`${f.table.name}:${f.row + 2}: no column \`${c}\``);
  return v;
}

/** Rust `str::parse::<f64>`: also reads `inf`, `-inf` and `NaN`. */
export function parseF64(s: string): number | null {
  const t = s.toLowerCase();
  if (t === "inf" || t === "+inf" || t === "infinity" || t === "+infinity") return Number.POSITIVE_INFINITY;
  if (t === "-inf" || t === "-infinity") return Number.NEGATIVE_INFINITY;
  if (t === "nan" || t === "+nan" || t === "-nan") return Number.NaN;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(t)) return null;
  return Number(t);
}

function fieldGet(f: Fields, c: string, kind: "int" | "uint" | "float" = "uint"): number {
  const s = fieldRaw(f, c);
  let v: number | null;
  if (kind === "float") v = parseF64(s);
  else if (kind === "uint") v = /^\+?\d+$/.test(s) ? Number(s) : null;
  else v = /^[+-]?\d+$/.test(s) ? Number(s) : null;
  if (v === null) throw new Error(`${f.table.name}:${f.row + 2}: column \`${c}\`: cannot read \`${s}\``);
  return v;
}

function fieldOpt(f: Fields, c: string): number | null {
  return fieldRaw(f, c) === "" ? null : fieldGet(f, c);
}

function fieldPair(f: Fields, lo: string, hi: string): [number, number] | null {
  const a = fieldOpt(f, lo);
  const b = fieldOpt(f, hi);
  return a !== null && b !== null ? [a, b] : null;
}

/** `2019Q4` to [2019, 4]. */
export function parseQuarter(s: string): [number, number] | null {
  const i = s.indexOf("Q");
  if (i < 0) return null;
  const y = s.slice(0, i);
  const q = s.slice(i + 1);
  if (!/^[+-]?\d+$/.test(y) || !/^\+?\d+$/.test(q)) return null;
  return [Number(y), Number(q)];
}

/** Every seed's rows from the two tables' text, by seed (Rust BTreeMap: seed order). */
export function parse(years: string, quarters: string): Map<number, SeedData> {
  const out = new Map<number, SeedData>();
  const entry = (seed: number): SeedData => {
    let s = out.get(seed);
    if (s === undefined) {
      s = seedDataNew();
      out.set(seed, s);
    }
    return s;
  };
  const y = tableParse("years.csv", years);
  for (let row = 0; row < y.rows.length; row++) {
    const f: Fields = { table: y, row };
    const r: YearRow = {
      year: fieldGet(f, "year", "int"),
      start_alive_share: fieldGet(f, "start_alive_share", "float"),
      median_productivity: fieldGet(f, "median_productivity", "float"),
      demand_dev_max_pp: fieldGet(f, "demand_dev_max_pp", "float"),
      demand_dev_out: fieldGet(f, "demand_dev_out"),
      startups: fieldGet(f, "startups_in_year"),
      ai_lab_startups: fieldGet(f, "ai_lab_startups_in_year"),
      named: fieldGet(f, "named_companies"),
      listings: fieldGet(f, "listings_in_year"),
      start_private_listed: fieldGet(f, "start_private_listed"),
      full_made: fieldGet(f, "full_characters_made"),
      full_characters: fieldGet(f, "full_characters"),
      casts: fieldGet(f, "casts_in_year"),
      cast_full: fieldPair(f, "cast_full_min", "cast_full_max"),
      cast_simple: fieldPair(f, "cast_simple_min", "cast_simple_max"),
      born_empty_seats_max: fieldGet(f, "born_empty_seats_max"),
    };
    entry(fieldGet(f, "seed")).years.push(r);
  }
  const q = tableParse("quarters.csv", quarters);
  for (let row = 0; row < q.rows.length; row++) {
    const f: Fields = { table: q, row };
    const released = fieldRaw(f, "released");
    let rel: [number, number] | null = null;
    if (released !== "") {
      rel = parseQuarter(released);
      if (rel === null) {
        throw new Error(`quarters.csv:${row + 2}: column \`released\`: cannot read \`${released}\``);
      }
    }
    const r: QuarterRow = {
      year: fieldGet(f, "year", "int"),
      quarter: fieldGet(f, "quarter"),
      released: rel,
      reports: fieldGet(f, "reports"),
      beats: fieldGet(f, "beats"),
      industry_months: fieldGet(f, "industry_months"),
      boom_months: fieldGet(f, "boom_months"),
      bust_months: fieldGet(f, "bust_months"),
      industries: fieldGet(f, "industries"),
      demand_trend_min: fieldGet(f, "demand_trend_min", "float"),
      demand_trend_max: fieldGet(f, "demand_trend_max", "float"),
      demand_trend_out_of_band: fieldGet(f, "demand_trend_out_of_band"),
      m_clamp_max_run_counted: fieldGet(f, "m_clamp_max_run_counted"),
      m_clamp_max_run_waived: fieldGet(f, "m_clamp_max_run_waived"),
      rev_demand_min_counted: fieldGet(f, "rev_demand_min_counted", "float"),
      rev_demand_max_counted: fieldGet(f, "rev_demand_max_counted", "float"),
      rev_demand_out_counted: fieldGet(f, "rev_demand_out_counted"),
      rev_demand_min_waived: fieldGet(f, "rev_demand_min_waived", "float"),
      rev_demand_max_waived: fieldGet(f, "rev_demand_max_waived", "float"),
      rev_demand_out_waived: fieldGet(f, "rev_demand_out_waived"),
    };
    entry(fieldGet(f, "seed")).quarters.push(r);
  }
  const sorted = new Map<number, SeedData>();
  for (const seed of [...out.keys()].sort((a, b) => a - b)) {
    const s = out.get(seed) as SeedData;
    s.years.sort((a, b) => a.year - b.year);
    s.quarters.sort((a, b) => a.year - b.year || a.quarter - b.quarter);
    sorted.set(seed, s);
  }
  return sorted;
}

/** One target's results across the seeds. */
export interface Summary {
  id: string;
  spec: string;
  kind: Kind;
  /** Seeds evaluated and passed; for a pooled target, industry-runs (D365). */
  evaluated: number;
  passed: number;
  required: number;
  /** min, median and max of the measured values over the evaluated seeds. */
  values: [number, number, number] | null;
}

/** Rust `Summary::share`. */
export function summaryShare(s: Summary): number | null {
  return s.evaluated > 0 ? s.passed / s.evaluated : null;
}

/** Rust `Summary::verdict`: "MET", "NOT MET", "WAIVED" (D366) or "n/a" (no seed covers the window). */
export function summaryVerdict(s: Summary): "MET" | "NOT MET" | "WAIVED" | "n/a" {
  const share = summaryShare(s);
  if (share === null) return "n/a";
  if (s.kind === "Waived") return "WAIVED";
  // A tiny slack so 9 of 10 seeds meets 90% despite float division.
  return share + 1e-9 >= s.required ? "MET" : "NOT MET";
}

/** Ascending order for the measured values (finite or infinite; NaN last). */
function cmpValue(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  if (a === b) return 0;
  return Number.isNaN(a) ? (Number.isNaN(b) ? 0 : 1) : -1;
}

/**
 * `targets.csv` (one row per target per seed, targets in [`TARGETS`] order, seeds ascending)
 * and the summaries.
 */
export function evaluate(seeds: ReadonlyMap<number, SeedData>): [string, Summary[]] {
  let csv = "target,seed,result,measured,bound\n";
  const summaries: Summary[] = [];
  const order = [...seeds.keys()].sort((a, b) => a - b);
  for (const t of TARGETS) {
    let evaluated = 0;
    let passed = 0;
    const values: number[] = [];
    for (const seed of order) {
      const data = seeds.get(seed) as SeedData;
      const v = t.evaluate(data);
      let result: string;
      let measured: string;
      if (v !== null) {
        if (t.kind === "Pooled" && v.pool !== null) {
          evaluated += v.pool[1];
          passed += v.pool[0];
        } else {
          evaluated += 1;
          passed += v.pass ? 1 : 0;
        }
        values.push(v.value);
        result = v.pass ? "PASS" : "FAIL";
        measured = v.measured;
      } else {
        result = "NA";
        measured = "";
      }
      csv += `${t.id},${seed},${result},${measured},${t.bound}\n`;
    }
    values.sort(cmpValue);
    summaries.push({
      id: t.id,
      spec: t.spec,
      kind: t.kind,
      evaluated,
      passed,
      required: t.required,
      values:
        values.length > 0
          ? [
              values[0] as number,
              values[Math.trunc(values.length / 2)] as number,
              values[values.length - 1] as number,
            ]
          : null,
    });
  }
  return [csv, summaries];
}

/** The summary as CSV (`summary.csv`). */
export function summaryCsv(summaries: readonly Summary[]): string {
  let out = "target,evaluated,passed,pass_share,required_share,verdict,value_min,value_median,value_max\n";
  for (const s of summaries) {
    const [lo, mid, hi] = s.values === null ? ["", "", ""] : s.values.map((x) => fixed(x, 4));
    const share = summaryShare(s);
    out += `${s.id},${s.evaluated},${s.passed},${share === null ? "" : fixed(share, 2)},${fixed(s.required, 2)},${summaryVerdict(s)},${lo},${mid},${hi},${s.spec}\n`;
  }
  return out;
}

/** The printed summary table (Rust `print_summary`), as lines. */
export function summaryTable(summaries: readonly Summary[], seeds: number): string[] {
  const lines = [`${seeds} seeds`];
  lines.push(
    `${"target".padEnd(36)} ${"passed".padStart(6)} ${"of".padStart(6)} ${"share".padStart(8)} ${"needed".padStart(8)}  ${"min".padStart(10)} ${"median".padStart(10)} ${"max".padStart(10)}`,
  );
  for (const s of summaries) {
    const [lo, mid, hi] = s.values ?? [Number.NaN, Number.NaN, Number.NaN];
    const share = summaryShare(s);
    lines.push(
      `${s.id.padEnd(36)} ${String(s.passed).padStart(6)} ${String(s.evaluated).padStart(6)} ${(share === null ? "-" : fixed(share, 2)).padStart(8)} ${fixed(s.required, 2).padStart(8)}  ${fixed(lo, 4).padStart(10)} ${fixed(mid, 4).padStart(10)} ${fixed(hi, 4).padStart(10)}  ${summaryVerdict(s)}`,
    );
  }
  return lines;
}

/** `check DIR`: reads the two tables, writes `targets.csv` and `summary.csv`, prints the summary. */
export function checkDir(dir: string): void {
  const read = (name: string): string => {
    const p = join(dir, name);
    try {
      return readFileSync(p, "utf8");
    } catch (e) {
      throw new Error(`${p}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const seeds = parse(read("years.csv"), read("quarters.csv"));
  const [csv, summaries] = evaluate(seeds);
  for (const [name, text] of [
    ["targets.csv", csv],
    ["summary.csv", summaryCsv(summaries)],
  ] as const) {
    writeFileSync(join(dir, name), text);
  }
  for (const l of summaryTable(summaries, seeds.size)) console.log(l);
  console.log(`wrote ${join(dir, "targets.csv")}`);
}

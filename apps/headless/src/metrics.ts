// One seed's metrics rows for `run` and `soak` (build-plan M1.8, M10.1, 4.4): a row per year
// (`years.csv`) and a row per quarter (`quarters.csv`), read through the public sim API and
// `SimViews` only (spec 9). docs/build/soak.md defines every column. Ported from
// crates/headless/src/metrics.rs.
//
// Everything written here is deterministic for a seed: views are read in id order and nothing
// iterates a hash map. Wall time is kept out of both tables (`SeedOutput.wall_ms`).
//
// Seams (the sim is built behind an interface so this typechecks before the Sim is ported):
// - `soak_stats()` (Rust feature `soak-stats`, D427) is not on `SimApi`: `SoakSimApi` is a
//   `SimApi` that also serves it; the default factory (factory.ts) serves the Sim's
//   `simSoakStats` (@tc20ff/sim/internal).
// - `Sim::new(data, seed)` is the injected `SimFactory` (factory.ts `defaultFactory`: `simNew`).
// - `Sim::step_observed` (profiling) and the per-step timing of `--tick-costs` are the optional
//   `stepper` and `onTick` of `RunOptions`; the `--detail` recorder is a `DetailHook`.

import type { DateTime, LoadError, Rating, SoakIndustry, SoakStats } from "@tc20ff/sim/internal";
import {
  type CompanyStatus,
  dateTimeMidnight,
  EPOCH_YEAR,
  formatDateTime,
  formatMonth,
  maxF,
  type Notice,
  type PhaseLabel,
  type Quarter,
  type RatingBand,
  type Result,
  type SimApi,
  simDateYmd,
} from "@tc20ff/sim/internal";
import type { WorldData } from "@tc20ff/sim-data";

/**
 * `years.csv` header: one row per seed per year, written at the year's December close (the
 * 1 January 00:00 tick that closes it). Rows of a seed are in year order.
 *
 * - M1 to M5 (built with those milestones): ticks in the year, the state hash at the close, the
 *   cycle phase and g_t, the year's named and fringe revenue, S and M across the 42 industries,
 *   mean productivity and management, data held, the profitable share, the M4 books counts and
 *   rating bands, and the M5 market figures (quoted count, median gap, tracking share, mean
 *   confidence, four headline index levels).
 * - M6 (D166) and M10 (D320 to D334): the startup, listing, character and balance columns the
 *   spec 10 targets read; see docs/build/soak.md for each.
 */
export const YEARS_HEADER =
  "seed,year,ticks,state_hash,phase,g_t,named_revenue_usd,fringe_revenue_usd,mean_s,min_s,max_s,mean_m," +
  "mean_productivity,mean_management,data_tb,profitable_share,distressed_in_year,distressed,bankrupt," +
  "removed,bankruptcies_in_year,removals_in_year,active_share,line_drawn_usd,ratings,quoted,median_gap," +
  "tracking_share,mean_confidence,index_atx,index_cbx,index_hse,index_ese,events_in_year," +
  "startups_in_year,ai_lab_startups_in_year,listings_in_year,start_private_listed,named_companies," +
  "start_active_share,start_alive_share,beat_share,miss_share,boom_share,bust_share,m_clamp_over_8q," +
  "max_m_clamp_quarters,full_characters_made,full_characters,median_productivity,demand_dev_max_pp," +
  "demand_dev_out,casts_in_year,cast_full_min,cast_full_max,cast_simple_min,cast_simple_max," +
  "born_empty_seats_max";

/**
 * `quarters.csv` header: one row per seed per calendar quarter, written at the close of the
 * quarter's last month (the 1st of the next quarter, 00:00). Rows of a seed are in quarter order.
 */
export const QUARTERS_HEADER =
  "seed,year,quarter,released,reports,beats,misses,industries,industry_months,boom_months,bust_months," +
  "rev_ratio_min,rev_ratio_max,rev_out_of_band,m_clamp_industries,m_clamp_max_run,m_clamp_over_8q," +
  "rev_demand_min,rev_demand_max,rev_demand_out_of_band,demand_trend_min,demand_trend_max," +
  "demand_trend_out_of_band,m_clamp_max_run_counted,m_clamp_max_run_waived,rev_demand_min_counted," +
  "rev_demand_max_counted,rev_demand_out_counted,rev_demand_min_waived,rev_demand_max_waived," +
  "rev_demand_out_waived";

/** Spec 5.2 M clamp edges (crates/sim/src/economy/supply.rs `M_MIN`, `M_MAX`; economy not ported here). */
export const M_MIN = 0.7;
export const M_MAX = 1.3;
/** sim::economy `MONTHS_PER_YEAR` and `MONTHS_PER_QUARTER`. */
const MONTHS_PER_YEAR = 12;
const MONTHS_PER_QUARTER = 3;

/** Spec 10: no industry "stuck at an M clamp (spec 5.2, `M_MIN` and `M_MAX`) for more than 8 quarters". */
export const M_CLAMP_QUARTERS = 8;
/** How close to a clamp edge counts as at it (M is clamped exactly; float slack only). */
const M_CLAMP_EPSILON = 1e-12;

/**
 * Spec 10: "industry revenue within ±30% of the trend path" (D322): a quarter's revenue over
 * its trend revenue outside `1 ± 0.30` is out of band. Kept as columns; the targets read D363's
 * two bands below instead.
 */
export const REVENUE_TREND_BAND = 0.3;

/**
 * Spec 10 as restated by Logan (M10.7 sign-off, D363 (a), design fix 363): "industry revenue
 * within ±30% of the industry's own demand path": a quarter's revenue over a twelfth of its
 * effective demand at the same closes outside `1 ± 0.30` is out of band.
 */
export const REVENUE_DEMAND_BAND = 0.3;

/**
 * D363 (b): each industry's effective demand within ±55% of its trend path (the review's
 * figure): a quarter's demand over its trend demand at the same closes outside `1 ± 0.55` is
 * out of band.
 */
export const DEMAND_TREND_BAND = 0.55;

/**
 * Industries waived until the spec 11.2 per-industry rework of Cloud's 20% pre-boom growth,
 * from two targets: "no industry stuck at an M clamp for more than 8 quarters" (D366, design
 * fix 366) and "industry revenue within ±30% of the industry's own demand path" (D368, design
 * fix 363). Their figures are still recorded and reported on their own rows.
 */
export const SPEC_11_2_WAIVED: readonly string[] = ["cloud"];

/**
 * Spec 10: "each industry's 10-year average demand growth within ±3 pp of its long-term rate"
 * (D324), in percentage points a year.
 */
export const DEMAND_GROWTH_BAND_PP = 3.0;

/**
 * Calendar month numbers: a quarter's last month is a multiple of this, and December is the
 * year's last (sim::economy's month counts, which are f64 rates there).
 */
const QUARTER_MONTHS = MONTHS_PER_QUARTER;
const DECEMBER = MONTHS_PER_YEAR;

/** The `ai_labs` industry key (industries.csv), for the spec 10 AI labs startup target. */
const AI_LABS_KEY = "ai_labs";

/**
 * The headline exchanges whose index levels the metrics show: North America, the EU, China and
 * Japan (financial-zones.csv `exchange_code`).
 */
const INDEX_COLUMNS = ["ATX", "CBX", "HSE", "ESE"] as const;

// The engine's true totals for the headless soak (D427): packages/sim/src/soak.ts. Never a view:
// a private company's figures are estimate bands in every view (D420, D432).
export type { SoakIndustry, SoakStats } from "@tc20ff/sim/internal";

/** A `SimApi` that also serves the soak totals (Rust `Sim` with the `soak-stats` feature). */
export interface SoakSimApi extends SimApi {
  soakStats(): SoakStats;
}

/** `Sim::new(data, seed)`: injected by the runner (wired to the Sim port's `simNew`). */
export type SimFactory = (data: WorldData, seed: number) => Result<SoakSimApi, LoadError>;

/** Rust `Display for LoadError` (world/load.rs). */
export function loadErrorToString(e: LoadError): string {
  switch (e.kind) {
    case "Duplicate":
      return `${e.table}: id \`${e.key}\` appears twice`;
    case "MissingRef":
      return `${e.table} \`${e.key}\`: ${e.field} \`${e.value}\` is not a known ${e.target}`;
    case "BadValue":
      return `${e.table} \`${e.key}\`: ${e.message}`;
  }
}

/** The `--detail` recorder (D900), read after the metrics at each close; `out` holds its tables. */
export interface DetailHook<D = unknown> {
  monthClose(sim: SoakSimApi): void;
  yearClose(sim: SoakSimApi, year: number): void;
  readonly out: D;
}

/** One seed's run: its two tables (rows only, no header) and its timing. */
export interface SeedOutput<D = unknown> {
  seed: number;
  years: string;
  quarters: string;
  ticks: number;
  /** Wall time of the seed from `Sim::new` to its last tick (not part of either table). */
  wall_ms: number;
  state_hash: string;
  /** The clock at the end (`2050-01-01 00:00`). */
  end: string;
  /** The `--detail` tables (D900), when asked for. */
  detail: D | null;
  /**
   * The largest `shares_out` any company showed at a month close (D951: share counts must stay
   * safe integers). Not in either table; `sharesOutCsv` writes it for the parity checker.
   */
  max_shares_out: number;
}

/** `shares_out.csv`: the largest share count per seed, read by `headless parity` (D951). */
export function sharesOutCsv(outputs: readonly { seed: number; max_shares_out: number }[]): string {
  const lines = outputs.map((o) => `${o.seed},${o.max_shares_out}`);
  return ["seed,max_shares_out", ...lines, ""].join(String.fromCharCode(10));
}

/** The optional hooks of `runSeed` (Rust passes the profiler, tick costs and detail flag). */
export interface RunOptions<D = unknown> {
  /** `run --hash-monthly` (M1.9): prints the state hash after each month close. */
  hashMonthly?: boolean;
  /** Replaces `sim.step()` (`run --profile`: `Sim::step_observed`, M10.6, D400). */
  stepper?: (sim: SoakSimApi) => Notice[];
  /** Called after every step with the clock and the step's wall ms (profile and `--tick-costs`, D801). */
  onTick?: (now: DateTime, elapsedMs: number) => void;
  /** The `soak --detail` recorder (D900), which changes no row or hash. */
  detail?: DetailHook<D> | null;
}

/**
 * Runs `seed` from the start state for `years` years (to 1 January of 2020 + years, 00:00)
 * through `step` only, recording both tables. Returns the load error's text if the sim cannot be
 * built (Rust `Result<_, String>`).
 */
export function runSeed<D = unknown>(
  factory: SimFactory,
  data: WorldData,
  seed: number,
  years: number,
  opts: RunOptions<D> = {},
): Result<SeedOutput<D>, string> {
  const start = performance.now();
  const made = factory(structuredClone(data), seed);
  if (!made.ok) return { ok: false, error: loadErrorToString(made.error) };
  const sim = made.value;
  const end = dateTimeMidnight(simDateYmd(EPOCH_YEAR + years, 1, 1));
  const rec = recorderNew(sim, seed);
  rec.detail = opts.detail ?? null;
  const hashMonthly = opts.hashMonthly ?? false;
  let ticks = 0;
  while (sim.now() < end) {
    ticks += 1;
    rec.year_ticks += 1;
    const t = performance.now();
    const notices = opts.stepper === undefined ? sim.step() : opts.stepper(sim);
    opts.onTick?.(sim.now(), performance.now() - t);
    for (const n of notices) recorderNotice(rec, sim, n, hashMonthly);
  }
  return {
    ok: true,
    value: {
      seed,
      years: rec.years,
      quarters: rec.quarters,
      ticks,
      wall_ms: Math.trunc(performance.now() - start),
      state_hash: sim.stateHash(),
      end: formatDateTime(sim.now()),
      detail: rec.detail === null ? null : (rec.detail.out as D),
      max_shares_out: rec.max_shares_out,
    },
  };
}

/**
 * Consecutive quarters each industry has sat at an M clamp, counted at each quarter's last
 * month close (D166: M is 0.7 or 1.3 at that close).
 */
export interface ClampRuns {
  run: number[];
  /** The industry's run has ever passed 8 quarters. */
  over: boolean[];
  /** The longest run seen so far, any industry. */
  max_run: number;
}

/** Rust `ClampRuns::default()`. */
export function clampRunsNew(): ClampRuns {
  return { run: [], over: [], max_run: 0 };
}

/** M at either clamp edge (spec 5.2). */
export function atClamp(m: number): boolean {
  return m <= M_MIN + M_CLAMP_EPSILON || m >= M_MAX - M_CLAMP_EPSILON;
}

/** A quarter's last month close: each industry's M, in industry id order (`ClampRuns::add_quarter`). */
export function clampRunsAddQuarter(c: ClampRuns, factors: readonly number[]): void {
  while (c.run.length < factors.length) c.run.push(0);
  while (c.over.length < factors.length) c.over.push(false);
  c.run.length = factors.length;
  c.over.length = factors.length;
  factors.forEach((m, i) => {
    c.run[i] = atClamp(m) ? (c.run[i] as number) + 1 : 0;
    c.over[i] = (c.over[i] as boolean) || (c.run[i] as number) > M_CLAMP_QUARTERS;
    c.max_run = Math.max(c.max_run, c.run[i] as number);
  });
}

/**
 * The longest run ending this quarter among the industries whose `waived` flag (D366, industry
 * id order; missing means not waived) equals `want` (`ClampRuns::current_max`).
 */
export function clampRunsCurrentMax(c: ClampRuns, waived: readonly boolean[], want: boolean): number {
  let best = 0;
  c.run.forEach((r, i) => {
    if (isWaived(waived, i) === want) best = Math.max(best, r);
  });
  return best;
}

/** The quarter being recorded (`quarters.csv`). */
export interface QuarterAcc {
  /**
   * The release made in this quarter (its first month's 2nd): the quarter it reports and its
   * reports, beats and misses (v_market_stats, D249 tags).
   */
  release: { quarter: Quarter; reports: number; beats: number; misses: number } | null;
  /** Industry-months in force in this quarter, and how many of them were labeled Boom or Bust (D325). */
  industry_months: number;
  boom_months: number;
  bust_months: number;
  /**
   * Per industry: the quarter's revenue (named + fringe), trend revenue (D322) and demand
   * revenue (a twelfth of effective demand at each close, D363).
   */
  revenue: number[];
  trend: number[];
  demand: number[];
}

/** Rust `QuarterAcc::default()`. */
export function quarterAccNew(): QuarterAcc {
  return {
    release: null,
    industry_months: 0,
    boom_months: 0,
    bust_months: 0,
    revenue: [],
    trend: [],
    demand: [],
  };
}

/** One industry at a month close, as v_industry_row shows it. */
export interface MonthFigures {
  /** The label this close set, in force for the next month. */
  label: PhaseLabel;
  /** The month's revenue, named units plus fringe. */
  revenue: number;
  trend_demand: number;
  /** Effective demand at the close, USD a year (spec 5.1). */
  demand: number;
}

function resizeFill<T>(a: T[], n: number, fill: T): void {
  while (a.length < n) a.push(fill);
  a.length = n;
}

/**
 * Adds the month just closed (D322, D325) (`QuarterAcc::add_month`). It ran under `labels`, set
 * at the previous close (or at load for January 2020); they then take the labels this close set,
 * which are in force for the next month. Its revenue is set against a twelfth of the trend
 * demand at the same close.
 */
export function quarterAccAddMonth(q: QuarterAcc, labels: PhaseLabel[], rows: readonly MonthFigures[]): void {
  resizeFill(q.revenue, rows.length, 0);
  resizeFill(q.trend, rows.length, 0);
  resizeFill(q.demand, rows.length, 0);
  resizeFill<PhaseLabel>(labels, rows.length, "Normal");
  rows.forEach((r, i) => {
    q.industry_months += 1;
    q.boom_months += labels[i] === "Boom" ? 1 : 0;
    q.bust_months += labels[i] === "Bust" ? 1 : 0;
    labels[i] = r.label;
    q.revenue[i] = (q.revenue[i] as number) + r.revenue;
    q.trend[i] = (q.trend[i] as number) + r.trend_demand / MONTHS_PER_YEAR;
    q.demand[i] = (q.demand[i] as number) + r.demand / MONTHS_PER_YEAR;
  });
}

/**
 * A cast's full and simple character counts from its board at birth (D326): the founders, and
 * the simple characters cast, which are the simple seat holders plus the directors who are not
 * unseated founders. With partials placed before seat fillers (5.19.4 step 3), that is
 * `max(partials drawn, open seats left after the seated founders)`.
 */
export function castSizes(
  founders: number,
  seatedFounders: number,
  simpleSeats: number,
  directors: number,
): [number, number] {
  const simpleDirectors = Math.max(directors - (founders - seatedFounders), 0);
  return [founders, simpleSeats + simpleDirectors];
}

/** A born company's cast at birth (D326): the year's count and the min and max sizes. */
interface CastStats {
  casts: number;
  full: [number, number] | null;
  simple: [number, number] | null;
}

function castStatsNew(): CastStats {
  return { casts: 0, full: null, simple: null };
}

function widen(range: [number, number] | null, n: number): [number, number] {
  return range === null ? [n, n] : [Math.min(range[0], n), Math.max(range[1], n)];
}

function opt(v: number | undefined): string {
  return v === undefined ? "" : String(v);
}

/**
 * Rust `{:.n}` for an f64: fixed decimals, `inf`, `-inf`, `NaN`.
 *
 * `toFixed` and Rust both round the exact binary value, so they agree except on an exact decimal
 * tie (a value whose binary expansion ends exactly on a 5 at digit n+1, such as 0.125 to 2
 * places): `toFixed` rounds the tie away from zero, Rust's formatter to even. Such ties are rare
 * in the soak's figures (sums and ratios of measured values) and `check` on the Rust reference
 * reproduces its targets.csv and summary.csv byte for byte (test/targets.test.ts); `toFixed` also
 * switches to exponent form at 1e21 and above, which no soak figure reaches.
 */
function fx(x: number, digits: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (x === Number.POSITIVE_INFINITY) return "inf";
  if (x === Number.NEGATIVE_INFINITY) return "-inf";
  return x.toFixed(digits);
}

/** Reads the views at the notices of each tick and writes the rows. */
interface Recorder {
  seed: number;
  year_ticks: number;
  economy: YearEconomy;
  tracking: YearTracking;
  births: YearBirths;
  clamp: ClampRuns;
  /** Per industry in id order: in `SPEC_11_2_WAIVED` (D366, D368). */
  waived: boolean[];
  quarter: QuarterAcc;
  /**
   * The labels in force for the month now running: set at load (D110) for January 2020, then by
   * each month close for the next month (4.3 step 2).
   */
  labels: PhaseLabel[];
  /** Each industry's effective and trend demand at load (2020-01-01 00:00). */
  demand0: number[];
  trend0: number[];
  casts: CastStats;
  empty_seats_max: number;
  /** The largest `shares_out` seen at any month close (not a table column). */
  max_shares_out: number;
  distressed_seen: boolean[];
  years: string;
  quarters: string;
  /** The `--detail` tables (D900), read after the metrics at each close. */
  detail: DetailHook | null;
}

function recorderNew(sim: SoakSimApi, seed: number): Recorder {
  const rows = sim.views().industry_rows.data.rows;
  return {
    seed,
    year_ticks: 0,
    economy: yearEconomyNew(),
    tracking: yearTrackingNew(),
    births: yearBirthsNew(),
    clamp: clampRunsNew(),
    waived: rows.map((r) => SPEC_11_2_WAIVED.includes(r.key)),
    quarter: quarterAccNew(),
    labels: rows.map((r) => r.phase_label),
    demand0: rows.map((r) => r.demand),
    trend0: rows.map((r) => r.trend_demand),
    casts: castStatsNew(),
    empty_seats_max: 0,
    max_shares_out: 0,
    distressed_seen: new Array<boolean>(sim.views().company_detail.data.companies.length).fill(false),
    years: "",
    quarters: "",
    detail: null,
  };
}

function recorderNotice(rec: Recorder, sim: SoakSimApi, n: Notice, hashMonthly: boolean): void {
  switch (n.kind) {
    case "DayDone":
      yearTrackingAddDay(rec.tracking, sim);
      break;
    case "EarningsReleased": {
      const m = sim.views().market_stats.data;
      yearBirthsAddRelease(rec.births, m.reports, m.beats, m.misses);
      rec.quarter.release = { quarter: n.quarter, reports: m.reports, beats: m.beats, misses: m.misses };
      break;
    }
    case "CompanyBorn":
      recorderAddBirth(rec, sim, n.company);
      break;
    case "MonthDone": {
      const month = n.month;
      recorderMonthClose(rec, sim, month.month);
      if (hashMonthly) console.log(`seed ${rec.seed} ${formatMonth(month)} ${sim.stateHash()}`);
      if (month.month % QUARTER_MONTHS === 0) {
        recorderQuarterClose(rec, month.year, month.month / QUARTER_MONTHS);
      }
      if (month.month === DECEMBER) recorderYearClose(rec, sim, month.year);
      if (rec.detail !== null) {
        rec.detail.monthClose(sim);
        if (month.month === DECEMBER) rec.detail.yearClose(sim, month.year);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Spec 5.19.4 and 10 ("every startup has 1 to 5 full and 1 to 5 partial characters, and no
 * labor seat of a born company is empty"), read from v_company_detail the tick it is born
 * (D159, D326).
 */
function recorderAddBirth(rec: Recorder, sim: SoakSimApi, index: number): void {
  const c = sim.views().company_detail.data.companies[index];
  if (c === undefined) throw new Error(`no company ${index} in v_company_detail`);
  const seatedFounders = c.board.filter((s) => {
    const ch = s.holder?.character ?? null;
    return ch !== null && c.founders.includes(ch);
  }).length;
  const simpleSeats = c.board.filter((s) => s.holder?.partial === true).length;
  const [full, simple] = castSizes(c.founders.length, seatedFounders, simpleSeats, c.directors.length);
  rec.casts.casts += 1;
  rec.casts.full = widen(rec.casts.full, full);
  rec.casts.simple = widen(rec.casts.simple, simple);
  const empty = c.board.filter((s) => s.open && s.holder === null).length;
  rec.empty_seats_max = Math.max(rec.empty_seats_max, empty);
}

function isFrozen(s: CompanyStatus): boolean {
  return s === "Bankrupt" || s === "Removed";
}

function recorderMonthClose(rec: Recorder, sim: SoakSimApi, month: number): void {
  const v = sim.views();
  yearEconomyAddMonth(rec.economy, sim);
  yearBirthsAddMonth(rec.births, sim);
  const rows = v.industry_rows.data.rows;
  // The true industry figures: an industry with one or two private companies shows bands
  // (D432), so they come from the soak totals (D427).
  const truth = sim.soakStats().industries;
  const figures: MonthFigures[] = [];
  for (let i = 0; i < Math.min(rows.length, truth.length); i++) {
    const r = rows[i] as (typeof rows)[number];
    const t = truth[i] as SoakIndustry;
    figures.push({
      label: r.phase_label,
      revenue: t.named_revenue_m + t.fringe_revenue_m,
      trend_demand: r.trend_demand,
      demand: r.demand,
    });
  }
  quarterAccAddMonth(rec.quarter, rec.labels, figures);
  if (month % QUARTER_MONTHS === 0) {
    clampRunsAddQuarter(
      rec.clamp,
      truth.map((t) => t.market_factor),
    );
  }
  const companies = v.company_detail.data.companies;
  if (companies.length > rec.distressed_seen.length) {
    resizeFill(rec.distressed_seen, companies.length, false);
  }
  // No empty labor seat of a born company still in the game (D326).
  let empty = 0;
  for (const c of companies) {
    if (c.status === "Distressed") rec.distressed_seen[c.id] = true;
    rec.max_shares_out = Math.max(rec.max_shares_out, c.shares_out);
    if (c.origin.kind === "Born" && !isFrozen(c.status)) {
      empty += c.board.filter((s) => s.open && s.holder === null).length;
    }
  }
  rec.empty_seats_max = Math.max(rec.empty_seats_max, empty);
}

function recorderQuarterClose(rec: Recorder, year: number, quarter: number): void {
  const q = rec.quarter;
  rec.quarter = quarterAccNew();
  const ratios = q.revenue.map((r, i) => revenueRatio(r, q.trend[i] as number));
  // D363: revenue against the industry's own demand path, and demand against its trend.
  const revDemand = q.revenue.map((r, i) => revenueRatio(r, q.demand[i] as number));
  const demandTrend = q.demand.map((d, i) => revenueRatio(d, q.trend[i] as number));
  const [rdMin, rdMax, rdOut] = bandStats(revDemand, REVENUE_DEMAND_BAND);
  const [dtMin, dtMax, dtOut] = bandStats(demandTrend, DEMAND_TREND_BAND);
  // D368: the same revenue ratios split into the industries judged and those waived.
  const [rcMin, rcMax, rcOut] = bandStatsWhere(revDemand, REVENUE_DEMAND_BAND, rec.waived, false);
  const [rwMin, rwMax, rwOut] = bandStatsWhere(revDemand, REVENUE_DEMAND_BAND, rec.waived, true);
  const counted = clampRunsCurrentMax(rec.clamp, rec.waived, false);
  const waived = clampRunsCurrentMax(rec.clamp, rec.waived, true);
  const [min, max] = [
    ratios.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY),
    ratios.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY),
  ];
  const out = ratios.filter((r) => Math.abs(r - 1.0) > REVENUE_TREND_BAND).length;
  const rel = q.release;
  const [released, reports, beats, misses] =
    rel === null ? ["", 0, 0, 0] : [quarterLabel(rel.quarter), rel.reports, rel.beats, rel.misses];
  const atClampCount = rec.clamp.run.filter((r) => r > 0).length;
  const maxRun = rec.clamp.run.reduce((a, b) => Math.max(a, b), 0);
  const over = rec.clamp.run.filter((r) => r > M_CLAMP_QUARTERS).length;
  rec.quarters +=
    `${rec.seed},${year},${quarter},${released},${reports},${beats},${misses},${ratios.length},` +
    `${q.industry_months},${q.boom_months},${q.bust_months},${fx(min, 4)},${fx(max, 4)},${out},` +
    `${atClampCount},${maxRun},${over},${fx(rdMin, 4)},${fx(rdMax, 4)},${rdOut},${fx(dtMin, 4)},` +
    `${fx(dtMax, 4)},${dtOut},${counted},${waived},${fx(rcMin, 4)},${fx(rcMax, 4)},${rcOut},` +
    `${fx(rwMin, 4)},${fx(rwMax, 4)},${rwOut}\n`;
}

function recorderYearClose(rec: Recorder, sim: SoakSimApi, year: number): void {
  const hash = sim.stateHash();
  const econ = yearEconomyColumns(rec.economy, sim);
  const ops = operationsColumns(sim);
  const seen = rec.distressed_seen.filter((d) => d).length;
  const books = booksColumns(sim, year, seen);
  const market = yearTrackingColumns(rec.tracking, sim);
  const m6 = yearBirthsColumns(rec.births, sim, year, rec.clamp);
  const m10 = recorderM10Columns(rec, sim, year);
  rec.years += `${rec.seed},${year},${rec.year_ticks},${hash},${econ},${ops},${books},${market},${m6},${m10}\n`;
  rec.distressed_seen.fill(false);
  rec.economy = yearEconomyNew();
  rec.tracking = yearTrackingNew();
  rec.casts = castStatsNew();
  rec.empty_seats_max = 0;
  rec.year_ticks = 0;
}

/**
 * The M10 columns of `year`'s row: demand growth against the trend since load (D324), the
 * year's casts (D326) and the worst count of empty labor seats seen in the year.
 */
function recorderM10Columns(rec: Recorder, sim: SoakSimApi, year: number): string {
  const rows = sim.views().industry_rows.data.rows;
  const n = year + 1 - EPOCH_YEAR;
  const devs = rows.map((r, i) => {
    const g = cagr(rec.demand0[i] as number, r.demand, n);
    const lt = cagr(rec.trend0[i] as number, r.trend_demand, n);
    return 100.0 * Math.abs(g - lt);
  });
  const maxDev = devs.reduce((a, b) => maxF(a, b), 0.0);
  const out = devs.filter((d) => d > DEMAND_GROWTH_BAND_PP).length;
  const c = rec.casts;
  return `${fx(maxDev, 3)},${out},${c.casts},${opt(c.full?.[0])},${opt(c.full?.[1])},${opt(c.simple?.[0])},${opt(c.simple?.[1])},${rec.empty_seats_max}`;
}

/**
 * Annual growth from `from` to `to` over `years` years; an infinite rate when `from` is not
 * positive (it never is in the data).
 */
export function cagr(from: number, to: number, years: number): number {
  if (from > 0.0 && to >= 0.0) return (to / from) ** (1.0 / years) - 1.0;
  return Number.POSITIVE_INFINITY;
}

/**
 * A quarter's revenue over its trend revenue (D322), and likewise revenue over demand revenue
 * and demand over trend (D363); with no denominator, 1 for a zero numerator, else infinite.
 */
export function revenueRatio(revenue: number, trend: number): number {
  if (trend > 0.0) return revenue / trend;
  if (revenue > 0.0) return Number.POSITIVE_INFINITY;
  return 1.0;
}

/** The lowest and highest ratio and how many are outside `1 ± band`. */
export function bandStats(ratios: readonly number[], band: number): [number, number, number] {
  const min = ratios.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
  const max = ratios.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
  const out = ratios.filter((r) => Math.abs(r - 1.0) > band).length;
  return [min, max, out];
}

/**
 * `bandStats` over the industries whose waived flag equals `want` (D368). With none it gives
 * (1, 1, 0): an empty set is inside every band.
 */
export function bandStatsWhere(
  ratios: readonly number[],
  band: number,
  waived: readonly boolean[],
  want: boolean,
): [number, number, number] {
  const picked = ratios.filter((_, i) => isWaived(waived, i) === want);
  if (picked.length === 0) return [1.0, 1.0, 0];
  return bandStats(picked, band);
}

/** Whether industry `i` is in `SPEC_11_2_WAIVED`, from the flags in industry id order. */
export function isWaived(waived: readonly boolean[], i: number): boolean {
  return waived[i] ?? false;
}

/** `2019Q4` (Rust `quarter_label`). */
export function quarterLabel(q: Quarter): string {
  return `${q.year}Q${q.q}`;
}

/** The M6 columns' running counts (D166), with the median productivity of D321. */
interface YearBirths {
  reports: number;
  beats: number;
  misses: number;
  industry_months: number;
  boom_months: number;
  bust_months: number;
}

function yearBirthsNew(): YearBirths {
  return { reports: 0, beats: 0, misses: 0, industry_months: 0, boom_months: 0, bust_months: 0 };
}

/** A release (the 2nd of a quarter's first month): its reports and their tags. */
function yearBirthsAddRelease(y: YearBirths, reports: number, beats: number, misses: number): void {
  y.reports += reports;
  y.beats += beats;
  y.misses += misses;
}

/** A month close: the labels it set. */
function yearBirthsAddMonth(y: YearBirths, sim: SoakSimApi): void {
  for (const r of sim.views().industry_rows.data.rows) {
    y.industry_months += 1;
    y.boom_months += r.phase_label === "Boom" ? 1 : 0;
    y.bust_months += r.phase_label === "Bust" ? 1 : 0;
  }
}

/** The M6 columns of `year`'s row; the year's counts restart. */
function yearBirthsColumns(y: YearBirths, sim: SoakSimApi, year: number, clamp: ClampRuns): string {
  const v = sim.views();
  const births = v.births.data;
  const inYear = (d: { year: number }): boolean => d.year === year;
  const events = births.events.filter((e) => inYear(e.date)).length;
  const startups = births.births.filter((b) => inYear(b.date)).length;
  const industries = v.industry_rows.data.rows;
  const aiLabs = births.births.filter(
    (b) => inYear(b.date) && industries[b.industry]?.key === AI_LABS_KEY,
  ).length;
  const listings = births.listings.filter((l) => inYear(l.date)).length;
  const companies = v.company_detail.data.companies;
  const startListed = births.listings.filter((l) => companies[l.id]?.origin.kind === "Start").length;
  const named = companies.filter((c) => c.status !== "Removed").length;
  const starts = companies.filter((c) => c.origin.kind === "Start");
  const shareOfStarts = (n: number): number => n / Math.max(starts.length, 1);
  const startActive = shareOfStarts(starts.filter((c) => c.status === "Active").length);
  // Spec 10 "neither bankrupt nor removed" (D320): Active or Distressed.
  const startAlive = shareOfStarts(starts.filter((c) => !isFrozen(c.status)).length);
  const share = (a: number, b: number): number => a / Math.max(b, 1);
  const out =
    `${events},${startups},${aiLabs},${listings},${startListed},${named},${fx(startActive, 4)},` +
    `${fx(startAlive, 4)},${fx(share(y.beats, y.reports), 4)},${fx(share(y.misses, y.reports), 4)},` +
    `${fx(share(y.boom_months, y.industry_months), 4)},${fx(share(y.bust_months, y.industry_months), 4)},` +
    `${clamp.over.filter((o) => o).length},${clamp.max_run},${births.full_characters_made},` +
    `${births.full_characters},${fx(medianProductivity(sim), 3)}`;
  Object.assign(y, yearBirthsNew());
  return out;
}

/**
 * Spec 10 "median productivity 90 to 110" (D321): the median productivity of the units with
 * gross assets above 0 of companies not frozen (Active or Distressed), the mean of the middle
 * two for an even count; 0 with no unit. From the soak totals, since a private company's gross
 * assets are an estimate band in v_units (D420, D427).
 */
function medianProductivity(sim: SoakSimApi): number {
  return sim.soakStats().median_productivity;
}

/** The year's M5.8 tracking count, added at each daily close from v_market_stats. */
interface YearTracking {
  within: number;
  days: number;
}

function yearTrackingNew(): YearTracking {
  return { within: 0, days: 0 };
}

function yearTrackingAddDay(t: YearTracking, sim: SoakSimApi): void {
  const m = sim.views().market_stats.data;
  t.within += m.within_band;
  t.days += m.quoted;
}

/** The M5 market columns at the December close. */
function yearTrackingColumns(t: YearTracking, sim: SoakSimApi): string {
  const v = sim.views();
  const m = v.market_stats.data;
  const quotes = v.quotes.data;
  const levels = INDEX_COLUMNS.map((code) => {
    const e = v.exchanges.data.exchanges.find((x) => x.code === code);
    const i = e === undefined ? undefined : quotes.indices.find((x) => x.zone === e.zone);
    const level = i?.level ?? null;
    return level === null ? "" : fx(level, 2);
  });
  return `${m.quoted},${fx(m.median_gap, 4)},${fx(t.within / Math.max(t.days, 1), 4)},${fx(m.mean_confidence, 3)},${levels.join(",")}`;
}

/** Rust `Rating::band` (finance/rating.rs, D220): AA+, AA and AA- read AA, and so on. */
export function ratingBand(r: Rating): RatingBand {
  switch (r) {
    case "Aaa":
      return "Aaa";
    case "AaPlus":
    case "Aa":
    case "AaMinus":
      return "Aa";
    case "APlus":
    case "A":
    case "AMinus":
      return "A";
    case "BbbPlus":
    case "Bbb":
    case "BbbMinus":
      return "Bbb";
    case "BbPlus":
    case "Bb":
    case "BbMinus":
      return "Bb";
    case "BPlus":
    case "B":
    case "BMinus":
      return "B";
    case "Ccc":
      return "Ccc";
    case "Cc":
      return "Cc";
  }
}

/** The rating bands, best first (Rust `BANDS`). */
const BANDS: readonly RatingBand[] = ["Aaa", "Aa", "A", "Bbb", "Bb", "B", "Ccc", "Cc"];

/** `RatingsView::band_counts` (not ported with the view): companies by band, best first, counting those not frozen. */
export function bandCounts(
  companies: readonly { rating: Rating; status: CompanyStatus }[],
): [RatingBand, number][] {
  return BANDS.map((b) => [
    b,
    companies.filter((c) => !isFrozen(c.status) && ratingBand(c.rating) === b).length,
  ]);
}

function bandLabel(b: RatingBand): string {
  switch (b) {
    case "Aaa":
      return "AAA";
    case "Aa":
      return "AA";
    case "A":
      return "A";
    case "Bbb":
      return "BBB";
    case "Bb":
      return "BB";
    case "B":
      return "B";
    case "Ccc":
      return "CCC";
    case "Cc":
      return "CC";
  }
}

/**
 * The M4 books columns at the close of `year` (the 1 January tick that closes it), with
 * `distressed_in_year` counted by the caller from the monthly closes.
 */
function booksColumns(sim: SoakSimApi, year: number, distressedInYear: number): string {
  const v = sim.views();
  const companies = v.company_detail.data.companies;
  const count = (s: CompanyStatus): number => companies.filter((c) => c.status === s).length;
  const ratings = v.ratings.data;
  // The year's events: its own days, and the 1 January close that ends it.
  const inYear = (d: { year: number; month: number; day: number } | null): boolean =>
    d !== null && (d.year === year || (d.year === year + 1 && d.month === 1 && d.day === 1));
  const bankruptcies = ratings.companies.filter((c) => inYear(c.bankrupt_on)).length;
  const removals = ratings.companies.filter((c) => inYear(c.removed_on)).length;
  // The true total, from the soak totals: a private company's line is a band (D420, D427).
  const line = sim.soakStats().line_drawn_usd;
  const bands = bandCounts(ratings.companies).map(([b, n]) => `${bandLabel(b)}:${n}`);
  return (
    `${distressedInYear},${count("Distressed")},${count("Bankrupt")},${count("Removed")},` +
    `${bankruptcies},${removals},${fx(count("Active") / Math.max(companies.length, 1), 4)},` +
    `${fx(line, 0)},${bands.join("|")}`
  );
}

/** The M3 operations columns, read from the views at the December close. */
function operationsColumns(sim: SoakSimApi): string {
  const v = sim.views();
  const companies = v.company_detail.data.companies;
  const n = Math.max(companies.length, 1);
  const meanManagement = companies.reduce((a, c) => a + c.management_score, 0) / n;
  // From the soak totals: a private company's EBIT, TB and productivity are bands (D420,
  // D427, D431, D436).
  const totals = sim.soakStats();
  return `${fx(totals.mean_productivity, 3)},${fx(meanManagement, 3)},${fx(totals.data_tb, 1)},${fx(totals.profitable_companies / n, 4)}`;
}

/** The M2 economy columns, read from the views after each month closes. */
interface YearEconomy {
  named_revenue: number;
  fringe_revenue: number;
}

function yearEconomyNew(): YearEconomy {
  return { named_revenue: 0, fringe_revenue: 0 };
}

/** Adds the month just closed. */
function yearEconomyAddMonth(y: YearEconomy, sim: SoakSimApi): void {
  for (const t of sim.soakStats().industries) {
    y.named_revenue += t.named_revenue_m;
    y.fringe_revenue += t.fringe_revenue_m;
  }
}

/** The economy columns of the year's row. */
function yearEconomyColumns(y: YearEconomy, sim: SoakSimApi): string {
  const cycle = sim.views().cycle.data;
  const rows = sim.soakStats().industries;
  const n = Math.max(rows.length, 1);
  const s = rows.map((r) => r.supply_ratio);
  const meanS = s.reduce((a, b) => a + b, 0) / n;
  const minS = s.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
  const maxS = s.reduce((a, b) => Math.max(a, b), Number.NEGATIVE_INFINITY);
  const meanM = rows.reduce((a, r) => a + r.market_factor, 0) / n;
  return `${cycle.phase},${fx(cycle.g_t, 6)},${fx(y.named_revenue, 0)},${fx(y.fringe_revenue, 0)},${fx(meanS, 4)},${fx(minS, 4)},${fx(maxS, 4)},${fx(meanM, 4)}`;
}

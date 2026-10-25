// Estimate bands: what the observer sees of a figure that is not published (spec 1 Information,
// replaced by Logan's 2026-10-21 ruling, D420; design fix 420). Ported from
// crates/sim/src/views/estimate.rs; the types and tuning constants are in types/views/estimate.ts.
//
// Spec 1 has private companies' figures show "?". Logan ruled instead that every financial figure
// of a private company, and of a new listing until its first release after listing (spec 5.20.1
// Listing step 4), is shown as a **band**: a range of about ±25% around a noisy estimate. The
// views build the band, so the true value never reaches the UI for those companies: a `Figure`
// holds either the exact published value or a `Band`, never both. Omniscient (debug builds only,
// spec 1) serves the exact value instead.
//
// **The noise draws from no sim RNG stream.** It is a hash of the seed, the subject (a company or
// an industry), the figure's `Kind`, and the period and true value (D421), so building the views
// never moves a stream (`rng.ts`).
//
// **A persistent bias, so averaging does not converge (D429, Logan's ruling).** A banded
// subject's error on a kind of figure is `e = s × m + j`: a sign `s` fixed for the subject and
// kind for the whole game, a magnitude `m` between `ESTIMATE_BIAS_MIN` and `ESTIMATE_BIAS_MAX`
// re-drawn each calendar year, and a small jitter `j` within ±`ESTIMATE_JITTER` drawn per period
// and true value. Every estimate of a company's revenue (monthly, quarterly, yearly, TTM, in any
// view) leans the same way by at least `ESTIMATE_BIAS_MIN − ESTIMATE_JITTER`, so averaging them
// never finds the truth. Each underlying figure has one estimate: the jitter is keyed by the true
// value (and the statement period), so two views of the same figure show the same band, and a
// figure that has not changed keeps its estimate from month to month, while two different values
// never share an error (a new value gets a new jitter, so month-to-month ratios and differences
// stay noisy).
//
// **One error per true value; the rest is derived (D430).** A figure that is a function of
// another banded figure is derived from that band, never banded on its own with a shared error: a
// year's flows and the TTM are the sums of the quarters' bands, a value a share is the total band
// over the shares, the range ends are `range()` of the consensus band, a share of an industry is
// the revenue band over the industry total, data inflow is the revenue band times the TB rate.
//
// The estimate is `truth + e × scale` with `scale = max(|truth|, floor)`; the band is the
// estimate ± `ESTIMATE_BAND_HALF_WIDTH` × `max(|estimate|, floor)`. The half-width (at least
// `0.25 × (1 − 0.155)` = 0.21 × scale) is always wider than the error (at most 0.155 × scale), so
// the band holds the truth strictly inside it: neither endpoint and never the estimate equals the
// true value (D422). Derived bands keep this, since they apply increasing functions or sums. A
// band of a small figure (below the floor) can reach below 0.
//
// Differences from Rust:
// - The hash is 64-bit wrapping arithmetic (splitmix64). It runs on a pair of u32 halves held in
//   plain numbers (`U64`), not on bigint, because the banded statements hash about a hundred
//   thousand figures at a full build; the result is bit for bit Rust's (the unit tests check it
//   against a bigint reference and against values worked out from the Rust code).
// - The seed: `ViewInput.seed` is a number (the RNG's seeds are whole numbers below 2^53) and the
//   contract `Estimator.seed` a bigint; `estimateHash` and `error` take the bigint.
// - Rust's `ViewInput::estimator` is `viewInputEstimator` here, so views/index.ts stays the
//   framework's.

import {
  ledgerEbit,
  ledgerEbitda,
  ledgerInterestExpense,
  ledgerNetCashChange,
  ledgerNetIncome,
  ledgerOperatingCash,
  ledgerOperatingCosts,
  ledgerPreTaxIncome,
} from "../finance/statements.ts";
import { dateTimeDate, quarterNext, quarterPrev, simDateQuarter } from "../time/calendar.ts";
import { releaseTick } from "../time/quarter.ts";
import type { DateTime, Quarter } from "../types/calendar.ts";
import type { CompanyId } from "../types/ids.ts";
import { maxF } from "../types/num.ts";
import type { Period, Statement } from "../types/state/finance.ts";
import {
  type Band,
  ESTIMATE_BAND_HALF_WIDTH,
  ESTIMATE_BIAS_MAX,
  ESTIMATE_BIAS_MIN,
  ESTIMATE_FLOOR_USD,
  ESTIMATE_HASH_SALT,
  ESTIMATE_JITTER,
  type Estimator,
  type Figure,
  type Kind,
  STATEMENT_LINE_LABELS,
  STATEMENT_LINE_VALUES,
  type StatementLine,
  type Subject,
} from "../types/views/estimate.ts";
import type { World } from "../types/world.ts";
import { worldPublishes } from "../world/index.ts";
import type { ViewInput } from "./index.ts";

// ---------------------------------------------------------------- Band and Figure

/** An exact figure (Rust `Figure::Exact`). */
export function figureExactOf(x: number): Figure {
  return { kind: "Exact", value: x };
}

/** A banded figure (Rust `Figure::Band`). */
export function figureBandOf(b: Band): Figure {
  return { kind: "Band", band: b };
}

/** The band of `f(x)` for an increasing `f` (D430): the truth stays strictly inside. */
export function bandMap(b: Band, f: (x: number) => number): Band {
  return { estimate: f(b.estimate), low: f(b.low), high: f(b.high) };
}

/** The exact value, if published. */
export function figureExact(f: Figure): number | null {
  return f.kind === "Exact" ? f.value : null;
}

/** The band, if not published. */
export function figureBand(f: Figure): Band | null {
  return f.kind === "Band" ? f.band : null;
}

/**
 * The value to sort, sum or chart by: the exact value or the estimate (never the hidden truth,
 * so sorting a column cannot leak it).
 */
export function figureShown(f: Figure): number {
  return f.kind === "Exact" ? f.value : f.band.estimate;
}

export function figureIsBand(f: Figure): boolean {
  return f.kind === "Band";
}

/** `f` of this figure for an increasing `f` (D430). */
export function figureMap(fig: Figure, f: (x: number) => number): Figure {
  return fig.kind === "Exact" ? figureExactOf(f(fig.value)) : figureBandOf(bandMap(fig.band, f));
}

/**
 * The sum of figures (D430): exact if every part is, else a band from the parts' bands (an exact
 * part counts as a band of zero width), so a banded part's truth stays hidden.
 */
export function figureSum(parts: Iterable<Figure>): Figure {
  let exact = true;
  let est = 0.0;
  let low = 0.0;
  let high = 0.0;
  for (const p of parts) {
    if (p.kind === "Exact") {
      est += p.value;
      low += p.value;
      high += p.value;
    } else {
      exact = false;
      est += p.band.estimate;
      low += p.band.low;
      high += p.band.high;
    }
  }
  return exact ? figureExactOf(est) : figureBandOf({ estimate: est, low, high });
}

/** This figure over a positive exact `d` (a share of a known whole, a value a share). */
export function figureOver(f: Figure, d: number): Figure {
  return figureMap(f, (x) => x / d);
}

/**
 * `num ÷ den` for a positive whole (D430): interval division, so the true ratio stays strictly
 * inside; 0 when the whole shown is not above 0.
 */
export function figureRatio(num: Figure, den: Figure): Figure {
  const band = (f: Figure): Band =>
    f.kind === "Exact" ? { estimate: f.value, low: f.value, high: f.value } : f.band;
  if (num.kind === "Exact" && den.kind === "Exact") {
    return figureExactOf(den.value > 0.0 ? num.value / den.value : 0.0);
  }
  if (den.kind === "Exact" && den.value > 0.0) return figureOver(num, den.value);
  const n = band(num);
  const d = band(den);
  if (d.low <= 0.0) {
    return d.estimate > 0.0 ? figureOver(num, d.estimate) : figureExactOf(0.0);
  }
  return figureBandOf({
    estimate: n.estimate / d.estimate,
    low: n.low / (n.low >= 0.0 ? d.high : d.low),
    high: n.high / (n.high >= 0.0 ? d.low : d.high),
  });
}

// ---------------------------------------------------------------- Kind, Subject, StatementLine

/** The line's index in display order (Rust `StatementLine as usize`). */
export function statementLineIndex(l: StatementLine): number {
  return STATEMENT_LINE_INDEX[l];
}

const STATEMENT_LINE_INDEX: Readonly<Record<StatementLine, number>> = Object.fromEntries(
  STATEMENT_LINE_VALUES.map((l, i) => [l, i]),
) as Record<StatementLine, number>;

/** A kind's number in the hash (D429; Rust `Kind::code`). */
export function kindCode(k: Kind): number {
  switch (k.kind) {
    case "Line":
      return 100 + statementLineIndex(k.line);
    case "Value":
      return 1;
    case "LineLimit":
      return 2;
    case "Consensus":
      return 3;
    case "Projection":
      return 4;
    case "BirthSize":
      return 5;
    case "GrossAssets":
      return 6;
    case "AssetsEff":
      return 7;
    case "HeldTb":
      return 8;
    case "UnstructuredTb":
      return 9;
    case "DecayTb":
      return 10;
    case "Supply":
      return 11;
    case "MarketFactor":
      return 12;
    case "FringeRevenue":
      return 13;
    case "FringeShare":
      return 14;
    case "Productivity":
      return 15;
  }
}

/** A subject's number in the hash, as a u64 (Rust `Subject::code`): an industry sets bit 32. */
function subjectCode(s: Subject): U64 {
  return s.kind === "Company" ? u64(s.company) : [1, s.industry >>> 0];
}

/** The line's label (spec 3.9). */
export function statementLineLabel(l: StatementLine): string {
  return STATEMENT_LINE_LABELS[l];
}

/**
 * A flow of the period (income and cash flow lines): a year's is the sum of its quarters'. The
 * balance sheet and guidance lines are the period end's.
 */
export function statementLineIsFlow(l: StatementLine): boolean {
  return statementLineIndex(l) < STATEMENT_LINE_INDEX.Cash;
}

/** The line's exact value in a statement (spec 3.9). */
export function statementLineOf(line: StatementLine, s: Statement): number {
  const l = s.lines;
  const b = s.balance;
  switch (line) {
    case "Revenue":
      return l.revenue;
    case "Variable":
      return l.variable;
    case "FixedCash":
      return l.fixed_cash;
    case "OperatingCosts":
      return ledgerOperatingCosts(l);
    case "Rd":
      return l.rd;
    case "Shared":
      return l.shared;
    case "Depreciation":
      return l.depreciation;
    case "Ebit":
      return ledgerEbit(l);
    case "Ebitda":
      return ledgerEbitda(l);
    case "InterestExpense":
      return ledgerInterestExpense(l);
    case "InterestIncome":
      return l.interest_income;
    case "AssetSaleGain":
      return l.asset_sale_gain;
    case "PreTaxIncome":
      return ledgerPreTaxIncome(l);
    case "Tax":
      return l.tax;
    case "NetIncome":
      return ledgerNetIncome(l);
    case "OperatingCash":
      return ledgerOperatingCash(l);
    case "AssetPurchases":
      return l.asset_purchases;
    case "AssetSales":
      return l.asset_sale_proceeds;
    case "LineDrawnOrRepaid":
      return l.line_drawn_or_repaid;
    case "SharesIssuedNet":
      return l.shares_issued_net;
    case "Dividends":
      return l.dividends;
    case "NetCashChange":
      return ledgerNetCashChange(l);
    case "Cash":
      return b.cash;
    case "AssetBook":
      return b.asset_book;
    case "TotalAssets":
      return b.total_assets;
    case "BalanceLineDrawn":
      return b.line_drawn;
    case "TaxPayable":
      return b.tax_payable;
    case "TotalLiabilities":
      return b.total_liabilities;
    case "Estate":
      return b.estate;
    case "Equity":
      return b.equity;
    case "GuidanceLow":
      return s.key.guidance[0];
    case "GuidanceHigh":
      return s.key.guidance[1];
  }
}

// ---------------------------------------------------------------- who publishes, and when

/**
 * Whether company `id` shows estimates rather than published figures at the world's clock (D420,
 * spec 5.20.1 Listing step 4): a private company always; a company listed in play until the first
 * release after its listing (its first statements publish then); never a company listed at load.
 */
export function showsEstimates(w: World, id: CompanyId): boolean {
  return !worldPublishes(w, id);
}

/**
 * The newest quarter published at `now` (its release has run, spec 4.4 row 1; D130): Q3 2019 on
 * 1 January 2020, Q4 2019 from 2 January.
 */
export function releaseQuarter(now: DateTime): Quarter {
  const q = quarterPrev(simDateQuarter(dateTimeDate(now)));
  return now >= releaseTick(quarterNext(q)) ? q : quarterPrev(q);
}

/**
 * The hash's period input (D421): a quarter or a year, never the same number; 0 is the
 * "current" figures' period. A u64 below 2^53 (the year's absolute value is an i32's).
 */
export function periodCode(p: Period): number {
  return p.kind === "Quarter" ? (Math.abs(p.quarter.year) * 4 + p.quarter.q) * 2 : Math.abs(p.year) * 2 + 1;
}

function periodYear(p: Period): number {
  return p.kind === "Quarter" ? p.quarter.year : p.year;
}

// ---------------------------------------------------------------- the hash (64-bit, as u32 halves)

/** A u64 as its [high, low] u32 halves. */
type U64 = readonly [number, number];

const TWO_32 = 4294967296;

/** A whole number in 0..2^53 as a U64. */
function u64(x: number): U64 {
  return [Math.floor(x / TWO_32) >>> 0, x >>> 0];
}

function u64FromBig(x: bigint): U64 {
  const v = BigInt.asUintN(64, x);
  return [Number(v >> 32n), Number(v & 0xffff_ffffn)];
}

/** The low 64 bits of `a + b`. */
function add64(a: U64, b: U64): U64 {
  const lo = a[1] + b[1];
  return [(a[0] + b[0] + (lo >= TWO_32 ? 1 : 0)) >>> 0, lo >>> 0];
}

/** `a ^ b`. */
function xor64(a: U64, b: U64): U64 {
  return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
}

/** `a >> n` for n in 1..32. */
function shr64(a: U64, n: number): U64 {
  return [a[0] >>> n, ((a[1] >>> n) | (a[0] << (32 - n))) >>> 0];
}

/** The low 64 bits of `a × b`. */
function mul64(a: U64, b: U64): U64 {
  // The full 64-bit product of the low halves, from 16-bit limbs (each partial below 2^32).
  const a0 = a[1] & 0xffff;
  const a1 = a[1] >>> 16;
  const b0 = b[1] & 0xffff;
  const b1 = b[1] >>> 16;
  const p00 = a0 * b0;
  const p01 = a0 * b1;
  const p10 = a1 * b0;
  const p11 = a1 * b1;
  const mid = (p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff);
  const lo = (((mid & 0xffff) << 16) | (p00 & 0xffff)) >>> 0;
  const carry = p11 + (p01 >>> 16) + (p10 >>> 16) + (mid >>> 16);
  // The cross terms reach only the high half, mod 2^32.
  const hi = (carry + Math.imul(a[0], b[1]) + Math.imul(a[1], b[0])) >>> 0;
  return [hi, lo];
}

const GOLDEN_GAMMA: U64 = [0x9e3779b9, 0x7f4a7c15];
const MIX_1: U64 = [0xbf58476d, 0x1ce4e5b9];
const MIX_2: U64 = [0x94d049bb, 0x133111eb];
const SALT: U64 = u64FromBig(ESTIMATE_HASH_SALT);

/**
 * splitmix64's finaliser (Steele, Lea and Flood 2014): a fixed bijection of u64 that spreads
 * every input bit over the output.
 */
function mix(z0: U64): U64 {
  let z = add64(z0, GOLDEN_GAMMA);
  z = mul64(xor64(z, shr64(z, 30)), MIX_1);
  z = mul64(xor64(z, shr64(z, 27)), MIX_2);
  return xor64(z, shr64(z, 31));
}

function toBig(x: U64): bigint {
  return (BigInt(x[0]) << 32n) | BigInt(x[1]);
}

/** The hash's (seed, subject, kind) prefix (D435: computed once per figure). */
function hashPrefix(seed: bigint, subject: Subject, kind: Kind): U64 {
  let h = mix(xor64(SALT, u64FromBig(seed)));
  h = mix(xor64(h, subjectCode(subject)));
  return mix(xor64(h, u64(kindCode(kind))));
}

/**
 * The estimate hash of (seed, subject, kind, then any further inputs) (D421). The inputs are
 * u64s: a number must be a whole number in 0..2^53, a bigint is taken mod 2^64.
 */
export function estimateHash(
  seed: bigint,
  subject: Subject,
  kind: Kind,
  rest: readonly (number | bigint)[],
): bigint {
  let h = hashPrefix(seed, subject, kind);
  for (const x of rest) h = mix(xor64(h, typeof x === "bigint" ? u64FromBig(x) : u64(x)));
  return toBig(h);
}

/** A uniform in [0, 1) from a hash's top 53 bits. */
function unit(h: U64): number {
  return (h[0] * 2097152 + (h[1] >>> 11)) / 9007199254740992;
}

/** An f64's bits (Rust `f64::to_bits`). */
function f64Bits(x: number): U64 {
  BITS_VIEW.setFloat64(0, x);
  return [BITS_VIEW.getUint32(0), BITS_VIEW.getUint32(4)];
}

const BITS_VIEW = new DataView(new ArrayBuffer(8));

/** Hash tags of the three parts of the error. */
const TAG_SIGN: U64 = [0, 1];
const TAG_BIAS: U64 = [0, 2];
const TAG_JITTER: U64 = [0, 3];

/**
 * The error of one estimate (D429): the subject's persistent sign for the kind, times the year's
 * bias magnitude, plus the jitter of this period and true value.
 */
export function error(
  seed: bigint,
  subject: Subject,
  kind: Kind,
  year: number,
  period: number,
  truth: number,
): number {
  // The (seed, subject, kind) prefix once, then each part's own tail.
  const prefix = hashPrefix(seed, subject, kind);
  const sign = (mix(xor64(prefix, TAG_SIGN))[1] & 1) === 1 ? 1.0 : -1.0;
  const y = u64(Math.abs(year));
  const bias =
    ESTIMATE_BIAS_MIN +
    unit(mix(xor64(mix(xor64(prefix, TAG_BIAS)), y))) * (ESTIMATE_BIAS_MAX - ESTIMATE_BIAS_MIN);
  let h = mix(xor64(prefix, TAG_JITTER));
  for (const x of [y, u64(period), f64Bits(truth)]) h = mix(xor64(h, x));
  const j = unit(h);
  return sign * bias + (2.0 * j - 1.0) * ESTIMATE_JITTER;
}

/**
 * The band around `truth` with error `e`, `floor` the scale below which the error and the band
 * stop shrinking (D422).
 */
export function bandOf(truth: number, e: number, floor: number): Band {
  const scale = maxF(Math.abs(truth), floor);
  const estimate = truth + e * scale;
  const half = ESTIMATE_BAND_HALF_WIDTH * maxF(Math.abs(estimate), floor);
  return { estimate, low: estimate - half, high: estimate + half };
}

// ---------------------------------------------------------------- Estimator

/** Makes the figures of the views: the seed, whether Omniscient is on, and the clock. */
export function estimatorNew(seed: bigint | number, omniscient: boolean, now: DateTime): Estimator {
  return { seed: typeof seed === "bigint" ? seed : BigInt(seed), omniscient, now };
}

/** Rust `ViewInput::estimator`: the estimator of a view build (seed, Omniscient, clock). */
export function viewInputEstimator(input: ViewInput): Estimator {
  return estimatorNew(input.seed, input.controls.omniscient, input.world.clock);
}

/** Whether company `id`'s figures are bands in this build (never in Omniscient). */
export function estimatorBanded(e: Estimator, w: World, id: CompanyId): boolean {
  return !e.omniscient && showsEstimates(w, id);
}

/**
 * A figure as it stands now (cash, line, value, a unit's last month, TB held): its bias is this
 * year's, its jitter keyed by the true value (D429).
 */
export function estimatorCurrent(
  e: Estimator,
  banded: boolean,
  subject: Subject,
  kind: Kind,
  truth: number,
  floor: number,
): Figure {
  return estimatorFigure(e, banded, subject, kind, dateTimeDate(e.now).year, 0, truth, floor);
}

/**
 * A figure of one period (a statement line, a quarter's consensus): its bias is the period's
 * year's, its jitter keyed by the period and the true value.
 */
export function estimatorOfPeriod(
  e: Estimator,
  banded: boolean,
  subject: Subject,
  kind: Kind,
  period: Period,
  truth: number,
  floor: number,
): Figure {
  return estimatorFigure(e, banded, subject, kind, periodYear(period), periodCode(period), truth, floor);
}

function estimatorFigure(
  e: Estimator,
  banded: boolean,
  subject: Subject,
  kind: Kind,
  year: number,
  period: number,
  truth: number,
  floor: number,
): Figure {
  if (banded) {
    const err = error(e.seed, subject, kind, year, period, truth);
    return figureBandOf(bandOf(truth, err, floor));
  }
  return figureExactOf(truth);
}

/** A company's money figure as it stands now. */
export function estimatorCompanyNow(
  e: Estimator,
  banded: boolean,
  id: CompanyId,
  kind: Kind,
  truth: number,
): Figure {
  return estimatorCurrent(e, banded, { kind: "Company", company: id }, kind, truth, ESTIMATE_FLOOR_USD);
}

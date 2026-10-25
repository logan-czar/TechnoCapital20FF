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
//   plain numbers, allocating nothing, not on bigint, because the banded views hash about a
//   hundred thousand figures at a full build; the (seed, subject, kind) prefix is memoised. The
//   result is bit for bit Rust's (the unit tests check it against a bigint reference and against
//   values worked out from the Rust code). The subject's code (Rust `Subject::code`: an industry
//   sets bit 32) is in `hashPrefix`.
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
import { assertCount, maxF } from "../types/num.ts";
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

const TWO_32 = 4294967296;

/**
 * The result of `mul64` and `mix`, as its high and low u32 halves: module scratch, so the hash
 * allocates nothing (a full banded build hashes about 10^5 figures).
 */
let outHi = 0;
let outLo = 0;

/** The high and low halves of a whole number in 0..2^53 (anything else throws: never a silent wrap). */
function hiOf(x: number): number {
  assertCount(x, "estimate hash input");
  return Math.floor(x / TWO_32) >>> 0;
}

function loOf(x: number): number {
  return x >>> 0;
}

/** The low 64 bits of `a × b`, into `outHi`, `outLo`. */
function mul64(aHi: number, aLo: number, bHi: number, bLo: number): void {
  // The full 64-bit product of the low halves, from 16-bit limbs (each partial below 2^32).
  const a0 = aLo & 0xffff;
  const a1 = aLo >>> 16;
  const b0 = bLo & 0xffff;
  const b1 = bLo >>> 16;
  const p00 = a0 * b0;
  const p01 = a0 * b1;
  const p10 = a1 * b0;
  const p11 = a1 * b1;
  const mid = (p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff);
  outLo = (((mid & 0xffff) << 16) | (p00 & 0xffff)) >>> 0;
  const carry = p11 + (p01 >>> 16) + (p10 >>> 16) + (mid >>> 16);
  // The cross terms reach only the high half, mod 2^32.
  outHi = (carry + Math.imul(aHi, bLo) + Math.imul(aLo, bHi)) >>> 0;
}

/**
 * splitmix64's finaliser (Steele, Lea and Flood 2014): a fixed bijection of u64 that spreads
 * every input bit over the output. Mixes `(hi, lo) ^ (xHi, xLo)` into `outHi`, `outLo`.
 */
function mix(hi0: number, lo0: number, xHi: number, xLo: number): void {
  // z = (h ^ x) + 0x9E37_79B9_7F4A_7C15
  const zLo = ((lo0 ^ xLo) >>> 0) + 0x7f4a7c15;
  let hi = (((hi0 ^ xHi) >>> 0) + 0x9e3779b9 + (zLo >= TWO_32 ? 1 : 0)) >>> 0;
  let lo = zLo >>> 0;
  // z = (z ^ (z >> 30)) × 0xBF58_476D_1CE4_E5B9
  mul64((hi ^ (hi >>> 30)) >>> 0, (lo ^ ((lo >>> 30) | (hi << 2))) >>> 0, 0xbf58476d, 0x1ce4e5b9);
  hi = outHi;
  lo = outLo;
  // z = (z ^ (z >> 27)) × 0x94D0_49BB_1331_11EB
  mul64((hi ^ (hi >>> 27)) >>> 0, (lo ^ ((lo >>> 27) | (hi << 5))) >>> 0, 0x94d049bb, 0x133111eb);
  hi = outHi;
  lo = outLo;
  // z ^ (z >> 31)
  outLo = (lo ^ ((lo >>> 31) | (hi << 1))) >>> 0;
  outHi = (hi ^ (hi >>> 31)) >>> 0;
}

const SALT_HI = Number(BigInt.asUintN(64, ESTIMATE_HASH_SALT) >> 32n);
const SALT_LO = Number(BigInt.asUintN(64, ESTIMATE_HASH_SALT) & 0xffff_ffffn);

/** A (seed, subject, kind) prefix and the subject's sign for the kind (D429). */
interface Prefix {
  hi: number;
  lo: number;
  sign: number;
}

/**
 * The prefixes worked out so far (D435: the prefix is computed once per subject and kind). A
 * pure function's memo: it never changes a result. Cleared when it grows past `PREFIX_CACHE_MAX`.
 */
const PREFIX_CACHE = new Map<string, Prefix>();
const PREFIX_CACHE_MAX = 200_000;

/** The hash's (seed, subject, kind) prefix. */
function hashPrefix(seed: bigint, subject: Subject, kind: Kind): Prefix {
  const k = kindCode(kind);
  const sHi = subject.kind === "Company" ? hiOf(subject.company) : 1;
  const sLo = subject.kind === "Company" ? loOf(subject.company) : loOf(assertCount(subject.industry));
  const key = `${seed}:${sHi}:${sLo}:${k}`;
  const hit = PREFIX_CACHE.get(key);
  if (hit !== undefined) return hit;
  const s = BigInt.asUintN(64, seed);
  mix(SALT_HI, SALT_LO, Number(s >> 32n), Number(s & 0xffff_ffffn));
  mix(outHi, outLo, sHi, sLo);
  mix(outHi, outLo, 0, k);
  const hi = outHi;
  const lo = outLo;
  mix(hi, lo, 0, TAG_SIGN);
  const p: Prefix = { hi, lo, sign: (outLo & 1) === 1 ? 1.0 : -1.0 };
  if (PREFIX_CACHE.size >= PREFIX_CACHE_MAX) PREFIX_CACHE.clear();
  PREFIX_CACHE.set(key, p);
  return p;
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
  const p = hashPrefix(seed, subject, kind);
  outHi = p.hi;
  outLo = p.lo;
  for (const x of rest) {
    if (typeof x === "bigint") {
      const v = BigInt.asUintN(64, x);
      mix(outHi, outLo, Number(v >> 32n), Number(v & 0xffff_ffffn));
    } else {
      mix(outHi, outLo, hiOf(x), loOf(x));
    }
  }
  return (BigInt(outHi) << 32n) | BigInt(outLo);
}

/** A uniform in [0, 1) from the last hash's top 53 bits. */
function unit(): number {
  return (outHi * 2097152 + (outLo >>> 11)) / 9007199254740992;
}

const BITS_VIEW = new DataView(new ArrayBuffer(8));

/** Hash tags of the three parts of the error. */
const TAG_SIGN = 1;
const TAG_BIAS = 2;
const TAG_JITTER = 3;

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
  const p = hashPrefix(seed, subject, kind);
  const y = Math.abs(year);
  const yHi = hiOf(y);
  const yLo = loOf(y);
  mix(p.hi, p.lo, 0, TAG_BIAS);
  mix(outHi, outLo, yHi, yLo);
  const bias = ESTIMATE_BIAS_MIN + unit() * (ESTIMATE_BIAS_MAX - ESTIMATE_BIAS_MIN);
  // The tail: the year, the period and the true value's bits (Rust `f64::to_bits`).
  BITS_VIEW.setFloat64(0, truth);
  const tHi = BITS_VIEW.getUint32(0);
  const tLo = BITS_VIEW.getUint32(4);
  mix(p.hi, p.lo, 0, TAG_JITTER);
  mix(outHi, outLo, yHi, yLo);
  mix(outHi, outLo, hiOf(period), loOf(period));
  mix(outHi, outLo, tHi, tLo);
  const j = unit();
  return p.sign * bias + (2.0 * j - 1.0) * ESTIMATE_JITTER;
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
  return { seed: typeof seed === "bigint" ? seed : BigInt(assertCount(seed, "seed")), omniscient, now };
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

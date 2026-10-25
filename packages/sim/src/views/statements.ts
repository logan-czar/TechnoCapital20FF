// v_statements: `get_company_statements(id, period, count)` (spec 9.2), the Company screen's
// Financials tab (spec 8): each company's published quarterly and yearly statements (3.9),
// newest last, and in Omniscient the posted months of the open quarter. Rebuilt quarterly
// (spec 9.4: compile, release, lock and recap ticks) and when Omniscient is toggled (D423).
// Ported from crates/sim/src/views/statements.rs; the types are in types/views/statements.ts.
//
// A quarter's statement is built at the close and published at the next release (spec 4.4), so
// between the two it is held back (D130); the four synthetic 2019 quarters are history at load,
// Q4 2019 published on 2 January 2020 (spec 4.4). Removed companies keep their filings (5.12
// step 3).
//
// A private company publishes no statements (spec 1, 5.20.1 Listing step 4), nor does a new
// listing before its first release after listing: their statements are served as
// `EstimatedStatement`s, one figure per line keyed by the statement's period, so a quarter's
// estimate does not move from release to release, and a year's flows sum its quarters' (D420,
// D430). Their exact archive is not in the view at all, so a screen cannot show it; Omniscient
// serves it.
//
// Differences from Rust: the view holds the published prefixes of the archive (`quarters`,
// `years`: what Rust's accessors return), not the whole shared archive, so the held-back quarter
// never crosses to the UI (see the contract's header). The statements themselves are shared with
// the World's archive (they are never changed once archived).

import { companyFinanceQuarters, companyFinanceStatus, companyFinanceYears } from "../finance/state.ts";
import { ledgerDefault, ledgerNetIncome, QUARTERS_PER_YEAR, trailingFour } from "../finance/statements.ts";
import { dateTimeDate, quarterFirstMonth, quarterNext } from "../time/calendar.ts";
import { cmpDate, type DateTime, type Quarter, quarterEq } from "../types/calendar.ts";
import { RELEASE_DAY } from "../types/control.ts";
import type { CompanyId } from "../types/ids.ts";
import type { Period, PostedMonth, Statement } from "../types/state/finance.ts";
import {
  ESTIMATE_FLOOR_TB,
  ESTIMATE_FLOOR_USD,
  type Estimator,
  type Figure,
  STATEMENT_LINE_VALUES,
  type StatementLine,
} from "../types/views/estimate.ts";
import type {
  CompanyStatements,
  EstimatedStatement,
  OperatingFigures,
  StatementPeriod,
  StatementsView,
} from "../types/views/statements.ts";
import {
  estimatorBanded,
  estimatorCompanyNow,
  estimatorOfPeriod,
  figureExactOf,
  figureMap,
  figureSum,
  statementLineIndex,
  statementLineIsFlow,
  statementLineOf,
  viewInputEstimator,
} from "./estimate.ts";
import type { ViewInput } from "./index.ts";

/**
 * Whether the statements of quarter `q` are published at `now`: from 00:00 on the release day of
 * the next quarter (spec 4.4 row 1; D130).
 */
export function quarterPublished(q: Quarter, now: DateTime): boolean {
  const first = quarterFirstMonth(quarterNext(q));
  return cmpDate(dateTimeDate(now), { year: first.year, month: first.month, day: RELEASE_DAY }) >= 0;
}

/** Whether a statement is published at `now` (a year with its Q4). */
export function published(s: Statement, now: DateTime): boolean {
  return s.period.kind === "Quarter"
    ? quarterPublished(s.period.quarter, now)
    : quarterPublished({ year: s.period.year, q: 4 }, now);
}

/** Rust `Period == Period`. */
export function periodEq(a: Period, b: Period): boolean {
  if (a.kind === "Quarter") return b.kind === "Quarter" && quarterEq(a.quarter, b.quarter);
  return b.kind === "Year" && a.year === b.year;
}

/** The figure of one line (Rust `EstimatedStatement::line`). */
export function estimatedStatementLine(s: EstimatedStatement, line: StatementLine): Figure {
  return s.lines[statementLineIndex(line)]!;
}

/**
 * One line of a quarter's (or a lone year's) statement as the views show it (D420, D430): the one
 * estimate of that figure for that period, so v_statements, v_filings and the TTM agree. The
 * compute and licences line is exact (D434); the guidance high end is the low end's band moved by
 * the guidance's width, so the two ends share one error.
 */
export function statementLine(
  est: Estimator,
  banded: boolean,
  id: CompanyId,
  s: Statement,
  l: StatementLine,
): Figure {
  switch (l) {
    case "Shared":
      return figureExactOf(statementLineOf(l, s));
    case "GuidanceHigh": {
      const width = s.key.guidance[1] - s.key.guidance[0];
      return figureMap(statementLine(est, banded, id, s, "GuidanceLow"), (x) => x + width);
    }
    default:
      return estimatorOfPeriod(
        est,
        banded,
        { kind: "Company", company: id },
        { kind: "Line", line: l },
        s.period,
        statementLineOf(l, s),
        ESTIMATE_FLOOR_USD,
      );
  }
}

function operating(est: Estimator, banded: boolean, id: CompanyId, s: Statement): OperatingFigures {
  const k = s.key;
  return {
    productivity: k.productivity,
    pc_bonus: k.pc_bonus,
    labor_units: k.labor_units,
    held_tb: estimatorOfPeriod(
      est,
      banded,
      { kind: "Company", company: id },
      { kind: "HeldTb" },
      s.period,
      k.held_tb,
      ESTIMATE_FLOOR_TB,
    ),
    free_rd_pct: k.free_rd_pct,
    management_score: k.management_score,
    rating: k.rating,
  };
}

/** The estimated statement of quarter statement `s` for company `id` (D420). */
export function estimatedQuarter(est: Estimator, id: CompanyId, s: Statement): EstimatedStatement {
  return {
    period: s.period,
    synthetic: s.synthetic,
    lines: STATEMENT_LINE_VALUES.map((l) => statementLine(est, true, id, s, l)),
    operating: operating(est, true, id, s),
  };
}

/**
 * The estimated statement of year statement `y` (D430): with its four quarters' estimates at hand,
 * its flows are their sums and its balance sheet, guidance and held TB are Q4's (one estimate per
 * figure); a year whose quarters have left the archive is estimated on its own.
 */
export function estimatedYear(
  est: Estimator,
  id: CompanyId,
  y: Statement,
  quarters: readonly EstimatedStatement[],
): EstimatedStatement {
  if (y.period.kind !== "Year") return estimatedQuarter(est, id, y);
  const year = y.period.year;
  const ofYear = quarters.filter((q) => q.period.kind === "Quarter" && q.period.quarter.year === year);
  if (ofYear.length !== QUARTERS_PER_YEAR) return estimatedQuarter(est, id, y);
  const q4 = ofYear[QUARTERS_PER_YEAR - 1]!;
  return {
    period: y.period,
    synthetic: y.synthetic,
    lines: STATEMENT_LINE_VALUES.map((l) => {
      if (l === "Shared") return figureExactOf(statementLineOf(l, y));
      if (statementLineIsFlow(l)) return figureSum(ofYear.map((q) => estimatedStatementLine(q, l)));
      return estimatedStatementLine(q4, l);
    }),
    operating: q4.operating,
  };
}

/** A year's estimate with what it was made from besides the year statement itself. */
interface YearEstimate {
  readonly seed: bigint;
  readonly id: CompanyId;
  /** The year's quarter estimates it summed (the same objects), or null for a lone year. */
  readonly ofYear: readonly EstimatedStatement[] | null;
  readonly value: EstimatedStatement;
}

const yearEstimates = new WeakMap<Statement, YearEstimate>();

/**
 * `estimatedYear`, reusing the last build's estimate of the same archived year statement (an
 * archived statement never changes) when it is of the same seed and company and sums the same
 * quarter estimates (D435 reuses those): then it is the same estimate, so each quarterly rebuild
 * does not sum ten years again. The result equals `estimatedYear`'s.
 */
function cachedYear(
  est: Estimator,
  id: CompanyId,
  y: Statement,
  quarters: readonly EstimatedStatement[],
): EstimatedStatement {
  if (y.period.kind !== "Year") return estimatedYear(est, id, y, quarters);
  const year = y.period.year;
  const ofYear = quarters.filter((q) => q.period.kind === "Quarter" && q.period.quarter.year === year);
  const used = ofYear.length === QUARTERS_PER_YEAR ? ofYear : null;
  const hit = yearEstimates.get(y);
  if (
    hit !== undefined &&
    hit.seed === est.seed &&
    hit.id === id &&
    (hit.ofYear === null ? used === null : used !== null && hit.ofYear.every((q, k) => q === used[k]))
  ) {
    return hit.value;
  }
  const value = estimatedYear(est, id, y, quarters);
  yearEstimates.set(y, { seed: est.seed, id, ofYear: used, value });
  return value;
}

/**
 * A trailing-four-quarters revenue or net income (spec 5.13 TTM, D228) from the published
 * quarters, as `trailingFour` makes it: exact for a publishing company, else the sum of the
 * quarters' bands (scaled up for fewer than four, D430); a company with none shows a band of 0.
 */
export function ttmLine(
  est: Estimator,
  banded: boolean,
  id: CompanyId,
  publishedQuarters: readonly Statement[],
  l: StatementLine,
): Figure {
  const n = Math.min(publishedQuarters.length, QUARTERS_PER_YEAR);
  if (!banded) {
    const ttm = trailingFour(publishedQuarters) ?? ledgerDefault();
    if (l === "Revenue") return figureExactOf(ttm.revenue);
    if (l === "NetIncome") return figureExactOf(ledgerNetIncome(ttm));
    throw new Error("a TTM of revenue or net income");
  }
  if (n === 0) return estimatorCompanyNow(est, true, id, { kind: "Line", line: l }, 0.0);
  const sum = figureSum(
    publishedQuarters.slice(publishedQuarters.length - n).map((s) => statementLine(est, true, id, s, l)),
  );
  const k = QUARTERS_PER_YEAR / n;
  return n === QUARTERS_PER_YEAR ? sum : figureMap(sum, (x) => x * k);
}

// ---------------------------------------------------------------- accessors

/** Rust `StatementsView::get`. */
export function statementsViewGet(v: StatementsView, id: CompanyId): CompanyStatements | undefined {
  return v.companies[id];
}

/**
 * `get_company_statements(id, period, count)` for quarters and years: the last `count` published
 * statements, oldest first; empty for a company that does not publish (see
 * `statementsViewEstimated`).
 */
export function statementsViewStatements(
  v: StatementsView,
  id: CompanyId,
  period: StatementPeriod,
  count: number,
): readonly Statement[] {
  const c = statementsViewGet(v, id);
  if (c === undefined || period === "Month") return [];
  const all = period === "Quarter" ? c.quarters : c.years;
  return all.slice(Math.max(0, all.length - count));
}

/**
 * The estimated statements of a company that does not publish, the last `count`, oldest first
 * (D420); empty for a publishing company.
 */
export function statementsViewEstimated(
  v: StatementsView,
  id: CompanyId,
  period: StatementPeriod,
  count: number,
): readonly EstimatedStatement[] {
  const c = statementsViewGet(v, id);
  if (c === undefined || period === "Month") return [];
  const all = period === "Quarter" ? c.estimated_quarters : c.estimated_years;
  return all.slice(Math.max(0, all.length - count));
}

/** The months of the open quarter (Omniscient), the last `count`. */
export function statementsViewMonths(
  v: StatementsView,
  id: CompanyId,
  count: number,
): readonly PostedMonth[] {
  const c = statementsViewGet(v, id);
  return c === undefined ? [] : c.months.slice(Math.max(0, c.months.length - count));
}

// ---------------------------------------------------------------- ViewData

/** Rust `ViewData::build`. */
export function buildStatements(input: ViewInput): StatementsView {
  return buildWith(input, []);
}

/**
 * Rust `ViewData::rebuild_from` (REBUILD_IN_PLACE): reuses the last build's estimates of quarters
 * still in the archive (D435): an archived quarter never changes, and its estimate is a function
 * of the seed, the company and the statement, so the result equals `build`'s. Years are summed
 * again (a year whose quarters leave the archive is estimated on its own). `prev` is read, never
 * changed (D962).
 */
export function rebuildStatementsFrom(prev: StatementsView, input: ViewInput): StatementsView {
  return buildWith(input, prev.companies);
}

function buildWith(input: ViewInput, prev: readonly CompanyStatements[]): StatementsView {
  const w = input.world;
  const omniscient = input.controls.omniscient;
  const est = viewInputEstimator(input);
  const count = (all: readonly Statement[]): number => {
    if (omniscient) return all.length;
    let n = 0;
    while (n < all.length && published(all[n]!, w.clock)) n++;
    return n;
  };
  const companies = w.companies.map((c, i): CompanyStatements => {
    const id = i as CompanyId;
    const banded = estimatorBanded(est, w, id);
    const allQuarters = companyFinanceQuarters(c.finance);
    const allYears = companyFinanceYears(c.finance);
    const quarters = count(allQuarters);
    const years = count(allYears);
    const p = prev[id];
    const old: readonly EstimatedStatement[] =
      p !== undefined && p.id === id && p.estimated ? p.estimated_quarters : [];
    // The archive and the last build's estimates are both oldest first, so the search for each
    // quarter's old estimate starts where the last one was found (the same estimate `find` gives:
    // a quarter appears once).
    let from = 0;
    const oldEstimate = (s: Statement): EstimatedStatement | undefined => {
      for (let k = from; k < old.length; k++) {
        if (periodEq(old[k]!.period, s.period)) {
          from = k + 1;
          return old[k];
        }
      }
      return old.slice(0, from).find((e) => periodEq(e.period, s.period));
    };
    const estimated_quarters = banded
      ? allQuarters.slice(0, quarters).map((s) => oldEstimate(s) ?? estimatedQuarter(est, id, s))
      : [];
    const estimated_years = banded
      ? allYears.slice(0, years).map((y) => cachedYear(est, id, y, estimated_quarters))
      : [];
    return {
      id,
      key: c.key,
      status: companyFinanceStatus(c.finance),
      estimated: banded,
      quarters: banded ? [] : allQuarters.slice(0, quarters),
      years: banded ? [] : allYears.slice(0, years),
      estimated_quarters,
      estimated_years,
      months: omniscient ? c.finance.months.slice() : [],
    };
  });
  return { companies };
}

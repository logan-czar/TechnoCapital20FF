// Port of crates/sim/tests/m4_views.rs: the M4 views (spec 9.2, 9.4; one file each):
// v_statements (`get_company_statements`, the Financials tab), v_filings (`get_filings`,
// Pdoomberg F5), v_ratings (Pdoomberg F6) and the finance figures of v_company_detail (the
// Overview tab). Statements are published at the release after their close (spec 4.4; D130).
//
// Expects:
//   ../../src/lib.ts                   simNew, simApply, simStep, simNow, simWorld, simViews
//   ../../src/views/statements.ts      statementsViewStatements(view, company, period, count)
//                                         -> Statement[] (oldest first, newest `count`)
//                                         [StatementsView::statements; period is "Quarter" | "Year"],
//                                         statementsViewMonths(view, company, count) -> PostedMonth[]
//                                         [StatementsView::months]
//   ../../src/views/estimate.ts        showsEstimates(world, company) [shows_estimates]
//   ../../src/finance/rating.ts        corporateSpread(rating)
//   ../../src/views/ratings.ts         ratingsViewBandCounts(view) -> [Band, number][]
//   ../common/ops.ts                      company, runTo
//   ../common/index.ts                    assertFigure
//
// Changed from the Rust:
// - The seeds (1, 2) seed the new generator (D951). Every assertion is on the books and the
//   views of them (statement periods, filings, ratings at load), not on draws, so none changes.
// - `if cfg!(debug_assertions)` (Omniscient only in debug builds) becomes: the Omniscient block
//   runs when SetOmniscient is accepted (the DebugOnly error skips it).
// - The println of Andes Cobre's rating is dropped.
import { describe, expect, it } from "vitest";
import { corporateSpread } from "../../src/finance/rating.ts";
import { simApply, simNew, simNow, simStep, simViews, simWorld } from "../../src/lib.ts";
import { dateTimeAt, simDateYmd } from "../../src/time/calendar.ts";
import type { Quarter } from "../../src/types/calendar.ts";
import type { CompanyId } from "../../src/types/ids.ts";
import type { Period } from "../../src/types/state/finance.ts";
import { showsEstimates } from "../../src/views/estimate.ts";
import { ratingsViewBandCounts } from "../../src/views/ratings.ts";
import { statementsViewMonths, statementsViewStatements } from "../../src/views/statements.ts";
import { assertFigure, data, unwrap } from "../common/index.ts";
import { company, runTo } from "../common/ops.ts";
import { byField, byId, figBand, figExact, figShown } from "../common/views.ts";

const q = (year: number, quarter: number): Period => ({
  kind: "Quarter",
  quarter: { year, q: quarter } as Quarter,
});

describe("m4 views", () => {
  it("statements_are_published_at_the_release", () => {
    const sim = unwrap(simNew(data(), 1), "Sim::new");
    const a = company(simWorld(sim), "CO-0001");
    // At load Q1 to Q3 2019 are history; Q4 2019 waits for the 2 January 2020 release (4.4).
    const quarters = (): Period[] =>
      statementsViewStatements(simViews(sim).statements.data, a, "Quarter", 20).map((s) => s.period);
    expect(quarters()).toEqual([q(2019, 1), q(2019, 2), q(2019, 3)]);
    expect(statementsViewStatements(simViews(sim).statements.data, a, "Year", 5)).toEqual([]);
    expect(simViews(sim).filings.data.quarter).toEqual({ year: 2019, q: 3 });
    runTo(sim, simDateYmd(2020, 1, 2));
    expect(quarters().at(-1)).toEqual(q(2019, 4));
    const y = statementsViewStatements(simViews(sim).statements.data, a, "Year", 5);
    expect(y.length).toBe(1);
    expect(y[0]?.period).toEqual({ kind: "Year", year: 2019 });
    const f = simViews(sim).filings.data;
    expect(f.quarter).toEqual({ year: 2019, q: 4 });
    expect(f.filings.length).toBe(651);
    const af = byField(f.filings, "company", a);
    if (af === undefined) throw new Error("no filing");
    expect(figExact(af.revenue)).toBe(simWorld(sim).companies[a]?.finance.archive.quarters[3]?.lines.revenue);
    expect(af.synthetic).toBe(true);
    // Q1 2020 is compiled at the 1 April close, unpublished until the 2 April release.
    runTo(sim, simDateYmd(2020, 4, 1));
    expect(simWorld(sim).companies[a]?.finance.archive.quarters.at(-1)?.period).toEqual(q(2020, 1));
    expect(quarters().at(-1)).toEqual(q(2019, 4));
    runTo(sim, simDateYmd(2020, 4, 2));
    expect(quarters().at(-1)).toEqual(q(2020, 1));
    expect(simViews(sim).filings.data.quarter).toEqual({ year: 2020, q: 1 });
    const aNow = byField(simViews(sim).filings.data.filings, "company", a);
    expect(aNow?.synthetic).toBe(false);
    // Monthly ledgers are not published; Omniscient (debug builds) shows the open quarter's.
    expect(statementsViewMonths(simViews(sim).statements.data, a, 3)).toEqual([]);
    runTo(sim, simDateYmd(2020, 6, 1));
    if (simApply(sim, { kind: "SetOmniscient", on: true }).ok) {
      // The view follows the toggle at once (D423).
      const months = [...statementsViewMonths(simViews(sim).statements.data, a, 3)];
      expect(months.length, "April and May").toBe(2);
      expect(months[0]?.month.month).toBe(4);
    }
  }, 120_000);

  it("ratings_and_company_detail_show_the_books", () => {
    const sim = unwrap(simNew(data(), 2), "Sim::new");
    runTo(sim, simDateYmd(2020, 1, 2));
    simStep(sim); // the 01:00 review
    expect(simNow(sim)).toBe(dateTimeAt(simDateYmd(2020, 1, 2), 1));
    const w = simWorld(sim);
    const r = simViews(sim).ratings.data;
    const d = simViews(sim).company_detail.data;
    expect(r.companies.length).toBe(651);
    const total = ratingsViewBandCounts(r).reduce((acc, [, n]) => acc + n, 0);
    expect(total).toBe(651);
    w.companies.forEach((c, idx) => {
      const id = idx as CompanyId;
      const row = byField(r.companies, "id", id);
      if (row === undefined) throw new Error(`no rating row ${c.key}`);
      const banded = showsEstimates(w, id);
      expect(banded, "no listing in play by 2 January 2020").toBe(!c.public);
      expect(row.rating).toEqual(c.finance.rating);
      expect(row.implied).toEqual(c.finance.implied);
      assertFigure(row.line_limit, c.finance.line.limit, banded, "line limit");
      assertFigure(row.line_drawn, c.finance.line.drawn, banded, "line drawn");
      expect(row.line_rate).toBe(w.base_rate + row.home_spread + corporateSpread(c.finance.rating));
      // The Overview (monthly) carries what load set: the January figures.
      const o = byId(d.companies, id);
      if (o === undefined) throw new Error(`no detail row ${c.key}`);
      assertFigure(o.cash_usd, c.cash_usd, banded, "cash");
      expect(o.status).toBe(c.finance.distress.status);
      expect(o.archetype).toEqual(c.archetype);
    });
    // list_companies (monthly): at load, revenue and NI over the trailing published quarters,
    // the synthetic Q1 to Q3 2019 annualized (D228): the run rate.
    const fresh = unwrap(simNew(data(), 2), "Sim::new");
    const w0 = simWorld(fresh);
    const rows = simViews(fresh).company_rows.data.rows;
    expect(rows.length).toBe(651);
    for (const row of rows) {
      const c = w0.companies[row.id];
      if (c === undefined) throw new Error(`no company ${row.id}`);
      const year = c.finance.archive.quarters.slice(0, 4).reduce((acc, s) => acc + s.lines.revenue, 0);
      const shown = figShown(row.revenue_ttm);
      if (c.public) {
        expect(Math.abs(shown - year) < 1e-6 * Math.max(year, 1.0), c.key).toBe(true);
      } else {
        const b = figBand(row.revenue_ttm);
        if (b === null) throw new Error(`${c.key}: no band`);
        expect(b.low < year && year < b.high && shown !== year, c.key).toBe(true);
      }
      expect(row.rating).toEqual(c.finance.rating);
    }
  }, 120_000);
});

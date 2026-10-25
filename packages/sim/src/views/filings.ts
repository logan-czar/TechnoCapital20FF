// v_filings: `get_filings(filter)` (spec 9.2), Pdoomberg F5 Filings (spec 8): the newest published
// quarter's statement of every company that filed it, the release's list. A quarter appears from
// its release (spec 4.4 row 1; D130). Older quarters are each company's archive in v_statements
// (20 quarters), so this view does not copy them again (D130). Rebuilt quarterly (spec 9.4) and
// when Omniscient is toggled (D423). A company that does not publish (private, or a new listing
// before its first release) files bands, the same as its v_statements estimate of that quarter
// (D420). Ported from crates/sim/src/views/filings.rs; the types are in types/views/filings.ts.

import { companyFinanceQuarters } from "../finance/state.ts";
import { cmpQuarter, type Quarter, quarterEq } from "../types/calendar.ts";
import type { CompanyId } from "../types/ids.ts";
import type { StatementLine } from "../types/views/estimate.ts";
import type { Filing, FilingsView } from "../types/views/filings.ts";
import { estimatorBanded, viewInputEstimator } from "./estimate.ts";
import type { ViewInput } from "./index.ts";
import { published, statementLine } from "./statements.ts";

/** `get_filings` for one company: its filing of the newest quarter, if it filed one. */
export function filingsViewOfCompany(v: FilingsView, id: CompanyId): Filing | undefined {
  return v.filings.find((f) => f.company === id);
}

/** Rust `ViewData::build`. */
export function buildFilings(input: ViewInput): FilingsView {
  const w = input.world;
  const est = viewInputEstimator(input);
  // The newest published quarter of any company (all file the same quarters).
  let latest: Quarter | null = null;
  for (const c of w.companies) {
    for (const s of companyFinanceQuarters(c.finance)) {
      if (s.period.kind !== "Quarter" || !published(s, w.clock)) continue;
      if (latest === null || cmpQuarter(s.period.quarter, latest) > 0) latest = s.period.quarter;
    }
  }
  if (latest === null) return { quarter: null, filings: [] };
  const quarter = latest;
  const filings: Filing[] = [];
  w.companies.forEach((c, i) => {
    const id = i as CompanyId;
    const qs = companyFinanceQuarters(c.finance);
    let s = null;
    for (let k = qs.length - 1; k >= 0; k--) {
      const p = qs[k]!.period;
      if (p.kind === "Quarter" && quarterEq(p.quarter, quarter)) {
        s = qs[k]!;
        break;
      }
    }
    if (s === null) return;
    const st = s;
    const banded = estimatorBanded(est, w, id);
    const fig = (l: StatementLine) => statementLine(est, banded, id, st, l);
    filings.push({
      company: id,
      quarter,
      revenue: fig("Revenue"),
      ebit: fig("Ebit"),
      ebitda: fig("Ebitda"),
      net_income: fig("NetIncome"),
      operating_cash: fig("OperatingCash"),
      cash: fig("Cash"),
      line_drawn: fig("BalanceLineDrawn"),
      equity: fig("Equity"),
      rating: st.key.rating,
      estimated: banded,
      synthetic: st.synthetic,
    });
  });
  return { quarter, filings };
}

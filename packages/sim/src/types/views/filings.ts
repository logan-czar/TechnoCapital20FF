// v_filings (crates/sim/src/views/filings.rs): `get_filings(filter)` (spec 9.2), Pdoomberg F5
// Filings (spec 8): the newest published quarter's statement of every company that filed it, the
// release's list. A quarter appears from its release (spec 4.4 row 1; D130). Older quarters are
// each company's archive in v_statements (20 quarters), so this view does not copy them again
// (D130). Rebuilt quarterly (spec 9.4) and when Omniscient is toggled (D423). A company that does
// not publish (private, or a new listing before its first release) files bands, the same as its
// v_statements estimate of that quarter (D420).
//
// Not ported: FilingsView::of_company and the `ViewData` build (logic).

import type { Quarter } from "../calendar.ts";
import type { CompanyId } from "../ids.ts";
import type { Figure } from "./estimate.ts";
import type { Rating } from "./shared.ts";

/** One published quarter of one company (spec 3.9 headline lines). */
export interface Filing {
  company: CompanyId;
  quarter: Quarter;
  revenue: Figure;
  ebit: Figure;
  ebitda: Figure;
  net_income: Figure;
  operating_cash: Figure;
  cash: Figure;
  line_drawn: Figure;
  equity: Figure;
  rating: Rating;
  /** The figures are estimate bands (D420). */
  estimated: boolean;
  /** Built from the starting run rate (the 2019 history, spec 4.4, 7.1). */
  synthetic: boolean;
}

export interface FilingsView {
  /** The newest published quarter (Q4 2019 from the 2 January 2020 release; Q3 2019 at load). */
  quarter: Quarter | null;
  /** That quarter's filings in company id order. */
  filings: Filing[];
}

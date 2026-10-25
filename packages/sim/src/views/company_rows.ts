// v_company_row: `list_companies(filter)` (spec 9.2). M4 fills the rows the books allow: id, name,
// ticker, industry, HQ, public, revenue TTM, net income TTM, rating and status, from the published
// statements (D130). M5 adds the exchange, price, day change and shown value at the rebuild (the
// live price is in v_quotes). M9 adds the archetype, origin, listing, owner of record and
// controller (spec 8 Company header, F10 Screener filters by origin and listing date), and shows a
// private company's or new listing's money figures as estimate bands (D420). Removed companies
// are left out (5.12 step 3: off the lists). Rebuilt monthly, at the plan lock and on load (spec
// 9.4), and when Omniscient is toggled (D423). Ported from crates/sim/src/views/company_rows.rs;
// the types are in types/views/company_rows.ts.

import { companyFinanceInGame, companyFinanceQuarters, companyFinanceStatus } from "../finance/state.ts";
import { shownValue } from "../market/fair_value.ts";
import type { SimDate } from "../types/calendar.ts";
import type { CompanyId, ZoneId } from "../types/ids.ts";
import type { Statement } from "../types/state/finance.ts";
import type { CompanyRow, CompanyRowsView, Listing } from "../types/views/company_rows.ts";
import type { Estimator, Figure } from "../types/views/estimate.ts";
import type { World } from "../types/world.ts";
import { controllerName, controllerOf } from "./cap_table.ts";
import { estimatorBanded, estimatorCompanyNow, figureExactOf, viewInputEstimator } from "./estimate.ts";
import type { ViewInput } from "./index.ts";
import { published, ttmLine } from "./statements.ts";

/** The listing exchange (Rust `Listing::exchange`). */
export function listingExchange(l: Listing): ZoneId | null {
  return l.kind === "Private" ? null : l.exchange;
}

/** The listing date; null while private and for "listed before 2020" (Rust `Listing::date`). */
export function listingDate(l: Listing): SimDate | null {
  return l.kind === "InPlay" ? l.date : null;
}

/** The published prefix of a company's quarters (D130). */
function publishedQuarters(w: World, id: CompanyId): readonly Statement[] {
  const quarters = companyFinanceQuarters(w.companies[id]!.finance);
  let n = 0;
  while (n < quarters.length && published(quarters[n]!, w.clock)) n++;
  return quarters.slice(0, n);
}

/**
 * A company's revenue TTM as its row shows it (spec 5.13 TTM; D420, D430): from the published
 * quarters, a band while the company does not publish. v_map_layers sizes HQ pins by it (D701).
 */
export function revenueTtm(est: Estimator, w: World, id: CompanyId): Figure {
  const banded = estimatorBanded(est, w, id);
  return ttmLine(est, banded, id, publishedQuarters(w, id), "Revenue");
}

/**
 * The value shown (spec 5.13 step 6): a listed company's EFV × shares, exact (it is already an
 * estimate, D140); a private company's 0.7 × fair value, one band (D420) that v_company_detail
 * divides by the shares for its value a share (D430).
 */
export function valueShown(est: Estimator, w: World, id: CompanyId, banded: boolean): Figure {
  const s = w.market.stocks[id]!;
  return s.exchange !== null
    ? figureExactOf(s.fair_value * (1.0 + s.efv_error))
    : estimatorCompanyNow(est, banded, id, { kind: "Value" }, shownValue(s.fair_value, false));
}

/** Rust `ViewData::build`. */
export function buildCompanyRows(input: ViewInput): CompanyRowsView {
  const w = input.world;
  const est = viewInputEstimator(input);
  const rows: CompanyRow[] = [];
  w.companies.forEach((c, i) => {
    if (!companyFinanceInGame(c.finance)) return;
    const id = i as CompanyId;
    const banded = estimatorBanded(est, w, id);
    const pub = publishedQuarters(w, id);
    const s = w.market.stocks[id]!;
    const value = valueShown(est, w, id, banded);
    const listing: Listing =
      s.exchange === null
        ? { kind: "Private" }
        : s.listed_on === null
          ? { kind: "BeforeStart", exchange: s.exchange }
          : { kind: "InPlay", exchange: s.exchange, date: s.listed_on, ipo_price: s.ipo_price };
    const owner = c.start_control?.owner_of_record ?? null;
    const controller = controllerOf(c);
    rows.push({
      id,
      key: c.key,
      name: c.name,
      ticker: c.ticker,
      industry: c.industry,
      hq_country: c.hq_country,
      public: c.public,
      revenue_ttm: ttmLine(est, banded, id, pub, "Revenue"),
      net_income_ttm: ttmLine(est, banded, id, pub, "NetIncome"),
      rating: c.finance.rating,
      status: companyFinanceStatus(c.finance),
      exchange: s.exchange,
      price: s.price,
      change: s.price - s.prev_close,
      value,
      archetype: c.archetype,
      origin: { ...c.origin },
      listing,
      owner_of_record: owner,
      owner_of_record_name: owner === null ? null : w.characters[owner]!.name,
      controller,
      controller_name: controllerName(w, controller),
      estimated: banded,
    });
  });
  return { rows };
}

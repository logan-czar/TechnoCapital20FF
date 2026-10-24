// v_company_row (crates/sim/src/views/company_rows.rs): `list_companies(filter)` (spec 9.2). M4
// fills the rows the books allow: id, name, ticker, industry, HQ, public, revenue TTM, net income
// TTM, rating and status, from the published statements (D130). M5 adds the exchange, price, day
// change and shown value at the rebuild (the live price is in v_quotes). M9 adds the archetype,
// origin, listing, owner of record and controller (spec 8 Company header, F10 Screener filters by
// origin and listing date), and shows a private company's or new listing's money figures as
// estimate bands (D420). Removed companies are left out (5.12 step 3: off the lists). Rebuilt
// monthly, at the plan lock and on load (spec 9.4), and when Omniscient is toggled (D423).
//
// Not ported: Listing::exchange and ::date, revenue_ttm, value_shown and the `ViewData` build
// (logic).

import type { SimDate } from "../calendar.ts";
import type { CharacterId, CompanyId, CountryId, IndustryId, ZoneId } from "../ids.ts";
import type { ControllerRef, Origin } from "../world.ts";
import type { Figure } from "./estimate.ts";
import type { Archetype, CompanyStatus, Rating } from "./shared.ts";

/**
 * Where a company is listed (spec 3.5 `listed_date`, 8 Company header "Listed [date] on
 * [exchange] at $[price]").
 */
export type Listing =
  | { kind: "Private" }
  /** One of the 467 listed at load: "listed before 2020" (no date; D428). */
  | { kind: "BeforeStart"; exchange: ZoneId }
  /** Listed in play at a plan lock (5.20.1). */
  | { kind: "InPlay"; exchange: ZoneId; date: SimDate; ipo_price: number };

/** One row of the company list. */
export interface CompanyRow {
  id: CompanyId;
  key: string;
  name: string;
  ticker: string;
  industry: IndustryId;
  hq_country: CountryId;
  public: boolean;
  /**
   * Trailing four published quarters (spec 5.13 TTM; D228); a band for a private company or
   * a new listing (D420).
   */
  revenue_ttm: Figure;
  net_income_ttm: Figure;
  rating: Rating;
  status: CompanyStatus;
  /** The listing exchange (spec 5.14), null while private. */
  exchange: ZoneId | null;
  /** P and the day's change at the rebuild (5.14); 0 for a private or delisted company. */
  price: number;
  change: number;
  /**
   * The value shown (spec 5.13 step 6): a listed company's market cap at its estimated fair
   * value (3.14.2), exact (it is already an estimate, D140); a private company's 0.7 × fair
   * value as a band (D420); 0 once Bankrupt.
   */
  value: Figure;
  /** Spec 6.1 (spec 9.2 `list_companies` archetype filter). */
  archetype: Archetype;
  /** Start or Born (spec 3.5; F10 Screener origin filter). */
  origin: Origin;
  /** Private, listed before 2020, or listed in play with its date (F10 listing-date filter). */
  listing: Listing;
  /** companies.csv `owner_of_record` and its name (spec 8 header; D425). */
  owner_of_record: CharacterId | null;
  owner_of_record_name: string | null;
  /**
   * The controller (companies.csv's, or a startup's lead founder) and its name; widely held
   * companies have none (spec 8 header).
   */
  controller: ControllerRef;
  controller_name: string | null;
  /** The figures are estimate bands (D420). */
  estimated: boolean;
}

export interface CompanyRowsView {
  /** Every company still in the game, in company id order. */
  rows: CompanyRow[];
}

// v_countries (crates/sim/src/views/countries.rs): `list_countries(filter)` and
// `get_country(iso3)` (spec 9.2; 3.2): every country with its iso3, name, superregion, financial
// zone, corporate tax rate, sovereign rating and spread (the economy settings sit on the zone,
// batch 155), and the companies headquartered there. Rebuilt monthly and at the plan lock (spec
// 9.4; startups are born at the lock, D159). Removed companies are left out (5.12 step 3).
//
// Not ported: CountriesView::get and ::by_iso3 (a binary search on iso3), and the `ViewData`
// build (logic).

import type { CompanyId, CountryId, ZoneId } from "../ids.ts";
import type { Rating } from "./shared.ts";

/** One country (spec 3.2, 9.2). */
export interface CountryRow {
  id: CountryId;
  iso3: string;
  name: string;
  /** countries.csv `superregion`. */
  superregion: string;
  zone: ZoneId;
  zone_name: string;
  gdp_usd: number;
  /** National corporate tax rate (spec 3.2, 5.11). */
  corp_tax_rate: number;
  sovereign_rating: Rating;
  /** A fraction (spec 5.1.2). */
  sovereign_spread: number;
  /** Companies with their HQ here, in company id order (spec 9.2 "HQ count"). */
  hq_companies: CompanyId[];
}

export interface CountriesView {
  /** In country id order (iso3 order, D4). */
  countries: CountryRow[];
}

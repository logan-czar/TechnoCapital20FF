// v_countries: `list_countries(filter)` and `get_country(iso3)` (spec 9.2; 3.2): every country
// with its iso3, name, superregion, financial zone, corporate tax rate, sovereign rating and
// spread (the economy settings sit on the zone, batch 155), and the companies headquartered
// there. Rebuilt monthly and at the plan lock (spec 9.4; startups are born at the lock, D159).
// Removed companies are left out (5.12 step 3). Ported from crates/sim/src/views/countries.rs.

import { companyFinanceStatus } from "../finance/state.ts";
import { type CompanyId, type CountryId, ordinal } from "../types/ids.ts";
import { cmpStr } from "../types/num.ts";
import type { CountriesView, CountryRow } from "../types/views/countries.ts";
import type { ViewInput } from "./index.ts";

/** Rust `CountriesView::get`. */
export function countriesViewGet(v: CountriesView, id: CountryId): CountryRow | null {
  return v.countries[id] ?? null;
}

/** Rust `CountriesView::by_iso3`: `get_country(iso3)`, a binary search (iso3 order, D4). */
export function countriesViewByIso3(v: CountriesView, iso3: string): CountryRow | null {
  let lo = 0;
  let hi = v.countries.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const row = v.countries[mid] as CountryRow;
    const c = cmpStr(row.iso3, iso3);
    if (c === 0) return row;
    if (c < 0) lo = mid + 1;
    else hi = mid;
  }
  return null;
}

/** Rust `impl ViewData for CountriesView`: `build`. */
export function buildCountries(input: ViewInput): CountriesView {
  const w = input.world;
  const hq: CompanyId[][] = w.countries.map(() => []);
  w.companies.forEach((c, i) => {
    if (companyFinanceStatus(c.finance) !== "Removed") {
      (hq[c.hq_country] as CompanyId[]).push(ordinal<CompanyId>(i));
    }
  });
  const countries = w.countries.map(
    (c, i): CountryRow => ({
      id: ordinal<CountryId>(i),
      iso3: c.key,
      name: c.name,
      superregion: c.superregion,
      zone: c.zone,
      zone_name: (w.zones[c.zone] as (typeof w.zones)[number]).name,
      gdp_usd: c.gdp_usd,
      corp_tax_rate: c.corp_tax_rate,
      sovereign_rating: c.sovereign_rating,
      sovereign_spread: c.sovereign_spread,
      hq_companies: hq[i] as CompanyId[],
    }),
  );
  return { countries };
}

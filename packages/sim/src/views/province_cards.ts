// v_province_card: `get_province(id)` (spec 9.2), the province card of spec 8's Map row:
// development, resource, terrain, Metro, key city, and the HQs and units there. Rebuilt monthly
// and on load (spec 9.4); companies born in play show at the next monthly rebuild. Ported from
// crates/sim/src/views/province_cards.rs; the types are in types/views/province_cards.ts.
//
// Units are listed by id only: their money figures (assets) come from v_units, which bands a
// company that does not publish (D420), so no second path can print a band's truth. Removed
// companies (5.12 step 3) are left out of both lists.

import { companyFinanceStatus } from "../finance/state.ts";
import { type CompanyId, ordinal, type ProvinceId, type UnitId } from "../types/ids.ts";
import type { LargestTrack, ProvinceCard, ProvinceCardsView } from "../types/views/province_cards.ts";
import type { ViewInput } from "./index.ts";

/** Rust `ProvinceCardsView::get`: `get_province(id)`. */
export function provinceCardsViewGet(v: ProvinceCardsView, id: ProvinceId): ProvinceCard | null {
  return v.cards[id] ?? null;
}

/** Rust `largest_track`: spec 3.3 `largest_track`: Commerce or Industry, ties count for both (10.3.1). */
export function largestTrack(commerce: number, industry: number): LargestTrack {
  if (commerce > industry) return "Commerce";
  if (commerce < industry) return "Industry";
  return "Both";
}

/** Rust `impl ViewData for ProvinceCardsView`: `build`. */
export function buildProvinceCards(input: ViewInput): ProvinceCardsView {
  const w = input.world;
  const n = w.provinces.length;
  const hqs: CompanyId[][] = Array.from({ length: n }, () => []);
  w.companies.forEach((c, i) => {
    if (companyFinanceStatus(c.finance) !== "Removed") {
      (hqs[c.hq_province] as CompanyId[]).push(ordinal<CompanyId>(i));
    }
  });
  const units: UnitId[][] = Array.from({ length: n }, () => []);
  w.units.forEach((u, i) => {
    const company = w.companies[u.company] as (typeof w.companies)[number];
    if (companyFinanceStatus(company.finance) !== "Removed") {
      (units[u.base_province] as UnitId[]).push(ordinal<UnitId>(i));
    }
  });
  const sites = w.births.sites;
  const cards = w.provinces.map((p, i): ProvinceCard => {
    const s = input.map.provinces[i];
    const commerce = s === undefined ? 0 : s.commerce;
    const industry = s === undefined ? 0 : s.industry;
    const population = s === undefined ? 0 : s.population;
    const k = sites.key_city[i] ?? null;
    return {
      id: ordinal<ProvinceId>(i),
      key: p.key,
      name: p.name,
      country: p.country,
      region: s === undefined ? "" : s.region,
      area: s === undefined ? "" : s.area,
      commerce,
      industry,
      population,
      total: commerce + industry + population,
      largest_track: largestTrack(commerce, industry),
      resource: s === undefined ? "" : s.resource,
      terrain: s === undefined ? "" : s.terrain,
      coastal: s !== undefined && s.coastal,
      contested: s === undefined ? null : s.contested,
      metro: s === undefined ? null : s.metro,
      city_rank: s === undefined ? "" : s.city_rank,
      key_city: k === null ? null : (sites.key_cities[k] as (typeof sites.key_cities)[number]).name,
      hqs: hqs[i] as CompanyId[],
      units: units[i] as UnitId[],
    };
  });
  return { cards };
}

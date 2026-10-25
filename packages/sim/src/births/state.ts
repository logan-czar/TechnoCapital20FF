// The births state on the World (spec 3.1 `startup_events`, 5.19, 5.20; build-plan M6.6 to M6.9):
// the fixed events with their fired flags, the log of every event that fired, the company name
// lists, the static province weights the HQ draws read, and the tipped lab. Built once at load
// from the data, so a save loads without the CSVs (D13). Ported from
// crates/sim/src/births/state.rs.
//
// The types (BirthsState, EventRecord, KeyCitySite, Sites) are in types/state/births.ts.

import { SUPERREGIONS, type WorldData } from "@tc20ff/sim-data";
import { type CountryId, type IndustryId, ordinal, type ProvinceId } from "../types/ids.ts";
import { cmpStr } from "../types/num.ts";
import type { BirthsState, KeyCitySite, Sites } from "../types/state/births.ts";
import type { Result } from "../types/world.ts";
import { USD_PER_BILLION } from "../types/world.ts";
import { fixedEventFromRow, type Region, regionContains } from "./fixed.ts";
import { companyNamesDefault, companyNamesFromData } from "./names.ts";
import { developmentAboveFloor, gdpPerHead, provinceWeight, wealthFactor } from "./weights.ts";

export type { BirthsState, EventRecord, KeyCitySite, Sites } from "../types/state/births.ts";

/** countries.csv `population_m` is in millions of people (2-map 2.3.1 GDP per head). */
export const PEOPLE_PER_MILLION = 1.0e6;

/** Rust `Sites::default()`. */
export function sitesDefault(): Sites {
  return {
    weight: [],
    hq_weight: [],
    hq_fallback_countries: [],
    superregion: [],
    key_city: [],
    key_cities: [],
    country_provinces: [],
  };
}

/** Rust `BirthsState::default()`. */
export function birthsStateDefault(): BirthsState {
  return {
    fixed: [],
    fixed_fired: [],
    events: [],
    names: companyNamesDefault(),
    sites: sitesDefault(),
    tipped_lab: null,
  };
}

/** The superregion slug of a province (Rust `Sites::superregion_slug`). */
export function sitesSuperregionSlug(s: Sites, p: ProvinceId): string {
  return (SUPERREGIONS[s.superregion[p] as number] as readonly [string, string])[0];
}

/** True if a key city in province `p` lists `industry` (5.19.1 "× 3"; Rust `Sites::key_city_lists`). */
export function sitesKeyCityLists(s: Sites, p: ProvinceId, industry: IndustryId): boolean {
  const k = s.key_city[p];
  if (k === null || k === undefined) return false;
  return (s.key_cities[k] as KeyCitySite).industries.includes(industry);
}

/** The place a headline names (5.18 "[city or province]"): the key city, else the province (Rust `Sites::place`). */
export function sitesPlace(s: Sites, p: ProvinceId, province_name: string): string {
  const k = s.key_city[p];
  return k === null || k === undefined ? province_name : (s.key_cities[k] as KeyCitySite).name;
}

/** Rust `slice::binary_search` on a sorted list of strings: the index, or null if absent. */
function binarySearch(keys: readonly string[], key: string): number | null {
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const c = cmpStr(keys[mid] as string, key);
    if (c === 0) return mid;
    if (c < 0) lo = mid + 1;
    else hi = mid;
  }
  return null;
}

/**
 * The births state from the data (no draws): the fixed events, the name lists and the province
 * weights. `province_keys` and `country_keys` are the World's keys in ordinal order,
 * `industry_names` the World's industry names in ordinal order. The error is the message (Rust
 * `BadBirthsData`). Rust `BirthsState::from_data`.
 */
export function birthsStateFromData(
  data: WorldData,
  province_keys: readonly string[],
  country_keys: readonly string[],
  industry_names: readonly string[],
): Result<BirthsState, string> {
  const fixed = [];
  for (const row of data.startup_events.rows) {
    const r = fixedEventFromRow(row);
    if (!r.ok) return { ok: false, error: r.error.message };
    fixed.push(r.value);
  }
  const fixed_fired = fixed.map(() => false);

  // 2-map 2.3.1: G from the country's GDP per head against the world's (D260).
  const gdp: number[] = country_keys.map(() => 0.0);
  const pop: number[] = country_keys.map(() => 0.0);
  for (const c of data.countries.rows) {
    const i = binarySearch(country_keys, c.iso3);
    if (i !== null) {
      gdp[i] = c.gdp_usd_bn * USD_PER_BILLION;
      pop[i] = c.population_m * PEOPLE_PER_MILLION;
    }
  }
  let gdp_total = 0.0;
  for (const v of gdp) gdp_total += v;
  let pop_total = 0.0;
  for (const v of pop) pop_total += v;
  const world_gdp_per_head = gdpPerHead(gdp_total, pop_total);
  const g = country_keys.map((_, i) =>
    wealthFactor(gdpPerHead(gdp[i] as number, pop[i] as number), world_gdp_per_head),
  );

  const n = province_keys.length;
  const sites: Sites = {
    weight: new Array<number>(n).fill(0.0),
    hq_weight: new Array<number>(n).fill(0.0),
    hq_fallback_countries: [],
    superregion: new Array<number>(n).fill(0),
    key_city: new Array<number | null>(n).fill(null),
    key_cities: [],
    country_provinces: country_keys.map(() => []),
  };
  let bad: string | null = null;
  data.provinces.forEach((table, region) => {
    for (const p of table.rows) {
      if (bad !== null) return;
      const i = binarySearch(province_keys, p.id);
      if (i === null) continue;
      const country = binarySearch(country_keys, p.country);
      if (country === null) {
        bad = `province ${p.id}: unknown country ${p.country}`;
        return;
      }
      sites.superregion[i] = region;
      sites.weight[i] = provinceWeight(p.commerce + p.industry + p.population, g[country] as number);
      sites.hq_weight[i] = provinceWeight(
        developmentAboveFloor(p.commerce, p.industry, p.population),
        g[country] as number,
      );
      (sites.country_provinces[country] as ProvinceId[]).push(ordinal<ProvinceId>(i));
    }
  });
  if (bad !== null) return { ok: false, error: bad };
  for (const list of sites.country_provinces) list.sort((a, b) => a - b);
  // D830: a country with every province at the floor keeps the 2.3.1 weight for its HQs, so it
  // can still draw startups
  sites.country_provinces.forEach((list, c) => {
    if (list.length > 0 && list.every((p) => (sites.hq_weight[p] as number) <= 0.0)) {
      for (const p of list) sites.hq_weight[p] = sites.weight[p] as number;
      sites.hq_fallback_countries.push(ordinal<CountryId>(c));
    }
  });
  for (const kc of data.key_cities.rows) {
    const industries: IndustryId[] = [];
    for (const s of kc.specialties) {
      const at = industry_names.indexOf(s);
      if (at >= 0) industries.push(ordinal<IndustryId>(at));
    }
    const k = sites.key_cities.length;
    sites.key_cities.push({ name: kc.city, industries });
    for (const pid of kc.province_ids) {
      const i = binarySearch(province_keys, pid);
      if (i !== null && sites.key_city[i] === null) sites.key_city[i] = k;
    }
  }
  return {
    ok: true,
    value: {
      fixed,
      fixed_fired,
      events: [],
      names: companyNamesFromData(data),
      sites,
      tipped_lab: null,
    },
  };
}

/** The provinces inside any of `regions`, given the province's country key (Rust `in_regions`). */
export function birthsInRegions(
  b: BirthsState,
  p: ProvinceId,
  iso3: string,
  regions: readonly Region[],
): boolean {
  const slug = sitesSuperregionSlug(b.sites, p);
  return regions.some((r) => regionContains(r, slug, iso3));
}

/**
 * The other provinces of a country with their weights (3.7.2 home province), in id order (Rust
 * `home_others`).
 */
export function birthsHomeOthers(b: BirthsState, country: CountryId, hq: ProvinceId): [ProvinceId, number][] {
  // D830: the weight above the floor, so no founder lives in an empty 1/1/1 part; the 2.3.1
  // weight when every other province of the country sits at the floor
  const others = (b.sites.country_provinces[country] as ProvinceId[]).filter((p) => p !== hq);
  const base = others.some((p) => (b.sites.hq_weight[p] as number) > 0.0)
    ? b.sites.hq_weight
    : b.sites.weight;
  return others.map((p): [ProvinceId, number] => [p, base[p] as number]);
}

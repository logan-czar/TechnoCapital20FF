// The mock sim's static world: the starting CSVs (parsed by @tc20ff/sim-data's pure parseWorld)
// turned into the id-indexed tables the mock views are built from. Ids are table indexes
// (spec 3: countries in iso3 order, D4; everything else in file order).

import {
  type CompanyId,
  type CompanyStatus,
  type CountryId,
  cmpStr,
  type IndustryId,
  type ProvinceId,
  RATING_VALUES,
  type Rating,
  type ZoneId,
} from "@tc20ff/sim";
import { type WorldData, worldDataAllProvinces } from "@tc20ff/sim-data";

/** FNV-1a: a stable hash of a string, for plausible but fixed per-entity numbers. */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** A value in [0, 1) from a string and a salt. */
export function unitHash(s: string, salt: number): number {
  return (hashStr(s + String(salt)) % 100000) / 100000;
}

/** "AAA", "AA+", "BBB-" to a Rating notch (RATING_VALUES names). */
export function ratingFromLabel(label: string): Rating {
  const m = /^(AAA|AA|A|BBB|BB|B|CCC|CC)([+-])?$/.exec(label.trim().toUpperCase());
  if (!m) return "Bbb";
  const base = m[1] === "AAA" ? "Aaa" : (m[1] as string).charAt(0) + (m[1] as string).slice(1).toLowerCase();
  const name = base + (m[2] === "+" ? "Plus" : m[2] === "-" ? "Minus" : "");
  return (RATING_VALUES as readonly string[]).includes(name) ? (name as Rating) : "Bbb";
}

export interface MockCompany {
  id: CompanyId;
  key: string;
  name: string;
  ticker: string;
  industry: IndustryId;
  country: CountryId;
  zone: ZoneId | null;
  public: boolean;
  revenueUsd: number;
  valueUsd: number;
  rating: Rating;
  status: CompanyStatus;
  startPrice: number;
  shares: number;
}

export interface MockWorld {
  data: WorldData;
  countryByIso3: Map<string, CountryId>;
  zoneByKey: Map<string, ZoneId>;
  industryByKey: Map<string, IndustryId>;
  /** The financial zone of each country (country-economy.csv), by iso3. */
  zoneOfIso3: Map<string, ZoneId>;
  companies: MockCompany[];
  /** Company ids with a listing (public), in id order. */
  listed: CompanyId[];
  /** Province ids (map ordinals: id order) with names and countries. */
  provinces: { id: ProvinceId; key: string; name: string; country: CountryId }[];
  /** Country table rows in id order (iso3 order). */
  countryOrder: number[];
}

const BAND_RATINGS: Rating[] = ["Aa", "A", "Bbb", "Bbb", "Bb", "B"];

/** Derives the id tables from the parsed CSVs. */
export function buildMockWorld(data: WorldData): MockWorld {
  const countryOrder = data.countries.rows
    .map((_, i) => i)
    .sort((a, b) =>
      cmpStr(
        (data.countries.rows[a] as { iso3: string }).iso3,
        (data.countries.rows[b] as { iso3: string }).iso3,
      ),
    );
  const countryByIso3 = new Map<string, CountryId>();
  countryOrder.forEach((row, id) => {
    countryByIso3.set((data.countries.rows[row] as { iso3: string }).iso3, id as CountryId);
  });
  const zoneByKey = new Map<string, ZoneId>();
  data.financial_zones.rows.forEach((z, i) => {
    zoneByKey.set(z.zone_id, i as ZoneId);
  });
  const industryByKey = new Map<string, IndustryId>();
  data.industries.rows.forEach((x, i) => {
    industryByKey.set(x.id, i as IndustryId);
    // companies.csv names the industry as the industries.csv name ("Oil"), not its id.
    industryByKey.set(x.name, i as IndustryId);
  });
  const start = new Map(data.company_start.rows.map((r) => [r.id, r]));
  const zoneOfCountry = new Map<string, ZoneId>();
  for (const e of data.country_economy.rows) {
    const z = zoneByKey.get(e.financial_zone);
    if (z !== undefined) zoneOfCountry.set(e.iso3, z);
  }

  const companies: MockCompany[] = data.companies.rows.map((c, i) => {
    const valueUsd = c.est_value_usd_m * 1e6;
    const st = start.get(c.id);
    const startPrice =
      st && st.open_price > 0 ? st.open_price : Math.max(1, 4 + Math.floor(unitHash(c.id, 1) * 380) / 2);
    return {
      id: i as CompanyId,
      key: c.id,
      name: c.name,
      ticker: c.ticker,
      industry: industryByKey.get(c.industry) ?? (0 as IndustryId),
      country: countryByIso3.get(c.hq_country) ?? (0 as CountryId),
      zone: c.public ? (zoneOfCountry.get(c.hq_country) ?? null) : null,
      public: c.public,
      revenueUsd: c.revenue_usd_m * 1e6,
      valueUsd,
      rating: st
        ? ratingFromLabel(st.start_rating)
        : (BAND_RATINGS[Math.floor(unitHash(c.id, 2) * BAND_RATINGS.length)] as Rating),
      status: "Active",
      startPrice,
      shares: st && st.shares > 0 ? st.shares : Math.max(1, Math.floor(valueUsd / startPrice)),
    };
  });
  const listed = companies.filter((c) => c.public && c.zone !== null).map((c) => c.id);

  const provinces = worldDataAllProvinces(data)
    .map(([, , p]) => p)
    .sort((a, b) => cmpStr(a.id, b.id))
    .map((p, i) => ({
      id: i as ProvinceId,
      key: p.id,
      name: p.name,
      country: countryByIso3.get(p.country) ?? (0 as CountryId),
    }));

  return {
    data,
    countryByIso3,
    zoneByKey,
    industryByKey,
    zoneOfIso3: zoneOfCountry,
    companies,
    listed,
    provinces,
    countryOrder,
  };
}

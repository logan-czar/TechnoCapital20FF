// The starting world data: every table, the parser over a `Files` map and the row counts. Ported
// from crates/sim-data/src/lib.rs. `parseWorld` is pure (text in, `WorldData` out), so it runs in
// a browser Web Worker as well as in Node; Node file reading is `loadWorld` in ./node.ts.

import { type DataError, ok, type Result } from "./error.ts";
import { type Files, loadTable, type RowSpec, type Table, tableIter, tableLen } from "./load.ts";
import type { MapAssets } from "./map.ts";
import {
  AI_BOOM_STAGE_SPEC,
  type AiBoomStage,
  CHARACTER_SPEC,
  type Character,
  COMPANY_SPEC,
  COMPANY_START_SPEC,
  COUNTRY_CULTURE_SPEC,
  COUNTRY_ECONOMY_SPEC,
  COUNTRY_SPEC,
  type Company,
  type CompanyStart,
  type Country,
  type CountryCulture,
  type CountryEconomy,
  FINANCIAL_ZONE_SPEC,
  type FinancialZone,
  INDUSTRY_SPEC,
  INDUSTRY_SUFFIX_SPEC,
  type Industry,
  type IndustrySuffix,
  KEY_CITY_SPEC,
  type KeyCity,
  NAME_ROW_SPEC,
  type NameRow,
  PROVINCE_SPEC,
  type Province,
  STARTUP_EVENT_SPEC,
  type StartupEvent,
} from "./rows.ts";

/** The 8 superregions: the slug used in file names and the name used in countries.csv. */
export const SUPERREGIONS: readonly (readonly [slug: string, name: string])[] = [
  ["east-asia-oceania", "East Asia and Oceania"],
  ["europe", "Europe"],
  ["latin-america", "Latin America"],
  ["mena", "Middle East and North Africa"],
  ["north-america", "North America"],
  ["russia-central-asia", "Russia and Central Asia"],
  ["south-asia", "South Asia"],
  ["sub-saharan-africa", "Sub-Saharan Africa"],
];

/** Every table of the starting world. */
export interface WorldData {
  countries: Table<Country>;
  /** One table per superregion, in SUPERREGIONS order. */
  provinces: Table<Province>[];
  companies: Table<Company>;
  characters: Table<Character>;
  industries: Table<Industry>;
  country_economy: Table<CountryEconomy>;
  financial_zones: Table<FinancialZone>;
  ai_boom: Table<AiBoomStage>;
  key_cities: Table<KeyCity>;
  company_start: Table<CompanyStart>;
  startup_events: Table<StartupEvent>;
  /** Name lists, one table per superregion, in SUPERREGIONS order. */
  names: Table<NameRow>[];
  country_cultures: Table<CountryCulture>;
  industry_suffixes: Table<IndustrySuffix>;
  /**
   * The map assets (`assets/map`, M8), when the game loaded them (`parseMap`); null for the
   * headless runner and most tests, and before lane P has made any.
   */
  map: MapAssets | null;
}

/** Every province of the 8 files, with its table (for error messages) and line. */
export function worldDataAllProvinces(w: WorldData): [Table<Province>, number, Province][] {
  return w.provinces.flatMap((t) =>
    tableIter(t).map(([line, p]): [Table<Province>, number, Province] => [t, line, p]),
  );
}

/** Row counts by table, in a fixed order (provinces and names summed over their 8 files). */
export function worldDataCounts(w: WorldData): [string, number][] {
  const sum = <T>(ts: Table<T>[]): number => ts.reduce((n, t) => n + tableLen(t), 0);
  return [
    ["countries", tableLen(w.countries)],
    ["provinces", sum(w.provinces)],
    ["companies", tableLen(w.companies)],
    ["characters", tableLen(w.characters)],
    ["industries", tableLen(w.industries)],
    ["country-economy", tableLen(w.country_economy)],
    ["financial-zones", tableLen(w.financial_zones)],
    ["ai-boom", tableLen(w.ai_boom)],
    ["key-cities", tableLen(w.key_cities)],
    ["company-start", tableLen(w.company_start)],
    ["startup-events", tableLen(w.startup_events)],
    ["names", sum(w.names)],
    ["country-cultures", tableLen(w.country_cultures)],
    ["industry-suffixes", tableLen(w.industry_suffixes)],
  ];
}

/** The per-region file names of `pattern` (`{}` replaced by each slug). */
function regionFiles(pattern: string): string[] {
  return SUPERREGIONS.map(([slug]) => pattern.replace("{}", slug));
}

/** Every CSV of the starting world, relative to the data directory, in load order. */
export const WORLD_FILES: readonly string[] = [
  "countries.csv",
  ...regionFiles("provinces-{}.csv"),
  "companies.csv",
  "characters.csv",
  "industries.csv",
  "country-economy.csv",
  "financial-zones.csv",
  "ai-boom.csv",
  "key-cities.csv",
  "company-start.csv",
  "startup-events.csv",
  ...regionFiles("names/{}.csv"),
  "names/country-cultures.csv",
  "names/industry-suffixes.csv",
];

/** One table per superregion, from `pattern` with `{}` replaced by each slug. */
function perRegion<T>(files: Files, pattern: string, spec: RowSpec<T>): Result<Table<T>[], DataError> {
  const tables: Table<T>[] = [];
  for (const file of regionFiles(pattern)) {
    const t = loadTable(files, file, spec);
    if (!t.ok) return t;
    tables.push(t.value);
  }
  return ok(tables);
}

/**
 * Parses every table from `files` (WORLD_FILES, by relative path). Stops at the first file that
 * does not parse; the error names the file, line and field (spec 10 M0). Rust `load_world`, minus
 * the file reading.
 */
export function parseWorld(files: Files): Result<WorldData, DataError> {
  const countries = loadTable(files, "countries.csv", COUNTRY_SPEC);
  if (!countries.ok) return countries;
  const provinces = perRegion(files, "provinces-{}.csv", PROVINCE_SPEC);
  if (!provinces.ok) return provinces;
  const companies = loadTable(files, "companies.csv", COMPANY_SPEC);
  if (!companies.ok) return companies;
  const characters = loadTable(files, "characters.csv", CHARACTER_SPEC);
  if (!characters.ok) return characters;
  const industries = loadTable(files, "industries.csv", INDUSTRY_SPEC);
  if (!industries.ok) return industries;
  const countryEconomy = loadTable(files, "country-economy.csv", COUNTRY_ECONOMY_SPEC);
  if (!countryEconomy.ok) return countryEconomy;
  const financialZones = loadTable(files, "financial-zones.csv", FINANCIAL_ZONE_SPEC);
  if (!financialZones.ok) return financialZones;
  const aiBoom = loadTable(files, "ai-boom.csv", AI_BOOM_STAGE_SPEC);
  if (!aiBoom.ok) return aiBoom;
  const keyCities = loadTable(files, "key-cities.csv", KEY_CITY_SPEC);
  if (!keyCities.ok) return keyCities;
  const companyStart = loadTable(files, "company-start.csv", COMPANY_START_SPEC);
  if (!companyStart.ok) return companyStart;
  const startupEvents = loadTable(files, "startup-events.csv", STARTUP_EVENT_SPEC);
  if (!startupEvents.ok) return startupEvents;
  const names = perRegion(files, "names/{}.csv", NAME_ROW_SPEC);
  if (!names.ok) return names;
  const countryCultures = loadTable(files, "names/country-cultures.csv", COUNTRY_CULTURE_SPEC);
  if (!countryCultures.ok) return countryCultures;
  const industrySuffixes = loadTable(files, "names/industry-suffixes.csv", INDUSTRY_SUFFIX_SPEC);
  if (!industrySuffixes.ok) return industrySuffixes;
  return ok({
    countries: countries.value,
    provinces: provinces.value,
    companies: companies.value,
    characters: characters.value,
    industries: industries.value,
    country_economy: countryEconomy.value,
    financial_zones: financialZones.value,
    ai_boom: aiBoom.value,
    key_cities: keyCities.value,
    company_start: companyStart.value,
    startup_events: startupEvents.value,
    names: names.value,
    country_cultures: countryCultures.value,
    industry_suffixes: industrySuffixes.value,
    map: null,
  });
}

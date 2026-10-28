// One row type per CSV file in `docs/design/data/` (build-plan 2.1, M0.2). Ported from
// crates/sim-data/src/rows.rs. Field names are the exact CSV column names (data/README.md);
// unknown columns are rejected so the files and the types cannot drift apart unseen. Money and
// rates are plain f64 (build-plan 6, decision A). Each row type has a `*_SPEC` (the serde derive
// of the Rust struct): its columns in declaration order with their parsers.

import { err, ok, type Result } from "./error.ts";
import { enumOf, f64, optF64, optU32, type Parse, rowSpec, semiList, str, u8, u32, yesNo } from "./load.ts";

/** countries.csv: one row per country (spec 7.3). */
export interface Country {
  iso3: string;
  name: string;
  superregion: string;
  currency: string;
  gdp_usd_bn: number;
  population_m: number;
  /** Equality index, 10 (servitude) to 95 (batch 158). */
  wealth_index: number;
  major: boolean;
  hss: number;
  legislature_strength: number;
  judiciary_strength: number;
  variant: string;
  restriction_label: string;
  subject_of: string;
  provinces_planned: number;
  notes: string;
}

export const COUNTRY_SPEC = rowSpec<Country>({
  iso3: str,
  name: str,
  superregion: str,
  currency: str,
  gdp_usd_bn: f64,
  population_m: f64,
  wealth_index: u32,
  major: yesNo,
  hss: u32,
  legislature_strength: u32,
  judiciary_strength: u32,
  variant: str,
  restriction_label: str,
  subject_of: str,
  provinces_planned: u32,
  notes: str,
});

/** provinces-*.csv: one row per province, in 8 superregion files. */
export interface Province {
  id: string;
  name: string;
  country: string;
  region: string;
  area: string;
  metro: string;
  city_rank: string;
  commerce: number;
  industry: number;
  population: number;
  resource: string;
  terrain: string;
  coastal: boolean;
  chokepoint: string;
  contested: string;
  linked_cities: string;
  notes: string;
}

export const PROVINCE_SPEC = rowSpec<Province>({
  id: str,
  name: str,
  country: str,
  region: str,
  area: str,
  metro: str,
  city_rank: str,
  commerce: u32,
  industry: u32,
  population: u32,
  resource: str,
  terrain: str,
  coastal: yesNo,
  chokepoint: str,
  contested: str,
  linked_cities: str,
  notes: str,
});

/** companies.csv: the 651 named companies (spec 7.1). */
export interface Company {
  id: string;
  name: string;
  ticker: string;
  industry: string;
  hq_country: string;
  hq_province: string;
  public: boolean;
  revenue_usd_m: number;
  book_value_usd_m: number;
  est_value_usd_m: number;
  controller: string;
  /** Rust `Option<f64>`: null when the cell is empty. */
  controller_stake_pct: number | null;
  control_basis: string;
  owner_of_record: string;
  other_holders: string;
  notes: string;
}

export const COMPANY_SPEC = rowSpec<Company>({
  id: str,
  name: str,
  ticker: str,
  industry: str,
  hq_country: str,
  hq_province: str,
  public: yesNo,
  revenue_usd_m: f64,
  book_value_usd_m: f64,
  est_value_usd_m: f64,
  controller: str,
  controller_stake_pct: optF64,
  control_basis: str,
  owner_of_record: str,
  other_holders: str,
  notes: str,
});

/** characters.csv: the 296 full characters. */
export interface Character {
  id: string;
  name: string;
  tier: string;
  profile: string;
  superregion: string;
  region_group: number;
  country: string;
  origin_province: string;
  location: string;
  age: number;
  money_type: string;
  finance: number;
  operations: number;
  persuasion: number;
  intrigue: number;
  tech: number;
  hustle: number;
  traits: string[];
  ideology: string;
  cash_usd: number;
  net_worth_est_usd: number;
  hook: string;
  notes: string;
}

export const CHARACTER_SPEC = rowSpec<Character>({
  id: str,
  name: str,
  tier: str,
  profile: str,
  superregion: str,
  region_group: u8,
  country: str,
  origin_province: str,
  location: str,
  age: u8,
  money_type: str,
  finance: u8,
  operations: u8,
  persuasion: u8,
  intrigue: u8,
  tech: u8,
  hustle: u8,
  traits: semiList,
  ideology: str,
  cash_usd: f64,
  net_worth_est_usd: f64,
  hook: str,
  notes: str,
});

/** industries.csv: the 42 industries and their tuning values (spec 5, 10.3). */
export interface Industry {
  id: string;
  name: string;
  sector: string;
  valuation_group: string;
  world_size_2020_usd_bn: number;
  trend_growth: number;
  mature_rate: number;
  fade_half_life_years: number;
  cycle_beta: number;
  volatility: number;
  boom_uplift: number;
  crash_drop: number;
  rate_sensitivity: number;
  margin_full_use: number;
  fixed_cost_share: number;
  variable_cost_share: number;
  capital_per_dollar: number;
  asset_turnover: number;
  asset_decay: number;
  asset_decay_threshold_usd: number;
  rd_norm: number;
  labor_value_usd: number;
  pc_modifier: number;
  data_tb_per_musd: number;
  data_decay_base: number;
  fit: string;
  resource_tags: string;
  asset_label: string;
  cash_burning: boolean;
  earnings_multiple: number;
  notes: string;
}

export const INDUSTRY_SPEC = rowSpec<Industry>({
  id: str,
  name: str,
  sector: str,
  valuation_group: str,
  world_size_2020_usd_bn: f64,
  trend_growth: f64,
  mature_rate: f64,
  fade_half_life_years: f64,
  cycle_beta: f64,
  volatility: f64,
  boom_uplift: f64,
  crash_drop: f64,
  rate_sensitivity: f64,
  margin_full_use: f64,
  fixed_cost_share: f64,
  variable_cost_share: f64,
  capital_per_dollar: f64,
  asset_turnover: f64,
  asset_decay: f64,
  asset_decay_threshold_usd: f64,
  rd_norm: f64,
  labor_value_usd: f64,
  pc_modifier: f64,
  data_tb_per_musd: f64,
  data_decay_base: f64,
  fit: str,
  resource_tags: str,
  asset_label: str,
  cash_burning: yesNo,
  earnings_multiple: f64,
  notes: str,
});

/** country-economy.csv: tax, sovereign rating and financial zone per country (spec 5.1.2, 5.11). */
export interface CountryEconomy {
  iso3: string;
  corp_tax_level: string;
  corp_tax_rate: number;
  sovereign_rating: string;
  sovereign_spread_bps: number;
  financial_zone: string;
  notes: string;
}

export const COUNTRY_ECONOMY_SPEC = rowSpec<CountryEconomy>({
  iso3: str,
  corp_tax_level: str,
  corp_tax_rate: f64,
  sovereign_rating: str,
  sovereign_spread_bps: f64,
  financial_zone: str,
  notes: str,
});

/** financial-zones.csv: the 26 zones, each with one exchange (spec 5.1.2, batches 152 to 155). */
export interface FinancialZone {
  zone_id: string;
  number: number;
  name: string;
  hub_city: string;
  hub_province: string;
  exchange_code: string;
  exchange: string;
  headline_index: string;
  intensity: number;
  lag_quarters: number;
  contagion: number;
  own_shock_sd: number;
  extra_provinces: string[];
  countries: number;
  gdp_usd_bn: number;
  gdp_share: number;
  credit_spread_bps: number;
  confidence_start: number;
  notes: string;
}

export const FINANCIAL_ZONE_SPEC = rowSpec<FinancialZone>({
  zone_id: str,
  number: u32,
  name: str,
  hub_city: str,
  hub_province: str,
  exchange_code: str,
  exchange: str,
  headline_index: str,
  intensity: f64,
  lag_quarters: u32,
  contagion: f64,
  own_shock_sd: f64,
  extra_provinces: semiList,
  countries: u32,
  gdp_usd_bn: f64,
  gdp_share: f64,
  credit_spread_bps: f64,
  confidence_start: f64,
  notes: str,
});

/** ai-boom.csv: the scripted AI boom and pop schedule (spec 5.1.1). */
export interface AiBoomStage {
  stage: string;
  /** Rust `Option<u32>`. */
  boom_year: number | null;
  default_year: string;
  /** Rust `Option<f64>`. */
  ai_labs_lt: number | null;
  notes: string;
}

export const AI_BOOM_STAGE_SPEC = rowSpec<AiBoomStage>({
  stage: str,
  boom_year: optU32,
  default_year: str,
  ai_labs_lt: optF64,
  notes: str,
});

/** key-cities.csv: the 88 key cities. */
export interface KeyCity {
  id: string;
  city: string;
  country: string;
  province_ids: string[];
  specialties: string[];
  specialties_text: string;
  signature_assets: string;
  has_perk: boolean;
  perk_achieve: string;
  perk_get: string;
  notes: string;
}

export const KEY_CITY_SPEC = rowSpec<KeyCity>({
  id: str,
  city: str,
  country: str,
  province_ids: semiList,
  specialties: semiList,
  specialties_text: str,
  signature_assets: str,
  has_perk: yesNo,
  perk_achieve: str,
  perk_get: str,
  notes: str,
});

/** company-start.csv: each company's starting balance sheet, shares and opening price (spec 7.1, G6). */
export interface CompanyStart {
  id: string;
  ticker: string;
  public: boolean;
  gross_assets_usd: number;
  asset_book_usd: number;
  cash_usd: number;
  credit_drawn_usd: number;
  /**
   * The 7.1 starting rating (5.12 implied rating at load; D220 to D223, D235) of these
   * balances, as an agency label ("BBB-"). gen.py sizes the line to its 5.12 limit at this
   * rating (D15, D16); sim's `finance::rating::starting_rating` must agree with it.
   */
  start_rating: string;
  book_equity_usd: number;
  engine_value_usd: number;
  open_price: number;
  shares: number;
}

export const COMPANY_START_SPEC = rowSpec<CompanyStart>({
  id: str,
  ticker: str,
  public: yesNo,
  gross_assets_usd: f64,
  asset_book_usd: f64,
  cash_usd: f64,
  credit_drawn_usd: f64,
  start_rating: str,
  book_equity_usd: f64,
  engine_value_usd: f64,
  open_price: f64,
  shares: f64,
});

/** When a fixed startup event fires (spec 5.19.2). */
export type EventTrigger =
  /** The first plan lock on or after `date`. */
  | "Date"
  /** The first plan lock after the bust ends (the pop + 8 quarters, spec 5.1.1). */
  | "AfterBust";

/** EventTrigger in declaration order. */
export const EVENT_TRIGGER_VALUES = ["Date", "AfterBust"] as const;

/** The CSV's serde names (`snake_case`) for each EventTrigger, in declaration order. */
export const EVENT_TRIGGER_SERDE: Readonly<Record<string, EventTrigger>> = {
  date: "Date",
  after_bust: "AfterBust",
};

/** One group of startups in a fixed event: `count:industry@region|region`. */
export interface StartupGroup {
  count: number;
  industry: string;
  /** Allowed HQ regions: `any`, a superregion slug (as in the province file names) or an iso3. */
  regions: string[];
}

/** Parses `count:industry@region|region` (rows.rs `StartupGroup::parse`). */
export function startupGroupParse(s: string): Result<StartupGroup, string> {
  const bad = (): Result<StartupGroup, string> => err(`\`${s}\` is not count:industry@region`);
  const colon = s.indexOf(":");
  if (colon < 0) return bad();
  const countText = s.slice(0, colon);
  const rest = s.slice(colon + 1);
  const at = rest.indexOf("@");
  if (at < 0) return bad();
  const industry = rest.slice(0, at);
  const regionText = rest.slice(at + 1);
  const count = u32(countText.trim());
  if (!count.ok) return bad();
  const regions = regionText.split("|");
  if (industry === "" || regions.some((r) => r === "")) return bad();
  return ok({ count: count.value, industry, regions });
}

const startupGroups: Parse<StartupGroup[]> = (s) => {
  const groups: StartupGroup[] = [];
  for (const part of s.split(";")) {
    if (part === "") continue;
    const g = startupGroupParse(part);
    if (!g.ok) return g;
    groups.push(g.value);
  }
  return ok(groups);
};

/** startup-events.csv: the fixed startup events F1 to F9 (spec 5.19.2, M0.5). */
export interface StartupEvent {
  id: string;
  name: string;
  trigger: EventTrigger;
  /** ISO date `YYYY-MM-DD` for `date` events, empty for `after_bust`. */
  date: string;
  startups: StartupGroup[];
  revenue_min_usd_m: number;
  revenue_max_usd_m: number;
  full_min: number;
  full_max: number;
  partial_min: number;
  partial_max: number;
  notes: string;
}

export const STARTUP_EVENT_SPEC = rowSpec<StartupEvent>({
  id: str,
  name: str,
  trigger: enumOf(EVENT_TRIGGER_SERDE),
  date: str,
  startups: startupGroups,
  revenue_min_usd_m: f64,
  revenue_max_usd_m: f64,
  full_min: u8,
  full_max: u8,
  partial_min: u8,
  partial_max: u8,
  notes: str,
});

/** What a name in a names file is for (spec 3.7.1, 5.19.3). */
export type NameKind =
  | "Male"
  | "Female"
  | "Surname"
  /** A company name prefix (place-like or evocative word). */
  | "CompanyPrefix";

/** NameKind in declaration order. */
export const NAME_KIND_VALUES = ["Male", "Female", "Surname", "CompanyPrefix"] as const;

/** The CSV's serde names (`snake_case`) for each NameKind, in declaration order. */
export const NAME_KIND_SERDE: Readonly<Record<string, NameKind>> = {
  male: "Male",
  female: "Female",
  surname: "Surname",
  company_prefix: "CompanyPrefix",
};

/** Rust's `{:?}` of a NameKind, for check messages: the variant name. */
export function nameKindDebug(k: NameKind): string {
  return k;
}

/** names/<superregion>.csv: name parts per culture used in that superregion (M0.6). */
export interface NameRow {
  culture: string;
  /** The culture writes the family name first. */
  family_first: boolean;
  kind: NameKind;
  name: string;
}

export const NAME_ROW_SPEC = rowSpec<NameRow>({
  culture: str,
  family_first: yesNo,
  kind: enumOf(NAME_KIND_SERDE),
  name: str,
});

/** names/country-cultures.csv: which culture's names each country uses. */
export interface CountryCulture {
  iso3: string;
  culture: string;
}

export const COUNTRY_CULTURE_SPEC = rowSpec<CountryCulture>({ iso3: str, culture: str });

/** names/industry-suffixes.csv: company name suffixes per industry. */
export interface IndustrySuffix {
  industry: string;
  suffix: string;
}

export const INDUSTRY_SUFFIX_SPEC = rowSpec<IndustrySuffix>({ industry: str, suffix: str });

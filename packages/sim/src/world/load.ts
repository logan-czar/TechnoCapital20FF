// Builds the World tables from the loaded CSV rows (spec 7, build-plan 2.3). This is the one place
// CSV units become sim units (types/world.ts `usdFromMillions` and friends). Rows are sorted by
// their CSV id so ordinals are in id order (D4); references between tables become ordinal ids.
// Ported from crates/sim/src/world/load.rs.
//
// STEP 2: build_world calls into modules that are ported in Step 2 (ai/archetype, births/state,
// economy/{ai_boom,cycle,start,supply}, finance/{rating,state}, market/state, ops/{compute,data,
// labor,stations}, people/{names,traits}). Those calls go through `LoadDeps` below, one member per
// Rust function or constant, named after it. Step 2 ports each module and then replaces the default
// (`UNPORTED_LOAD_DEPS`, which throws) with the real functions, so `buildWorld(data)` works with no
// second argument. Everything that is pure data conversion lives here.
//
// Not ported here: lib.rs `start_world` (it calls the Step 2 start jobs).

import type { Company as CompanyRow, Industry as IndustryRow, WorldData } from "@tc20ff/sim-data";
import { worldDataAllProvinces } from "@tc20ff/sim-data";
import { boomDate, POP_BASE_YEAR } from "../economy/ai_boom.ts";
import { START_PHASE, zAvg } from "../economy/cycle.ts";
import {
  enterpriseShare,
  fixedCostRateAtLoad,
  sharedCostsAtLoadHook,
  startLoadout,
} from "../economy/start.ts";
import { fringeAssetsAtLoad } from "../economy/supply.ts";
import { computeBill } from "../ops/compute.ts";
import { conversionCapacity, dataBookAtLoad, dataBookFreeRdFraction, dataBookStoredTb } from "../ops/data.ts";
import { fitStations, laborUnits } from "../ops/labor.ts";
import { productiveCompute, START_PRODUCTIVITY } from "../ops/stations.ts";
import { DATETIME_START, type SimDate } from "../types/calendar.ts";
import { tableFromRows } from "../types/collections.ts";
import type {
  CharacterId,
  CompanyId,
  CountryId,
  IndustryId,
  ProvinceId,
  UnitId,
  ZoneId,
} from "../types/ids.ts";
import { type Ordinal, ordinal } from "../types/ids.ts";
import { cmpStr } from "../types/num.ts";
import type { Archetype } from "../types/state/ai.ts";
import type { BirthsState } from "../types/state/births.ts";
import type { BooksCheck, CompanyFinance, Rating } from "../types/state/finance.ts";
import type { MarketState, Stock } from "../types/state/market.ts";
import type { NewsWire } from "../types/state/news.ts";
import type { ComputeBill, DataBook, Stations } from "../types/state/ops.ts";
import { LABOR_SEAT_COUNT, type NameBooks, type Skills, type Trait } from "../types/state/people.ts";
import {
  type AiSchedule,
  type BusinessUnit,
  type Character,
  type Company,
  type ControllerRef,
  type Country,
  type CyclePhase,
  fractionFromBps,
  type Industry,
  type IndustryParams,
  type LoadError,
  type Province,
  type Result,
  type StartControl,
  sharesFromCsv,
  usdFromBillions,
  usdFromMillions,
  type World,
  type Zone,
} from "../types/world.ts";

// ---------------------------------------------------------------- Step 2 dependencies

/** The 7.1 loadout (economy/start.rs `start_loadout`): the stations and the PC bonus step. */
export interface Loadout {
  stations: Stations;
  /** Rust `Loadout::load_bonus()`. */
  load_bonus: number;
}

/**
 * What world/load.rs takes from the modules Step 2 ports. Each member is one Rust item (its path
 * in the comment); constants are plain values.
 */
export interface LoadDeps {
  /** ai/archetype.rs `STATE_CONTROL_BASIS`. */
  STATE_CONTROL_BASIS: string;
  /** ai/archetype.rs `Archetype::at_load(basis, revenue, sector, controller_traits)`. */
  archetypeAtLoad(
    basis: string,
    revenue: number,
    sector: string,
    controllerTraits: readonly Trait[],
  ): Archetype;
  /** ai/archetype.rs `rd_plan_at_load(rd_norm, archetype, controller_traits, free_rd_fraction)`. */
  rdPlanAtLoad(
    rdNorm: number,
    archetype: Archetype,
    controllerTraits: readonly Trait[],
    freeRdFraction: number,
  ): number;
  /** births/state.rs `BirthsState::from_data`; the error is the message (`e.0`). */
  birthsStateFromData(
    data: WorldData,
    provinceKeys: readonly string[],
    countryKeys: readonly string[],
    industryNames: readonly string[],
  ): Result<BirthsState, string>;
  /** economy/ai_boom.rs `POP_BASE_YEAR`. */
  POP_BASE_YEAR: number;
  /** economy/ai_boom.rs `boom_date()`. */
  boomDate(): SimDate;
  /** economy/cycle.rs `START_PHASE`. */
  START_PHASE: CyclePhase;
  /** economy/cycle.rs `z_avg(countries)`, from `(gdp, intensity)` per country in id order. */
  zAvg(countries: readonly (readonly [number, number])[]): number;
  /** economy/start.rs `START_PRODUCTIVITY` (ops/stations.rs). */
  START_PRODUCTIVITY: number;
  /** economy/start.rs `enterprise_share(company_key)`. */
  enterpriseShare(companyKey: string): number;
  /** economy/start.rs `fixed_cost_rate_at_load(gross, shared_costs, params)`. */
  fixedCostRateAtLoad(gross: number, sharedCosts: number, params: IndustryParams): number;
  /** economy/start.rs `shared_costs_at_load_hook(compute)`. */
  sharedCostsAtLoadHook(compute: ComputeBill): number;
  /** economy/start.rs `start_loadout(company_key, revenue, location_bonus, params)`. */
  startLoadout(companyKey: string, revenue: number, locationBonus: number, params: IndustryParams): Loadout;
  /** economy/supply.rs `fringe_assets_at_load(world_size, named_revenue, asset_turnover)`. */
  fringeAssetsAtLoad(worldSize: number, namedRevenue: number, assetTurnover: number): number;
  /** finance/rating.rs `Rating::parse(label)`: null off the AAA to CC scale. */
  ratingParse(label: string): Rating | null;
  /** finance/state.rs `CompanyFinance::at_load(credit_drawn, rating)`. */
  companyFinanceAtLoad(creditDrawn: number, rating: Rating): CompanyFinance;
  /** market/state.rs `Stock::at_load(exchange, open_price, shares_out)`. */
  stockAtLoad(exchange: ZoneId | null, openPrice: number, sharesOut: number): Stock;
  /** ops/compute.rs `compute_bill(stations, stored_tb)`. */
  computeBill(stations: Stations, storedTb: number): ComputeBill;
  /** ops/data.rs `DataBook::at_load(revenue, params, conversion_capacity, enterprise_share)`. */
  dataBookAtLoad(
    revenue: number,
    params: { tb_per_musd: number; decay_base: number },
    conversionCapacity: number,
    enterpriseShare: number,
  ): DataBook;
  /** ops/data.rs `DataBook::stored_tb()`. */
  dataBookStoredTb(book: DataBook): number;
  /** ops/data.rs `DataBook::free_rd_fraction()`. */
  dataBookFreeRdFraction(book: DataBook): number;
  /** ops/data.rs `conversion_capacity(stations)`. */
  conversionCapacity(stations: Stations): number;
  /** ops/labor.rs `fit_stations(stations, labor_units)`. */
  fitStations(stations: Stations, labor: number): Stations;
  /** ops/labor.rs `labor_units(gross_assets, labor_value_usd)`; a whole number (u64). */
  laborUnits(grossAssets: number, laborValueUsd: number): number;
  /** ops/stations.rs `productive_compute(stations, pc_modifier)`. */
  productiveCompute(stations: Stations, pcModifier: number): number;
  /** people/names.rs `NameBooks::build(data, country_keys)`; the error is the country key. */
  nameBooksBuild(data: WorldData, countryKeys: readonly string[]): Result<NameBooks, string>;
  /** people/traits.rs `Trait::from_name(name)`: null for a trait outside the 12 pairs (D113). */
  traitFromName(name: string): Trait | null;
  /** news.rs `NewsWire::default()`. */
  newsWireDefault(): NewsWire;
}

function unported(item: string): never {
  throw new Error(`world/load: ${item} is not ported yet (Step 2); pass a LoadDeps to buildWorld`);
}

/** The default `LoadDeps` until Step 2 ports the modules: every member throws when called. */
export const UNPORTED_LOAD_DEPS: LoadDeps = {
  STATE_CONTROL_BASIS: "state", // ai/archetype.rs
  archetypeAtLoad: () => unported("ai/archetype Archetype::at_load"),
  rdPlanAtLoad: () => unported("ai/archetype rd_plan_at_load"),
  birthsStateFromData: () => unported("births/state BirthsState::from_data"),
  POP_BASE_YEAR, // economy/ai_boom.rs
  boomDate, // economy/ai_boom.rs
  START_PHASE, // economy/cycle.rs
  zAvg, // economy/cycle.rs z_avg
  START_PRODUCTIVITY, // ops/stations.rs
  enterpriseShare, // economy/start.rs
  fixedCostRateAtLoad, // economy/start.rs
  sharedCostsAtLoadHook, // economy/start.rs
  startLoadout, // economy/start.rs
  fringeAssetsAtLoad, // economy/supply.rs
  ratingParse: () => unported("finance/rating Rating::parse"),
  companyFinanceAtLoad: () => unported("finance/state CompanyFinance::at_load"),
  stockAtLoad: () => unported("market/state Stock::at_load"),
  computeBill, // ops/compute.rs
  dataBookAtLoad, // ops/data.rs DataBook::at_load
  dataBookStoredTb, // ops/data.rs DataBook::stored_tb
  dataBookFreeRdFraction, // ops/data.rs DataBook::free_rd_fraction
  conversionCapacity, // ops/data.rs
  fitStations, // ops/labor.rs
  laborUnits, // ops/labor.rs
  productiveCompute, // ops/stations.rs
  nameBooksBuild: () => unported("people/names NameBooks::build"),
  traitFromName: () => unported("people/traits Trait::from_name"),
  newsWireDefault,
};

// ---------------------------------------------------------------- errors

/** Rust `Display for LoadError` (thiserror messages). */
export function loadErrorToString(e: LoadError): string {
  switch (e.kind) {
    case "Duplicate":
      return `${e.table}: id \`${e.key}\` appears twice`;
    case "MissingRef":
      return `${e.table} \`${e.key}\`: ${e.field} \`${e.value}\` is not a known ${e.target}`;
    case "BadValue":
      return `${e.table} \`${e.key}\`: ${e.message}`;
  }
}

/** Carries a LoadError through the loaders (Rust `?`); `buildWorld` turns it back into a Result. */
class LoadFailure extends Error {
  readonly loadError: LoadError;
  constructor(loadError: LoadError) {
    super(loadErrorToString(loadError));
    this.loadError = loadError;
  }
}

function badValue(table: string, key: string, message: string): LoadFailure {
  return new LoadFailure({ kind: "BadValue", table, key, message });
}

/** Id lookup used only while loading (never iterated). */
class Keys<I extends Ordinal<string>> {
  readonly map = new Map<string, I>();

  constructor(table: string, keys: Iterable<string>) {
    let i = 0;
    for (const k of keys) {
      if (this.map.has(k)) throw new LoadFailure({ kind: "Duplicate", table, key: k });
      this.map.set(k, ordinal<I>(i));
      i++;
    }
  }

  get(table: string, key: string, field: string, value: string, target: string): I {
    const id = this.map.get(value);
    if (id === undefined) {
      throw new LoadFailure({ kind: "MissingRef", table, key, field, value, target });
    }
    return id;
  }
}

/** Percent to a fraction (companies.csv `controller_stake_pct`). */
const PERCENT = 100.0;

/**
 * A starting company companies.csv control (spec 3.5, 8; D425): the controller (a CH- character, a
 * CO- company, an iso3 state or none), its stake, the control basis and a character owner of record.
 */
function startControl(
  c: CompanyRow,
  characters: Keys<CharacterId>,
  countries: Keys<CountryId>,
  companies: Keys<CompanyId>,
): StartControl {
  const field = "controller";
  const v = c.controller;
  let controller: ControllerRef;
  if (v === "") {
    controller = { kind: "None" };
  } else if (v.startsWith("CH-")) {
    controller = { kind: "Character", character: characters.get("companies", c.id, field, v, "character") };
  } else if (v.startsWith("CO-")) {
    controller = { kind: "Company", company: companies.get("companies", c.id, field, v, "company") };
  } else {
    controller = { kind: "State", country: countries.get("companies", c.id, field, v, "country") };
  }
  const owner = c.owner_of_record;
  const ownerOfRecord =
    owner === "" ? null : characters.get("companies", c.id, "owner_of_record", owner, "character");
  return {
    controller,
    stake: c.controller_stake_pct === null ? null : c.controller_stake_pct / PERCENT,
    basis: c.control_basis,
    owner_of_record: ownerOfRecord,
  };
}

/** Rows sorted by their id (D4); the sort is stable. */
function sortedBy<T>(rows: readonly T[], key: (r: T) => string): T[] {
  return [...rows].sort((a, b) => cmpStr(key(a), key(b)));
}

/** World base rate, fixed in the MVP (spec 3.1, T). */
export const BASE_RATE = 0.03;
/** Neutral rate (spec 3.1, T). */
export const NEUTRAL_RATE = 0.03;

/**
 * The start state tables (spec 7) with the clock at 2020-01-01 00:00 (spec 3.1, 7.3). Rust
 * `build_world`; `deps` stands for the Step 2 modules it calls (see the file header).
 */
export function buildWorld(data: WorldData, deps: LoadDeps = UNPORTED_LOAD_DEPS): Result<World, LoadError> {
  try {
    return { ok: true, value: buildWorldInner(data, deps) };
  } catch (e) {
    if (e instanceof LoadFailure) return { ok: false, error: e.loadError };
    throw e;
  }
}

function buildWorldInner(data: WorldData, deps: LoadDeps): World {
  // Zones (spec 3.2.1).
  const zoneRows = sortedBy(data.financial_zones.rows, (z) => z.zone_id);
  const zoneKeys = new Keys<ZoneId>(
    "financial-zones",
    zoneRows.map((z) => z.zone_id),
  );
  const zones: Zone[] = zoneRows.map((z) => ({
    key: z.zone_id,
    number: z.number,
    name: z.name,
    exchange_code: z.exchange_code,
    exchange_name: z.exchange,
    headline_index: z.headline_index,
    hub_city: z.hub_city,
    // Set once the provinces are loaded, below.
    hub_province: ordinal<ProvinceId>(0),
    intensity: z.intensity,
    lag_quarters: z.lag_quarters,
    contagion: z.contagion,
    own_shock_sd: z.own_shock_sd,
    gdp_usd: 0.0,
    gdp_share: 0.0,
    credit_spread_base: fractionFromBps(z.credit_spread_bps),
    credit_spread: fractionFromBps(z.credit_spread_bps),
    own_shock: 0.0,
    effect: 0.0,
    confidence_start: z.confidence_start,
    confidence: z.confidence_start,
  }));

  // Countries (spec 3.2), joined with country-economy.csv.
  const economy = new Map(data.country_economy.rows.map((e) => [e.iso3, e] as const));
  const countryRows = sortedBy(data.countries.rows, (c) => c.iso3);
  const countryKeys = new Keys<CountryId>(
    "countries",
    countryRows.map((c) => c.iso3),
  );
  const countries: Country[] = [];
  for (const c of countryRows) {
    const econ = economy.get(c.iso3);
    if (econ === undefined) throw badValue("countries", c.iso3, "no country-economy.csv row");
    const rating = deps.ratingParse(econ.sovereign_rating);
    const zone = zoneKeys.get("country-economy", c.iso3, "financial_zone", econ.financial_zone, "zone");
    if (rating === null) {
      throw badValue(
        "country-economy",
        c.iso3,
        `sovereign_rating \`${econ.sovereign_rating}\` is not on the AAA to CC scale`,
      );
    }
    countries.push({
      key: c.iso3,
      name: c.name,
      superregion: c.superregion,
      zone,
      gdp_usd: usdFromBillions(c.gdp_usd_bn),
      sovereign_spread: fractionFromBps(econ.sovereign_spread_bps),
      corp_tax_rate: econ.corp_tax_rate,
      sovereign_rating: rating,
    });
  }

  // Zone GDP aggregates and Z (spec 3.2.1, 5.1), summed over the members in id order.
  for (const c of countries) {
    (zones[c.zone] as Zone).gdp_usd += c.gdp_usd;
  }
  let worldGdp = 0.0;
  for (const c of countries) worldGdp += c.gdp_usd;
  for (const z of zones) {
    z.gdp_share = worldGdp > 0.0 ? z.gdp_usd / worldGdp : 0.0;
  }
  const zAvg = deps.zAvg(countries.map((c) => [c.gdp_usd, (zones[c.zone] as Zone).intensity] as const));
  const maxLag = zones.reduce((m, z) => Math.max(m, z.lag_quarters), 0);

  // Provinces (spec 3.3), all 8 files.
  const provinceRows = sortedBy(
    worldDataAllProvinces(data).map(([, , p]) => p),
    (p) => p.id,
  );
  const provinceKeys = new Keys<ProvinceId>(
    "provinces",
    provinceRows.map((p) => p.id),
  );
  const provinces: Province[] = provinceRows.map((p) => ({
    key: p.id,
    name: p.name,
    country: countryKeys.get("provinces", p.id, "country", p.country, "country"),
  }));

  // Each exchange hub province (financial-zones.csv `hub_province`).
  zones.forEach((z, i) => {
    const row = zoneRows[i] as (typeof zoneRows)[number];
    z.hub_province = provinceKeys.get(
      "financial-zones",
      row.zone_id,
      "hub_province",
      row.hub_province,
      "province",
    );
  });

  // Industries (spec 3.4). companies.csv names its industry by name, not slug.
  const industryRows = sortedBy(data.industries.rows, (i) => i.id);
  new Keys<IndustryId>(
    "industries",
    industryRows.map((i) => i.id),
  );
  const industryByName = new Keys<IndustryId>(
    "industries",
    industryRows.map((i) => i.name),
  );
  const industries: Industry[] = industryRows.map((i) => {
    const worldSize = usdFromBillions(i.world_size_2020_usd_bn);
    return {
      key: i.id,
      name: i.name,
      sector: i.sector,
      asset_label: i.asset_label,
      world_size_2020_usd: worldSize,
      params: industryParams(i),
      lt: i.trend_growth,
      prev_lt: i.trend_growth,
      // Demand starts at the 2020 world size (spec 7.3).
      trend_demand: worldSize,
      demand_core: worldSize,
      demand: worldSize,
      q_growth: 0.0,
      prev_q_growth: 0.0,
      carry_reset: false,
      phase_label: "Normal",
      fringe_assets: 0.0,
      supply: 0.0,
      supply_ratio: 1.0,
      market_factor: 1.0,
      fringe_revenue_m: 0.0,
      history: [],
    };
  });

  // Full characters (spec 3.7.2): all 296 (decision D11), with the skills, traits, age, cash and
  // home province the MVP reads. Traits outside the 12 pairs are dropped (D113).
  const characterRows = sortedBy(data.characters.rows, (c) => c.id);
  const characterKeys = new Keys<CharacterId>(
    "characters",
    characterRows.map((c) => c.id),
  );
  const characters: Character[] = [];
  for (const c of characterRows) {
    const skills: Skills = {
      finance: c.finance,
      operations: c.operations,
      persuasion: c.persuasion,
      intrigue: c.intrigue,
      tech: c.tech,
      hustle: c.hustle,
    };
    const traits: Trait[] = [];
    for (const name of c.traits) {
      const t = deps.traitFromName(name.trim());
      if (t !== null) traits.push(t);
    }
    characters.push({
      key: c.id,
      name: c.name,
      tier: c.tier,
      age: c.age,
      skills,
      traits,
      home_province: provinceKeys.get("characters", c.id, "origin_province", c.origin_province, "province"),
      cash_usd: c.cash_usd,
    });
  }

  // Name books per country, in country id order (spec 3.7.1; D203), built once here.
  const nameBooks = deps.nameBooksBuild(
    data,
    countryRows.map((c) => c.iso3),
  );
  if (!nameBooks.ok) {
    throw badValue("names", nameBooks.error, "no name list for the country's culture");
  }

  // Companies (spec 3.5), joined with company-start.csv.
  const starts = new Map(data.company_start.rows.map((s) => [s.id, s] as const));
  const companyRows = sortedBy(data.companies.rows, (c) => c.id);
  const companyKeys = new Keys<CompanyId>(
    "companies",
    companyRows.map((c) => c.id),
  );
  const companies: Company[] = [];
  const stocks: Stock[] = [];
  const units: BusinessUnit[] = [];
  const namedRevenue: number[] = industries.map(() => 0.0);
  for (const c of companyRows) {
    const bad = (message: string): LoadFailure => badValue("companies", c.id, message);
    const start = starts.get(c.id);
    if (start === undefined) throw bad("no company-start.csv row");
    const industry = industryByName.get("companies", c.id, "industry", c.industry, "industry");
    const hqProvince = provinceKeys.get("companies", c.id, "hq_province", c.hq_province, "province");
    const revenue = usdFromMillions(c.revenue_usd_m);
    namedRevenue[industry] = (namedRevenue[industry] as number) + revenue;
    const params = (industries[industry] as Industry).params;
    // The unit (spec 3.6, 7.1): gross assets and book from company-start.csv, productivity 100,
    // no ramping, location bonus 0 (the MVP defaults have no fit or resource tags, 5.4).
    const locationBonus = 0.0;
    const gross = start.gross_assets_usd;
    // The 7.1 loadout (lane F's one implementation): labor units from the loaded gross assets, the
    // loadout's stations fitted to them (a no-op on today's data, D208), the starting data (5.9)
    // and the compute bill (3.8) that the fixed cost rate leaves room for.
    const loadout = deps.startLoadout(c.id, revenue, locationBonus, params);
    const labor = deps.laborUnits(gross, params.labor_value_usd);
    const stations = deps.fitStations(loadout.stations, labor);
    const book = deps.dataBookAtLoad(
      revenue,
      { tb_per_musd: params.data_tb_per_musd, decay_base: params.data_decay_base },
      deps.conversionCapacity(stations),
      deps.enterpriseShare(c.id),
    );
    const compute = deps.computeBill(stations, deps.dataBookStoredTb(book));
    const controller = characterKeys.map.get(c.controller) ?? null;
    const controllerTraits: readonly Trait[] =
      controller === null ? [] : (characters[controller] as Character).traits;
    const archetype = deps.archetypeAtLoad(
      c.control_basis,
      revenue,
      (industries[industry] as Industry).sector,
      controllerTraits,
    );
    // The plan at load (D283, D161): R&D by the 6.3 rule at productivity 100 and loss_q 0, less the
    // starting free R&D; growth is g_dem of the Q1 2020 draw, set once the economy load draws are
    // made (`ai::jobs::plan_at_load`).
    const rdPlan = deps.rdPlanAtLoad(
      params.rd_norm,
      archetype,
      controllerTraits,
      deps.dataBookFreeRdFraction(book),
    );
    const unitId = ordinal<UnitId>(units.length);
    units.push({
      company: ordinal<CompanyId>(companies.length),
      industry,
      base_province: hqProvince,
      gross_assets: gross,
      ramping: [],
      asset_book: start.asset_book_usd,
      productivity: deps.START_PRODUCTIVITY,
      location_bonus: locationBonus,
      fixed_cost_rate: deps.fixedCostRateAtLoad(gross, deps.sharedCostsAtLoadHook(compute), params),
      growth_plan: 0.0,
      rd_plan: rdPlan,
      revenue_m: 0.0,
      variable_m: 0.0,
      fixed_m: 0.0,
      rd_m: 0.0,
      dep_m: 0.0,
      shared_m: 0.0,
      capex_m: 0.0,
      sale_proceeds_m: 0.0,
      sale_gain_m: 0.0,
    });
    const hqCountry = countryKeys.get("companies", c.id, "hq_country", c.hq_country, "country");
    // A listed company lists on its HQ country zone exchange at company-start.csv open_price
    // (spec 5.14, 7.1; D145); `market::start` sets its value.
    const exchange = c.public ? (countries[hqCountry] as Country).zone : null;
    const shares = sharesFromCsv(start.shares);
    if (!shares.ok) throw bad(shares.error);
    const sharesOut = shares.value;
    stocks.push(deps.stockAtLoad(exchange, c.public ? start.open_price : 0.0, sharesOut));
    const rating = deps.ratingParse(start.start_rating);
    if (rating === null) {
      throw bad(`start_rating \`${start.start_rating}\` is not on the AAA to CC scale`);
    }
    companies.push({
      key: c.id,
      name: c.name,
      ticker: c.ticker,
      industry,
      hq_country: hqCountry,
      hq_province: hqProvince,
      public: c.public,
      revenue_usd: revenue,
      shares_out: sharesOut,
      units: [unitId],
      controller,
      labor_units: labor,
      stations,
      pc: deps.productiveCompute(stations, params.pc_modifier),
      pc_bonus: loadout.load_bonus,
      compute,
      data: [{ industry, book }],
      // Seated by `people::seating::start`, which draws (spec 3.7.1, 7.1).
      board: boardDefault(),
      seats_to_fill: [],
      management_score: 0.0,
      archetype,
      // Cash, line and starting rating as company-start.csv has them (spec 7.1, D241); the limit
      // and history are set by `finance::start` once the load month exists.
      cash_usd: start.cash_usd,
      finance: deps.companyFinanceAtLoad(start.credit_drawn_usd, rating),
      state_controlled: c.control_basis === deps.STATE_CONTROL_BASIS,
      origin: { kind: "Start" },
      founders: [],
      directors: [],
      holders: [{ holder: { kind: "Existing" }, shares: sharesOut }],
      loss_quarters: 0,
      plan: null,
      failed_raises: 0,
      raise_pending: false,
      // Drawn at load after the boards for the private ones (5.20.1 step 1, D276).
      ipo_next_vote: null,
      ipo_last_vote: null,
      birth_run_rate: null,
      start_control: startControl(c, characterKeys, countryKeys, companyKeys),
    });
  }
  // Fringe pools (spec 5.3, 7.2): what named revenue leaves of the 2020 world size.
  industries.forEach((ind, id) => {
    ind.fringe_assets = deps.fringeAssetsAtLoad(
      ind.world_size_2020_usd,
      namedRevenue[id] as number,
      ind.params.asset_turnover,
    );
  });

  const schedule = aiSchedule(data);
  const births = deps.birthsStateFromData(
    data,
    provinceRows.map((p) => p.id),
    countryRows.map((c) => c.iso3),
    industryRows.map((i) => i.name),
  );
  if (!births.ok) throw badValue("startup-events", "", births.error);
  return {
    clock: DATETIME_START,
    zones: tableFromRows(zones),
    countries: tableFromRows(countries),
    provinces: tableFromRows(provinces),
    industries: tableFromRows(industries),
    companies: tableFromRows(companies),
    characters: tableFromRows(characters),
    units: tableFromRows(units),
    base_rate: BASE_RATE,
    neutral_rate: NEUTRAL_RATE,
    // `economy::start` makes the cycle's draws (spec 7.3); until then g is 0.
    cycle: {
      phase: deps.START_PHASE,
      quarters_left: 0,
      g_t: 0.0,
      g_history: new Array<number>(maxLag + 1).fill(0.0),
      z_avg: zAvg,
    },
    ai: {
      stage: "Preboom",
      boom_date: deps.boomDate(),
      // Rolled by `economy::start` (spec 5.1.1).
      pop_date: { year: deps.POP_BASE_YEAR, month: 1, day: 1 },
      ai_labs_lt: schedule.preboom_lt,
      schedule,
    },
    name_books: nameBooks.value,
    simple_characters_made: 0,
    books_check: booksCheckDefault(),
    market: marketStateAtLoad(stocks),
    births: births.value,
    news: deps.newsWireDefault(),
    recaps: [],
  };
}

/** The `MarketState` at load: stocks only; `market::start` sets the indices (spec 5.14). */
function marketStateAtLoad(stocks: Stock[]): MarketState {
  return {
    stocks: tableFromRows(stocks),
    // Set by `market::start` at the listed caps (spec 5.14).
    indices: tableFromRows([]),
    index_history: tableFromRows([]),
  };
}

/** Rust `Board::default()` of the Company: the five labor seats, all closed. */
function boardDefault(): null[] {
  return new Array<null>(LABOR_SEAT_COUNT).fill(null);
}

/** Rust `BooksCheck::default()`. */
function booksCheckDefault(): BooksCheck {
  return { checked: 0, failures: 0, first_failure: null };
}

/** Rust `NewsWire::default()`: empty queue, feed, today and labels. */
function newsWireDefault(): NewsWire {
  // W3: replace with W3's chunkLogNew once world/log.ts lands.
  const emptyBuf = <T>() => ({ slots: [] as T[], len: 0 });
  return {
    queued: [],
    feed: { closed: emptyBuf(), open: emptyBuf() },
    today: [],
    labels: [],
  };
}

/** The industries.csv tuning columns (spec 2.2). */
function industryParams(i: IndustryRow): IndustryParams {
  return {
    trend_growth: i.trend_growth,
    cycle_beta: i.cycle_beta,
    volatility: i.volatility,
    boom_uplift: i.boom_uplift,
    crash_drop: i.crash_drop,
    rate_sensitivity: i.rate_sensitivity,
    margin_full_use: i.margin_full_use,
    fixed_cost_share: i.fixed_cost_share,
    variable_cost_share: i.variable_cost_share,
    capital_per_dollar: i.capital_per_dollar,
    asset_turnover: i.asset_turnover,
    asset_decay: i.asset_decay,
    asset_decay_threshold_usd: i.asset_decay_threshold_usd,
    rd_norm: i.rd_norm,
    labor_value_usd: i.labor_value_usd,
    pc_modifier: i.pc_modifier,
    data_tb_per_musd: i.data_tb_per_musd,
    data_decay_base: i.data_decay_base,
    cash_burning: i.cash_burning,
    earnings_multiple: i.earnings_multiple,
  };
}

/**
 * AI labs' long-term rate by stage from ai-boom.csv (spec 5.1.1): one preboom, bust and postcrash
 * row each, and the boom rows by boom year 0, 1, 2... with no gap.
 */
function aiSchedule(data: WorldData): AiSchedule {
  const bad = (key: string, message: string): LoadFailure => badValue("ai-boom", key, message);
  const rate = (stage: string): number => {
    const rows = data.ai_boom.rows.filter((r) => r.stage === stage);
    const row = rows[0];
    if (row === undefined) throw bad(stage, "no row");
    if (rows.length > 1) throw bad(stage, "more than one row");
    if (row.ai_labs_lt === null) throw bad(stage, "no ai_labs_lt");
    return row.ai_labs_lt;
  };
  const boom: [number, number][] = [];
  for (const r of data.ai_boom.rows.filter((r) => r.stage === "boom")) {
    if (r.boom_year === null) throw bad("boom", "a boom row has no boom_year");
    if (r.ai_labs_lt === null) throw bad("boom", "a boom row has no ai_labs_lt");
    boom.push([r.boom_year, r.ai_labs_lt]);
  }
  boom.sort((a, b) => a[0] - b[0]);
  if (boom.length === 0 || boom.some(([y], i) => y !== i)) {
    throw bad("boom", "boom years must run 0, 1, 2... with no gap");
  }
  return {
    preboom_lt: rate("preboom"),
    boom_lt: boom.map(([, lt]) => lt),
    bust_lt: rate("bust"),
    postcrash_lt: rate("postcrash"),
  };
}

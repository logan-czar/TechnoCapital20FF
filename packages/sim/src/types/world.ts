// The world state and the row types every module shares (spec 3; build-plan 2.3 `world/`).
// Ported from crates/sim/src/world/mod.rs, world/entities.rs, world/economy.rs and world/units.rs
// (plus `LoadError` from world/load.rs, which world/mod.rs re-exports).
//
// # The pure step contract
//
// Every scheduled job (spec 4) is a plain `(world: World, ctx: JobCtx) => void`. A job:
// - reads and writes only the World it is given and the JobCtx;
// - takes every random number from `ctx.draws`, an injected DrawSource (./draws.ts), never from a
//   global RNG or Math.random;
// - never reads the wall clock, the file system, the controls or the views;
// - iterates tables in id order and never iterates a Map or Set in insertion order (use
//   collections.ts `sortedEntries` / `sortedKeys`).
//
// World is plain data (no classes), so it is structured-cloneable: the spec 5.16 projection
// ranges re-run the monthly economy (spec 4.3) on a clone with "no rolls" draws and read the
// result. A job that reaches outside its arguments breaks projections, saves and the state hash
// at once. Every field is saved and hashed.
//
// Methods left to the world/ module port: World::{from_data, publishes_at, publishes,
// industry_estimated_at}, GlobalCycle::g_lagged, BusinessUnit::{assets_eff, opex_m, ebit_m},
// Company::{seat, data_in}, Origin::is_born, PhaseLabel/CyclePhase/AiStage::name (each name
// equals the variant).
//
// World and Company hold types owned by other modules (finance, market, births, news, recap,
// people, ai, ops). Those are in ./state/*.ts, one file per owning Rust module, and imported
// here; like Rust's world/mod.rs, this file does not re-export them.

import type { DateTime, Quarter, SimDate } from "./calendar.ts";
import type { Table } from "./collections.ts";
import type {
  CharacterId,
  CompanyId,
  CountryId,
  IndustryId,
  ProvinceId,
  StartupEventId,
  UnitId,
  ZoneId,
} from "./ids.ts";
import { MAX_SAFE_COUNT, roundHalfAway } from "./num.ts";
import type { Archetype, LockedPlan } from "./state/ai.ts";
import type { BirthsState, RunRate, VoteResult } from "./state/births.ts";
import type { BooksCheck, CompanyFinance, Rating } from "./state/finance.ts";
import type { MarketState } from "./state/market.ts";
import type { NewsWire } from "./state/news.ts";
import type { ComputeBill, DataBook, Stations } from "./state/ops.ts";
import type { NameBooks, Seat, SimpleCharacter, Skills, Trait } from "./state/people.ts";
import type { Recap } from "./state/recap.ts";

export type { Table } from "./collections.ts";
export type {
  CharacterId,
  CompanyId,
  CountryId,
  HeadlineId,
  IndustryId,
  Ordinal,
  ProvinceId,
  StartupEventId,
  UnitId,
  ZoneId,
} from "./ids.ts";
export type {
  AlertKind,
  AlertLevel,
  AlertLevels,
  AlertPayload,
  Notice,
  PauseReason,
  SkipKind,
} from "./notice.ts";

// ---------------------------------------------------------------- mod.rs

/**
 * All simulation state except the RNG streams (spec 3.1 to 3.10). Static tables are kept here
 * too, so a save holds everything and loads without the CSVs.
 */
export interface World {
  /** The clock: the time of the last finished tick (spec 3.1; starts 2020-01-01 00:00). */
  clock: DateTime;
  zones: Table<ZoneId, Zone>;
  countries: Table<CountryId, Country>;
  provinces: Table<ProvinceId, Province>;
  industries: Table<IndustryId, Industry>;
  companies: Table<CompanyId, Company>;
  characters: Table<CharacterId, Character>;
  /** Business units (spec 3.6), one per company in the MVP. */
  units: Table<UnitId, BusinessUnit>;
  /** World base rate (spec 3.1), fixed in the MVP. */
  base_rate: number;
  /** Neutral rate (spec 3.1); demand's rate term is 0 while the base rate sits here (5.1). */
  neutral_rate: number;
  /** The global business cycle (spec 3.1, 5.1). */
  cycle: GlobalCycle;
  /** The AI boom and the bubble (spec 3.1, 5.1.1). */
  ai: AiBoom;
  /** The growth profile in play (D970); a world without one plays `legacy`. */
  profile: EconomyProfile;
  /**
   * The debt aggression experiment (D971): company `id` plays level `debt_levels[id % length]`.
   * Absent (the default) leaves every company on spec 6.5, and out of the state hash.
   */
  debt_levels?: number[];
  /** The focus experiment (D972): company `id` plays focus `focus_levels[id % length]`. Absent is spec 6. */
  focus_levels?: number[];
  /** The R&D curve (D973): overspend above rd_norm has diminishing returns. Absent plays RD_DIMINISHING_X; Infinity is spec 5.6. */
  rd_diminishing_x?: number;
  /**
   * Person names per country, built once at load (spec 3.7.1, 3.7.2): jobs see no CSVs and a
   * save loads without them (D13).
   */
  name_books: NameBooks;
  /** Simple characters generated so far, so the next one's id (spec 3.7.1 `id`). Whole number (u32). */
  simple_characters_made: number;
  /** The engine's run of the build-plan M4.9 balance check (finance::jobs). */
  books_check: BooksCheck;
  /** Prices, fair values, bars and the headline indices (spec 3.10, 5.13 to 5.15; M5). */
  market: MarketState;
  /**
   * Fixed events, the startup event log, company names, province weights and the tipped lab
   * (spec 3.1 `startup_events`, 5.19; M6).
   */
  births: BirthsState;
  /** The Pdoomberg Wire (spec 5.18; M6). */
  news: NewsWire;
  /**
   * The quarterly recaps (spec 8, 21.6.2), each built at the start of its pre-quarter-end week,
   * oldest first, the last RECAPS_KEPT (recap/jobs.rs) kept so past recaps open by quarter
   * (m9-plan section 1; D433). Rust `Vec<Arc<Recap>>`.
   */
  recaps: Recap[];
}

/**
 * An industry with at least one and fewer than this many companies that do not publish shows its
 * totals, and its published companies' monthly unit figures, as bands (Logan's ruling, D432,
 * D436). Read by `World::industry_estimated_at` (D437).
 */
export const INDUSTRY_UNPUBLISHED_BELOW = 3;

// ---------------------------------------------------------------- entities.rs

/** A financial zone (spec 3.2.1), static in the MVP except its effective spread and confidence. */
export interface Zone {
  /** financial-zones.csv `zone_id`. */
  key: string;
  /** Logan's zone number, 1 to 26. Whole number (u32). */
  number: number;
  name: string;
  exchange_code: string;
  /**
   * The zone exchange's name, its headline index's name, its hub city and hub province
   * (financial-zones.csv; spec 9.2 `list_exchanges`).
   */
  exchange_name: string;
  headline_index: string;
  hub_city: string;
  hub_province: ProvinceId;
  /** How hard the global cycle hits the zone, North America 1.0 (spec 5.1). */
  intensity: number;
  /** Quarters the zone lags the global cycle (spec 5.1). Whole number (u32). */
  lag_quarters: number;
  /** Share of a member's crisis that spills to the others; loaded, never fires in the MVP (5.1). */
  contagion: number;
  /**
   * Standard deviation of the zone-only shock added to the zone effect each quarter, in the zone
   * effect's units (a yearly rate; D102). 0 for zones with no own dynamics (spec 5.1).
   */
  own_shock_sd: number;
  /** Sum of the members' GDP, USD (spec 3.2.1). */
  gdp_usd: number;
  /** The zone's share of world GDP: a weight of Z (spec 5.1). */
  gdp_share: number;
  /** Base credit spread as a fraction (CSV `credit_spread_bps`, spec 5.1.2). */
  credit_spread_base: number;
  /** Effective credit spread as a fraction, whole bps, recomputed each quarter (spec 5.1.2). */
  credit_spread: number;
  /** This quarter's zone-only shock (spec 5.1), 0 where `own_shock_sd` is 0. */
  own_shock: number;
  /** `intensity × g(t − lag) + own_shock`, a yearly rate (spec 5.1), set each quarter. */
  effect: number;
  /** Starting investor confidence, −100 to +100 (spec 5.1.2). */
  confidence_start: number;
  /** Investor confidence of the zone exchange, moved daily from M5 (spec 5.1.2). */
  confidence: number;
}

/** A country (spec 3.2), static. */
export interface Country {
  /** countries.csv `iso3`. */
  key: string;
  name: string;
  /**
   * countries.csv `superregion`, as written there (spec 9.2 `list_companies` filter, the Country
   * page; D425).
   */
  superregion: string;
  /** country-economy.csv `financial_zone`. */
  zone: ZoneId;
  /** GDP in USD (CSV `gdp_usd_bn`). */
  gdp_usd: number;
  /** Sovereign spread as a fraction (country-economy.csv `sovereign_spread_bps`, spec 5.1.2). */
  sovereign_spread: number;
  /** National corporate tax rate (country-economy.csv `corp_tax_rate`, spec 3.2, 5.11). */
  corp_tax_rate: number;
  /**
   * Sovereign rating (country-economy.csv `sovereign_rating`, spec 3.2): the corporate rating's
   * ceiling is one notch above it (5.12).
   */
  sovereign_rating: Rating;
}

/** A province (spec 3.3), static. */
export interface Province {
  /** provinces-*.csv `id`. */
  key: string;
  name: string;
  country: CountryId;
}

/** The static industries.csv tuning values (spec 2.2), converted at load. */
export interface IndustryParams {
  /** The long-term growth rate a year before the AI boom (spec 5.1). */
  trend_growth: number;
  /** The rate the long-term rate fades to under a fading profile (drift plan, D977). */
  mature_rate: number;
  /** Years for the gap to `mature_rate` to halve; 0 means no fade (drift plan, D977). */
  fade_half_life_years: number;
  /** Multiplies the cycle term of the quarterly growth draw (spec 5.1). */
  cycle_beta: number;
  /** Standard deviation of the quarterly growth shock, per quarter (spec 5.1). */
  volatility: number;
  /** Share of the AI labs boom added to this industry's lt (spec 5.1.1). */
  boom_uplift: number;
  /** One-off demand cut at the pop (spec 5.1.1). */
  crash_drop: number;
  /** s of the rate term (spec 5.1). */
  rate_sensitivity: number;
  /** Margin before R&D at full use (spec 5.5). */
  margin_full_use: number;
  /** f, the fixed cost share of revenue (spec 5.5). */
  fixed_cost_share: number;
  /** v as given in the CSV; the engine uses `1 − margin_full_use − f` (spec 5.5). */
  variable_cost_share: number;
  capital_per_dollar: number;
  /** Revenue per $1 of business assets a year at productivity 100 and M 1.0 (spec 5.2). */
  asset_turnover: number;
  /** Yearly decay rate on gross assets above the threshold (spec 5.10). */
  asset_decay: number;
  /** No decay on the first this many USD of a unit's gross assets (spec 5.10). */
  asset_decay_threshold_usd: number;
  rd_norm: number;
  /** USD of gross assets per labor unit (spec 5.10). */
  labor_value_usd: number;
  pc_modifier: number;
  data_tb_per_musd: number;
  data_decay_base: number;
  cash_burning: boolean;
  earnings_multiple: number;
}

/**
 * Boom, Normal, Glut or Bust: a label read from q_growth and S, with no demand multiplier
 * (spec 5.1, C20).
 */
export type PhaseLabel = "Boom" | "Normal" | "Glut" | "Bust";

/** PhaseLabel in declaration (Ord) order. */
export const PHASE_LABEL_VALUES = ["Boom", "Normal", "Glut", "Bust"] as const;

/** One closed quarter of an industry, for the industry screen's 20-quarter chart (spec 8, 9.2). */
export interface IndustryQuarter {
  quarter: Quarter;
  /** Effective demand at the quarter's end, USD a year. */
  demand: number;
  /** Supply at the quarter's end, USD a year. */
  supply: number;
  /** The quarter's growth, per quarter. */
  q_growth: number;
  /** The quarter's long-term rate, a year. */
  lt: number;
}

/** An industry (spec 3.4). */
export interface Industry {
  /** industries.csv `id` (a slug). */
  key: string;
  name: string;
  /** Tech, Finance, Energy, Industry, Consumer, Health or Services (spec 2.2). */
  sector: string;
  /** Flavor label of the business assets (spec 2.2). */
  asset_label: string;
  /** World demand in 2020, USD a year (CSV `world_size_2020_usd_bn`). */
  world_size_2020_usd: number;
  params: IndustryParams;
  /** This quarter's long-term rate a year: trend_growth plus the boom term (spec 5.1.1). */
  lt: number;
  /**
   * Last quarter's lt (spec 5.1.1), read when the month closed on a quarter's first day belongs
   * to the quarter before (D100).
   */
  prev_lt: number;
  /** Yearly demand on the long-term rate alone (spec 5.1), USD. */
  trend_demand: number;
  /** Yearly demand moved by the quarterly growth draws (spec 5.1), USD. */
  demand_core: number;
  /** Effective yearly demand after the rate term (spec 5.1), USD. */
  demand: number;
  /** This quarter's demand growth, per quarter (spec 5.1). */
  q_growth: number;
  /** Last quarter's demand growth, per quarter (spec 5.1). */
  prev_q_growth: number;
  /**
   * Set by the boom and the pop: the next draw carries over from lt_q instead of last quarter's
   * growth (spec 5.1.1 "sets prev_q_growth to its new lt_q"; D103).
   */
  carry_reset: boolean;
  phase_label: PhaseLabel;
  /** Fringe pool business assets (spec 5.3), USD at cost. */
  fringe_assets: number;
  /** Supply, USD a year (spec 5.2). */
  supply: number;
  /** S = supply ÷ demand (spec 5.2). */
  supply_ratio: number;
  /** M = clamp((1 ÷ S)^0.5, 0.7, 1.3) (spec 5.2). */
  market_factor: number;
  /** Last month's fringe revenue, USD (spec 5.3). */
  fringe_revenue_m: number;
  /** The last 20 closed quarters, oldest first (spec 8 Industries detail chart). */
  history: IndustryQuarter[];
}

/** A corporation (spec 3.5). */
export interface Company {
  /** companies.csv `id`. */
  key: string;
  name: string;
  /** Empty for private companies. */
  ticker: string;
  industry: IndustryId;
  hq_country: CountryId;
  hq_province: ProvinceId;
  public: boolean;
  /** Starting revenue, USD a year (CSV `revenue_usd_m`). */
  revenue_usd: number;
  /** Shares outstanding (company-start.csv `shares`; whole number (u64), D3). */
  shares_out: number;
  /** Business units (spec 3.5; one in the MVP). */
  units: UnitId[];
  /**
   * The named controller when it is a full character (companies.csv `controller` holds a CH- id;
   * spec 3.5, 6 "traits"); null for companies, states and the widely held.
   */
  controller: CharacterId | null;
  /** Labor units L (spec 3.5, 5.10), recounted at 4.3 step 4. Whole number (u64). */
  labor_units: number;
  /** `labor_assignment` (spec 3.5): one station per labor unit, fitted to L at 4.3 step 4. */
  stations: Stations;
  /** Productive compute (spec 5.8), set at 4.3 step 5. */
  pc: number;
  /**
   * The stepped productive compute bonus (spec 5.8), corporation-wide. Set at load by the 7.1
   * two-pass rule (D106); the monthly compute step (4.3 step 5) recounts it from the stations
   * from the first month on.
   */
  pc_bonus: number;
  /**
   * Extra base compute, data compute and licences with the month's bill (spec 3.5, 3.8), set at
   * 4.3 step 5; the bill is the month's shared costs (5.5).
   */
  compute: ComputeBill;
  /** Data per industry the company has units in (spec 3.5 `data`, 5.9), in industry id order. */
  data: CompanyData[];
  /**
   * The five labor seats in `Seat::LABOR` order (spec 3.7): null while closed (fewer labor
   * units) or open and waiting for its character (4.3 step 11). Length LABOR_SEAT_COUNT (5; ./state/people.ts).
   */
  board: (SeatHolder | null)[];
  /**
   * Seats opened by this month's recount (4.3 step 4) that get a simple character at step 11
   * (spec 3.7.1, 5.10), in opening order.
   */
  seats_to_fill: Seat[];
  /** 0 to 100 (spec 5.7), from the seated board each month (D115). */
  management_score: number;
  /**
   * Archetype (spec 3.5, 6.1), set at load from control_basis, revenue, sector and the named
   * controller's traits (D120).
   */
  archetype: Archetype;
  /** Cash, USD (company-start.csv `cash_usd`; settled monthly at 4.3 step 13). */
  cash_usd: number;
  /**
   * The credit line (drawn from company-start.csv `credit_drawn_usd`), rating, distress, tax,
   * ledgers and statements (spec 3.5, 3.9, 5.11, 5.12).
   */
  finance: CompanyFinance;
  /**
   * companies.csv `control_basis` is `state` (spec 6.1 State champion row, 5.20.1 step 4: a state
   * controller votes with no traits). Never true for a born company (founders).
   */
  state_controlled: boolean;
  /**
   * Start (the 651) or Born at a plan lock by a startup event (spec 3.5 `origin`, `born_date`,
   * `event`).
   */
  origin: Origin;
  /** The full characters of a born company, lead founder first (spec 3.5 `founders`). */
  founders: CharacterId[];
  /** Board seats with no labor unit (spec 5.19.4 step 4), in cast order. */
  directors: Director[];
  /**
   * The cap table (spec 3.5 `holders`; 5.19.3, 5.20.1, 6.6): its shares always sum to shares_out
   * (D153).
   */
  holders: Holding[];
  /**
   * Consecutive quarters with EBIT below 0 (spec 3.6 `loss_quarters`, 6), counted at each close;
   * 0 at load and at birth. Whole number (u32).
   */
  loss_quarters: number;
  /**
   * The plan locked at the last plan lock (spec 3.5 `plan`, section 6); null before the first
   * lock (the plan at load is D283's, on the units).
   */
  plan: LockedPlan | null;
  /**
   * Consecutive failed 6.6 raises (whole number, u32), and whether one failed with none
   * succeeding since (6.2 holds g at −d_eff until a raise succeeds). Parked with 6.6: never set
   * with today's data.
   */
  failed_raises: number;
  raise_pending: boolean;
  /**
   * The first plan lock at which an IPO may be put to the board (spec 3.5 `ipo_next_vote`,
   * 5.20.1); null for a listed company.
   */
  ipo_next_vote: Quarter | null;
  /** The last IPO vote (spec 3.5 `ipo_last_vote`, 8 Board tab). */
  ipo_last_vote: IpoVoteRecord | null;
  /**
   * A born company's run rate at birth (spec 5.19.3, D271): the Lite AI reads its revenue and
   * EBIT until its first quarter is archived (D262).
   */
  birth_run_rate: RunRate | null;
  /**
   * A starting company's control as companies.csv gives it (spec 3.5, 8 Company header and Cap
   * table; D425): read by the views only, never by a job. null for a born company.
   */
  start_control: StartControl | null;
}

/** Who controls a starting company, as companies.csv `controller` names it (spec 3.5; D425). */
export type ControllerRef =
  /** Widely held: no controller. */
  | { kind: "None" }
  | { kind: "Character"; character: CharacterId }
  /** A state (an iso3 in companies.csv). */
  | { kind: "State"; country: CountryId }
  /** Another company (a CO- id). */
  | { kind: "Company"; company: CompanyId };

/** companies.csv's control columns of a starting company (spec 3.5, 8; D425). */
export interface StartControl {
  controller: ControllerRef;
  /** `controller_stake_pct` as a fraction of the starting shares; null when not given. */
  stake: number | null;
  /** `control_basis`: majority, class_a, state, proxy, trust, subsidiary or widely_held. */
  basis: string;
  /** `owner_of_record` (a proxy holder), when it names a character. */
  owner_of_record: CharacterId | null;
}

/** Where a company came from (spec 3.5 `origin`). */
export type Origin =
  /** One of the 651 starting companies. */
  | { kind: "Start" }
  /** Born at the plan lock on `date` by startup event `event` (spec 5.19). */
  | { kind: "Born"; date: SimDate; event: StartupEventId };

/**
 * A director: a board seat with no labor unit and no effect in the MVP except the IPO vote
 * (spec 5.19.4 step 4, 5.20.1 step 2).
 */
export type Director = { kind: "Full"; character: CharacterId } | { kind: "Simple"; seat: SimpleSeat };

/** Who holds shares (spec 3.5 `holders`). */
export type Holder =
  /**
   * A starting company's holders as one block: companies.csv's controller, owner of record and
   * other holders are not split out in the MVP (D153).
   */
  | { kind: "Existing" }
  /** A founder of a born company (5.19.3). */
  | { kind: "Founder"; character: CharacterId }
  /** The unnamed seed investors of a born company (5.19.3). */
  | { kind: "SeedInvestors" }
  /** The unnamed public float of a listing (5.20.1 Listing step 3). */
  | { kind: "PublicFloat" }
  /** The unnamed new investors of a 6.6 share issue. */
  | { kind: "NewInvestors" };

/** One cap table line. */
export interface Holding {
  holder: Holder;
  /** Whole number (u64). */
  shares: number;
}

/** An IPO vote as the Board tab shows it (spec 3.5 `ipo_last_vote`, 5.20.1). */
export interface IpoVoteRecord {
  date: SimDate;
  result: VoteResult;
  /** The vote passed but the world-wide cap of 3 turned it back (5.20.1 step 6). */
  capped: boolean;
}

/** New assets ramping at 80% (spec 5.10, 10.0.4). */
export interface Tranche {
  /** USD at cost still ramping. */
  amount: number;
  /** Month closes left at 80%. Whole number (u32). */
  months_left: number;
}

/**
 * A business unit (spec 3.6). Derived figures (module port): `assets_eff = gross_assets − 0.2 ×
 * Σ ramping.amount` (spec 5.2, 10.0.4), `opex_m = variable_m + fixed_m` (spec 3.6), `ebit_m =
 * revenue_m − variable_m − fixed_m − rd_m − dep_m − shared_m` (spec 5.5).
 */
export interface BusinessUnit {
  company: CompanyId;
  industry: IndustryId;
  base_province: ProvinceId;
  /** Business assets at cost (spec 3.6), USD. */
  gross_assets: number;
  ramping: Tranche[];
  /** Book value of the business assets, USD (spec 3.6). */
  asset_book: number;
  /** 30 to 200, starts 100 (spec 3.6, 5.6). */
  productivity: number;
  /** Fit and resource points (spec 5.4); 0 in the MVP while industries use the defaults. */
  location_bonus: number;
  /** Fixed cash cost per $1 of gross assets a year, set at load (spec 5.5, 7.1). */
  fixed_cost_rate: number;
  /** Annual net growth rate g from the locked plan (spec 5.10, 6.2). */
  growth_plan: number;
  /** R&D spend as a share of revenue from the locked plan (spec 5.5, 6.3). */
  rd_plan: number;
  /** Last month's revenue, USD (spec 5.4). */
  revenue_m: number;
  /** Last month's variable cost, USD (spec 5.5). */
  variable_m: number;
  /** Last month's fixed cash cost, USD (spec 5.5). */
  fixed_m: number;
  /** Last month's R&D spend, USD (spec 5.5). */
  rd_m: number;
  /** Last month's depreciation, USD (spec 5.5). */
  dep_m: number;
  /**
   * Last month's shared costs, USD: the company's 3.8 compute bill split by revenue share
   * (spec 5.5).
   */
  shared_m: number;
  /** Last month's asset purchases at cost, USD (spec 5.10); paid at the cash settle (4.3 step 13). */
  capex_m: number;
  /** Last month's cash from asset sales, USD (spec 5.10). */
  sale_proceeds_m: number;
  /** Last month's gain (or loss, below 0) on asset sales, USD (spec 5.10). */
  sale_gain_m: number;
}

/** One corporation's data in one industry (spec 3.5 `data`, 5.9). */
export interface CompanyData {
  industry: IndustryId;
  book: DataBook;
}

/** A simple character seated on a board (spec 3.7.1), with its id. */
export interface SimpleSeat {
  /**
   * Spec 3.7.1 `id`: the order it was generated in, from 0 (`World.simple_characters_made`).
   * Whole number (u32).
   */
  id: number;
  character: SimpleCharacter;
}

/**
 * Who holds a labor seat (spec 3.7): a simple character (3.7.1), or a full character a startup
 * event seated (3.7.2, 5.19.4; from M6).
 */
export type SeatHolder = { kind: "Simple"; seat: SimpleSeat } | { kind: "Full"; character: CharacterId };

/**
 * A full character (spec 3.7.2): the 296 of characters.csv (D11) and, from M6, those made in
 * play. The MVP keeps what it reads: skills and traits for the management score, rolls and the
 * Lite AI's trait nudges.
 */
export interface Character {
  /** characters.csv `id`. */
  key: string;
  name: string;
  /** player, rival or holder from characters.csv; generated for those made in play (3.7.2). */
  tier: string;
  /** Whole number (u8). */
  age: number;
  skills: Skills;
  /**
   * Traits of the 12 pairs (1-corporate-core 1.1.2). characters.csv's unique traits and perks
   * outside the pairs (such as "Operational Excellence") are dropped at load (D113).
   */
  traits: Trait[];
  /** characters.csv `origin_province` (spec 3.7.2 home province). */
  home_province: ProvinceId;
  cash_usd: number;
}

// ---------------------------------------------------------------- economy.rs
// World-level economy state (spec 3.1): the global business cycle and the AI boom. The formulas
// that move it live in the economy/ port.

/** The global cycle's phases, in order (spec 5.1). */
export type CyclePhase = "Expansion" | "Overheating" | "Contraction" | "Recovery";

/** What a cycle phase draws on entry and where it goes next (spec 5.1 table, T). */
export interface PhaseSpec {
  /** g_t a year, drawn uniform in `lo..hi`. */
  g_range: readonly [number, number];
  /** Length in whole quarters, drawn uniform in `lo..=hi` (D101). */
  length: readonly [number, number];
  next: CyclePhase;
}

/**
 * A growth profile (D970): the scenario the world's economy plays. Plain data, kept on the
 * world so a save carries it. `legacy` is the spec 5.1 behaviour the Rust reference has.
 */
/** A window of slow growth (drift plan, D978), a scenario setting. */
export interface Slowdown {
  /** The first calendar year of the slowdown. */
  start_year: number;
  /** Whole years it lasts: it ends with the quarter before `start_year + years`. */
  years: number;
  /** Multiplies every industry's trend while it lasts (1 = no slowdown, 1/3 = a third of normal). */
  depth: number;
}

export interface EconomyProfile {
  id: string;
  name: string;
  description: string;
  /** Multiplies every industry's `trend_growth` before the AI boom link (1 = the CSV). */
  lt_scale: number;
  /** Multiplies every industry's quarterly volatility (1 = the CSV). */
  volatility_scale: number;
  /** False pins AI labs to their pre-boom rate for the whole run: no boom, no pop (spec 5.1.1). */
  ai_boom: boolean;
  /**
   * Drift plan (D977, spec v1.5 5.1): each industry's trend fades from `trend_growth` to its
   * `mature_rate` with its `fade_half_life_years`, counted from 1 Jan 2020. False keeps the CSV rate.
   */
  fade: boolean;
  /** Drift plan (D977): multiplies every industry's long-term rate in every year (1 = the CSV). */
  world_growth_scale: number;
  /** Drift plan (D978): a window of slow growth, or null. A scenario setting, off in the baseline. */
  slowdown: Slowdown | null;
  /** Drift plan (D978): multiplies the global cycle's g draws and the zones' own shocks (1 = spec 5.1). */
  cycle_scale: number;
  /** Drift plan (D978): multiplies the hourly price noise (1 = spec 5.14). */
  price_noise_scale: number;
  start_phase: CyclePhase;
  /** The four phase tables the global cycle draws from (spec 5.1). */
  phases: Record<CyclePhase, PhaseSpec>;
}

/** Rust `CyclePhase::ALL`, in order. */
export const CYCLE_PHASE_VALUES = ["Expansion", "Overheating", "Contraction", "Recovery"] as const;

/**
 * The global business cycle (spec 3.1, 5.1). `g_lagged(lag)` (module port) is
 * `g_history[min(lag, len − 1)]`, or `g_t` when the history is empty (spec 5.1 `g(t − lag)`).
 */
export interface GlobalCycle {
  phase: CyclePhase;
  /**
   * Quarters left in the phase, this quarter included (the phase ends when it reaches 0). Whole
   * number (u32).
   */
  quarters_left: number;
  /** The cycle value: the phase's push on demand growth, a year, for a zone of intensity 1.0. */
  g_t: number;
  /**
   * g of this quarter and the ones before, newest first, as far back as the longest zone lag
   * (spec 5.1 `g(t − lag)`; before the start, the starting g_t).
   */
  g_history: number[];
  /** Z, the GDP-weighted average zone intensity (spec 5.1), static in the MVP. */
  z_avg: number;
}

/** The AI stage (spec 3.1, 5.1.1). */
export type AiStage = "Preboom" | "Boom" | "Bust" | "Postcrash";

/** AiStage in declaration (Ord) order. */
export const AI_STAGE_VALUES = ["Preboom", "Boom", "Bust", "Postcrash"] as const;

/** AI labs' long-term rate by stage, from ai-boom.csv (spec 5.1.1). */
export interface AiSchedule {
  preboom_lt: number;
  /** By boom year 0, 1, 2...; the last holds for every later year. */
  boom_lt: number[];
  bust_lt: number;
  postcrash_lt: number;
}

/** The AI boom and the bubble (spec 3.1, 5.1.1). */
export interface AiBoom {
  stage: AiStage;
  /** The boom event (1 January 2030). */
  boom_date: SimDate;
  /** The pop, rolled at load. */
  pop_date: SimDate;
  /** AI labs' long-term rate this quarter (spec 5.1.1). */
  ai_labs_lt: number;
  schedule: AiSchedule;
}

// ---------------------------------------------------------------- units.rs
// CSV unit conversions (CLAUDE.md, decision D3): money is f64 USD and rates are fractions inside
// the sim; the CSVs give $M, $bn and bps. These run only in world/load, once, at load.

/** USD in one million (the CSV `_usd_m` columns). */
export const USD_PER_MILLION = 1.0e6;
/** USD in one billion (the CSV `_usd_bn` columns). */
export const USD_PER_BILLION = 1.0e9;
/** Basis points in 1.0 (the CSV `_bps` columns). */
export const BPS_PER_UNIT = 10_000.0;
/** How far a CSV share count may sit from a whole number before load rejects it. */
export const SHARE_COUNT_TOLERANCE = 1.0e-6;

/** Rust `Result<T, E>`, as plain data. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** `$M` to USD. */
export function usdFromMillions(m: number): number {
  return m * USD_PER_MILLION;
}

/** `$bn` to USD. */
export function usdFromBillions(bn: number): number {
  return bn * USD_PER_BILLION;
}

/** Basis points to a fraction (100 bps is 0.01). */
export function fractionFromBps(bps: number): number {
  return bps / BPS_PER_UNIT;
}

/**
 * A CSV share count (a whole, non-negative number stored as a float) to a whole number (u64,
 * D3). Rust rejects counts at or above u64::MAX; here the limit is MAX_SAFE_COUNT (2^53 − 1),
 * past which a JS number is no longer exact.
 */
export function sharesFromCsv(shares: number): Result<number, string> {
  const whole = roundHalfAway(shares);
  if (!Number.isFinite(shares) || shares < 0 || Math.abs(shares - whole) > SHARE_COUNT_TOLERANCE) {
    return { ok: false, error: `share count \`${shares}\` is not a whole number` };
  }
  if (whole > MAX_SAFE_COUNT) {
    return { ok: false, error: `share count \`${shares}\` is too large` };
  }
  return { ok: true, value: whole };
}

// ---------------------------------------------------------------- load.rs (LoadError)

/**
 * A row that cannot be turned into sim state (world/load.rs). `sim_data::check` catches all of
 * these first on good data; this guards a Sim built from unchecked rows. Rust's messages:
 * - Duplicate: "{table}: id `{key}` appears twice"
 * - MissingRef: "{table} `{key}`: {field} `{value}` is not a known {target}"
 * - BadValue: "{table} `{key}`: {message}"
 */
export type LoadError =
  | { kind: "Duplicate"; table: string; key: string }
  | {
      kind: "MissingRef";
      table: string;
      key: string;
      field: string;
      value: string;
      target: string;
    }
  | { kind: "BadValue"; table: string; key: string; message: string };
